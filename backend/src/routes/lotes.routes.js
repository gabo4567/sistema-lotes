// src/routes/lotes.routes.js
import express from "express";
import { createLote, getAllLotes, getInactiveLotes, getLoteById, updateLote, deleteLote } from "../controllers/lotes.controller.js";

const router = express.Router();

router.post("/", createLote);
router.get("/", getAllLotes);
router.get("/inactivos", getInactiveLotes); // ✅ Endpoint para lotes inactivos
router.get("/:id", getLoteById);
router.put("/:id", updateLote);
router.delete("/:id", deleteLote);

export default router;
