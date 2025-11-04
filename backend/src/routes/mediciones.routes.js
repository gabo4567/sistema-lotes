import { Router } from "express";
import {
  crearMedicion,
  obtenerMediciones,
  obtenerMedicionesInactivas,
  obtenerMedicionPorId,
  actualizarMedicion,
  eliminarMedicion,
} from "../controllers/mediciones.controller.js";

const router = Router();

router.post("/", crearMedicion);
router.get("/", obtenerMediciones);
router.get("/inactivos", obtenerMedicionesInactivas);
router.get("/:id", obtenerMedicionPorId);
router.put("/:id", actualizarMedicion);
router.delete("/:id", eliminarMedicion);

export default router;
