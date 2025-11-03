// src/routes/ordenes.routes.js
import express from "express";
import { createOrden, getAllOrdenes, getInactiveOrdenes, getOrdenById, updateOrden, deleteOrden } from "../controllers/ordenes.controller.js";

const router = express.Router();

router.post("/", createOrden);
router.get("/", getAllOrdenes);
router.get("/inactivas", getInactiveOrdenes); // ✅ Endpoint para órdenes inactivas
router.get("/:id", getOrdenById);
router.put("/:id", updateOrden);
router.delete("/:id", deleteOrden); // soft delete

export default router;
