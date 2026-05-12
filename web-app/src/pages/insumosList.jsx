import React, { useEffect, useState, useMemo } from 'react'
import { insumosService } from '../services/insumos.service'
import { getProductores } from '../services/productores.service'
import HomeButton from '../components/HomeButton'
import { notify, confirmDialog } from '../utils/alerts'

const INSUMO_ORDER = ['arada', 'almacigo', 'transplante', 'cosecha']

const normalizeInsumoKey = (name) => {
  const raw = String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (raw === 'cosecha') return 'cosecha'
  if (raw === 'trasplante') return 'transplante'
  return raw
}

const displayInsumoName = (name) => {
  const key = normalizeInsumoKey(name)
  if (key === 'almacigo') return 'Almácigo'
  if (key === 'transplante') return 'Transplante'
  if (key === 'cosecha') return 'Cosecha'
  return 'Arada'
}

const INSUMO_OPTIONS = ['Arada', 'Almácigo', 'Transplante', 'Cosecha']


const InsumoIcon = ({ type }) => {
  const key = normalizeInsumoKey(type)

  if (key === 'almacigo') {
    return (
      <svg viewBox="0 0 48 48" role="img" focusable="false">
        <rect x="10" y="26" width="28" height="12" rx="3" fill="currentColor" opacity=".18" />
        <path d="M12 31h24M18 26v10M24 26v10M30 26v10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M18 24c0-6 3-10 6-12 3 2 6 6 6 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 21c-5-1-8-4-9-8 5 0 8 2 9 8Zm1 0c5-1 8-4 9-8-5 0-8 2-9 8Z" fill="currentColor" />
      </svg>
    )
  }

  if (key === 'transplante') {
    return (
      <svg viewBox="0 0 48 48" role="img" focusable="false">
        <path d="M15 26h18l-3 13H18l-3-13Z" fill="currentColor" opacity=".22" />
        <path d="M15 26h18M19 39h10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 26V12" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M23 19c-7 0-11-4-12-10 7 0 11 4 12 10Zm2 0c7 0 11-4 12-10-7 0-11 4-12 10Z" fill="currentColor" />
      </svg>
    )
  }

  if (key === 'cosecha') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21c-3.3 0-6-.9-6-2v-1h12v1c0 1.1-2.7 2-6 2Z" fill="currentColor"></path>
        <path d="M11 18h2v-5h-2v5Z" fill="currentColor"></path>
        <path d="M12 13c0 0-1-5-6-5s1 5 6 5ZM12 13c0 0 1-5 6-5s-1 5-6 5Z" fill="currentColor"></path>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 48 48" role="img" focusable="false">
      <path d="M10 34c8-2 16-2 28 0M12 39c8-2 15-2 24 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 32V15" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M23 22c-7 0-11-4-12-10 7 0 11 4 12 10Zm2 0c7 0 11-4 12-10-7 0-11 4-12 10Z" fill="currentColor" />
    </svg>
  )
}

