// src/controllers/ordenes.controller.js
import { db } from "../utils/firebase.js";

// Crear orden
export const createOrden = async (req, res) => {
  try {
    const { productorId, tipo, estado, fecha, detalles } = req.body;
    if (!productorId || !tipo || !estado) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    const newOrden = {
      productorId,
      tipo,
      estado,
      fecha: fecha || new Date(),
      detalles: detalles || "",
      activo: true // siempre activa al crear
    };

    const docRef = await db.collection("ordenes").add(newOrden);
    res.json({ id: docRef.id, ...newOrden });
  } catch (error) {
    console.error("Error al crear orden:", error);
    res.status(500).json({ error: "Error al crear orden" });
  }
};

// Obtener todas las órdenes activas
export const getAllOrdenes = async (req, res) => {
  try {
    const snapshot = await db.collection("ordenes").where("activo", "==", true).get();
    const ordenes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(ordenes);
  } catch (error) {
    console.error("Error al obtener órdenes:", error);
    res.status(500).json({ error: "Error al obtener órdenes" });
  }
};

// Obtener todas las órdenes inactivas
export const getInactiveOrdenes = async (req, res) => {
  try {
    const snapshot = await db.collection("ordenes").where("activo", "==", false).get();
    const ordenes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(ordenes);
  } catch (error) {
    console.error("Error al obtener órdenes inactivas:", error);
    res.status(500).json({ error: "Error al obtener órdenes inactivas" });
  }
};

// Obtener orden por ID
export const getOrdenById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("ordenes").doc(id).get();
    if (!doc.exists || doc.data().activo === false) return res.status(404).json({ error: "Orden no encontrada" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error al obtener orden:", error);
    res.status(500).json({ error: "Error al obtener orden" });
  }
};

// Actualizar orden
export const updateOrden = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    await db.collection("ordenes").doc(id).update(data);
    res.json({ message: "✅ Orden actualizada correctamente" });
  } catch (error) {
    console.error("Error al actualizar orden:", error);
    res.status(500).json({ error: "Error al actualizar orden" });
  }
};

// Soft delete de orden
export const deleteOrden = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("ordenes").doc(id).update({ activo: false });
    res.json({ message: "✅ Orden desactivada correctamente (soft delete)" });
  } catch (error) {
    console.error("Error al desactivar orden:", error);
    res.status(500).json({ error: "Error al desactivar orden" });
  }
};

// Insumos: listado simple
export const getInsumos = async (req, res) => {
  try {
    const snapshot = await db.collection("insumos").get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (error) {
    console.error("Error al obtener insumos:", error);
    // Devolver lista vacía para no romper frontend
    res.json([]);
  }
};
