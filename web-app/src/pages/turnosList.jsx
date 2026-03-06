import React, { useEffect, useState, useMemo } from 'react'
import { getTurnos, setEstadoTurno, eliminarTurno, restaurarTurno } from '../services/turnos.service'
import { insumosService } from '../services/insumos.service'
import { notify, promptDialog, confirmDialog } from '../utils/alerts'
import { getProductores } from '../services/productores.service'
import HomeButton from '../components/HomeButton'

const TurnosList = () => {
const [turnos, setTurnos] = useState([])
const [prodMap, setProdMap] = useState(new Map())
const [loading, setLoading] = useState(true)
const [viewMode, setViewMode] = useState('activos') // 'activos', 'historial', 'todos'

// Estados para filtros
const [filtros, setFiltros] = useState({
  orden: 'nuevos',
  estado: 'todos',
  productor: '',
  desde: '',
  hasta: ''
})

const loadData = async () => {
  setLoading(true)
  try {
    // Si es historial, pedimos activo=false, si es activos pedimos activo=true, si es todos no pasamos parámetro
    const activoParam = viewMode === 'activos' ? true : (viewMode === 'historial' ? false : undefined)
    const ts = await getTurnos(activoParam)
    setTurnos(ts)
    
    if (prodMap.size === 0) {
      try {
        const { data: productores } = await getProductores()
        const map = new Map()
        (Array.isArray(productores)? productores:[]).forEach(p=>{ 
          map.set(String(p.id), { 
            nombre: p.nombreCompleto || p.nombre || '', 
            ipt: String(p.ipt||''),
            iptNum: p.ipt
          }) 
        })
        setProdMap(map)
      } catch {}
    }
  } catch(e) { console.error(e) }
  finally { setLoading(false) }
}

useEffect(() => {
  loadData()
}, [viewMode])

  const turnosFiltrados = useMemo(() => {
    return turnos.filter(t => {
      // Filtro por estado
      if (filtros.estado !== 'todos' && String(t.estado).toLowerCase() !== filtros.estado) return false
      
      // Filtro por productor (nombre o IPT)
      if (filtros.productor) {
        const search = filtros.productor.toLowerCase().trim()
        if (!search) return true
        
        const pInfo = prodMap.get(String(t.productorId))
        
        // Verificar si pInfo existe antes de intentar acceder a sus propiedades
        const nombre = (pInfo?.nombre || '').toLowerCase()
        const ipt = String(pInfo?.ipt || '').toLowerCase()
        const iptNum = String(pInfo?.iptNum || '')
        
        // Buscar coincidencia en nombre, ipt o iptNum
        const matchNombre = nombre.includes(search)
        const matchIPT = ipt.includes(search) || iptNum.includes(search)
        
        if (!matchNombre && !matchIPT) return false
      }
      
      // Filtro por rango de fechas
      if (filtros.desde || filtros.hasta) {
        const fechaT = new Date(t.fechaTurno)
        if (filtros.desde) {
          const d = new Date(filtros.desde)
          d.setHours(0,0,0,0)
          if (fechaT < d) return false
        }
        if (filtros.hasta) {
          const h = new Date(filtros.hasta)
          h.setHours(23,59,59,999)
          if (fechaT > h) return false
        }
      }
      
      return true
    }).sort((a, b) => {
      const da = new Date(a.fechaTurno).getTime()
      const db = new Date(b.fechaTurno).getTime()
      return filtros.orden === 'nuevos' ? db - da : da - db
    })
  }, [turnos, filtros, prodMap])

const handleCambioEstado = async (id, nuevo)=>{
  const t = turnos.find(x=>x.id===id)
  if (t && (nuevo==='confirmado' || nuevo==='Aprobado') && String(t.tipoTurno).toLowerCase()==='insumo'){
    try{
      const { disponible } = await insumosService.disponibilidadPorProductor(t.productorId)
      await notify({ title: disponible ? 'Usted tiene turno para retirar.' : 'Usted no tiene insumos disponibles.', icon: disponible ? 'success' : 'warning' })
    }catch{}
  }
  try {
    await setEstadoTurno(id, nuevo)
    setTurnos(turnos.map(t=> t.id===id ? { ...t, estado: nuevo } : t))
    notify({ title: 'Estado actualizado', icon: 'success' })
  } catch (e) {
    notify({ title: 'Error al actualizar estado', icon: 'error' })
  }
}

const handleDesactivar = async (id) => {
  const confirm = await confirmDialog({ 
    title: '¿Desactivar turno?', 
    text: 'El turno pasará al historial.', 
    icon: 'warning',
    confirmButtonText: 'Desactivar',
  })
  if (confirm) {
    try {
      await eliminarTurno(id)
      setTurnos(turnos.filter(t => t.id !== id))
      notify({ title: 'Turno desactivado', icon: 'success' })
    } catch (e) {
      notify({ title: 'Error al desactivar', icon: 'error' })
    }
  }
}

const handleRestaurar = async (id) => {
  const confirm = await confirmDialog({ 
    title: '¿Restaurar turno?', 
    text: 'El turno volverá a la lista de activos.', 
    icon: 'info',
    confirmButtonText: 'Restaurar',
  })
  if (!confirm) return

  try {
    await restaurarTurno(id)
    setTurnos(turnos.filter(t => t.id !== id))
    notify({ title: 'Turno restaurado', icon: 'success' })
  } catch (e) {
    notify({ title: 'Error al restaurar', icon: 'error' })
  }
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

const formatMotivo = (motivo)=>{
  const m = String(motivo || '').trim()
  if(!m) return '-'
  if(m.toLowerCase().includes('vencido automáticamente por fecha')) return '-'
  return m
}

return (
  <div className="turnos-list">
    <div style={{ marginBottom: 8 }}><HomeButton /></div>
    
    <div className="header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
      <h2 className="users-title" style={{ margin: 0 }}>Gestión de Turnos</h2>
      <div className="view-tabs" style={{ display: 'flex', gap: 8 }}>
        <button 
          className={`btn ${viewMode === 'activos' ? 'primary' : 'secondary'}`} 
          onClick={() => setViewMode('activos')}
          style={{ padding: '6px 12px', fontSize: 14 }}
        >Activos</button>
        <button 
          className={`btn ${viewMode === 'historial' ? 'primary' : 'secondary'}`} 
          onClick={() => setViewMode('historial')}
          style={{ padding: '6px 12px', fontSize: 14 }}
        >Inactivos</button>
        <button 
          className={`btn ${viewMode === 'todos' ? 'primary' : 'secondary'}`} 
          onClick={() => setViewMode('todos')}
          style={{ padding: '6px 12px', fontSize: 14 }}
        >Todos</button>
      </div>
    </div>

    {/* Barra de Filtros */}
    <div className="filters-bar" style={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: 12, 
      backgroundColor: '#f8fafc', 
      padding: 16, 
      borderRadius: 12, 
      marginBottom: 20,
      border: '1px solid #e2e8f0'
    }}>
      <div className="filter-item">
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Ordenar</label>
        <select 
          className="select-inst" 
          value={filtros.orden}
          onChange={e => setFiltros({ ...filtros, orden: e.target.value })}
        >
          <option value="nuevos">Más nuevos primero</option>
          <option value="antiguos">Más antiguos primero</option>
        </select>
      </div>

      <div className="filter-item">
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Estado</label>
        <select 
          className="select-inst" 
          value={filtros.estado}
          onChange={e => setFiltros({ ...filtros, estado: e.target.value })}
        >
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="confirmado">Confirmado</option>
          <option value="cancelado">Cancelado</option>
          <option value="completado">Completado</option>
          <option value="vencido">Vencido</option>
        </select>
      </div>
      
      <div className="filter-item" style={{ flex: 1, minWidth: 200 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Productor / IPT</label>
        <input 
          type="text" 
          className="input-inst" 
          placeholder="Buscar por nombre o IPT..."
          value={filtros.productor}
          onChange={e => setFiltros({ ...filtros, productor: e.target.value })}
        />
      </div>

      <div className="filter-item">
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Desde</label>
        <input 
          type="date" 
          className="input-inst" 
          value={filtros.desde}
          onChange={e => setFiltros({ ...filtros, desde: e.target.value })}
        />
      </div>

      <div className="filter-item">
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Hasta</label>
        <input 
          type="date" 
          className="input-inst" 
          value={filtros.hasta}
          onChange={e => setFiltros({ ...filtros, hasta: e.target.value })}
        />
      </div>

      <div className="filter-item" style={{ alignSelf: 'flex-end' }}>
        <button 
          className="btn secondary" 
          onClick={() => setFiltros({ orden: 'nuevos', estado: 'todos', productor: '', desde: '', hasta: '' })}
          style={{ padding: '8px 16px' }}
        >Limpiar</button>
      </div>
    </div>

    {loading ? (
      <div style={{ padding: 16, color:'#166534', textAlign: 'center' }}>Cargando turnos…</div>
    ) : (
      <>
        {turnosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b', backgroundColor: '#f8fafc', borderRadius: 12 }}>
            No se encontraron turnos con los filtros aplicados.
          </div>
        ) : (
          <div className="turnos-grid">
            {turnosFiltrados.map(t=> (
              <div key={t.id} className="turno-card" style={{ opacity: t.activo === false ? 0.7 : 1 }}>
                <div className="turno-header">
                  <div className="turno-date">{formatDate(t.fechaTurno)}</div>
                  <div className={estadoClass(t.estado)}>{t.estado || 'Pendiente'}</div>
                </div>
                <div className="turno-item"><span className="turno-label">Productor:</span> {t.productorNombre || prodMap.get(String(t.productorId))?.nombre || 'No especificado'}</div>
                <div className="turno-item"><span className="turno-label">IPT:</span> {t.ipt || prodMap.get(String(t.productorId))?.ipt || '-'}</div>
                <div className="turno-item"><span className="turno-label">Tipo:</span> {tipoLabel(t.tipoTurno)}</div>
                <div className="turno-item"><span className="turno-label">Motivo:</span> {formatMotivo(t.motivo)}</div>
                
                {t.activo !== false ? (
                  <div className="turno-actions" style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
                    <select 
                      className="select-inst" 
                      style={{ width: '135px', minWidth: 'auto' }}
                      onChange={e=>handleCambioEstado(t.id, e.target.value)} 
                      defaultValue={t.estado}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="cancelado">Cancelado</option>
                      <option value="completado">Completado</option>
                      <option value="vencido">Vencido</option>
                    </select>
                    <button 
                      className="btn" 
                      style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px' }}
                      onClick={() => handleDesactivar(t.id)}
                    >Desactivar</button>
                  </div>
                ) : (
                  <div className="turno-actions" style={{ marginTop: 12 }}>
                    <button 
                      className="btn primary" 
                      style={{ width: '100%' }}
                      onClick={() => handleRestaurar(t.id)}
                    >Restaurar Turno</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </div>
)
}


export default TurnosList
const tipoLabel = (raw)=>{
  const s = String(raw||'').toLowerCase()
  if (s==='insumo') return 'Insumo'
  if (s==='carnet') return 'Renovación de Carnet'
  return 'Otro'
}
