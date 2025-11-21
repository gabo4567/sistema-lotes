import api from "../api/axios";

export const resumenGeneral = () => api.get("/informes/resumen-general").then(r=>r.data);
export const productoresActivos = () => api.get("/informes/productores-activos").then(r=>r.data);
export const ordenesPorMes = () => api.get("/informes/ordenes-por-mes").then(r=>r.data);
export const turnosPorEstado = () => api.get("/informes/turnos-por-estado").then(r=>r.data);
export const medicionesPorLote = () => api.get("/informes/mediciones-por-lote").then(r=>r.data);
export const exportarPdf = (tipo) => api.get("/informes/exportar/pdf", { params: { tipo } }).then(r=>r.data);
export const exportarExcel = (tipo) => api.get("/informes/exportar/excel", { params: { tipo } }).then(r=>r.data);