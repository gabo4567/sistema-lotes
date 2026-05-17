// src/controllers/turnos.controller.js

import { admin, db } from "../utils/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import { getDisponibilidadInsumos } from "./insumos.controller.js";
import { isTurnosHabilitados, getArgentinaHolidayLabel } from "../utils/turnos.utils.js";
import {
  registrarAuditoriaTurno,
  buildRealizadoPor,
  buildOrigen,
} from "../services/auditoriaTurnos.service.js";
import { sendExpoPush } from "../utils/expoPush.js";

const DEFAULT_TURNOS_CAPACIDAD_DIA = 50;
const TURNOS_CAPACIDAD_COLLECTION = "turnosCapacidad";
const TURNOS_CONFIG_COLLECTION = "config";
const TURNOS_CONFIG_DOC = "turnos";
const DEFAULT_TURNOS_HABILITADO = true;
const DEFAULT_REQUIERE_LOTE_ARADO = true;
const HORA_APERTURA = 7;
const HORA_CIERRE = 13;
const IPT_TIMEZONE = "America/Argentina/Buenos_Aires";

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

const temporadaFromDate = (date) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const start = m >= 7 ? y : y - 1;
  return `${start}-${start + 1}`;
};

const temporadaFromYmd = (ymd) => {
  const m = String(ymd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const start = month >= 7 ? y : y - 1;
  return `${start}-${start + 1}`;
};

const temporadaStartYear = (temporada) => {
  const m = String(temporada || "").trim().match(/^(\d{4})-(\d{4})$/);
  return m ? Number(m[1]) : null;
};

const getTemporadaActual = () => temporadaFromYmd(toYmdInIptTz(new Date())) || temporadaFromDate(new Date());

const getTurnoTemporada = (turno) => {
  const stored = String(turno?.temporada || "").trim();
  if (/^\d{4}-\d{4}$/.test(stored)) return stored;
  return temporadaFromDate(turnoDateFromRaw(turno));
};

const isTemporadaAnterior = (temporada, temporadaActual) => {
  const start = temporadaStartYear(temporada);
  const currentStart = temporadaStartYear(temporadaActual);
  if (start == null || currentStart == null) return false;
  return start < currentStart;
};

const normalizeTipoTurno = (t) => {
  const s = String(t || "").toLowerCase().trim();
  if (!s) return s;
  if (s === "otra" || s === "otros") return "otro";
  if (s.includes("insum")) return "insumo";
  if (s.includes("renov") || s.includes("carnet")) return "carnet";
  return "otro";
};

const normalizeMotivoTurno = (tipoTurno, motivo) => {
  return normalizeTipoTurno(tipoTurno) === "otro" ? String(motivo || "").trim() : "";
};

const normalizeRole = (r) =>
  String(r || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const normalizeCategoriaInsumo = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const CATEGORIAS_INSUMO_REQUIEREN_LOTE_ARADO = new Set(["almacigo", "transplante"]);
const MENSAJE_LOTE_ARADO_REQUERIDO =
  "Para solicitar turno de Almácigo o Transplante, primero marcá un lote como tierra arada.";

const INASISTENCIAS_PARA_ADVERTENCIA = 1;
const INASISTENCIAS_PARA_BLOQUEO = 2;
const INASISTENCIAS_PARA_RESTRICCION = 3;
const DIAS_BLOQUEO_INASISTENCIA = 30;

const isRequisitoLoteAradoActivo = (config) =>
  typeof config?.requiereLoteArado === "boolean" ? config.requiereLoteArado : DEFAULT_REQUIERE_LOTE_ARADO;

const disponibilidadRequiereLoteArado = (disp, categoriaInsumo, config) => {
  if (!isRequisitoLoteAradoActivo(config)) return false;
  const categoriaSolicitada = normalizeCategoriaInsumo(categoriaInsumo);
  if (categoriaSolicitada) {
    return CATEGORIAS_INSUMO_REQUIEREN_LOTE_ARADO.has(categoriaSolicitada);
  }

  const porCategoria = disp?.porCategoria && typeof disp.porCategoria === "object" ? disp.porCategoria : {};
  return Object.entries(porCategoria).some(([categoria, info]) => {
    const disponible = Number(info?.disponible || 0);
    return disponible > 0 && CATEGORIAS_INSUMO_REQUIEREN_LOTE_ARADO.has(normalizeCategoriaInsumo(categoria));
  });
};

const productorTieneLoteArado = async ({ productorId, ipt }) => {
  const iptNorm = String(ipt || "").trim();
  if (!iptNorm) return false;

  const snap = await db.collection("lotes").where("ipt", "==", iptNorm).where("activo", "==", true).get();
  const seen = new Set();
  return snap.docs.some((doc) => {
    if (seen.has(doc.id)) return false;
    seen.add(doc.id);
    const lote = doc.data() || {};
    return lote.activo !== false && lote.loteArado === true;
  });
};

const isAdminRequest = (req) => {
  const role = normalizeRole(req?.user?.role);
  return role === "administrador" || role === "admin";
};

const getAuthOwnershipIds = (req) => {
  const ids = new Set();
  const uid = req?.user?.uid;
  if (uid) ids.add(String(uid));
  const claimIpt = req?.user?.firebaseClaims?.ipt;
  if (claimIpt) ids.add(String(claimIpt));
  return ids;
};

const canModifyTurno = (req, turno) => {
  if (isAdminRequest(req)) return true;
  const ids = getAuthOwnershipIds(req);
  const pid = String(turno?.productorId || "");
  const ipt = String(turno?.ipt || "");
  return Boolean((ipt && ids.has(ipt)) || (pid && ids.has(pid)));
};

const normalizeIpt = (value) => String(value || "").trim();

const resolveProductorByIdentifier = async (identifier) => {
  const ipt = normalizeIpt(identifier);
  if (!ipt) return null;
  const snap = await db.collection("productores").where("ipt", "==", ipt).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    return { id: doc.id, ref: doc.ref, data: doc.data() || {}, ipt };
  }
  return null;
};

const resolveProductorForRequest = async (req, bodyIpt) => {
  const identifiers = [
    bodyIpt,
    req?.user?.firebaseClaims?.ipt,
    req?.user?.uid,
  ];
  for (const identifier of identifiers) {
    const productor = await resolveProductorByIdentifier(identifier);
    if (productor) return productor;
  }
  return null;
};

const collectTurnoDocsForProductor = async ({ ipt }) => {
  const iptNorm = normalizeIpt(ipt);
  if (!iptNorm) return [];
  const snaps = await Promise.all([
    db.collection("turnos").where("ipt", "==", iptNorm).get(),
    db.collection("turnos").where("productorId", "==", iptNorm).get(),
  ]);
  const seen = new Set();
  return snaps.flatMap((snap) => snap.docs).filter((doc) => {
    if (seen.has(doc.id)) return false;
    seen.add(doc.id);
    return true;
  });
};

const addDaysToYmd = (ymd, days) => {
  const m = String(ymd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(days || 0), 12, 0, 0, 0));
  return toYmdInIptTz(d);
};

const isRestriccionTurnosBloqueante = (productor) => {
  const r = productor?.restriccionTurnos;
  if (!r || r.activa !== true) return null;
  const tipo = String(r.tipo || "").trim();
  const hoy = toYmdInIptTz(new Date());
  const hasta = String(r.hasta || "").trim();
  if (tipo === "bloqueo_temporal" && hasta && hoy && hoy <= hasta) return r;
  if (tipo === "restriccion_automatica") return r;
  return null;
};

