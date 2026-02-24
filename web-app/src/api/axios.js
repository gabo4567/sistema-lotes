import axios from "axios";

const apiBase = (() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  // https://x547v1rs-3000.brs.devtunnels.ms/localhost

  // http://localhost:5173

  const env = import.meta.env.VITE_API_URL;

  // Si estamos en DevTunnels, apuntar al backend -3000 independientemente del puerto del frontend
  const isTunnel = /devtunnels\.ms/.test(origin) && /-\d{4}\./.test(origin);
  if (isTunnel) {
    const backendOrigin = origin.replace(/-\d{4}\./, '-3000.');
    return backendOrigin.replace(/\/$/, '') + '/api';
  }
  // Si hay env pero es http y la página es https, evitar mixed content usando el mismo origin
  if (env) {
    const isEnvHttp = /^http:\/\//i.test(env);
    const isPageHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (isEnvHttp && isPageHttps) {
      return origin.replace(/\/$/, '') + '/api';
    }
    return env;
  }
  return origin.replace(/\/$/, '') + '/api';
})();

const api = axios.create({
  baseURL: apiBase,
  withCredentials: false,
  timeout: 10000,
});

// Interceptor para añadir token si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // o usar context
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
