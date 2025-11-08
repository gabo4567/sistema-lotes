import api from "../api/axios";

export const obtenerLotes = async () => {
  const res = await api.get("/lotes"); // coincide con tu backend: /api/lotes
  return res.data;
};

export const crearLote = async (payload) => {
  const res = await api.post("/lotes", payload);
  return res.data;
};
