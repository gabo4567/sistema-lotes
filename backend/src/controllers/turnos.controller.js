// src/controllers/turnos.controller.js

import { db } from "../utils/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

// ➕ Crear un nuevo turno
export const crearTurno = async (req, res) => {
  try {
    console.log("📅 Backend - crearTurno recibido:", req.body);
    console.log("👤 Usuario autenticado:", req.user?.uid);
    
    let { tipoTurno, fechaSolicitada, fecha, ipt } = req.body;
    const productorId = req.user.uid;
    
    // Si no hay IPT en el body, intentar obtenerlo de los claims de Firebase
    if (!ipt && req.user.firebaseClaims) {
      ipt = req.user.firebaseClaims.ipt;
      console.log("📋 IPT obtenido de Firebase claims:", ipt);
    }

    // Normalizar tipoTurno
    const t = String(tipoTurno).toLowerCase().trim();
    let tipo = "Otra";
    if (t.includes("insumo")) tipo = "Insumo";
    else if (t.includes("renov")) tipo = "Carnet de renovación";

    tipoTurno = tipo;

    // Validar fecha (soporta tanto 'fecha' como 'fechaSolicitada')
    const fechaFinal = fecha || fechaSolicitada;
    console.log("📅 Fecha a procesar:", fechaFinal);
    
    if (!fechaFinal) {
      return res.status(400).json({ message: "Fecha es requerida" });
    }
    
    const date = new Date(fechaFinal);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: "Fecha inválida" });
    }

    // No fines de semana
    const day = date.getDay();
    if (day === 0 || day === 6) {
      return res.status(400).json({ message: "No se permiten turnos sábado o domingo" });
    }

    // Si es turno de insumo → verificar stock
    if (tipoTurno === "insumo") {
      const userDoc = await db.collection("productores").doc(productorId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Productor no encontrado" });
      }

      const datos = userDoc.data();
      const tieneInsumos = datos.insumosPendientes && datos.insumosPendientes > 0;

      if (!tieneInsumos) {
        return res.status(400).json({ message: "No tienes insumos para retirar" });
      }
    }

    // Crear el turno
    const turno = {
      productorId,
      tipoTurno,
      fecha: fechaFinal,
      fechaTurno: fechaFinal,
      estado: "pendiente",
      creadoEn: new Date().toISOString(),
      activo: true
    };

    await db.collection("turnos").add(turno);

    return res.json({ message: "Turno creado exitosamente", turno });

  } catch (error) {
    console.error("Error en crearTurno:", error);
    return res.status(500).json({ message: "Error al crear el turno" });
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
    let { estado, motivo } = req.body;
    const mapEstados = {
      Solicitado: "pendiente",
      Aprobado: "confirmado",
      Cancelado: "cancelado",
      Vencido: "vencido",
    };
    estado = mapEstados[estado] || estado;

    const estadosPermitidos = ["pendiente", "confirmado", "cancelado", "completado", "vencido"];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ message: "Estado no válido" });
    }

    await db.collection("turnos").doc(id).update({ estado, motivo: motivo || "", updatedAt: Timestamp.now() });

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

    // 👇 Forzar el uso de UTC y cubrir el día completo
    const inicio = new Date(`${fechaInicio}T00:00:00.000Z`);
    const fin = new Date(`${fechaFin}T23:59:59.999Z`);

    console.log("DEBUG RANGO:",
      "inicio =", inicio.toISOString(),
      "| fin =", fin.toISOString()
    );

    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
      return res.status(400).json({ message: "Formato de fecha inválido" });
    }

    console.log("📅 Consultando rango:", inicio.toISOString(), "->", fin.toISOString());

    const snapshot = await db
      .collection("turnos")
      .where("fechaTurno", ">=", Timestamp.fromDate(inicio))
      .where("fechaTurno", "<=", Timestamp.fromDate(fin))
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "No se encontraron turnos en el rango especificado" });
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

export const disponibilidadTurno = async (req, res) => {
  try {
    const { fechaSolicitada, tipoTurno, ipt } = req.query;
    console.log("📅 Backend - disponibilidadTurno recibido:", { fechaSolicitada, tipoTurno, ipt });
    
    if (!fechaSolicitada || !tipoTurno) {
      console.log("❌ Faltan parámetros");
      return res.status(400).json({ message: "Faltan parámetros" });
    }
    
    console.log("🔍 Procesando fecha:", fechaSolicitada, "tipo:", typeof fechaSolicitada);
    const m = String(fechaSolicitada).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    console.log("📅 Match regex:", m);
    
    let fecha;
    if (m) {
      fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      console.log("✅ Fecha creada desde match:", fecha);
    } else {
      fecha = new Date(`${fechaSolicitada}T00:00:00.000Z`);
      console.log("⚠️ Fecha creada desde string:", fecha);
    }
    
    console.log("📆 Fecha final:", fecha, "isValid:", !isNaN(fecha.getTime()));
    
    if (isNaN(fecha.getTime())) {
      console.log("❌ Fecha inválida - retornando error");
      return res.json({ disponible: false, motivo: "Fecha inválida" });
    }
    
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const soloDia = new Date(fecha);
    soloDia.setHours(0,0,0,0);
    
    if (soloDia.getTime() < hoy.getTime()) {
      console.log("❌ Fecha ya pasada");
      return res.json({ disponible: false, motivo: "Fecha ya pasada" });
    }
    
    const dow = fecha.getDay();
    if (dow === 0 || dow === 6) {
      console.log("❌ Fin de semana");
      return res.json({ disponible: false, motivo: "Fin de semana" });
    }
    
    // Para "Carnet de renovación" y "Otra", siempre están disponibles si la fecha es válida
    if (String(tipoTurno) !== "Insumo") {
      console.log("✅ Tipo no es Insumo, retornando disponible: true");
      return res.json({ disponible: true });
    }
    
    console.log("🔍 Procesando tipo Insumo...");
    
    // Solo para "Insumo" verificamos la capacidad y disponibilidad de insumos
    const inicio = new Date(fecha);
    const fin = new Date(fecha);
    inicio.setHours(0,0,0,0);
    fin.setHours(23,59,59,999);
    
    const snap = await db
      .collection("turnos")
      .where("fechaTurno", ">=", Timestamp.fromDate(inicio))
      .where("fechaTurno", "<=", Timestamp.fromDate(fin))
      .get();
      
    const items = snap.docs.map(doc => doc.data()).filter(d => d.activo !== false && d.tipoTurno === "Insumo");
    console.log("📊 Turnos de Insumo encontrados ese día:", items.length);
    
    // Verificar si el productor tiene insumos disponibles
    if (ipt) {
      try {
        const psnap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
        const okDoc = !psnap.empty ? psnap.docs[0].data() : null;
        const tieneInsumos = Boolean(okDoc && okDoc.insumosDisponibles);
        console.log("💊 Productor tiene insumos:", tieneInsumos);
        if (!tieneInsumos) {
          console.log("❌ No tiene insumos para recibir");
          return res.json({ disponible: false, reason: "No tienes insumos para recibir" });
        }
      } catch (e) {
        console.log("❌ Error verificando insumos:", e);
      }
    }
    
    const capacidadPorDia = 10;
    const disponible = items.length < capacidadPorDia;
    console.log("📈 Capacidad:", items.length, "/", capacidadPorDia, "-> disponible:", disponible);
    return res.json({ disponible });
  } catch (error) {
    console.error("❌ Error en disponibilidadTurno:", error);
    return res.status(500).json({ message: "Error de disponibilidad" });
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
