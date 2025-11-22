// src/routes/upload.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Crear directorio de uploads si no existe
const uploadDir = "uploads/mediciones";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar almacenamiento de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, "medicion-" + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro de archivos - solo imágenes
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos de imagen"), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB límite
  }
});

// Ruta para subir imagen de medición
router.post("/medicion-imagen", upload.single("imagen"), (req, res) => {
  try {
    console.log('📸 Upload request recibido');
    console.log('📁 Archivo recibido:', req.file);
    console.log('📋 Body:', req.body);
    
    if (!req.file) {
      console.log('❌ No se recibió archivo');
      return res.status(400).json({ message: "No se proporcionó ninguna imagen" });
    }

    // Construir URL de la imagen
    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/mediciones/${req.file.filename}`;
    console.log('✅ URL generada:', imageUrl);
    
    res.json({
      message: "Imagen subida exitosamente",
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error("❌ Error al subir imagen:", error);
    res.status(500).json({ message: "Error al subir imagen", error: error.message });
  }
});

export default router;