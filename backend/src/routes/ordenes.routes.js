// src/routes/ordenes.routes.js
import express from "express";
import { createOrden, getAllOrdenes, getInactiveOrdenes, getOrdenById, updateOrden, deleteOrden, getInsumos } from "../controllers/ordenes.controller.js";
import { idempotency } from "../middlewares/idempotency.js";

const router = express.Router();

router.post("/", idempotency(), createOrden);
router.get("/", getAllOrdenes);
router.get("/insumos", getInsumos);
router.get("/inactivas", getInactiveOrdenes); // ✅ Endpoint para órdenes inactivas
router.get("/:id", getOrdenById);
router.put("/:id", idempotency(), updateOrden);
router.delete("/:id", idempotency(), deleteOrden); // soft delete

export default router;
