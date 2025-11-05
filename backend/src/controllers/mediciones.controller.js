// src/controllers/mediciones.controller.js
import { db } from "../utils/firebase.js";

// ➕ Crear una nueva medición
export const crearMedicion = async (req, res) => {
  try {
    const { loteId, fecha, humedad, temperatura, observaciones } = req.body;
    if (!loteId) return res.status(400).json({ message: "Falta el loteId" });

    const nuevaMedicion = {
      loteId,
      fecha: fecha || new Date(),
      humedad: humedad || null,
      temperatura: temperatura || null,
      observaciones: observaciones || "",
      activo: true,
    };

    const docRef = await db.collection("mediciones").add(nuevaMedicion);
    res.status(201).json({ id: docRef.id, ...nuevaMedicion });
  } catch (error) {
    console.error("Error al crear la medición:", error);
    res.status(500).json({ message: "Error al crear la medición", error });
  }
};

// 📋 Obtener todas las mediciones activas
export const obtenerMediciones = async (req, res) => {
  try {
    const snapshot = await db.collection("mediciones").where("activo", "==", true).get();
    const mediciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(mediciones);
  } catch (error) {
    console.error("Error al obtener las mediciones:", error);
    res.status(500).json({ message: "Error al obtener las mediciones", error });
  }
};

// 📋 Obtener todas las mediciones inactivas
export const obtenerMedicionesInactivas = async (req, res) => {
  try {
    const snapshot = await db.collection("mediciones").where("activo", "==", false).get();
    const mediciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(mediciones);
  } catch (error) {
    console.error("Error al obtener mediciones inactivas:", error);
    res.status(500).json({ message: "Error al obtener mediciones inactivas", error });
  }
};

// 🔍 Obtener una medición por ID
export const obtenerMedicionPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("mediciones").doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: "Medición no encontrada" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error al obtener la medición:", error);
    res.status(500).json({ message: "Error al obtener la medición", error });
  }
};

// ✏️ Actualizar una medición
export const actualizarMedicion = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    await db.collection("mediciones").doc(id).update(data);
    res.json({ message: "Medición actualizada correctamente" });
  } catch (error) {
    console.error("Error al actualizar la medición:", error);
    res.status(500).json({ message: "Error al actualizar la medición", error });
  }
};

// 🗑️ Desactivar (soft delete) una medición
export const eliminarMedicion = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("mediciones").doc(id).update({ activo: false });
    res.json({ message: "Medición desactivada correctamente" });
  } catch (error) {
    console.error("Error al desactivar la medición:", error);
    res.status(500).json({ message: "Error al desactivar la medición", error });
  }
};
