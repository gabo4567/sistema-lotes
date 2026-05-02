// src/routes/lotes.routes.js
import express from "express";
import { createLote, getAllLotes, getInactiveLotes, getLoteById, getLoteHistorial, updateLote, deleteLote, getLotesByIpt, cambiarEstadoLote } from "../controllers/lotes.controller.js";
import { idempotency } from "../middlewares/idempotency.js";

const router = express.Router();

router.post("/", idempotency(), createLote);
router.get("/", getAllLotes);
router.get("/inactivos", getInactiveLotes); // ✅ Endpoint para lotes inactivos
router.get("/productor/:ipt", getLotesByIpt);
router.get("/:id/historial", getLoteHistorial);
router.get("/:id", getLoteById);
router.put("/:id", idempotency(), updateLote);
router.patch("/:id/estado", idempotency(), cambiarEstadoLote);
router.delete("/:id", idempotency(), deleteLote);

export default router;
