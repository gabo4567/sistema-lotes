// src/controllers/lotes.controller.js
import { db } from "../utils/firebase.js";

// Crear un lote
export const createLote = async (req, res) => {
  try {
    const { nombre, productorId, superficie, estadoCultivo, coordenadas, fechaCreacion } = req.body;
    if (!nombre || !productorId || !superficie || !estadoCultivo || !coordenadas) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    const newLote = {
      nombre,
      productorId,
      superficie,
      estadoCultivo,
      coordenadas,
      fechaCreacion: fechaCreacion || new Date(),
      activo: true // ✅ Lote activo al crear
    };

    const docRef = await db.collection("lotes").add(newLote);
    res.json({ id: docRef.id, ...newLote });
  } catch (error) {
    console.error("Error al crear lote:", error);
    res.status(500).json({ error: "Error al crear lote" });
  }
};

// Obtener todos los lotes activos
export const getAllLotes = async (req, res) => {
  try {
    const snapshot = await db.collection("lotes").where("activo", "==", true).get();
    const lotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(lotes);
  } catch (error) {
    console.error("Error al obtener lotes:", error);
    res.status(500).json({ error: "Error al obtener lotes" });
  }
};

// Obtener todos los lotes inactivos
export const getInactiveLotes = async (req, res) => {
  try {
    const snapshot = await db.collection("lotes").where("activo", "==", false).get();
    const lotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(lotes);
  } catch (error) {
    console.error("Error al obtener lotes inactivos:", error);
    res.status(500).json({ error: "Error al obtener lotes inactivos" });
  }
};

// Obtener lote por ID
export const getLoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("lotes").doc(id).get();
    if (!doc.exists || doc.data().activo === false) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error al obtener lote:", error);
    res.status(500).json({ error: "Error al obtener lote" });
  }
};

// Actualizar lote
export const updateLote = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    await db.collection("lotes").doc(id).update(data);
    res.json({ message: "✅ Lote actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar lote:", error);
    res.status(500).json({ error: "Error al actualizar lote" });
  }
};

// Eliminar lote (soft delete)
export const deleteLote = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("lotes").doc(id).update({ activo: false });
    res.json({ message: "✅ Lote desactivado correctamente (soft delete)" });
  } catch (error) {
    console.error("Error al desactivar lote:", error);
    res.status(500).json({ error: "Error al desactivar lote" });
  }
};