const InsumosList = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ nombre:'Arada', cantidadDisponible:'', unidad:'', descripcion:'', estado:'disponible' })
  const [productores, setProductores] = useState([])
  const [asignar, setAsignar] = useState({ productorId:'', cantidadAsignada:'' })
  const [assignError, setAssignError] = useState('')
  const [iptSearch, setIptSearch] = useState('')
  const [selectedProd, setSelectedProd] = useState('')
  const [asignacionesProd, setAsignacionesProd] = useState([])
  const [loadingAsign, setLoadingAsign] = useState(false)
  const [insumoNames, setInsumoNames] = useState({})
  const [filterActivo, setFilterActivo] = useState('activos')
  const [producerSearchTerm, setProducerSearchTerm] = useState('')
  const [showProducerResults, setShowProducerResults] = useState(false)

  const resumenProd = useMemo(() => {
    const list = Array.isArray(asignacionesProd) ? asignacionesProd : []
    let asignado = 0
    let entregado = 0
    list.forEach(a => {
      const ca = Number(a?.cantidadAsignada ?? 0)
      const ce = Number(a?.cantidadEntregada ?? (String(a?.estado || '').toLowerCase() === 'entregado' ? ca : 0))
      if (Number.isFinite(ca) && ca > 0) asignado += ca
      if (Number.isFinite(ce) && ce > 0) entregado += ce
    })
    const disponible = Math.max(0, asignado - entregado)
    return { asignado, entregado, disponible, tieneDisponible: disponible > 0 }
  }, [asignacionesProd])

  const load = async ()=>{
    try {
      setLoading(true)
      const data = await insumosService.getInsumos()
      setItems(Array.isArray(data)? data: [])
      setInsumoNames(Array.isArray(data) ? Object.fromEntries(data.map(i=>[i.id, i.nombre])) : {})
      setError('')
    } catch (e) {
      console.error(e)
      setError('No se pudieron cargar los insumos')
      setItems([])
    } finally { setLoading(false) }
  }

  const itemsFiltrados = useMemo(() => {
    return items.filter(i => {
      if (filterActivo === 'todos') return true;
      const isActivo = i.activo !== false;
      return filterActivo === 'activos' ? isActivo : !isActivo;
    }).sort((a, b) => {
      const ai = INSUMO_ORDER.indexOf(normalizeInsumoKey(a?.nombre))
      const bi = INSUMO_ORDER.indexOf(normalizeInsumoKey(b?.nombre))
      const av = ai === -1 ? 99 : ai
      const bv = bi === -1 ? 99 : bi
      return av - bv || String(a?.nombre || '').localeCompare(String(b?.nombre || ''))
    });
  }, [items, filterActivo]);

  const filteredProducers = useMemo(() => {
    if (!producerSearchTerm) return [];
    const term = producerSearchTerm.toLowerCase();
    return productores.filter(p => 
      String(p.ipt || '').toLowerCase().includes(term) ||
      String(p.nombreCompleto || '').toLowerCase().includes(term)
    ).slice(0, 8); // Limitar a 8 resultados
  }, [productores, producerSearchTerm]);

  useEffect(()=>{ load() },[])

  useEffect(()=>{ (async()=>{ try{ const { data } = await getProductores(); setProductores(data||[]) }catch{ null } })() }, [])

  useEffect(()=>{ (async()=>{ if(!selectedProd) { setAsignacionesProd([]); return } ; setLoadingAsign(true); try{ const list = await insumosService.asignacionesPorProductor(selectedProd); setAsignacionesProd(Array.isArray(list)? list: []) }catch{ setAsignacionesProd([]) } finally{ setLoadingAsign(false) } })() }, [selectedProd])

  const refreshAsignacionesProductor = async () => {
    if (!selectedProd || loadingAsign) return;
    setLoadingAsign(true);
    try {
      const list = await insumosService.asignacionesPorProductor(selectedProd);
      setAsignacionesProd(Array.isArray(list) ? list : []);
      await load();
    } catch {
      setAsignacionesProd([]);
      await notify({ title: 'No se pudieron recargar los insumos', icon: 'error' });
    } finally {
      setLoadingAsign(false);
    }
  };

  const selectProducer = (p) => {
    setSelectedProd(p.id);
    setProducerSearchTerm(p.ipt ? `IPT: ${p.ipt} - ${p.nombreCompleto || p.nombre || ''}` : (p.nombreCompleto || p.nombre || p.id));
    setShowProducerResults(false);
  };

  const openAdd = ()=>{ setForm({ nombre:'Arada', cantidadDisponible:'', unidad:'', descripcion:'', estado:'disponible', activo: true }); setModal({ type:'add' }) }
  const openEdit = (insumo)=>{ setForm({ nombre:insumo.nombre||'Arada', cantidadDisponible:insumo.cantidadDisponible??'', unidad:insumo.unidad||'cosecha', descripcion:insumo.descripcion||'', estado:insumo.estado||'disponible', activo: insumo.activo !== false }); setModal({ type:'edit', insumo }) }
  const openAssign = async (insumo)=>{
    try{ const { data } = await getProductores(); setProductores(data||[]) }catch{ null }
    setAsignar({ productorId:'', cantidadAsignada:'' })
    setAssignError('')
    setModal({ type:'assign', insumo })
  }

  const onSubmitAdd = async ()=>{
    try{ await insumosService.createInsumo({ nombre:form.nombre, cantidadDisponible:Number(form.cantidadDisponible||0), unidad:form.unidad||'cosecha', descripcion:form.descripcion, estado: form.estado, activo: form.activo !== false }); setModal(null); load(); }
    catch(e){ setError(e?.response?.data?.error||'Error al agregar insumo') }
  }
  const onSubmitEdit = async ()=>{
    try{ await insumosService.updateInsumo(modal.insumo.id, { nombre:form.nombre, cantidadDisponible:Number(form.cantidadDisponible||0), unidad:form.unidad||'cosecha', descripcion:form.descripcion, estado: form.estado, activo: form.activo !== false }); setModal(null); load(); }
    catch(e){ setError(e?.response?.data?.error||'Error al modificar insumo') }
  }
  const onDelete = async (insumo)=>{
    const ok = await confirmDialog({ title: '¿Estás seguro de que deseas eliminar este insumo?', text: insumo.nombre || '', icon: 'warning', confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar' })
    if (!ok) return
    try{ await insumosService.deleteInsumo(insumo.id); load(); }
    catch(e){ setError(e?.response?.data?.error||'Error al eliminar insumo') }
  }
  const onSubmitAssign = async ()=>{
    const pid = asignar.productorId;
    const rawCantidad = String(asignar.cantidadAsignada ?? '').trim();
    const cant = Number(rawCantidad);
    if (!pid) {
      setAssignError('Seleccione un productor.');
      return;
    }
    if (!rawCantidad || !Number.isFinite(cant) || cant <= 0) {
      setAssignError('Ingrese una cantidad a asignar mayor a 0.');
      return;
    }
    try{ await insumosService.asignarAProductor(modal.insumo.id, { productorId: pid, cantidadAsignada: cant }); setAssignError(''); setModal(null); load(); }
    catch(e){ setAssignError(e?.response?.data?.error||'Error al asignar insumo') }
  }

  const onQuickAdjust = async (asig, delta)=>{
    const nueva = Math.max(0, Number(asig.cantidadAsignada||0) + delta)
    try{ await insumosService.updateAsignacion(asig.id, { cantidadAsignada: nueva }); await notify({ title: 'Asignación actualizada', icon: 'success' }); load(); if (selectedProd) { const list = await insumosService.asignacionesPorProductor(selectedProd); setAsignacionesProd(Array.isArray(list)? list: []) } }
    catch(e){ await notify({ title: e?.response?.data?.error || 'Error actualizando asignación', icon: 'error' }) }
  }

  const onSubmitEditAsign = async ()=>{
    try{ const nueva = Number(modal.asign.cantidadAsignadaEdit || 0) ; await insumosService.updateAsignacion(modal.asign.id, { cantidadAsignada: nueva }); setModal(null); load(); if (selectedProd) { const list = await insumosService.asignacionesPorProductor(selectedProd); setAsignacionesProd(Array.isArray(list)? list: []) } }
    catch(e){ setError(e?.response?.data?.error||'Error al modificar asignación') }
  }

  const onEliminarAsignaciones = async ()=>{
    const prod = productores.find(p => p.id === selectedProd)
    const ipt = prod?.ipt
    if (!ipt) { await notify({ title: 'El productor no tiene IPT registrado', icon: 'error' }); return }
    const nombre = prod?.nombreCompleto || prod?.nombre || 'este productor'
    const ok = await confirmDialog({ title: `¿Eliminar todas las asignaciones de ${nombre}?`, text: 'Esta acción no se puede deshacer. Los insumos disponibles serán restituidos al stock del IPT si corresponde.', icon: 'warning', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar' })
    if (!ok) return
    try{
      const res = await insumosService.eliminarAsignacionesPorIpt(ipt)
      await notify({ title: `Listo. Se eliminaron ${res?.eliminadas ?? 0} asignación/es.`, icon: 'success' })
      setAsignacionesProd([])
      load()
    } catch(e){ await notify({ title: e?.response?.data?.error || 'Error al eliminar asignaciones', icon: 'error' }) }
  }

  const estadoLabel = (i)=> {
    const est = String(i.estado||'').toLowerCase();
    if (est==='no_disponible') return 'No disponible';
    if (est==='disponible') return 'Disponible';
    return (Number(i.cantidadDisponible||0) > 0 ? 'Disponible' : 'No disponible')
  }
  const buttonStyle = { border:'1px solid #22c55e', color:'#14532d', background:'#ffffff', padding:'6px 10px', borderRadius:8 }
  const miniBtnStyle = { border:'1px solid #cbd5e1', color:'#475569', background:'#fff', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:13 }
  const actionBtnStyle = { border:'1px solid #e2e8f0', color:'#1e293b', background:'#f8fafc', padding:'6px 10px', borderRadius:6, cursor:'pointer', fontSize:13 }

  return (
    <div className="insumos-container">
      {/* Header de Insumos */}
      <div className="insumos-header-row">
        <div className="insumos-header-left">
          <HomeButton />
          <div className="insumos-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
              <line x1="7" y1="7" x2="7.01" y2="7"></line>
            </svg>
          </div>
          <div className="insumos-header-titles">
            <h1 className="main-title">Gestión de Insumos</h1>
            <p className="subtitle">Stock disponible, asignaciones y seguimiento por productor.</p>
          </div>
        </div>
        <button className="btn-insumo-action primary" onClick={openAdd}>
          <span style={{ fontSize: '20px', lineHeight: '1' }}>+</span> Agregar insumo
        </button>
      </div>

      {/* Filtros */}
      <div className="insumos-filters-card">
        <div className="insumo-filter-group">
          <label>Mostrar Insumos</label>
          <div className="insumo-input-wrapper">
            <select 
              value={filterActivo}
              onChange={e => setFilterActivo(e.target.value)}
            >
              <option value="activos">Solo Activos</option>
              <option value="inactivos">Solo Inactivos</option>
              <option value="todos">Todos los Insumos</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert-box error" style={{ marginBottom: 20 }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 60, color: '#1a4d2e', textAlign: 'center', fontSize: '18px', fontWeight: '700' }}>
          Cargando insumos...
        </div>
      ) : (
        <div className="users-table-card">
          <div className="table-responsive">
            <table className="users-table">
              <thead>
                <tr>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                      Nombre
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                      Cantidad disponible
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
                      Asignado a productores
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      Estado
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      Descripción
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                      Acciones
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                      {filterActivo === 'activos' ? 'No hay insumos activos' : 
                       filterActivo === 'inactivos' ? 'No hay insumos inactivos' : 
                       'No hay insumos disponibles'}
                    </td>
                  </tr>
                ) : itemsFiltrados.map(i=> (
                  <tr key={i.id}>
                    <td>
                      <div className="user-info-cell">
                        <div className="user-avatar">
                          <InsumoIcon type={i.nombre} />
                        </div>
                        <span className="user-name">{displayInsumoName(i.nombre)}</span>
                      </div>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <span className="insumo-quantity-badge">
                        {i.cantidadDisponible ?? 0} {i.unidad || 'cosecha'}
                      </span>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <InsumoAsignadoCell insumoId={i.id} unidad={i.unidad} isAsignado={true} />
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <div className={`status-badge ${String(estadoLabel(i)).toLowerCase().includes('no') ? 'inactive' : 'active'}`}>
                        <span className="dot"></span>
                        {estadoLabel(i)}
                      </div>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <span className="user-date">{i.descripcion || '-'}</span>
                    </td>
                    <td>
                      <div className="user-actions">
                        <div className="action-buttons-row">
                          <button className="btn-action-reset" style={{ flex: 1 }} onClick={()=>openEdit(i)}>Modificar</button>
                          <button className="btn-action-deactivate" style={{ flex: 1 }} onClick={()=>onDelete(i)}>Eliminar</button>
                        </div>
                        <button className="btn-action-activate" style={{ width: '100%' }} onClick={()=>openAssign(i)}>Asignar a productor</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span className="pagination-info">Total: {itemsFiltrados.length} insumos</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: 40, marginBottom: 20 }}>
        <h2 className="main-title" style={{ fontSize: '22px' }}>Insumos asignados por productor</h2>
        <p className="subtitle">Búsqueda rápida y gestión de stock por IPT.</p>
      </div>

      <div className="productores-filters-card" style={{ maxWidth: 600 }}>
        <div className="productor-filter-group">
          <label>Buscar Productor</label>
          <div className="productor-input-wrapper">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              placeholder="IPT o nombre..." 
              value={producerSearchTerm}
              onChange={e => {
                setProducerSearchTerm(e.target.value);
                setShowProducerResults(true);
                if (!e.target.value) setSelectedProd('');
              }}
              onFocus={() => setShowProducerResults(true)}
            />
            {showProducerResults && filteredProducers.length > 0 && (
              <div className="users-table-card" style={{ 
                position: 'absolute', 
                top: 'calc(100% + 8px)', 
                left: 0, 
                right: 0, 
                zIndex: 100,
                maxHeight: 300,
                overflowY: 'auto'
              }}>
                {filteredProducers.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => selectProducer(p)}
                    style={{ 
                      padding: '12px 16px', 
                      cursor: 'pointer', 
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                      {p.nombreCompleto || p.nombre || 'Sin nombre'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      IPT: {p.ipt || '-'} · CUIL: {p.cuil || '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {selectedProd && (
          <button className="btn-clear-filters" onClick={() => { setSelectedProd(''); setProducerSearchTerm(''); }}>
            Limpiar
          </button>
        )}
      </div>

      {selectedProd && (
        <div className="users-table-card" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            backgroundColor: '#f8fafc', 
            padding: '16px 20px', 
            borderBottom: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                {(productores.find(p => p.id === selectedProd)?.nombreCompleto || "?").charAt(0)}
              </div>
              <span className="user-name">
                {productores.find(p => p.id === selectedProd)?.nombreCompleto} (IPT: {productores.find(p => p.id === selectedProd)?.ipt})
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-icon-edit" onClick={refreshAsignacionesProductor} disabled={loadingAsign}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              </button>
              <button className="btn-action-deactivate" onClick={onEliminarAsignaciones} style={{ padding: '6px 12px' }}>
                Vaciar Stock
              </button>
            </div>
          </div>

          <div style={{ padding: '12px 20px', background: '#fff', display: 'flex', gap: 24, borderBottom: '1px solid #f1f5f9' }}>
            <div className="user-date">Asignado: <strong style={{ color: '#1e293b' }}>{resumenProd.asignado}</strong></div>
            <div className="user-date">Entregado: <strong style={{ color: '#1e293b' }}>{resumenProd.entregado}</strong></div>
            <div className="user-date">Disponible: <strong style={{ color: resumenProd.tieneDisponible ? '#166534' : '#991b1b' }}>{resumenProd.disponible}</strong></div>
          </div>
          
          <div className="table-responsive">
            {loadingAsign ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Cargando asignaciones...</div>
            ) : asignacionesProd.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Este productor no tiene insumos asignados.</div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Insumo</th>
                    <th>Asignado</th>
                    <th>Entregado</th>
                    <th>Disponible</th>
                    <th>Descripción</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {asignacionesProd.map(a=> {
                    const ins = items.find(i=> i.id === a.insumoId) || {}
                    const nombreInsumo = ins.nombre || insumoNames[a.insumoId] || ''
                    const unidadIns = ins.unidad || 'cosecha'
                    const asignado = Number(a?.cantidadAsignada ?? 0)
                    const entregado = Number(a?.cantidadEntregada ?? (String(a?.estado || '').toLowerCase() === 'entregado' ? asignado : 0))
                    const disponible = Math.max(0, asignado - entregado)
                    return (
                      <tr key={a.id}>
                        <td className="user-name">{nombreInsumo || '-'}</td>
                        <td style={{ textAlign: 'center' }}><span className="user-role">{asignado} {unidadIns}</span></td>
                        <td style={{ textAlign: 'center' }}><span className="user-role">{entregado} {unidadIns}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <div className={`status-badge ${disponible > 0 ? 'active' : 'inactive'}`}>
                            <span className="dot"></span>
                            {disponible} {unidadIns}
                          </div>
                        </td>
                        <td className="user-date">{a.descripcion || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button className="btn-icon-edit" onClick={()=>onQuickAdjust(a, +1)}>+1</button>
                            <button className="btn-icon-edit" onClick={()=>onQuickAdjust(a, -1)}>-1</button>
                            <button className="btn-action-reset" style={{ padding: '4px 8px' }} onClick={()=>setModal({ type:'assign-edit', asign: a })}>Cant.</button>
                            <button className="btn-action-reset" style={{ padding: '4px 8px' }} onClick={()=>setModal({ type:'assign-desc', asign: a })}>Nota</button>
                          </div>
                        </td>
                      </tr>
                  )})}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {modal && (
        <div className="insumos-modal-backdrop" onMouseDown={(e)=>{ if (e.target === e.currentTarget) setModal(null) }}>
          <div className="insumos-modal" style={{ maxWidth: 500 }}>
            <div style={{ padding: 24 }}>
              <h3 className="main-title" style={{ fontSize: '20px', marginBottom: 20 }}>
                {modal.type==='add' ? 'Agregar Insumo' : 
                 modal.type==='edit' ? 'Modificar Insumo' : 
                 modal.type==='assign' ? 'Asignar a Productor' :
                 modal.type==='assign-edit' ? 'Modificar Cantidad' : 'Agregar Nota'}
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(modal.type==='add' || modal.type==='edit') && (
                  <>
                    <div className="insumo-filter-group">
                      <label>Nombre del Insumo</label>
                      <div className="insumo-input-wrapper">
                        <select value={form.nombre} onChange={e=>setForm({ ...form, nombre:e.target.value })}>
                          {INSUMO_OPTIONS.map(n=> <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="insumo-filter-group">
                        <label>Cantidad Disponible</label>
                        <div className="insumo-input-wrapper">
                          <input type="number" value={form.cantidadDisponible} onChange={e=>setForm({ ...form, cantidadDisponible:e.target.value })} />
                        </div>
                      </div>
                      <div className="insumo-filter-group">
                        <label>Unidad</label>
                        <div className="insumo-input-wrapper">
                          <input value={form.unidad} onChange={e=>setForm({ ...form, unidad:e.target.value })} />
                        </div>
                      </div>
                    </div>
                    <div className="insumo-filter-group">
                      <label>Descripción</label>
                      <div className="insumo-input-wrapper">
                        <textarea style={{ minHeight: 80, padding: 12 }} value={form.descripcion} onChange={e=>setForm({ ...form, descripcion:e.target.value })} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="insumo-filter-group">
                        <label>Estado</label>
                        <div className="insumo-input-wrapper">
                          <select value={form.estado} onChange={e=>setForm({ ...form, estado: e.target.value })}>
                            <option value="disponible">Disponible</option>
                            <option value="no_disponible">No disponible</option>
                          </select>
                        </div>
                      </div>
                      <div className="insumo-filter-group">
                        <label>Visibilidad</label>
                        <div className="insumo-input-wrapper">
                          <select value={form.activo} onChange={e=>setForm({ ...form, activo: e.target.value === 'true' })}>
                            <option value="true">Activo</option>
                            <option value="false">Inactivo</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {modal.type==='assign' && (
                  <>
                    <div className="insumo-filter-group">
                      <label>Filtrar Productor por IPT</label>
                      <div className="insumo-input-wrapper">
                        <input placeholder="Ej: 123" value={iptSearch} onChange={e=>setIptSearch(e.target.value)} />
                      </div>
                    </div>
                    <div className="insumo-filter-group">
                      <label>Seleccionar Productor</label>
                      <div className="insumo-input-wrapper">
                        <select value={asignar.productorId} onChange={e=>{ setAsignar({ ...asignar, productorId:e.target.value }); setAssignError('') }}>
                          <option value="">Seleccione...</option>
                          {productores.filter(p=> iptSearch ? String(p.ipt||'').includes(String(iptSearch)) : true).map(p=> (
                            <option key={p.id} value={p.id}>{p.nombreCompleto || p.ipt || p.id}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="insumo-filter-group">
                      <label>Cantidad a Asignar ({modal?.insumo?.unidad || 'cosecha'})</label>
                      <div className="insumo-input-wrapper">
                        <input type="number" value={asignar.cantidadAsignada} onChange={e=>{ setAsignar({ ...asignar, cantidadAsignada:e.target.value }); setAssignError('') }} />
                      </div>
                    </div>
                    {assignError && <div className="alert-box error" style={{ padding: '8px 12px', fontSize: 13 }}>{assignError}</div>}
                  </>
                )}

                {modal.type==='assign-edit' && (
                  <div className="insumo-filter-group">
                    <label>Nueva Cantidad ({items.find(i=>i.id===modal.asign.insumoId)?.unidad || 'cosecha'})</label>
                    <div className="insumo-input-wrapper">
                      <input type="number" value={modal.asign.cantidadAsignadaEdit ?? ''} onChange={e=>setModal(m=>({ ...m, asign: { ...m.asign, cantidadAsignadaEdit: e.target.value } }))} />
                    </div>
                  </div>
                )}

                {modal.type==='assign-desc' && (
                  <div className="insumo-filter-group">
                    <label>Nota para el Productor</label>
                    <div className="insumo-input-wrapper">
                      <textarea style={{ minHeight: 100 }} value={modal.asign.descripcionEdit ?? ''} onChange={e=>setModal(m=>({ ...m, asign: { ...m.asign, descripcionEdit: e.target.value } }))} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button className="btn-modal-cancel" style={{ flex: 1 }} onClick={()=>setModal(null)}>Cancelar</button>
                <button className="btn-modal-confirm" style={{ flex: 1 }} onClick={
                  modal.type==='add' ? onSubmitAdd : 
                  modal.type==='edit' ? onSubmitEdit : 
                  modal.type==='assign' ? onSubmitAssign :
                  modal.type==='assign-edit' ? onSubmitEditAsign :
                  async()=>{ try{ await insumosService.updateAsignacion(modal.asign.id, { descripcion: modal.asign.descripcionEdit }); setModal(null); load(); if (selectedProd) { const list = await insumosService.asignacionesPorProductor(selectedProd); setAsignacionesProd(Array.isArray(list)? list: []) } } catch(e){ setError(e?.response?.data?.error||'Error al agregar descripción') } }
                }>
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const InsumoAsignadoCell = ({ insumoId, unidad, isAsignado }) => {
  const [total, setTotal] = useState('-')
  useEffect(()=>{ (async()=>{
    try{ const asigs = await insumosService.asignacionesPorInsumo(insumoId); const sum = Array.isArray(asigs)? asigs.reduce((acc,x)=> acc + Number(x.cantidadAsignada||0), 0) : 0; setTotal(sum) }catch{ setTotal('-') }
  })() },[insumoId])
  
  if (isAsignado) {
    return <span className="insumo-quantity-text">{total === '-' ? '-' : `${total} ${unidad || 'cosecha'}`}</span>
  }
  return <span>{total === '-' ? '-' : `${total} ${unidad || 'cosecha'}`}</span>
}


export default InsumosList
