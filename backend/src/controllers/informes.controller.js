// ✅ src/controllers/informes.controller.js

import { db } from "../utils/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

// 📘 Resumen general del sistema
export const obtenerResumenGeneral = async (req, res) => {
  try {
    const [usuariosSnap, productoresSnap, lotesSnap, ordenesSnap, turnosSnap, medicionesSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("productores").where("activo", "==", true).get(),
      db.collection("lotes").where("activo", "==", true).get(),
      db.collection("ordenes").where("activo", "==", true).get(),
      db.collection("turnos").where("activo", "==", true).get(),
      db.collection("mediciones").get(),
    ]);

    const data = {
      totalUsuarios: usuariosSnap.size,
      totalProductoresActivos: productoresSnap.size,
      totalLotesActivos: lotesSnap.size,
      totalOrdenesActivas: ordenesSnap.size,
      totalTurnosActivos: turnosSnap.size,
      totalMedicionesRegistradas: medicionesSnap.size,
      ultimaActualizacion: new Date().toISOString(),
    };

    res.json(data);
  } catch (error) {
    console.error("❌ Error al obtener resumen general:", error);
    res.status(500).json({ message: "Error al obtener resumen general", error: error.message });
  }
};

// 👨‍🌾 Productores activos con métricas
export const obtenerProductoresActivos = async (req, res) => {
  try {
    const productoresSnap = await db.collection("productores").where("activo", "==", true).get();
    const productores = [];

    for (const doc of productoresSnap.docs) {
      const productor = { id: doc.id, ...doc.data() };

      const [lotesSnap, ordenesSnap, turnosSnap] = await Promise.all([
        db.collection("lotes").where("productorId", "==", doc.id).get(),
        db.collection("ordenes").where("productorId", "==", doc.id).get(),
        db.collection("turnos").where("productorId", "==", doc.id).get(),
      ]);

      productor.totalLotes = lotesSnap.size;
      productor.totalOrdenes = ordenesSnap.size;
      productor.totalTurnos = turnosSnap.size;

      productores.push(productor);
    }

    res.json(productores);
  } catch (error) {
    console.error("❌ Error al obtener productores activos:", error);
    res.status(500).json({ message: "Error al obtener productores activos", error: error.message });
  }
};

// 🧾 Órdenes agrupadas por mes
export const obtenerOrdenesPorMes = async (req, res) => {
  try {
    const ordenesSnap = await db.collection("ordenes").where("activo", "==", true).get();
    const conteoPorMes = {};

    ordenesSnap.forEach((doc) => {
      const orden = doc.data();
      const fecha = new Date(orden.fecha);
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
      conteoPorMes[mes] = (conteoPorMes[mes] || 0) + 1;
    });

    const resultado = Object.entries(conteoPorMes).map(([mes, ordenes]) => ({ mes, ordenes }));
    res.json(resultado);
  } catch (error) {
    console.error("❌ Error al obtener órdenes por mes:", error);
    res.status(500).json({ message: "Error al obtener órdenes por mes", error: error.message });
  }
};

// 📊 Turnos agrupados por estado con total y porcentaje
export const obtenerTurnosPorEstado = async (req, res) => {
  try {
    const turnosSnap = await db.collection("turnos").where("activo", "==", true).get();

    // Inicializamos todos los estados en 0
    const conteo = {
      pendientes: 0,
      confirmados: 0,
      cancelados: 0,
      completados: 0,
      vencidos: 0,
    };

    // Contamos los turnos según su estado
    turnosSnap.forEach((doc) => {
      const estado = (doc.data().estado || "pendiente").toLowerCase();
      const clavePlural = estado + "s"; // convierte a plural
      if (conteo.hasOwnProperty(clavePlural)) {
        conteo[clavePlural]++;
      }
    });

    // Calculamos total de turnos
    const totalTurnos = Object.values(conteo).reduce((acc, val) => acc + val, 0);

    // Calculamos porcentaje por estado
    const porcentaje = {};
    for (const [key, value] of Object.entries(conteo)) {
      porcentaje[key] = totalTurnos > 0 ? ((value / totalTurnos) * 100).toFixed(2) : "0.00";
    }

    res.json({
      conteo,
      totalTurnos,
      porcentaje,
    });
  } catch (error) {
    console.error("❌ Error al obtener turnos por estado:", error);
    res.status(500).json({ message: "Error al obtener turnos por estado", error: error.message });
  }
};

// 🌱 Mediciones promedio por lote
export const obtenerMedicionesPorLote = async (req, res) => {
  try {
    const medicionesSnap = await db.collection("mediciones").get();
    const datosPorLote = {};

    medicionesSnap.forEach((doc) => {
      const { loteId, tipoMedicion, valor } = doc.data();
      if (!datosPorLote[loteId]) datosPorLote[loteId] = { totalMediciones: 0, sumaValores: 0 };

      datosPorLote[loteId].totalMediciones++;
      datosPorLote[loteId].sumaValores += valor || 0;
    });

    const resultado = Object.entries(datosPorLote).map(([loteId, data]) => ({
      loteId,
      promedioValor: data.totalMediciones ? data.sumaValores / data.totalMediciones : 0,
      totalMediciones: data.totalMediciones,
    }));

    res.json(resultado);
  } catch (error) {
    console.error("❌ Error al obtener mediciones por lote:", error);
    res.status(500).json({ message: "Error al obtener mediciones por lote", error: error.message });
  }
};

// 🧾 Exportar PDF (placeholder)
export const exportarPDF = async (req, res) => {
  try {
    const { tipo } = req.query;
    res.json({ message: `Exportar informe a PDF - tipo solicitado: ${tipo}` });
  } catch (error) {
    console.error("❌ Error al exportar PDF:", error);
    res.status(500).json({ message: "Error al exportar PDF", error: error.message });
  }
};

// 📊 Exportar Excel (placeholder)
export const exportarExcel = async (req, res) => {
  try {
    const { tipo } = req.query;
    res.json({ message: `Exportar informe a Excel - tipo solicitado: ${tipo}` });
  } catch (error) {
    console.error("❌ Error al exportar Excel:", error);
    res.status(500).json({ message: "Error al exportar Excel", error: error.message });
  }
};
