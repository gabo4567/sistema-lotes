import { getApp, getApps, initializeApp } from "firebase/app";

const readEnv = (primary, legacy) => import.meta.env[primary] || import.meta.env[legacy] || "";

export const firebaseConfig = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY", "VITE_FIRE_API_KEY"),
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIRE_AUTH_DOMAIN"),
  projectId: readEnv("VITE_FIREBASE_PROJECT_ID", "VITE_FIRE_PROJECT_ID"),
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET", "VITE_FIRE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIRE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID", "VITE_FIRE_APP_ID"),
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