// src/controllers/turnos.controller.js

import { db } from "../utils/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import { getDisponibilidadInsumos } from "./insumos.controller.js";

const DEFAULT_TURNOS_CAPACIDAD_DIA = 50;
const TURNOS_CAPACIDAD_COLLECTION = "turnosCapacidad";
const TURNOS_CONFIG_COLLECTION = "config";
const TURNOS_CONFIG_DOC = "turnos";
const DEFAULT_TURNOS_HABILITADO = true;
const HORA_APERTURA = 7;
const HORA_CIERRE = 13;

const console = process.env.DEBUG_TURNOS === "true"
  ? globalThis.console
  : { ...globalThis.console, log: () => {} };

const toTurnoTimestamp = (input) => {
  if (!input) return null;
  if (typeof input === "object" && input?._seconds !== undefined) return input;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : Timestamp.fromDate(input);

  const raw = String(input).trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0));
    return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
};

const normalizeEstado = (e) => String(e || "pendiente").toLowerCase().trim();

const normalizeTipoTurno = (t) => {
  const s = String(t || "").toLowerCase().trim();
  if (!s) return s;
  if (s === "otra" || s === "otros") return "otro";
  if (s.includes("insum")) return "insumo";
  if (s.includes("renov") || s.includes("carnet")) return "carnet";
  return "otro";
};

