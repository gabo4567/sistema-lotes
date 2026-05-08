// src/services/auditoriaTurnos.service.js
import { db } from "../utils/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

export const registrarAuditoriaTurno = async ({
  turnoId,
  accion,
  estadoAnterior = null,
  estadoNuevo = null,
  motivo = null,
  realizadoPor = {},
  origen = {},
  automatico = false,
}) => {
  try {
    const doc = {
      turnoId: String(turnoId || ""),
      accion: String(accion || ""),
      estadoAnterior: estadoAnterior ?? null,
      estadoNuevo: estadoNuevo ?? null,
      motivo: motivo ?? null,
      realizadoPor: {
        uid: String(realizadoPor?.uid || "sistema"),
        nombre: String(realizadoPor?.nombre || "Sistema"),
        rol: String(realizadoPor?.rol || "sistema"),
      },
      origen: {
        tipo: String(origen?.tipo || "sistema"),
        dispositivo: origen?.dispositivo ? String(origen.dispositivo) : null,
      },
      automatico: Boolean(automatico),
      createdAt: Timestamp.now(),
    };
    await db.collection("turnosHistorial").add(doc);
  } catch (err) {
    console.error("[AuditoriaTurnos] Error registrando auditoría:", err?.message || err);
  }
};

export const buildRealizadoPor = (req) => {
  const uid = req?.user?.uid || "sistema";
  const claims = req?.user?.firebaseClaims || {};
  const nombre = claims?.nombre || req?.user?.displayName || req?.user?.email || uid;
  const rol = String(req?.user?.role || claims?.role || "sistema");
  return { uid, nombre, rol };
};

export const buildOrigen = (req) => {
  const xSource = String(req?.headers?.["x-app-source"] || req?.headers?.["x-origen"] || "").toLowerCase();
  const ua = String(req?.headers?.["user-agent"] || "").toLowerCase();

  let tipo;
  if (xSource === "mobile" || xSource === "app") tipo = "mobile";
  else if (xSource === "backend" || xSource === "sistema") tipo = "backend";
  else if (xSource) tipo = xSource;
  else if (ua.includes("expo") || ua.includes("react-native")) tipo = "mobile";
  else tipo = "web-admin";

  const isMobile =
    ua.includes("mobile") || ua.includes("android") || ua.includes("ios") || tipo === "mobile";
  return { tipo, dispositivo: isMobile ? "mobile" : "desktop" };
};
