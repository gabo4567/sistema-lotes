// src/controllers/lotes.controller.js
import { db } from "../utils/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import { sendValidationOrInternalError } from "../utils/httpErrors.js";

const METERS_PER_DEGREE_LAT = 111320;

const toComparable = (value) => {
  if (value && typeof value === "object") {
    if (typeof value.toDate === "function") {
      const d = value.toDate();
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof value._seconds === "number") {
      return { _seconds: value._seconds, _nanoseconds: value._nanoseconds ?? 0 };
    }
    if (typeof value.seconds === "number") {
      return { seconds: value.seconds, nanoseconds: value.nanoseconds ?? 0 };
    }
  }
  return value;
};

const computeChanges = (before, after, keys) => {
  const cambios = {};
  keys.forEach((k) => {
    const a = toComparable(before?.[k]);
    const b = toComparable(after?.[k]);
    const same = JSON.stringify(a) === JSON.stringify(b);
    if (!same) {
      cambios[k] = { antes: before?.[k] ?? null, despues: after?.[k] ?? null };
    }
  });
  return cambios;
};

const logLoteHistorial = ({ loteId, accion, cambios, usuarioId }) => {
  void db
    .collection("lotesHistorial")
    .add({
      loteId: String(loteId),
      accion,
      cambios: cambios ?? null,
      usuarioId: usuarioId || "sistema",
      fecha: Timestamp.now(),
    })
    .catch(() => null);
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeText = (value, fallback = "") => {
  if (value == null) return fallback;
  return String(value).trim();
};

const normalizePolygon = (polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    throw new Error("El poligono debe tener al menos 3 puntos validos");
  }

  return polygon.map((point) => {
    const lat = toFiniteNumber(point?.lat);
    const lng = toFiniteNumber(point?.lng);

    if (lat == null || lng == null) {
      throw new Error("El poligono contiene coordenadas invalidas");
    }

    return { lat, lng };
  });
};

const calculatePolygonAreaHa = (polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return null;

  const averageLatRadians = (polygon.reduce((sum, point) => sum + point.lat, 0) / polygon.length) * (Math.PI / 180);
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(averageLatRadians);

  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentX = current.lng * metersPerDegreeLng;
    const currentY = current.lat * METERS_PER_DEGREE_LAT;
    const nextX = next.lng * metersPerDegreeLng;
    const nextY = next.lat * METERS_PER_DEGREE_LAT;
    area += currentX * nextY - nextX * currentY;
  }

  return Math.abs(area / 2) / 10000;
};

