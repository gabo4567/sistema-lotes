import api from "../api/axios";

export const createMedicion = (data) => api.post("/mediciones", data).then(r=>r.data);
export const getMediciones = (params) => api.get("/mediciones", { params }).then(r=>r.data);
export const getMedicion = (id) => api.get(`/mediciones/${id}`).then(r=>r.data);
export const updateMedicion = (id, data) => api.put(`/mediciones/${id}`, data).then(r=>r.data);
export const deleteMedicion = (id) => api.delete(`/mediciones/${id}`).then(r=>r.data);