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
  registrarAsistenciaTurno,
  obtenerHistorialTurno,
  obtenerTimelineTurno,
} from "../controllers/turnos.controller.js";
import { idempotency } from "../middlewares/idempotency.js";
import { createRateLimiter } from "../middlewares/rateLimit.js";

const disponibilidadLimiter = createRateLimiter({
  name: "turnos-disponibilidad",
  windowMs: 60 * 1000,
  max: 30,
  message: "Demasiadas consultas de disponibilidad. Intente en un momento.",
});

const crearTurnoLimiter = createRateLimiter({
  name: "turnos-crear",
  windowMs: 60 * 1000,
  max: 10,
  message: "Demasiadas solicitudes de turno. Intente en un momento.",
});

const router = Router();

// 🧪 Endpoint de prueba
router.get("/ping", (req, res) => {
  res.json({ message: "Turnos API funcionando ✅" });
});

// 📊 Endpoint público - disponibilidad (sin autenticación)
router.get("/disponibilidad", disponibilidadLimiter, disponibilidadTurno);

// CRUD principal - requiere autenticación
router.post("/", crearTurnoLimiter, idempotency(), crearTurno);
router.get("/", obtenerTurnos);
router.get("/config", obtenerConfigTurnos);
router.put("/config", idempotency(), upsertConfigTurnos);
router.get("/capacidad", obtenerCapacidadTurnoDia);
router.put("/capacidad/:fecha", idempotency(), upsertCapacidadTurnoDia);
router.post("/asistencia", idempotency(), registrarAsistenciaTurno);
router.get("/:id/historial", obtenerHistorialTurno);
router.get("/:id/timeline", obtenerTimelineTurno);
router.get("/:id", obtenerTurnoPorId);
router.put("/:id", idempotency(), actualizarTurno);
router.patch("/:id/estado", idempotency(), cambiarEstadoTurno);
router.patch("/:id/restaurar", idempotency(), restaurarTurno);
router.delete("/:id", idempotency(), eliminarTurno);

// 📊 Endpoints complementarios - requieren autenticación
router.get("/estado/:estado", obtenerTurnosPorEstado);
router.get("/productor/:productorId", obtenerTurnosPorProductor);
router.get("/filtro/fechas", obtenerTurnosPorRangoFechas);

export default router;
