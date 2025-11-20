// src/routes/lotes.routes.js
import express from "express";
import { createLote, getAllLotes, getInactiveLotes, getLoteById, updateLote, deleteLote, getLotesByIpt, cambiarEstadoLote } from "../controllers/lotes.controller.js";

const router = express.Router();

router.post("/", createLote);
router.get("/", getAllLotes);
router.get("/inactivos", getInactiveLotes); // ✅ Endpoint para lotes inactivos
router.get("/productor/:ipt", getLotesByIpt);
router.get("/:id", getLoteById);
router.put("/:id", updateLote);
router.patch("/:id/estado", cambiarEstadoLote);
router.delete("/:id", deleteLote);

export default router;
