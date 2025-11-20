// src/controllers/productores.controller.js
import { db, admin } from "../utils/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

// Crear productor
export const createProductor = async (req, res) => {
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

    const newProductor = {
      ipt: String(ipt),
      nombreCompleto,
      cuil: String(cuil),
      email: email || "",
      telefono: telefono || "",
      domicilioCasa: domicilioCasa || "",
      domicilioIngresoCoord: domicilioIngresoCoord || null,
      estado: estado || "Nuevo",
      plantasPorHa: plantasPorHa ? Number(plantasPorHa) : null,
      requiereCambioContrasena: true,
      historialIngresos: 0,
      fechaRegistro: new Date(),
      activo: true,
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

export const getProductorByIpt = async (req, res) => {
  try {
    const { ipt } = req.params;
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const doc = snap.docs[0];
    const data = doc.data();
    if (data.activo === false) return res.status(404).json({ error: "Productor no activo" });
    res.json({ id: doc.id, ...data });
  } catch (error) {
    console.error("Error al obtener productor por IPT:", error);
    res.status(500).json({ error: "Error al obtener productor por IPT" });
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

export const resetPasswordProductor = async (req, res) => {
  try {
    const { ipt } = req.params;
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const doc = snap.docs[0];
    await doc.ref.update({ requiereCambioContrasena: true, passwordHash: admin.firestore.FieldValue.delete() });
    res.json({ message: "Contraseña reseteada a CUIL en próximo ingreso" });
  } catch (error) {
    console.error("Error al resetear contraseña:", error);
    res.status(500).json({ error: "Error al resetear contraseña" });
  }
};

export const marcarReempadronado = async (req, res) => {
  try {
    const { ipt } = req.params;
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const doc = snap.docs[0];
    await doc.ref.update({ estado: "Re-empadronado" });
    res.json({ message: "Productor marcado como re-empadronado" });
  } catch (error) {
    console.error("Error al marcar re-empadronado:", error);
    res.status(500).json({ error: "Error al marcar re-empadronado" });
  }
};

export const historialIngresos = async (req, res) => {
  try {
    const { ipt } = req.params;
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const doc = snap.docs[0];
    const data = doc.data();
    res.json({ historialIngresos: data.historialIngresos || 0 });
  } catch (error) {
    console.error("Error al obtener historial de ingresos:", error);
    res.status(500).json({ error: "Error al obtener historial de ingresos" });
  }
};

export const setPushToken = async (req, res) => {
  try {
    const { ipt } = req.params;
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token requerido" });
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const doc = snap.docs[0];
    await doc.ref.update({ pushTokens: FieldValue.arrayUnion(token) });
    res.json({ message: "Push token registrado" });
  } catch (error) {
    res.status(500).json({ error: "Error al registrar push token" });
  }
};
