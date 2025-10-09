DROP DATABASE IF EXISTS sistema_lotes;

-- ======================================================================
-- Base de datos para Sistema de Turnos para Productores de Tabaco
-- ======================================================================

CREATE DATABASE IF NOT EXISTS sistema_lotes;
USE sistema_lotes;

-- ======================================================
-- Tabla Usuario
-- ======================================================
CREATE TABLE Usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    rol ENUM('Productor', 'Administrador') NOT NULL
);

-- ======================================================
-- Tabla Productor
-- ======================================================
CREATE TABLE Productor (
    id_productor INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    telefono VARCHAR(20),
    id_usuario INT UNIQUE,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
);

-- ======================================================
-- Tabla Notificaciones
-- ======================================================
CREATE TABLE Notificaciones (
    id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
    id_productor INT NOT NULL,
    contenido TEXT NOT NULL,
    fecha_envio DATETIME NOT NULL,
    FOREIGN KEY (id_productor) REFERENCES Productor(id_productor)
);

-- ======================================================
-- Tabla Lote
-- ======================================================
CREATE TABLE Lote (
    id_lote INT AUTO_INCREMENT PRIMARY KEY,
    id_productor INT NOT NULL,
    superficie DECIMAL(10,2),
    ubicacion VARCHAR(255),
    FOREIGN KEY (id_productor) REFERENCES Productor(id_productor)
);

-- ======================================================
-- Tabla Historial_Lote
-- ======================================================
CREATE TABLE Historial_Lote (
    id_historial INT AUTO_INCREMENT PRIMARY KEY,
    id_lote INT NOT NULL,
    fecha DATETIME NOT NULL,
    detalle_medicion TEXT,
    FOREIGN KEY (id_lote) REFERENCES Lote(id_lote)
);

-- ======================================================
-- Tabla Etapas_Produccion
-- ======================================================
CREATE TABLE Etapas_Produccion (
    id_etapa INT AUTO_INCREMENT PRIMARY KEY,
    nombre_etapa VARCHAR(50) NOT NULL,
    duracion_aproximada VARCHAR(50),
    descripcion TEXT
);

-- ======================================================
-- Tabla Configuracion_Turnos
-- ======================================================
CREATE TABLE Configuracion_Turnos (
    id_config INT AUTO_INCREMENT PRIMARY KEY,
    tipo_turno VARCHAR(50) NOT NULL,
    max_turnos_dia INT DEFAULT 50,
    horario VARCHAR(50) DEFAULT '07:30-12:30'
);

-- ======================================================
-- Tabla Turno
-- ======================================================
CREATE TABLE Turno (
    id_turno INT AUTO_INCREMENT PRIMARY KEY,
    id_productor INT NOT NULL,
    fecha DATETIME NOT NULL,
    tipo_turno VARCHAR(50) NOT NULL,
    id_etapa INT,
    id_config INT,
    FOREIGN KEY (id_productor) REFERENCES Productor(id_productor),
    FOREIGN KEY (id_etapa) REFERENCES Etapas_Produccion(id_etapa),
    FOREIGN KEY (id_config) REFERENCES Configuracion_Turnos(id_config)
);

-- ======================================================
-- Tabla Carnet
-- ======================================================
CREATE TABLE Carnet (
    id_carnet INT AUTO_INCREMENT PRIMARY KEY,
    id_productor INT NOT NULL,
    estado ENUM('Vigente','Vencido','Pendiente') DEFAULT 'Pendiente',
    fecha_emision DATETIME,
    FOREIGN KEY (id_productor) REFERENCES Productor(id_productor)
);

-- ======================================================
-- Tabla Pago
-- ======================================================
CREATE TABLE Pago (
    id_pago INT AUTO_INCREMENT PRIMARY KEY,
    id_productor INT NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    fecha DATETIME NOT NULL,
    FOREIGN KEY (id_productor) REFERENCES Productor(id_productor)
);

-- ======================================================
-- Tabla Insumos_Generales
-- ======================================================
CREATE TABLE Insumos_Generales (
    id_insumo INT AUTO_INCREMENT PRIMARY KEY,
    nombre_insumo VARCHAR(50) NOT NULL,
    cantidad_disponible INT DEFAULT 0,
    fecha_actualizacion DATETIME
);

-- ======================================================
-- Tabla intermedia Turno_Insumo (relaciona Turno con Insumos_Generales)
-- ======================================================
CREATE TABLE Turno_Insumo (
    id_turno INT NOT NULL,
    id_insumo INT NOT NULL,
    cantidad_entregada INT DEFAULT 0,
    PRIMARY KEY (id_turno, id_insumo),
    FOREIGN KEY (id_turno) REFERENCES Turno(id_turno),
    FOREIGN KEY (id_insumo) REFERENCES Insumos_Generales(id_insumo)
);

-- ======================================================
-- Tabla Registro_Sincronizacion
-- ======================================================
CREATE TABLE Registro_Sincronizacion (
    id_sync INT AUTO_INCREMENT PRIMARY KEY,
    id_productor INT NOT NULL,
    tipo_dato VARCHAR(50),
    fecha_sync DATETIME,
    FOREIGN KEY (id_productor) REFERENCES Productor(id_productor)
);

-- ======================================================
-- Tabla Informe
-- ======================================================
CREATE TABLE Informe (
    id_informe INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATETIME NOT NULL,
    descripcion TEXT,
    total_productores INT DEFAULT 0
);

-- ======================================================
-- Tabla intermedia Informe_Productor
-- ======================================================
CREATE TABLE Informe_Productor (
    id_informe INT NOT NULL,
    id_productor INT NOT NULL,
    PRIMARY KEY (id_informe, id_productor),
    FOREIGN KEY (id_informe) REFERENCES Informe(id_informe),
    FOREIGN KEY (id_productor) REFERENCES Productor(id_productor)
);

-- ======================================================
-- Tabla intermedia Informe_Turno
-- ======================================================
CREATE TABLE Informe_Turno (
    id_informe INT NOT NULL,
    id_turno INT NOT NULL,
    PRIMARY KEY (id_informe, id_turno),
    FOREIGN KEY (id_informe) REFERENCES Informe(id_informe),
    FOREIGN KEY (id_turno) REFERENCES Turno(id_turno)
);

