// servicios/lotes.service.js
import api from "../api/axios";

export const lotesService = {
  async getLotes(options = {}) {
    const activo = options.activo || "activos";

    if (activo === "inactivos") {
      const res = await api.get("/lotes/inactivos");
      return res.data;
    }

    if (activo === "todos") {
      const [activos, inactivos] = await Promise.all([
        api.get("/lotes"),
        api.get("/lotes/inactivos"),
      ]);

      return [...activos.data, ...inactivos.data];
    }

    const res = await api.get("/lotes");
    return res.data;
  },

  async getLote(id) {
    const res = await api.get(`/lotes/${id}`);
    return res.data;
  },

  async getHistorialLote(id) {
    const res = await api.get(`/lotes/${id}/historial`);
    return res.data;
  },

  async createLote(data) {
    if (!data || !Array.isArray(data.poligono) || data.poligono.length < 3) {
      throw new Error("El lote debe tener un poligono valido de al menos 3 puntos");
    }

    const res = await api.post("/lotes", data);
    return res.data;
  },

  async updateLote(id, data) {
    const res = await api.put(`/lotes/${id}`, data);
    return res.data;
  },

  async deleteLote(id) {
    const res = await api.delete(`/lotes/${id}`);
    return res.data;
  },

  async cambiarEstado(id, data) {
    const res = await api.patch(`/lotes/${id}/estado`, data);
    return res.data;
  }
};
