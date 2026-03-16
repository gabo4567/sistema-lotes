// mobile-app/src/utils/constants.js

export const COLORS = {
  primary: "#228B22",
  secondary: "#F4A300",
};

// URL del backend de producción
const PROD_URL = "https://sistema-lotes-backend.onrender.com";

// URL de fallback para desarrollo local
const DEV_URL = "http://192.168.1.10:3000"; // reemplaza con la IP de tu backend local si pruebas en red local

let base = process.env.EXPO_PUBLIC_API_URL || PROD_URL;

// Para desarrollo en Expo Go
if (__DEV__) {
  const { NativeModules } = require("react-native");
  const ENV_URL = process.env.EXPO_PUBLIC_API_URL;
  const scriptURL = NativeModules.SourceCode?.scriptURL || "";
  const m = scriptURL.match(/^[a-z]+:\/\/([^:/]+)(?::\d+)?/);
  const host = m ? m[1] : "localhost";

  // Usa la variable de entorno si está definida, sino DEV_URL
  base = ENV_URL || `${DEV_URL}`;
}

base = String(base).replace(/\/+$/, "");
export const API_URL = base.endsWith("/api") ? base : `${base}/api`;