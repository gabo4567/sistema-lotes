// src/controllers/mediciones.controller.js
import { db } from "../utils/firebase.js";
import { logServerError, sendInternalError } from "../utils/httpErrors.js";

// ➕ Crear una nueva medición
export const crearMedicion = async (req, res) => {
  try {
    const { productor, lote, fecha, tipo, valorNumerico, evidenciaUrl, observaciones } = req.body;
    if (!productor || !lote || !fecha || !tipo) return res.status(400).json({ message: "Faltan campos requeridos" });

    const nuevaMedicion = {
      productor,
      lote,
      fecha,
      tipo,
      valorNumerico: valorNumerico != null ? Number(valorNumerico) : null,
      evidenciaUrl: evidenciaUrl || "",
      observaciones: observaciones || "",
      activo: true,
    };

    const docRef = await db.collection("mediciones").add(nuevaMedicion);
    res.status(201).json({ id: docRef.id, ...nuevaMedicion });
  } catch (error) {
    logServerError("Error al crear la medición", error);
    sendInternalError(res, "Error al crear la medición");
  }
};

// 📋 Obtener todas las mediciones activas
export const obtenerMediciones = async (req, res) => {
  try {
    const { productor, lote, tipo, fechaInicio, fechaFin } = req.query;
    let ref = db.collection("mediciones").where("activo", "==", true);
    if (productor) ref = ref.where("productor", "==", productor);
    if (lote) ref = ref.where("lote", "==", lote);
    if (tipo) ref = ref.where("tipo", "==", tipo);
    const snapshot = await ref.get();
    let mediciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (fechaInicio || fechaFin) {
      const fi = fechaInicio ? new Date(fechaInicio) : null;
      const ff = fechaFin ? new Date(fechaFin) : null;
      mediciones = mediciones.filter(m => {
        const f = new Date(m.fecha);
        if (fi && f < fi) return false;
        if (ff && f > ff) return false;
        return true;
      });
    }
    res.json(mediciones);
  } catch (error) {
    logServerError("Error al obtener las mediciones", error);
    sendInternalError(res, "Error al obtener las mediciones");
  }
};

// 📋 Obtener todas las mediciones inactivas
export const obtenerMedicionesInactivas = async (req, res) => {
  try {
    const snapshot = await db.collection("mediciones").where("activo", "==", false).get();
    const mediciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(mediciones);
  } catch (error) {
    logServerError("Error al obtener mediciones inactivas", error);
    sendInternalError(res, "Error al obtener mediciones inactivas");
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
    logServerError("Error al obtener la medición", error);
    sendInternalError(res, "Error al obtener la medición");
  }
};

// ✏️ Actualizar una medición
export const actualizarMedicion = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(data, 'tecnicoResponsable')) delete data.tecnicoResponsable;
    await db.collection("mediciones").doc(id).update(data);
    res.json({ message: "Medición actualizada correctamente" });
  } catch (error) {
    logServerError("Error al actualizar la medición", error);
    sendInternalError(res, "Error al actualizar la medición");
  }
};

// 🗑️ Desactivar (soft delete) una medición
export const eliminarMedicion = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("mediciones").doc(id).update({ activo: false });
    res.json({ message: "Medición desactivada correctamente" });
  } catch (error) {
    logServerError("Error al desactivar la medición", error);
    sendInternalError(res, "Error al desactivar la medición");
  }
};
