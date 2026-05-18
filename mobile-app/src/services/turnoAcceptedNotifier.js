import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../utils/constants";
import { authFetch, getCurrentAuthContext } from "../api/api";

const TURNOS_STATUS_SNAPSHOT_PREFIX = "turnos_status_snapshot_v1";
const TURNOS_ACCEPTED_NOTIFIED_PREFIX = "turnos_accepted_notified_v1";

const normalizeStoredEstado = (value) => String(value || "pendiente").toLowerCase().trim();

const getTurnoStableId = (turno) => {
  const id = turno?.id || turno?._id;
  return id ? String(id) : "";
};

const buildTurnosStatusSnapshot = (turnos) => {
  const snapshot = {};
  (Array.isArray(turnos) ? turnos : []).forEach((turno) => {
    const id = getTurnoStableId(turno);
    if (!id || id.startsWith("temp_")) return;
    snapshot[id] = {
      estado: normalizeStoredEstado(turno?.estado),
      fechaTurno: turno?.fechaTurno || turno?.fecha || "",
      tipoTurno: turno?.tipoTurno || "",
    };
  });
  return snapshot;
};

const formatTurnoNotificationDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const ddmmyyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) return value;
    const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  }
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
};

export const notifyAcceptedTurnosIfNeeded = async (productorKey, turnos) => {
  const key = String(productorKey || "").trim();
  if (!key) return;

  const snapshotKey = `${TURNOS_STATUS_SNAPSHOT_PREFIX}_${key}`;
  const notifiedKey = `${TURNOS_ACCEPTED_NOTIFIED_PREFIX}_${key}`;
  const nextSnapshot = buildTurnosStatusSnapshot(turnos);

  const prevRaw = await AsyncStorage.getItem(snapshotKey);
  if (!prevRaw) {
    await AsyncStorage.setItem(snapshotKey, JSON.stringify(nextSnapshot));
    return;
  }

  let prevSnapshot = {};
  let notified = {};
  try {
    prevSnapshot = JSON.parse(prevRaw) || {};
  } catch {}
  try {
    const notifiedRaw = await AsyncStorage.getItem(notifiedKey);
    notified = notifiedRaw ? (JSON.parse(notifiedRaw) || {}) : {};
  } catch {}

  const accepted = (Array.isArray(turnos) ? turnos : []).find((turno) => {
    const id = getTurnoStableId(turno);
    if (!id || id.startsWith("temp_") || notified[id]) return false;
    const prevEstado = normalizeStoredEstado(prevSnapshot?.[id]?.estado);
    const nextEstado = normalizeStoredEstado(turno?.estado);
    return prevEstado === "pendiente" && nextEstado === "confirmado";
  });

  await AsyncStorage.setItem(snapshotKey, JSON.stringify(nextSnapshot));

  if (!accepted) return;

  const acceptedId = getTurnoStableId(accepted);
  notified[acceptedId] = new Date().toISOString();
  await AsyncStorage.setItem(notifiedKey, JSON.stringify(notified));

  const fecha = formatTurnoNotificationDate(accepted?.fechaTurno || accepted?.fecha);
  Alert.alert(
    "Solicitud aceptada",
    fecha
      ? `Tu turno del ${fecha} fue confirmado por el IPT.`
      : "Tu turno fue confirmado por el IPT.",
    [{ text: "Ver turnos" }]
  );
};

export const checkAcceptedTurnosFromApi = async () => {
  const { ipt } = await getCurrentAuthContext();
  if (!ipt) return;
  const resp = await authFetch(`${API_URL}/turnos/productor/${ipt}?activo=true`);
  if (!resp.ok) return;
  const data = await resp.json().catch(() => []);
  if (!Array.isArray(data)) return;
  await notifyAcceptedTurnosIfNeeded(ipt, data);
};
