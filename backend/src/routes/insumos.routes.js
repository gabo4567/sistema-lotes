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
} from "../controllers/insumos.controller.js";

const router = Router();

router.post("/", crearInsumo);
router.get("/", listarInsumos);
router.get("/:id", obtenerInsumo);
router.put("/:id", actualizarInsumo);
router.delete("/:id", eliminarInsumo);

router.post("/:id/asignar", asignarInsumoAProductor);
router.get("/:id/asignaciones", listarAsignacionesPorInsumo);

router.get("/productor/:productorId/disponibilidad", obtenerDisponibilidadInsumosProductor);
router.post("/productor/:productorId/entregar", marcarAsignacionesEntregadas);
router.get("/productor/:productorId/asignaciones", listarAsignacionesPorProductor);
router.put("/asignaciones/:asignacionId", actualizarAsignacion);
router.delete("/productor/ipt/:ipt/asignaciones", eliminarAsignacionesPorIpt);

export default router;
