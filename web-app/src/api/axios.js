import axios from "axios";
import { API_BASE_URL } from "../utils/apiConfig";
import { tokenStore } from "../utils/tokenStore";

let authFailureHandler = null;

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
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const hadToken = Boolean(tokenStore.get());
    const skipAuthFailureHandler = Boolean(error.config?._skipAuthFailureHandler);

    if (status === 401 && hadToken && !skipAuthFailureHandler && authFailureHandler) {
      authFailureHandler();
    }

    const backendMessage = error.response?.data?.error || error.response?.data?.message;

    if (backendMessage) {
      error.message = backendMessage;
    } else if (error.code === "ECONNABORTED") {
      error.message = "La solicitud al servidor excedio el tiempo de espera";
    } else if (!error.response) {
      error.message = "No se pudo conectar con el backend. Verifica VITE_API_URL y CORS en produccion";
    }

    return Promise.reject(error);
  }
);

export default api;