const buildEstadoInasistenciaProductor = ({ total, temporada, hoyYmd }) => {
  const inasistenciasTurnos = { temporada, total, updatedAt: Timestamp.now() };

  if (total >= INASISTENCIAS_PARA_RESTRICCION) {
    return {
      inasistenciasTurnos,
      advertenciaTurnos: {
        activa: true,
        motivo: `Registra ${total} inasistencias en la temporada ${temporada}.`,
        updatedAt: Timestamp.now(),
      },
      restriccionTurnos: {
        activa: true,
        tipo: "restriccion_automatica",
        desde: hoyYmd,
        hasta: null,
        motivo: `RestricciÃ³n automÃ¡tica por ${total} inasistencias en la temporada ${temporada}.`,
        updatedAt: Timestamp.now(),
      },
    };
  }

  if (total >= INASISTENCIAS_PARA_BLOQUEO) {
    const hasta = addDaysToYmd(hoyYmd, DIAS_BLOQUEO_INASISTENCIA);
    return {
      inasistenciasTurnos,
      advertenciaTurnos: {
        activa: true,
        motivo: `Registra ${total} inasistencias en la temporada ${temporada}.`,
        updatedAt: Timestamp.now(),
      },
      restriccionTurnos: {
        activa: true,
        tipo: "bloqueo_temporal",
        desde: hoyYmd,
        hasta,
        motivo: `Bloqueo temporal por ${total} inasistencias en la temporada ${temporada}.`,
        updatedAt: Timestamp.now(),
      },
    };
  }

  if (total >= INASISTENCIAS_PARA_ADVERTENCIA) {
    return {
      inasistenciasTurnos,
      advertenciaTurnos: {
        activa: true,
        motivo: `Advertencia por ${total} inasistencia en la temporada ${temporada}.`,
        updatedAt: Timestamp.now(),
      },
      restriccionTurnos: admin.firestore.FieldValue.delete(),
    };
  }

  return {
    inasistenciasTurnos,
    advertenciaTurnos: admin.firestore.FieldValue.delete(),
    restriccionTurnos: admin.firestore.FieldValue.delete(),
  };
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

const turnoYmd = (turno) => {
  const d = turnoDateFromRaw(turno);
  return d ? toYmdUtc(d) : null;
};

const toYmdUtc = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toYmdInIptTz = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: IPT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(d);
  } catch {
    return null;
  }
};

const toHmInIptTz = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: IPT_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = fmt.formatToParts(d);
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return { hour, minute };
  } catch {
    return null;
  }
};

const isValidYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());

const normalizeYmdOrNull = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return isValidYmd(s) ? s : null;
};

const isWithinYmdRange = (ymd, desde, hasta) => {
  const d = normalizeYmdOrNull(desde);
  const h = normalizeYmdOrNull(hasta);
  const x = String(ymd || "").trim();
  if (!isValidYmd(x)) return true;
  if (d && x < d) return false;
  if (h && x > h) return false;
  return true;
};

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
    if (!snap.exists) return { modo: "manual", habilitado: DEFAULT_TURNOS_HABILITADO, mensaje: "", desde: null, hasta: null, rangoModo: null, requiereLoteArado: DEFAULT_REQUIERE_LOTE_ARADO };
    const raw = snap.data() || {};
    const habilitado = typeof raw.habilitado === "boolean" ? raw.habilitado : DEFAULT_TURNOS_HABILITADO;
    const requiereLoteArado = typeof raw.requiereLoteArado === "boolean" ? raw.requiereLoteArado : DEFAULT_REQUIERE_LOTE_ARADO;
    const mensaje = String(raw.mensaje || "").trim();
    const desde = normalizeYmdOrNull(raw.desde);
    const hasta = normalizeYmdOrNull(raw.hasta);
    const rangoModoRaw = raw.rangoModo;
    const rangoModoStr = String(rangoModoRaw ?? "").toLowerCase().trim();
    const rangoModo = !rangoModoStr ? null : (rangoModoStr === "disable" ? "disable" : "enable");
    const modoRaw = String(raw.modo || "").toLowerCase().trim();
    const hasRange = Boolean(desde || hasta);
    const modoInferred = hasRange ? "rango" : "manual";
    const modo = modoRaw === "manual" || modoRaw === "rango" ? modoRaw : modoInferred;
    if (modo === "manual") {
      return { modo: "manual", habilitado, mensaje, desde: null, hasta: null, rangoModo: null, requiereLoteArado };
    }
    return { modo: "rango", habilitado: null, mensaje, desde, hasta, rangoModo, requiereLoteArado };
  } catch {
    return { modo: "manual", habilitado: DEFAULT_TURNOS_HABILITADO, mensaje: "", desde: null, hasta: null, rangoModo: null, requiereLoteArado: DEFAULT_REQUIERE_LOTE_ARADO };
  }
};

const calcularEstadoTurnos = (config, hoyYmd) => {
  const modo = String(config?.modo || "").toLowerCase().trim();
  if (modo === "manual") {
    return config?.habilitado === true;
  }

  if (modo === "rango") {
    const desde = normalizeYmdOrNull(config?.desde);
    const hasta = normalizeYmdOrNull(config?.hasta);
    if (!desde || !hasta) return false;
    const hoy = String(hoyYmd || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy)) return false;
    const dentroDelRango = hoy >= desde && hoy <= hasta;
    const rangoModo = String(config?.rangoModo || "").toLowerCase().trim();
    if (rangoModo !== "enable" && rangoModo !== "disable") return false;
    if (rangoModo === "enable") return dentroDelRango;
    return !dentroDelRango;
  }

  return false;
};

const isTurnoExpired = (raw, now) => {
  const current = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const est = normalizeEstado(raw?.estado);
  if (est !== "pendiente" && est !== "confirmado") return false;
  const fecha = turnoDateFromRaw(raw);
  if (!fecha) return false;

  const turnoYmd = toYmdInIptTz(fecha);
  const nowYmd = toYmdInIptTz(current);
  if (!turnoYmd || !nowYmd) return false;

  if (turnoYmd < nowYmd) return true;

  if (est === "confirmado" && turnoYmd === nowYmd) {
    const hm = toHmInIptTz(current);
    if (!hm) return false;
    const mins = hm.hour * 60 + hm.minute;
    if (mins >= HORA_CIERRE * 60) return true;
  }

  return false;
};

const hasTurnoPendienteOConfirmadoDelTipo = (docs, tipoTurno, { excludeId } = {}) => {
  const tipo = normalizeTipoTurno(tipoTurno);
  return docs.some((d) => {
    if (excludeId && d.id === excludeId) return false;
    const other = d.data();
    const otherTipo = normalizeTipoTurno(other?.tipoTurno);
    if (otherTipo !== tipo) return false;
    if (isTurnoExpired(other, new Date())) return false;
    const st = normalizeEstado(other?.estado);
    return st === "pendiente" || st === "confirmado";
  });
};

