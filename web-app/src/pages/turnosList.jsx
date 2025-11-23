import React, { useEffect, useState } from 'react'
import { getTurnos, setEstadoTurno } from '../services/turnos.service'
import { insumosService } from '../services/insumos.service'
import { notify } from '../utils/alerts'
import HomeButton from '../components/HomeButton'


const TurnosList = () => {
const [turnos, setTurnos] = useState([])


useEffect(()=>{(async ()=>{
try{ setTurnos(await getTurnos()) }catch(e){console.error(e)}
})()},[])


const handleCambioEstado = async (id, nuevo)=>{
  const t = turnos.find(x=>x.id===id)
  if (t && nuevo==='Aprobado' && String(t.tipoTurno).toLowerCase()==='insumo'){
    try{
      const { disponible } = await insumosService.disponibilidadPorProductor(t.productorId)
      await notify({ title: disponible ? 'Usted tiene turno para retirar.' : 'Usted no tiene insumos disponibles.', icon: disponible ? 'success' : 'warning' })
    }catch{}
  }
  await setEstadoTurno(id, nuevo)
  setTurnos(turnos.map(t=> t.id===id ? { ...t, estado: nuevo } : t))
}

const formatDate = (d)=>{
  try{
    if(!d) return '-'
    const date = typeof d === 'string' ? new Date(d) : (d.seconds ? new Date(d.seconds*1000) : new Date(d))
    if(isNaN(date.getTime())) return String(d)
    const dd = String(date.getDate()).padStart(2,'0')
    const mm = String(date.getMonth()+1).padStart(2,'0')
    const yyyy = date.getFullYear()
    return `${dd}-${mm}-${yyyy}`
  }catch{ return String(d) }
}

const estadoClass = (e)=>{
  const v = String(e||'').toLowerCase()
  if(v.includes('aprob')) return 'estado-badge ok'
  if(v.includes('cancel')) return 'estado-badge err'
  if(v.includes('venc')) return 'estado-badge warn'
  if(v.includes('conf')) return 'estado-badge ok'
  return 'estado-badge info'
}

return (
  <div className="turnos-list">
    <div style={{ marginBottom: 8 }}><HomeButton /></div>
    <h2 className="users-title">Turnos</h2>
    <div className="turnos-grid">
      {turnos.map(t=> (
        <div key={t.id} className="turno-card">
          <div className="turno-header">
            <div className="turno-date">{formatDate(t.fechaTurno)}</div>
            <div className={estadoClass(t.estado)}>{t.estado || 'Pendiente'}</div>
          </div>
          <div className="turno-item"><span className="turno-label">Productor:</span> {t.productorId}</div>
          <div className="turno-item"><span className="turno-label">Tipo:</span> {t.tipoTurno}</div>
          {t.motivo && <div className="turno-item"><span className="turno-label">Motivo:</span> {t.motivo}</div>}
          <div className="turno-actions">
            <select className="select-inst" onChange={e=>handleCambioEstado(t.id, e.target.value)} defaultValue={t.estado}>
              <option value="Solicitado">Solicitado</option>
              <option value="Aprobado">Aprobado</option>
              <option value="Cancelado">Cancelado</option>
              <option value="Vencido">Vencido</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  </div>
)
}


export default TurnosList
