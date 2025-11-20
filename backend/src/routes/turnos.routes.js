// src/routes/turnos.routes.js

console.log("✅ turnos.routes.js cargado correctamente");

import { Router } from "express";
import {
  crearTurno,
  obtenerTurnos,
  obtenerTurnoPorId,
  actualizarTurno,
  cambiarEstadoTurno,
  eliminarTurno,
  obtenerTurnosPorEstado,
  obtenerTurnosPorProductor,
  obtenerTurnosPorRangoFechas,
  disponibilidadTurno,
} from "../controllers/turnos.controller.js";

const router = Router();

// 🧪 Endpoint de prueba
router.get("/ping", (req, res) => {
  res.json({ message: "Turnos API funcionando ✅" });
});

// CRUD principal
router.post("/", crearTurno);
router.get("/", obtenerTurnos);
router.get("/:id", obtenerTurnoPorId);
router.put("/:id", actualizarTurno);
router.patch("/:id/estado", cambiarEstadoTurno);
router.delete("/:id", eliminarTurno);

// 📊 Endpoints complementarios
router.get("/estado/:estado", obtenerTurnosPorEstado);
router.get("/productor/:productorId", obtenerTurnosPorProductor);
router.get("/filtro/fechas", obtenerTurnosPorRangoFechas);
router.get("/disponibilidad", disponibilidadTurno);

export default router;
