﻿﻿﻿﻿﻿﻿﻿﻿// src/controllers/auth.controller.js
import { db, admin } from "../utils/firebase.js";
import crypto from "crypto";
import { makeToken } from "../middlewares/auth.js";
import { logServerError, sendInternalError } from "../utils/httpErrors.js";
import { sendResetPasswordEmail } from "../utils/email.js";
import { getProductorBloqueo } from "../utils/productorAccess.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isValidEmail = (value) => EMAIL_REGEX.test(value);
const normalizeIpt = (value) => String(value || "").trim();
const getProductorAuthUid = (ipt) => normalizeIpt(ipt);

const normalizeIngresoMetadata = (body = {}) => {
  const plataforma = String(body.plataforma || "").trim().toLowerCase();
  const appVersion = String(body.appVersion || "").trim();
  const evento = String(body.evento || "").trim().toLowerCase();

  return {
    plataforma: plataforma || "desconocida",
    appVersion: appVersion || "desconocida",
    evento: evento || "login",
  };
};

const registrarIngresoProductor = async ({ ipt, productorId, metadata = {} }) => {
  await db.collection("ingresosProductor").add({
    ipt: String(ipt),
    productorId,
    fecha: new Date(),
    ...normalizeIngresoMetadata(metadata),
  });
};

const ensureProductorAuthUser = async ({ ipt, nombreCompleto, email }) => {
  const uid = getProductorAuthUid(ipt);
  if (!uid) throw new Error("IPT requerido para crear usuario productor");

  try {
    await admin.auth().getUser(uid);
    return uid;
  } catch (e) {
    if (e?.code !== "auth/user-not-found") throw e;
  }

  const authData = {
    uid,
    displayName: nombreCompleto,
  };
  if (email) {
    try {
      await admin.auth().getUserByEmail(email);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        authData.email = email;
      }
    }
  }
  await admin.auth().createUser(authData);
  return uid;
};

const normalizeRole = (role) => {
  const v = String(role || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (v === "productor") return "productor";
  if (v.includes("limitado")) return "administrador limitado";

  return "administrador";
};

const DEFAULT_ADMIN_PERMISOS = {
  turnos: true,
  productores: true,
  insumos: true,
  lotes: true,
  users: true,
  informes: true,
};

const DEFAULT_LIMITED_ADMIN_PERMISOS = {
  turnos: false,
  productores: false,
  insumos: false,
  lotes: false,
  users: false,
  informes: false,
};
const PROTECTED_ADMIN_EMAILS = new Set(
  String(process.env.PROTECTED_ADMIN_EMAILS || process.env.PRIMARY_ADMIN_EMAILS || "gabrielparedok@gmail.com")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean)
);

const hasPermisos = (data) => {
  return Boolean(
    data?.permisos &&
    typeof data.permisos === "object" &&
    Object.keys(data.permisos).length > 0
  );
};

const resolvePermisos = ({ role, permisos }) => {
  if (hasPermisos({ permisos })) return permisos;
  return normalizeRole(role).includes("limitado")
    ? DEFAULT_LIMITED_ADMIN_PERMISOS
    : DEFAULT_ADMIN_PERMISOS;
};

const isProtectedAdmin = (data = {}) => {
  const email = normalizeEmail(data?.email);
  return Boolean(
    data?.adminPrincipal === true ||
    data?.primaryAdmin === true ||
    data?.protectedAdmin === true ||
    (email && PROTECTED_ADMIN_EMAILS.has(email))
  );
};

const resolveLoginUserDoc = async ({ uid, emailNormalized }) => {
  const candidates = new Map();
  const uidDoc = await db.collection("users").doc(uid).get();

  if (uidDoc.exists) {
    candidates.set(uidDoc.id, {
      id: uidDoc.id,
      ref: uidDoc.ref,
      data: uidDoc.data(),
    });
  }

  if (emailNormalized) {
    const emailSnap = await db.collection("users").where("email", "==", emailNormalized).get();
    emailSnap.docs.forEach((doc) => {
      candidates.set(doc.id, {
        id: doc.id,
        ref: doc.ref,
        data: doc.data(),
      });
    });
  }

  const docs = Array.from(candidates.values());
  if (!docs.length) return null;

  const selected =
    docs.find((doc) => doc.id === uid && hasPermisos(doc.data)) ||
    docs.find((doc) => hasPermisos(doc.data)) ||
    docs.find((doc) => doc.id === uid) ||
    docs[0];

  const resolvedUserData = {
    ...selected.data,
    email: emailNormalized || selected.data.email || "",
    permisos: resolvePermisos({
      role: selected.data.role,
      permisos: selected.data.permisos,
    }),
  };

  return {
    resolvedUid: uid,
    resolvedUserData,
    duplicateRefs: docs
      .filter((doc) => doc.id !== uid)
      .map((doc) => doc.ref),
  };
};

