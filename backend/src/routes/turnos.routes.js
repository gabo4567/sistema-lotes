// src/routes/turnos.routes.js

import { Router } from "express";
import {
  crearTurno,
  obtenerTurnos,
  obtenerConfigTurnos,
  upsertConfigTurnos,
  obtenerCapacidadTurnoDia,
  upsertCapacidadTurnoDia,
  obtenerTurnoPorId,
  actualizarTurno,
  cambiarEstadoTurno,
  eliminarTurno,
  restaurarTurno,
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

// 📊 Endpoint público - disponibilidad (sin autenticación)
router.get("/disponibilidad", disponibilidadTurno);

// CRUD principal - requiere autenticación
router.post("/", crearTurno);
router.get("/", obtenerTurnos);
router.get("/config", obtenerConfigTurnos);
router.put("/config", upsertConfigTurnos);
router.get("/capacidad", obtenerCapacidadTurnoDia);
router.put("/capacidad/:fecha", upsertCapacidadTurnoDia);
router.get("/:id", obtenerTurnoPorId);
router.put("/:id", actualizarTurno);
router.patch("/:id/estado", cambiarEstadoTurno);
router.patch("/:id/restaurar", restaurarTurno);
router.delete("/:id", eliminarTurno);

// 📊 Endpoints complementarios - requieren autenticación
router.get("/estado/:estado", obtenerTurnosPorEstado);
router.get("/productor/:productorId", obtenerTurnosPorProductor);
router.get("/filtro/fechas", obtenerTurnosPorRangoFechas);

export default router;
