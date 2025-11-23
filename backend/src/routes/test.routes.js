// src/routes/test.routes.js

import { Router } from "express";
import { testFlujoTurno } from "../controllers/test.controller.js";

const router = Router();

// Ruta de prueba para verificar el flujo completo de turnos
router.post("/test-turno", testFlujoTurno);

export default router;