const canonicalizeLoginUserDoc = async ({ uid, resolvedUserData, duplicateRefs = [] }) => {
  const canonicalRef = db.collection("users").doc(uid);
  const batch = db.batch();

  batch.set(canonicalRef, resolvedUserData, { merge: true });
  duplicateRefs.forEach((ref) => {
    batch.delete(ref);
  });

  await batch.commit();
};

const FIREBASE_SIGN_IN_ERRORS = {
  INVALID_LOGIN_CREDENTIALS: { status: 401, message: "Credenciales inválidas" },
  INVALID_PASSWORD: { status: 401, message: "Credenciales inválidas" },
  EMAIL_NOT_FOUND: { status: 401, message: "Credenciales inválidas" },
  USER_DISABLED: { status: 403, message: "La cuenta ha sido deshabilitada" },
  TOO_MANY_ATTEMPTS_TRY_LATER: { status: 429, message: "Demasiados intentos. Intente nuevamente en unos minutos." },
};

const resolveFirebaseWebApiKey = () => {
  return String(
    process.env.FIREBASE_WEB_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    ""
  ).trim();
};

const signInWithFirebasePassword = async ({ email, password }) => {
  const apiKey = resolveFirebaseWebApiKey();
  if (!apiKey) {
    const configError = new Error("FIREBASE_WEB_API_KEY no configurada");
    configError.kind = "config";
    throw configError;
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.idToken) {
    const code = String(data?.error?.message || "").trim();
    const mapped = FIREBASE_SIGN_IN_ERRORS[code];
    const authError = new Error(mapped?.message || "No se pudo validar las credenciales");
    authError.kind = "auth";
    authError.status = mapped?.status || 401;
    throw authError;
  }

  return data.idToken;
};

// Registrar usuario
export const registerUser = async (req, res) => {
  try {
    const { email, password, nombre, role } = req.body;
    const emailNormalized = normalizeEmail(email);

    if (!isValidEmail(emailNormalized)) {
      return res.status(400).json({ error: "Ingrese un correo electrónico válido." });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    const domain = process.env.WEB_EMAIL_DOMAIN;
    if (domain && !emailNormalized.endsWith(`@${domain.toLowerCase()}`)) {
      return res.status(400).json({ error: "Email no pertenece al dominio institucional" });
    }

    // Evitar correos duplicados en Firestore (además de la restricción de Firebase Auth)
    const existingUsers = await db.collection("users").where("email", "==", emailNormalized).limit(1).get();
    if (!existingUsers.empty) {
      return res.status(409).json({ error: "Ya existe un usuario con ese correo" });
    }

    const userRecord = await admin.auth().createUser({
      email: emailNormalized,
      password,
      displayName: nombre,
    });

    const normalizedRole = normalizeRole(role);
    const finalRole = normalizedRole.includes("limitado")
      ? "administrador limitado"
      : "administrador";

    const permisos = resolvePermisos({ role: finalRole });

    await db.collection("users").doc(userRecord.uid).set({
      email: emailNormalized,
      nombre,
      role: finalRole,
      permisos,
      activo: true,
      createdAt: new Date(),
    });

    res.json({
      message: "✅ Usuario creado correctamente",
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        nombre: userRecord.displayName,
        role: finalRole,
      },
    });
  } catch (error) {
    logServerError("Error al registrar usuario", error);
    res.status(500).json({ error: "No se pudo registrar el usuario" });
  }
};

