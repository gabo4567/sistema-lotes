// src/routes/upload.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { sendInternalError } from "../utils/httpErrors.js";

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
router.post("/medicion-imagen", (req, res) => {
  upload.single("imagen")(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "La imagen supera el tamaño máximo de 5 MB" });
      }

      return res.status(400).json({ message: error.message || "No se pudo procesar la imagen" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó ninguna imagen" });
      }

      const imageUrl = `${req.protocol}://${req.get("host")}/uploads/mediciones/${req.file.filename}`;

      res.json({
        message: "Imagen subida exitosamente",
        imageUrl,
        filename: req.file.filename,
      });
    } catch (uploadError) {
      sendInternalError(res, "Error al subir imagen");
    }
  });
});

export default router;