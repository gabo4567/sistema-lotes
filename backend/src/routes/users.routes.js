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

// 📌 Obtener todos los usuarios
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const batch = db.batch();
    let hasWrites = false;
    let all = snapshot.docs.map((doc) => {
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

    // Remover explícitamente duplicado solicitado por IPT y email
    all = all.filter(u => !(String(u?.ipt||'') === '123456' && String(u?.email||'').toLowerCase() === 'juan.gabriel@ejemplo.com'));

    // Complementar con último ingreso de productores si faltara
    const productoresSnap = await db.collection("productores").get();
    const productoresByIpt = new Map();
    for (const d of productoresSnap.docs) {
      const pd = d.data();
      if (pd?.ipt) productoresByIpt.set(String(pd.ipt), pd);
    }
    const seen = new Map();
    const normalize = (e) => String(e || "").toLowerCase();
    for (const u of all) {
      // Fallback: si es Productor y no tiene ultimoAcceso, usar ultimoIngreso del productor
      if (!u.ultimoAcceso && String(u?.role || "").toLowerCase() === "productor" && u?.ipt) {
        const p = productoresByIpt.get(String(u.ipt));
        if (p?.ultimoIngreso) u.ultimoAcceso = p.ultimoIngreso;
      }
      const key = normalize(u.email);
      if (!key) {
        // sin email: incluir siempre
        seen.set(`${u.id}_${Math.random()}`, u);
        continue;
      }
      if (!seen.has(key)) {
        seen.set(key, u);
        continue;
      }
      const cur = seen.get(key);
      const preferJuanGabriel = (x) => normalize(x?.nombre) === "juan gabriel" && normalize(x?.role) === "productor";
      let chosen = cur;
      if (preferJuanGabriel(u)) chosen = u;
      else if (preferJuanGabriel(cur)) chosen = cur;
      else if (u?.activo === true && cur?.activo !== true) chosen = u;
      // por defecto mantener el primero
      seen.set(key, chosen);
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
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

// 📌 Actualizar datos de usuario (nombre, rol, activo)
router.patch("/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const { nombre, role, activo, ipt } = req.body;
    const updates = {};
    if (nombre) updates.nombre = nombre;
    if (role) updates.role = normalizeRoleValue(role) === "Productor" ? "Productor" : "Administrador";
    if (activo !== undefined) updates.activo = Boolean(activo);
    if (normalizeRoleValue(role) === "Productor" && ipt) updates.ipt = String(ipt);
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
    const { email } = doc.data();
    const link = await admin.auth().generatePasswordResetLink(email);
    res.json({ link });
  } catch (error) {
    console.error("Error generando enlace:", error);
    res.status(500).json({ error: "Error generando enlace" });
  }
});

export default router;