// Registrar productor (crea doc en Firestore y asegura usuario en Firebase Auth)
export const registerProductor = async (req, res) => {
  try {
    const {
      ipt,
      nombreCompleto,
      cuil,
      email,
      telefono,
      domicilioCasa,
      domicilioIngresoCoord,
      estado,
    } = req.body;

    if (!ipt || !nombreCompleto || !cuil) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    // Validación de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: "Ingrese un correo electrónico válido." });
    }

    // Validación de formato de teléfono
    const telRegex = /^\d{10,13}$/;
    if (telefono && !telRegex.test(telefono)) {
      return res.status(400).json({ error: "El número debe contener solo dígitos (10 a 13 números)." });
    }

    // Validar unicidad de IPT (si existe y está activo, no permitir duplicado)
    const existingIpt = await db
      .collection("productores")
      .where("ipt", "==", String(ipt))
      .limit(1)
      .get();
    
    if (!existingIpt.empty) {
      return res.status(400).json({ error: "El número de IPT ya se encuentra registrado." });
    }

    // Validar unicidad de CUIL
    const existingCuil = await db
      .collection("productores")
      .where("cuil", "==", String(cuil))
      .limit(1)
      .get();
    
    if (!existingCuil.empty) {
      return res.status(400).json({ error: "El CUIL ya se encuentra registrado." });
    }

    // Validar unicidad de Email
    if (email) {
      const existingEmail = await db
        .collection("productores")
        .where("email", "==", String(email).toLowerCase())
        .limit(1)
        .get();
      
      if (!existingEmail.empty) {
        return res.status(400).json({ error: "El correo electrÃ³nico ya se encuentra registrado." });
      }
    }

    const newProductor = {
      ipt: String(ipt),
      nombreCompleto,
      cuil: String(cuil),
      email: email || "",
      telefono: telefono || "",
      domicilioCasa: domicilioCasa || "",
      domicilioIngresoCoord: domicilioIngresoCoord || null,
      estado: estado || "Nuevo",
      requiereCambioContrasena: true, // Primer login con CUIL
      historialIngresos: 0,
      fechaRegistro: new Date(),
      activo: true,
    };

    const docRef = await db.collection("productores").add(newProductor);

    const authUid = getProductorAuthUid(ipt);

    // Asegurar que exista un usuario en Firebase Auth con ese UID
    await ensureProductorAuthUser({ ipt, nombreCompleto, email });

    // Asignar claims útiles para posteriores autorizaciones
    await admin.auth().setCustomUserClaims(authUid, {
      role: "productor",
      ipt: String(ipt),
      nombre: nombreCompleto,
      email: email || undefined,
      productorId: String(ipt),
    });

    return res.json({
      message: "âœ… Productor registrado correctamente",
      id: docRef.id,
      authUid,
      ...newProductor,
    });
  } catch (error) {
    logServerError("Error al registrar productor", error);
    return res.status(500).json({ error: "Error al registrar productor" });
  }
};

