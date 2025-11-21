import api from "../api/axios";

export const lotesService = {
  async getLotes() {
    const res = await api.get("/lotes");
    return res.data;
  },

  async getLote(id) {
    const res = await api.get(`/lotes/${id}`);
    return res.data;
  },

  async createLote(data) {
    // Adaptar datos simples (lat/lng) a polígono mínimo válido para backend
    const { nombre, lat, lng } = data || {};
    const baseLat = Number(lat);
    const baseLng = Number(lng);
    const d = 0.0001;
    const poligono = [
      { lat: baseLat, lng: baseLng },
      { lat: baseLat + d, lng: baseLng },
      { lat: baseLat, lng: baseLng + d }
    ];
    const payload = {
      ipt: "WEB_TMP",
      superficie: null,
      ubicacion: nombre || null,
      poligono,
      metodoMarcado: "aereo",
      observacionesTecnico: "Creado desde formulario simple web",
    };
    const res = await api.post("/lotes", payload);
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
