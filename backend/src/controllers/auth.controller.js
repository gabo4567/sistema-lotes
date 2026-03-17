// src/controllers/auth.controller.js
import { db, admin } from "../utils/firebase.js";
import crypto from "crypto";
import { makeToken } from "../middlewares/auth.js";
import { logServerError, sendInternalError } from "../utils/httpErrors.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isValidEmail = (value) => EMAIL_REGEX.test(value);

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

    const allowed = ["Administrador", "Tecnico", "Técnico", "Supervisor"];
    const finalRole = allowed.includes(role) ? role : "Tecnico";
    await db.collection("users").doc(userRecord.uid).set({
      email: emailNormalized,
      nombre,
      role: finalRole,
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
      plantasPorHa,
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
        return res.status(400).json({ error: "El correo electrónico ya se encuentra registrado." });
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
      plantasPorHa: plantasPorHa ? Number(plantasPorHa) : null,
      requiereCambioContrasena: true, // Primer login con CUIL
      historialIngresos: 0,
      fechaRegistro: new Date(),
      activo: true,
    };

    const docRef = await db.collection("productores").add(newProductor);

    const authUid = `prod_${String(ipt)}`;

    // Asegurar que exista un usuario en Firebase Auth con ese UID
    try {
      await admin.auth().getUser(authUid);
    } catch (e) {
      if (e && e.code === "auth/user-not-found") {
        const authData = {
          uid: authUid,
          displayName: nombreCompleto,
        };
        // Si hay email, intentar asignarlo (puede fallar si ya existe)
        if (email) {
          try {
            await admin.auth().getUserByEmail(email);
            // Si no lanza error, el email ya está en uso. No lo asignamos a este Auth Record.
          } catch (err) {
            if (err.code === 'auth/user-not-found') {
              authData.email = email;
            }
          }
        }
        await admin.auth().createUser(authData);
      } else {
        throw e;
      }
    }

    // Crear o actualizar el registro en la colección de 'users' para que aparezca en la lista
    await db.collection("users").doc(authUid).set({
      email: email || "",
      nombre: nombreCompleto,
      role: "Productor",
      ipt: String(ipt),
      activo: true,
      ultimoAcceso: null,
      updatedAt: new Date(),
    }, { merge: true });

    // Asignar claims útiles para posteriores autorizaciones
    await admin.auth().setCustomUserClaims(authUid, {
      role: "productor",
      ipt: String(ipt),
      nombre: nombreCompleto,
      email: email || undefined,
      productorId: docRef.id,
    });

    return res.json({
      message: "✅ Productor registrado correctamente",
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
// Login de usuario (web panel) — recibe un Firebase ID token verificado desde el cliente
export const loginUser = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ error: "Credenciales requeridas" });
    }

    // 1. Verificar el ID token con Firebase Admin SDK
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const { uid, email } = decodedToken;
    const emailNormalized = normalizeEmail(email);

    // 2. Buscar el rol del usuario en Firestore (por UID primero, luego por email)
    let role = "Tecnico";
    let resolvedUid = uid;

    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      if (data.activo === false) {
        return res.status(403).json({ error: "Usuario inactivo" });
      }
      role = data.role || "Tecnico";
    } else if (emailNormalized) {
      // Fallback: buscar por email (usuarios registrados antes de indexar por UID)
      const snap = await db.collection("users").where("email", "==", emailNormalized).limit(1).get();
      if (!snap.empty) {
        const data = snap.docs[0].data();
        if (data.activo === false) {
          return res.status(403).json({ error: "Usuario inactivo" });
        }
        role = data.role || "Tecnico";
        resolvedUid = snap.docs[0].id;
      }
    }

    // 3. Los productores usan la app móvil — no el panel web
    if (String(role).toLowerCase() === "productor") {
      return res.status(403).json({ error: "Los productores deben usar la aplicación móvil" });
    }

    // 4. Actualizar último acceso
    await db.collection("users").doc(resolvedUid).set({
      email: emailNormalized,
      role,
      ultimoAcceso: new Date(),
    }, { merge: true });

    const webToken = makeToken({ uid: resolvedUid, email: emailNormalized, role });
    res.json({ token: webToken, role });
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
    const estado = data.estado || "Nuevo";
    if (["Vencido"].includes(estado)) {
      return res.status(403).json({ error: "Estado no permite ingreso" });
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
    const uid = `prod_${String(ipt)}`;
    
    // Actualizar claims del usuario con datos completos del productor
    await admin.auth().setCustomUserClaims(uid, {
      ipt: String(ipt),
      role: "productor",
      nombre: data.nombreCompleto || data.nombre,
      email: data.email,
      productorId: doc.id // ID del documento en Firestore
    });
    
    const token = await admin.auth().createCustomToken(uid, { 
      role: "productor", 
      ipt: String(ipt),
      nombre: data.nombreCompleto || data.nombre,
      email: data.email,
      productorId: doc.id
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
      await db.collection("ingresosProductor").add({ ipt: String(ipt), productorId: doc.id, fecha: new Date() });
    } catch (e) {
      logServerError("No se pudo registrar ingresoProductor", e);
    }

    try {
      await db.collection("users").doc(uid).set({
        email: (data.email ? String(data.email).toLowerCase() : ""),
        nombre: data.nombreCompleto || data.nombre || "",
        role: "Productor",
        ipt: String(ipt),
        activo: data.activo !== false,
        ultimoAcceso: new Date(),
        updatedAt: new Date(),
      }, { merge: true });
    } catch (e) {
      logServerError("No se pudo actualizar users.ultimoAcceso para productor", e);
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
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    const salt = String(data.ipt);
    const newHash = hashPassword(String(newPassword), salt);
    await doc.ref.update({ passwordHash: newHash, requiereCambioContrasena: false });
    const uid = `prod_${String(ipt)}`;
    
    // Actualizar claims del usuario con datos completos del productor
    await admin.auth().setCustomUserClaims(uid, {
      ipt: String(ipt),
      role: "productor",
      nombre: data.nombreCompleto || data.nombre,
      email: data.email,
      productorId: doc.id // ID del documento en Firestore
    });
    
    const token = await admin.auth().createCustomToken(uid, { 
      role: "productor", 
      ipt: String(ipt),
      nombre: data.nombreCompleto || data.nombre,
      email: data.email,
      productorId: doc.id
    });
    try {
      await db.collection("users").doc(uid).set({
        email: (data.email ? String(data.email).toLowerCase() : ""),
        nombre: data.nombreCompleto || data.nombre || "",
        role: "Productor",
        ipt: String(ipt),
        estado: data.activo === false ? "Inactivo" : "Activo",
        ultimoAcceso: new Date(),
        updatedAt: new Date(),
      }, { merge: true });
    } catch (e) {
      logServerError("No se pudo actualizar users.ultimoAcceso luego de cambio de contraseña", e);
    }
    try {
      await db.collection("ingresosProductor").add({ ipt: String(ipt), productorId: doc.id, fecha: new Date() });
    } catch (e) {
      logServerError("No se pudo registrar ingresoProductor luego de cambio de contraseña", e);
    }
    return res.json({ message: "Contraseña actualizada", token });
  } catch (error) {
    logServerError("Error al cambiar contraseña de productor", error);
    return res.status(500).json({ error: "No se pudo actualizar la contraseña" });
  }
};

// Generar enlace de reseteo de contraseña (usuarios web)
export const resetPasswordLink = async (req, res) => {
  try {
    const { email } = req.body;
    const emailNormalized = normalizeEmail(email);

    if (!isValidEmail(emailNormalized)) {
      return res.status(400).json({ error: "Ingrese un correo electrónico válido." });
    }

    const continueUrl = String(process.env.WEB_PASSWORD_RESET_CONTINUE_URL || process.env.FRONTEND_URL || "").trim();
    const actionCodeSettings = continueUrl ? { url: continueUrl, handleCodeInApp: false } : undefined;

    try {
      if (actionCodeSettings) {
        await admin.auth().generatePasswordResetLink(emailNormalized, actionCodeSettings);
      } else {
        await admin.auth().generatePasswordResetLink(emailNormalized);
      }
    } catch (error) {
      if (String(error?.code || "") !== "auth/user-not-found") {
        throw error;
      }
    }

    return res.json({
      message: "Si el correo está registrado, se enviará un enlace para restablecer la contraseña.",
    });
  } catch (error) {
    logServerError("Error generando reset link", error);
    return sendInternalError(res, "No se pudo generar el enlace de restablecimiento");
  }
};
