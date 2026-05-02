// src/server.js

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas
import usersRoutes from "./routes/users.routes.js";
import authRoutes from "./routes/auth.routes.js";
import lotesRoutes from "./routes/lotes.routes.js";
import productoresRoutes from "./routes/productores.routes.js";
import ordenesRoutes from "./routes/ordenes.routes.js";
import insumosRoutes from "./routes/insumos.routes.js";
import turnosRoutes from "./routes/turnos.routes.js";
import informesRoutes from "./routes/informes.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { disponibilidadTurno } from "./controllers/turnos.controller.js";
import testRoutes from "./routes/test.routes.js";
import { requireAuth, requireRole, requireFirebaseAuth } from "./middlewares/auth.js";
import { logServerError, sendInternalError } from "./utils/httpErrors.js";
import { db } from "./utils/firebase.js";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { sendExpoPush } from "./utils/expoPush.js";

const app = express();
const PORT = process.env.PORT || 3000;
const enableTestRoutes = process.env.NODE_ENV !== "production" || process.env.ENABLE_TEST_ROUTES === "true";

const IPT_TIMEZONE = "America/Argentina/Buenos_Aires";

const formatYmdInIptTz = (date) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: IPT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(date);
  } catch {
    return null;
  }
};

const addDaysYmd = (ymd, days) => {
  const m = String(ymd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd + Number(days || 0), 12, 0, 0, 0));
  return formatYmdInIptTz(d);
};

