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
import { idempotency } from "../middlewares/idempotency.js";

const router = Router();

// 🧪 Endpoint de prueba
router.get("/ping", (req, res) => {
  res.json({ message: "Turnos API funcionando ✅" });
});

// 📊 Endpoint público - disponibilidad (sin autenticación)
router.get("/disponibilidad", disponibilidadTurno);

// CRUD principal - requiere autenticación
router.post("/", idempotency(), crearTurno);
router.get("/", obtenerTurnos);
router.get("/config", obtenerConfigTurnos);
router.put("/config", idempotency(), upsertConfigTurnos);
router.get("/capacidad", obtenerCapacidadTurnoDia);
router.put("/capacidad/:fecha", idempotency(), upsertCapacidadTurnoDia);
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
