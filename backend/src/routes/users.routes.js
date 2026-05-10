// src/routes/users.routes.js
import express from "express";
import { db, admin } from "../utils/firebase.js";

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isValidEmail = (value) => EMAIL_REGEX.test(value);

const normalizeRoleValue = (role) => {
  const v = String(role || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!v) return "";
  if (v === "productor") return "Productor";
  return "Administrador";
};

const resolveRole = (data, docId) => {
  const normalized = normalizeRoleValue(data?.role);
  if (normalized) return normalized;
  const looksLikeProductor = Boolean(data?.ipt) || String(docId || "").startsWith("prod_");
  return looksLikeProductor ? "Productor" : "Administrador";
};

const isAdminRole = (role) => normalizeRoleValue(role) === "Administrador";

const assertAdminUserDoc = async (uid) => {
  const targetDoc = await db.collection("users").doc(uid).get();
  if (!targetDoc.exists) return { error: { status: 404, message: "Usuario no encontrado" } };
  const targetData = targetDoc.data() || {};
  const targetRole = resolveRole(targetData, uid);
  if (!isAdminRole(targetRole)) {
    return { error: { status: 400, message: "Solo se pueden administrar usuarios Administradores desde esta seccion" } };
  }
  return { targetDoc, targetData, targetRole };
};

router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const batch = db.batch();
    let hasWrites = false;

    const uidsWithoutNombre = snapshot.docs
      .filter((doc) => !doc.data()?.nombre)
      .map((doc) => doc.id);

    const authDisplayNames = {};
    if (uidsWithoutNombre.length > 0) {
      try {
        const authUsers = await admin.auth().getUsers(uidsWithoutNombre.map((uid) => ({ uid })));
        authUsers.users.forEach((u) => {
          if (u.displayName) authDisplayNames[u.uid] = u.displayName;
        });
      } catch {}
    }

    const all = snapshot.docs.map((doc) => {
      const data = doc.data();
      const roleResolved = resolveRole(data, doc.id);
      if (data?.role !== roleResolved) {
        batch.update(doc.ref, { role: roleResolved, updatedAt: new Date() });
        hasWrites = true;
      }
      const nombre = data?.nombre || authDisplayNames[doc.id] || null;
      return { id: doc.id, ...data, nombre, role: roleResolved };
    });
    if (hasWrites) await batch.commit();

    const admins = all.filter((u) => isAdminRole(u?.role));
    const seen = new Map();
    for (const u of admins) {
      const key = normalizeEmail(u?.email);
      if (!key) {
        seen.set(`${u.id}_${Math.random()}`, u);
        continue;
      }
      const cur = seen.get(key);
      if (!cur || (u?.activo === true && cur?.activo !== true)) {
        seen.set(key, u);
      }
    }
    res.json(Array.from(seen.values()));
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

router.post("/", async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const activo = req.body?.activo !== false;

    if (!nombre) return res.status(400).json({ error: "Ingrese el nombre del administrador" });
    if (!isValidEmail(email)) return res.status(400).json({ error: "Ingrese un correo electronico valido" });
    if (password.length < 6) return res.status(400).json({ error: "La contrasena debe tener al menos 6 caracteres" });

    const existingUsers = await db.collection("users").where("email", "==", email).limit(1).get();
    if (!existingUsers.empty) return res.status(409).json({ error: "Ya existe un administrador con ese correo" });

    try {
      await admin.auth().getUserByEmail(email);
      return res.status(409).json({ error: "Ya existe un usuario de autenticacion con ese correo" });
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nombre,
      disabled: !activo,
    });

    const doc = {
      email,
      nombre,
      role: "Administrador",
      activo,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection("users").doc(userRecord.uid).set(doc);
    res.status(201).json({ id: userRecord.uid, ...doc });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

router.get("/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) return res.status(404).json({ error: "Usuario no encontrado" });
    const data = doc.data() || {};
    const roleResolved = resolveRole(data, doc.id);
    if (!isAdminRole(roleResolved)) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({ id: doc.id, ...data, role: roleResolved });
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

router.patch("/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const { error } = await assertAdminUserDoc(uid);
    if (error) return res.status(error.status).json({ error: error.message });

    const { nombre, role, activo } = req.body;
    const updates = {};
    if (nombre) updates.nombre = String(nombre).trim();
    if (role) updates.role = "Administrador";
    if (req.user?.uid === uid && activo === false) {
      return res.status(400).json({ error: "No puede desactivar su propio usuario" });
    }
    if (activo !== undefined) updates.activo = Boolean(activo);
    if (!Object.keys(updates).length) return res.status(400).json({ error: "Sin cambios" });

    await db.collection("users").doc(uid).update({ ...updates, updatedAt: new Date() });
    const authUpdate = {};
    if (updates.nombre) authUpdate.displayName = updates.nombre;
    if (activo !== undefined) authUpdate.disabled = !Boolean(activo);
    if (Object.keys(authUpdate).length > 0) {
      try { await admin.auth().updateUser(uid, authUpdate); } catch {}
    }

    res.json({ message: "Usuario actualizado" });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

router.post("/:uid/deactivate", async (req, res) => {
  try {
    const { uid } = req.params;
    if (req.user?.uid === uid) return res.status(400).json({ error: "No puede desactivar su propio usuario" });
    const { error } = await assertAdminUserDoc(uid);
    if (error) return res.status(error.status).json({ error: error.message });

    await db.collection("users").doc(uid).update({ activo: false, updatedAt: new Date() });
    try { await admin.auth().updateUser(uid, { disabled: true }); } catch {}
    res.json({ message: "Usuario desactivado" });
  } catch (error) {
    console.error("Error al desactivar usuario:", error);
    res.status(500).json({ error: "Error al desactivar usuario" });
  }
});

router.post("/:uid/activate", async (req, res) => {
  try {
    const { uid } = req.params;
    const { error } = await assertAdminUserDoc(uid);
    if (error) return res.status(error.status).json({ error: error.message });

    await db.collection("users").doc(uid).update({ activo: true, updatedAt: new Date() });
    try { await admin.auth().updateUser(uid, { disabled: false }); } catch {}
    res.json({ message: "Usuario activado" });
  } catch (error) {
    console.error("Error al activar usuario:", error);
    res.status(500).json({ error: "Error al activar usuario" });
  }
});

router.post("/:uid/reset-password", async (req, res) => {
  try {
    const { uid } = req.params;
    const { targetData, error } = await assertAdminUserDoc(uid);
    if (error) return res.status(error.status).json({ error: error.message });
    const email = normalizeEmail(targetData?.email);
    if (!isValidEmail(email)) return res.status(400).json({ error: "El usuario no tiene un email valido" });

    const link = await admin.auth().generatePasswordResetLink(email);
    res.json({ link });
  } catch (error) {
    console.error("Error generando enlace:", error);
    res.status(500).json({ error: "Error generando enlace" });
  }
});

export default router;
