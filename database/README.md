# 📂 Base de Datos - Sistema de Gestión del Lote de Trabajo y Turnos para Productores

Esta carpeta contiene **todos los archivos relacionados con la base de datos** del proyecto, incluyendo scripts de creación, esquemas y referencias para su uso en MySQL.

---

## 📁 Contenido de la carpeta

| Archivo | Descripción |
|---------|-------------|
| `sistema_lotes.sql` | Script completo para crear la base de datos y todas las tablas necesarias para el sistema. Incluye relaciones, claves primarias y foráneas. |
| `sistema_lotes_erd.sql` | Esquema SQL generado desde MySQL Workbench, que representa gráficamente las relaciones entre las tablas. |
| `README.md` | Este archivo de documentación de la carpeta database. |

---

## 🛠️ Uso del script SQL

### **1. Crear la base de datos y tablas**
1. Abrir **MySQL Workbench** o cualquier cliente MySQL.  
2. Conectarse al servidor MySQL donde se desea crear la base de datos.  
3. Abrir el archivo `sistema_lotes.sql`.  
4. Ejecutar todo el script para crear la base de datos `sistema_lotes` y todas las tablas relacionadas.  

### **2. Verificación**
- Una vez ejecutado el script, se pueden visualizar las tablas creadas en la sección de **Schemas** de MySQL Workbench.  
- Las tablas incluyen:  
  - `Usuario`, `Productor`, `Notificaciones`, `Lote`, `Historial_Lote`  
  - `Etapas_Produccion`, `Configuracion_Turnos`, `Turno`, `Carnet`, `Pago`  
  - `Insumos_Generales`, `Registro_Sincronizacion`, `Informe`, `Informe_Productor`, `Informe_Turno`  
  - Tablas de relación según el diagrama de entidad-relación general del sistema.  

### **3. Importar esquema ERD**
1. Abrir `sistema_lotes_erd.sql` en MySQL Workbench.  
2. Esto permite **visualizar gráficamente** todas las relaciones y claves foráneas de la base de datos.  
3. Útil para comprender la estructura del sistema antes de implementar la lógica en backend y frontend.  

---

## 📝 Notas importantes
- Asegurarse de tener **MySQL 8+** o versión compatible.  
- El script incluye claves primarias, foráneas y restricciones básicas de integridad referencial.  
- Los datos iniciales no están incluidos; si se desea poblar la base, se pueden agregar scripts adicionales o usar la aplicación para insertar datos desde la interfaz web/móvil.  

---

## 📬 Contacto
Para dudas sobre la base de datos o integración con el sistema, contactar con el **equipo organizador del proyecto**.

- Juan Gabriel Pared  
- Bautista Capovilla

---
