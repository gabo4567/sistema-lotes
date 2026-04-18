# 🌐 Aplicación Web - Sistema Integrado con Geolocalización para Lotes de Tabaco

**Instituto Provincial del Tabaco – Goya, Corrientes, Argentina**
Aplicación web diseñada para la **gestión administrativa**, el **control de turnos**, la **asignación de insumos**, y la **supervisión de lotes geolocalizados** de los productores tabacaleros.

---

## 🎯 Descripción general

La **Aplicación Web** está orientada al personal administrativo del Instituto Provincial del Tabaco.
Permite administrar los productores, registrar lotes, asignar turnos y controlar la entrega de insumos, con un entorno moderno, intuitivo y conectado al backend Node.js y Firebase.

---

## ⚙️ Instalación y ejecución

Para ejecutar el entorno de desarrollo:

```
# 1️⃣ Ingresar a la carpeta del proyecto web
cd web-app

# 2️⃣ Instalar las dependencias necesarias
npm install

# 3️⃣ Ejecutar el entorno de desarrollo
npm start
```

> 💡 **Requisito previo:** Tener Node.js y npm instalados correctamente.
> Se recomienda usar la versión **Node 18+** y un navegador actualizado.

---

## 🧩 Stack tecnológico

| 🧠 **Capa**         | ⚙️ **Tecnología**     | 📝 **Descripción**                                                    |
| ------------------- | --------------------- | --------------------------------------------------------------------- |
| 🖥️ Frontend Web    | React.js + Vite       | Aplicación web moderna y modular para la administración del sistema.  |
| ⚙️ Backend          | Node.js + Express     | API REST centralizada que gestiona usuarios, lotes, turnos e insumos. |
| ☁️ Base de datos    | Firebase              | Base de datos en la nube con sincronización en tiempo real.           |
| 🗺️ Geolocalización | Google Maps API       | Permite visualizar los lotes de los productores en un mapa general.   |
| 🔒 Autenticación    | JSON Web Tokens (JWT) | Seguridad, roles y gestión de sesiones protegidas.                    |

---

## 🧱 Requerimientos funcionales (RF)

| 🧩 **Categoría**            | 🏷️ **Código** | 📄 **Descripción resumida**                                                                      |
| --------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| 👤 Gestión de usuarios      | RF1–RF2        | Creación y administración de cuentas de productores. Recuperación y modificación de contraseñas. |
| 🌾 Seguimiento de lotes     | RF3–RF5        | Visualización de los lotes de todos los productores con ubicación geográfica.                    |
| 💬 Comunicación             | RF6            | Envío de mensajes, avisos y notificaciones simples a los productores.                            |
| 📅 Gestión de turnos        | RF7–RF8        | Sistema de reserva, modificación, cancelación y reprogramación de turnos.                        |
| 🧺 Entrega de insumos       | RF9            | Registro, control y modificación de entregas de insumos según disponibilidad.                    |
| 🪪 Renovación de carnet     | RF10           | Registro y seguimiento del estado de renovación de carnet de cada productor.                     |
| 💰 Gestión de pagos         | RF11–RF12      | Generación de recibos y exportación en formato PDF.                                              |
| 📊 Informes administrativos | RF14–RF15      | Generación de reportes con métricas e información consolidada exportable a PDF/Excel.            |

---

## ⚙️ Requerimientos no funcionales (RNF)

| 🔢 **Código**                | 🧩 **Descripción**                                           |
| ---------------------------- | ------------------------------------------------------------ |
| 🔒 **RNF1 – Seguridad**      | Protección de datos con cifrado y autenticación JWT.         |
| 🎯 **RNF2 – Usabilidad**     | Interfaz accesible, moderna y fácil de usar.                 |
| 💻 **RNF3 – Compatibilidad** | Compatible con navegadores modernos (Chrome, Edge, Firefox). |
| ⚡ **RNF4 – Rendimiento**     | Carga rápida de tablas, turnos y reportes.                   |
| 🌐 **RNF5 – Disponibilidad** | Conectividad estable y sincronización continua con Firebase. |
| 🧩 **RNF6 – Mantenibilidad** | Código modular, documentado y escalable.                     |

---

## 📂 Estructura del proyecto

```
web-app/
│
├── src/
│   ├── components/       # Componentes reutilizables de la UI
│   ├── pages/            # Vistas principales (login, dashboard, etc.)
│   ├── services/         # Conexión con backend y Firebase
│   ├── hooks/            # Custom hooks de React
│   └── assets/           # Imágenes y estilos
│
├── public/               # Archivos estáticos
├── package.json          # Configuración del proyecto
└── README.md             # Este archivo
```

---

## 📊 Funcionalidades principales

| 💼 **Módulo** | ⚙️ **Funcionalidad**                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| Usuarios      | Alta, baja y modificación de productores. Asignación de roles y contraseñas. |
| Lotes         | Visualización global con geolocalización.                                    |
| Turnos        | Creación, modificación y gestión de disponibilidad diaria.                   |
| Insumos       | Control de stock, entregas y solicitudes.                                    |
| Pagos         | Registro y exportación de recibos en PDF.                                    |
| Informes      | Generación de reportes e indicadores productivos.                            |
| Comunicación  | Envío de notificaciones y mensajes.                                          |

---

## 🧠 Arquitectura del sistema

La aplicación web se comunica con el backend (Node.js + Express) a través de una **API REST**, utilizando **Firebase** como base de datos principal y fuente de sincronización.
El flujo principal del sistema es:

> **Web App (Administradores)** → **Backend (API)** → **Firebase (Datos en la nube)** → **Mobile App (Productores)**

---

## 👨‍💻 Responsables del desarrollo

| 👤 **Integrante**      | 💼 **Rol**                     | 🧩 **Responsabilidad principal**                                           |
| ---------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| **Juan Gabriel Pared** | **Backend & Mobile Developer** | Coordinación general, desarrollo del backend y de la aplicación móvil.     |
| **Bautista Capovilla** | **Frontend Developer (Web)**   | Desarrollo completo de la aplicación web para administradores del sistema. |

---
