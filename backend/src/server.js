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
import medicionesRoutes from "./routes/mediciones.routes.js";
import insumosRoutes from "./routes/insumos.routes.js";
import turnosRoutes from "./routes/turnos.routes.js";
import informesRoutes from "./routes/informes.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { disponibilidadTurno } from "./controllers/turnos.controller.js";
import testRoutes from "./routes/test.routes.js";
import { requireAuth, requireRole, requireFirebaseAuth } from "./middlewares/auth.js";

const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
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
app.use("/api/lotes", lotesRoutes);
app.use("/api/productores", productoresRoutes);
app.use("/api/ordenes", ordenesRoutes);
app.use("/api/mediciones", medicionesRoutes);
app.use("/api/insumos", insumosRoutes);

// 🧭 Rutas de turnos - disponibilidad sin autenticación
console.log("📢 Intentando registrar las rutas de /api/turnos...");

// Primero registramos el endpoint público de disponibilidad CON RUTA COMPLETA
app.get("/api/turnos/disponibilidad", (req, res, next) => {
  console.log("📅 Endpoint /api/turnos/disponibilidad llamado");
  disponibilidadTurno(req, res, next);
});

// Ruta de prueba SIN autenticación para verificar comunicación
app.post("/api/test/public/test-turno", (req, res) => {
  console.log("🧪 TEST PÚBLICO - Body recibido:", req.body);
  console.log("🧪 TEST PÚBLICO - Headers:", req.headers);
  
  res.json({
    success: true,
    message: "Comunicación exitosa - El servidor recibe los datos correctamente",
    datosRecibidos: req.body,
    timestamp: new Date().toISOString()
  });
});

// Ruta de prueba para verificar el flujo de turnos
app.use("/api/test", requireFirebaseAuth, testRoutes);

// Luego registramos el resto de rutas con autenticación Firebase
app.use("/api/turnos", requireFirebaseAuth, turnosRoutes);

console.log("✅ Rutas de turnos registradas correctamente");

// 🧭 Nueva ruta de informes
app.use("/api/informes", informesRoutes);
console.log("✅ Rutas de informes registradas correctamente");

// 📸 Ruta para uploads de imágenes
app.use("/api/upload", uploadRoutes);
console.log("✅ Rutas de uploads registradas correctamente");

// 📁 Servir archivos estáticos (imágenes subidas)
// Servir archivos estáticos desde uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
console.log("📁 Servidor de archivos estáticos configurado para /uploads");

app.get("/", (req, res) => {
  res.send("Servidor del Sistema de Lotes funcionando correctamente 🚀");
});

// Middleware global de errores
app.use((err, req, res, next) => {
  console.error("❌ Error interno:", err);
  res.status(500).json({ message: "Error interno del servidor", error: err.message });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor backend escuchando en http://localhost:${PORT}`);
});