const normalizeRole = (r) =>
  String(r || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const isAdminRequest = (req) => {
  const role = normalizeRole(req?.user?.role);
  return role === "administrador" || role === "admin";
};

const getAuthOwnershipIds = (req) => {
  const ids = new Set();
  const uid = req?.user?.uid;
  if (uid) ids.add(String(uid));
  const claimPid = req?.user?.firebaseClaims?.productorId;
  if (claimPid) ids.add(String(claimPid));
  return ids;
};

const canModifyTurno = (req, turno) => {
  if (isAdminRequest(req)) return true;
  const pid = String(turno?.productorId || "");
  if (!pid) return false;
  return getAuthOwnershipIds(req).has(pid);
};

const turnoDateFromRaw = (raw) => {
  if (!raw) return null;
  if (raw.fechaTurno && raw.fechaTurno._seconds) {
    const d = new Date(raw.fechaTurno._seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw.fechaTurno === "string") {
    const s = raw.fechaTurno.includes("T") ? raw.fechaTurno : `${raw.fechaTurno}T00:00:00.000Z`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  if (raw.fecha && typeof raw.fecha === "string") {
    const d = new Date(raw.fecha);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const toYmdUtc = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const isValidYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());

const resolveCapacidadDia = async (ymd) => {
  if (!isValidYmd(ymd)) return DEFAULT_TURNOS_CAPACIDAD_DIA;
  try {
    const snap = await db.collection(TURNOS_CAPACIDAD_COLLECTION).doc(String(ymd)).get();
    if (!snap.exists) return DEFAULT_TURNOS_CAPACIDAD_DIA;
    const raw = snap.data() || {};
    const n = Number(raw.capacidad);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_TURNOS_CAPACIDAD_DIA;
    return n;
  } catch {
    return DEFAULT_TURNOS_CAPACIDAD_DIA;
  }
};

const countTurnosActivosEnDia = async (ymd) => {
  if (!isValidYmd(ymd)) return 0;
  const inicio = new Date(`${ymd}T00:00:00.000Z`);
  const fin = new Date(`${ymd}T23:59:59.999Z`);
  const inicioIso = inicio.toISOString();
  const finIso = fin.toISOString();

  const [snapTs, snapIso] = await Promise.all([
    db
      .collection("turnos")
      .where("fechaTurno", ">=", Timestamp.fromDate(inicio))
      .where("fechaTurno", "<=", Timestamp.fromDate(fin))
      .get(),
    db
      .collection("turnos")
      .where("fecha", ">=", inicioIso)
      .where("fecha", "<=", finIso)
      .get(),
  ]);

  const seen = new Set();
  const countActive = (docs) => {
    let cnt = 0;
    docs.forEach((d) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      const t = d.data() || {};
      if (t.activo !== false) cnt += 1;
    });
    return cnt;
  };

  return countActive(snapTs.docs) + countActive(snapIso.docs);
};

const getTurnosConfig = async () => {
  try {
    const snap = await db.collection(TURNOS_CONFIG_COLLECTION).doc(TURNOS_CONFIG_DOC).get();
    if (!snap.exists) return { habilitado: DEFAULT_TURNOS_HABILITADO, mensaje: "" };
    const raw = snap.data() || {};
    const habilitado = typeof raw.habilitado === "boolean" ? raw.habilitado : DEFAULT_TURNOS_HABILITADO;
    const mensaje = String(raw.mensaje || "").trim();
    return { habilitado, mensaje };
  } catch {
    return { habilitado: DEFAULT_TURNOS_HABILITADO, mensaje: "" };
  }
};

const isTurnoExpired = (raw, hoyStart) => {
  const est = normalizeEstado(raw?.estado);
  if (est !== "pendiente" && est !== "confirmado") return false;
  const fecha = turnoDateFromRaw(raw);
  if (!fecha) return false;
  const soloDia = new Date(fecha);
  soloDia.setHours(0, 0, 0, 0);
  return soloDia.getTime() < hoyStart.getTime();
};

const applyVencidoIfNeeded = (raw, hoyStart) => {
  if (!isTurnoExpired(raw, hoyStart)) return null;
  const motivoRaw = String(raw.motivo || "").trim();
  const update = { estado: "vencido", updatedAt: Timestamp.now() };
  raw.estado = "vencido";
  if (!motivoRaw) {
    update.motivo = "Vencido automáticamente por fecha";
    raw.motivo = "Vencido automáticamente por fecha";
  }
  return update;
};

const canTransitionEstado = (from, to) => {
  const f = normalizeEstado(from);
  const t = normalizeEstado(to);
  if (t === "vencido") return false;
  if (f === "cancelado" || f === "completado" || f === "vencido") return false;
  if (f === "pendiente") return t === "confirmado" || t === "cancelado";
  if (f === "confirmado") return t === "cancelado" || t === "completado";
  return false;
};

// ➕ Crear un nuevo turno
export const crearTurno = async (req, res) => {
  try {
    const cfg = await getTurnosConfig();
    if (cfg.habilitado === false) {
      return res.status(400).json({ message: cfg.mensaje || "La solicitud de turnos está deshabilitada temporalmente." });
    }

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
      
      // Otras variaciones comunes (normalizamos a 'otro')
      'otra': 'otro',
      'otro': 'otro',
      'otros': 'otro',
      'varios': 'otro',
      'vario': 'otro'
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
    
    tipoTurno = normalizeTipoTurno(tipoNormalizado);

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
    
    const ts = toTurnoTimestamp(fechaFinal);
    if (!ts) {
      return res.status(400).json({ message: "Fecha inválida" });
    }
    const date = ts.toDate();
    
    console.log("  - Día de semana (0=dom):", date.getDay());
    console.log("  - Día del mes:", date.getDate());
    console.log("  - Mes:", date.getMonth());
    console.log("  - Año:", date.getFullYear());
    console.log("🕐 DEBUG FECHA - FIN");

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const soloDia = new Date(date);
    soloDia.setHours(0, 0, 0, 0);
    if (soloDia.getTime() < hoy.getTime()) {
      return res.status(400).json({ message: "Fecha ya pasada" });
    }
    if (soloDia.getTime() === hoy.getTime()) {
      const ahora = new Date();
      const cierreHoy = new Date();
      cierreHoy.setHours(HORA_CIERRE, 0, 0, 0);
      if (ahora.getTime() >= cierreHoy.getTime()) {
        return res
          .status(400)
          .json({
            message:
              `El horario de atención para hoy ya finalizó (${String(HORA_APERTURA).padStart(2, "0")}:00 a ${String(HORA_CIERRE).padStart(2, "0")}:00). Seleccioná otra fecha.`,
          });
      }
    }

    // No fines de semana
    const day = date.getDay();
    if (day === 0 || day === 6) {
      return res.status(400).json({ message: "No se permiten turnos sábado o domingo" });
    }

    const motivoTrim = String(req.body.motivo || "").trim();
    if (tipoTurno === "otro" && !motivoTrim) {
      return res.status(400).json({ message: 'Si el tipo es "Otro", el motivo es obligatorio.' });
    }

    const targetYmd = toYmdUtc(date);
    const capacidadDia = await resolveCapacidadDia(targetYmd);
    const turnosDia = await countTurnosActivosEnDia(targetYmd);
    if (turnosDia >= capacidadDia) {
      return res.status(400).json({ message: `No hay cupos disponibles para esa fecha. Capacidad: ${capacidadDia}.` });
    }
    if (targetYmd && productorId && tipoTurno) {
      const snapDup = await db
        .collection("turnos")
        .where("productorId", "==", String(productorId))
        .where("activo", "==", true)
        .get();

      const isEstadoBloqueante = (estadoRaw) => {
        const st = normalizeEstado(estadoRaw);
        return st !== "cancelado" && st !== "completado" && st !== "vencido";
      };

      const hasDup = snapDup.docs.some((d) => {
        const other = d.data();
        if (!isEstadoBloqueante(other?.estado)) return false;
        const otherTipo = normalizeTipoTurno(other?.tipoTurno);
        if (otherTipo !== tipoTurno) return false;
        const otherDate = turnoDateFromRaw(other);
        const otherYmd = toYmdUtc(otherDate);
        return Boolean(otherYmd && otherYmd === targetYmd);
      });

      if (hasDup) {
        return res.status(400).json({ message: "Ya tenés un turno del mismo tipo para esa fecha. Elegí otra fecha o un tipo diferente." });
      }
    }

    // Si es turno de insumo → verificar asignaciones en ProductorInsumos
    if (tipoTurno === "insumo") {
      const disp = await getDisponibilidadInsumos(productorId);
      if (!disp?.tieneDisponible) {
        return res.status(400).json({ message: "Usted no tiene insumos disponibles." });
      }
    }

    const fechaIso = date.toISOString();
    console.log("💾 Guardando turno con fecha:", fechaIso);
    
    const turno = {
      productorId,
      tipoTurno,
      fecha: fechaIso,
      fechaTurno: ts,
      estado: "pendiente",
      creadoEn: new Date().toISOString(),
      updatedAt: Timestamp.now(),
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

    return res.json({ message: "Turno creado exitosamente", turno: { id: docRef.id, ...convertirTimestamps(turno) } });

  } catch (error) {
    console.error("Error en crearTurno:", error);
    return res.status(500).json({ message: "Error al crear el turno" });
  }
};


// 📋 Obtener todos los turnos (con filtros de activo/inactivo)
export const obtenerTurnos = async (req, res) => {
  try {
    const { activo } = req.query;
    let query = db.collection("turnos");
    
    if (activo !== undefined) {
      query = query.where("activo", "==", activo === "true");
    }

    const snapshot = await query.get();
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const batch = db.batch(); let writes = 0;
    const raws = snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, data: doc.data() }))
    const turnos = raws.map(({ id, ref, data }) => {
      const raw = { ...data };
      const rawTipoStr = String(raw.tipoTurno || "").toLowerCase().trim();
      const tipoNorm = rawTipoStr ? normalizeTipoTurno(rawTipoStr) : rawTipoStr;
      if (rawTipoStr && tipoNorm && tipoNorm !== rawTipoStr) {
        batch.update(ref, { tipoTurno: tipoNorm });
        writes++;
        raw.tipoTurno = tipoNorm;
      }
      if (typeof raw.fechaTurno === "string") {
        const ts = toTurnoTimestamp(raw.fechaTurno);
        if (ts) {
          const iso = ts.toDate().toISOString();
          batch.update(ref, { fechaTurno: ts, fecha: iso });
          writes++;
          raw.fechaTurno = ts;
          raw.fecha = iso;
        }
      }
      const vencidoUpdate = applyVencidoIfNeeded(raw, hoy);
      if (vencidoUpdate) {
        batch.update(ref, vencidoUpdate);
        writes++;
      }
      return { id, ref, ...convertirTimestamps(raw) };
    });
    if (writes > 0) await batch.commit();

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
    res.status(500).json({ message: "Error al obtener los turnos", error: "Error al obtener los turnos" });
  }
};

// 🔍 Obtener un turno por ID
export const obtenerTurnoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection("turnos").doc(id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ message: "Turno no encontrado" });
    const raw = doc.data();
    const rawTipoStr = String(raw?.tipoTurno || "").toLowerCase().trim();
    const tipoNorm = rawTipoStr ? normalizeTipoTurno(rawTipoStr) : rawTipoStr;
    if (rawTipoStr && tipoNorm && tipoNorm !== rawTipoStr) {
      await ref.update({ tipoTurno: tipoNorm });
      raw.tipoTurno = tipoNorm;
    }
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const vencidoUpdate = applyVencidoIfNeeded(raw, hoy);
    if (vencidoUpdate) await ref.update(vencidoUpdate);
    res.json({ id: doc.id, ...convertirTimestamps(raw) });
  } catch (error) {
    console.error("Error al obtener el turno:", error);
    res.status(500).json({ message: "Error al obtener el turno", error: "Error al obtener el turno" });
  }
};