// Login de usuario
// Login de usuario (web panel) â€” recibe un Firebase ID token verificado desde el cliente
export const loginUser = async (req, res) => {
  try {
    const { idToken, email, password } = req.body;
    let firebaseIdToken = typeof idToken === "string" ? String(idToken).trim() : "";

    if (!firebaseIdToken) {
      const emailNormalized = normalizeEmail(email);
      const passwordNormalized = String(password || "");

      if (!isValidEmail(emailNormalized) || !passwordNormalized) {
        return res.status(400).json({ error: "Credenciales requeridas" });
      }

      try {
        firebaseIdToken = await signInWithFirebasePassword({
          email: emailNormalized,
          password: passwordNormalized,
        });
      } catch (error) {
        if (error?.kind === "config") {
          logServerError("Configuración faltante para login Firebase", error);
          return res.status(500).json({ error: "Configuración de autenticación incompleta" });
        }

        if (error?.kind === "auth") {
          return res.status(error.status || 401).json({ error: error.message || "Credenciales inválidas" });
        }

        throw error;
      }
    }

    // 1. Verificar el ID token con Firebase Admin SDK
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
    } catch {
      return res.status(401).json({ error: "Credenciales invÃ¡lidas" });
    }

    const { uid, email: firebaseEmail } = decodedToken;
    const emailNormalized = normalizeEmail(firebaseEmail);

    // 2. El panel web solo permite administradores registrados en Firestore/users.
    const resolvedUser = await resolveLoginUserDoc({ uid, emailNormalized });

    if (!resolvedUser?.resolvedUserData) {
      return res.status(403).json({ error: "Usuario administrador no registrado" });
    }

    const { resolvedUid, resolvedUserData } = resolvedUser;
    const protectedAdmin = isProtectedAdmin({ ...resolvedUserData, email: emailNormalized });
    const role = protectedAdmin ? "administrador" : (normalizeRole(resolvedUserData.role) || "administrador");
    const permisos = protectedAdmin
      ? { ...DEFAULT_ADMIN_PERMISOS }
      : resolvePermisos({ role, permisos: resolvedUserData.permisos });

    if (resolvedUserData.activo === false) {
      return res.status(403).json({ error: "Usuario inactivo" });
    }

    const looksLikeProductor = Boolean(resolvedUserData.ipt);

    // 3. Los productores usan la app móvil — no el panel web
    if (looksLikeProductor || role === "productor") {
      return res.status(403).json({ error: "Los productores deben usar la aplicación móvil" });
    }

    await canonicalizeLoginUserDoc({
      uid: resolvedUid,
      resolvedUserData,
      duplicateRefs: resolvedUser.duplicateRefs,
    });

    // 4. Actualizar último acceso
    await db.collection("users").doc(resolvedUid).set({
      email: emailNormalized,
      role,
      permisos,
      ...(protectedAdmin ? { protectedAdmin: true } : {}),
      ultimoAcceso: new Date(),
    }, { merge: true });
    await admin.auth().setCustomUserClaims(resolvedUid, {
      role,
      permisos,
    });

    console.log("USER DOC:", resolvedUserData);
    console.log("PERMISOS:", permisos);
    console.log("UID:", resolvedUid);

    const webToken = makeToken({
      uid: resolvedUid,
      email: emailNormalized,
      role,
      permisos,
      nombre: resolvedUserData.nombre || "",
    });
    res.json({
      token: webToken,
      role,
      permisos,
    });
  } catch (error) {
    logServerError("Error al hacer login", error);
    res.status(500).json({ error: "No se pudo iniciar sesión" });
  }
};

const hashPassword = (password, salt) => {
  return crypto.createHash("sha256").update(salt + ":" + password).digest("hex");
};

export const loginProductor = async (req, res) => {
  try {
    const { ipt, password } = req.body;
    if (!ipt || !password) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({ error: "Productor no encontrado" });
    }
    const doc = snap.docs[0];
    const data = doc.data();
    const bloqueo = getProductorBloqueo(data);
    if (bloqueo) {
      return res.status(403).json({ error: bloqueo.message, code: bloqueo.code });
    }
    const requiereCambio = Boolean(data.requiereCambioContrasena);
    let ok = false;
    if (requiereCambio) {
      ok = String(password) === String(data.cuil);
    } else {
      const salt = String(data.ipt);
      const hash = hashPassword(String(password), salt);
      ok = hash && data.passwordHash && hash === data.passwordHash;
    }
    if (!ok) {
      return res.status(401).json({ error: "Credenciales invÃ¡lidas" });
    }
    const uid = getProductorAuthUid(ipt);
    await ensureProductorAuthUser({ ipt, nombreCompleto: data.nombreCompleto || data.nombre, email: data.email });
    
    // Actualizar claims del usuario con datos completos del productor
    await admin.auth().setCustomUserClaims(uid, {
      ipt: String(ipt),
      role: "productor",
      nombre: data.nombreCompleto || data.nombre,
      email: data.email,
      productorId: String(ipt)
    });
    
    const token = await admin.auth().createCustomToken(uid, { 
      role: "productor", 
      ipt: String(ipt),
      nombre: data.nombreCompleto || data.nombre,
      email: data.email,
      productorId: String(ipt)
    });
    try {
      await doc.ref.update({ ultimoIngreso: new Date() });
    } catch (e) {
      logServerError("No se pudo actualizar ultimoIngreso de productor", e);
    }
    
    await doc.ref.update({ 
      historialIngresos: admin.firestore.FieldValue.increment(1),
      ultimoIngreso: new Date()
    });
    try {
      await registrarIngresoProductor({ ipt, productorId: String(ipt), metadata: req.body });
    } catch (e) {
      logServerError("No se pudo registrar ingresoProductor", e);
    }

    return res.json({ token, requiereCambioContrasena: requiereCambio });
  } catch (error) {
    logServerError("Error al iniciar sesión de productor", error);
    return res.status(500).json({ error: "No se pudo iniciar sesión" });
  }
};