const applyVencidoIfNeeded = (raw, now) => {
  if (!isTurnoExpired(raw, now)) return null;
  const motivoEstadoRaw = String(raw.motivoEstado || "").trim();
  const update = { estado: "vencido", updatedAt: Timestamp.now() };
  raw.estado = "vencido";
  if (!motivoEstadoRaw) {
    update.motivoEstado = "Vencido automáticamente por fecha";
    raw.motivoEstado = "Vencido automáticamente por fecha";
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
    const hoyYmd = toYmdInIptTz(new Date());
    const estadoActual = calcularEstadoTurnos(cfg, hoyYmd);
    if (!isTurnosHabilitados({ estadoActual })) {
      return res.status(403).json({ message: cfg.mensaje || "Turnos deshabilitados hasta nuevo aviso", estadoActual: false });
    }

    let { tipoTurno, fechaSolicitada, fecha, ipt, categoriaInsumo } = req.body;

    let productorId = req.user.uid;
    let productorNombre = "";
    
    // Si no hay IPT en el body, intentar obtenerlo de los claims de Firebase
    if (!ipt && req.user.firebaseClaims) {
      ipt = req.user.firebaseClaims.ipt;
    }

    // Validar que el productor existe y está activo
    const resolvedProductor = await resolveProductorForRequest(req, ipt);
    if (resolvedProductor) {
      ipt = normalizeIpt(resolvedProductor.ipt || ipt);
      productorId = ipt;
      productorNombre = resolvedProductor.data?.nombreCompleto || resolvedProductor.data?.nombre || "";
    }
    if (!resolvedProductor) {
      return res.status(403).json({ message: "Productor no encontrado.", estadoActual });
    }
    if (resolvedProductor.data?.activo === false) {
      return res.status(403).json({ message: "El productor no está activo.", estadoActual });
    }

    const restriccionBloqueante = isRestriccionTurnosBloqueante(resolvedProductor.data);
    if (restriccionBloqueante) {
      const hasta = restriccionBloqueante.hasta ? ` hasta el ${restriccionBloqueante.hasta}` : "";
      return res.status(403).json({
        message: `${restriccionBloqueante.motivo || "El productor tiene una restricciÃ³n activa para solicitar turnos."}${hasta}`,
        estadoActual,
        restriccionTurnos: restriccionBloqueante,
      });
    }

    // Normalizar tipoTurno
    let t = String(tipoTurno).toLowerCase().trim();

    // Diccionario de mapeo
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
    
    let tipoNormalizado = mapeoTipos[t];
    if (!tipoNormalizado) {
      if (t.includes('insumo')) tipoNormalizado = 'insumo';
      else if (t.includes('renovación') || t.includes('renovacion') || t.includes('renov') || t.includes('carnet')) {
        tipoNormalizado = 'carnet';
      } else {
        tipoNormalizado = 'otra';
      }
    }
    tipoTurno = normalizeTipoTurno(tipoNormalizado);

    const fechaFinal = fecha || fechaSolicitada;
    if (!fechaFinal) {
      return res.status(400).json({ message: "Fecha es requerida", estadoActual });
    }
    const ts = toTurnoTimestamp(fechaFinal);
    if (!ts) {
      return res.status(400).json({ message: "Fecha inválida", estadoActual });
    }
    const date = ts.toDate();

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const soloDia = new Date(date);
    soloDia.setHours(0, 0, 0, 0);
    if (soloDia.getTime() < hoy.getTime()) {
      return res.status(400).json({ message: "Fecha ya pasada", estadoActual });
    }
    if (soloDia.getTime() === hoy.getTime()) {
      const now = new Date();
      const hm = toHmInIptTz(now);
      const isPastClose = hm
        ? (hm.hour * 60 + hm.minute) >= HORA_CIERRE * 60
        : (() => {
            const cierreHoy = new Date();
            cierreHoy.setHours(HORA_CIERRE, 0, 0, 0);
            return now.getTime() >= cierreHoy.getTime();
          })();
      if (isPastClose) {
        return res
          .status(400)
          .json({
            message:
              `El horario de atención para hoy ya finalizó (${String(HORA_APERTURA).padStart(2, "0")}:00 a ${String(HORA_CIERRE).padStart(2, "0")}:00). Seleccioná otra fecha.`,
            estadoActual,
          });
      }
    }

    // No fines de semana
    const day = date.getDay();
    if (day === 0 || day === 6) {
      return res.status(400).json({ message: "No se permiten turnos sábado o domingo", estadoActual });
    }

    const feriadoLabelCrear = getArgentinaHolidayLabel(toYmdUtc(date));
    if (feriadoLabelCrear) {
      return res.status(400).json({ message: `No se permiten turnos en feriados nacionales (${feriadoLabelCrear}).`, estadoActual });
    }

    const motivoTrim = normalizeMotivoTurno(tipoTurno, req.body.motivo);
    if (tipoTurno === "otro" && !motivoTrim) {
      return res.status(400).json({ message: 'Si el tipo es "Otro", el motivo es obligatorio.', estadoActual });
    }

    const targetYmd = toYmdUtc(date);
    const capacidadDia = await resolveCapacidadDia(targetYmd);
    const turnosDia = await countTurnosActivosEnDia(targetYmd);
    if (turnosDia >= capacidadDia) {
      return res.status(400).json({ message: `No hay cupos disponibles para esa fecha. Capacidad: ${capacidadDia}.`, estadoActual });
    }
    if (targetYmd && productorId && tipoTurno) {
      const snapDup = {
        docs: (await collectTurnoDocsForProductor({ ipt }))
          .filter((doc) => (doc.data() || {}).activo !== false),
      };

      if (tipoTurno === "insumo") {
        if (hasTurnoPendienteOConfirmadoDelTipo(snapDup.docs, "insumo")) {
          return res.status(400).json({ message: "Ya tenés un turno de retiro de insumos pendiente o confirmado.", estadoActual });
        }
        const hasInsumoPendienteOConfirmado = snapDup.docs.some((d) => {
          const other = d.data();
          const otherTipo = normalizeTipoTurno(other?.tipoTurno);
          if (otherTipo !== "insumo") return false;
          if (isTurnoExpired(other, new Date())) return false;
          const st = normalizeEstado(other?.estado);
          return st === "pendiente" || st === "confirmado";
        });
        if (hasInsumoPendienteOConfirmado) {
          return res.status(400).json({ message: "Ya tenés un turno de insumos solicitado o confirmado.", estadoActual });
        }
      }

      if (tipoTurno === "carnet") {
        if (hasTurnoPendienteOConfirmadoDelTipo(snapDup.docs, "carnet")) {
          return res.status(400).json({ message: "Ya tenés un turno de renovación de carnet pendiente o confirmado.", estadoActual });
        }
        const hasCarnetPendienteOConfirmado = snapDup.docs.some((d) => {
          const other = d.data();
          const otherTipo = normalizeTipoTurno(other?.tipoTurno);
          if (otherTipo !== "carnet") return false;
          if (isTurnoExpired(other, new Date())) return false;
          const st = normalizeEstado(other?.estado);
          return st === "pendiente" || st === "confirmado";
        });
        if (hasCarnetPendienteOConfirmado) {
          return res.status(400).json({ message: "Ya tenés un turno de renovación de carnet solicitado o confirmado.", estadoActual });
        }

        const snapCarnetAll = {
          docs: snapDup.docs.filter((doc) => normalizeTipoTurno(doc.data()?.tipoTurno) === "carnet"),
        };

        let lastCarnet = null;
        let lastCarnetMs = null;
        snapCarnetAll.docs.forEach((d) => {
          const other = d.data();
          const dt = turnoDateFromRaw(other);
          const ms = dt instanceof Date && !isNaN(dt.getTime()) ? dt.getTime() : null;
          if (ms === null) return;
          if (lastCarnetMs === null || ms > lastCarnetMs) {
            lastCarnetMs = ms;
            lastCarnet = other;
          }
        });

        if (lastCarnet) {
          const lastEstado = isTurnoExpired(lastCarnet, new Date()) ? "vencido" : normalizeEstado(lastCarnet?.estado);
          if (lastEstado === "completado") {
            const toMs = (raw) => {
              if (!raw) return null;
              if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw.getTime() : null;
              if (typeof raw?.toDate === "function") {
                const d = raw.toDate();
                return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : null;
              }
              const secs = raw?._seconds ?? raw?.seconds;
              if (typeof secs === "number") return secs * 1000;
              if (typeof raw === "string") {
                const ms = Date.parse(raw);
                return Number.isFinite(ms) ? ms : null;
              }
              return null;
            };

            const completedAtMs = toMs(lastCarnet?.updatedAt) ?? toMs(lastCarnet?.fechaTurno) ?? toMs(lastCarnet?.fecha);
            if (completedAtMs !== null) {
              const allowAt = new Date(completedAtMs);
              allowAt.setFullYear(allowAt.getFullYear() + 1);
              if (Date.now() < allowAt.getTime()) {
                return res.status(400).json({
                  message: "No podés solicitar un nuevo turno de renovación de carnet hasta que haya pasado 1 año desde la última renovación completada.",
                  estadoActual,
                });
              }
            }
          }
        }
      }

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
        return res.status(400).json({ message: "Ya tenés un turno del mismo tipo para esa fecha. Elegí otra fecha o un tipo diferente.", estadoActual });
      }
    }

    // Si es turno de insumo → verificar asignaciones en ProductorInsumos
    if (tipoTurno === "insumo") {
      const CATEGORIAS_INSUMO = ["Arada", "Almácigo", "Transplante", "Cosecha"];
      if (categoriaInsumo !== undefined && categoriaInsumo !== null && categoriaInsumo !== "") {
        const cat = String(categoriaInsumo).trim();
        if (!CATEGORIAS_INSUMO.includes(cat)) {
          return res.status(400).json({ message: `Categoría de insumo inválida. Opciones: ${CATEGORIAS_INSUMO.join(", ")}.`, estadoActual });
        }
        categoriaInsumo = cat;
      } else {
        categoriaInsumo = null;
      }
      const disp = await getDisponibilidadInsumos(ipt);
      if (!disp?.tieneDisponible) {
        return res.status(400).json({ message: "Usted no tiene insumos disponibles.", estadoActual });
      }
      if (disponibilidadRequiereLoteArado(disp, categoriaInsumo, cfg)) {
        const tieneLoteArado = await productorTieneLoteArado({ productorId, ipt });
        if (!tieneLoteArado) {
          return res.status(400).json({ message: MENSAJE_LOTE_ARADO_REQUERIDO, estadoActual });
        }
      }
      // Si se especificó categoría, verificar que esa categoría tiene stock disponible
      if (categoriaInsumo) {
        const insumoSnap = await db.collection("insumos").where("nombre", "==", categoriaInsumo).limit(1).get();
        if (!insumoSnap.empty) {
          const insumoId = insumoSnap.docs[0].id;
          const asigSnap = await db.collection("productorInsumos")
            .where("productorId", "==", String(ipt))
            .where("insumoId", "==", insumoId)
            .get();
          const tieneCategoria = asigSnap.docs.some((d) => {
            const r = d.data() || {};
            if (r.activo === false) return false;
            const asig = Number(r.cantidadAsignada || 0);
            const ent = Number(r.cantidadEntregada || 0);
            return asig > 0 && (asig - ent) > 0;
          });
          if (!tieneCategoria) {
            return res.status(400).json({ message: `No tenés insumos disponibles de la categoría "${categoriaInsumo}".`, estadoActual });
          }
        }
      }
    }

    const fechaIso = date.toISOString();
    const temporada = temporadaFromDate(date);
    const turno = {
      productorId,
      ipt,
      productorNombre,
      tipoTurno,
      fecha: fechaIso,
      fechaTurno: ts,
      temporada,
      estado: "pendiente",
      creadoEn: new Date().toISOString(),
      updatedAt: Timestamp.now(),
      activo: true,
      motivo: motivoTrim,
      ...(tipoTurno === "insumo" && categoriaInsumo ? { categoriaInsumo } : {}),
    };

    const docRef = await db.collection("turnos").add(turno);

    registrarAuditoriaTurno({
      turnoId: docRef.id,
      accion: "turno_creado",
      estadoAnterior: null,
      estadoNuevo: "pendiente",
      motivo: motivoTrim || null,
      realizadoPor: buildRealizadoPor(req),
      origen: buildOrigen(req),
      automatico: false,
    });

    return res.json({ message: "Turno creado exitosamente", turno: { id: docRef.id, ...convertirTimestamps(turno) }, estadoActual: true });

  } catch (error) {
    console.error("Error en crearTurno:", error);
    return res.status(500).json({ message: "Error al crear el turno", estadoActual: null });
  }
};


