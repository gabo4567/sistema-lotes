import React, { useEffect, useState, useMemo } from 'react'
import { getTurnos, setEstadoTurno, eliminarTurno, restaurarTurno } from '../services/turnos.service'
import { insumosService } from '../services/insumos.service'
import { notify, confirmDialog } from '../utils/alerts'
import { getProductores } from '../services/productores.service'
import HomeButton from '../components/HomeButton'

const toDateSafe = (raw) => {
  if (!raw) return null
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw
  if (typeof raw === 'string') {
    const str = raw.trim()
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
      return isNaN(d.getTime()) ? null : d
    }
    const d = new Date(str)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof raw === 'number') {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof raw === 'object') {
    const secs = raw?._seconds ?? raw?.seconds
    if (typeof secs === 'number') {
      const d = new Date(secs * 1000)
      return isNaN(d.getTime()) ? null : d
    }
  }
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

const toYmdLocal = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const startOfDayLocal = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const parseYmdLocal = (ymd, { endOfDay = false } = {}) => {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
  if (isNaN(d.getTime())) return null
  if (endOfDay) {
    d.setHours(23, 59, 59, 999)
  } else {
    d.setHours(0, 0, 0, 0)
  }
  return d
}

const normalizeEstado = (e) => String(e || 'pendiente').toLowerCase().trim()

const getDisplayEstado = (t) => {
  const est = normalizeEstado(t?.estado)
  if (est === 'completado' || est === 'cancelado' || est === 'vencido') return est
  const dt = toDateSafe(t?.fechaTurno || t?.fecha)
  if (!dt) return est || 'pendiente'
  const hoy = startOfDayLocal(new Date())
  const turnoDia = startOfDayLocal(dt)
  if (turnoDia.getTime() < hoy.getTime()) return 'vencido'
  return est || 'pendiente'
}

const TurnosList = () => {
const [turnos, setTurnos] = useState([])
const [prodMap, setProdMap] = useState(new Map())
const [loading, setLoading] = useState(true)
const [error, setError] = useState('')
const [viewMode, setViewMode] = useState('activos') // 'activos', 'historial', 'todos'
const [viewStyle, setViewStyle] = useState('cards') // 'cards' | 'agenda'
const [updatingId, setUpdatingId] = useState(null)
const [expandedId, setExpandedId] = useState(null)

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
  setError('')
  try {
    // Si es historial, pedimos activo=false, si es activos pedimos activo=true, si es todos no pasamos parámetro
    const activoParam = viewMode === 'activos' ? true : (viewMode === 'historial' ? false : undefined)
    const ts = await getTurnos(activoParam)
    setTurnos(ts)
    
    if (prodMap.size === 0) {
      try {
        const { data: productores } = await getProductores()
        const map = new Map()
        const productoresList = Array.isArray(productores) ? productores : []
        productoresList.forEach(p=>{ 
          map.set(String(p.id), { 
            nombre: p.nombreCompleto || p.nombre || '', 
            ipt: String(p.ipt||''),
            iptNum: p.ipt
          }) 
        })
        setProdMap(map)
      } catch { null }
    }
  } catch(e) {
    console.error(e)
    setError(e?.response?.data?.message || e?.message || 'No se pudieron cargar los turnos.')
  }
  finally { setLoading(false) }
}

