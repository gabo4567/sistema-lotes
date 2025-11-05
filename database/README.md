# 📂 Base de Datos - Sistema de Gestión de Lotes y Turnos para Productores

Esta carpeta contiene los archivos de referencia del modelo de base de datos original del proyecto.
Inicialmente, el sistema fue diseñado utilizando MySQL, pero en la versión actual se implementó completamente con Firebase como servicio principal de base de datos.

---

## 📁 Contenido de la carpeta
Archivo	Descripción
sistema_lotes.sql	Script completo que muestra cómo se diseñó originalmente la base de datos en MySQL. Incluye creación de tablas, claves primarias y foráneas.
sistema_lotes_erd.sql	Esquema SQL generado desde MySQL Workbench, que representa gráficamente las relaciones entre las tablas.
README.md	Este archivo de documentación actualizado.

---

## 🔥 Implementación actual

- Actualmente, el sistema utiliza Firebase como base de datos en tiempo real, lo que permite:

- Sincronización instantánea entre la aplicación web, móvil y el backend.

- Operación offline con sincronización automática al reconectarse.

- Autenticación segura mediante Firebase Authentication.

- Almacenamiento en la nube con Firestore Database.

- La estructura de datos en Firebase refleja la lógica del modelo relacional original, manteniendo las siguientes colecciones principales:

  - usuarios

  - productores

  - lotes

  - ordenes

  - mediciones

  - turnos

  - informes

---

## 💾 Uso de los archivos SQL

Aunque el sistema actual ya no utiliza MySQL, los archivos SQL se mantienen para documentación y trazabilidad del desarrollo.

**Propósito	Descripción**
- 📘 Referencia académica	Permite demostrar cómo se diseñó originalmente la base de datos en lenguaje SQL.
- 🧩 Análisis estructural	Sirve para entender la estructura y relaciones lógicas entre entidades antes de la migración a Firebase.
- 🧠 Evidencia de evolución	Refleja la transición tecnológica del proyecto hacia una arquitectura moderna basada en servicios en la nube.
- 📝 Notas importantes

No es necesario ejecutar los scripts SQL para el funcionamiento actual del sistema.

La base de datos en producción se gestiona desde Firebase Console.

Las operaciones CRUD se realizan mediante el backend en Node.js, utilizando el SDK oficial de Firebase.

---

## 👥 Equipo de desarrollo

- 🧑‍💻 Juan Gabriel Pared – Coordinación general, backend y desarrollo móvil

- 💻 Bautista Capovilla – Desarrollo de la aplicación web
