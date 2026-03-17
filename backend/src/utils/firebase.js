// src/utils/firebase.js
import admin from "firebase-admin";

// 🔐 Leer credenciales desde variable de entorno (Render)
const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!rawServiceAccount) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT no configurado");
}

let serviceAccount;

try {
  serviceAccount = JSON.parse(rawServiceAccount);
} catch (error) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT tiene un formato JSON inválido");
}

// Inicializar Firebase solo una vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export { admin, db };