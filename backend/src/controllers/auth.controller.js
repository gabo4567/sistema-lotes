// src/controllers/auth.controller.js
import { db, admin } from "../utils/firebase.js";
import crypto from "crypto";
import { makeToken } from "../middlewares/auth.js";

// Registrar usuario
export const registerUser = async (req, res) => {
  try {
    const { email, password, nombre, role } = req.body;

    // Validación de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Ingrese un correo electrónico válido." });
    }

    const domain = process.env.WEB_EMAIL_DOMAIN;
    if (domain && !String(email).toLowerCase().endsWith(`@${domain.toLowerCase()}`)) {
      return res.status(400).json({ error: "Email no pertenece al dominio institucional" });
    }

    // Evitar correos duplicados en Firestore (además de la restricción de Firebase Auth)
    const existingUsers = await db.collection("users").where("email", "==", String(email).toLowerCase()).limit(1).get();
    if (!existingUsers.empty) {
      return res.status(409).json({ error: "Ya existe un usuario con ese correo" });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nombre,
    });

    const allowed = ["Administrador", "Tecnico", "Técnico", "Supervisor"];
    const finalRole = allowed.includes(role) ? role : "Tecnico";
    await db.collection("users").doc(userRecord.uid).set({
      email: String(email).toLowerCase(),
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
    console.error("Error al registrar usuario:", error);
    res.status(500).json({ error: error.message });
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
    console.error("Error al registrar productor:", error);
    return res.status(500).json({ error: "Error al registrar productor" });
  }
};

// Login de usuario
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    let user;
    let uid;
    let role;
    let userData;

    // 1. Buscar en la colección de usuarios por email
    const userSnap = await db.collection("users").where("email", "==", String(email).toLowerCase()).limit(1).get();
    
    if (!userSnap.empty) {
      const doc = userSnap.docs[0];
      userData = doc.data();
      uid = doc.id;
      role = userData.role || "Tecnico";
      
      if (userData.activo === false) {
        return res.status(403).json({ error: "Usuario inactivo" });
      }

      // 2. Si es productor, verificar contraseña (CUIL o Hash)
      if (String(role).toLowerCase() === "productor") {
        const pSnap = await db.collection("productores").where("ipt", "==", String(userData.ipt)).limit(1).get();
        if (!pSnap.empty) {
          const pData = pSnap.docs[0].data();
          const requiereCambio = Boolean(pData.requiereCambioContrasena);
          let ok = false;
          if (requiereCambio) {
            ok = String(password) === String(pData.cuil);
          } else {
            const salt = String(pData.ipt);
            const hash = hashPassword(String(password), salt);
            ok = hash && pData.passwordHash && hash === pData.passwordHash;
          }
          if (!ok) {
            return res.status(401).json({ error: "Credenciales de productor inválidas" });
          }
        }
      }
    } else {
      // 3. Fallback: buscar en Firebase Auth directamente (para admins/técnicos antiguos sin email en doc)
      try {
        user = await admin.auth().getUserByEmail(email);
        uid = user.uid;
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists && userDoc.data().activo === false) {
          return res.status(403).json({ error: "Usuario inactivo" });
        }
        role = userDoc.exists ? (userDoc.data().role || "Tecnico") : "Tecnico";
      } catch (err) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
    }

    // Actualizar último acceso
    await db.collection("users").doc(uid).set({
      email: String(email).toLowerCase(),
      role,
      ultimoAcceso: new Date(),
    }, { merge: true });

    const webToken = makeToken({ uid, email, role });
    res.json({ token: webToken, role });
  } catch (error) {
    console.error("Error al hacer login:", error);
    res.status(500).json({ error: error.message });
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
      console.error("No se pudo actualizar ultimoIngreso de productor", ipt, e);
    }
    
    await doc.ref.update({ 
      historialIngresos: admin.firestore.FieldValue.increment(1),
      ultimoIngreso: new Date()
    });
    try {
      await db.collection("ingresosProductor").add({ ipt: String(ipt), productorId: doc.id, fecha: new Date() });
    } catch (e) {
      console.error("No se pudo registrar ingresoProductor", ipt, e);
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
      console.error("No se pudo actualizar users.ultimoAcceso para productor", ipt, e);
    }

    return res.json({ token, requiereCambioContrasena: requiereCambio });
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
      console.error("No se pudo actualizar users.ultimoAcceso luego de cambio de contraseña", ipt, e);
    }
    try {
      await db.collection("ingresosProductor").add({ ipt: String(ipt), productorId: doc.id, fecha: new Date() });
    } catch (e) {
      console.error("No se pudo registrar ingresoProductor luego de cambio de contraseña", ipt, e);
    }
    return res.json({ message: "Contraseña actualizada", token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Generar enlace de reseteo de contraseña (usuarios web)
export const resetPasswordLink = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });
    const link = await admin.auth().generatePasswordResetLink(email);
    return res.json({ link });
  } catch (error) {
    console.error("Error generando reset link:", error);
    return res.status(500).json({ error: error.message });
  }
};