// 📋 Obtener todos los turnos (con filtros de activo/inactivo y paginación)
export const registrarAsistenciaTurno = async (req, res) => {
  try {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ message: "Solo administradores pueden registrar asistencia." });
    }

    const ipt = normalizeIpt(req.body?.ipt);
    const fecha = normalizeYmdOrNull(req.body?.fecha);
    const fuente = String(req.body?.fuente || "manual").trim().toLowerCase() || "manual";
    const rawAsistio = req.body?.asistio;
    const asistio =
      typeof rawAsistio === "boolean"
        ? rawAsistio
        : ["true", "1", "si", "sÃ­", "yes", "y"].includes(String(rawAsistio ?? "").toLowerCase().trim());

    if (!ipt) return res.status(400).json({ message: "El IPT es obligatorio." });
    if (!fecha) return res.status(400).json({ message: "La fecha es obligatoria en formato YYYY-MM-DD." });

    const hoyYmd = toYmdInIptTz(new Date());
    if (hoyYmd && fecha > hoyYmd) {
      return res.status(400).json({ message: "No se puede registrar asistencia de una fecha futura." });
    }

    const productor = await resolveProductorByIdentifier(ipt);
    if (!productor) return res.status(404).json({ message: "Productor no encontrado." });
    if (productor.data?.activo === false) {
      return res.status(403).json({ message: "El productor no estÃ¡ activo." });
    }

    const docs = await collectTurnoDocsForProductor({ ipt });
    const turnosDelDia = docs.filter((doc) => {
      const t = doc.data() || {};
      if (t.activo === false) return false;
      if (turnoYmd(t) !== fecha) return false;
      return normalizeEstado(t.estado) !== "cancelado";
    });

    if (turnosDelDia.length === 0) {
      return res.status(404).json({ message: "No se encontrÃ³ un turno activo para ese IPT y fecha." });
    }

    const nuevoEstado = asistio ? "completado" : "ausente";
    const nowTs = Timestamp.now();
    const batch = db.batch();
    const updatedIds = [];

    for (const doc of turnosDelDia) {
      const current = doc.data() || {};
      const update = {
        estado: nuevoEstado,
        asistio,
        asistenciaFuente: fuente,
        asistenciaRegistradaAt: nowTs,
        updatedAt: nowTs,
      };
      if (!asistio) {
        update.motivoEstado = "Inasistencia registrada por control de asistencia";
      }
      batch.update(doc.ref, update);
      updatedIds.push(doc.id);

      registrarAuditoriaTurno({
        turnoId: doc.id,
        accion: "asistencia_registrada",
        estadoAnterior: normalizeEstado(current.estado),
        estadoNuevo: nuevoEstado,
        motivo: asistio ? "Asistencia registrada" : "Inasistencia registrada",
        realizadoPor: buildRealizadoPor(req),
        origen: { ...buildOrigen(req), fuente },
        automatico: false,
      });
    }

    await batch.commit();

    const temporadaActual = getTemporadaActual();
    const docsActualizados = await collectTurnoDocsForProductor({ ipt });
    const ausentesTemporada = docsActualizados.filter((doc) => {
      const t = doc.data() || {};
      if (t.activo === false) return false;
      if (normalizeEstado(t.estado) !== "ausente") return false;
      return getTurnoTemporada(t) === temporadaActual;
    }).length;

    const estadoProductor = buildEstadoInasistenciaProductor({
      total: ausentesTemporada,
      temporada: temporadaActual,
      hoyYmd,
    });
    await productor.ref.set(estadoProductor, { merge: true });

    return res.json({
      message: asistio ? "Asistencia registrada." : "Inasistencia registrada.",
      ipt,
      fecha,
      asistio,
      turnosActualizados: updatedIds,
      inasistenciasTemporada: ausentesTemporada,
      advertenciaTurnos: estadoProductor.advertenciaTurnos?.activa ? estadoProductor.advertenciaTurnos : null,
      restriccionTurnos: estadoProductor.restriccionTurnos?.activa ? estadoProductor.restriccionTurnos : null,
    });
  } catch (error) {
    console.error("Error al registrar asistencia:", error);
    return res.status(500).json({ message: "Error al registrar asistencia" });
  }
};

