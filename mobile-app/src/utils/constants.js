// mobile-app/src/utils/constants.js

export const COLORS = {
  primary: "#228B22",
  secondary: "#F4A300",
};

const PROD_BACKEND_URL = "https://sistema-lotes-backend.onrender.com";

const rawBaseUrl = String(process.env.EXPO_PUBLIC_API_URL || PROD_BACKEND_URL).trim();
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, "");

export const API_URL = normalizedBaseUrl.endsWith("/api")
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/api`;

export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");