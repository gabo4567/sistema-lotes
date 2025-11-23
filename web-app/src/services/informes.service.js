import api from "../api/axios";

export const resumenGeneral = (params) => api.get("/informes/resumen-general", { params }).then(r=>r.data);
export const productoresActivos = (params) => api.get("/informes/productores-activos", { params }).then(r=>r.data);
export const ordenesPorMes = (params) => api.get("/informes/ordenes-por-mes", { params }).then(r=>r.data);
export const turnosPorEstado = (params) => api.get("/informes/turnos-por-estado", { params }).then(r=>r.data);
export const medicionesPorLote = (params) => api.get("/informes/mediciones-por-lote", { params }).then(r=>r.data);
export const insumosResumen = (params) => api.get("/informes/insumos-resumen", { params }).then(r=>r.data);
export const turnosEficiencia = (params) => api.get("/informes/turnos-eficiencia", { params }).then(r=>r.data);
export const exportarPdf = (tipo) => api.get("/informes/exportar/pdf", { params: { tipo } }).then(r=>r.data);
export const exportarExcel = (tipo) => api.get("/informes/exportar/excel", { params: { tipo } }).then(r=>r.data);
