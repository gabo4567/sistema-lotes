// Import Firebase services
import { db } from "./firebase.js";
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";

// Funciones CRUD para lotes
export const lotesService = {
  // Obtener todos los lotes
  async getLotes() {
    try {
      const lotesCollection = collection(db, "lotes");
      const lotesSnapshot = await getDocs(lotesCollection);
      const lotesList = lotesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return lotesList;
    } catch (error) {
      console.error("Error al obtener lotes:", error);
      throw error;
    }
  },

  // Crear un nuevo lote
  async crearLote(loteData) {
    try {
      const lotesCollection = collection(db, "lotes");
      const docRef = await addDoc(lotesCollection, {
        ...loteData,
        createdAt: new Date().toISOString()
      });
      return { id: docRef.id, ...loteData };
    } catch (error) {
      console.error("Error al crear lote:", error);
      throw error;
    }
  },

  // Actualizar un lote
  async updateLote(id, loteData) {
    try {
      const loteDoc = doc(db, "lotes", id);
      await updateDoc(loteDoc, {
        ...loteData,
        updatedAt: new Date().toISOString()
      });
      return { id, ...loteData };
    } catch (error) {
      console.error("Error al actualizar lote:", error);
      throw error;
    }
  },

  // Eliminar un lote
  async deleteLote(id) {
    try {
      const loteDoc = doc(db, "lotes", id);
      await deleteDoc(loteDoc);
      return id;
    } catch (error) {
      console.error("Error al eliminar lote:", error);
      throw error;
    }
  }
};

// Export directo para facilitar el uso individual
export const { crearLote, getLotes, updateLote, deleteLote } = lotesService;
