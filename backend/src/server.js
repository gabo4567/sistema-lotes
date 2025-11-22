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
import turnosRoutes from "./routes/turnos.routes.js";
import informesRoutes from "./routes/informes.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { disponibilidadTurno } from "./controllers/turnos.controller.js";


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS básico para desarrollo (web en Vite 5173)
app.use((req, res, next) => {
  const origin = process.env.WEB_ORIGIN || "http://localhost:5173";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Vary", "Origin");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Rutas API
app.use("/api/users", requireAuth, requireRole(["Administrador"]), usersRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/lotes", lotesRoutes);
app.use("/api/productores", productoresRoutes);
app.use("/api/ordenes", ordenesRoutes);
app.use("/api/mediciones", medicionesRoutes);

// 🧭 Rutas de turnos - disponibilidad sin autenticación
console.log("📢 Intentando registrar las rutas de /api/turnos...");

// Primero registramos el endpoint público de disponibilidad CON RUTA COMPLETA
app.get("/api/turnos/disponibilidad", (req, res, next) => {
  console.log("📅 Endpoint /api/turnos/disponibilidad llamado");
  disponibilidadTurno(req, res, next);
});

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
import { requireAuth, requireRole, requireFirebaseAuth } from "./middlewares/auth.js";
