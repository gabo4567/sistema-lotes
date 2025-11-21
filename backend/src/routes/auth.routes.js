// src/routes/auth.routes.js
import express from "express";
import { registerUser, loginUser, loginProductor, cambiarPasswordProductor, resetPasswordLink } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/login-productor", loginProductor);
router.post("/productor/cambiar-password", cambiarPasswordProductor);
router.post("/reset-password-link", resetPasswordLink);

export default router;
