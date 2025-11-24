import React, { useEffect, useState } from 'react'
import { getTurnos, setEstadoTurno } from '../services/turnos.service'
import { insumosService } from '../services/insumos.service'
import { notify, promptDialog } from '../utils/alerts'
import { getProductores } from '../services/productores.service'
import HomeButton from '../components/HomeButton'


const TurnosList = () => {
const [turnos, setTurnos] = useState([])
const [prodMap, setProdMap] = useState(new Map())


useEffect(()=>{(async ()=>{
try{ 
  const ts = await getTurnos()
  setTurnos(ts)
  try{
    const { data: productores } = await getProductores()
    const map = new Map()
    (Array.isArray(productores)? productores:[]).forEach(p=>{ map.set(String(p.id), { nombre: p.nombreCompleto || p.nombre || '', ipt: String(p.ipt||'') }) })
    setProdMap(map)
  }catch{}
}catch(e){console.error(e)}
})()},[])


const handleCambioEstado = async (id, nuevo)=>{
  const t = turnos.find(x=>x.id===id)
  if (t && (nuevo==='confirmado' || nuevo==='Aprobado') && String(t.tipoTurno).toLowerCase()==='insumo'){
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
  if(v==='confirmado') return 'estado-badge ok'
  if(v==='cancelado') return 'estado-badge err'
  if(v==='vencido') return 'estado-badge warn'
  if(v==='completado') return 'estado-badge ok'
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
          <div className="turno-item"><span className="turno-label">Productor:</span> {t.productorNombre || prodMap.get(String(t.productorId))?.nombre || 'No especificado'}</div>
          <div className="turno-item"><span className="turno-label">IPT:</span> {t.ipt || prodMap.get(String(t.productorId))?.ipt || '-'}</div>
          <div className="turno-item"><span className="turno-label">Tipo:</span> {t.tipoTurno}</div>
          <div className="turno-item"><span className="turno-label">Motivo:</span> {t.motivo || 'No especificado'}</div>
          <div className="turno-actions">
            <select className="select-inst" onChange={e=>handleCambioEstado(t.id, e.target.value)} defaultValue={t.estado}>
              <option value="pendiente">Pendiente</option>
              <option value="confirmado">Confirmado</option>
              <option value="cancelado">Cancelado</option>
              <option value="completado">Completado</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  </div>
)
}


export default TurnosList
