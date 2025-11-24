// src/controllers/turnos.controller.js

import { db } from "../utils/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

// ➕ Crear un nuevo turno
export const crearTurno = async (req, res) => {
  try {
    console.log("📅 Backend - crearTurno recibido:", req.body);
    console.log("👤 Usuario autenticado:", req.user?.uid);
    console.log("🔑 Headers:", req.headers);
    
    let { tipoTurno, fechaSolicitada, fecha, ipt } = req.body;
    
    // 🔍 DEBUG EXHAUSTIVO DE TIPOS
    console.log("🔍 DEBUG TIPO - VALORES CRUDOS RECIBIDOS:");
    console.log("  - tipoTurno crudo:", JSON.stringify(tipoTurno));
    console.log("  - tipoTurno tipo:", typeof tipoTurno);
    console.log("  - fechaSolicitada cruda:", JSON.stringify(fechaSolicitada));
    console.log("  - fecha cruda:", JSON.stringify(fecha));
    console.log("  - ipt crudo:", JSON.stringify(ipt));
    
    // Obtener el productorId correcto - primero de los claims, luego del UID
    let productorId = req.user.uid;
    if (req.user.firebaseClaims?.productorId) {
      productorId = req.user.firebaseClaims.productorId;
      console.log("🆔 ProductorId obtenido de Firebase claims:", productorId);
    } else {
      console.log("🆔 ProductorId usando UID de Firebase:", productorId);
    }
    
    // Si no hay IPT en el body, intentar obtenerlo de los claims de Firebase
    if (!ipt && req.user.firebaseClaims) {
      ipt = req.user.firebaseClaims.ipt;
      console.log("📋 IPT obtenido de Firebase claims:", ipt);
    }

    // Normalizar tipoTurno - SOLUCIÓN DRÁSTICA Y ULTRA-ROBUSTA
    console.log("🔍 DEBUG - tipoTurno recibido:", JSON.stringify(tipoTurno));
    
    // Guardar valor original para debugging
    const tipoOriginal = tipoTurno;
    
    // Convertir a string y limpiar
    let t = String(tipoTurno).toLowerCase().trim();
    console.log("🔍 DEBUG - tipoTurno limpio:", JSON.stringify(t));
    
    // DICCIONARIO COMPLETO DE MAPEO
    const mapeoTipos = {
      // Insumo
      'insumo': 'insumo',
      'insumos': 'insumo',
      'ins': 'insumo',
      
      // Renovación de Carnet
      'renovación de carnet': 'carnet',
      'renovacion de carnet': 'carnet',
      'renovación': 'carnet',
      'renovacion': 'carnet',
      'renov': 'carnet',
      'carnet': 'carnet',
      'carné': 'carnet',
      'renovación carnet': 'carnet',
      'renovacion carnet': 'carnet',
      
      // Otras variaciones comunes
      'otra': 'otra',
      'otro': 'otra',
      'otros': 'otra',
      'varios': 'otra',
      'vario': 'otra'
    };
    
    // Buscar coincidencia exacta primero
    let tipoNormalizado = mapeoTipos[t];
    
    // Si no hay coincidencia exacta, buscar por includes
    if (!tipoNormalizado) {
      if (t.includes('insumo')) tipoNormalizado = 'insumo';
      else if (t.includes('renovación') || t.includes('renovacion') || t.includes('renov') || t.includes('carnet')) {
        tipoNormalizado = 'carnet';
      } else {
        tipoNormalizado = 'otra';
      }
    }
    
    console.log("🔍 DEBUG - MAPEO RESULTADO:");
    console.log("  - Original:", JSON.stringify(tipoOriginal));
    console.log("  - Procesado:", JSON.stringify(t));
    console.log("  - Resultado:", JSON.stringify(tipoNormalizado));
    
    tipoTurno = tipoNormalizado;

    // Validar fecha (soporta tanto 'fecha' como 'fechaSolicitada')
    const fechaFinal = fecha || fechaSolicitada;
    console.log("📅 Fecha a procesar:", fechaFinal);
    
    // 🕐 DEBUG EXHAUSTIVO DE FECHA
    console.log("🕐 DEBUG FECHA - INICIO");
    console.log("  - Valor crudo:", JSON.stringify(fechaFinal));
    console.log("  - Tipo:", typeof fechaFinal);
    console.log("  - Longitud:", fechaFinal?.length);
    
    if (!fechaFinal) {
      return res.status(400).json({ message: "Fecha es requerida" });
    }
    
    // Procesar fecha con manejo de zona horaria
    let date;
    let fechaProcesada;
    
    if (fechaFinal.includes('T')) {
      // Si ya viene con tiempo (ISO), parsear directamente
      date = new Date(fechaFinal);
      console.log("  - Fecha ISO detectada, parseando directamente");
    } else {
      // Si es solo fecha (YYYY-MM-DD), crear a medianoche UTC
      console.log("  - Fecha simple detectada, creando UTC");
      const [year, month, day] = fechaFinal.split('-').map(Number);
      date = new Date(Date.UTC(year, month - 1, day));
      fechaProcesada = date.toISOString().split('T')[0]; // Guardar fecha original
      console.log("  - Fecha UTC creada:", date.toISOString());
      console.log("  - Feza local (AR):", date.toLocaleDateString('es-AR'));
    }
    
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: "Fecha inválida" });
    }
    
    console.log("  - Día de semana (0=dom):", date.getDay());
    console.log("  - Día del mes:", date.getDate());
    console.log("  - Mes:", date.getMonth());
    console.log("  - Año:", date.getFullYear());
    console.log("🕐 DEBUG FECHA - FIN");

    // No fines de semana
    const day = date.getDay();
    if (day === 0 || day === 6) {
      return res.status(400).json({ message: "No se permiten turnos sábado o domingo" });
    }

    // Si es turno de insumo → verificar asignaciones en ProductorInsumos
    if (tipoTurno === "insumo") {
      const asignSnap = await db
        .collection("productorInsumos")
        .where("productorId", "==", String(productorId))
        .get();
      const asignaciones = asignSnap.docs.map(d => d.data()).filter(x => Number(x.cantidadAsignada || 0) > 0 && x.estado !== "entregado");
      if (asignaciones.length === 0) {
        return res.status(400).json({ message: "Usted no tiene insumos disponibles." });
      }
    }

    // Crear el turno con fecha UTC para evitar problemas de zona horaria
    const fechaParaFirestore = fechaProcesada || fechaFinal;
    console.log("💾 Guardando turno con fecha:", fechaParaFirestore);
    
    const turno = {
      productorId,
      tipoTurno,
      fecha: fechaParaFirestore,
      fechaTurno: fechaParaFirestore,
      estado: "pendiente",
      creadoEn: new Date().toISOString(),
      activo: true,
      ...(req.body.motivo ? { motivo: req.body.motivo } : {})
    };

    console.log("💾 GUARDANDO EN FIRESTORE:");
    console.log("  - Documento a guardar:", JSON.stringify(turno, null, 2));
    
    const docRef = await db.collection("turnos").add(turno);
    
    console.log("✅ Documento guardado con ID:", docRef.id);
    
    // Verificar qué se guardó realmente
    const docGuardado = await docRef.get();
    console.log("📖 Datos guardados en Firestore:", JSON.stringify(docGuardado.data(), null, 2));

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
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const batch = db.batch(); let updates = 0;
    const raws = snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, data: doc.data() }))
    const turnos = raws.map(({ id, ref, data }) => {
      const raw = { ...data };
      // Normalizar fechaTurno a Date
      let fecha;
      if (raw.fechaTurno && raw.fechaTurno._seconds) {
        fecha = new Date(raw.fechaTurno._seconds * 1000);
      } else if (typeof raw.fechaTurno === 'string') {
        // aceptar 'YYYY-MM-DD' o ISO
        const s = raw.fechaTurno.includes('T') ? raw.fechaTurno : `${raw.fechaTurno}T00:00:00.000Z`;
        fecha = new Date(s);
      } else {
        fecha = new Date(raw.fecha || Date.now());
      }
      const estado = String(raw.estado || 'pendiente').toLowerCase();
      if (estado === 'pendiente' && fecha instanceof Date && !isNaN(fecha.getTime())) {
        const soloDia = new Date(fecha); soloDia.setHours(0,0,0,0);
        if (soloDia.getTime() < hoy.getTime()) {
          batch.update(ref, { estado: 'vencido', motivo: 'Vencido automáticamente por fecha', updatedAt: Timestamp.now() });
          updates++;
          raw.estado = 'vencido'; raw.motivo = 'Vencido automáticamente por fecha';
        }
      }
      return { id, ref, ...convertirTimestamps(raw) };
    });
    if (updates > 0) await batch.commit();

    // Enriquecer con nombre e IPT del productor
    const prodInfo = new Map();
    const ids = Array.from(new Set(turnos.map(t => String(t.productorId || '')))).filter(Boolean);
    for (const pid of ids) {
      try {
        const pdoc = await db.collection('productores').doc(pid).get();
        if (pdoc.exists) {
          const pd = pdoc.data();
          prodInfo.set(pid, { nombre: pd.nombreCompleto || pd.nombre || '', ipt: String(pd.ipt || '') });
          continue;
        }
      } catch {}
    }
    const enriched = turnos.map(t => ({
      ...t,
      productorNombre: t.productorNombre || prodInfo.get(String(t.productorId || ''))?.nombre || '',
      ipt: t.ipt || prodInfo.get(String(t.productorId || ''))?.ipt || '',
      motivo: t.motivo || '-',
    }));

    res.json(enriched);
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

    // Si se confirma/completa turno de insumo, marcar asignaciones como entregadas
    try {
      const doc = await db.collection("turnos").doc(id).get();
      const turno = doc.data();
      if (turno?.tipoTurno === "insumo" && (estado === "confirmado" || estado === "completado")) {
        const snap = await db
          .collection("productorInsumos")
          .where("productorId", "==", String(turno.productorId))
          .where("estado", "==", "pendiente")
          .get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.update(d.ref, { estado: "entregado", fechaEntrega: new Date() }));
        await batch.commit();
      }
    } catch (e) {}

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

    const turnos = snapshot.docs.map(doc => {
      const raw = doc.data();
      return { id: doc.id, ...convertirTimestamps({ ...raw, motivo: raw.motivo || '-' }) };
    });
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
    if (String(tipoTurno) !== "insumo") {
      console.log("✅ Tipo no es insumo, retornando disponible: true");
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
      
    const items = snap.docs.map(doc => doc.data()).filter(d => d.activo !== false && d.tipoTurno === "insumo");
    console.log("📊 Turnos de Insumo encontrados ese día:", items.length);
    
    // Verificar si el productor tiene asignaciones de insumos
    if (ipt) {
      try {
        const psnap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
        if (!psnap.empty) {
          const productorId = psnap.docs[0].id;
          const asnap = await db.collection("productorInsumos").where("productorId", "==", String(productorId)).get();
          const asignaciones = asnap.docs.map(d => d.data()).filter(x => Number(x.cantidadAsignada || 0) > 0 && x.estado !== "entregado");
          const tiene = asignaciones.length > 0;
          if (!tiene) {
            return res.json({ disponible: false, motivo: "Usted no tiene insumos disponibles." });
          }
        }
      } catch {}
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
