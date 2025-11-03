// src/routes/productores.routes.js
import express from "express";
import { createProductor, getAllProductores, getInactiveProductores, getProductorById, updateProductor, deleteProductor } from "../controllers/productores.controller.js";

const router = express.Router();

router.post("/", createProductor);
router.get("/", getAllProductores);
router.get("/inactivos", getInactiveProductores); // ✅ Endpoint para productores inactivos
router.get("/:id", getProductorById);
router.put("/:id", updateProductor);
router.delete("/:id", deleteProductor); // ahora hace soft delete

export default router;
