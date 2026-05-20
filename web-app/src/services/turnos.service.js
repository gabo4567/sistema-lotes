import api from '../api/axios'

export const importarAsignacionesTurnos = async (payload) => {
  const res = await api.post('/turnos/importar-asignaciones', payload, { timeout: 120000, _dedupe: false });
  return res.data;
}

export const getTurnos = async (activo, { fechaDesde, fechaHasta, limit } = {})=>{
  const params = {}
  if (activo === true || activo === false) {
    params.activo = activo
  } else if (activo === undefined) {
    params.activo = true
  }
  if (fechaDesde) params.fechaDesde = fechaDesde
  if (fechaHasta) params.fechaHasta = fechaHasta
  if (limit) params.limit = limit
  const res = await api.get('/turnos', Object.keys(params).length ? { params } : undefined);
  return res.data
}
export const setEstadoTurno = async (id, estado, motivoEstado, options)=>{
  const body = { estado, motivoEstado }
  if (options && typeof options === 'object' && options.force === true) {
    body.force = true
  }
  const res = await api.patch(`/turnos/${id}/estado`, body)
  return res.data
}
export const registrarAsistenciaTurno = async (payload)=>{
  const res = await api.post(`/turnos/asistencia`, payload)
  return res.data
}
export const crearTurnoManual = async (payload)=>{
  const res = await api.post(`/turnos/manual`, payload)
  return res.data
}
export const eliminarTurno = async (id, userId)=>{ const res = await api.delete(`/turnos/${id}`, { data: { userId } }); return res.data }
export const restaurarTurno = async (id)=>{ const res = await api.patch(`/turnos/${id}/restaurar`); return res.data }
export const getTurnosPorProductor = async (ipt, activo)=>{ 
  const res = await api.get(`/turnos/productor/${ipt}`, { params: { activo } }); 
  return res.data 
}
export const getDisponibilidad = async (fechaSolicitada, tipoTurno)=>{ const res = await api.get(`/turnos/disponibilidad`, { params: { fechaSolicitada, tipoTurno } }); return res.data }

export const getTurnosConfig = async ()=>{
  const res = await api.get(`/turnos/config`)
  return res.data
}

export const setTurnosConfig = async (configOrHabilitado, mensaje, desde, hasta, rangoModo, modo)=>{
  let body = {}
  if (configOrHabilitado && typeof configOrHabilitado === 'object' && !Array.isArray(configOrHabilitado)) {
    body = { ...configOrHabilitado }
  } else {
    body = { habilitado: configOrHabilitado, mensaje, desde, hasta, rangoModo, modo }
  }

  const m = String(body?.modo || '').toLowerCase().trim()
  if (m === 'manual') {
    body.modo = 'manual'
    body.desde = null
    body.hasta = null
    body.rangoModo = null
  } else if (m === 'rango') {
    body.modo = 'rango'
    delete body.habilitado
  }

  const res = await api.put(`/turnos/config`, body)
  return res.data
}

export const getCapacidadTurnoDia = async (fecha)=>{
  const res = await api.get(`/turnos/capacidad`, { params: { fecha } })
  return res.data
}

export const setCapacidadTurnoDia = async (fecha, capacidad)=>{
  const res = await api.put(`/turnos/capacidad/${fecha}`, { capacidad })
  return res.data
}

export const getTurnoHistorial = async (id, limit = 50) => {
  const res = await api.get(`/turnos/${id}/historial`, { params: { limit } })
  return res.data
}
