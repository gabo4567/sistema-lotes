import api from '../api/axios'
export const getTurnos = async (activo)=>{ 
  const params = {}
  if (activo === true || activo === false) {
    params.activo = activo
  } else if (activo === undefined) {
    params.activo = true
  }
  const res = await api.get('/turnos', Object.keys(params).length ? { params } : undefined); 
  return res.data 
}
export const setEstadoTurno = async (id, estado, motivo)=>{ const res = await api.patch(`/turnos/${id}/estado`, { estado, motivo }); return res.data }
export const eliminarTurno = async (id, userId)=>{ const res = await api.delete(`/turnos/${id}`, { data: { userId } }); return res.data }
export const restaurarTurno = async (id)=>{ const res = await api.patch(`/turnos/${id}/restaurar`); return res.data }
export const getTurnosPorProductor = async (ipt, activo)=>{ 
  const res = await api.get(`/turnos/productor/${ipt}`, { params: { activo } }); 
  return res.data 
}
export const getDisponibilidad = async (fechaSolicitada, tipoTurno)=>{ const res = await api.get(`/turnos/disponibilidad`, { params: { fechaSolicitada, tipoTurno } }); return res.data }
