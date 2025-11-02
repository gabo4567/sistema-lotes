const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para JSON
app.use(express.json());

// Importar rutas
const usersRoutes = require('./routes/users.routes');

// Usar rutas
app.use('/api/users', usersRoutes);

// Ruta base
app.get('/', (req, res) => {
  res.send('Servidor del Sistema de Lotes funcionando correctamente 🚀');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor backend escuchando en http://localhost:${PORT}`);
});
