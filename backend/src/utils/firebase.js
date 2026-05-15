// src/utils/firebase.js
import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Cargar variables de entorno en desarrollo
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env" });
}

// 🔐 Leer credenciales desde variable de entorno (Render) o archivo local (desarrollo)
let serviceAccount;

const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

if (rawServiceAccount) {
  // Producción: leer desde variable de entorno
  try {
    serviceAccount = JSON.parse(rawServiceAccount);
  } catch (error) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT tiene un formato JSON inválido");
  }
} else if (process.env.NODE_ENV !== "production") {
  // Desarrollo: leer desde archivo serviceAccountKey.json
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const keyPath = path.join(__dirname, "../../serviceAccountKey.json");
    
    if (fs.existsSync(keyPath)) {
      const keyContent = fs.readFileSync(keyPath, "utf8");
      serviceAccount = JSON.parse(keyContent);
      console.log("✅ Credenciales Firebase cargadas desde serviceAccountKey.json");
    } else {
      throw new Error(`Archivo serviceAccountKey.json no encontrado en ${keyPath}`);
    }
  } catch (error) {
    throw new Error(`No se pudo cargar las credenciales de Firebase: ${error.message}`);
  }
} else {
  throw new Error("FIREBASE_SERVICE_ACCOUNT no configurado en producción");
}

// Inicializar Firebase solo una vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export { admin, db };