// src/routes/users.routes.js
import express from "express";
import { db, admin } from "../utils/firebase.js";

const router = express.Router();

// 📌 Obtener todos los usuarios
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(users);
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

// 📌 Actualizar datos de usuario (nombre, rol, estado)
router.patch("/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const { nombre, role, estado } = req.body;
    const allowedRoles = ["Administrador", "Tecnico", "Técnico", "Supervisor"];
    const updates = {};
    if (nombre) updates.nombre = nombre;
    if (role && allowedRoles.includes(role)) updates.role = role;
    if (estado) updates.estado = estado;
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
    await db.collection("users").doc(uid).update({ estado: "Inactivo", updatedAt: new Date() });
    res.json({ message: "Usuario desactivado" });
  } catch (error) {
    console.error("Error al desactivar usuario:", error);
    res.status(500).json({ error: "Error al desactivar usuario" });
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
