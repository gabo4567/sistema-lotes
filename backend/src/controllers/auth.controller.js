// src/controllers/auth.controller.js
import { db, admin } from "../utils/firebase.js";

// Registrar usuario
export const registerUser = async (req, res) => {
  try {
    const { email, password, nombre } = req.body;

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nombre,
    });

    await db.collection("users").doc(userRecord.uid).set({
      email,
      nombre,
      createdAt: new Date(),
    });

    res.json({
      message: "✅ Usuario creado correctamente",
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        nombre: userRecord.displayName,
      },
    });
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    res.status(500).json({ error: error.message });
  }
};

// Login de usuario
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    // Firebase Admin no valida password directamente, se puede generar un token custom
    const user = await admin.auth().getUserByEmail(email);

    // Generar un custom token (para autenticar desde la app)
    const token = await admin.auth().createCustomToken(user.uid);

    res.json({
      message: "✅ Login exitoso",
      uid: user.uid,
      token,
    });
  } catch (error) {
    console.error("Error al hacer login:", error);
    res.status(500).json({ error: error.message });
  }
};
