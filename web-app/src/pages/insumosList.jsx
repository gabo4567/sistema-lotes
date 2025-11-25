import React, { useEffect, useState } from 'react'
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

  useEffect(()=>{ load() },[])

  useEffect(()=>{ (async()=>{ try{ const { data } = await getProductores(); setProductores(data||[]) }catch{} })() }, [])

  useEffect(()=>{ (async()=>{ if(!selectedProd) { setAsignacionesProd([]); return } ; setLoadingAsign(true); try{ const list = await insumosService.asignacionesPorProductor(selectedProd); setAsignacionesProd(Array.isArray(list)? list: []) }catch{ setAsignacionesProd([]) } finally{ setLoadingAsign(false) } })() }, [selectedProd])

  const openAdd = ()=>{ setForm({ nombre:'Arada', cantidadDisponible:'', unidad:'bolsas', descripcion:'', estado:'disponible' }); setModal({ type:'add' }) }
  const openEdit = (insumo)=>{ setForm({ nombre:insumo.nombre||'Arada', cantidadDisponible:insumo.cantidadDisponible??'', unidad:'bolsas', descripcion:insumo.descripcion||'', estado:insumo.estado||'disponible' }); setModal({ type:'edit', insumo }) }
  const openAssign = async (insumo)=>{
    try{ const { data } = await getProductores(); setProductores(data||[]) }catch{}
    setAsignar({ productorId:'', cantidadAsignada:'' })
    setModal({ type:'assign', insumo })
  }

  const onSubmitAdd = async ()=>{
    try{ await insumosService.createInsumo({ nombre:form.nombre, cantidadDisponible:Number(form.cantidadDisponible||0), unidad:'bolsas', descripcion:form.descripcion, estado: form.estado }); setModal(null); load(); }
    catch(e){ setError(e?.response?.data?.error||'Error al agregar insumo') }
  }
  const onSubmitEdit = async ()=>{
    try{ await insumosService.updateInsumo(modal.insumo.id, { nombre:form.nombre, cantidadDisponible:Number(form.cantidadDisponible||0), unidad:'bolsas', descripcion:form.descripcion, estado: form.estado }); setModal(null); load(); }
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

  return (
    <div className="insumos-list" style={{ padding: 16 }}>
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <h2 style={{ marginTop: 0, color:'#14532d' }}>Insumos</h2>
      <div style={{ color:'#166534', marginTop: 4, marginBottom: 12 }}>Insumos disponibles del IPT</div>
      {error && <div className="users-msg err" style={{ marginBottom: 8 }}>{error}</div>}
      <div style={{ marginBottom: 12 }}>
        <button style={{ ...buttonStyle, marginRight:8 }} onClick={openAdd}>Agregar insumo</button>
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
              {items.length===0 ? (
                <tr><td colSpan={6} style={{ padding: 12, textAlign:'center' }}>No hay insumos disponibles</td></tr>
              ) : items.map(i=> (
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

      <div style={{ marginTop: 24, color:'#14532d', fontWeight: 600 }}>Insumos asignados por productor</div>
      <div className="filters-row" style={{ marginBottom: 10 }}>
        <select className="select-inst" value={selectedProd} onChange={e=>setSelectedProd(e.target.value)}>
          <option value="">Seleccione productor para ver asignaciones</option>
          {productores.map(p=> <option key={p.id} value={p.id}>{p.nombreCompleto || p.ipt || p.id}</option>)}
        </select>
      </div>
      {selectedProd && (
        <div className="table-wrap">
          {loadingAsign ? (<div>Cargando asignaciones…</div>) : (
            <table className="table-inst" style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f0fdf4' }}>
                  <th>Insumo</th>
                  <th>Cantidad asignada</th>
                  <th>Descripción</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {asignacionesProd.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 12 }}>Sin asignaciones</td></tr>
                ) : asignacionesProd.map(a=> {
                  const ins = items.find(i=> i.id === a.insumoId) || {}
                  const nombreInsumo = ins.nombre || insumoNames[a.insumoId] || ''
                  return (
                    <tr key={a.id}>
                      <td>{nombreInsumo || '-'}</td>
                      <td>{a.cantidadAsignada ?? 0} bolsas</td>
                      <td>{a.descripcion || '-'}</td>
                      <td>
                        <div className="actions-row">
                          <button style={{ border:'1px solid #22c55e', color:'#14532d', background:'#ffffff', padding:'6px 10px', borderRadius:8, marginRight:6 }} onClick={()=>onQuickAdjust(a, +1)}>+1</button>
                          <button style={{ border:'1px solid #22c55e', color:'#14532d', background:'#ffffff', padding:'6px 10px', borderRadius:8, marginRight:6 }} onClick={()=>onQuickAdjust(a, -1)}>-1</button>
                          <button style={{ border:'1px solid #22c55e', color:'#14532d', background:'#ffffff', padding:'6px 10px', borderRadius:8, marginRight:6 }} onClick={()=>setModal({ type:'assign-edit', asign: a })}>Modificar cantidad</button>
                          <button style={{ border:'1px solid #22c55e', color:'#14532d', background:'#ffffff', padding:'6px 10px', borderRadius:8 }} onClick={()=>setModal({ type:'assign-desc', asign: a })}>Agregar descripción</button>
                        </div>
                      </td>
                    </tr>
                )})}
              </tbody>
            </table>
          )}
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