useEffect(() => {
  loadData()
}, [viewMode])

  const turnosFiltrados = useMemo(() => {
    return turnos.filter(t => {
      // Filtro por estado
      if (filtros.estado !== 'todos' && getDisplayEstado(t) !== filtros.estado) return false
      
      // Filtro por productor (nombre o IPT)
      if (filtros.productor) {
        const search = filtros.productor.toLowerCase().trim()
        if (!search) return true
        
        const pInfo = prodMap.get(String(t.productorId))
        const nombreTurno = String(t.productorNombre || '').toLowerCase()
        const iptTurno = String(t.ipt || '').toLowerCase()
        
        // Verificar si pInfo existe antes de intentar acceder a sus propiedades
        const nombre = (pInfo?.nombre || '').toLowerCase()
        const ipt = String(pInfo?.ipt || '').toLowerCase()
        const iptNum = String(pInfo?.iptNum || '')
        
        // Buscar coincidencia en nombre, ipt o iptNum
        const matchNombre = nombre.includes(search) || nombreTurno.includes(search)
        const matchIPT = ipt.includes(search) || iptNum.includes(search) || iptTurno.includes(search)
        
        if (!matchNombre && !matchIPT) return false
      }
      
      // Filtro por rango de fechas
      if (filtros.desde || filtros.hasta) {
        const fechaT = toDateSafe(t.fechaTurno || t.fecha)
        if (!fechaT) return false
        if (filtros.desde) {
          const d = parseYmdLocal(filtros.desde, { endOfDay: false })
          if (!d) return false
          if (fechaT < d) return false
        }
        if (filtros.hasta) {
          const h = parseYmdLocal(filtros.hasta, { endOfDay: true })
          if (!h) return false
          if (fechaT > h) return false
        }
      }
      
      return true
    }).sort((a, b) => {
      const da = toDateSafe(a.fechaTurno || a.fecha)?.getTime() ?? 0
      const db = toDateSafe(b.fechaTurno || b.fecha)?.getTime() ?? 0
      return filtros.orden === 'nuevos' ? db - da : da - db
    })
  }, [turnos, filtros, prodMap])

const handleCambioEstado = async (id, nuevo)=>{
  if (updatingId === id) return
  setUpdatingId(id)
  const t = turnos.find(x=>x.id===id)
  if (t && (nuevo==='confirmado' || nuevo==='Aprobado') && String(t.tipoTurno).toLowerCase()==='insumo'){
    try{
      const { disponible } = await insumosService.disponibilidadPorProductor(t.productorId)
      await notify({ title: disponible ? 'Usted tiene turno para retirar.' : 'Usted no tiene insumos disponibles.', icon: disponible ? 'success' : 'warning' })
    }catch{ null }
  }
  try {
    await setEstadoTurno(id, nuevo)
    setTurnos(turnos.map(t=> t.id===id ? { ...t, estado: nuevo } : t))
    setError('')
    notify({ title: 'Estado actualizado', icon: 'success' })
  } catch (e) {
    const message = e?.response?.data?.message || e?.message || 'No se pudo actualizar el estado.'
    setError(message)
    notify({ title: message, icon: 'error' })
  } finally {
    setUpdatingId((cur) => (cur === id ? null : cur))
  }
}

const handleDesactivar = async (id) => {
  if (updatingId === id) return
  const confirm = await confirmDialog({ 
    title: 'Confirmar desactivación', 
    text: '¿Seguro que querés desactivar este turno?', 
    icon: 'warning',
    confirmButtonText: 'Desactivar',
    cancelButtonText: 'Cancelar',
  })
  if (confirm) {
    setUpdatingId(id)
    try {
      await eliminarTurno(id)
      setTurnos(turnos.filter(t => t.id !== id))
      setError('')
      notify({ title: 'Turno desactivado', icon: 'success' })
    } catch (e) {
      const message = e?.response?.data?.message || e?.message || 'No se pudo desactivar el turno.'
      setError(message)
      notify({ title: message, icon: 'error' })
    } finally {
      setUpdatingId((cur) => (cur === id ? null : cur))
    }
  }
}

const handleRestaurar = async (id) => {
  if (updatingId === id) return
  const confirm = await confirmDialog({ 
    title: '¿Restaurar turno?', 
    text: 'El turno volverá a la lista de activos.', 
    icon: 'info',
    confirmButtonText: 'Restaurar',
  })
  if (!confirm) return

  setUpdatingId(id)
  try {
    await restaurarTurno(id)
    setTurnos(turnos.filter(t => t.id !== id))
    setError('')
    notify({ title: 'Turno restaurado', icon: 'success' })
  } catch (e) {
    const message = e?.response?.data?.message || e?.message || 'No se pudo restaurar el turno.'
    setError(message)
    notify({ title: message, icon: 'error' })
  } finally {
    setUpdatingId((cur) => (cur === id ? null : cur))
  }
}

