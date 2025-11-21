// src/controllers/auth.controller.js
import { db, admin } from "../utils/firebase.js";
import crypto from "crypto";
import { makeToken } from "../middlewares/auth.js";

// Registrar usuario
export const registerUser = async (req, res) => {
  try {
    const { email, password, nombre, role } = req.body;

    const domain = process.env.WEB_EMAIL_DOMAIN;
    if (domain && !String(email).toLowerCase().endsWith(`@${domain.toLowerCase()}`)) {
      return res.status(400).json({ error: "Email no pertenece al dominio institucional" });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nombre,
    });

    const allowed = ["Administrador", "Tecnico", "Técnico", "Supervisor"];
    const finalRole = allowed.includes(role) ? role : undefined;
    await db.collection("users").doc(userRecord.uid).set({
      email,
      nombre,
      ...(finalRole ? { role: finalRole } : {}),
      createdAt: new Date(),
    });

    res.json({
      message: "✅ Usuario creado correctamente",
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        nombre: userRecord.displayName,
        role: finalRole || undefined,
      },
    });
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    res.status(500).json({ error: error.message });
  }
};

// Login de usuario
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    const user = await admin.auth().getUserByEmail(email);
    const userDoc = await db.collection("users").doc(user.uid).get();
    if (userDoc.exists && userDoc.data().estado === "Inactivo") {
      return res.status(403).json({ error: "Usuario inactivo" });
    }
    const role = userDoc.exists ? (userDoc.data().role || "Tecnico") : "Tecnico";
    await db.collection("users").doc(user.uid).set({
      email: user.email,
      nombre: user.displayName || "",
      role,
      ultimoAcceso: new Date(),
    }, { merge: true });
    const webToken = makeToken({ uid: user.uid, email: user.email, role });
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
    const token = await admin.auth().createCustomToken(uid, { role: "productor", ipt: String(ipt) });
    await doc.ref.update({ historialIngresos: admin.firestore.FieldValue.increment(1) });
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
    const token = await admin.auth().createCustomToken(uid, { role: "productor", ipt: String(ipt) });
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
