import React, { useEffect, useState, useCallback } from 'react'
import { getTurnoHistorial } from '../../services/turnos.service'

const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  completado: 'Completado',
  vencido: 'Vencido',
}

const ESTADO_COLORS = {
  pendiente:  { bg: '#fef9c3', border: '#fde047', text: '#713f12' },
  confirmado: { bg: '#dcfce7', border: '#86efac', text: '#14532d' },
  cancelado:  { bg: '#fee2e2', border: '#fca5a5', text: '#7f1d1d' },
  completado: { bg: '#dbeafe', border: '#93c5fd', text: '#1e3a8a' },
  vencido:    { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155' },
}

const formatFechaHora = (iso) => {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '-'
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm} · ${hh}:${min}`
  } catch {
    return '-'
  }
}

const getAccionLabel = (item) => {
  const accion = String(item?.accion || '')
  const from = String(item?.estadoAnterior || '').toLowerCase()
  const to = String(item?.estadoNuevo || '').toLowerCase()

  if (accion === 'turno_creado') return 'Solicitó el turno'
  if (accion === 'turno_archivado') return 'Archivó el turno'
  if (accion === 'turno_restaurado') return 'Restauró el turno'

  if (accion === 'config_cambiada') {
    const desc = String(item?.estadoNuevo || '')
    if (desc.includes('habilitado')) return 'Cambió la configuración de turnos'
    return 'Cambió la configuración de turnos'
  }

  if (accion === 'estado_cambiado') {
    if (to === 'confirmado') return 'Confirmó el turno'
    if (to === 'cancelado') return 'Canceló el turno'
    if (to === 'completado') return 'Completó el turno'
    if (to === 'vencido') return item?.automatico ? 'Marcó el turno como vencido' : 'Cambió el estado a vencido'
    if (to === 'pendiente') return 'Revirtió el turno a pendiente'
    return `Cambió el estado${from ? ` de ${ESTADO_LABELS[from] || from}` : ''}${to ? ` a ${ESTADO_LABELS[to] || to}` : ''}`
  }

  return accion || 'Acción registrada'
}

const getAccionIcon = (item) => {
  const accion = String(item?.accion || '')
  const to = String(item?.estadoNuevo || '').toLowerCase()
  if (accion === 'turno_creado') return '📋'
  if (accion === 'turno_archivado') return '📁'
  if (accion === 'turno_restaurado') return '♻️'
  if (accion === 'config_cambiada') return '⚙️'
  if (to === 'confirmado') return '✅'
  if (to === 'cancelado') return '❌'
  if (to === 'completado') return '🏁'
  if (to === 'vencido') return '⏰'
  return '🔄'
}

const getAccionColor = (item) => {
  const accion = String(item?.accion || '')
  const to = String(item?.estadoNuevo || '').toLowerCase()
  if (accion === 'turno_creado') return { line: '#93c5fd', dot: '#3b82f6' }
  if (accion === 'turno_archivado') return { line: '#d1d5db', dot: '#6b7280' }
  if (accion === 'turno_restaurado') return { line: '#86efac', dot: '#22c55e' }
  if (accion === 'config_cambiada') return { line: '#c4b5fd', dot: '#7c3aed' }
  if (to === 'confirmado') return { line: '#86efac', dot: '#16a34a' }
  if (to === 'cancelado') return { line: '#fca5a5', dot: '#dc2626' }
  if (to === 'completado') return { line: '#93c5fd', dot: '#2563eb' }
  if (to === 'vencido') return { line: '#cbd5e1', dot: '#64748b' }
  return { line: '#e5e7eb', dot: '#9ca3af' }
}

const getNombreDisplay = (item) => {
  const nombre = String(item?.realizadoPor?.nombre || '')
  const uid = String(item?.realizadoPor?.uid || '')
  if (!nombre || nombre === uid || nombre === 'sistema') return 'Sistema'
  return nombre
}

const getRolLabel = (item) => {
  const rol = String(item?.realizadoPor?.rol || '').toLowerCase()
  if (rol === 'sistema' || rol === '' || !rol) return null
  if (rol.includes('admin')) return 'Administrador'
  if (rol.includes('prod')) return 'Productor'
  return rol.charAt(0).toUpperCase() + rol.slice(1)
}

const EstadoBadge = ({ estado }) => {
  if (!estado) return null
  const key = String(estado).toLowerCase()
  const label = ESTADO_LABELS[key] || estado
  const color = ESTADO_COLORS[key] || { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        backgroundColor: color.bg,
        border: `1px solid ${color.border}`,
        color: color.text,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

const HistorialItem = ({ item, isLast }) => {
  const accionLabel = getAccionLabel(item)
  const icon = getAccionIcon(item)
  const color = getAccionColor(item)
  const nombre = getNombreDisplay(item)
  const rolLabel = getRolLabel(item)
  const esAutomatico = Boolean(item?.automatico)
  const tieneTransicion = item?.estadoAnterior && item?.estadoNuevo && item?.accion === 'estado_cambiado'
  const tieneMotivo = item?.motivo && String(item.motivo).trim() && item?.accion !== 'config_cambiada'

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {/* Línea de tiempo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 32 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: color.dot,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          }}
        >
          {icon}
        </div>
        {!isLast && (
          <div
            style={{
              width: 2,
              flex: 1,
              minHeight: 24,
              backgroundColor: color.line,
              marginTop: 4,
            }}
          />
        )}
      </div>

      {/* Contenido */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#ffffff',
          border: '1px solid #f3f4f6',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: isLast ? 0 : 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {/* Fecha y hora */}
        <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, marginBottom: 4, letterSpacing: '.02em' }}>
          {formatFechaHora(item?.createdAt)}
          {esAutomatico && (
            <span style={{ marginLeft: 8, color: '#64748b', fontWeight: 500 }}>· Automático</span>
          )}
        </div>

        {/* Quién */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{nombre}</span>
          {rolLabel && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#6b7280',
                backgroundColor: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: 999,
                padding: '1px 7px',
              }}
            >
              {rolLabel}
            </span>
          )}
        </div>

        {/* Acción */}
        <div style={{ fontSize: 14, color: '#374151', fontWeight: 600, marginBottom: tieneTransicion || tieneMotivo ? 8 : 0 }}>
          {accionLabel}
        </div>

        {/* Transición de estado */}
        {tieneTransicion && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: tieneMotivo ? 6 : 0 }}>
            <EstadoBadge estado={item.estadoAnterior} />
            <span style={{ color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>→</span>
            <EstadoBadge estado={item.estadoNuevo} />
          </div>
        )}

        {/* Motivo */}
        {tieneMotivo && (
          <div
            style={{
              backgroundColor: '#fafafa',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 13,
              color: '#6b7280',
            }}
          >
            <span style={{ fontWeight: 600, color: '#374151' }}>Motivo: </span>
            {item.motivo}
          </div>
        )}

        {/* Config cambiada: mostrar descripción legible */}
        {item?.accion === 'config_cambiada' && item?.estadoNuevo && (
          <div style={{ marginTop: 4 }}>
            {item.estadoAnterior && (
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}>
                Antes: <span style={{ fontWeight: 600, color: '#6b7280' }}>{formatConfigDesc(item.estadoAnterior)}</span>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Ahora: <span style={{ fontWeight: 600, color: '#374151' }}>{formatConfigDesc(item.estadoNuevo)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const formatConfigDesc = (desc) => {
  if (!desc) return '-'
  const s = String(desc)
  if (s.includes('manual/habilitado')) return 'Manual — Habilitado'
  if (s.includes('manual/deshabilitado')) return 'Manual — Deshabilitado'
  if (s.includes('rango/rango:')) {
    const match = s.match(/rango\/rango:(.+)-(.+)/)
    if (match) return `Por rango: ${match[1]} al ${match[2]}`
    return 'Por rango de fechas'
  }
  return s
}

const TurnoHistorial = ({ turnoId, onClose }) => {
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!turnoId) return
    setLoading(true)
    setError('')
    try {
      const data = await getTurnoHistorial(turnoId)
      setHistorial(Array.isArray(data?.historial) ? data.historial : [])
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'No se pudo cargar el historial.')
    } finally {
      setLoading(false)
    }
  }, [turnoId])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
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
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #e5e7eb',
          boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            backgroundColor: '#fafafa',
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>Historial del turno</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Auditoría de cambios y acciones</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 14,
              color: '#374151',
              fontWeight: 600,
            }}
          >
            Cerrar
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: 16, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 14 }}>
              Cargando historial…
            </div>
          ) : error ? (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                border: '1px solid #fecaca',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                fontSize: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span>{error}</span>
              <button
                onClick={cargar}
                style={{
                  background: 'none',
                  border: '1px solid #fca5a5',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#991b1b',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                Reintentar
              </button>
            </div>
          ) : historial.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 40,
                color: '#9ca3af',
                fontSize: 14,
                backgroundColor: '#f9fafb',
                borderRadius: 10,
                border: '1px dashed #e5e7eb',
              }}
            >
              No hay registros de auditoría para este turno aún.
            </div>
          ) : (
            <div>
              {historial.map((item, idx) => (
                <HistorialItem
                  key={item.id || idx}
                  item={item}
                  isLast={idx === historial.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TurnoHistorial
