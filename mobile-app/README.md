# 📱 Aplicación Móvil – Sistema Integrado de Lotes de Tabaco

- Instituto Provincial del Tabaco – Goya, Corrientes, Argentina
- Proyecto: Sistema Integrado con Geolocalización para Lotes de Tabaco
- Módulo: Aplicación móvil para productores

---

## 🧭 Descripción general

- La aplicación móvil forma parte del sistema integrado desarrollado para el Instituto Provincial del Tabaco, permitiendo a los productores gestionar su producción, visualizar sus lotes geolocalizados, solicitar turnos, y recibir notificaciones de manera simple y eficiente.

- Esta app está desarrollada con React Native y conectada al backend general del sistema mediante API REST segura con JWT, garantizando sincronización de datos, funcionamiento offline y compatibilidad multiplataforma (Android / iOS).

---

## 🧱 Arquitectura general

| Capa                    | Tecnología            | Descripción                                                                                |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| 📱 **Frontend móvil**   | React Native          | Desarrollo multiplataforma con interfaz moderna, optimizada para usabilidad y rendimiento. |
| ⚙️ **Backend**          | Node.js + Express     | API REST centralizada con autenticación JWT y conexión a Firebase.                         |
| ☁️ **Base de datos**    | Firebase              | Almacenamiento en la nube con soporte offline y sincronización automática.                 |
| 🗺️ **Geolocalización** | Google Maps API       | Permite marcar, visualizar y analizar los lotes de cada productor.                         |
| 🔒 **Autenticación**    | JSON Web Tokens (JWT) | Acceso seguro con roles definidos y expiración de sesión.                                  |


---

## 🧩 Requerimientos funcionales principales (RF)

| Categoría                    | Código  | Descripción resumida                                                                   |
| ---------------------------- | ------- | -------------------------------------------------------------------------------------- |
| 👤 **Gestión de usuarios**   | RF1–RF2 | Inicio de sesión, cambio de contraseña y autenticación segura.                         |
| 🌾 **Seguimiento de lotes**  | RF3–RF5 | Registro geolocalizado de lotes, mediciones y visualización del progreso productivo.   |
| 💬 **Comunicación**          | RF6     | Recepción de notificaciones, avisos y mensajes desde el sistema administrativo.        |
| 📅 **Gestión de turnos**     | RF7–RF8 | Consulta, reserva, modificación y cancelación de turnos de atención.                   |
| 🧺 **Entrega de insumos**    | RF9     | Visualización de disponibilidad y gestión de turnos según stock disponible.            |
| 🪪 **Renovación de carnet**  | RF10    | Consulta del estado del carnet y gestión del turno anual de renovación.                |
| 📶 **Funcionalidad offline** | RF13    | Permite registrar y consultar datos sin conexión, sincronizando automáticamente luego. |
| 📊 **Informes resumidos**    | RF15    | Muestra información clave del productor: próximas fechas, entregas y estados.          |

---

## ⚙️ Requerimientos no funcionales (RNF)

| Código                       | Descripción                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| 🔒 **RNF1 – Seguridad**      | Datos protegidos con cifrado y autenticación JWT.                                  |
| 🎯 **RNF2 – Usabilidad**     | Interfaz intuitiva, pensada para usuarios con conocimientos básicos de tecnología. |
| 📱 **RNF3 – Compatibilidad** | Soporte para Android e iOS.                                                        |
| ⚡ **RNF4 – Rendimiento**     | Carga ágil de datos, mapas y turnos.                                               |
| 🔁 **RNF5 – Disponibilidad** | Modo offline y sincronización automática.                                          |
| 🧩 **RNF6 – Mantenibilidad** | Código modular, documentado y escalable.                                           |

---

## 🧭 Funcionalidades destacadas

- 🗺️ Registro y geolocalización de lotes en mapa interactivo.

- 🌱 Carga y seguimiento del estado de cultivo y mediciones.

- 📅 Gestión de turnos y notificaciones del Instituto.

- 📦 Consulta de disponibilidad de insumos.

- 🪪 Seguimiento del estado de renovación del carnet.

- 📶 Operatividad sin conexión y sincronización automática.

---

## 🧰 Instalación y ejecución

- Clonar el repositorio
   ```
   git clone https://github.com/gabo4567/sistema-lotes.git
   cd sistema-lotes/MobileApp
   ```

- Instalar dependencias
   ```
   npm install
   ```

- Ejecutar en entorno de desarrollo
   ```
   npm start
   ```

- Luego seleccionar:
   ```
   a para abrir en Android
   
   i para abrir en iOS (si se trabaja en MacOS)
   ```
   
- Configurar variables de entorno

- Crear un archivo .env con las claves necesarias:
   ```
   API_URL=<URL_DEL_BACKEND>
   GOOGLE_MAPS_API_KEY=<CLAVE_API>
   FIREBASE_CONFIG=<CONFIGURACION_FIREBASE>
   ```

---

## 📂 Estructura del proyecto

```
MobileApp/
├── src/
│   ├── components/      # Componentes reutilizables (botones, tarjetas, inputs)
│   ├── screens/         # Pantallas principales (Login, Lotes, Turnos, etc.)
│   ├── services/        # Conexión con API y Firebase
│   ├── context/         # Contextos de usuario, autenticación y datos
│   ├── hooks/           # Hooks personalizados
│   ├── utils/           # Funciones auxiliares
│   └── assets/          # Íconos, imágenes y recursos gráficos
├── package.json
├── App.js
└── README.md
```

---

## 👨‍💻 Responsables

| 👤 **Integrante**      | 💼 **Rol**                     | 🧩 **Responsabilidad principal**                                                      |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| **Juan Gabriel Pared** | **Backend & Mobile Developer** | Coordinación general, desarrollo de la API y de la aplicación móvil para productores. |
| **Bautista Capovilla** | **Frontend Developer**         | Desarrollo de la aplicación web para administradores del sistema.                     |

---

## 📜 Licencia

- Este proyecto fue desarrollado con fines académicos en el marco del Proyecto Integrador Final del Instituto Superior.
- Su distribución o uso fuera del ámbito educativo debe contar con la autorización correspondiente.