export const cambiarPasswordProductor = async (req, res) => {
  try {
    const { ipt, oldPassword, newPassword } = req.body;
    if (!ipt || !oldPassword || !newPassword) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: "Contraseña demasiado débil" });
    }
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({ error: "Productor no encontrado" });
    }
    const doc = snap.docs[0];
    const data = doc.data();
    const requiereCambio = Boolean(data.requiereCambioContrasena);
    let ok = false;
    if (requiereCambio) {
      ok = String(oldPassword) === String(data.cuil);
    } else {
      const salt = String(data.ipt);
      const hash = hashPassword(String(oldPassword), salt);
      ok = hash && data.passwordHash && hash === data.passwordHash;
    }
    if (!ok) {
      return res.status(401).json({ error: "Credenciales invÃ¡lidas" });
    }
    const salt = String(data.ipt);
    const newHash = hashPassword(String(newPassword), salt);
    await doc.ref.update({ passwordHash: newHash, requiereCambioContrasena: false });
    const uid = getProductorAuthUid(ipt);
    await ensureProductorAuthUser({ ipt, nombreCompleto: data.nombreCompleto || data.nombre, email: data.email });
    
    // Actualizar claims del usuario con datos completos del productor
    await admin.auth().setCustomUserClaims(uid, {
      ipt: String(ipt),
      role: "productor",
      nombre: data.nombreCompleto || data.nombre,
      email: data.email,
      productorId: String(ipt)
    });
    
    const token = await admin.auth().createCustomToken(uid, { 
      role: "productor", 
      ipt: String(ipt),
      nombre: data.nombreCompleto || data.nombre,
      email: data.email,
      productorId: String(ipt)
    });
    try {
      await registrarIngresoProductor({ ipt, productorId: String(ipt), metadata: req.body });
    } catch (e) {
      logServerError("No se pudo registrar ingresoProductor luego de cambio de contraseÃ±a", e);
    }
    return res.json({ message: "ContraseÃ±a actualizada", token });
  } catch (error) {
    logServerError("Error al cambiar contraseÃ±a de productor", error);
    return res.status(500).json({ error: "No se pudo actualizar la contraseÃ±a" });
  }
};

export const cambiarEmailProductor = async (req, res) => {
  try {
    const { ipt, password, email } = req.body;
    const iptNorm = normalizeIpt(ipt);
    const emailNormalized = normalizeEmail(email);

    if (!iptNorm || !password || !emailNormalized) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }
    if (!isValidEmail(emailNormalized)) {
      return res.status(400).json({ error: "Ingrese un correo electrónico válido." });
    }

    const snap = await db.collection("productores").where("ipt", "==", iptNorm).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({ error: "Productor no encontrado" });
    }

    const doc = snap.docs[0];
    const data = doc.data() || {};
    const currentEmail = normalizeEmail(data.email);
    if (currentEmail === emailNormalized) {
      return res.status(400).json({ error: "El correo nuevo es igual al actual." });
    }

    const requiereCambio = Boolean(data.requiereCambioContrasena);
    let ok = false;
    if (requiereCambio) {
      ok = String(password) === String(data.cuil);
    } else {
      const salt = String(data.ipt);
      const hash = hashPassword(String(password), salt);
      ok = hash && data.passwordHash && hash === data.passwordHash;
    }
    if (!ok) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const existingEmail = await db.collection("productores").where("email", "==", emailNormalized).limit(1).get();
    if (!existingEmail.empty && existingEmail.docs[0].id !== doc.id) {
      return res.status(409).json({ error: "El correo electrónico ya se encuentra registrado." });
    }

    try {
      const authUser = await admin.auth().getUserByEmail(emailNormalized);
      if (authUser?.uid && authUser.uid !== getProductorAuthUid(iptNorm)) {
        return res.status(409).json({ error: "El correo electrónico ya se encuentra registrado." });
      }
    } catch (err) {
      if (err?.code !== "auth/user-not-found") throw err;
    }

    const uid = await ensureProductorAuthUser({
      ipt: iptNorm,
      nombreCompleto: data.nombreCompleto || data.nombre,
      email: currentEmail,
    });

    await admin.auth().updateUser(uid, {
      email: emailNormalized,
      emailVerified: false,
      displayName: data.nombreCompleto || data.nombre || undefined,
    });

    await doc.ref.update({
      email: emailNormalized,
      updatedAt: new Date(),
    });

    await admin.auth().setCustomUserClaims(uid, {
      ipt: iptNorm,
      role: "productor",
      nombre: data.nombreCompleto || data.nombre,
      email: emailNormalized,
      productorId: iptNorm,
    });

    const token = await admin.auth().createCustomToken(uid, {
      role: "productor",
      ipt: iptNorm,
      nombre: data.nombreCompleto || data.nombre,
      email: emailNormalized,
      productorId: iptNorm,
    });

    return res.json({ message: "Correo actualizado correctamente", token, email: emailNormalized });
  } catch (error) {
    logServerError("Error al cambiar email de productor", error);
    return res.status(500).json({ error: "No se pudo cambiar el correo" });
  }
};

