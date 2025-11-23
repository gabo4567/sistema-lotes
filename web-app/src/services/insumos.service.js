import api from '../api/axios'

export const insumosService = {
  async getInsumos(){ const res = await api.get('/insumos'); return res.data },
  async getInsumo(id){ const res = await api.get(`/insumos/${id}`); return res.data },
  async createInsumo(data){ const res = await api.post('/insumos', data); return res.data },
  async updateInsumo(id, data){ const res = await api.put(`/insumos/${id}`, data); return res.data },
  async deleteInsumo(id){ const res = await api.delete(`/insumos/${id}`); return res.data },
  async asignacionesPorInsumo(id){ const res = await api.get(`/insumos/${id}/asignaciones`); return res.data },
  async asignarAProductor(id, payload){ const res = await api.post(`/insumos/${id}/asignar`, payload); return res.data },
  async disponibilidadPorProductor(productorId){ const res = await api.get(`/insumos/productor/${productorId}/disponibilidad`); return res.data },
  async asignacionesPorProductor(productorId){ const res = await api.get(`/insumos/productor/${productorId}/asignaciones`); return res.data },
  async updateAsignacion(asignacionId, data){ const res = await api.put(`/insumos/asignaciones/${asignacionId}`, data); return res.data },
}
