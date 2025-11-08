import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  withCredentials: false, // true si usas cookies httpOnly
});

// Interceptor para añadir token si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // o usar context
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;