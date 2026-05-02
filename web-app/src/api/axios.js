import axios from "axios";
import { API_BASE_URL } from "../utils/apiConfig";
import { tokenStore } from "../utils/tokenStore";

let authFailureHandler = null;
let backendWarmedUp = false;
const inFlight = new Map();

const generateIdempotencyKey = () => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {}
  const rand = Math.random().toString(16).slice(2);
  return `k_${Date.now().toString(16)}_${rand}`;
};

export const setAuthFailureHandler = (handler) => {
  authFailureHandler = typeof handler === "function" ? handler : null;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.timeout = backendWarmedUp ? 10000 : Math.max(Number(config.timeout || 0) || 0, 25000);
  return config;
});

api.interceptors.response.use(
  (response) => {
    backendWarmedUp = true;
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const hadToken = Boolean(tokenStore.get());
    const skipAuthFailureHandler = Boolean(error.config?._skipAuthFailureHandler);

    if (status === 401 && hadToken && !skipAuthFailureHandler && authFailureHandler) {
      authFailureHandler();
    }

    const config = error.config || {};
    const method = String(config.method || "get").toLowerCase();
    const maxRetries = typeof config._maxRetries === "number" ? config._maxRetries : 2;
    const retryCount = Number(config._retryCount || 0);
    const canRetryMethod = method === "get";
    const isTimeout = error.code === "ECONNABORTED";
    const isNetworkError = !error.response;
    const isRetryableStatus = status === 502 || status === 503 || status === 504 || (typeof status === "number" && status >= 500);
    const shouldRetry = canRetryMethod && retryCount < maxRetries && (isTimeout || isNetworkError || isRetryableStatus);

    if (shouldRetry) {
      config._retryCount = retryCount + 1;
      config.timeout = config._retryCount > 0 ? 15000 : Math.max(Number(config.timeout || 0) || 0, 25000);
      const delayMs = 900 * config._retryCount;
      await new Promise((r) => setTimeout(r, delayMs));
      config._dedupe = false;
      return api(config);
    }

    const backendMessage = error.response?.data?.error || error.response?.data?.message;

    if (backendMessage) {
      error.message = backendMessage;
    } else if (error.code === "ECONNABORTED") {
      const browserOffline = typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.onLine === false;
      error.message = backendWarmedUp
        ? (browserOffline ? "Sin conexión a internet." : "El servidor está demorando en responder. Reintentá en unos segundos.")
        : (browserOffline ? "Sin conexión a internet." : "Conectando al servidor… puede demorar al iniciar. Reintentá en unos segundos.");
    } else if (!error.response) {
      const browserOffline = typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.onLine === false;
      error.message = backendWarmedUp
        ? (browserOffline ? "Sin conexión a internet." : "No se pudo conectar con el servidor. Verificá tu conexión a internet.")
        : (browserOffline ? "Sin conexión a internet." : "Conectando al servidor… puede demorar al iniciar. Reintentá en unos segundos.");
    }

    return Promise.reject(error);
  }
);

const stableStringify = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  if (value instanceof Date) return value.toISOString();
  const proto = Object.getPrototypeOf(value);
  if (proto && proto !== Object.prototype) return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${k}:${stableStringify(value[k])}`).join(",")}}`;
};

const buildLockKey = (config) => {
  const method = String(config?.method || "get").toLowerCase();
  const url = String(config?.baseURL || "") + String(config?.url || "");
  const params = stableStringify(config?.params);
  const data = typeof config?.data === "string" ? config.data : stableStringify(config?.data);
  return `${method} ${url} ${params} ${data}`;
};

const originalRequest = api.request.bind(api);
api.request = (config) => {
  const method = String(config?.method || "get").toLowerCase();
  const isMutating = method === "post" || method === "put" || method === "patch" || method === "delete";
  if (config && isMutating) {
    const headers = (config.headers && typeof config.headers === "object") ? config.headers : {};
    const existingKey = headers["Idempotency-Key"] || headers["idempotency-key"] || headers["X-Idempotency-Key"] || headers["x-idempotency-key"];
    if (!existingKey) {
      const key = config._idempotencyKey ? String(config._idempotencyKey) : generateIdempotencyKey();
      headers["Idempotency-Key"] = key;
      config.headers = headers;
      config._idempotencyKey = key;
    }
  }

  if (config && config._dedupe === false) {
    return originalRequest(config);
  }
  const key = config && config._lockKey ? String(config._lockKey) : buildLockKey(config || {});
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = Promise.resolve(originalRequest(config)).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, p);
  return p;
};

export default api;