export const obtenerTurnos = async (req, res) => {
  try {
    const { activo, fechaDesde, fechaHasta, limit: limitParam } = req.query;
    const limit = Math.min(Math.max(1, Number(limitParam) || 300), 1000);
    const desde = normalizeYmdOrNull(fechaDesde);
    const hasta = normalizeYmdOrNull(fechaHasta);

    const temporadaActual = getTemporadaActual();
    const activoParam = activo === undefined ? undefined : activo === "true";
    let query = db.collection("turnos");
    if (activoParam === true) {
      query = query.where("activo", "==", activo === "true");
    }

    const snapshot = await query.get();
    const now = new Date();
    const batch = db.batch(); let writes = 0;
    const vencidoAudits = [];
    const raws = snapshot.docs
      .map(doc => ({ id: doc.id, ref: doc.ref, data: doc.data() }))
      .filter(({ data }) => {
        const temporada = getTurnoTemporada(data);
        if (activoParam === true) {
          if (data.activo === false) return false;
          if (temporada && temporadaActual && temporada !== temporadaActual) return false;
        } else if (activoParam === false) {
          const archivadoManual = data.activo === false;
          const archivadoPorTemporada = temporada && temporadaActual && isTemporadaAnterior(temporada, temporadaActual);
          if (!archivadoManual && !archivadoPorTemporada) return false;
        }
        if (!desde && !hasta) return true;
        const ymd = toYmdUtc(turnoDateFromRaw(data));
        if (!ymd) return true;
        if (desde && ymd < desde) return false;
        if (hasta && ymd > hasta) return false;
        return true;
      });
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
      const temporada = getTurnoTemporada(raw);
      if (temporada && raw.temporada !== temporada) {
        batch.update(ref, { temporada });
        writes++;
        raw.temporada = temporada;
      }
      const prevEstado = normalizeEstado(raw.estado);
      const vencidoUpdate = applyVencidoIfNeeded(raw, now);
      if (vencidoUpdate) {
        batch.update(ref, vencidoUpdate);
        writes++;
        vencidoAudits.push({ turnoId: id, prevEstado });
      }
      return { id, ref, ...convertirTimestamps(raw) };
    });
    if (writes > 0) {
      await batch.commit();
      if (vencidoAudits.length > 0) {
        Promise.allSettled(
          vencidoAudits.map(({ turnoId, prevEstado }) =>
            registrarAuditoriaTurno({
              turnoId,
              accion: "estado_cambiado",
              estadoAnterior: prevEstado,
              estadoNuevo: "vencido",
              motivo: "Vencido automáticamente por fecha",
              realizadoPor: { uid: "sistema", nombre: "Sistema", rol: "sistema" },
              origen: { tipo: "backend", dispositivo: null },
              automatico: true,
            })
          )
        );
      }
    }

    // Enriquecer con nombre e IPT del productor
    const prodInfo = new Map();
    const ids = Array.from(new Set(turnos.map(t => String(t.productorId || '')))).filter(Boolean);
    for (const pid of ids) {
      try {
        const productor = await resolveProductorByIdentifier(pid);
        if (productor) {
          const pd = productor.data || {};
          prodInfo.set(pid, { nombre: pd.nombreCompleto || pd.nombre || '', ipt: String(productor.ipt || pd.ipt || '') });
          continue;
        }
      } catch {}
    }
    const enriched = turnos
      .map(t => {
        const temporada = getTurnoTemporada(t);
        return {
          ...t,
          temporada,
          archivadoPorTemporada: Boolean(temporada && temporadaActual && isTemporadaAnterior(temporada, temporadaActual)),
          productorNombre: t.productorNombre || prodInfo.get(String(t.productorId || ''))?.nombre || '',
          ipt: t.ipt || prodInfo.get(String(t.productorId || ''))?.ipt || '',
          motivo: t.motivo || '-',
        };
      })
      .slice(0, limit);

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
    const vencidoUpdate = applyVencidoIfNeeded(raw, new Date());
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
    const now = new Date();
    const hoy = new Date(now); hoy.setHours(0,0,0,0);
    const vencidoUpdate = applyVencidoIfNeeded(current, now);
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
      data.temporada = temporadaFromDate(d);
      const soloDia = new Date(d);
      soloDia.setHours(0, 0, 0, 0);
      if (soloDia.getTime() < hoy.getTime()) {
        return res.status(400).json({ message: "Fecha ya pasada" });
      }
      const dow = d.getDay();
      if (dow === 0 || dow === 6) {
        return res.status(400).json({ message: "No se permiten turnos sábado o domingo" });
      }
      const feriadoLabelEditar = getArgentinaHolidayLabel(toYmdUtc(d));
      if (feriadoLabelEditar) {
        return res.status(400).json({ message: `No se permiten turnos en feriados nacionales (${feriadoLabelEditar}).` });
      }
    }

    if (data.tipoTurno !== undefined) {
      data.tipoTurno = normalizeTipoTurno(data.tipoTurno);
    }
    const nextTipo = normalizeTipoTurno(data.tipoTurno ?? current.tipoTurno);
    const nextMotivo = normalizeMotivoTurno(
      nextTipo,
      Object.prototype.hasOwnProperty.call(data, "motivo") ? data.motivo : current.motivo
    );
    if (nextTipo === "otro" && !String(nextMotivo || "").trim()) {
      return res.status(400).json({ message: 'Si el tipo es "Otro", el motivo es obligatorio.' });
    }
    data.motivo = nextMotivo;

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
      if (nextTipo === "insumo" && hasTurnoPendienteOConfirmadoDelTipo(snapDup.docs, "insumo", { excludeId: id })) {
        return res.status(400).json({ message: "Ya tenés un turno de retiro de insumos pendiente o confirmado." });
      }
      if (nextTipo === "carnet" && hasTurnoPendienteOConfirmadoDelTipo(snapDup.docs, "carnet", { excludeId: id })) {
        return res.status(400).json({ message: "Ya tenés un turno de renovación de carnet pendiente o confirmado." });
      }
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

    registrarAuditoriaTurno({
      turnoId: id,
      accion: "turno_actualizado",
      estadoAnterior: normalizeEstado(current.estado),
      estadoNuevo: normalizeEstado(current.estado),
      motivo: data.motivo || null,
      realizadoPor: buildRealizadoPor(req),
      origen: buildOrigen(req),
      automatico: false,
    });

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
    let { estado } = req.body;
    const motivoEstado = String(req.body?.motivoEstado ?? req.body?.motivo ?? "").trim();
    const mapEstados = {
      Solicitado: "pendiente",
      Aprobado: "confirmado",
      Cancelado: "cancelado",
      Vencido: "vencido",
    };
    estado = mapEstados[estado] || estado;

    const parseBool = (v) => {
      if (typeof v === "boolean") return v;
      const s = String(v ?? "").toLowerCase().trim();
      if (s === "true" || s === "1" || s === "yes" || s === "y" || s === "si" || s === "sí" || s === "on") return true;
      if (s === "false" || s === "0" || s === "no" || s === "n" || s === "off") return false;
      return false;
    };
    const force = parseBool(req.body?.force) || parseBool(req.body?.confirm);

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
    const vencidoUpdate = applyVencidoIfNeeded(current, new Date());

    const from = normalizeEstado(current?.estado);
    const to = normalizeEstado(estado);
    const allowTransition = (from === "vencido" && to === "completado") || canTransitionEstado(from, to);
    if (!allowTransition) {
      return res.status(400).json({ message: `Transición de estado no permitida: ${from} -> ${to}` });
    }

    if (to === "completado") {
      const now = new Date();
      const nowYmd = toYmdInIptTz(now);
      const turnoDate = turnoDateFromRaw(current);
      const turnoYmd = turnoDate ? toYmdInIptTz(turnoDate) : null;
      if (turnoYmd && nowYmd) {
        if (turnoYmd > nowYmd) {
          return res.status(400).json({ message: "No se puede completar un turno futuro." });
        }
        if (turnoYmd < nowYmd) {
          if (!force) {
            return res.status(409).json({
              message: "Estás completando un turno de un día pasado. Confirmá para completar igualmente.",
              requiresConfirmation: true,
              reason: "past_turno",
            });
          }
        } else {
          const hm = toHmInIptTz(now);
          if (!hm) {
            if (!force) {
              return res.status(409).json({
                message: "No se pudo validar el horario actual. Confirmá para completar igualmente.",
                requiresConfirmation: true,
                reason: "unknown_time",
              });
            }
          } else {
            const mins = hm.hour * 60 + hm.minute;
            const inHours = mins >= HORA_APERTURA * 60 && mins <= HORA_CIERRE * 60;
            if (!inHours && !force) {
              return res.status(409).json({
                message: `Estás fuera del horario de atención (${String(HORA_APERTURA).padStart(2, "0")}:00–${String(HORA_CIERRE).padStart(2, "0")}:00). Confirmá para completar igualmente.`,
                requiresConfirmation: true,
                reason: "out_of_hours",
              });
            }
          }
        }
      } else if (!force) {
        return res.status(409).json({
          message: "No se pudo validar la fecha del turno. Confirmá para completar igualmente.",
          requiresConfirmation: true,
          reason: "unknown_date",
        });
      }
    } else if (vencidoUpdate) {
      await ref.update(vencidoUpdate);
      return res.status(400).json({ message: "El turno está vencido y no puede cambiar de estado" });
    }

    const update = { estado: to, updatedAt: Timestamp.now() };
    if (motivoEstado) {
      update.motivoEstado = motivoEstado;
    }
    await ref.update(update);

    registrarAuditoriaTurno({
      turnoId: id,
      accion: "estado_cambiado",
      estadoAnterior: from,
      estadoNuevo: to,
      motivo: motivoEstado || null,
      realizadoPor: buildRealizadoPor(req),
      origen: buildOrigen(req),
      automatico: false,
    });

    // Notificación push al productor cuando admin confirma, cancela o completa
    if (to === "confirmado" || to === "cancelado" || to === "completado") {
      try {
        const prodSnap = await db.collection("productores").where("ipt", "==", String(current.ipt || current.productorId || "")).limit(1).get();
        const prodData = !prodSnap.empty ? (prodSnap.docs[0].data() || {}) : {};
        const expoTokens = [
          ...(Array.isArray(prodData.expoPushTokens) ? prodData.expoPushTokens : []),
          ...(Array.isArray(prodData.pushTokens) ? prodData.pushTokens : []),
          ...(Array.isArray(prodData.fcmTokens) ? prodData.fcmTokens : []),
        ]
          .map((t) => String(t || "").trim())
          .filter((t) => t.startsWith("ExponentPushToken"));

        if (expoTokens.length > 0) {
          const turnoDate = turnoDateFromRaw(current);
          const turnoYmd = turnoDate ? toYmdInIptTz(turnoDate) : null;
          const fechaFmt = turnoYmd ? turnoYmd.split("-").reverse().join("/") : "fecha desconocida";
          const notifTitle =
            to === "confirmado" ? "Turno confirmado" :
            to === "cancelado"  ? "Turno cancelado"  : "Turno completado";
          const notifBody =
            to === "confirmado" ? `Tu turno del ${fechaFmt} fue confirmado.` :
            to === "cancelado"  ? `Tu turno del ${fechaFmt} fue cancelado${motivoEstado ? `: ${motivoEstado}` : "."}` :
            `Tu turno del ${fechaFmt} fue completado. ¡Gracias!`;

          await sendExpoPush(
            Array.from(new Set(expoTokens)),
            notifTitle,
            notifBody,
            { event: "turno_estado", turnoId: id, estado: to }
          );
        }
      } catch (e) {
        console.error("Error enviando notificación push de turno:", e?.message || e);
      }
    }

    // Si se confirma/completa turno de insumo → marcar entrega de la categoría correspondiente
    try {
      const turno = current;
      if (turno?.tipoTurno === "insumo" && (estado === "confirmado" || estado === "completado")) {
        const now = new Date();
        let entregaRef = null;
        let entregaData = null;

        if (turno.categoriaInsumo) {
          // Ruta preferida: buscar la asignación que corresponde a la categoría del turno
          const insumoSnap = await db.collection("insumos")
            .where("nombre", "==", String(turno.categoriaInsumo))
            .limit(1)
            .get();
          if (!insumoSnap.empty) {
            const insumoId = insumoSnap.docs[0].id;
            const asigSnap = await db.collection("productorInsumos")
              .where("productorId", "==", String(turno.productorId))
              .where("insumoId", "==", insumoId)
              .where("estado", "==", "pendiente")
              .get();
            for (const d of asigSnap.docs) {
              const r = d.data() || {};
              const asig = Number(r.cantidadAsignada || 0);
              const ent = Number.isFinite(Number(r.cantidadEntregada)) ? Number(r.cantidadEntregada) : 0;
              if (asig > 0 && (asig - ent) > 0) {
                entregaRef = d.ref;
                entregaData = { asig, ent, raw: r };
                break;
              }
            }
          }
        } else {
          // Fallback: si no hay categoría, aplicar solo cuando hay exactamente 1 pendiente
          const snap = await db.collection("productorInsumos")
            .where("productorId", "==", String(turno.productorId))
            .where("estado", "==", "pendiente")
            .get();
          const pendientes = snap.docs
            .map((d) => {
              const r = d.data() || {};
              const asig = Number(r.cantidadAsignada || 0);
              const ent = Number.isFinite(Number(r.cantidadEntregada)) ? Number(r.cantidadEntregada)
                : (String(r.estado || "").toLowerCase() === "entregado" ? asig : 0);
              return { ref: d.ref, raw: r, asig, ent, disp: Math.max(0, asig - ent) };
            })
            .filter((x) => x.asig > 0 && x.disp > 0);
          if (pendientes.length === 1) {
            entregaRef = pendientes[0].ref;
            entregaData = { asig: pendientes[0].asig, ent: pendientes[0].ent, raw: pendientes[0].raw };
          }
        }

        if (entregaRef && entregaData) {
          const nuevaEntregada = entregaData.ent + (entregaData.asig - entregaData.ent);
          await entregaRef.update({
            cantidadAsignada: entregaData.asig,
            cantidadEntregada: nuevaEntregada,
            estado: "entregado",
            fechaEntrega: now,
            updatedAt: now,
            ...(entregaData.raw?.createdAt === undefined ? { createdAt: entregaData.raw?.fechaAsignacion || now } : {}),
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

    registrarAuditoriaTurno({
      turnoId: id,
      accion: "turno_archivado",
      estadoAnterior: normalizeEstado(turno.estado),
      estadoNuevo: null,
      motivo: null,
      realizadoPor: buildRealizadoPor(req),
      origen: buildOrigen(req),
      automatico: false,
    });

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
    const turnoRestaurado = doc.data();

    await db.collection("turnos").doc(id).update({
      activo: true,
      restauradoEn: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    registrarAuditoriaTurno({
      turnoId: id,
      accion: "turno_restaurado",
      estadoAnterior: null,
      estadoNuevo: normalizeEstado(turnoRestaurado?.estado),
      motivo: null,
      realizadoPor: buildRealizadoPor(req),
      origen: buildOrigen(req),
      automatico: false,
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

    const now = new Date();
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
      const vencidoUpdate = applyVencidoIfNeeded(raw, now);
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
    const temporadaActual = getTemporadaActual();
    const activoParam = activo === undefined ? undefined : activo === "true";
    
    const productor = await resolveProductorByIdentifier(productorId);
    const ipt = normalizeIpt(productor?.ipt || productorId);
    const docs = await collectTurnoDocsForProductor({
      ipt,
    });
    const snapshot = { docs };
    const now = new Date();
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
      const temporada = getTurnoTemporada(raw);
      if (temporada && raw.temporada !== temporada) {
        batch.update(doc.ref, { temporada });
        writes++;
        raw.temporada = temporada;
      }
      const vencidoUpdate = applyVencidoIfNeeded(raw, now);
      if (vencidoUpdate) {
        batch.update(doc.ref, vencidoUpdate);
        writes++;
      }
      return {
        id: doc.id,
        ...convertirTimestamps({
          ...raw,
          temporada,
          archivadoPorTemporada: Boolean(temporada && temporadaActual && isTemporadaAnterior(temporada, temporadaActual)),
          motivo: raw.motivo || '-',
        }),
      };
    }).filter((t) => {
      if (activoParam === true) {
        if (t.activo === false) return false;
        if (t.temporada && temporadaActual && t.temporada !== temporadaActual) return false;
      } else if (activoParam === false) {
        const archivadoManual = t.activo === false;
        const archivadoPorTemporada = t.temporada && temporadaActual && isTemporadaAnterior(t.temporada, temporadaActual);
        if (!archivadoManual && !archivadoPorTemporada) return false;
      }
      return true;
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

    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
      return res.status(400).json({ message: "Formato de fecha inválido" });
    }

    const snapshot = await db
      .collection("turnos")
      .where("fechaTurno", ">=", Timestamp.fromDate(inicio))
      .where("fechaTurno", "<=", Timestamp.fromDate(fin))
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "No se encontraron turnos en el rango especificado" });
    }

    const now = new Date();
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
      const vencidoUpdate = applyVencidoIfNeeded(raw, now);
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
    const cfg = await getTurnosConfig();
    const hoyYmd = toYmdInIptTz(new Date());
    const estadoActual = calcularEstadoTurnos(cfg, hoyYmd);
    if (!isTurnosHabilitados({ estadoActual })) {
      const motivo = cfg.mensaje || "Los turnos están deshabilitados";
      return res.json({ disponible: false, motivo, estadoActual: false });
    }

    const { fechaSolicitada, tipoTurno, ipt, categoriaInsumo } = req.query;
    if (!fechaSolicitada || !tipoTurno) {
      return res.status(400).json({ message: "Faltan parámetros", estadoActual: true });
    }

    const m = String(fechaSolicitada).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let fecha;
    if (m) {
      fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    } else {
      fecha = new Date(`${fechaSolicitada}T00:00:00.000Z`);
    }

    if (isNaN(fecha.getTime())) {
      return res.json({ disponible: false, motivo: "Fecha inválida", estadoActual: true });
    }

    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const soloDia = new Date(fecha);
    soloDia.setHours(0,0,0,0);

    if (soloDia.getTime() < hoy.getTime()) {
      return res.json({ disponible: false, motivo: "Fecha ya pasada", estadoActual: true });
    }
    
    const dow = fecha.getDay();
    if (dow === 0 || dow === 6) {
      return res.json({ disponible: false, motivo: "Fin de semana", estadoActual: true });
    }

    const ymd = toYmdUtc(new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0, 0)));
    const feriadoLabelDisp = getArgentinaHolidayLabel(ymd);
    if (feriadoLabelDisp) {
      return res.json({ disponible: false, motivo: `Feriado nacional: ${feriadoLabelDisp}`, estadoActual: true });
    }
    const capacidadDia = await resolveCapacidadDia(ymd);
    const turnosDia = await countTurnosActivosEnDia(ymd);
    if (turnosDia >= capacidadDia) {
      return res.json({ disponible: false, motivo: "No hay cupos disponibles para esa fecha.", estadoActual: true });
    }

    if (ipt) {
      try {
        const productor = await resolveProductorByIdentifier(ipt);
        const restriccion = productor ? isRestriccionTurnosBloqueante(productor.data) : null;
        if (restriccion) {
          const hasta = restriccion.hasta ? ` hasta el ${restriccion.hasta}` : "";
          return res.json({
            disponible: false,
            motivo: `${restriccion.motivo || "El productor tiene una restricciÃ³n activa para solicitar turnos."}${hasta}`,
            estadoActual: true,
            restriccionTurnos: restriccion,
          });
        }
      } catch {}
    }

    if (normalizeTipoTurno(tipoTurno) === "insumo") {
      if (ipt) {
        try {
          const psnap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
          if (!psnap.empty) {
            const productorId = String(ipt);
            const snapTurnos = await db
              .collection("turnos")
              .where("productorId", "==", String(productorId))
              .where("activo", "==", true)
              .get();
            if (hasTurnoPendienteOConfirmadoDelTipo(snapTurnos.docs, "insumo")) {
              return res.json({
                disponible: false,
                motivo: "Ya tenés un turno de retiro de insumos pendiente o confirmado.",
                estadoActual: true,
              });
            }
            const disp = await getDisponibilidadInsumos(ipt);
            if (!disp?.tieneDisponible) {
              return res.json({ disponible: false, motivo: "Usted no tiene insumos disponibles.", estadoActual: true });
            }
            if (disponibilidadRequiereLoteArado(disp, categoriaInsumo, cfg)) {
              const tieneLoteArado = await productorTieneLoteArado({ productorId, ipt });
              if (!tieneLoteArado) {
                return res.json({ disponible: false, motivo: MENSAJE_LOTE_ARADO_REQUERIDO, estadoActual: true });
              }
            }
            // Si se especificó categoría, verificar disponibilidad de esa categoría en particular
            if (categoriaInsumo) {
              const cat = String(categoriaInsumo).trim();
              const insumoSnap = await db.collection("insumos").where("nombre", "==", cat).limit(1).get();
              if (!insumoSnap.empty) {
                const insumoId = insumoSnap.docs[0].id;
                const asigSnap = await db.collection("productorInsumos")
                  .where("productorId", "==", String(productorId))
                  .where("insumoId", "==", insumoId)
                  .get();
                const tieneCategoria = asigSnap.docs.some((d) => {
                  const r = d.data() || {};
                  if (r.activo === false) return false;
                  const asig = Number(r.cantidadAsignada || 0);
                  const ent = Number(r.cantidadEntregada || 0);
                  return asig > 0 && (asig - ent) > 0;
                });
                if (!tieneCategoria) {
                  return res.json({ disponible: false, motivo: `No tenés insumos disponibles de la categoría "${cat}".`, estadoActual: true });
                }
              }
            }
          }
        } catch {}
      }
    }

    return res.json({ disponible: true, estadoActual: true });
  } catch (error) {
    console.error("❌ Error en disponibilidadTurno:", error);
    return res.status(500).json({ message: "Error de disponibilidad", estadoActual: null });
  }
};

export const obtenerConfigTurnos = async (req, res) => {
  try {
    const cfg = await getTurnosConfig();
    const hoyYmd = toYmdInIptTz(new Date());
    const estadoActual = calcularEstadoTurnos(cfg, hoyYmd);
    if (process.env.DEBUG_TURNOS === "true") {
      globalThis.console.log("CONFIG ACTUAL:", cfg);
      globalThis.console.log("ESTADO ACTUAL:", estadoActual);
    }
    return res.json({ ...cfg, estadoActual });
  } catch (error) {
    console.error("Error al obtener configuración de turnos:", error);
    return res.status(500).json({ message: "Error al obtener configuración", estadoActual: null });
  }
};

export const upsertConfigTurnos = async (req, res) => {
  try {
    const ref = db.collection(TURNOS_CONFIG_COLLECTION).doc(TURNOS_CONFIG_DOC);
    const prevSnap = await ref.get();
    const prevRaw = prevSnap.exists ? (prevSnap.data() || {}) : {};
    const prevHabilitado = typeof prevRaw.habilitado === "boolean" ? prevRaw.habilitado : DEFAULT_TURNOS_HABILITADO;

    const mensaje = String(req.body?.mensaje || "").trim();
    const prevRequiereLoteArado =
      typeof prevRaw.requiereLoteArado === "boolean" ? prevRaw.requiereLoteArado : DEFAULT_REQUIERE_LOTE_ARADO;
    const modoRaw = req.body?.modo;
    const modoStr = String(modoRaw ?? "").toLowerCase().trim();
    const modo = modoStr === "rango" ? "rango" : (modoStr === "manual" || !modoStr ? "manual" : null);
    if (!modo) {
      return res.status(400).json({ message: "Campo 'modo' inválido. Debe ser 'manual' o 'rango'." });
    }

    const parseBoolOrNull = (v) => {
      if (typeof v === "boolean") return v;
      if (v && typeof v === "object") {
        if (Object.prototype.hasOwnProperty.call(v, "checked")) return parseBoolOrNull(v.checked);
        if (Object.prototype.hasOwnProperty.call(v, "value")) return parseBoolOrNull(v.value);
      }
      if (typeof v === "number") {
        if (v === 1) return true;
        if (v === 0) return false;
      }
      const s = String(v ?? "").toLowerCase().trim();
      if (s === "true") return true;
      if (s === "false") return false;
      if (s === "1" || s === "on" || s === "yes" || s === "y" || s === "si" || s === "sí") return true;
      if (s === "0" || s === "off" || s === "no" || s === "n") return false;
      return null;
    };

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const hasRequiereLoteArado = Object.prototype.hasOwnProperty.call(body, "requiereLoteArado");
    const requiereLoteAradoParsed =
      hasRequiereLoteArado && (body.requiereLoteArado === null || body.requiereLoteArado === undefined || body.requiereLoteArado === "")
        ? prevRequiereLoteArado
        : (hasRequiereLoteArado ? parseBoolOrNull(body.requiereLoteArado) : prevRequiereLoteArado);
    if (requiereLoteAradoParsed === null) {
      return res.status(400).json({ message: "Campo 'requiereLoteArado' invÃ¡lido. Debe ser boolean." });
    }

    let payload;
    if (modo === "manual") {
      const hasHabilitado = Object.prototype.hasOwnProperty.call(body, "habilitado");
      const habilitadoParsed =
        hasHabilitado && (body.habilitado === null || body.habilitado === undefined || body.habilitado === "")
          ? prevHabilitado
          : (hasHabilitado ? parseBoolOrNull(body.habilitado) : prevHabilitado);
      if (habilitadoParsed === null) {
        if (process.env.DEBUG_TURNOS === "true") {
          globalThis.console.log("HABILITADO INVALIDO:", { value: body.habilitado, type: typeof body.habilitado });
        }
        return res.status(400).json({ message: "Campo 'habilitado' inválido. Debe ser boolean." });
      }
      payload = {
        modo: "manual",
        habilitado: habilitadoParsed,
        mensaje,
        desde: null,
        hasta: null,
        rangoModo: null,
        requiereLoteArado: requiereLoteAradoParsed,
        updatedAt: Timestamp.now(),
      };
    } else {
      const desdeNorm = normalizeYmdOrNull(req.body?.desde);
      const hastaNorm = normalizeYmdOrNull(req.body?.hasta);
      if (!desdeNorm) {
        return res.status(400).json({ message: "Campo 'desde' inválido (YYYY-MM-DD requerido)." });
      }
      if (!hastaNorm) {
        return res.status(400).json({ message: "Campo 'hasta' inválido (YYYY-MM-DD requerido)." });
      }
      if (desdeNorm > hastaNorm) {
        return res.status(400).json({ message: "Rango inválido: 'desde' no puede ser mayor que 'hasta'." });
      }
      const rangoModoStr = String(req.body?.rangoModo ?? "").toLowerCase().trim();
      if (rangoModoStr !== "enable" && rangoModoStr !== "disable") {
        return res.status(400).json({ message: "Campo 'rangoModo' inválido. Debe ser 'enable' o 'disable'." });
      }
      payload = {
        modo: "rango",
        habilitado: null,
        mensaje,
        desde: desdeNorm,
        hasta: hastaNorm,
        rangoModo: rangoModoStr,
        requiereLoteArado: requiereLoteAradoParsed,
        updatedAt: Timestamp.now(),
      };
    }
    await ref.set(payload, { merge: true });

    const hoyYmd = toYmdInIptTz(new Date());
    const estadoActual = calcularEstadoTurnos(payload, hoyYmd);
    if (process.env.DEBUG_TURNOS === "true") {
      globalThis.console.log("CONFIG ACTUAL:", payload);
      globalThis.console.log("ESTADO ACTUAL:", estadoActual);
    }

    const prevDesc = prevRaw.modo
      ? `${prevRaw.modo}${prevRaw.modo === "manual" ? (prevHabilitado ? "/habilitado" : "/deshabilitado") : `/rango:${prevRaw.desde||"?"}-${prevRaw.hasta||"?"}`}`
      : null;
    const nextDesc = `${payload.modo}${payload.modo === "manual" ? (payload.habilitado ? "/habilitado" : "/deshabilitado") : `/rango:${payload.desde||"?"}-${payload.hasta||"?"}`}`;
    registrarAuditoriaTurno({
      turnoId: "config",
      accion: "config_cambiada",
      estadoAnterior: prevDesc,
      estadoNuevo: nextDesc,
      motivo: payload.mensaje || null,
      realizadoPor: buildRealizadoPor(req),
      origen: buildOrigen(req),
      automatico: false,
    });

    if (payload.modo === "manual" && prevHabilitado !== payload.habilitado) {
      const title = payload.habilitado ? "Turnos habilitados" : "Turnos deshabilitados";
      const body = payload.habilitado
        ? (mensaje || "Los turnos están habilitados para solicitar.")
        : (`Turnos deshabilitados hasta nuevo aviso${mensaje ? ` · ${mensaje}` : ""}`);

      try {
        const prodsSnap = await db.collection("productores").where("activo", "==", true).get();
        const tokensSet = new Set();
        prodsSnap.docs.forEach((d) => {
          const p = d.data() || {};
          const arr = Array.isArray(p.fcmTokens) ? p.fcmTokens : [];
          arr.forEach((t) => {
            const s = String(t || "").trim();
            if (!s) return;
            if (s.startsWith("ExponentPushToken")) return;
            tokensSet.add(s);
          });
        });

        const tokens = Array.from(tokensSet);
        for (let i = 0; i < tokens.length; i += 500) {
          const chunk = tokens.slice(i, i + 500);
          await admin.messaging().sendEachForMulticast({
            tokens: chunk,
            notification: { title, body },
            data: {
              event: "turnos_config",
              habilitado: payload.habilitado ? "true" : "false",
              mensaje: mensaje || "",
            },
            android: { priority: "high" },
          });
        }
      } catch (e) {
        console.error("Error enviando notificación push de turnos:", e?.message || e);
      }
    }

    return res.json({ message: "Configuración guardada", ...payload, estadoActual });
  } catch (error) {
    console.error("Error al guardar configuración de turnos:", error);
    return res.status(500).json({ message: "Error al guardar configuración", estadoActual: null });
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
    const prevCapacidad = snap.exists ? (snap.data()?.capacidad ?? null) : null;
    await ref.set(payload, { merge: true });

    registrarAuditoriaTurno({
      turnoId: `capacidad:${ymd}`,
      accion: "capacidad_cambiada",
      estadoAnterior: prevCapacidad !== null ? String(prevCapacidad) : null,
      estadoNuevo: String(capacidad),
      motivo: null,
      realizadoPor: buildRealizadoPor(req),
      origen: buildOrigen(req),
      automatico: false,
    });

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

const tsToMs = (ts) => {
  if (!ts) return 0;
  if (typeof ts?.toDate === "function") return ts.toDate().getTime();
  if (typeof ts?._seconds === "number") return ts._seconds * 1000;
  return 0;
};

const tsToIso = (ts) => {
  if (!ts) return null;
  if (typeof ts?.toDate === "function") return ts.toDate().toISOString();
  if (typeof ts?._seconds === "number") return new Date(ts._seconds * 1000).toISOString();
  return null;
};

// 📋 Obtener historial de auditoría completo de un turno (solo admin)
export const obtenerHistorialTurno = async (req, res) => {
  try {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ message: "Acceso denegado. Solo administradores pueden ver el historial completo." });
    }

    const { id } = req.params;
    const limitParam = Number(req.query.limit) || 50;
    const limit = Math.min(limitParam, 100);

    const snap = await db
      .collection("turnosHistorial")
      .where("turnoId", "==", id)
      .get();

    const historial = snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          _sortMs: tsToMs(data.createdAt),
          createdAt: tsToIso(data.createdAt),
        };
      })
      .sort((a, b) => b._sortMs - a._sortMs)
      .slice(0, limit)
      .map(({ _sortMs, ...rest }) => rest);

    return res.json({ historial, total: historial.length });
  } catch (error) {
    console.error("Error al obtener historial de turno:", error);
    return res.status(500).json({ message: "Error al obtener el historial" });
  }
};