const formatDate = (d)=>{
  try{
    if(!d) return '-'
    const date = toDateSafe(d)
    if(isNaN(date.getTime())) return String(d)
    const dd = String(date.getDate()).padStart(2,'0')
    const mm = String(date.getMonth()+1).padStart(2,'0')
    const yyyy = date.getFullYear()
    return `${dd}-${mm}-${yyyy}`
  }catch{ return String(d) }
}

const formatTime = (d)=>{
  try{
    const date = toDateSafe(d)
    if(!date) return '-'
    const hh = String(date.getHours()).padStart(2,'0')
    const mm = String(date.getMinutes()).padStart(2,'0')
    return `${hh}:${mm}`
  }catch{ return '-' }
}

const estadoLabel = (e)=>{
  const v = normalizeEstado(e)
  if(v==='pendiente') return 'Pendiente'
  if(v==='confirmado') return 'Confirmado'
  if(v==='cancelado') return 'Cancelado'
  if(v==='completado') return 'Completado'
  if(v==='vencido') return 'Vencido'
  return v || 'Pendiente'
}

const estadoClass = (e)=>{
  const v = normalizeEstado(e)
  if(v==='pendiente') return 'estado-badge pending'
  if(v==='confirmado') return 'estado-badge confirmed'
  if(v==='completado') return 'estado-badge completed'
  if(v==='cancelado') return 'estado-badge canceled'
  if(v==='vencido') return 'estado-badge expired'
  return 'estado-badge pending'
}

const formatMotivo = (motivo)=>{
  const m = String(motivo || '').trim()
  if(!m) return '-'
  if(m.toLowerCase().includes('vencido automáticamente por fecha')) return '-'
  return m
}

const todayYmd = useMemo(() => toYmdLocal(new Date()), [])
const isHoyFilterActive = filtros.desde === todayYmd && filtros.hasta === todayYmd
const turnosHoyCount = useMemo(() => {
  return turnosFiltrados.filter(t => {
    const dt = toDateSafe(t?.fechaTurno || t?.fecha)
    if (!dt) return false
    return toYmdLocal(dt) === todayYmd
  }).length
}, [turnosFiltrados, todayYmd])

const summary = useMemo(() => {
  const counts = { total: 0, hoy: 0, pendiente: 0, confirmado: 0, cancelado: 0, completado: 0, vencido: 0 }
  turnosFiltrados.forEach(t => {
    counts.total += 1
    const dt = toDateSafe(t?.fechaTurno || t?.fecha)
    if (dt && toYmdLocal(dt) === todayYmd) counts.hoy += 1
    const est = getDisplayEstado(t)
    if (est === 'pendiente') counts.pendiente += 1
    if (est === 'confirmado') counts.confirmado += 1
    if (est === 'cancelado') counts.cancelado += 1
    if (est === 'completado') counts.completado += 1
    if (est === 'vencido') counts.vencido += 1
  })
  return counts
}, [turnosFiltrados, todayYmd])

const agendaItems = useMemo(() => {
  const arr = [...turnosFiltrados]
  arr.sort((a, b) => {
    const da = toDateSafe(a?.fechaTurno || a?.fecha)?.getTime() ?? 0
    const db = toDateSafe(b?.fechaTurno || b?.fecha)?.getTime() ?? 0
    return da - db
  })
  return arr
}, [turnosFiltrados])

const toggleExpand = (id) => {
  setExpandedId((cur) => (cur === id ? null : id))
}

const setTodayFilter = () => {
  setFiltros((cur) => ({ ...cur, desde: todayYmd, hasta: todayYmd }))
}

const clearTodayFilter = () => {
  setFiltros((cur) => {
    const next = { ...cur }
    if (next.desde === todayYmd) next.desde = ''
    if (next.hasta === todayYmd) next.hasta = ''
    return next
  })
}