// ✏️ Actualizar un turno
export const actualizarTurno = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body, updatedAt: Timestamp.now() };

    const snap = await db.collection("turnos").doc(id).get();
    if (!snap.exists) return res.status(404).json({ message: "Turno no encontrado" });
    const current = snap.data();
    if (!canModifyTurno(req, current)) {
      return res.status(403).json({ message: "No tenés permiso para modificar este turno" });
    }
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const vencidoUpdate = applyVencidoIfNeeded(current, hoy);
    if (vencidoUpdate) {
      await db.collection("turnos").doc(id).update(vencidoUpdate);
      return res.status(400).json({ message: "No puedes editar un turno vencido" });
    }
    if (String(current.estado || '').toLowerCase() !== 'pendiente') {
      return res.status(400).json({ message: `No puedes editar un turno ${String(current.estado||'').toLowerCase()}` });
    }

    let nextFechaTs = null;
    if (data.fechaTurno) {
      const ts = toTurnoTimestamp(data.fechaTurno);
      if (!ts) {
        return res.status(400).json({ message: "Formato de fecha inválido" });
      }
      data.fechaTurno = ts;
      data.fecha = ts.toDate().toISOString();
      nextFechaTs = ts;
    } else {
      nextFechaTs = toTurnoTimestamp(current.fechaTurno || current.fecha);
    }

    if (nextFechaTs) {
      const d = nextFechaTs.toDate();
      const soloDia = new Date(d);
      soloDia.setHours(0, 0, 0, 0);
      if (soloDia.getTime() < hoy.getTime()) {
        return res.status(400).json({ message: "Fecha ya pasada" });
      }
      const dow = d.getDay();
      if (dow === 0 || dow === 6) {
        return res.status(400).json({ message: "No se permiten turnos sábado o domingo" });
      }
    }

    if (data.tipoTurno !== undefined) {
      data.tipoTurno = normalizeTipoTurno(data.tipoTurno);
    }
    const nextTipo = normalizeTipoTurno(data.tipoTurno ?? current.tipoTurno);
    const nextMotivo = Object.prototype.hasOwnProperty.call(data, "motivo") ? data.motivo : current.motivo;
    if (nextTipo === "otro" && !String(nextMotivo || "").trim()) {
      return res.status(400).json({ message: 'Si el tipo es "Otro", el motivo es obligatorio.' });
    }

    const targetYmd = nextFechaTs ? toYmdUtc(nextFechaTs.toDate()) : null;
    if (targetYmd && nextTipo && current.productorId) {
      const snapDup = await db
        .collection("turnos")
        .where("productorId", "==", String(current.productorId))
        .where("activo", "==", true)
        .get();
      const isEstadoBloqueante = (estadoRaw) => {
        const st = normalizeEstado(estadoRaw);
        return st !== "cancelado" && st !== "completado" && st !== "vencido";
      };
      const hasDup = snapDup.docs.some((d) => {
        if (d.id === id) return false;
        const other = d.data();
        if (!isEstadoBloqueante(other?.estado)) return false;
        const otherTipo = normalizeTipoTurno(other?.tipoTurno);
        if (otherTipo !== nextTipo) return false;
        const otherDate = turnoDateFromRaw(other);
        const otherYmd = toYmdUtc(otherDate);
        return otherYmd === targetYmd;
      });
      if (hasDup) {
        return res.status(400).json({ message: "Ya tenés un turno del mismo tipo para esa fecha. Elegí otra fecha o un tipo diferente." });
      }
    }

    await db.collection("turnos").doc(id).update(data);
    res.json({ message: "Turno actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar el turno:", error);
    res.status(500).json({ message: "Error al actualizar el turno", error: "Error al actualizar el turno" });
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
    if (normalizeEstado(estado) === "vencido") {
      return res.status(400).json({ message: "El estado 'vencido' es automático y no puede setearse manualmente" });
    }

    const ref = db.collection("turnos").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: "Turno no encontrado" });
    const current = snap.data();
    if (!canModifyTurno(req, current)) {
      return res.status(403).json({ message: "No tenés permiso para modificar este turno" });
    }
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const vencidoUpdate = applyVencidoIfNeeded(current, hoy);
    if (vencidoUpdate) {
      await ref.update(vencidoUpdate);
      return res.status(400).json({ message: "El turno está vencido y no puede cambiar de estado" });
    }

    const from = normalizeEstado(current?.estado);
    const to = normalizeEstado(estado);
    if (!canTransitionEstado(from, to)) {
      return res.status(400).json({ message: `Transición de estado no permitida: ${from} -> ${to}` });
    }

    const update = { estado: to, updatedAt: Timestamp.now() };
    if (typeof motivo === "string") {
      update.motivo = motivo;
    }
    await ref.update(update);

    // Si se confirma/completa turno de insumo, actualizar entrega de forma segura (sin asumir que se entrega todo)
    try {
      const turno = current;
      if (turno?.tipoTurno === "insumo" && (estado === "confirmado" || estado === "completado")) {
        const snap = await db
          .collection("productorInsumos")
          .where("productorId", "==", String(turno.productorId))
          .where("estado", "==", "pendiente")
          .get();
        const pendientes = snap.docs
          .map((d) => ({ ref: d.ref, data: d.data() || {} }))
          .map(({ ref, data }) => {
            const asignada = Number(data?.cantidadAsignada || 0);
            const entregadaRaw = data?.cantidadEntregada;
            const entregada = Number.isFinite(Number(entregadaRaw))
              ? Number(entregadaRaw)
              : (String(data?.estado || "").toLowerCase().trim() === "entregado" ? asignada : 0);
            const disponible = Math.max(0, asignada - entregada);
            return { ref, data, asignada, entregada, disponible };
          })
          .filter((x) => x.asignada > 0 && x.disponible > 0);

        if (pendientes.length === 1) {
          const now = new Date();
          const p = pendientes[0];
          const nuevaEntregada = p.entregada + p.disponible;
          await p.ref.update({
            cantidadAsignada: p.asignada,
            cantidadEntregada: nuevaEntregada,
            estado: "entregado",
            fechaEntrega: now,
            updatedAt: now,
            ...(p.data?.createdAt === undefined ? { createdAt: p.data?.fechaAsignacion || now } : {}),
          });
        }
      }
    } catch (e) {}

    res.json({ message: `Estado del turno actualizado a '${estado}'` });
  } catch (error) {
    console.error("Error al cambiar el estado del turno:", error);
    res.status(500).json({ message: "Error al cambiar el estado del turno", error: "Error al cambiar el estado del turno" });
  }
};