export const resetPasswordLink = async (req, res) => {
  try {
    const { email } = req.body;
    const emailNormalized = normalizeEmail(email);

    if (!isValidEmail(emailNormalized)) {
      return res.status(400).json({ error: "Ingrese un correo electrÃ³nico vÃ¡lido." });
    }

    const continueUrl = String(
      process.env.WEB_PASSWORD_RESET_CONTINUE_URL ||
      process.env.FRONTEND_URL ||
      ""
    ).trim();
    const actionCodeSettings = continueUrl
      ? { url: continueUrl, handleCodeInApp: false }
      : undefined;

    // 1. Generar el link seguro de Firebase
    let resetLink;
    try {
      if (actionCodeSettings) {
        try {
          resetLink = await admin.auth().generatePasswordResetLink(emailNormalized, actionCodeSettings);
        } catch (linkError) {
          const code = String(linkError?.code || "");
          if (code === "auth/invalid-continue-uri" || code === "auth/unauthorized-continue-uri") {
            resetLink = await admin.auth().generatePasswordResetLink(emailNormalized);
          } else {
            throw linkError;
          }
        }
      } else {
        resetLink = await admin.auth().generatePasswordResetLink(emailNormalized);
      }
    } catch (linkError) {
      const code = String(linkError?.code || "");
      const rawMessage = String(linkError?.message || "").toUpperCase();

      const isResetLimitExceeded =
        code === "auth/too-many-requests" ||
        rawMessage.includes("RESET_PASSWORD_EXCEED_LIMIT");

      if (isResetLimitExceeded) {
        return res.status(429).json({
          error: "Demasiados intentos de recuperación. Intente nuevamente en unos minutos.",
          code: "RESET_PASSWORD_EXCEED_LIMIT",
        });
      }

      if (code === "auth/user-not-found") {
        // No revelar si el email existe o no
        return res.json({
          message: "Si el correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña en breve.",
        });
      }
      throw linkError;
    }

    // 2. Buscar el nombre del usuario para personalizar el email
    let nombre = null;
    try {
      const snap = await db.collection("users").where("email", "==", emailNormalized).limit(1).get();
      if (!snap.empty) {
        nombre = snap.docs[0].data().nombre || null;
      }
    } catch {
      // noop â€” el nombre es opcional
    }

    // 3. Enviar email HTML personalizado
    try {
      await sendResetPasswordEmail({ to: emailNormalized, resetLink, nombre });
    } catch (mailError) {
      const mailCode = String(mailError?.code || "").toUpperCase();
      const isSmtpUnavailable = ["ETIMEDOUT", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH"].includes(mailCode);

      if (isSmtpUnavailable) {
        logServerError("SMTP no disponible para reset link", { code: mailCode, message: mailError?.message });
        return res.status(503).json({
          error: "Servicio de correo temporalmente no disponible",
          code: "SMTP_UNAVAILABLE",
        });
      }

      throw mailError;
    }

    return res.json({
      message: "Si el correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña en breve.",
    });
  } catch (error) {
    logServerError("Error generando reset link", error);
    return sendInternalError(res, "No se pudo generar el enlace de restablecimiento");
  }
};
