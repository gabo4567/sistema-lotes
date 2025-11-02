const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Ruta absoluta al archivo de credenciales
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

// Inicializa Firebase solo una vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = getFirestore();

module.exports = { db };
