// ✅ src/controllers/informes.controller.js

import { db } from "../utils/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

// 📘 Resumen general del sistema
export const obtenerResumenGeneral = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const start = fechaInicio ? new Date(`${fechaInicio}T00:00:00.000Z`) : null;
    const end = fechaFin ? new Date(`${fechaFin}T23:59:59.999Z`) : null;
    const [usuariosSnap, productoresSnap, lotesSnap, ordenesSnap, turnosSnap, medicionesSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("productores").where("activo", "==", true).get(),
      db.collection("lotes").where("activo", "==", true).get(),
      db.collection("ordenes").where("activo", "==", true).get(),
      db.collection("turnos").where("activo", "==", true).get(),
      db.collection("mediciones").get(),
    ]);

    const inRange = (raw) => {
      if (!start || !end) return true;
      if (!raw) return false;
      const d = raw._seconds ? new Date(raw._seconds * 1000) : (raw.seconds ? new Date(raw.seconds * 1000) : new Date(raw));
      if (isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    };

    const totalLotesActivos = lotesSnap.docs.filter(doc => inRange(doc.data().fechaCreacion || doc.data().createdAt)).length;
    const totalTurnosActivos = turnosSnap.docs.filter(doc => inRange(doc.data().fechaTurno || doc.data().fecha || doc.data().creadoEn)).length;
    const totalMedicionesRegistradas = medicionesSnap.docs.filter(doc => inRange(doc.data().fecha || doc.data().createdAt)).length;

    const data = {
      totalUsuarios: usuariosSnap.size,
      totalProductoresActivos: productoresSnap.size,
      totalLotesActivos,
      totalTurnosActivos,
      totalMedicionesRegistradas,
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
    const { fechaInicio, fechaFin } = req.query;
    const start = fechaInicio ? new Date(`${fechaInicio}T00:00:00.000Z`) : null;
    const end = fechaFin ? new Date(`${fechaFin}T23:59:59.999Z`) : null;
    const inRange = (raw) => {
      if (!start || !end) return true;
      if (!raw) return false;
      const d = raw._seconds ? new Date(raw._seconds * 1000) : (raw.seconds ? new Date(raw.seconds * 1000) : new Date(raw));
      if (isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    };
    const productoresSnap = await db.collection("productores").where("activo", "==", true).get();
    const productores = [];

    for (const doc of productoresSnap.docs) {
      const productor = { id: doc.id, ...doc.data() };

      const [lotesSnap, ordenesSnap, turnosSnap] = await Promise.all([
        db.collection("lotes").where("productorId", "==", doc.id).get(),
        db.collection("ordenes").where("productorId", "==", doc.id).get(),
        db.collection("turnos").where("productorId", "==", doc.id).get(),
      ]);

      productor.totalLotes = lotesSnap.docs.filter(d => inRange(d.data().fechaCreacion || d.data().createdAt)).length;
      productor.totalOrdenes = ordenesSnap.docs.filter(d => inRange(d.data().fecha || d.data().createdAt)).length;
      productor.totalTurnos = turnosSnap.docs.filter(d => inRange(d.data().fechaTurno || d.data().fecha || d.data().creadoEn)).length;

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

export const obtenerInsumosResumen = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const start = fechaInicio ? new Date(`${fechaInicio}T00:00:00.000Z`) : null;
    const end = fechaFin ? new Date(`${fechaFin}T23:59:59.999Z`) : null;
    const inRange = (raw) => {
      if (!start || !end) return true;
      if (!raw) return false;
      const d = raw._seconds ? new Date(raw._seconds * 1000) : (raw.seconds ? new Date(raw.seconds * 1000) : new Date(raw));
      if (isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    };
    const [asnap, insSnap] = await Promise.all([
      db.collection("productorInsumos").get(),
      db.collection("insumos").get(),
    ]);
    const insMap = new Map(insSnap.docs.map(d => [d.id, d.data().nombre]));
    let totalAsignado = 0, totalEntregado = 0, totalPendiente = 0;
    const porInsumo = {};
    const porProductor = {};
    asnap.docs.forEach(doc => {
      const a = doc.data();
      if (!inRange(a.fechaAsignacion)) return;
      const cant = Number(a.cantidadAsignada || 0);
      const estado = String(a.estado || 'pendiente').toLowerCase();
      const nombre = insMap.get(String(a.insumoId)) || String(a.insumoId);
      totalAsignado += cant;
      if (estado === 'entregado') totalEntregado += cant; else totalPendiente += cant;
      if (!porInsumo[nombre]) porInsumo[nombre] = { asignado: 0, entregado: 0, pendiente: 0 };
      porInsumo[nombre].asignado += cant;
      if (estado === 'entregado') porInsumo[nombre].entregado += cant; else porInsumo[nombre].pendiente += cant;
      const pid = String(a.productorId);
      if (!porProductor[pid]) porProductor[pid] = { asignado: 0, entregado: 0, pendiente: 0 };
      porProductor[pid].asignado += cant;
      if (estado === 'entregado') porProductor[pid].entregado += cant; else porProductor[pid].pendiente += cant;
    });
    res.json({
      totalAsignado,
      totalEntregado,
      totalPendiente,
      porInsumo,
      porProductor,
      ultimaActualizacion: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ message: "Error en informe de insumos", error: error.message });
  }
};

export const obtenerTurnosEficiencia = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const start = fechaInicio ? new Date(`${fechaInicio}T00:00:00.000Z`) : null;
    const end = fechaFin ? new Date(`${fechaFin}T23:59:59.999Z`) : null;
    const snap = await db.collection("turnos").where("activo", "==", true).get();
    const conteo = { pendiente: 0, confirmado: 0, cancelado: 0, completado: 0, vencido: 0 };
    let sumaLeadDias = 0, leadCount = 0;
    snap.docs.forEach(d => {
      const t = d.data();
      if (start && end) {
        const ft = t.fechaTurno ? (t.fechaTurno._seconds ? new Date(t.fechaTurno._seconds * 1000) : (t.fechaTurno.seconds ? new Date(t.fechaTurno.seconds * 1000) : new Date(t.fechaTurno))) : (t.fecha ? new Date(t.fecha) : null);
        if (!ft || isNaN(ft.getTime()) || ft < start || ft > end) return;
      }
      const est = String(t.estado || 'pendiente').toLowerCase();
      if (conteo[est] !== undefined) conteo[est]++;
      const creado = t.creadoEn ? new Date(t.creadoEn) : null;
      const fechaTurno = t.fechaTurno ? new Date(t.fechaTurno) : (t.fecha ? new Date(t.fecha) : null);
      if (creado && fechaTurno && !isNaN(creado.getTime()) && !isNaN(fechaTurno.getTime())) {
        const diffMs = Math.abs(fechaTurno.getTime() - creado.getTime());
        const dias = diffMs / (1000*60*60*24);
        sumaLeadDias += dias;
        leadCount += 1;
      }
    });
    const totalTurnos = Object.values(conteo).reduce((a,b)=>a+b,0);
    const porcentaje = Object.fromEntries(Object.entries(conteo).map(([k,v])=>[k, totalTurnos ? ((v/totalTurnos)*100).toFixed(2) : "0.00"]));
    const leadTimePromedioDias = leadCount ? Number((sumaLeadDias/leadCount).toFixed(2)) : 0;
    res.json({ conteo, totalTurnos, porcentaje, leadTimePromedioDias });
  } catch (error) {
    res.status(500).json({ message: "Error en informe de turnos", error: error.message });
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