const TIMELINE_ACCIONES = new Set(["turno_creado", "estado_cambiado"]);

const buildTimelineDescripcion = (accion, estadoNuevo) => {
  if (accion === "turno_creado") return "Solicitaste el turno";
  if (accion === "estado_cambiado") {
    const to = normalizeEstado(estadoNuevo);
    if (to === "confirmado") return "Tu turno fue confirmado";
    if (to === "cancelado") return "Tu turno fue cancelado";
    if (to === "completado") return "Tu turno fue completado";
    if (to === "vencido") return "El turno venció";
  }
  return null;
};

// 📅 Obtener timeline del turno para el productor (solo campos públicos)
export const obtenerTimelineTurno = async (req, res) => {
  try {
    const { id } = req.params;

    const turnoDoc = await db.collection("turnos").doc(id).get();
    if (!turnoDoc.exists) return res.status(404).json({ message: "Turno no encontrado" });

    const turno = turnoDoc.data();
    const ownerIds = getAuthOwnershipIds(req);
    const pid = String(turno?.productorId || "");
    if (!isAdminRequest(req) && pid && !ownerIds.has(pid)) {
      return res.status(403).json({ message: "No tenés permiso para ver este turno" });
    }

    const snap = await db
      .collection("turnosHistorial")
      .where("turnoId", "==", id)
      .get();

    const timeline = snap.docs
      .map((doc) => {
        const data = doc.data();
        const accion = String(data.accion || "");
        if (!TIMELINE_ACCIONES.has(accion)) return null;
        const descripcion = buildTimelineDescripcion(accion, data.estadoNuevo);
        if (!descripcion) return null;
        return {
          id: doc.id,
          accion,
          descripcion,
          estadoAnterior: data.estadoAnterior ?? null,
          estadoNuevo: data.estadoNuevo ?? null,
          motivo: data.motivo ?? null,
          createdAt: tsToIso(data.createdAt),
          _sortMs: tsToMs(data.createdAt),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a._sortMs - b._sortMs)
      .map(({ _sortMs, ...rest }) => rest);

    return res.json({ timeline, total: timeline.length });
  } catch (error) {
    console.error("Error al obtener timeline de turno:", error);
    return res.status(500).json({ message: "Error al obtener el timeline" });
  }
};
