// src/routes/productores.routes.js
import express from "express";
import {
  createProductor,
  getAllProductores,
  getInactiveProductores,
  getProductorById,
  getProductorByIpt,
  updateProductor,
  deleteProductor,
  resetPasswordProductor,
  marcarReempadronado,
  historialIngresos,
  setPushToken,
} from "../controllers/productores.controller.js";

const router = express.Router();

router.post("/", createProductor);
router.get("/", getAllProductores);
router.get("/inactivos", getInactiveProductores); // ✅ Endpoint para productores inactivos
router.get("/ipt/:ipt", getProductorByIpt);
router.get("/:ipt/historial", historialIngresos);
router.post("/ipt/:ipt/push-token", setPushToken);
router.get("/:id", getProductorById);
router.put("/:id", updateProductor);
router.delete("/:id", deleteProductor); // ahora hace soft delete
router.post("/reset-password/:ipt", resetPasswordProductor);
router.post("/reempadronado/:ipt", marcarReempadronado);

export default router;
