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

const app = express();
const PORT = process.env.PORT || 3000;
const enableTestRoutes = process.env.NODE_ENV !== "production" || process.env.ENABLE_TEST_ROUTES === "true";

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
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
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
});