const canQuickConfirm = (t) => {
  const est = getDisplayEstado(t)
  return est !== 'confirmado' && est !== 'completado' && est !== 'cancelado' && est !== 'vencido'
}

const canQuickComplete = (t) => {
  const est = getDisplayEstado(t)
  return est !== 'completado' && est !== 'cancelado'
}

const canQuickCancel = (t) => {
  const est = getDisplayEstado(t)
  return est !== 'cancelado' && est !== 'completado'
}

return (
  <div className="turnos-list page-container">
    <div style={{ marginBottom: 8 }}><HomeButton /></div>
    
    <div className="header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
      <h2 className="users-title" style={{ margin: 0 }}>Gestión de Turnos</h2>
      <div className="view-tabs" style={{ display: 'flex', gap: 8 }}>
        <button 
          className={`btn turnos-toggle-btn ${viewMode === 'activos' ? 'turnos-toggle-btn--active' : ''}`} 
          onClick={() => setViewMode('activos')}
          style={{ padding: '6px 12px', fontSize: 14 }}
        >Activos</button>
        <button 
          className={`btn turnos-toggle-btn ${viewMode === 'historial' ? 'turnos-toggle-btn--active' : ''}`} 
          onClick={() => setViewMode('historial')}
          style={{ padding: '6px 12px', fontSize: 14 }}
        >Inactivos</button>
        <button 
          className={`btn turnos-toggle-btn ${viewMode === 'todos' ? 'turnos-toggle-btn--active' : ''}`} 
          onClick={() => setViewMode('todos')}
          style={{ padding: '6px 12px', fontSize: 14 }}
        >Todos</button>
      </div>
    </div>

    {error ? (
      <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#991b1b', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{error}</span>
        <button className="btn secondary" onClick={loadData} style={{ padding: '6px 12px' }}>Reintentar</button>
      </div>
    ) : null}

    <div className="turnos-toolbar">
      <div className="turnos-toolbar__left">
        <div className="turnos-search">
          <input
            type="text"
            className="input-inst"
            placeholder="Buscar por productor o IPT…"
            value={filtros.productor}
            onChange={e => setFiltros({ ...filtros, productor: e.target.value })}
          />
        </div>

        <div className="turnos-today">
          <button
            className={`btn ${isHoyFilterActive ? 'secondary' : 'primary'}`}
            onClick={isHoyFilterActive ? clearTodayFilter : setTodayFilter}
            disabled={loading}
          >
            {isHoyFilterActive ? 'Quitar filtro de hoy' : 'Ver turnos de hoy'}
          </button>
          <div className="turnos-today__count">
            <span className="turnos-today__label">Turnos hoy:</span>
            <span className="turnos-today__value">{turnosHoyCount}</span>
          </div>
        </div>
      </div>

      <div className="turnos-toolbar__right">
        <div className="turnos-view-toggle">
          <button
            className={`btn turnos-toggle-btn ${viewStyle === 'cards' ? 'turnos-toggle-btn--active' : ''}`}
            onClick={() => setViewStyle('cards')}
          >
            Tarjetas
          </button>
          <button
            className={`btn turnos-toggle-btn ${viewStyle === 'agenda' ? 'turnos-toggle-btn--active' : ''}`}
            onClick={() => setViewStyle('agenda')}
          >
            Agenda
          </button>
        </div>
      </div>
    </div>

    <div className="turnos-summary">
      <div className="turnos-summary__chip turnos-summary__chip--pending">
        <span className="turnos-summary__label">Pendientes</span>
        <span className={`estado-badge pending`}>{summary.pendiente}</span>
      </div>
      <div className="turnos-summary__chip turnos-summary__chip--confirmed">
        <span className="turnos-summary__label">Confirmados</span>
        <span className={`estado-badge confirmed`}>{summary.confirmado}</span>
      </div>
      <div className="turnos-summary__chip turnos-summary__chip--canceled">
        <span className="turnos-summary__label">Cancelados</span>
        <span className={`estado-badge canceled`}>{summary.cancelado}</span>
      </div>
      <div className="turnos-summary__chip turnos-summary__chip--completed">
        <span className="turnos-summary__label">Completados</span>
        <span className={`estado-badge completed`}>{summary.completado}</span>
      </div>
      <div className="turnos-summary__chip turnos-summary__chip--expired">
        <span className="turnos-summary__label">Vencidos</span>
        <span className={`estado-badge expired`}>{summary.vencido}</span>
      </div>
      <div className="turnos-summary__chip turnos-summary__chip--total">
        <span className="turnos-summary__label">Total</span>
        <span className={`estado-badge expired`}>{summary.total}</span>
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
          viewStyle === 'agenda' ? (
            <div className="turnos-agenda">
              <div className="turnos-agenda__wrap">
                <table className="turnos-agenda__table">
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>Hora</th>
                      <th style={{ width: 280 }}>Productor</th>
                      <th style={{ width: 120 }}>IPT</th>
                      <th style={{ width: 180 }}>Tipo</th>
                      <th style={{ width: 140 }}>Estado</th>
                      <th style={{ width: 320 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendaItems.map(t => {
                      const displayEstado = getDisplayEstado(t)
                      const isExpanded = expandedId === t.id
                      const isUpdating = updatingId === t.id
                      const productorNombre = t.productorNombre || prodMap.get(String(t.productorId))?.nombre || 'No especificado'
                      const ipt = t.ipt || prodMap.get(String(t.productorId))?.ipt || '-'
                      return (
                        <React.Fragment key={t.id}>
                          <tr
                            className="turnos-agenda__row"
                            onClick={() => toggleExpand(t.id)}
                          >
                            <td className="turnos-agenda__cell">{formatTime(t.fechaTurno || t.fecha)}</td>
                            <td className="turnos-agenda__cell">{productorNombre}</td>
                            <td className="turnos-agenda__cell">{ipt}</td>
                            <td className="turnos-agenda__cell">{tipoLabel(t.tipoTurno)}</td>
                            <td className="turnos-agenda__cell">
                              <span className={estadoClass(displayEstado)}>{estadoLabel(displayEstado)}</span>
                            </td>
                            <td className="turnos-agenda__cell" onClick={(e) => e.stopPropagation()}>
                              {t.activo !== false ? (
                                <div className="turnos-quick-actions">
                                  {isUpdating ? <span className="turnos-updating">Actualizando…</span> : null}
                                  <button className="btn secondary" disabled={isUpdating || !canQuickConfirm(t)} onClick={() => handleCambioEstado(t.id, 'confirmado')}>Confirmar</button>
                                  <button className="btn secondary" disabled={isUpdating || !canQuickCancel(t)} onClick={() => handleCambioEstado(t.id, 'cancelado')}>Cancelar</button>
                                  <button className="btn secondary" disabled={isUpdating || !canQuickComplete(t)} onClick={() => handleCambioEstado(t.id, 'completado')}>Completar</button>
                                  <select
                                    className="select-inst"
                                    value={normalizeEstado(t.estado)}
                                    disabled={isUpdating}
                                    onChange={e => handleCambioEstado(t.id, e.target.value)}
                                    style={{ width: 150, minWidth: 'auto' }}
                                  >
                                    <option value="pendiente">Pendiente</option>
                                    <option value="confirmado">Confirmado</option>
                                    <option value="cancelado">Cancelado</option>
                                    <option value="completado">Completado</option>
                                    <option value="vencido">Vencido</option>
                                  </select>
                                  <button className="btn" disabled={isUpdating} onClick={() => handleDesactivar(t.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none' }}>
                                    {isUpdating ? 'Actualizando…' : 'Desactivar'}
                                  </button>
                                </div>
                              ) : (
                                <button className="btn primary" disabled={isUpdating} onClick={() => handleRestaurar(t.id)}>
                                  {isUpdating ? 'Actualizando…' : 'Restaurar'}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="turnos-agenda__detail">
                              <td colSpan={6}>
                                <div className="turnos-detail">
                                  <div><strong>Fecha:</strong> {formatDate(t.fechaTurno || t.fecha)} {formatTime(t.fechaTurno || t.fecha)}</div>
                                  <div><strong>Motivo:</strong> {String(t.motivo || '-')}</div>
                                  <div><strong>Productor ID:</strong> {t.productorId || '-'}</div>
                                  <div><strong>Turno ID:</strong> {t.id}</div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="turnos-grid">
              {turnosFiltrados.map(t=> {
                const displayEstado = getDisplayEstado(t)
                const isExpanded = expandedId === t.id
                const isUpdating = updatingId === t.id
                const productorNombre = t.productorNombre || prodMap.get(String(t.productorId))?.nombre || 'No especificado'
                const ipt = t.ipt || prodMap.get(String(t.productorId))?.ipt || '-'
                return (
                  <div
                    key={t.id}
                    className={`turno-card ${isExpanded ? 'turno-card--expanded' : ''}`}
                    style={{ opacity: t.activo === false ? 0.7 : 1 }}
                    onClick={() => toggleExpand(t.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="turno-header">
                      <div className="turno-date">{formatDate(t.fechaTurno || t.fecha)} · {formatTime(t.fechaTurno || t.fecha)}</div>
                      <div className={estadoClass(displayEstado)}>{estadoLabel(displayEstado)}</div>
                    </div>
                    <div className="turno-item"><span className="turno-label">Productor:</span> {productorNombre}</div>
                    <div className="turno-item"><span className="turno-label">IPT:</span> {ipt}</div>
                    <div className="turno-item"><span className="turno-label">Tipo:</span> {tipoLabel(t.tipoTurno)}</div>
                    <div className="turno-item"><span className="turno-label">Motivo:</span> {formatMotivo(t.motivo)}</div>

                    {isExpanded && (
                      <div className="turnos-detail" onClick={(e) => e.stopPropagation()}>
                        <div><strong>Motivo completo:</strong> {String(t.motivo || '-')}</div>
                        <div><strong>Productor ID:</strong> {t.productorId || '-'}</div>
                        <div><strong>Turno ID:</strong> {t.id}</div>
                      </div>
                    )}
                    
                    <div className="turno-actions" onClick={(e) => e.stopPropagation()}>
                      {t.activo !== false ? (
                        <>
                          <div className="turnos-quick-actions">
                            {isUpdating ? <span className="turnos-updating">Actualizando…</span> : null}
                            <button className="btn secondary" disabled={isUpdating || !canQuickConfirm(t)} onClick={() => handleCambioEstado(t.id, 'confirmado')}>Confirmar</button>
                            <button className="btn secondary" disabled={isUpdating || !canQuickCancel(t)} onClick={() => handleCambioEstado(t.id, 'cancelado')}>Cancelar</button>
                            <button className="btn secondary" disabled={isUpdating || !canQuickComplete(t)} onClick={() => handleCambioEstado(t.id, 'completado')}>Completar</button>
                          </div>

                          <div className="turnos-actions-row">
                            <select 
                              className="select-inst" 
                              style={{ width: '160px', minWidth: 'auto' }}
                              onChange={e=>handleCambioEstado(t.id, e.target.value)} 
                              value={normalizeEstado(t.estado)}
                              disabled={isUpdating}
                            >
                              <option value="pendiente">Pendiente</option>
                              <option value="confirmado">Confirmado</option>
                              <option value="cancelado">Cancelado</option>
                              <option value="completado">Completado</option>
                              <option value="vencido">Vencido</option>
                            </select>
                            <button 
                              className="btn" 
                              disabled={isUpdating}
                              style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px' }}
                              onClick={() => handleDesactivar(t.id)}
                            >{isUpdating ? 'Actualizando…' : 'Desactivar'}</button>
                          </div>
                        </>
                      ) : (
                        <button 
                          className="btn primary" 
                          style={{ width: '100%' }}
                          disabled={isUpdating}
                          onClick={() => handleRestaurar(t.id)}
                        >{isUpdating ? 'Actualizando…' : 'Restaurar Turno'}</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
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