const formatHmInIptTz = (date) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  try {
    const fmt = new Intl.DateTimeFormat("es-AR", {
      timeZone: IPT_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return fmt.format(date);
  } catch {
    return null;
  }
};

const normalizeTipoTurno = (t) => {
  const s = String(t || "").toLowerCase().trim();
  if (!s) return "";
  if (s === "otra" || s === "otros") return "otro";
  if (s.includes("insum")) return "insumo";
  if (s.includes("renov") || s.includes("carnet")) return "carnet";
  return "otro";
};

const tipoTurnoLabel = (t) => {
  const s = normalizeTipoTurno(t);
  if (s === "insumo") return "Insumo";
  if (s === "carnet") return "Renovación de Carnet";
  return "Otro";
};

const turnoDateFromRaw = (raw) => {
  if (!raw) return null;
  const ft = raw.fechaTurno;
  if (ft && typeof ft === "object" && ft._seconds !== undefined) {
    const d = new Date(ft._seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof ft === "string") {
    const s = ft.includes("T") ? ft : `${ft}T00:00:00.000Z`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw.fecha === "string") {
    const d = new Date(raw.fecha);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const deriveIptFromUid = (uid) => {
  if (!uid) return null;
  const match = String(uid).match(/^prod_(.+)$/i);
  return match ? match[1] : null;
};

const getExpoTokensForTurno = async (turno) => {
  const pid = String(turno?.productorId || "").trim();
  let prodDoc = null;

  if (pid) {
    try {
      const byId = await db.collection("productores").doc(pid).get();
      if (byId.exists) prodDoc = byId;
    } catch {}
  }

  if (!prodDoc && pid) {
    const ipt = deriveIptFromUid(pid);
    if (ipt) {
      try {
        const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
        if (!snap.empty) prodDoc = snap.docs[0];
      } catch {}
    }
  }

  if (!prodDoc) return { tokens: [], productorRef: null };
  const p = prodDoc.data() || {};
  const tokens = [
    ...(Array.isArray(p.expoPushTokens) ? p.expoPushTokens : []),
    ...(Array.isArray(p.pushTokens) ? p.pushTokens : []),
    ...(Array.isArray(p.fcmTokens) ? p.fcmTokens : []),
  ]
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .filter((t) => t.startsWith("ExponentPushToken"));

  return { tokens: Array.from(new Set(tokens)), productorRef: prodDoc.ref || null };
};

const chunkArray = (arr, size) => {
  const out = [];
  const n = Math.max(1, Number(size || 1));
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const markReminderFlagAfterSuccess = async (ref, field) => {
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const raw = snap.data() || {};
      if (raw?.[field] === true) return false;
      tx.update(ref, { [field]: true, [`${field}At`]: Timestamp.now() });
      return true;
    });
  } catch {
    return false;
  }
};

const isInvalidExpoTokenError = (errCode, errMsg) => {
  const c = String(errCode || "").trim();
  const m = String(errMsg || "").toLowerCase();
  if (c === "DeviceNotRegistered") return true;
  if (c === "InvalidCredentials") return true;
  if (m.includes("is not a registered push token")) return true;
  if (m.includes("not a registered push token")) return true;
  return false;
};

const removeInvalidExpoTokensFromProductor = async (productorRef, invalidTokens) => {
  if (!productorRef || !invalidTokens || invalidTokens.length === 0) return;
  const tokens = invalidTokens.map((t) => String(t || "").trim()).filter(Boolean);
  if (tokens.length === 0) return;
  try {
    await productorRef.set(
      {
        fcmTokens: FieldValue.arrayRemove(...tokens),
        pushTokens: FieldValue.arrayRemove(...tokens),
        expoPushTokens: FieldValue.arrayRemove(...tokens),
      },
      { merge: true }
    );
  } catch {}
};

const sendExpoPushAndHandleInvalidTokens = async ({ tokens, title, body, data, productorRef }) => {
  let anyOk = false;
  let sentOkCount = 0;
  const invalid = new Set();
  const chunks = chunkArray(tokens, 100);
  for (const c of chunks) {
    let resp;
    try {
      resp = await sendExpoPush(c, title, body, data);
    } catch {
      continue;
    }
    const results = Array.isArray(resp?.data) ? resp.data : [];
    for (let i = 0; i < c.length; i++) {
      const token = c[i];
      const r = results[i] || null;
      if (r?.status === "ok") {
        anyOk = true;
        sentOkCount += 1;
        continue;
      }
      const errCode = r?.details?.error || r?.error || null;
      const errMsg = r?.message || r?.details?.message || null;
      if (errCode || errMsg) {
        console.log("Expo push error:", { errCode, errMsg });
      }
      if (isInvalidExpoTokenError(errCode, errMsg)) {
        invalid.add(token);
      }
    }
  }

  if (invalid.size > 0) {
    await removeInvalidExpoTokensFromProductor(productorRef, Array.from(invalid));
  }
  return { anyOk, sentOkCount, invalidTokensCount: invalid.size };
};

let isTurnosReminderJobRunning = false;
const runTurnosReminderJob = async () => {
  if (isTurnosReminderJobRunning) return;
  isTurnosReminderJobRunning = true;
  console.log("Iniciando job de recordatorios…");
  try {
    let processed = 0;
    let notificationsSent = 0;
    let tokensRemoved = 0;

    const now = new Date();
    const todayYmd = formatYmdInIptTz(now);
    if (!todayYmd) return;
    const tomorrowYmd = addDaysYmd(todayYmd, 1);
    if (!tomorrowYmd) return;

    let snap;
    const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rangeEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    snap = await db
      .collection("turnos")
      .where("fechaTurno", ">=", Timestamp.fromDate(rangeStart))
      .where("fechaTurno", "<=", Timestamp.fromDate(rangeEnd))
      .get();
    const MAX_TURNOS_PER_RUN = 600;
    const docs = snap.docs.slice(0, MAX_TURNOS_PER_RUN);

    for (const doc of docs) {
      const turno = doc.data() || {};
      processed += 1;
      if (turno?.activo === false) continue;
      if (String(turno?.estado || "").toLowerCase().trim() !== "confirmado") continue;
      const dt = turnoDateFromRaw(turno);
      if (!dt) continue;


      const turnoYmd = formatYmdInIptTz(dt);
      if (!turnoYmd) continue;
      const hm = formatHmInIptTz(dt) || "09:00";
      const tipoLabel = tipoTurnoLabel(turno?.tipoTurno);
      const diffMs = dt.getTime() - now.getTime();

      const shouldDayBefore = turnoYmd === tomorrowYmd && turno?.recordatorioEnviadoDiaAntes !== true;
      const shouldSameDay2h = turnoYmd === todayYmd && diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000 && turno?.recordatorioEnviadoMismoDia !== true;

      if (!shouldDayBefore && !shouldSameDay2h) continue;

      const { tokens, productorRef } = await getExpoTokensForTurno(turno);
      if (!tokens.length) continue;

      if (shouldDayBefore) {
        const title = "Tenés un turno mañana";
        const body = `Tipo: ${tipoLabel} · Hora: ${hm}`;
        const sendRes = await sendExpoPushAndHandleInvalidTokens({
          tokens,
          title,
          body,
          data: { event: "turno_recordatorio", kind: "dia_antes", turnoId: doc.id },
          productorRef,
        });
        notificationsSent += Number(sendRes?.sentOkCount || 0);
        tokensRemoved += Number(sendRes?.invalidTokensCount || 0);
        if (sendRes?.anyOk) {
          await markReminderFlagAfterSuccess(doc.ref, "recordatorioEnviadoDiaAntes");
        }
      }

      if (shouldSameDay2h) {
        const title = "Tu turno es hoy";
        const body = `Tenés turno a las ${hm}`;
        const sendRes = await sendExpoPushAndHandleInvalidTokens({
          tokens,
          title,
          body,
          data: { event: "turno_recordatorio", kind: "mismo_dia_2h", turnoId: doc.id },
          productorRef,
        });
        notificationsSent += Number(sendRes?.sentOkCount || 0);
        tokensRemoved += Number(sendRes?.invalidTokensCount || 0);
        if (sendRes?.anyOk) {
          await markReminderFlagAfterSuccess(doc.ref, "recordatorioEnviadoMismoDia");
        }
      }
    }

    console.log(`Turnos procesados: ${processed}`);
    console.log(`Notificaciones enviadas: ${notificationsSent}`);
    console.log(`Tokens eliminados: ${tokensRemoved}`);
  } catch (e) {
    console.error("Turnos reminders: error:", e?.message || e);
  } finally {
    console.log("Job de recordatorios finalizado");
    isTurnosReminderJobRunning = false;
  }
};

if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET no configurado en producción");
  }

  if (!process.env.ALLOWED_ORIGINS) {
    throw new Error("ALLOWED_ORIGINS no configurado en producción");
  }

  if (String(process.env.ALLOWED_ORIGINS).toLowerCase().includes("localhost")) {
    throw new Error("ALLOWED_ORIGINS no debe incluir localhost en producción");
  }
}