// 🗑️ Desactivar (soft delete) un turno
export const eliminarTurno = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body; // Opcional: ID del usuario que realiza la acción
    
    const doc = await db.collection("turnos").doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: "Turno no encontrado" });
    const turno = doc.data();
    if (!canModifyTurno(req, turno)) {
      return res.status(403).json({ message: "No tenés permiso para modificar este turno" });
    }
    
    const updateData = { 
      activo: false, 
      desactivadoEn: Timestamp.now(),
      desactivadoPor: userId || req.user?.uid || 'sistema',
      updatedAt: Timestamp.now() 
    };
    
    await db.collection("turnos").doc(id).update(updateData);
    res.json({ message: "Turno desactivado correctamente", id });
  } catch (error) {
    console.error("Error al desactivar el turno:", error);
    res.status(500).json({ message: "Error al desactivar el turno", error: "Error al desactivar el turno" });
  }
};

// ♻️ Restaurar un turno desactivado
export const restaurarTurno = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("turnos").doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: "Turno no encontrado" });
    
    await db.collection("turnos").doc(id).update({ 
      activo: true, 
      restauradoEn: Timestamp.now(),
      updatedAt: Timestamp.now() 
    });
    res.json({ message: "Turno restaurado correctamente", id });
  } catch (error) {
    console.error("Error al restaurar el turno:", error);
    res.status(500).json({ message: "Error al restaurar el turno", error: "Error al restaurar el turno" });
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

    let query = db.collection("turnos").where("activo", "==", true);
    if (estado === "vencido") {
      query = query.where("estado", "in", ["vencido", "pendiente", "confirmado"]);
    } else {
      query = query.where("estado", "==", estado);
    }
    const snapshot = await query.get();

    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const batch = db.batch(); let writes = 0;
    const turnos = snapshot.docs.map(doc => {
      const raw = doc.data();
      const rawTipoStr = String(raw?.tipoTurno || "").toLowerCase().trim();
      const tipoNorm = rawTipoStr ? normalizeTipoTurno(rawTipoStr) : rawTipoStr;
      if (rawTipoStr && tipoNorm && tipoNorm !== rawTipoStr) {
        batch.update(doc.ref, { tipoTurno: tipoNorm });
        writes++;
        raw.tipoTurno = tipoNorm;
      }
      const vencidoUpdate = applyVencidoIfNeeded(raw, hoy);
      if (vencidoUpdate) {
        batch.update(doc.ref, vencidoUpdate);
        writes++;
      }
      return { id: doc.id, ...convertirTimestamps({ ...raw, motivo: raw.motivo || "-" }) };
    }).filter(t => normalizeEstado(t.estado) === normalizeEstado(estado));

    if (writes > 0) await batch.commit();
    res.json(turnos);
  } catch (error) {
    console.error("Error al obtener los turnos por estado:", error);
    res.status(500).json({ message: "Error al obtener los turnos por estado", error: "Error al obtener los turnos por estado" });
  }
};

