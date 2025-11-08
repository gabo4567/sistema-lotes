# 🟢 Sistema de Gestión de Lotes de Tabaco y Turnos para Productores

**Descripción:**  
Aplicación web y móvil para la gestión integral de lotes de tabaco y turnos de productores, optimizando la comunicación entre los productores y el Instituto Provincial del Tabaco.

---

## 🎯 Propósito del proyecto
El objetivo principal de este sistema es **registrar la producción del lote de tabaco** y **gestionar los turnos** de los productores para el Instituto Provincial del Tabaco (Goya, Corrientes).  

**Problema que soluciona:**  
Actualmente, los productores deben coordinar turnos y registrar información de sus lotes de forma manual, generando retrasos y errores.  

**Valor que aporta:**  
- Automatiza la gestión de turnos y entrega de insumos.  
- Facilita el seguimiento de producción de los lotes.  
- Mejora la comunicación entre productores y el instituto.  
- Permite trabajar offline y sincronizar datos posteriormente.  

---

## 🚀 Funcionalidades clave

### **Aplicación Web (Administradores)**
- Gestión de usuarios y productores.  
- Configuración y control de turnos.  
- Registro de pagos y generación de recibos en PDF.  
- Visualización de informes de producción y turnos.  
- Administración de insumos generales y disponibilidad.  
- Sincronización y monitoreo de la app móvil.  

### **Aplicación Móvil (Productores)**
- Solicitud y gestión de turnos (renovación de carnet, insumos).  
- Registro y seguimiento de lotes con geolocalización.  
- Recepción de notificaciones e información del instituto.  
- Visualización del historial de producción de cada lote.  
- Funciona offline y sincroniza automáticamente al reconectarse.  

---

## 🛠️ Tecnologías utilizadas
- **Frontend:** React Native (Android e iOS)  
- **Backend:** Node.js + Express  
- **Base de datos:** Firebase (sincronización offline, almacenamiento en la nube)  
- **Geolocalización:** Google Maps API  
- **Autenticación:** JWT (seguridad y manejo de sesiones)  

---

## ⚙️ Instalación y uso

### **Backend**
```
cd backend
npm install
npm start
````

### **Web App**

```
cd web-app
npm install
npm start
```

### **Mobile App**

```
cd mobile-app
npm install
npm run android   # Para Android
npm run ios       # Para iOS
```

> Asegurarse de tener configuradas las credenciales de Firebase en `src/services/firebaseConfig.js` antes de correr la aplicación móvil.

---

## 📂 Estructura del proyecto

```
sistema-lotes/
│
├── backend/           # API Node.js + Express
├── web-app/           # Aplicación web para administradores
├── mobile-app/        # Aplicación móvil para productores
├── database/          # Scripts SQL y diagramas de base de datos
├── diagrams/          # Diagramas (casos de uso, secuencia, ERD)
├── docs/              # Documentación (RF, RNF, manual, cronograma)
└── README.md          # Este archivo
```

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

