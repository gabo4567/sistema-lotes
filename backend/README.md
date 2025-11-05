# 🟢 Backend – Sistema de Gestión de Lotes de Tabaco y Turnos para Productores

**Descripción breve:**
🚀 API REST desarrollada en Node.js + Express, que provee todos los servicios necesarios para la gestión integral de lotes de tabaco, productores, órdenes, mediciones, informes y turnos del Instituto Provincial del Tabaco (Goya, Corrientes).

---

## 📌 Objetivo del backend

El backend es el núcleo del sistema, responsable de administrar la lógica de negocio, la autenticación y la persistencia de datos.
Permite que tanto la aplicación web como la móvil interactúen de forma segura y eficiente, garantizando consistencia en la gestión de información de los productores.

---

## ⚙️ Principales características

- ✅ Autenticación y seguridad con JWT.
- ✅ CRUD completo para las colecciones principales (usuarios, lotes, productores, órdenes, mediciones y turnos).
- ✅ Control de estado y conteo de turnos activos, pendientes y completados.
- ✅ Informes automáticos sobre producción y actividad de los productores.
- ✅ Estructura escalable y modular, con controladores y rutas organizadas.
- ✅ Compatibilidad con Postman Collection incluida para testeo de endpoints.
- ✅ Integración lista para sincronizar con Firebase y la app móvil.

---

## 🧩 Endpoints disponibles

Actualmente, el backend cuenta con 43 endpoints funcionales distribuidos de la siguiente forma:

| **Módulo**            | **Endpoints** | **Descripción principal**                           |
| :-------------------- | :-----------: | :-------------------------------------------------- |
| 👤 **Usuarios**       |       5       | Registro, login, verificación y roles               |
| 🌾 **Lotes**          |       6       | CRUD completo + filtrado por productor              |
| 👨‍🌾 **Productores** |       7       | CRUD + vinculación con lotes                        |
| 📦 **Órdenes**        |       7       | Creación, modificación y control de estado          |
| 🌡️ **Mediciones**    |       6       | Registro de progreso y análisis del cultivo         |
| 📅 **Turnos**         |       8       | Solicitud, gestión, cancelación y conteo por estado |
| 📊 **Informes**       |       4       | Estadísticas, exportación y métricas generales      |


🧪 La colección completa de Postman se encuentra en
backend/sistema-lotes.postman_collection.json.

---

## 🛠️ Tecnologías utilizadas

- Node.js – entorno de ejecución de JavaScript

- Express.js – framework para la creación de APIs REST

- Firebase Admin SDK – conexión y sincronización con base de datos

- JWT (JSON Web Token) – autenticación y autorización segura

- dotenv – manejo de variables de entorno

- Nodemon – recarga automática en desarrollo

---

## 🧱 Estructura del backend
```
backend/
│
├── src/
│   ├── controllers/        # Controladores de cada módulo
│   ├── routes/             # Definición de rutas Express
│   ├── middlewares/        # Autenticación y validaciones
│   ├── config/             # Configuración general y conexión Firebase
│   └── utils/              # Funciones auxiliares
│
├── sistema-lotes.postman_collection.json  # Colección de endpoints
├── package.json
├── .env.example
└── README.md
```

---

## 🚀 Instalación y ejecución

- Clonar el repositorio
   ```
   git clone https://github.com/gabo4567/sistema-lotes.git
   cd sistema-lotes/backend
   ```

- Instalar dependencias
   ```
   npm install
   ```

- Configurar variables de entorno
   
   Crear un archivo .env en la raíz del backend con las siguientes variables:
   ```
   PORT=3000
   FIREBASE_PROJECT_ID=...
   FIREBASE_PRIVATE_KEY=...
   FIREBASE_CLIENT_EMAIL=...
   JWT_SECRET=...
   ```

- Iniciar el servidor
   ```
   npm start
   ```

- Por defecto, el servidor se ejecuta en:
   ```
   http://localhost:3000
   ```
   
---

## 🧪 Pruebas y colección de Postman

- Importar el archivo sistema-lotes.postman_collection.json en Postman.

- Probar los endpoints autenticados generando un Access Token mediante login.

- La API permite filtrar y ordenar resultados, además de incluir paginación básica.

- 📈 Futuras mejoras

- 🔐 Implementar roles y permisos avanzados por tipo de usuario

- 📤 Generación automática de reportes en PDF

- 📩 Notificaciones push a la app móvil

- 🧭 Endpoints para métricas detalladas por campaña

---

## 👥 Equipo de desarrollo

| **Integrante**               | **Rol en el proyecto**                                                                                      |
| :--------------------------- | :---------------------------------------------------------------------------------------------------------- |
| 🧑‍💻 **Juan Gabriel Pared** | Coordinación general del proyecto, desarrollo del **backend** y de la **aplicación móvil** para productores |
| 💻 **Bautista Capovilla**    | Desarrollo de la **aplicación web** para administradores del sistema                                        |

---

## 📬 Contacto

Para consultas o más información, contactar con el **equipo organizador del proyecto**.

---