app.set("trust proxy", 1);

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildOriginMatcher = (pattern) => {
  const normalized = String(pattern || "").trim();
  if (!normalized) return null;

  const regex = new RegExp(`^${escapeRegExp(normalized).replace(/\\\*/g, ".*")}$`);
  return (origin) => regex.test(origin);
};

const configuredOriginPatterns = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOriginMatchers = [
  ...(process.env.NODE_ENV === "production" ? [] : DEFAULT_ALLOWED_ORIGINS),
  ...configuredOriginPatterns,
]
  .map(buildOriginMatcher)
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOriginMatchers.length === 0) return process.env.NODE_ENV !== "production";
  return allowedOriginMatchers.some((matcher) => matcher(origin));
};

app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && !isOriginAllowed(origin)) {
    return res.status(403).json({ message: "Origen no permitido por CORS" });
  }

  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Idempotency-Key");
  res.header("Access-Control-Max-Age", "86400");
  res.header("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});


// Rutas API
app.use("/api/users", requireAuth, requireRole(["Administrador"]), usersRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/lotes", requireFirebaseAuth, lotesRoutes);
app.use("/api/productores", requireFirebaseAuth, productoresRoutes);
app.use("/api/ordenes", requireFirebaseAuth, ordenesRoutes);
app.use("/api/insumos", requireFirebaseAuth, insumosRoutes);

// Primero registramos el endpoint público de disponibilidad CON RUTA COMPLETA
app.get("/api/turnos/disponibilidad", (req, res, next) => {
  disponibilidadTurno(req, res, next);
});

if (enableTestRoutes) {
  app.post("/api/test/public/test-turno", (req, res) => {
    res.json({
      success: true,
      message: "Comunicación exitosa - El servidor recibe los datos correctamente",
      datosRecibidos: req.body,
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/test", requireFirebaseAuth, testRoutes);
}

// Luego registramos el resto de rutas con autenticación Firebase
app.use("/api/turnos", requireFirebaseAuth, turnosRoutes);

// 🧭 Nueva ruta de informes
app.use("/api/informes", requireFirebaseAuth, informesRoutes);

// 📸 Ruta para uploads de imágenes
app.use("/api/upload", requireFirebaseAuth, uploadRoutes);

// 📁 Servir archivos estáticos (imágenes subidas)
// Servir archivos estáticos desde uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
  res.send("Servidor del Sistema de Lotes funcionando correctamente 🚀");
});

// Middleware global de errores
app.use((err, req, res, next) => {
  logServerError("Error interno no manejado", err);
  sendInternalError(res, "Error interno del servidor");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor backend escuchando en puerto ${PORT}`);

  const intervalMs = 10 * 60 * 1000;
  setTimeout(() => {
    runTurnosReminderJob().catch(() => {});
    setInterval(() => {
      runTurnosReminderJob().catch(() => {});
    }, intervalMs);
  }, 20 * 1000);
});
