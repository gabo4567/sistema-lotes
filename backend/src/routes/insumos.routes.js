import { Router } from "express";
import {
  crearInsumo,
  listarInsumos,
  obtenerInsumo,
  actualizarInsumo,
  eliminarInsumo,
  asignarInsumoAProductor,
  listarAsignacionesPorInsumo,
  obtenerDisponibilidadInsumosProductor,
  marcarAsignacionesEntregadas,
  listarAsignacionesPorProductor,
  actualizarAsignacion,
  eliminarAsignacionesPorIpt,
  actualizarTipoInsumoAsignado,
} from "../controllers/insumos.controller.js";
import { idempotency } from "../middlewares/idempotency.js";

const router = Router();

router.post("/", idempotency(), crearInsumo);
router.get("/", listarInsumos);
router.get("/:id", obtenerInsumo);
router.put("/:id", idempotency(), actualizarInsumo);
router.delete("/:id", idempotency(), eliminarInsumo);

router.post("/:id/asignar", idempotency(), asignarInsumoAProductor);
router.get("/:id/asignaciones", listarAsignacionesPorInsumo);

router.get("/productor/:productorId/disponibilidad", obtenerDisponibilidadInsumosProductor);
router.post("/productor/:productorId/entregar", idempotency(), marcarAsignacionesEntregadas);
router.get("/productor/:productorId/asignaciones", listarAsignacionesPorProductor);
router.put("/asignaciones/:asignacionId", idempotency(), actualizarAsignacion);
router.put("/asignaciones/:asignacionId/tipo", idempotency(), actualizarTipoInsumoAsignado);
router.delete("/productor/ipt/:ipt/asignaciones", idempotency(), eliminarAsignacionesPorIpt);

export default router;
