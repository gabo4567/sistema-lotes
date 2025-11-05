// ✅ src/routes/informes.routes.js

import { Router } from "express";
import {
  obtenerResumenGeneral,
  obtenerProductoresActivos,
  obtenerOrdenesPorMes,
  obtenerTurnosPorEstado,
  obtenerMedicionesPorLote,
  exportarPDF,
  exportarExcel,
} from "../controllers/informes.controller.js";

const router = Router();

// 🧪 Endpoint de prueba
router.get("/ping", (req, res) => {
  res.json({ message: "Informes API funcionando ✅" });
});

// 📊 Endpoints principales
router.get("/resumen-general", obtenerResumenGeneral);
router.get("/productores-activos", obtenerProductoresActivos);
router.get("/ordenes-por-mes", obtenerOrdenesPorMes);
router.get("/turnos-por-estado", obtenerTurnosPorEstado);
router.get("/mediciones-por-lote", obtenerMedicionesPorLote);

// 🧾 Exportaciones
router.get("/exportar/pdf", exportarPDF);
router.get("/exportar/excel", exportarExcel);

export default router;