// 🔍 Obtener turnos por productorId (con filtros de activo/inactivo)
export const obtenerTurnosPorProductor = async (req, res) => {
  try {
    const { productorId } = req.params;
    const { activo } = req.query;
    
    let query = db.collection("turnos").where("productorId", "==", productorId);
    
    if (activo !== undefined) {
      query = query.where("activo", "==", activo === "true");
    }

    const snapshot = await query.get();
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const batch = db.batch(); let writes = 0;
    const turnos = snapshot.docs.map(doc => {
      const raw = doc.data();
      const rawTipoStr = String(raw?.tipoTurno || "").toLowerCase().trim();
      const tipoNorm = rawTipoStr ? normalizeTipoTurno(rawTipoStr) : rawTipoStr;
      if (rawTipoStr && tipoNorm && tipoNorm !== rawTipoStr) {
        batch.update(doc.ref, { tipoTurno: tipoNorm });
        writes++;
        raw.tipoTurno = tipoNorm;
      }
      if (typeof raw.fechaTurno === "string") {
        const ts = toTurnoTimestamp(raw.fechaTurno);
        if (ts) {
          batch.update(doc.ref, { fechaTurno: ts, fecha: ts.toDate().toISOString() });
          writes++;
          raw.fechaTurno = ts;
          raw.fecha = ts.toDate().toISOString();
        }
      }
      const vencidoUpdate = applyVencidoIfNeeded(raw, hoy);
      if (vencidoUpdate) {
        batch.update(doc.ref, vencidoUpdate);
        writes++;
      }
      return { id: doc.id, ...convertirTimestamps({ ...raw, motivo: raw.motivo || '-' }) };
    });
    if (writes > 0) await batch.commit();
    res.json(turnos);
  } catch (error) {
    console.error("Error al obtener los turnos por productor:", error);
    res.status(500).json({ message: "Error al obtener los turnos por productor", error: "Error al obtener los turnos por productor" });
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

    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const batch = db.batch(); let writes = 0;
    const turnos = snapshot.docs.map(doc => {
      const raw = doc.data();
      const rawTipoStr = String(raw?.tipoTurno || "").toLowerCase().trim();
      const tipoNorm = rawTipoStr ? normalizeTipoTurno(rawTipoStr) : rawTipoStr;
      if (rawTipoStr && tipoNorm && tipoNorm !== rawTipoStr) {
        batch.update(doc.ref, { tipoTurno: tipoNorm });
        writes++;
        raw.tipoTurno = tipoNorm;
      }
      const vencidoUpdate = applyVencidoIfNeeded(raw, hoy);
      if (vencidoUpdate) {
        batch.update(doc.ref, vencidoUpdate);
        writes++;
      }
      return { id: doc.id, ...convertirTimestamps({ ...raw, motivo: raw.motivo || "-" }) };
    });
    if (writes > 0) await batch.commit();

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

    const ymd = toYmdUtc(new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0, 0)));
    const capacidadDia = await resolveCapacidadDia(ymd);
    const turnosDia = await countTurnosActivosEnDia(ymd);
    if (turnosDia >= capacidadDia) {
      return res.json({ disponible: false, motivo: "No hay cupos disponibles para esa fecha." });
    }

    if (normalizeTipoTurno(tipoTurno) === "insumo") {
      if (ipt) {
        try {
          const psnap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
          if (!psnap.empty) {
            const productorId = psnap.docs[0].id;
            const disp = await getDisponibilidadInsumos(productorId);
            if (!disp?.tieneDisponible) {
              return res.json({ disponible: false, motivo: "Usted no tiene insumos disponibles." });
            }
          }
        } catch {}
      }
    }

    return res.json({ disponible: true });
  } catch (error) {
    console.error("❌ Error en disponibilidadTurno:", error);
    return res.status(500).json({ message: "Error de disponibilidad" });
  }
};

