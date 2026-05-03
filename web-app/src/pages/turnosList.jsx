import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { getTurnos, setEstadoTurno, eliminarTurno, restaurarTurno, getCapacidadTurnoDia, setCapacidadTurnoDia, getTurnosConfig, setTurnosConfig } from '../services/turnos.service'
import { insumosService } from '../services/insumos.service'
import { notify, confirmDialog } from '../utils/alerts'
import { isTurnosHabilitados } from '../utils/turnos.utils'
import { getProductores } from '../services/productores.service'
import HomeButton from '../components/HomeButton'
import { db } from '../services/firebase'

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

const isValidYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim())

const normalizeEstado = (e) => String(e || 'pendiente').toLowerCase().trim()

const IPT_TIMEZONE = 'America/Argentina/Buenos_Aires'
const HORA_APERTURA = 7
const HORA_CIERRE = 13

const toYmdInIptTz = (date) => {
  try {
    const d = date instanceof Date ? date : new Date(date)
    if (!(d instanceof Date) || isNaN(d.getTime())) return null
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: IPT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    return fmt.format(d)
  } catch {
    return null
  }
}

const toHmInIptTz = (date) => {
  try {
    const d = date instanceof Date ? date : new Date(date)
    if (!(d instanceof Date) || isNaN(d.getTime())) return null
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: IPT_TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    const parts = fmt.formatToParts(d)
    const hour = Number(parts.find(p => p.type === 'hour')?.value)
    const minute = Number(parts.find(p => p.type === 'minute')?.value)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return { hour, minute }
  } catch {
    return null
  }
}

const getCompletarPolicy = (turno) => {
  const dt = toDateSafe(turno?.fechaTurno || turno?.fecha)
  if (!dt) {
    return { allowed: true, needsConfirm: true, message: 'No se pudo validar la fecha del turno. ¿Confirmás completar igualmente?' }
  }
  const hoyYmd = toYmdInIptTz(new Date())
  const turnoYmd = toYmdInIptTz(dt)
  if (!hoyYmd || !turnoYmd) {
    return { allowed: true, needsConfirm: true, message: 'No se pudo validar la fecha del turno. ¿Confirmás completar igualmente?' }
  }
  if (turnoYmd > hoyYmd) {
    return { allowed: false, needsConfirm: false, message: 'No se puede completar un turno futuro.' }
  }
  if (turnoYmd < hoyYmd) {
    return { allowed: true, needsConfirm: true, message: 'Estás completando un turno de un día pasado. ¿Confirmás completar igualmente?' }
  }
  const hm = toHmInIptTz(new Date())
  if (!hm) {
    return { allowed: true, needsConfirm: true, message: 'No se pudo validar el horario actual. ¿Confirmás completar igualmente?' }
  }
  const mins = hm.hour * 60 + hm.minute
  const inHours = mins >= HORA_APERTURA * 60 && mins <= HORA_CIERRE * 60
  if (!inHours) {
    return { allowed: true, needsConfirm: true, message: `Estás fuera del horario de atención (${String(HORA_APERTURA).padStart(2, '0')}:00–${String(HORA_CIERRE).padStart(2, '0')}:00). ¿Confirmás completar igualmente?` }
  }
  return { allowed: true, needsConfirm: false, message: '' }
}

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
const [insumosDispByProd, setInsumosDispByProd] = useState({})

const [capModalOpen, setCapModalOpen] = useState(false)
const [capFecha, setCapFecha] = useState(toYmdLocal(new Date()))
const [capacidad, setCapacidad] = useState('')
const [capInfo, setCapInfo] = useState(null)
const [capLoading, setCapLoading] = useState(false)
const [capSaving, setCapSaving] = useState(false)

const [cfgModalOpen, setCfgModalOpen] = useState(false)
const [cfgLoading, setCfgLoading] = useState(false)
const [cfgSaving, setCfgSaving] = useState(false)
const [cfgModo, setCfgModo] = useState('manual') // 'manual' | 'rango'
const [cfgHabilitado, setCfgHabilitado] = useState(true)
const [cfgEstadoActual, setCfgEstadoActual] = useState(null)
const [cfgMensaje, setCfgMensaje] = useState('')
const [cfgDesde, setCfgDesde] = useState('')
const [cfgHasta, setCfgHasta] = useState('')
const [draftDesde, setDraftDesde] = useState('')
const [draftHasta, setDraftHasta] = useState('')
const [cfgRangoModo, setCfgRangoModo] = useState('enable') // 'enable' | 'disable'
const [cfgRangeIntentOpen, setCfgRangeIntentOpen] = useState(false)
const [cfgPendingDesde, setCfgPendingDesde] = useState('')
const [cfgPendingHasta, setCfgPendingHasta] = useState('')

// Estados para filtros
const [filtros, setFiltros] = useState({
  orden: 'proximos',
  estado: 'todos',
  productor: '',
  desde: '',
  hasta: ''
})

const loadData = useCallback(async ({ showLoading = true } = {}) => {
  if (showLoading) setLoading(true)
  setError('')
  try {
    // Si es historial, pedimos activo=false, si es activos pedimos activo=true, si es todos no pasamos parámetro
    const activoParam = viewMode === 'activos' ? true : (viewMode === 'historial' ? false : null)
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
  finally { if (showLoading) setLoading(false) }
}, [viewMode, prodMap.size])

useEffect(() => {
  loadData()
}, [viewMode, loadData])

useEffect(() => {
  if (viewMode === 'historial') setExpandedId(null)
}, [viewMode])

useEffect(() => {
  const refreshTimerRef = { current: null }
  const scheduleRefresh = () => {
    if (refreshTimerRef.current) return
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null
      loadData({ showLoading: false })
    }, 200)
  }

  const base = collection(db, 'turnos')
  const qRef = viewMode === 'activos'
    ? query(base, where('activo', '==', true))
    : (viewMode === 'historial'
      ? query(base, where('activo', '==', false))
      : base)

  const unsub = onSnapshot(
    qRef,
    (snap) => {
      const changes = snap.docChanges()
      if (changes.length === 0) return
      scheduleRefresh()
    },
    (err) => {
      console.error('Firestore onSnapshot error:', err)
      loadData({ showLoading: false })
    }
  )

  return () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    unsub()
  }
}, [viewMode, loadData])

useEffect(() => {
  const handleFocus = () => loadData({ showLoading: false })
  window.addEventListener('focus', handleFocus)
  return () => window.removeEventListener('focus', handleFocus)
}, [viewMode, loadData])

