import axios from "axios";
import { API_BASE_URL } from "../utils/apiConfig";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
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