const getPolygonCentroid = (polygon) => {
  if (!Array.isArray(polygon) || polygon.length === 0) return null;

  const sum = polygon.reduce(
    (accumulator, point) => ({
      lat: accumulator.lat + point.lat,
      lng: accumulator.lng + point.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: sum.lat / polygon.length,
    lng: sum.lng / polygon.length,
  };
};

const normalizeLocation = (ubicacion, polygon) => {
  const lat = toFiniteNumber(ubicacion?.lat);
  const lng = toFiniteNumber(ubicacion?.lng);

  if (lat != null && lng != null) {
    return { lat, lng };
  }

  return getPolygonCentroid(polygon);
};

const normalizeSurface = (superficie, polygon) => {
  const parsed = toFiniteNumber(superficie);
  if (parsed != null && parsed > 0) {
    return parsed;
  }

  return calculatePolygonAreaHa(polygon);
};

const buildLotePayload = (source, current = {}) => {
  const polygon = normalizePolygon(source.poligono ?? current.poligono);
  const ipt = normalizeText(source.ipt ?? current.ipt);
  const metodoMarcado = normalizeText(source.metodoMarcado ?? current.metodoMarcado, "aereo") || "aereo";

  if (!ipt) {
    throw new Error("El IPT es obligatorio");
  }

  return {
    ipt,
    superficie: normalizeSurface(source.superficie ?? current.superficie, polygon),
    ubicacion: normalizeLocation(source.ubicacion ?? current.ubicacion, polygon),
    poligono: polygon,
    metodoMarcado,
    observacionesTecnico: normalizeText(source.observacionesTecnico ?? current.observacionesTecnico),
    nombre: normalizeText(source.nombre ?? current.nombre) || null,
    observacionesProductor: normalizeText(source.observacionesProductor ?? current.observacionesProductor),
  };
};

// Crear un lote
export const createLote = async (req, res) => {
  try {
    const usuarioId = req.user?.uid || "sistema";
    const newLote = {
      ...buildLotePayload(req.body),
      fechaCreacion: new Date(),
      createdBy: usuarioId,
      estado: "Pendiente",
      activo: true,
    };

    const docRef = await db.collection("lotes").add(newLote);
    logLoteHistorial({ loteId: docRef.id, accion: "crear", cambios: null, usuarioId });
    res.json({ id: docRef.id, ...newLote });
  } catch (error) {
    sendValidationOrInternalError(res, error, {
      validationMatchers: ["obligatorio", "poligono", "coordenadas"],
      internalMessage: "Error al crear lote",
    });
  }
};

// Obtener todos los lotes activos
export const getAllLotes = async (req, res) => {
  try {
    const snapshot = await db.collection("lotes").where("activo", "==", true).get();
    const lotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Ordenar por fechaCreacion descendente (más reciente primero)
    lotes.sort((a, b) => {
      const dateA = a.fechaCreacion?.toDate ? a.fechaCreacion.toDate() : new Date(a.fechaCreacion || 0);
      const dateB = b.fechaCreacion?.toDate ? b.fechaCreacion.toDate() : new Date(b.fechaCreacion || 0);
      return dateB - dateA;
    });
    res.json(lotes);
  } catch (error) {
    console.error("Error al obtener lotes:", error);
    res.status(500).json({ error: "Error al obtener lotes" });
  }
};

// Obtener todos los lotes inactivos
export const getInactiveLotes = async (req, res) => {
  try {
    const snapshot = await db.collection("lotes").where("activo", "==", false).get();
    const lotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Ordenar por fechaCreacion descendente (más reciente primero)
    lotes.sort((a, b) => {
      const dateA = a.fechaCreacion?.toDate ? a.fechaCreacion.toDate() : new Date(a.fechaCreacion || 0);
      const dateB = b.fechaCreacion?.toDate ? b.fechaCreacion.toDate() : new Date(b.fechaCreacion || 0);
      return dateB - dateA;
    });
    res.json(lotes);
  } catch (error) {
    console.error("Error al obtener lotes inactivos:", error);
    res.status(500).json({ error: "Error al obtener lotes inactivos" });
  }
};

// Obtener lote por ID
export const getLoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("lotes").doc(id).get();
    if (!doc.exists || doc.data().activo === false) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error al obtener lote:", error);
    res.status(500).json({ error: "Error al obtener lote" });
  }
};

export const getLoteHistorial = async (req, res) => {
  try {
    const { id } = req.params;
    const loteId = String(id || "").trim();
    if (!loteId) return res.json([]);
    const snap = await db.collection("lotesHistorial").where("loteId", "==", loteId).get();
    const raw = snap.docs
      .map((d) => d.data() || {})
      .sort((a, b) => {
        const aMs = typeof a?.fecha?.toMillis === "function" ? a.fecha.toMillis() : 0;
        const bMs = typeof b?.fecha?.toMillis === "function" ? b.fecha.toMillis() : 0;
        return bMs - aMs;
      })
      .slice(0, 50);

    const uids = Array.from(
      new Set(raw.map((x) => String(x?.usuarioId || "").trim()).filter((uid) => uid && uid !== "sistema"))
    );

    const userNameByUid = {};
    await Promise.all(
      uids.map(async (uid) => {
        try {
          const userSnap = await db.collection("users").doc(uid).get();
          if (!userSnap.exists) return;
          const user = userSnap.data() || {};
          userNameByUid[uid] = user.nombre || user.email || uid;
        } catch {
          return;
        }
      })
    );

    const items = raw.map((x) => {
      const usuarioId = x?.usuarioId || "sistema";
      const usuarioNombre = userNameByUid[usuarioId] || usuarioId;
        return {
          accion: x.accion,
          usuarioId,
          usuarioNombre,
          fecha: x.fecha,
          cambios: x.cambios ?? null,
        };
      });
    return res.json(items);
  } catch (error) {
    console.error("Error al obtener historial del lote:", error);
    return res.json([]);
  }
};