useEffect(() => {
  const id = window.setInterval(() => {
    if (document.hidden) return
    loadData({ showLoading: false })
  }, 10000)
  return () => window.clearInterval(id)
}, [loadData])

useEffect(() => {
  if (!capModalOpen) return
  if (!isValidYmd(capFecha)) return
  let mounted = true
  setCapLoading(true)
  getCapacidadTurnoDia(capFecha)
    .then((data) => {
      if (!mounted) return
      setCapInfo(data)
      const v = data?.capacidad
      setCapacidad(v === 0 || v ? String(v) : '')
    })
    .catch((e) => {
      console.error(e)
      notify({ title: e?.response?.data?.message || e?.message || 'No se pudo cargar la capacidad.', icon: 'error' })
    })
    .finally(() => { if (mounted) setCapLoading(false) })
  return () => { mounted = false }
}, [capModalOpen, capFecha])

useEffect(() => {
  if (!cfgModalOpen) return
  let mounted = true
  setCfgLoading(true)
  getTurnosConfig()
    .then((data) => {
      if (!mounted) return
      const modoRaw = String(data?.modo || '').toLowerCase().trim()
      const hasRange = Boolean(data?.desde || data?.hasta)
      const modo = modoRaw === 'manual' || modoRaw === 'rango' ? modoRaw : (hasRange ? 'rango' : 'manual')
      setCfgModo(modo)
      setCfgHabilitado(Boolean(data?.habilitado))
      setCfgEstadoActual(typeof data?.estadoActual === 'boolean' ? data.estadoActual : null)
      setCfgMensaje(String(data?.mensaje || ''))
      const d = String(data?.desde || '')
      const h = String(data?.hasta || '')
      setCfgDesde(d)
      setCfgHasta(h)
      setDraftDesde(d)
      setDraftHasta(h)
      setCfgRangoModo(String(data?.rangoModo || 'enable') === 'disable' ? 'disable' : 'enable')
    })
    .catch((e) => {
      console.error(e)
      notify({ title: e?.response?.data?.message || e?.message || 'No se pudo cargar la configuración.', icon: 'error' })
    })
    .finally(() => { if (mounted) setCfgLoading(false) })
  return () => { mounted = false }
}, [cfgModalOpen])

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
      const aMs = toDateSafe(a?.fechaTurno || a?.fecha)?.getTime() ?? null
      const bMs = toDateSafe(b?.fechaTurno || b?.fecha)?.getTime() ?? null
      if (aMs === null && bMs === null) return 0
      if (aMs === null) return 1
      if (bMs === null) return -1
      return filtros.orden === 'lejanos' ? bMs - aMs : aMs - bMs
    })
  }, [turnos, filtros, prodMap])

const handleCambioEstado = async (id, nuevo, { onCancel } = {})=>{
  if (updatingId === id) {
    if (typeof onCancel === 'function') onCancel()
    return
  }

  const labels = { pendiente: 'Pendiente', confirmado: 'Confirmado', cancelado: 'Cancelado', completado: 'Completado', vencido: 'Vencido' }
  const normalizedNuevo = normalizeEstado(nuevo)
  const displayNuevo = labels[normalizedNuevo] || String(nuevo || '').trim() || labels[normalizedNuevo] || 'Pendiente'

  const currentTurno = turnos.find(x=>x.id===id)
  const fromForTransition = currentTurno
    ? (normalizedNuevo === 'completado' ? normalizeEstado(currentTurno?.estado) : getDisplayEstado(currentTurno))
    : null
  if (fromForTransition && !canTransitionEstado(fromForTransition, normalizedNuevo)) {
    notify({ title: `Transición no permitida: ${fromForTransition} → ${normalizedNuevo}`, icon: 'error' })
    if (typeof onCancel === 'function') onCancel()
    return
  }
  if (fromForTransition && normalizeEstado(fromForTransition) === normalizedNuevo) {
    if (typeof onCancel === 'function') onCancel()
    return
  }

  let force = false
  if (normalizedNuevo === 'completado') {
    const policy = getCompletarPolicy(currentTurno)
    if (!policy.allowed) {
      notify({ title: policy.message || 'No se puede completar este turno.', icon: 'error' })
      if (typeof onCancel === 'function') onCancel()
      return
    }
    if (policy.needsConfirm) {
      const ok = await confirmDialog({
        title: 'Confirmar completar turno',
        text: policy.message,
        icon: 'warning',
        confirmButtonText: 'Completar',
        cancelButtonText: 'Cancelar',
      })
      if (!ok) {
        if (typeof onCancel === 'function') onCancel()
        return
      }
      force = true
    }
  } else {
    const confirm = await confirmDialog({
      title: 'Confirmar cambio de estado',
      text: `¿Seguro que querés cambiar el estado a "${displayNuevo}"?`,
      icon: 'warning',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    })
    if (!confirm) {
      if (typeof onCancel === 'function') onCancel()
      return
    }
  }

  setUpdatingId(id)
  const t = turnos.find(x=>x.id===id)
  if (t && (nuevo==='confirmado' || nuevo==='Aprobado') && String(t.tipoTurno).toLowerCase()==='insumo'){
    try{
      const disp = await loadInsumosDisp(t.productorId)
      const tiene = Boolean(disp?.tieneDisponible ?? disp?.disponible)
      const asignado = Number(disp?.totalAsignado ?? 0)
      const entregado = Number(disp?.totalEntregado ?? 0)
      const disponible = Number(disp?.totalDisponible ?? 0)
      await notify({
        title: tiene ? 'Insumos disponibles para retirar' : 'Sin insumos disponibles',
        text: `Asignado: ${asignado} · Entregado: ${entregado} · Disponible: ${disponible}`,
        icon: tiene ? 'success' : 'warning'
      })
    }catch{ null }
  }
  try {
    const motivoForAdminCancel = normalizeEstado(nuevo) === 'cancelado' ? 'Cancelado por el administrador' : undefined
    await setEstadoTurno(id, nuevo, motivoForAdminCancel, force ? { force: true } : undefined)
    setTurnos(turnos.map(t=> t.id===id ? { ...t, estado: nuevo, ...(motivoForAdminCancel ? { motivo: motivoForAdminCancel } : {}) } : t))
    setError('')
    notify({ title: 'Estado actualizado', icon: 'success' })
  } catch (e) {
    if (normalizedNuevo === 'completado' && e?.response?.status === 409 && e?.response?.data?.requiresConfirmation) {
      const ok = await confirmDialog({
        title: 'Confirmar completar turno',
        text: e?.response?.data?.message || 'Confirmá para completar igualmente.',
        icon: 'warning',
        confirmButtonText: 'Completar',
        cancelButtonText: 'Cancelar',
      })
      if (!ok) return
      await setEstadoTurno(id, nuevo, undefined, { force: true })
      setTurnos(turnos.map(t=> t.id===id ? { ...t, estado: nuevo } : t))
      setError('')
      notify({ title: 'Estado actualizado', icon: 'success' })
      return
    }
    const message = e?.response?.data?.message || e?.message || 'No se pudo actualizar el estado.'
    setError(message)
    notify({ title: message, icon: 'error' })
  } finally {
    setUpdatingId((cur) => (cur === id ? null : cur))
  }
}

