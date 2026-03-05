import React, { useEffect, useState, useMemo } from 'react'
import { insumosService } from '../services/insumos.service'
import { getProductores } from '../services/productores.service'
import HomeButton from '../components/HomeButton'
import { notify, confirmDialog } from '../utils/alerts'


const InsumosList = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ nombre:'Arada', cantidadDisponible:'', unidad:'bolsas', descripcion:'', estado:'disponible' })
  const [productores, setProductores] = useState([])
  const [asignar, setAsignar] = useState({ productorId:'', cantidadAsignada:'' })
  const [iptSearch, setIptSearch] = useState('')
  const [selectedProd, setSelectedProd] = useState('')
  const [asignacionesProd, setAsignacionesProd] = useState([])
  const [loadingAsign, setLoadingAsign] = useState(false)
  const [insumoNames, setInsumoNames] = useState({})
  const [allInsumos, setAllInsumos] = useState([]) // Para el modal de cambio de tipo
  const [filterActivo, setFilterActivo] = useState('activos')
  const [producerSearchTerm, setProducerSearchTerm] = useState('')
  const [showProducerResults, setShowProducerResults] = useState(false)

  const load = async ()=>{
    try {
      setLoading(true)
      const data = await insumosService.getInsumos()
      setItems(Array.isArray(data)? data: [])
      setInsumoNames(Array.isArray(data) ? Object.fromEntries(data.map(i=>[i.id, i.nombre])) : {})
      setAllInsumos(Array.isArray(data)? data: []) // Guardar todos los insumos para el selector
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

  useEffect(()=>{ (async()=>{ try{ const { data } = await getProductores(); setProductores(data||[]) }catch{} })() }, [])

  useEffect(()=>{ (async()=>{ if(!selectedProd) { setAsignacionesProd([]); return } ; setLoadingAsign(true); try{ const list = await insumosService.asignacionesPorProductor(selectedProd); setAsignacionesProd(Array.isArray(list)? list: []) }catch{ setAsignacionesProd([]) } finally{ setLoadingAsign(false) } })() }, [selectedProd])

  const selectProducer = (p) => {
    setSelectedProd(p.id);
    setProducerSearchTerm(p.ipt ? `IPT: ${p.ipt} - ${p.nombreCompleto || p.nombre || ''}` : (p.nombreCompleto || p.nombre || p.id));
    setShowProducerResults(false);
  };

  const openAdd = ()=>{ setForm({ nombre:'Arada', cantidadDisponible:'', unidad:'bolsas', descripcion:'', estado:'disponible', activo: true }); setModal({ type:'add' }) }
  const openEdit = (insumo)=>{ setForm({ nombre:insumo.nombre||'Arada', cantidadDisponible:insumo.cantidadDisponible??'', unidad:'bolsas', descripcion:insumo.descripcion||'', estado:insumo.estado||'disponible', activo: insumo.activo !== false }); setModal({ type:'edit', insumo }) }
  const openAssign = async (insumo)=>{
    try{ const { data } = await getProductores(); setProductores(data||[]) }catch{}
    setAsignar({ productorId:'', cantidadAsignada:'' })
    setModal({ type:'assign', insumo })
  }

  const onSubmitAdd = async ()=>{
    try{ await insumosService.createInsumo({ nombre:form.nombre, cantidadDisponible:Number(form.cantidadDisponible||0), unidad:'bolsas', descripcion:form.descripcion, estado: form.estado, activo: form.activo !== false }); setModal(null); load(); }
    catch(e){ setError(e?.response?.data?.error||'Error al agregar insumo') }
  }
  const onSubmitEdit = async ()=>{
    try{ await insumosService.updateInsumo(modal.insumo.id, { nombre:form.nombre, cantidadDisponible:Number(form.cantidadDisponible||0), unidad:'bolsas', descripcion:form.descripcion, estado: form.estado, activo: form.activo !== false }); setModal(null); load(); }
    catch(e){ setError(e?.response?.data?.error||'Error al modificar insumo') }
  }
  const onDelete = async (insumo)=>{
    const ok = await confirmDialog({ title: '¿Estás seguro de que deseas eliminar este insumo?', text: insumo.nombre || '', icon: 'warning', confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar' })
    if (!ok) return
    try{ await insumosService.deleteInsumo(insumo.id); load(); }
    catch(e){ setError(e?.response?.data?.error||'Error al eliminar insumo') }
  }
  const onSubmitAssign = async ()=>{
    try{ const pid = asignar.productorId; const cant = Number(asignar.cantidadAsignada||0); await insumosService.asignarAProductor(modal.insumo.id, { productorId: pid, cantidadAsignada: cant }); setModal(null); load(); }
    catch(e){ setError(e?.response?.data?.error||'Error al asignar insumo') }
  }

  const onQuickAdjust = async (asig, delta)=>{
    const nueva = Math.max(0, Number(asig.cantidadAsignada||0) + delta)
    try{ await insumosService.updateAsignacion(asig.id, { cantidadAsignada: nueva }); await notify({ title: 'Asignación actualizada', icon: 'success' }); load(); if (selectedProd) { const list = await insumosService.asignacionesPorProductor(selectedProd); setAsignacionesProd(Array.isArray(list)? list: []) } }
    catch(e){ await notify({ title: e?.response?.data?.error || 'Error actualizando asignación', icon: 'error' }) }
  }

  const onEditAsign = (asig)=>{ setForm({ nombre: asig.nombre || 'Arada', cantidadDisponible:'', unidad:'bolsas', descripcion:'' }); setModal({ type:'assign-edit', asign: asig }) }
  const onSubmitEditAsign = async ()=>{
    try{ const nueva = Number(modal.asign.cantidadAsignadaEdit || 0) ; await insumosService.updateAsignacion(modal.asign.id, { cantidadAsignada: nueva }); setModal(null); load(); if (selectedProd) { const list = await insumosService.asignacionesPorProductor(selectedProd); setAsignacionesProd(Array.isArray(list)? list: []) } }
    catch(e){ setError(e?.response?.data?.error||'Error al modificar asignación') }
  }

  const estadoLabel = (i)=> {
    const est = String(i.estado||'').toLowerCase();
    if (est==='no_disponible') return 'No disponible';
    if (est==='disponible') return 'Disponible';
    return (Number(i.cantidadDisponible||0) > 0 ? 'Disponible' : 'No disponible')
  }
  const buttonStyle = { border:'1px solid #22c55e', color:'#14532d', background:'#ffffff', padding:'6px 10px', borderRadius:8 }
  const miniBtnStyle = { border:'1px solid #cbd5e1', color:'#475569', background:'#fff', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:12 }
  const actionBtnStyle = { border:'1px solid #e2e8f0', color:'#1e293b', background:'#f8fafc', padding:'6px 10px', borderRadius:6, cursor:'pointer', fontSize:12 }

  return (
    <div className="insumos-list" style={{ padding: 16 }}>
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <h2 style={{ marginTop: 0, color:'#14532d' }}>Insumos</h2>
      <div style={{ color:'#166534', marginTop: 4, marginBottom: 12 }}>Insumos disponibles del IPT</div>
      {error && <div className="users-msg err" style={{ marginBottom: 8 }}>{error}</div>}
      <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button style={{ ...buttonStyle }} onClick={openAdd}>Agregar insumo</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Mostrar:</label>
          <select 
            className="select-inst" 
            style={{ padding: '4px 8px', minWidth: 100 }}
            value={filterActivo}
            onChange={e => setFilterActivo(e.target.value)}
          >
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>
      {loading ? (<div>Cargando…</div>) : (
        <div className="table-wrap">
          <table className="table-inst" style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed', minWidth: 980 }}>
            <thead>
              <tr style={{ background:'#f0fdf4' }}>
                <th style={{ textAlign:'center', width:'20%' }}>Nombre</th>
                <th style={{ textAlign:'center', width:'16%' }}>Cantidad disponible</th>
                <th style={{ textAlign:'center', width:'20%' }}>Cantidad asignada por productor</th>
                <th style={{ textAlign:'center', width:'14%' }}>Estado</th>
                <th style={{ textAlign:'center', width:'18%' }}>Descripción</th>
                <th style={{ textAlign:'center', width:'12%' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {itemsFiltrados.length===0 ? (
                <tr><td colSpan={6} style={{ padding: 12, textAlign:'center' }}>No hay insumos disponibles</td></tr>
              ) : itemsFiltrados.map(i=> (
                <tr key={i.id}>
                  <td style={{ textAlign:'center' }}>{i.nombre}</td>
                  <td style={{ textAlign:'center' }}>{i.cantidadDisponible ?? 0} bolsas</td>
                  <td style={{ textAlign:'center' }}><InsumoAsignadoCell insumoId={i.id} /></td>
                  <td style={{ textAlign:'center' }}>{estadoLabel(i)}</td>
                  <td style={{ textAlign:'center' }}>{i.descripcion || '-'}</td>
                  <td style={{ textAlign:'center' }}>
                    <div className="actions-col" style={{ display:'inline-flex', flexDirection:'column', gap:6, alignItems:'center' }}>
                      <button style={{ ...buttonStyle }} onClick={()=>openEdit(i)}>Modificar</button>
                      <button style={{ ...buttonStyle }} onClick={()=>onDelete(i)}>Eliminar</button>
                      <button style={{ ...buttonStyle }} onClick={()=>openAssign(i)}>Asignar a productor</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 24, color:'#14532d', fontWeight: 600, marginBottom: 12 }}>Insumos asignados por productor</div>
      <div className="filters-bar" style={{ 
        display: 'flex', 
        gap: 12, 
        backgroundColor: '#f8fafc', 
        padding: '12px 16px', 
        borderRadius: 12, 
        marginBottom: 20,
        border: '1px solid #e2e8f0',
        maxWidth: 600,
        alignItems: 'center'
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input 
            className="input-inst" 
            placeholder="Buscar productor por IPT o nombre..." 
            value={producerSearchTerm}
            onChange={e => {
              setProducerSearchTerm(e.target.value);
              setShowProducerResults(true);
              if (!e.target.value) setSelectedProd('');
            }}
            onFocus={() => setShowProducerResults(true)}
            style={{ 
              width: '100%', 
              margin: 0,
              padding: '10px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 14,
              boxSizing: 'border-box'
            }}
          />
          {showProducerResults && filteredProducers.length > 0 && (
            <div style={{ 
              position: 'absolute', 
              top: 'calc(100% + 8px)', 
              left: 0, 
              right: 0, 
              background: '#fff', 
              border: '1px solid #e2e8f0', 
              borderRadius: 10, 
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', 
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
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                    {p.nombreCompleto || p.nombre || 'Sin nombre'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                    <span>IPT: <strong style={{ color: '#334155' }}>{p.ipt || '-'}</strong></span>
                    <span>CUIL: <strong style={{ color: '#334155' }}>{p.cuil || '-'}</strong></span>
                    <span>Tel: <strong style={{ color: '#334155' }}>{p.telefono || '-'}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedProd && (
          <button 
            className="btn secondary" 
            onClick={() => {
              setSelectedProd('');
              setProducerSearchTerm('');
            }}
            style={{ height: 40, whiteSpace: 'nowrap', borderRadius: 8 }}
          >
            Limpiar
          </button>
        )}
      </div>
      {selectedProd && (
        <div style={{ marginTop: 20 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            backgroundColor: '#f0fdf4', 
            padding: '12px 20px', 
            borderRadius: '12px 12px 0 0',
            border: '1px solid #dcfce7',
            borderBottom: 'none'
          }}>
            <span style={{ color: '#166534', fontWeight: 600 }}>
              Asignaciones para: {productores.find(p => p.id === selectedProd)?.nombreCompleto || 'Productor'}
            </span>
            <span style={{ fontSize: 12, color: '#166534', opacity: 0.8 }}>
              IPT: {productores.find(p => p.id === selectedProd)?.ipt || '-'}
            </span>
          </div>
          
          <div className="table-wrap" style={{ 
            border: '1px solid #e2e8f0', 
            borderRadius: '0 0 12px 12px',
            backgroundColor: '#fff',
            overflow: 'hidden'
          }}>
            {loadingAsign ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <div className="spinner" style={{ marginBottom: 12 }}></div>
                Cargando asignaciones del productor…
              </div>
            ) : asignacionesProd.length === 0 ? (
              <div style={{ 
                padding: '60px 20px', 
                textAlign: 'center', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                gap: 12
              }}>
                <div style={{ 
                  width: 64, 
                  height: 64, 
                  borderRadius: 32, 
                  backgroundColor: '#f1f5f9', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: 8
                }}>
                  <span style={{ fontSize: 24 }}>📦</span>
                </div>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: 16 }}>No hay insumos asignados</div>
                <div style={{ color: '#64748b', fontSize: 14, maxWidth: 300 }}>
                  Este productor aún no tiene insumos registrados en su cuenta.
                </div>
              </div>
            ) : (
              <table className="table-inst" style={{ width:'100%', borderCollapse:'collapse', margin: 0 }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Insumo</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Cantidad</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Descripción</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {asignacionesProd.map(a=> {
                    const ins = items.find(i=> i.id === a.insumoId) || {}
                    const nombreInsumo = ins.nombre || insumoNames[a.insumoId] || ''
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{nombreInsumo || '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ 
                            backgroundColor: '#f1f5f9', 
                            padding: '4px 10px', 
                            borderRadius: 6, 
                            fontWeight: 600,
                            color: '#475569'
                          }}>
                            {a.cantidadAsignada ?? 0} bolsas
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 13 }}>{a.descripcion || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button className="btn-icon" title="Aumentar" onClick={()=>onQuickAdjust(a, +1)} style={{ ...miniBtnStyle }}>+1</button>
                            <button className="btn-icon" title="Disminuir" onClick={()=>onQuickAdjust(a, -1)} style={{ ...miniBtnStyle }}>-1</button>
                            <button className="btn-compact" onClick={()=>setModal({ type:'assign-edit', asign: a })} style={{ ...actionBtnStyle }}>Cantidad</button>
                            <button className="btn-compact" onClick={()=>setModal({ type:'assign-desc', asign: a })} style={{ ...actionBtnStyle }}>Nota</button>
                            <button className="btn-compact" onClick={()=>setModal({ type:'assign-change-type', asign: a, newInsumoId: a.insumoId })} style={{ ...actionBtnStyle }}>Tipo</button>
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
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', padding:16, borderRadius:12, width:420 }}>
            {modal.type==='add' && (
              <div>
                <h3 style={{ marginTop:0 }}>Agregar insumo</h3>
                <select className="select-inst" value={form.nombre} onChange={e=>setForm({ ...form, nombre:e.target.value })}>
                  {['Arada','Almácibo','Transplante','Cosecha'].map(n=> <option key={n} value={n}>{n}</option>)}
                </select>
                <input className="input-inst" placeholder="Cantidad disponible" value={form.cantidadDisponible} onChange={e=>setForm({ ...form, cantidadDisponible:e.target.value })} />
                <textarea className="input-inst" placeholder="Descripción" value={form.descripcion} onChange={e=>setForm({ ...form, descripcion:e.target.value })} />
                <select className="select-inst" value={form.estado} onChange={e=>setForm({ ...form, estado: e.target.value })}>
                  <option value="disponible">Disponible</option>
                  <option value="no_disponible">No disponible</option>
                </select>
                <select className="select-inst" value={form.activo} onChange={e=>setForm({ ...form, activo: e.target.value === 'true' })}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
                <div className="form-actions" style={{ marginTop:8 }}>
                  <button style={{ ...buttonStyle, marginRight:8 }} onClick={()=>setModal(null)}>Cancelar</button>
                  <button style={buttonStyle} onClick={onSubmitAdd}>Guardar</button>
                </div>
              </div>
            )}
            {modal.type==='edit' && (
              <div>
                <h3 style={{ marginTop:0 }}>Modificar insumo</h3>
                <select className="select-inst" value={form.nombre} onChange={e=>setForm({ ...form, nombre:e.target.value })}>
                  {['Arada','Almácibo','Transplante','Cosecha'].map(n=> <option key={n} value={n}>{n}</option>)}
                </select>
                <input className="input-inst" placeholder="Cantidad disponible" value={form.cantidadDisponible} onChange={e=>setForm({ ...form, cantidadDisponible:e.target.value })} />
                <textarea className="input-inst" placeholder="Descripción" value={form.descripcion} onChange={e=>setForm({ ...form, descripcion:e.target.value })} />
                <select className="select-inst" value={form.estado} onChange={e=>setForm({ ...form, estado: e.target.value })}>
                  <option value="disponible">Disponible</option>
                  <option value="no_disponible">No disponible</option>
                </select>
                <select className="select-inst" value={form.activo} onChange={e=>setForm({ ...form, activo: e.target.value === 'true' })}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
                <div className="form-actions" style={{ marginTop:8 }}>
                  <button style={{ ...buttonStyle, marginRight:8 }} onClick={()=>setModal(null)}>Cancelar</button>
                  <button style={buttonStyle} onClick={onSubmitEdit}>Guardar</button>
                </div>
              </div>
            )}
            {modal.type==='assign' && (
              <div>
                <h3 style={{ marginTop:0 }}>Asignar a productor</h3>
                <div className="filters-row" style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:8, marginBottom:8 }}>
                  <input className="input-inst" placeholder="Buscar por IPT" value={iptSearch} onChange={e=>setIptSearch(e.target.value)} />
                  <select className="select-inst" value={asignar.productorId} onChange={e=>setAsignar({ ...asignar, productorId:e.target.value })}>
                    <option value="">Seleccione productor</option>
                    {productores.filter(p=> iptSearch ? String(p.ipt||'').includes(String(iptSearch)) : true).map(p=> (
                      <option key={p.id} value={p.id}>{p.nombreCompleto || p.ipt || p.id} {p.ipt ? `· ${p.ipt}`:''}</option>
                    ))}
                  </select>
                </div>
                <input className="input-inst" placeholder="Cantidad a asignar (bolsas)" value={asignar.cantidadAsignada} onChange={e=>setAsignar({ ...asignar, cantidadAsignada:e.target.value })} />
                <div className="form-actions" style={{ marginTop:8 }}>
                  <button style={{ ...buttonStyle, marginRight:8 }} onClick={()=>setModal(null)}>Cancelar</button>
                  <button style={buttonStyle} onClick={onSubmitAssign}>Asignar</button>
                </div>
              </div>
            )}
            {modal.type==='assign-edit' && (
              <div>
                <h3 style={{ marginTop:0 }}>Modificar cantidad</h3>
                <div style={{ marginBottom: 8 }}>Cantidad actual: {modal.asign.cantidadAsignada ?? 0} bolsas</div>
                <input className="input-inst" placeholder="Nueva cantidad (bolsas)" value={modal.asign.cantidadAsignadaEdit ?? ''} onChange={e=>setModal(m=>({ ...m, asign: { ...m.asign, cantidadAsignadaEdit: e.target.value } }))} />
                <div className="form-actions" style={{ marginTop:8 }}>
                  <button style={{ ...buttonStyle, marginRight:8 }} onClick={()=>setModal(null)}>Cancelar</button>
                  <button style={buttonStyle} onClick={onSubmitEditAsign}>Guardar</button>
                </div>
              </div>
            )}
            {modal.type==='assign-desc' && (
              <div>
                <h3 style={{ marginTop:0 }}>Agregar descripción</h3>
                <textarea className="input-inst" placeholder="Descripción del insumo para el productor" value={modal.asign.descripcionEdit ?? ''} onChange={e=>setModal(m=>({ ...m, asign: { ...m.asign, descripcionEdit: e.target.value } }))} />
                <div className="form-actions" style={{ marginTop:8 }}>
                  <button style={{ ...buttonStyle, marginRight:8 }} onClick={()=>setModal(null)}>Cancelar</button>
                  <button style={buttonStyle} onClick={async()=>{ try{ await insumosService.updateAsignacion(modal.asign.id, { descripcion: modal.asign.descripcionEdit }); setModal(null); load(); if (selectedProd) { const list = await insumosService.asignacionesPorProductor(selectedProd); setAsignacionesProd(Array.isArray(list)? list: []) } } catch(e){ setError(e?.response?.data?.error||'Error al agregar descripción') } }}>Guardar</button>
                </div>
              </div>
            )}
            {modal.type==='assign-change-type' && (
              <div>
                <h3 style={{ marginTop:0 }}>Modificar tipo de insumo asignado</h3>
                <div style={{ marginBottom: 8 }}>Insumo actual: {insumoNames[modal.asign.insumoId] || '-'}</div>
                <select className="select-inst" value={modal.newInsumoId} onChange={e=>setModal(m=>({ ...m, newInsumoId: e.target.value }))}>
                  <option value="">Seleccione nuevo insumo</option>
                  {allInsumos.map(i=> (
                    <option key={i.id} value={i.id}>{i.nombre}</option>
                  ))}
                </select>
                <div className="form-actions" style={{ marginTop:8 }}>
                  <button style={{ ...buttonStyle, marginRight:8 }} onClick={()=>setModal(null)}>Cancelar</button>
                  <button style={buttonStyle} onClick={async()=>{
                    try{
                      if (!modal.newInsumoId) { notify({ title: 'Debe seleccionar un nuevo insumo', icon: 'error' }); return }
                      await insumosService.updateAsignacionTipo(modal.asign.id, modal.newInsumoId);
                      setModal(null);
                      load();
                      if (selectedProd) { const list = await insumosService.asignacionesPorProductor(selectedProd); setAsignacionesProd(Array.isArray(list)? list: []) }
                      notify({ title: 'Tipo de insumo actualizado', icon: 'success' });
                    } catch(e){
                      notify({ title: e?.response?.data?.error||'Error al modificar tipo de insumo', icon: 'error' })
                    }
                  }}>Guardar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const InsumoAsignadoCell = ({ insumoId }) => {
  const [total, setTotal] = useState('-')
  useEffect(()=>{ (async()=>{
    try{ const asigs = await insumosService.asignacionesPorInsumo(insumoId); const sum = Array.isArray(asigs)? asigs.reduce((acc,x)=> acc + Number(x.cantidadAsignada||0), 0) : 0; setTotal(sum) }catch{ setTotal('-') }
  })() },[insumoId])
  return <span>{total === '-' ? '-' : `${total} bolsas`}</span>
}


export default InsumosList
