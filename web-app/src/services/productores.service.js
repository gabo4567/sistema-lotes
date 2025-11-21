import api from "../api/axios";

export const getProductores = () => api.get("/productores");
export const getProductoresInactivos = () => api.get("/productores/inactivos");
export const getProductorByIpt = (ipt) => api.get(`/productores/ipt/${ipt}`);
export const getProductorById = (id) => api.get(`/productores/${id}`);
export const updateProductor = (id, data) => api.put(`/productores/${id}`, data);
export const createProductor = (data) => api.post(`/productores`, data);
export const resetPasswordProductor = (ipt) => api.post(`/productores/reset-password/${ipt}`);
export const marcarReempadronado = (ipt) => api.post(`/productores/reempadronado/${ipt}`);
export const getHistorialIngresos = (ipt) => api.get(`/productores/${ipt}/historial`);