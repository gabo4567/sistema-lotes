// src/controllers/productores.controller.js
import { db } from "../utils/firebase.js";

// Crear productor
export const createProductor = async (req, res) => {
  try {
    const { nombre, email, telefono, direccion, fechaRegistro } = req.body;
    if (!nombre || !email) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    const newProductor = {
      nombre,
      email,
      telefono: telefono || "",
      direccion: direccion || "",
      fechaRegistro: fechaRegistro || new Date(),
      activo: true // campo para soft delete
    };

    const docRef = await db.collection("productores").add(newProductor);
    res.json({ id: docRef.id, ...newProductor });
  } catch (error) {
    console.error("Error al crear productor:", error);
    res.status(500).json({ error: "Error al crear productor" });
  }
};

// Obtener todos los productores activos
export const getAllProductores = async (req, res) => {
  try {
    const snapshot = await db.collection("productores").where("activo", "==", true).get();
    const productores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(productores);
  } catch (error) {
    console.error("Error al obtener productores:", error);
    res.status(500).json({ error: "Error al obtener productores" });
  }
};

// Obtener todos los productores inactivos
export const getInactiveProductores = async (req, res) => {
  try {
    const snapshot = await db.collection("productores").where("activo", "==", false).get();
    const productores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(productores);
  } catch (error) {
    console.error("Error al obtener productores inactivos:", error);
    res.status(500).json({ error: "Error al obtener productores inactivos" });
  }
};

// Obtener productor por ID
export const getProductorById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("productores").doc(id).get();
    if (!doc.exists || doc.data().activo === false) 
      return res.status(404).json({ error: "Productor no encontrado" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error al obtener productor:", error);
    res.status(500).json({ error: "Error al obtener productor" });
  }
};

// Actualizar productor
export const updateProductor = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    await db.collection("productores").doc(id).update(data);
    res.json({ message: "✅ Productor actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar productor:", error);
    res.status(500).json({ error: "Error al actualizar productor" });
  }
};

// Soft delete de productor
export const deleteProductor = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("productores").doc(id).update({ activo: false });
    res.json({ message: "✅ Productor desactivado correctamente" });
  } catch (error) {
    console.error("Error al desactivar productor:", error);
    res.status(500).json({ error: "Error al desactivar productor" });
  }
};
