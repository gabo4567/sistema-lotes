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
export const setEstadoTurno = async (id, estado, motivo, options)=>{
  const body = { estado, motivo }
  if (options && typeof options === 'object' && options.force === true) {
    body.force = true
  }
  const res = await api.patch(`/turnos/${id}/estado`, body)
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
