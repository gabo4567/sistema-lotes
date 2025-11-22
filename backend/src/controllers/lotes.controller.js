// src/controllers/lotes.controller.js
import { db } from "../utils/firebase.js";

// Crear un lote
export const createLote = async (req, res) => {
  try {
    const { ipt, superficie, ubicacion, poligono, metodoMarcado, observacionesTecnico, nombre, observacionesProductor } = req.body;
    if (!ipt || !poligono || !Array.isArray(poligono) || poligono.length < 3 || !metodoMarcado) {
      return res.status(400).json({ error: "Datos de lote inválidos" });
    }

    const newLote = {
      ipt: String(ipt),
      superficie: superficie ? Number(superficie) : null,
      ubicacion: ubicacion || null,
      poligono,
      metodoMarcado,
      fechaCreacion: new Date(),
      estado: "Pendiente",
      observacionesTecnico: observacionesTecnico || "",
      nombre: nombre ? String(nombre) : null,
      observacionesProductor: observacionesProductor || "",
      activo: true,
    };

    const docRef = await db.collection("lotes").add(newLote);
    res.json({ id: docRef.id, ...newLote });
  } catch (error) {
    console.error("Error al crear lote:", error);
    res.status(500).json({ error: "Error al crear lote" });
  }
};

// Obtener todos los lotes activos
export const getAllLotes = async (req, res) => {
  try {
    const snapshot = await db.collection("lotes").where("activo", "==", true).get();
    const lotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(lotes);
  } catch (error) {
    console.error("Error al obtener lotes:", error);
    res.status(500).json({ error: "Error al obtener lotes" });
  }
};

// Obtener todos los lotes inactivos
export const getInactiveLotes = async (req, res) => {
  try {
    const snapshot = await db.collection("lotes").where("activo", "==", false).get();
    const lotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(lotes);
  } catch (error) {
    console.error("Error al obtener lotes inactivos:", error);
    res.status(500).json({ error: "Error al obtener lotes inactivos" });
  }
};

// Obtener lote por ID
export const getLoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("lotes").doc(id).get();
    if (!doc.exists || doc.data().activo === false) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error al obtener lote:", error);
    res.status(500).json({ error: "Error al obtener lote" });
  }
};

// Actualizar lote
export const updateLote = async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection("lotes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Lote no encontrado" });
    const current = snap.data();
    if (current.estado === "Validado") {
      return res.status(403).json({ error: "No se puede editar un lote validado" });
    }
    const data = req.body;
    await ref.update({ ...data, updatedAt: new Date() });
    res.json({ message: "✅ Lote actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar lote:", error);
    res.status(500).json({ error: "Error al actualizar lote" });
  }
};

// Eliminar lote (soft delete)
export const deleteLote = async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection("lotes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Lote no encontrado" });
    const current = snap.data();
    if (current.estado === "Validado") {
      return res.status(403).json({ error: "No se puede eliminar un lote validado" });
    }
    await ref.update({ activo: false, updatedAt: new Date() });
    res.json({ message: "✅ Lote desactivado correctamente (soft delete)" });
  } catch (error) {
    console.error("Error al desactivar lote:", error);
    res.status(500).json({ error: "Error al desactivar lote" });
  }
};

export const getLotesByIpt = async (req, res) => {
  try {
    const { ipt } = req.params;
    const snapshot = await db
      .collection("lotes")
      .where("ipt", "==", String(ipt))
      .where("activo", "==", true)
      .get();
    const lotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(lotes);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener lotes por IPT" });
  }
};

export const cambiarEstadoLote = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observacionesTecnico } = req.body;
    const permitidos = ["Pendiente", "Validado", "Rechazado"];
    if (!permitidos.includes(estado)) return res.status(400).json({ error: "Estado inválido" });
    const ref = db.collection("lotes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Lote no encontrado" });
    const lote = snap.data();
    await ref.update({ estado, observacionesTecnico: observacionesTecnico || "" });
    if (estado === "Validado") {
      try {
        const prodSnap = await db.collection("productores").where("ipt", "==", String(lote.ipt)).limit(1).get();
        if (!prodSnap.empty) {
          const prod = prodSnap.docs[0].data();
          const tokens = Array.isArray(prod.pushTokens) ? prod.pushTokens : (prod.pushToken ? [prod.pushToken] : []);
          if (tokens.length) {
            const { sendExpoPush } = await import("../utils/expoPush.js");
            await sendExpoPush(tokens, "Lote validado", "Tu lote ha sido validado", { loteId: id, ipt: lote.ipt });
          }
        }
      } catch (e) {
        console.error("Error enviando push:", e?.message);
      }
    }
    res.json({ message: "Estado actualizado" });
  } catch (error) {
    res.status(500).json({ error: "Error al cambiar estado" });
  }
};
