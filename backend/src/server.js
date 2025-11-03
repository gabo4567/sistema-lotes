// src/server.js
import express from "express";

// Rutas
import usersRoutes from "./routes/users.routes.js";
import authRoutes from "./routes/auth.routes.js";
import lotesRoutes from "./routes/lotes.routes.js";
import productoresRoutes from "./routes/productores.routes.js";
import ordenesRoutes from "./routes/ordenes.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Rutas API
app.use("/api/users", usersRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/lotes", lotesRoutes);
app.use("/api/productores", productoresRoutes);
app.use("/api/ordenes", ordenesRoutes);

// Ruta base
app.get("/", (req, res) => {
  res.send("Servidor del Sistema de Lotes funcionando correctamente 🚀");
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor backend escuchando en http://localhost:${PORT}`);
});
