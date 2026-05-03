// src/routes/users.routes.js
import express from "express";
import { db, admin } from "../utils/firebase.js";

const router = express.Router();

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

// 📌 Obtener todos los usuarios
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const batch = db.batch();
    let hasWrites = false;
    const all = snapshot.docs.map((doc) => {
      const data = doc.data();
      const roleResolved = resolveRole(data, doc.id);
      if (data?.role !== roleResolved) {
        batch.update(doc.ref, { role: roleResolved, updatedAt: new Date() });
        hasWrites = true;
      }
      return { id: doc.id, ...data, role: roleResolved };
    });
    if (hasWrites) {
      await batch.commit();
    }

    const admins = all.filter((u) => isAdminRole(u?.role));
    const normalizeEmail = (e) => String(e || "").toLowerCase().trim();
    const seen = new Map();
    for (const u of admins) {
      const key = normalizeEmail(u?.email);
      if (!key) {
        seen.set(`${u.id}_${Math.random()}`, u);
        continue;
      }
      const cur = seen.get(key);
      if (!cur) {
        seen.set(key, u);
        continue;
      }
      if (u?.activo === true && cur?.activo !== true) {
        seen.set(key, u);
      }
    }
    res.json(Array.from(seen.values()));
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// 📌 Obtener un usuario por UID
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

// 📌 Actualizar datos de usuario (nombre, rol, activo)
router.patch("/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const targetDoc = await db.collection("users").doc(uid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: "Usuario no encontrado" });
    const targetData = targetDoc.data() || {};
    const targetRole = resolveRole(targetData, uid);
    if (!isAdminRole(targetRole)) {
      return res.status(400).json({ error: "Solo se pueden administrar usuarios Administradores desde esta sección" });
    }

    const { nombre, role, activo } = req.body;
    const updates = {};
    if (nombre) updates.nombre = nombre;
    if (role) updates.role = "Administrador";
    if (activo !== undefined) updates.activo = Boolean(activo);
    if (!Object.keys(updates).length) return res.status(400).json({ error: "Sin cambios" });
    await db.collection("users").doc(uid).update({ ...updates, updatedAt: new Date() });
    res.json({ message: "Usuario actualizado" });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

// 📌 Desactivar usuario
router.post("/:uid/deactivate", async (req, res) => {
  try {
    const { uid } = req.params;
    const targetDoc = await db.collection("users").doc(uid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: "Usuario no encontrado" });
    const targetData = targetDoc.data() || {};
    const targetRole = resolveRole(targetData, uid);
    if (!isAdminRole(targetRole)) {
      return res.status(400).json({ error: "Solo se pueden administrar usuarios Administradores desde esta sección" });
    }
    await db.collection("users").doc(uid).update({ activo: false, updatedAt: new Date() });
    res.json({ message: "Usuario desactivado" });
  } catch (error) {
    console.error("Error al desactivar usuario:", error);
    res.status(500).json({ error: "Error al desactivar usuario" });
  }
});

// 📌 Activar usuario
router.post("/:uid/activate", async (req, res) => {
  try {
    const { uid } = req.params;
    const targetDoc = await db.collection("users").doc(uid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: "Usuario no encontrado" });
    const targetData = targetDoc.data() || {};
    const targetRole = resolveRole(targetData, uid);
    if (!isAdminRole(targetRole)) {
      return res.status(400).json({ error: "Solo se pueden administrar usuarios Administradores desde esta sección" });
    }
    await db.collection("users").doc(uid).update({ activo: true, updatedAt: new Date() });
    res.json({ message: "Usuario activado" });
  } catch (error) {
    console.error("Error al activar usuario:", error);
    res.status(500).json({ error: "Error al activar usuario" });
  }
});

// 📌 Generar enlace de reseteo para usuario
router.post("/:uid/reset-password", async (req, res) => {
  try {
    const { uid } = req.params;
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) return res.status(404).json({ error: "Usuario no encontrado" });
    const data = doc.data() || {};
    const roleResolved = resolveRole(data, uid);
    if (!isAdminRole(roleResolved)) {
      return res.status(400).json({ error: "Solo se pueden administrar usuarios Administradores desde esta sección" });
    }
    const { email } = data;
    const link = await admin.auth().generatePasswordResetLink(email);
    res.json({ link });
  } catch (error) {
    console.error("Error generando enlace:", error);
    res.status(500).json({ error: "Error generando enlace" });
  }
});

export default router;
