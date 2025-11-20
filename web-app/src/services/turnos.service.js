import api from '../api/axios'
export const getTurnos = async ()=>{ const res = await api.get('/turnos'); return res.data }
export const setEstadoTurno = async (id, estado, motivo)=>{ const res = await api.patch(`/turnos/${id}/estado`, { estado, motivo }); return res.data }
export const getTurnosPorProductor = async (ipt)=>{ const res = await api.get(`/turnos/productor/${ipt}`); return res.data }
export const getDisponibilidad = async (fechaSolicitada, tipoTurno)=>{ const res = await api.get(`/turnos/disponibilidad`, { params: { fechaSolicitada, tipoTurno } }); return res.data }