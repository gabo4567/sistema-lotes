// src/controllers/turnos.controller.js

import { db } from "../utils/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

// ➕ Crear un nuevo turno
export const crearTurno = async (req, res) => {
  try {
    const { productorId, fechaTurno, motivo, tipoTurno, observaciones } = req.body;

    if (!productorId || !fechaTurno) {
      return res.status(400).json({ message: "Faltan datos obligatorios: productorId o fechaTurno" });
    }

    const fecha = new Date(fechaTurno);
    if (isNaN(fecha.getTime())) {
      return res.status(400).json({ message: "Formato de fecha inválido" });
    }

    // 🚫 Verificar si ya existe un turno en esa fecha (rango diario)
    const inicioDelDia = new Date(fecha);
    inicioDelDia.setHours(0, 0, 0, 0);

    const finDelDia = new Date(fecha);
    finDelDia.setHours(23, 59, 59, 999);

    const existenteSnapshot = await db
      .collection("turnos")
      .where("productorId", "==", productorId)
      .where("fechaTurno", ">=", Timestamp.fromDate(inicioDelDia))
      .where("fechaTurno", "<=", Timestamp.fromDate(finDelDia))
      .where("activo", "==", true)
      .get();


    if (!existenteSnapshot.empty) {
      return res.status(400).json({ message: "Ya existe un turno para este productor en esa fecha" });
    }

    const nuevoTurno = {
      productorId,
      fechaTurno: Timestamp.fromDate(fecha),
      motivo: motivo || "",
      tipoTurno: tipoTurno || "",
      observaciones: observaciones || "",
      estado: "pendiente",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      activo: true,
    };

    const docRef = await db.collection("turnos").add(nuevoTurno);
    res.status(201).json({ id: docRef.id, ...convertirTimestamps(nuevoTurno) });

  } catch (error) {
    console.error("Error al crear el turno:", error);
    res.status(500).json({ message: "Error al crear el turno", error });
  }
};

// 📋 Obtener todos los turnos activos
export const obtenerTurnos = async (req, res) => {
  try {
    const snapshot = await db.collection("turnos").where("activo", "==", true).get();
    const turnos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertirTimestamps(doc.data()),
    }));
    res.json(turnos);
  } catch (error) {
    console.error("Error al obtener los turnos:", error);
    res.status(500).json({ message: "Error al obtener los turnos", error });
  }
};

// 🔍 Obtener un turno por ID
export const obtenerTurnoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("turnos").doc(id).get();

    if (!doc.exists) return res.status(404).json({ message: "Turno no encontrado" });
    res.json({ id: doc.id, ...convertirTimestamps(doc.data()) });
  } catch (error) {
    console.error("Error al obtener el turno:", error);
    res.status(500).json({ message: "Error al obtener el turno", error });
  }
};

// ✏️ Actualizar un turno
export const actualizarTurno = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body, updatedAt: Timestamp.now() };

    if (data.fechaTurno) {
      const fecha = new Date(data.fechaTurno);
      if (isNaN(fecha.getTime())) {
        return res.status(400).json({ message: "Formato de fecha inválido" });
      }
      data.fechaTurno = Timestamp.fromDate(fecha);
    }

    await db.collection("turnos").doc(id).update(data);
    res.json({ message: "Turno actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar el turno:", error);
    res.status(500).json({ message: "Error al actualizar el turno", error });
  }
};

// 🔁 Cambiar estado de un turno
export const cambiarEstadoTurno = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosPermitidos = ["pendiente", "confirmado", "cancelado", "completado", "vencido"];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ message: "Estado no válido" });
    }

    await db.collection("turnos").doc(id).update({
      estado,
      updatedAt: Timestamp.now(),
    });

    res.json({ message: `Estado del turno actualizado a '${estado}'` });
  } catch (error) {
    console.error("Error al cambiar el estado del turno:", error);
    res.status(500).json({ message: "Error al cambiar el estado del turno", error });
  }
};

// 🗑️ Desactivar (soft delete) un turno
export const eliminarTurno = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("turnos").doc(id).update({ activo: false });
    res.json({ message: "Turno desactivado correctamente" });
  } catch (error) {
    console.error("Error al eliminar el turno:", error);
    res.status(500).json({ message: "Error al eliminar el turno", error });
  }
};

// 🔎 Obtener turnos por estado
export const obtenerTurnosPorEstado = async (req, res) => {
  try {
    const { estado } = req.params;
    const estadosPermitidos = ["pendiente", "confirmado", "cancelado", "completado", "vencido"];

    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ message: "Estado no válido" });
    }

    const snapshot = await db
      .collection("turnos")
      .where("estado", "==", estado)
      .where("activo", "==", true)
      .get();

    const turnos = snapshot.docs.map(doc => ({ id: doc.id, ...convertirTimestamps(doc.data()) }));
    res.json(turnos);
  } catch (error) {
    console.error("Error al obtener los turnos por estado:", error);
    res.status(500).json({ message: "Error al obtener los turnos por estado", error });
  }
};

// 🔍 Obtener turnos por productorId
export const obtenerTurnosPorProductor = async (req, res) => {
  try {
    const { productorId } = req.params;
    const snapshot = await db
      .collection("turnos")
      .where("productorId", "==", productorId)
      .where("activo", "==", true)
      .get();

    const turnos = snapshot.docs.map(doc => ({ id: doc.id, ...convertirTimestamps(doc.data()) }));
    res.json(turnos);
  } catch (error) {
    console.error("Error al obtener los turnos por productor:", error);
    res.status(500).json({ message: "Error al obtener los turnos por productor", error });
  }
};

// 📅 Obtener turnos por rango de fechas
export const obtenerTurnosPorRangoFechas = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        message: "Debe proporcionar 'fechaInicio' y 'fechaFin' en formato YYYY-MM-DD",
      });
    }

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
      return res.status(400).json({ message: "Formato de fecha inválido" });
    }

    const snapshot = await db
      .collection("turnos")
      .where("fechaTurno", ">=", Timestamp.fromDate(inicio))
      .where("fechaTurno", "<=", Timestamp.fromDate(fin))
      .where("activo", "==", true)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "Turno no encontrado" });
    }

    const turnos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertirTimestamps(doc.data()),
    }));

    res.json(turnos);
  } catch (error) {
    console.error("Error al obtener turnos por rango de fechas:", error);
    res.status(500).json({
      message: "Error al obtener turnos por rango de fechas",
      error,
    });
  }
};

// 🧩 Función auxiliar: convierte Timestamps a ISO string
const convertirTimestamps = (data) => {
  const nuevo = { ...data };
  for (const key in nuevo) {
    if (nuevo[key] && nuevo[key]._seconds !== undefined) {
      nuevo[key] = new Date(nuevo[key]._seconds * 1000).toISOString();
    }
  }
  return nuevo;
};
