import crypto from "crypto";
import { admin } from "../utils/firebase.js";

const getSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET no configurado");
  }

  return secret;
};

const base64url = (input) => Buffer.from(JSON.stringify(input)).toString("base64url");
const sign = (payload) => {
  const header = { alg: "HS256", typ: "JWT" };
  const data = base64url(header) + "." + base64url(payload);
  const signature = crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
  return data + "." + signature;
};

const verify = (token) => {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error("Token inválido");
  const [h, p, s] = parts;
  const expected = crypto.createHmac("sha256", getSecret()).update(h + "." + p).digest("base64url");
  if (s !== expected) throw new Error("Firma inválida");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  if (payload.exp && Date.now() > payload.exp) throw new Error("Token expirado");
  return payload;
};

const isAuthConfigError = (error) => String(error?.message || "").includes("JWT_SECRET no configurado");

export const requireAuth = (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No autenticado" });
    const payload = verify(token);
    req.user = payload;
    next();
  } catch (e) {
    if (isAuthConfigError(e)) {
      return res.status(500).json({ error: "Configuración de autenticación incompleta" });
    }

    return res.status(401).json({ error: "No autenticado" });
  }
};

export const requireFirebaseAuth = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No autenticado" });
    
    try {
      // Verificar token de Firebase
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role || "Productor",
        firebaseClaims: decodedToken
      };
      next();
    } catch (firebaseError) {
      // Si falla Firebase, intentar con JWT tradicional
      try {
        const payload = verify(token);
        req.user = payload;
        next();
      } catch (jwtError) {
        if (isAuthConfigError(jwtError)) {
          return res.status(500).json({ error: "Configuración de autenticación incompleta" });
        }

        return res.status(401).json({ error: "Token inválido" });
      }
    }
  } catch (e) {
    if (isAuthConfigError(e)) {
      return res.status(500).json({ error: "Configuración de autenticación incompleta" });
    }

    return res.status(401).json({ error: "No autenticado" });
  }
};

export const requireRole = (roles) => (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Acceso denegado" });
    next();
  } catch (e) {
    return res.status(403).json({ error: "Acceso denegado" });
  }
};

export const makeToken = (payload, ttlMs = 24 * 60 * 60 * 1000) => {
  const exp = Date.now() + ttlMs;
  return sign({ ...payload, exp });
};