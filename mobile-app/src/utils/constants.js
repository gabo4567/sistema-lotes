// src/utils/constants.js

export const COLORS = {
  primary: "#228B22",
  secondary: "#F4A300",
};

// URL de tu backend de prueba o localhost
const FALLBACK_URL = "http://192.168.1.10:3000"; // reemplaza con la IP de tu PC si pruebas en red local

let base = FALLBACK_URL;

// Para desarrollo en Expo Go
if (__DEV__) {
  const { NativeModules } = require("react-native");
  const ENV_URL = process.env.EXPO_PUBLIC_API_URL;
  const scriptURL = NativeModules.SourceCode?.scriptURL || "";
  const m = scriptURL.match(/^[a-z]+:\/\/([^:/]+)(?::\d+)?/);
  const host = m ? m[1] : "localhost";
  base = ENV_URL || `http://${host}:3000`;
}

base = String(base).replace(/\/+$/, "");
export const API_URL = base.endsWith("/api") ? base : `${base}/api`;
