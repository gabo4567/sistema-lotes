import { getApp, getApps, initializeApp } from "firebase/app";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIRE_API_KEY,
  authDomain: import.meta.env.VITE_FIRE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIRE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIRE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIRE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIRE_APP_ID,
};

const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
];

if (import.meta.env.PROD) {
  const missing = requiredKeys.filter((key) => !String(firebaseConfig[key] || "").trim());
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno de Firebase en producción: ${missing.join(", ")}`);
  }
}

export const getFirebaseApp = () => {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(firebaseConfig);
};