const handleArchivar = async (id) => {
  if (updatingId === id) return
  const currentTurno = turnos.find(t => t.id === id)
  const currentEstado = currentTurno ? getDisplayEstado(currentTurno) : null
  const canArchive = currentEstado === 'cancelado' || currentEstado === 'completado' || currentEstado === 'vencido'
  if (!canArchive) {
    notify({ title: 'Solo se pueden archivar turnos cancelados, completados o vencidos.', icon: 'error' })
    return
  }
  const confirm = await confirmDialog({ 
    title: 'Confirmar archivo', 
    text: '¿Seguro que querés archivar este turno?', 
    icon: 'warning',
    confirmButtonText: 'Archivar',
    cancelButtonText: 'Cancelar',
  })
  if (confirm) {
    setUpdatingId(id)
    try {
      await eliminarTurno(id)
      setTurnos(turnos.filter(t => t.id !== id))
      setError('')
      notify({ title: 'Turno archivado', icon: 'success' })
    } catch (e) {
      const message = e?.response?.data?.message || e?.message || 'No se pudo archivar el turno.'
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

const formatFechaLarga = (ymd) => {
  const raw = String(ymd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ''
  const d = new Date(`${raw}T12:00:00.000Z`)
  if (isNaN(d.getTime())) return ''
  try {
    const fmt = new Intl.DateTimeFormat('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const s = fmt.format(d)
    if (!s) return ''
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch {
    return ''
  }
}

const formatYmdCorto = (ymd) => {
  const raw = String(ymd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ''
  const [yyyy, mm, dd] = raw.split('-')
  return `${dd}/${mm}/${yyyy}`
}

const formatYmdCortoOrDash = (ymd) => formatYmdCorto(ymd) || '—'

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
  if(m.toLowerCase().includes('cancelado por el productor')) return '-'
  if(m.toLowerCase().includes('cancelado por el administrador')) return '-'
  return m
}

const getCancelNotice = (t) => {
  const est = normalizeEstado(t?.estado)
  if (est !== 'cancelado') return null
  const m = String(t?.motivo || '').trim().toLowerCase()
  if (!m) return 'Cancelado por el administrador'
  if (m.includes('administrador')) return 'Cancelado por el administrador'
  return 'Cancelado por el productor'
}

const getExpiredNotice = (t) => {
  const est = getDisplayEstado(t)
  if (est !== 'vencido') return null
  return 'Vencido automáticamente por fecha'
}

const todayYmd = useMemo(() => toYmdLocal(new Date()), [])
const isHoyFilterActive = filtros.desde === todayYmd && filtros.hasta === todayYmd
const cfgHasRangoFechas = Boolean(String(cfgDesde || '').trim() || String(cfgHasta || '').trim())
const cfgRangoInvalido = Boolean(cfgDesde && cfgHasta && cfgDesde > cfgHasta)
const estadoTurnosHabilitados = isTurnosHabilitados({ estadoActual: cfgEstadoActual })
const estadoDesconocido = cfgEstadoActual === null || cfgEstadoActual === undefined
const mostrarAvisoEstadoDesconocido = estadoDesconocido && !cfgLoading
const cfgEstadoBorder = estadoTurnosHabilitados ? '#bbf7d0' : '#fecaca'
const cfgEstadoBg = estadoTurnosHabilitados ? '#f0fdf4' : '#fef2f2'
const cfgEstadoAccent = estadoTurnosHabilitados ? '#14532d' : '#991b1b'
const cfgEstadoText = estadoTurnosHabilitados ? '#166534' : '#b91c1c'
const cfgEstadoChipBorder = estadoTurnosHabilitados ? '#86efac' : '#fca5a5'
const cfgEstadoLabel = estadoTurnosHabilitados ? 'Habilitados' : 'Deshabilitados'
const draftHasRangoFechas = Boolean(String(draftDesde || '').trim() || String(draftHasta || '').trim())
const draftRangoInvalido = Boolean(draftDesde && draftHasta && String(draftDesde) > String(draftHasta))
const draftRangoCompletoValido = Boolean(draftDesde && draftHasta && !draftRangoInvalido)
const draftEsDistinto = String(draftDesde || '') !== String(cfgDesde || '') || String(draftHasta || '') !== String(cfgHasta || '')
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

const agendaItems = turnosFiltrados

const loadInsumosDisp = useCallback(async (productorId) => {
  const pid = String(productorId || '').trim()
  if (!pid) return null
  if (insumosDispByProd[pid]) return insumosDispByProd[pid]
  try {
    const data = await insumosService.disponibilidadPorProductor(pid)
    setInsumosDispByProd((cur) => ({ ...cur, [pid]: data }))
    return data
  } catch {
    return null
  }
}, [insumosDispByProd])

const toggleExpand = (id) => {
  setExpandedId((cur) => {
    const next = cur === id ? null : id
    if (next) {
      const t = turnos.find(x => x.id === id)
      if (t && String(t.tipoTurno || '').toLowerCase() === 'insumo') {
        loadInsumosDisp(t.productorId)
      }
    }
    return next
  })
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

const openCapacidadModal = () => {
  setCapFecha(todayYmd)
  setCapModalOpen(true)
}

const closeCapacidadModal = () => {
  if (capSaving) return
  setCapModalOpen(false)
}

const openConfigModal = () => {
  setCfgModalOpen(true)
}

const closeConfigModal = () => {
  if (cfgSaving) return
  setCfgRangeIntentOpen(false)
  setCfgPendingDesde('')
  setCfgPendingHasta('')
  setDraftDesde(String(cfgDesde || ''))
  setDraftHasta(String(cfgHasta || ''))
  setCfgModalOpen(false)
}

const applyDraftRange = () => {
  if (cfgSaving || cfgLoading) return
  if (cfgRangeIntentOpen) return
  const d = String(draftDesde || '').trim()
  const h = String(draftHasta || '').trim()

  if (!d && !h) {
    if (!String(cfgDesde || '') && !String(cfgHasta || '')) return
    setCfgDesde('')
    setCfgHasta('')
    setCfgRangoModo('enable')
    setCfgModo('manual')
    return
  }

  if (!d || !h) {
    notify({ title: 'Para aplicar el rango, completá "Desde" y "Hasta".', icon: 'error' })
    return
  }

  if (d > h) {
    notify({ title: 'Rango inválido: "Desde" no puede ser mayor que "Hasta".', icon: 'error' })
    return
  }

  if (d === String(cfgDesde || '') && h === String(cfgHasta || '')) return
  setCfgPendingDesde(d)
  setCfgPendingHasta(h)
  setCfgRangeIntentOpen(true)
}

const applyRangeIntent = (mode) => {
  const d = String(cfgPendingDesde || '')
  const h = String(cfgPendingHasta || '')
  if (d && h && d > h) {
    notify({ title: 'Rango inválido: "Desde" no puede ser mayor que "Hasta".', icon: 'error' })
    return
  }
  setCfgDesde(d)
  setCfgHasta(h)
  setDraftDesde(d)
  setDraftHasta(h)
  setCfgModo('rango')
  setCfgRangoModo(mode === 'disable' ? 'disable' : 'enable')
  setCfgPendingDesde('')
  setCfgPendingHasta('')
  setCfgRangeIntentOpen(false)
}

const cancelRangeIntent = () => {
  setDraftDesde(String(cfgDesde || ''))
  setDraftHasta(String(cfgHasta || ''))
  setCfgPendingDesde('')
  setCfgPendingHasta('')
  setCfgRangeIntentOpen(false)
}

const setModoManual = () => {
  if (cfgSaving || cfgLoading) return
  setCfgModo('manual')
  setCfgRangeIntentOpen(false)
  setCfgPendingDesde('')
  setCfgPendingHasta('')
  setCfgDesde('')
  setCfgHasta('')
  setDraftDesde('')
  setDraftHasta('')
  setCfgRangoModo('enable')
}

const setModoRango = () => {
  if (cfgSaving || cfgLoading) return
  setCfgModo('rango')
  setCfgHabilitado(true)
}

const saveConfigTurnos = async () => {
  const mensaje = String(cfgMensaje || '').trim()
  const draftD = String(draftDesde || '').trim()
  const draftH = String(draftHasta || '').trim()
  if ((draftD && !draftH) || (!draftD && draftH)) {
    notify({ title: 'Para configurar un rango, completá "Desde" y "Hasta", o borrá ambas fechas.', icon: 'error' })
    return
  }
  if (draftD && draftH && draftD > draftH) {
    notify({ title: 'Rango de fechas inválido: "Desde" no puede ser mayor que "Hasta".', icon: 'error' })
    return
  }
  if (draftEsDistinto) {
    notify({ title: 'Tenés cambios sin aplicar en el rango. Tocá "Aplicar rango" o revertí las fechas.', icon: 'error' })
    return
  }
  const desde = cfgModo === 'rango' ? String(cfgDesde || '').trim() : ''
  const hasta = cfgModo === 'rango' ? String(cfgHasta || '').trim() : ''
  if (cfgModo === 'rango' && !(desde && hasta)) {
    notify({ title: 'Para usar el modo por rango, configurá "Desde" y "Hasta".', icon: 'error' })
    return
  }
  if (cfgRangoInvalido) {
    notify({ title: 'Rango de fechas inválido: "Desde" no puede ser mayor que "Hasta".', icon: 'error' })
    return
  }
  setCfgSaving(true)
  try {
    const payload =
      cfgModo === 'manual'
        ? { modo: 'manual', habilitado: Boolean(cfgHabilitado), mensaje, desde: null, hasta: null, rangoModo: null }
        : { modo: 'rango', mensaje, desde, hasta, rangoModo: cfgRangoModo }
    const saved = await setTurnosConfig(payload)
    setCfgEstadoActual(typeof saved?.estadoActual === 'boolean' ? saved.estadoActual : null)
    notify({ title: 'Configuración guardada', icon: 'success' })
    setCfgModalOpen(false)
  } catch (e) {
    console.error(e)
    notify({ title: e?.response?.data?.message || e?.message || 'No se pudo guardar la configuración.', icon: 'error' })
  } finally {
    setCfgSaving(false)
  }
}

const saveCapacidad = async () => {
  const ymd = String(capFecha || '').trim()
  if (!isValidYmd(ymd)) {
    notify({ title: 'Fecha inválida (YYYY-MM-DD).', icon: 'error' })
    return
  }
  const n = Number(capacidad)
  if (!Number.isFinite(n) || n <= 0) {
    notify({ title: 'Capacidad inválida. Debe ser un número mayor a 0.', icon: 'error' })
    return
  }
  setCapSaving(true)
  try {
    await setCapacidadTurnoDia(ymd, n)
    notify({ title: 'Capacidad guardada', icon: 'success' })
    setCapInfo({ fecha: ymd, capacidad: n, configurada: true })
    setCapModalOpen(false)
  } catch (e) {
    console.error(e)
    notify({ title: e?.response?.data?.message || e?.message || 'No se pudo guardar la capacidad.', icon: 'error' })
  } finally {
    setCapSaving(false)
  }
}

const canQuickConfirm = (t) => {
  const est = getDisplayEstado(t)
  return est === 'pendiente'
}

const canQuickComplete = (t) => {
  const est = normalizeEstado(t?.estado)
  return est === 'confirmado' || est === 'vencido'
}

const canQuickCancel = (t) => {
  const est = getDisplayEstado(t)
  return est === 'pendiente' || est === 'confirmado'
}

const canTransitionEstado = (fromEstado, toEstado) => {
  const from = normalizeEstado(fromEstado)
  const to = normalizeEstado(toEstado)
  if (from === to) return true
  if (to === 'vencido') return false
  if (from === 'vencido') return to === 'completado'
  if (from === 'cancelado' || from === 'completado') return false
  if (from === 'pendiente') return to === 'confirmado' || to === 'cancelado'
  if (from === 'confirmado') return to === 'cancelado' || to === 'completado'
  return false
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
          style={{ padding: '6px 12px', fontSize: 15 }}
        >Activos</button>
        <button 
          className={`btn turnos-toggle-btn ${viewMode === 'historial' ? 'turnos-toggle-btn--active' : ''}`} 
          onClick={() => setViewMode('historial')}
          style={{ padding: '6px 12px', fontSize: 15 }}
        >Historial</button>
        <button 
          className={`btn turnos-toggle-btn ${viewMode === 'todos' ? 'turnos-toggle-btn--active' : ''}`} 
          onClick={() => setViewMode('todos')}
          style={{ padding: '6px 12px', fontSize: 15 }}
        >Todos</button>
      </div>
    </div>

    {error ? (
      <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#991b1b', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{error}</span>
        <button className="btn secondary" onClick={loadData} style={{ padding: '6px 12px' }}>Reintentar</button>
      </div>
    ) : null}

    {capModalOpen ? (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 9999,
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeCapacidadModal()
        }}
      >
        <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>Capacidad de turnos por día</div>
            <button className="btn secondary" onClick={closeCapacidadModal} disabled={capSaving} style={{ padding: '6px 10px' }}>Cerrar</button>
          </div>
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>Fecha</label>
              <input
                type="date"
                className="input-inst"
                value={capFecha}
                onChange={(e) => setCapFecha(e.target.value)}
                disabled={capSaving}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, minHeight: 40, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}
              />
              {formatFechaLarga(capFecha) ? (
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  {formatFechaLarga(capFecha)}
                </div>
              ) : null}
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>Capacidad</label>
              <input
                type="number"
                min={1}
                step={1}
                className="input-inst"
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
                disabled={capSaving}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, minHeight: 40, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}
              />
              <div style={{ fontSize: 14, color: '#6b7280' }}>
                {capLoading
                  ? 'Cargando capacidad…'
                  : (() => {
                      const n = Number(capacidad)
                      const capTxt = Number.isFinite(n) && n > 0 ? n : null
                      if (capTxt == null) {
                        return capInfo?.configurada
                          ? 'Capacidad configurada para este día.'
                          : 'Sin configuración: se usa el valor por defecto del sistema.'
                      }
                      return capInfo?.configurada
                        ? `Capacidad: ${capTxt} turnos. Configurada para este día.`
                        : `Capacidad: ${capTxt} turnos. Sin configuración: se usa el valor por defecto del sistema.`
                    })()}
              </div>
            </div>
          </div>
          <div style={{ padding: 16, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn secondary" onClick={closeCapacidadModal} disabled={capSaving}>Cancelar</button>
            <button className="btn primary" onClick={saveCapacidad} disabled={capSaving || capLoading}>
              {capSaving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {cfgModalOpen ? (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 16,
          overflowY: 'auto',
          zIndex: 9999,
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeConfigModal()
        }}
      >
        <div style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', fontSize: 16 }}>
          {cfgRangeIntentOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: 16,
                overflowY: 'auto',
                zIndex: 10000,
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) cancelRangeIntent()
              }}
            >
              <div style={{ width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 10px 26px rgba(0,0,0,0.18)', fontSize: 16 }}>
                <div style={{ padding: 16, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Configuración de turnos</div>
                  <button className="btn secondary" onClick={cancelRangeIntent} style={{ padding: '6px 10px' }}>Cancelar</button>
                </div>
                <div style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 16, color: '#374151', lineHeight: 1.4 }}>
                    Seleccionaste un rango de fechas para los turnos. ¿Qué querés hacer?
                  </div>
                  <div style={{ fontSize: 15, borderRadius: 10, border: '1px solid #e5e7eb', background: '#ffffff', color: '#374151', padding: '10px 12px' }}>
                    <strong>Rango:</strong> {formatYmdCortoOrDash(cfgPendingDesde)} → {formatYmdCortoOrDash(cfgPendingHasta)}
                  </div>
                  {(cfgPendingDesde && cfgPendingHasta && cfgPendingDesde > cfgPendingHasta) ? (
                    <div style={{ fontSize: 15, borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', padding: '10px 12px' }}>
                      El rango es inválido: “Desde” no puede ser mayor que “Hasta”.
                    </div>
                  ) : null}
                </div>
                <div style={{ padding: 16, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
                  <button
                    className="btn secondary"
                    onClick={() => applyRangeIntent('disable')}
                    disabled={Boolean(cfgPendingDesde && cfgPendingHasta && cfgPendingDesde > cfgPendingHasta)}
                  >
                    Deshabilitar turnos en este rango
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => applyRangeIntent('enable')}
                    disabled={Boolean(cfgPendingDesde && cfgPendingHasta && cfgPendingDesde > cfgPendingHasta)}
                  >
                    Habilitar turnos solo en este rango
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div style={{ padding: 16, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Habilitación de turnos</div>
            <button className="btn secondary" onClick={closeConfigModal} disabled={cfgSaving} style={{ padding: '6px 10px' }}>Cerrar</button>
          </div>
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div
              style={{
                borderRadius: 12,
                border: `1px solid ${cfgEstadoBorder}`,
                background: cfgEstadoBg,
                padding: 12,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Configuración</div>
                  <div style={{ fontSize: 14, color: '#6b7280' }}>Gestioná cómo se habilitan los turnos</div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    background: '#e5e7eb',
                    borderRadius: 999,
                    padding: 4,
                    border: '1px solid #d1d5db',
                    boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.06)',
                    gap: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={setModoManual}
                    disabled={cfgSaving || cfgLoading || cfgRangeIntentOpen}
                    style={{
                      border: 'none',
                      background: cfgModo === 'manual' ? '#dcfce7' : 'transparent',
                      color: cfgModo === 'manual' ? '#14532d' : '#374151',
                      fontWeight: cfgModo === 'manual' ? 800 : 700,
                      padding: '10px 12px',
                      borderRadius: 999,
                      cursor: (cfgSaving || cfgLoading || cfgRangeIntentOpen) ? 'not-allowed' : 'pointer',
                      transition: 'background-color 150ms ease, color 150ms ease, transform 150ms ease',
                      boxShadow: cfgModo === 'manual' ? '0 6px 14px rgba(15,23,42,0.10)' : 'none',
                    }}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    onClick={setModoRango}
                    disabled={cfgSaving || cfgLoading || cfgRangeIntentOpen}
                    style={{
                      border: 'none',
                      background: cfgModo === 'rango' ? '#dcfce7' : 'transparent',
                      color: cfgModo === 'rango' ? '#14532d' : '#374151',
                      fontWeight: cfgModo === 'rango' ? 800 : 700,
                      padding: '10px 12px',
                      borderRadius: 999,
                      cursor: (cfgSaving || cfgLoading || cfgRangeIntentOpen) ? 'not-allowed' : 'pointer',
                      transition: 'background-color 150ms ease, color 150ms ease, transform 150ms ease',
                      boxShadow: cfgModo === 'rango' ? '0 6px 14px rgba(15,23,42,0.10)' : 'none',
                    }}
                  >
                    Por rango de fechas
                  </button>
                </div>

                <div
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${cfgEstadoBorder}`,
                    background: '#ffffff',
                    padding: 12,
                    display: 'grid',
                    gap: 8,
                    boxShadow: '0 8px 18px rgba(15,23,42,0.06)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: cfgEstadoAccent, letterSpacing: '.02em', textTransform: 'uppercase' }}>
                        Estado actual
                      </div>
                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 14,
                          fontWeight: 900,
                          border: `1px solid ${cfgEstadoChipBorder}`,
                          background: '#ffffff',
                          color: cfgEstadoAccent,
                          boxShadow: '0 6px 14px rgba(15,23,42,0.06)',
                        }}
                      >
                        {cfgEstadoLabel}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: '#6b7280', fontWeight: 700 }}>
                      {cfgModo === 'manual' ? 'Modo: Manual' : 'Modo: Por rango'}
                    </div>
                  </div>

                  <div style={{ fontSize: 15, color: cfgEstadoText, lineHeight: 1.35, display: 'grid', gap: 4 }}>
                    <div>
                      {estadoTurnosHabilitados
                        ? 'Los usuarios pueden solicitar turnos desde la app.'
                        : 'Los usuarios NO pueden solicitar turnos. Verán un mensaje al intentar hacerlo.'}
                    </div>
                    {mostrarAvisoEstadoDesconocido ? (
                      <div style={{ fontSize: 14, color: '#64748b' }}>
                        No se pudo verificar el estado actual. Verificá tu conexión.
                      </div>
                    ) : null}
                  </div>
                </div>

                {cfgModo === 'manual' ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>Manual</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: (cfgSaving || cfgLoading) ? 'not-allowed' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={cfgHabilitado}
                        onChange={(e) => setCfgHabilitado(e.target.checked)}
                        disabled={cfgSaving || cfgLoading}
                      />
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                        {cfgHabilitado ? 'Turnos habilitados' : 'Turnos deshabilitados'}
                      </div>
                    </label>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>Por rango de fechas</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'grid', gap: 6, flex: '1 1 180px', minWidth: 180 }}>
                        <label style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#374151' }}>Desde</label>
                        <input
                          type="date"
                          className="input-inst"
                          value={draftDesde}
                          onChange={(e) => {
                            const next = e.target.value
                            setDraftDesde(next)
                          }}
                          disabled={cfgSaving || cfgLoading || cfgRangeIntentOpen}
                          style={{ width: '100%', boxSizing: 'border-box', fontSize: 17, minHeight: 40, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gap: 6, flex: '1 1 180px', minWidth: 180 }}>
                        <label style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#374151' }}>Hasta</label>
                        <input
                          type="date"
                          className="input-inst"
                          value={draftHasta}
                          onChange={(e) => {
                            const next = e.target.value
                            setDraftHasta(next)
                          }}
                          disabled={cfgSaving || cfgLoading || cfgRangeIntentOpen}
                          style={{ width: '100%', boxSizing: 'border-box', fontSize: 17, minHeight: 40, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: '#6b7280' }}>
                      Definí el rango y luego tocá “Aplicar rango” para elegir qué querés hacer.
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={applyDraftRange}
                        disabled={cfgSaving || cfgLoading || cfgRangeIntentOpen || (!draftHasRangoFechas && !cfgHasRangoFechas)}
                        style={{ padding: '8px 12px' }}
                      >
                        Aplicar rango
                      </button>
                    </div>
                    {draftRangoInvalido ? (
                      <div style={{ fontSize: 14, borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', padding: '8px 10px' }}>
                        El rango es inválido: “Desde” no puede ser mayor que “Hasta”.
                      </div>
                    ) : draftHasRangoFechas ? (
                      <div style={{ fontSize: 14, borderRadius: 10, border: '1px solid #e5e7eb', background: '#ffffff', color: '#374151', padding: '8px 10px' }}>
                        <strong>Rango:</strong> {formatYmdCortoOrDash(draftDesde)} → {formatYmdCortoOrDash(draftHasta)} ·{' '}
                        <strong>Acción:</strong> {draftEsDistinto && draftRangoCompletoValido ? 'A confirmar' : (cfgRangoModo === 'disable' ? 'Deshabilitar en este rango' : 'Habilitar solo en este rango')}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Mensaje del administrador (opcional)</label>
              <input
                type="text"
                className="input-inst"
                value={cfgMensaje}
                onChange={(e) => setCfgMensaje(e.target.value)}
                disabled={cfgSaving || cfgLoading}
                placeholder="Ej: Los turnos se habilitan nuevamente el lunes."
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 17, minHeight: 40, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}
              />
              <div style={{ fontSize: 15, color: '#6b7280' }}>
                {cfgLoading ? 'Cargando configuración…' : 'Este mensaje se muestra en la app. Si los turnos están deshabilitados, se muestra junto al mensaje por defecto. Si están habilitados, se muestra como aviso informativo.'}
              </div>
              {estadoTurnosHabilitados ? (
                <div style={{ fontSize: 15, borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', padding: '8px 10px' }}>
                  <strong>Estado (backend):</strong> Turnos habilitados{cfgHasRangoFechas ? ` (${formatYmdCortoOrDash(cfgDesde)} → ${formatYmdCortoOrDash(cfgHasta)} · ${cfgRangoModo === 'disable' ? 'Deshabilitar en este rango' : 'Habilitar solo en este rango'})` : ''}{String(cfgMensaje || '').trim() ? ` · ${String(cfgMensaje).trim()}` : ''}
                </div>
              ) : (
                <div style={{ fontSize: 15, borderRadius: 10, border: '1px solid #fed7aa', background: '#fff7ed', color: '#9a3412', padding: '8px 10px' }}>
                  <strong>Estado (backend):</strong> Turnos deshabilitados hasta nuevo aviso{cfgHasRangoFechas ? ` (${formatYmdCortoOrDash(cfgDesde)} → ${formatYmdCortoOrDash(cfgHasta)} · ${cfgRangoModo === 'disable' ? 'Deshabilitar en este rango' : 'Habilitar solo en este rango'})` : ''}{String(cfgMensaje || '').trim() ? ` · ${String(cfgMensaje).trim()}` : ''}
                  {mostrarAvisoEstadoDesconocido ? (
                    <div style={{ marginTop: 6, fontSize: 14, color: '#64748b' }}>
                      No se pudo verificar el estado actual. Verificá tu conexión.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <div style={{ padding: 16, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn secondary" onClick={closeConfigModal} disabled={cfgSaving}>Cancelar</button>
            <button className="btn primary" onClick={saveConfigTurnos} disabled={cfgSaving || cfgLoading}>
              {cfgSaving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    ) : null}

    <div className="turnos-toolbar">
      <div className="turnos-toolbar__left">
        <div className="turnos-search">
          <input
            type="text"
            className="input-inst"
            placeholder="Buscar por productor o IPT"
            value={filtros.productor}
            onChange={e => setFiltros({ ...filtros, productor: e.target.value })}
            style={{ fontSize: 15, minHeight: 38, padding: '7px 10px' }}
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
        <button
          className="btn secondary"
          onClick={openConfigModal}
          disabled={loading}
          style={{ padding: '6px 12px' }}
        >
          Habilitación
        </button>
        <button
          className="btn secondary"
          onClick={openCapacidadModal}
          disabled={loading}
          style={{ padding: '6px 12px' }}
        >
          Capacidad por día
        </button>
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
      gap: 14, 
      backgroundColor: '#ffffff', 
      padding: 18, 
      borderRadius: 12, 
      marginBottom: 24,
      alignItems: 'flex-end',
      border: '1px solid #e5e7eb',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      width: '100%'
    }}>
      <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px', minWidth: 220 }}>
        <label style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#374151' }}>Ordenar</label>
        <select 
          className="select-inst" 
          value={filtros.orden}
          onChange={e => setFiltros({ ...filtros, orden: e.target.value })}
          style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, minHeight: 40, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', minWidth: 'auto' }}
        >
          <option value="proximos">Más próximos</option>
          <option value="lejanos">Más lejanos</option>
        </select>
      </div>

      <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px', minWidth: 220 }}>
        <label style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#374151' }}>Estado</label>
        <select 
          className="select-inst" 
          value={filtros.estado}
          onChange={e => setFiltros({ ...filtros, estado: e.target.value })}
          style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, minHeight: 40, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', minWidth: 'auto' }}
        >
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="confirmado">Confirmado</option>
          <option value="cancelado">Cancelado</option>
          <option value="completado">Completado</option>
          <option value="vencido">Vencido</option>
        </select>
      </div>
      
      <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px', minWidth: 220 }}>
        <label style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#374151' }}>Desde</label>
        <input 
          type="date" 
          className="input-inst" 
          value={filtros.desde}
          onChange={e => setFiltros({ ...filtros, desde: e.target.value })}
          style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, minHeight: 40, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}
        />
      </div>

      <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px', minWidth: 220 }}>
        <label style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#374151' }}>Hasta</label>
        <input 
          type="date" 
          className="input-inst" 
          value={filtros.hasta}
          onChange={e => setFiltros({ ...filtros, hasta: e.target.value })}
          style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, minHeight: 40, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}
        />
      </div>

      <div className="filter-item" style={{ flex: '0 0 auto' }}>
        <button 
          className="btn secondary" 
          onClick={() => setFiltros({ orden: 'proximos', estado: 'todos', productor: '', desde: '', hasta: '' })}
          style={{ padding: '8px 18px', fontSize: 16, height: 40, borderRadius: 8 }}
        >Limpiar</button>
      </div>
    </div>

    {isHoyFilterActive ? (
      <div className="users-title" style={{ margin: '0 0 12px 0', fontSize: 19, fontWeight: 800, textAlign: 'left' }}>
        Turnos del día de hoy
      </div>
    ) : null}

    {loading ? (
      <div style={{ padding: 16, color:'#166534', textAlign: 'center' }}>Cargando turnos…</div>
    ) : (
      <>
        {turnosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b', backgroundColor: '#f8fafc', borderRadius: 12 }}>
            {isHoyFilterActive ? 'No se encontraron turnos para el día de hoy' : 'No se encontraron turnos con los filtros aplicados.'}
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
                      const allowExpand = viewMode !== 'historial'
                      return (
                        <React.Fragment key={t.id}>
                          <tr
                            className="turnos-agenda__row"
                            onClick={allowExpand ? () => toggleExpand(t.id) : undefined}
                            style={{ opacity: t.activo === false ? 0.7 : 1 }}
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
                                  {displayEstado === 'pendiente' || displayEstado === 'confirmado' || displayEstado === 'vencido' ? (
                                    <>
                                      {displayEstado === 'pendiente' ? (
                                        <button className="btn secondary" disabled={isUpdating || !canQuickConfirm(t)} onClick={() => handleCambioEstado(t.id, 'confirmado')}>Confirmar</button>
                                      ) : null}
                                      {displayEstado === 'pendiente' || displayEstado === 'confirmado' ? (
                                        <button className="btn secondary" disabled={isUpdating || !canQuickCancel(t)} onClick={() => handleCambioEstado(t.id, 'cancelado')}>Cancelar</button>
                                      ) : null}
                                      {displayEstado === 'confirmado' || displayEstado === 'vencido' ? (
                                        <button className="btn secondary" disabled={isUpdating || !canQuickComplete(t)} onClick={() => handleCambioEstado(t.id, 'completado')}>Completar</button>
                                      ) : null}
                                    </>
                                  ) : null}
                                  {displayEstado === 'cancelado' || displayEstado === 'completado' || displayEstado === 'vencido' ? (
                                    <button className="btn" disabled={isUpdating} onClick={() => handleArchivar(t.id)} style={{ backgroundColor: 'transparent', color: '#374151', border: '1px solid #9ca3af' }}>
                                      {isUpdating ? 'Actualizando…' : 'Archivar'}
                                    </button>
                                  ) : null}
                                </div>
                              ) : (
                                <button className="btn primary" disabled={isUpdating} onClick={() => handleRestaurar(t.id)}>
                                  {isUpdating ? 'Actualizando…' : 'Restaurar'}
                                </button>
                              )}
                            </td>
                          </tr>
                          {allowExpand && isExpanded && (
                            <tr className="turnos-agenda__detail">
                              <td colSpan={6}>
                                <div className="turnos-detail">
                                  <div><strong>Fecha:</strong> {formatDate(t.fechaTurno || t.fecha)} {formatTime(t.fechaTurno || t.fecha)}</div>
                                  <div><strong>Motivo:</strong> {formatMotivo(t.motivo)}</div>
                                  {getCancelNotice(t) ? (
                                    <div
                                      style={{
                                        marginTop: 8,
                                        display: 'inline-block',
                                        backgroundColor: '#fffbeb',
                                        border: '1px solid #fde68a',
                                        color: '#92400e',
                                        padding: '6px 10px',
                                        borderRadius: 10,
                                      fontSize: 14,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {getCancelNotice(t)}
                                    </div>
                                  ) : null}
                                  {getExpiredNotice(t) ? (
                                    <div
                                      style={{
                                        marginTop: 8,
                                        display: 'inline-block',
                                        backgroundColor: '#f1f5f9',
                                        border: '1px solid #e2e8f0',
                                        color: '#334155',
                                        padding: '6px 10px',
                                        borderRadius: 10,
                                      fontSize: 14,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {getExpiredNotice(t)}
                                    </div>
                                  ) : null}
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
                const isExpanded = false
                const isUpdating = updatingId === t.id
                const productorNombre = t.productorNombre || prodMap.get(String(t.productorId))?.nombre || 'No especificado'
                const ipt = t.ipt || prodMap.get(String(t.productorId))?.ipt || '-'
                const isInsumo = String(t.tipoTurno || '').toLowerCase() === 'insumo'
                const insDisp = isInsumo ? insumosDispByProd[String(t.productorId || '').trim()] : null
                const allowExpand = false
                return (
                  <div
                    key={t.id}
                    className={`turno-card ${isExpanded ? 'turno-card--expanded' : ''}`}
                    style={{ opacity: t.activo === false ? 0.7 : 1 }}
                  >
                    <div className="turno-header">
                      <div className="turno-date">{formatDate(t.fechaTurno || t.fecha)} · {formatTime(t.fechaTurno || t.fecha)}</div>
                      <div className={estadoClass(displayEstado)}>{estadoLabel(displayEstado)}</div>
                    </div>
                    <div className="turno-item"><span className="turno-label">Productor:</span> {productorNombre}</div>
                    <div className="turno-item"><span className="turno-label">IPT:</span> {ipt}</div>
                    <div className="turno-item"><span className="turno-label">Tipo:</span> {tipoLabel(t.tipoTurno)}</div>
                    <div className="turno-item"><span className="turno-label">Motivo:</span> {formatMotivo(t.motivo)}</div>
                    {isInsumo && insDisp ? (
                      <div className="turno-item">
                        <span className="turno-label">Insumos:</span> Asignado {Number(insDisp.totalAsignado ?? 0)} · Entregado {Number(insDisp.totalEntregado ?? 0)} · Disponible {Number(insDisp.totalDisponible ?? 0)}
                      </div>
                    ) : null}
                    {getCancelNotice(t) ? (
                      <div
                        style={{
                          marginTop: 8,
                          backgroundColor: '#fffbeb',
                          border: '1px solid #fde68a',
                          color: '#92400e',
                          padding: '8px 10px',
                          borderRadius: 12,
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        {getCancelNotice(t)}
                      </div>
                    ) : null}
                    {getExpiredNotice(t) ? (
                      <div
                        style={{
                          marginTop: 8,
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          color: '#334155',
                          padding: '8px 10px',
                          borderRadius: 12,
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        {getExpiredNotice(t)}
                      </div>
                    ) : null}

                    {allowExpand && isExpanded && (
                      <div className="turnos-detail" onClick={(e) => e.stopPropagation()}>
                        <div><strong>Motivo completo:</strong> {formatMotivo(t.motivo)}</div>
                        {isInsumo ? (
                          <div style={{ marginTop: 8 }}>
                            <strong>Insumos:</strong>{' '}
                            {insDisp ? (
                              <>Asignado {Number(insDisp.totalAsignado ?? 0)} · Entregado {Number(insDisp.totalEntregado ?? 0)} · Disponible {Number(insDisp.totalDisponible ?? 0)}</>
                            ) : (
                              <>Cargando…</>
                            )}
                          </div>
                        ) : null}
                        {getCancelNotice(t) ? (
                          <div
                            style={{
                              marginTop: 8,
                              display: 'inline-block',
                              backgroundColor: '#fffbeb',
                              border: '1px solid #fde68a',
                              color: '#92400e',
                              padding: '6px 10px',
                              borderRadius: 10,
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          >
                            {getCancelNotice(t)}
                          </div>
                        ) : null}
                        {getExpiredNotice(t) ? (
                          <div
                            style={{
                              marginTop: 8,
                              display: 'inline-block',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              color: '#334155',
                              padding: '6px 10px',
                              borderRadius: 10,
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          >
                            {getExpiredNotice(t)}
                          </div>
                        ) : null}
                      </div>
                    )}
                    
                    <div className="turno-actions" onClick={(e) => e.stopPropagation()}>
                      {t.activo !== false ? (
                        <>
                          <div className="turnos-quick-actions">
                            {isUpdating ? <span className="turnos-updating">Actualizando…</span> : null}
                            {displayEstado === 'pendiente' ? (
                              <button className="btn secondary" disabled={isUpdating || !canQuickConfirm(t)} onClick={() => handleCambioEstado(t.id, 'confirmado')}>Confirmar</button>
                            ) : null}
                            {displayEstado === 'pendiente' || displayEstado === 'confirmado' ? (
                              <button className="btn secondary" disabled={isUpdating || !canQuickCancel(t)} onClick={() => handleCambioEstado(t.id, 'cancelado')}>Cancelar</button>
                            ) : null}
                            {displayEstado === 'confirmado' || displayEstado === 'vencido' ? (
                              <button className="btn secondary" disabled={isUpdating || !canQuickComplete(t)} onClick={() => handleCambioEstado(t.id, 'completado')}>Completar</button>
                            ) : null}
                          </div>

                          <div className="turnos-actions-row">
                            {displayEstado === 'cancelado' || displayEstado === 'completado' || displayEstado === 'vencido' ? (
                              <button 
                                className="btn" 
                                disabled={isUpdating}
                                style={{ backgroundColor: 'transparent', color: '#374151', border: '1px solid #9ca3af', padding: '6px 12px' }}
                                onClick={() => handleArchivar(t.id)}
                              >{isUpdating ? 'Actualizando…' : 'Archivar'}</button>
                            ) : null}
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