export const obtenerConfigTurnos = async (req, res) => {
  try {
    const cfg = await getTurnosConfig();
    return res.json(cfg);
  } catch (error) {
    console.error("Error al obtener configuración de turnos:", error);
    return res.status(500).json({ message: "Error al obtener configuración" });
  }
};

export const upsertConfigTurnos = async (req, res) => {
  try {
    const habilitadoRaw = req.body?.habilitado;
    if (typeof habilitadoRaw !== "boolean") {
      return res.status(400).json({ message: "Campo 'habilitado' inválido. Debe ser boolean." });
    }
    const mensaje = String(req.body?.mensaje || "").trim();
    const payload = {
      habilitado: habilitadoRaw,
      mensaje,
      updatedAt: Timestamp.now(),
    };
    await db.collection(TURNOS_CONFIG_COLLECTION).doc(TURNOS_CONFIG_DOC).set(payload, { merge: true });
    return res.json({ message: "Configuración guardada", ...payload });
  } catch (error) {
    console.error("Error al guardar configuración de turnos:", error);
    return res.status(500).json({ message: "Error al guardar configuración" });
  }
};

export const obtenerCapacidadTurnoDia = async (req, res) => {
  try {
    const { fecha } = req.query;
    const ymd = String(fecha || "").trim();
    if (!isValidYmd(ymd)) {
      return res.status(400).json({ message: "Parámetro 'fecha' inválido (YYYY-MM-DD)" });
    }
    const snap = await db.collection(TURNOS_CAPACIDAD_COLLECTION).doc(ymd).get();
    if (!snap.exists) {
      return res.json({ fecha: ymd, capacidad: DEFAULT_TURNOS_CAPACIDAD_DIA, configurada: false });
    }
    const raw = snap.data() || {};
    const capacidad = Number(raw.capacidad);
    return res.json({
      fecha: ymd,
      capacidad: Number.isFinite(capacidad) ? capacidad : DEFAULT_TURNOS_CAPACIDAD_DIA,
      configurada: true,
    });
  } catch (error) {
    console.error("Error al obtener capacidad de turnos:", error);
    return res.status(500).json({ message: "Error al obtener capacidad" });
  }
};

export const upsertCapacidadTurnoDia = async (req, res) => {
  try {
    const { fecha } = req.params;
    const ymd = String(fecha || "").trim();
    if (!isValidYmd(ymd)) {
      return res.status(400).json({ message: "Parámetro 'fecha' inválido (YYYY-MM-DD)" });
    }
    const capacidadRaw = req.body?.capacidad;
    const capacidad = Number(capacidadRaw);
    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      return res.status(400).json({ message: "Capacidad inválida. Debe ser un número mayor a 0." });
    }
    const ref = db.collection(TURNOS_CAPACIDAD_COLLECTION).doc(ymd);
    const snap = await ref.get();
    const payload = {
      fecha: ymd,
      capacidad,
      updatedAt: Timestamp.now(),
      ...(snap.exists ? {} : { createdAt: Timestamp.now() }),
    };
    await ref.set(payload, { merge: true });
    return res.json({ message: "Capacidad guardada", fecha: ymd, capacidad });
  } catch (error) {
    console.error("Error al guardar capacidad de turnos:", error);
    return res.status(500).json({ message: "Error al guardar capacidad" });
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