// Actualizar lote
export const updateLote = async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection("lotes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Lote no encontrado" });
    const current = snap.data();
    if (current.estado === "Validado") {
      return res.status(403).json({ error: "No se puede editar un lote validado" });
    }
    const usuarioId = req.user?.uid || "sistema";
    const nextPayload = buildLotePayload(req.body, current);
    await ref.update({ ...nextPayload, updatedAt: new Date(), updatedBy: usuarioId });
    let cambios;
    try {
      cambios = computeChanges(current, nextPayload, Object.keys(nextPayload));
    } catch {
      cambios = nextPayload;
    }
    logLoteHistorial({ loteId: id, accion: "actualizar", cambios, usuarioId });
    res.json({ message: "✅ Lote actualizado correctamente" });
  } catch (error) {
    sendValidationOrInternalError(res, error, {
      validationMatchers: ["obligatorio", "poligono", "coordenadas"],
      internalMessage: "Error al actualizar lote",
    });
  }
};

// Eliminar lote (soft delete)
export const deleteLote = async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection("lotes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Lote no encontrado" });
    const current = snap.data();
    if (current.estado === "Validado") {
      return res.status(403).json({ error: "No se puede eliminar un lote validado" });
    }
    const usuarioId = req.user?.uid || "sistema";
    await ref.update({ activo: false, updatedAt: new Date(), deletedBy: usuarioId });
    logLoteHistorial({
      loteId: id,
      accion: "eliminar",
      cambios: { activo: { antes: true, despues: false } },
      usuarioId,
    });
    res.json({ message: "✅ Lote desactivado correctamente (soft delete)" });
  } catch (error) {
    console.error("Error al desactivar lote:", error);
    res.status(500).json({ error: "Error al desactivar lote" });
  }
};

export const getLotesByIpt = async (req, res) => {
  try {
    const { ipt } = req.params;
    const snapshot = await db
      .collection("lotes")
      .where("ipt", "==", String(ipt))
      .where("activo", "==", true)
      .get();
    const lotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Ordenar por fechaCreacion descendente (más reciente primero)
    lotes.sort((a, b) => {
      const dateA = a.fechaCreacion?.toDate ? a.fechaCreacion.toDate() : new Date(a.fechaCreacion || 0);
      const dateB = b.fechaCreacion?.toDate ? b.fechaCreacion.toDate() : new Date(b.fechaCreacion || 0);
      return dateB - dateA;
    });
    res.json(lotes);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener lotes por IPT" });
  }
};

export const cambiarEstadoLote = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observacionesTecnico } = req.body;
    const permitidos = ["Pendiente", "Validado", "Rechazado"];
    if (!permitidos.includes(estado)) return res.status(400).json({ error: "Estado inválido" });
    const ref = db.collection("lotes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Lote no encontrado" });
    const lote = snap.data();
    const usuarioId = req.user?.uid || "sistema";
    await ref.update({ 
      estado, 
      observacionesTecnico: observacionesTecnico || "",
      updatedAt: new Date()
    });
    let cambios;
    try {
      cambios = computeChanges(
        lote,
        { estado, observacionesTecnico: observacionesTecnico || "" },
        ["estado", "observacionesTecnico"]
      );
    } catch {
      cambios = { estado, observacionesTecnico: observacionesTecnico || "" };
    }
    logLoteHistorial({ loteId: id, accion: "actualizar", cambios, usuarioId });
    if (estado === "Validado") {
      try {
        const prodSnap = await db.collection("productores").where("ipt", "==", String(lote.ipt)).limit(1).get();
        if (!prodSnap.empty) {
          const prod = prodSnap.docs[0].data();
          const tokens = Array.isArray(prod.pushTokens) ? prod.pushTokens : (prod.pushToken ? [prod.pushToken] : []);
          if (tokens.length) {
            const { sendExpoPush } = await import("../utils/expoPush.js");
            await sendExpoPush(tokens, "Lote validado", "Tu lote ha sido validado", { loteId: id, ipt: lote.ipt });
          }
        }
      } catch (e) {
        console.error("Error enviando push:", e?.message);
      }
    }
    res.json({ message: "Estado actualizado" });
  } catch (error) {
    res.status(500).json({ error: "Error al cambiar estado" });
  }
};
