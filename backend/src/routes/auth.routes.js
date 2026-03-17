// src/routes/auth.routes.js
import express from "express";
import { registerUser, loginUser, loginProductor, cambiarPasswordProductor, resetPasswordLink, registerProductor } from "../controllers/auth.controller.js";
import { createRateLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();

const loginRateLimiter = createRateLimiter({
	name: "auth-login",
	windowMs: 60 * 1000,
	max: 8,
	keySelector: (req) => String(req.body?.email || "").trim().toLowerCase(),
	message: "Demasiados intentos de inicio de sesión. Intente nuevamente en unos minutos.",
});

const productorLoginRateLimiter = createRateLimiter({
	name: "auth-login-productor",
	windowMs: 60 * 1000,
	max: 8,
	keySelector: (req) => String(req.body?.ipt || "").trim(),
	message: "Demasiados intentos de inicio de sesión. Intente nuevamente en unos minutos.",
});

const resetPasswordRateLimiter = createRateLimiter({
	name: "auth-reset-password",
	windowMs: 60 * 1000,
	max: 5,
	keySelector: (req) => String(req.body?.email || "").trim().toLowerCase(),
	message: "Demasiados intentos de recuperación de contraseña. Intente nuevamente más tarde.",
});

router.post("/register", registerUser);
router.post("/login", loginRateLimiter, loginUser);
router.post("/login-productor", productorLoginRateLimiter, loginProductor);
router.post("/productor/cambiar-password", cambiarPasswordProductor);
router.post("/reset-password-link", resetPasswordRateLimiter, resetPasswordLink);
router.post("/register-productor", registerProductor);

export default router;
