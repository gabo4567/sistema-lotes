const express = require('express');
const router = express.Router();
const { db } = require('../utils/firebase');

// 📌 Ruta para obtener todos los usuarios
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// 📌 Ruta para crear un usuario nuevo
router.post('/', async (req, res) => {
  try {
    const { nombre, email } = req.body;
    if (!nombre || !email) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const newUser = { nombre, email, creado: new Date() };
    const docRef = await db.collection('users').add(newUser);

    res.json({ id: docRef.id, ...newUser });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

module.exports = router;
