import React, { useEffect, useRef, useState, useMemo } from 'react'
import { insumosService } from '../services/insumos.service'
import { getProductores } from '../services/productores.service'
import { notify, confirmDialog } from '../utils/alerts'
import LoadingState from '../components/LoadingState'
import DismissibleAlert from '../components/DismissibleAlert'
import ConfirmDialog from '../components/ConfirmDialog'


const InsumosList = () => {
  const RUBROS_INSUMOS = ['Plastico', 'Media sombra', 'Complementarios', 'Fertilizantes', 'Remedios', 'Hilos']
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ nombre:'', rubro:'Complementarios', unidad:'unidades', descripcion:'', activo: true })
  const [productores, setProductores] = useState([])
  const [asignar, setAsignar] = useState({ productorId:'', cantidadAsignada:'' })
  const [assignError, setAssignError] = useState('')
  const [iptSearch, setIptSearch] = useState('')
  const [selectedProd, setSelectedProd] = useState('')
  const [asignacionesProd, setAsignacionesProd] = useState([])
  const [loadingAsign, setLoadingAsign] = useState(false)
  const [insumoNames, setInsumoNames] = useState({})
  const [filterActivo, setFilterActivo] = useState('activos')
  const [quickFilter, setQuickFilter] = useState('todos')
  const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' })
  const [catalogFilters, setCatalogFilters] = useState({ nombre: '', rubro: 'todos' })
  const [producerSearchTerm, setProducerSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showProducerResults, setShowProducerResults] = useState(false)
  const [loadingResumenAsignaciones, setLoadingResumenAsignaciones] = useState(true)
  const [resumenAsignaciones, setResumenAsignaciones] = useState({ productores: 0, asignaciones: 0, totalAsignado: 0, totalEntregado: 0, totalDisponible: 0 })
  const [productoresConInsumos, setProductoresConInsumos] = useState([])
  const [totalesPorInsumo, setTotalesPorInsumo] = useState({})
  const importInputRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [deliveryConfirmDialog, setDeliveryConfirmDialog] = useState({ isOpen: false, asignacion: null })

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
      refreshResumenAsignaciones()
    } catch (e) {
      console.error(e)
      setError('No se pudieron cargar los insumos')
      setItems([])
    } finally { setLoading(false) }
  }

  const refreshResumenAsignaciones = async () => {
    setLoadingResumenAsignaciones(true)
    try {
      const resumenData = await insumosService.resumenAsignacionesPorProductor()
      setResumenAsignaciones(resumenData?.resumen || { productores: 0, asignaciones: 0, totalAsignado: 0, totalEntregado: 0, totalDisponible: 0 })
      setProductoresConInsumos(Array.isArray(resumenData?.productores) ? resumenData.productores : [])
      setTotalesPorInsumo(
        Array.isArray(resumenData?.insumos)
          ? Object.fromEntries(resumenData.insumos.map(i => [String(i.insumoId), i]))
          : {}
      )
    } catch {
      setResumenAsignaciones({ productores: 0, asignaciones: 0, totalAsignado: 0, totalEntregado: 0, totalDisponible: 0 })
      setProductoresConInsumos([])
      setTotalesPorInsumo({})
    } finally {
      setLoadingResumenAsignaciones(false)
    }
  }

  const normalizeText = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const isActivo = (i) => i?.activo !== false
  const insumoTotal = (i, key) => Number(totalesPorInsumo?.[String(i?.id)]?.[key] || 0)
  const insumoAsignado = (i) => insumoTotal(i, 'totalAsignado')
  const insumoEntregado = (i) => insumoTotal(i, 'totalEntregado')
  const hasAsignaciones = (i) => insumoAsignado(i) > 0

  const sortMark = (key) => (
    sortConfig.key === key ? (sortConfig.direction === 'asc' ? '^' : 'v') : ''
  )

  const onSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const insumosSummary = useMemo(() => {
    const base = Array.isArray(items) ? items : []
    const rubros = new Set()
    return base.reduce((acc, i) => {
      acc.total += 1
      if (isActivo(i)) acc.activos += 1
      else acc.inactivos += 1
      if (String(i?.rubro || '').trim()) rubros.add(String(i.rubro).trim())
      if (hasAsignaciones(i)) acc.conAsignaciones += 1
      else acc.sinAsignaciones += 1
      return acc
    }, {
      total: 0,
      activos: 0,
      inactivos: 0,
      conAsignaciones: 0,
      sinAsignaciones: 0,
      get rubrosDistintos() { return rubros.size },
    })
  }, [items, totalesPorInsumo])

  const itemsFiltrados = useMemo(() => {
    const filtered = items.filter(i => {
      if (filterActivo === 'todos') return true;
      return filterActivo === 'activos' ? isActivo(i) : !isActivo(i);
    }).filter(i => {
      const nombre = normalizeText(catalogFilters.nombre).trim()
      const rubro = String(catalogFilters.rubro || 'todos')
      const okNombre = nombre ? normalizeText(i?.nombre).includes(nombre) : true
      const okRubro = rubro === 'todos' ? true : String(i?.rubro || '') === rubro
      return okNombre && okRubro
    }).filter(i => {
      if (quickFilter === 'conAsignaciones') return hasAsignaciones(i)
      if (quickFilter === 'sinAsignaciones') return !hasAsignaciones(i)
      return true
    });

    return [...filtered].sort((a, b) => {
      const getValue = (i) => {
        if (sortConfig.key === 'nombre') return normalizeText(i?.nombre)
        if (sortConfig.key === 'rubro') return normalizeText(i?.rubro)
        if (sortConfig.key === 'asignado') return insumoAsignado(i)
        if (sortConfig.key === 'estado') return i?.activo === false ? 'Inactivo' : 'Activo'
        return ''
      }
      const aValue = getValue(a)
      const bValue = getValue(b)
      const compare = typeof aValue === 'number' && typeof bValue === 'number'
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), 'es', { numeric: true, sensitivity: 'base' })
      return sortConfig.direction === 'asc' ? compare : -compare
    })
  }, [items, filterActivo, quickFilter, sortConfig, totalesPorInsumo, catalogFilters]);

  const filteredProducers = useMemo(() => {
    const source = Array.isArray(productoresConInsumos) ? productoresConInsumos : [];
    const term = producerSearchTerm
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    if (!term) return source;
    return source.filter(p => {
      const haystack = [p.ipt, p.productorNombre, p.cuil, p.telefono, p.paraje]
        .map(v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
        .join(' ');
      return haystack.includes(term);
    });
  }, [productoresConInsumos, producerSearchTerm]);

  const PAGE_SIZE = 20
  const pageCount = useMemo(() => {
    const total = Array.isArray(filteredProducers) ? filteredProducers.length : 0
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [filteredProducers.length])

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount)
    }
  }, [currentPage, pageCount])

  useEffect(() => {
    setCurrentPage(1)
  }, [producerSearchTerm, filteredProducers.length])

  const paginatedProducers = useMemo(() => {
    const list = Array.isArray(filteredProducers) ? filteredProducers : []
    const start = (currentPage - 1) * PAGE_SIZE
    return list.slice(start, start + PAGE_SIZE)
  }, [filteredProducers, currentPage])

  useEffect(()=>{ load() },[])

  useEffect(()=>{ (async()=>{ try{ const { data } = await getProductores(); setProductores(data||[]) }catch{ null } })() }, [])

  useEffect(()=>{ (async()=>{ if(!selectedProd) { setAsignacionesProd([]); return } ; setLoadingAsign(true); try{ const list = await insumosService.asignacionesPorProductor(selectedProd); setAsignacionesProd(Array.isArray(list)? list: []) }catch{ setAsignacionesProd([]) } finally{ setLoadingAsign(false) } })() }, [selectedProd])

  const normalizeHeader = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  const guessRubro = (nombre) => {
    const n = normalizeHeader(nombre)
    if (n.includes('media sombra')) return 'Media sombra'
    if (n.includes('fertiliz') || n.includes('nitrato')) return 'Fertilizantes'
    if (n.includes('hilo')) return 'Hilos'
    if (n.includes('bifentrin') || n.includes('command') || n.includes('confidor') || n.includes('debrot')) return 'Remedios'
    if (n.includes('carpa') || n.includes('plastico')) return 'Plastico'
    return 'Complementarios'
  }

  const parseExcelNumber = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    const s = String(value ?? '').trim()
    if (!s) return 0
    const n = Number(s.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  const onClickImport = () => {
    if (importing) return
    importInputRef.current?.click()
  }

  const onImportExcel = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || importing) return
    const lower = String(file.name || '').toLowerCase()
    if (!lower.endsWith('.xls') && !lower.endsWith('.xlsx')) {
      await notify({ title: 'Archivo invalido', text: 'Selecciona un archivo .xls o .xlsx', icon: 'error' })
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
      const headerIndex = rows.findIndex(row => {
        const first = normalizeHeader(row?.[0])
        return first === 'fet' || first === 'ipt fet' || first === 'ipt'
      })
      if (headerIndex < 0) throw new Error('No se encontro la columna IPT/FET')
      const headers = rows[headerIndex].map(h => String(h || '').trim())
      const headerKeys = headers.map(normalizeHeader)
      const col = (...names) => {
        const keys = names.map(normalizeHeader)
        return headerKeys.findIndex(h => keys.includes(h))
      }
      const iptCol = col('IPT/FET', 'FET', 'IPT')
      const cuilCol = col('CUIL')
      const nombreCol = col('Apellido y Nombre', 'Nombre', 'Productor')
      const parajeCol = col('Paraje')
      const telefonoCol = col('Telefono', 'Teléfono')
      const emailCol = col('Email', 'Correo')
      const domicilioCol = col('Domicilio')
      const activoCol = col('Activo')
      const estadoProductorCol = col('Estado productor', 'Estado')
      const firstInsumoIndex = Math.max(
        iptCol,
        cuilCol,
        nombreCol,
        parajeCol,
        telefonoCol,
        emailCol,
        domicilioCol,
        activoCol,
        estadoProductorCol,
      ) + 1
      const insumoHeaders = headers
        .map((name, index) => ({ name, index }))
        .filter(h => h.index >= firstInsumoIndex && h.name)
      const parsedRows = rows.slice(headerIndex + 1)
        .map(row => {
          const ipt = String(row?.[iptCol] || '').trim()
          const productorNombre = String(nombreCol >= 0 ? row?.[nombreCol] : '').trim()
          const paraje = String(parajeCol >= 0 ? row?.[parajeCol] : '').trim()
          const insumos = insumoHeaders
            .map(h => ({
              nombre: h.name,
              rubro: guessRubro(h.name),
              unidad: 'unidades',
              cantidad: parseExcelNumber(row?.[h.index]),
            }))
            .filter(i => i.cantidad > 0)
          return {
            ipt,
            cuil: String(cuilCol >= 0 ? row?.[cuilCol] : '').trim(),
            productorNombre,
            paraje,
            telefono: String(telefonoCol >= 0 ? row?.[telefonoCol] : '').trim(),
            email: String(emailCol >= 0 ? row?.[emailCol] : '').trim(),
            domicilio: String(domicilioCol >= 0 ? row?.[domicilioCol] : '').trim(),
            activo: String(activoCol >= 0 ? row?.[activoCol] : 'SI').trim(),
            estadoProductor: String(estadoProductorCol >= 0 ? row?.[estadoProductorCol] : 'Nuevo').trim(),
            insumos,
          }
        })
        .filter(row => row.ipt && row.insumos.length > 0)
      if (parsedRows.length === 0) throw new Error('No se encontraron asignaciones con cantidad mayor a cero')
      const result = await insumosService.importarAsignaciones({
        campania: '2025-2026',
        fuente: file.name || 'excel',
        rows: parsedRows,
      })
      setImportResult(result)
      await notify({
        title: 'Importacion completada',
        text: `${result?.asignacionesCreadasOActualizadas ?? 0} asignaciones procesadas.`,
        icon: 'success',
      })
      await load()
      if (selectedProd) await refreshAsignacionesProductor()
    } catch (e) {
      await notify({ title: 'Error al importar', text: e?.response?.data?.error || e?.message || 'No se pudo importar el Excel', icon: 'error' })
    } finally {
      setImporting(false)
    }
  }

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
    const ipt = String(p.ipt || p.productorId || '');
    setSelectedProd(ipt);
    setProducerSearchTerm('');
  };

  const openAdd = ()=>{ setForm({ nombre:'', rubro:'Complementarios', unidad:'unidades', descripcion:'', activo: true }); setModal({ type:'add' }) }
  const openEdit = (insumo)=>{ setForm({ nombre:insumo.nombre||'', rubro:insumo.rubro||'Complementarios', unidad:insumo.unidad||'unidades', descripcion:insumo.descripcion||'', activo: insumo.activo !== false }); setModal({ type:'edit', insumo }) }
  const openAssign = async (insumo)=>{
    try{ const { data } = await getProductores(); setProductores(data||[]) }catch{ null }
    setAsignar({ productorId:'', cantidadAsignada:'' })
    setAssignError('')
    setModal({ type:'assign', insumo })
  }

  const onSubmitAdd = async ()=>{
    try{ await insumosService.createInsumo({ nombre:form.nombre, rubro:form.rubro, unidad:form.unidad||'unidades', descripcion:form.descripcion, activo: form.activo !== false }); setModal(null); load(); }
    catch(e){ setError(e?.response?.data?.error||'Error al agregar insumo') }
  }
  const onSubmitEdit = async ()=>{
    try{ await insumosService.updateInsumo(modal.insumo.id, { nombre:form.nombre, rubro:form.rubro, unidad:form.unidad||'unidades', descripcion:form.descripcion, activo: form.activo !== false }); setModal(null); load(); }
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
    const prod = productores.find(p => String(p.ipt || '') === String(selectedProd || ''))
    const ipt = prod?.ipt
    if (!ipt) { await notify({ title: 'El productor no tiene IPT registrado', icon: 'error' }); return }
    const nombre = prod?.nombreCompleto || prod?.nombre || 'este productor'
    const ok = await confirmDialog({ title: `¿Eliminar todas las asignaciones de ${nombre}?`, text: 'Esta acción no se puede deshacer.', icon: 'warning', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar' })
    if (!ok) return
    try{
      const res = await insumosService.eliminarAsignacionesPorIpt(ipt)
      await notify({ title: `Listo. Se eliminaron ${res?.eliminadas ?? 0} asignación/es.`, icon: 'success' })
      setAsignacionesProd([])
      load()
    } catch(e){ await notify({ title: e?.response?.data?.error || 'Error al eliminar asignaciones', icon: 'error' }) }
  }

  const handleOpenDeliveryModal = (asignacion) => {
    setDeliveryConfirmDialog({ 
      isOpen: true, 
      asignacion: {
        ...asignacion,
        cantidadEntregadaEdit: asignacion.cantidadEntregada ?? 0
      } 
    })
  }

  const handleConfirmDelivery = async () => {
    const { asignacion } = deliveryConfirmDialog
    if (!asignacion) return

    const cantidadAsignada = Number(asignacion.cantidadAsignada || 0)
    const cantidadEntregada = Number(asignacion.cantidadEntregadaEdit || 0)
    
    if (cantidadEntregada < 0) {
      setError('La cantidad entregada no puede ser negativa')
      return
    }
    if (cantidadEntregada > cantidadAsignada) {
      setError(`La cantidad entregada (${cantidadEntregada}) no puede ser mayor a la asignada (${cantidadAsignada})`)
      return
    }

    try {
      await insumosService.updateAsignacion(asignacion.id, { cantidadEntregada })
      setDeliveryConfirmDialog({ isOpen: false, asignacion: null })
      setError('')
      const msg = cantidadEntregada === cantidadAsignada 
        ? 'Entrega completada' 
        : `Entrega parcial registrada: ${cantidadEntregada}/${cantidadAsignada}`
      await notify({ title: msg, icon: 'success' })
      load()
      if (selectedProd) {
        const list = await insumosService.asignacionesPorProductor(selectedProd)
        setAsignacionesProd(Array.isArray(list) ? list : [])
      }
    } catch(e) {
      setError(e?.response?.data?.error || 'Error al registrar entrega')
    }
  }

  const handleCancelDelivery = () => {
    setDeliveryConfirmDialog({ isOpen: false, asignacion: null })
  }

  const estadoLabel = (i)=> {
    return i.activo === false ? 'Inactivo' : 'Activo'
  }
  const estadoClass = (i) => i.activo === false ? 'is-inactive' : 'is-active'
  const rubroLabel = (i) => String(i.rubro || '-')
  const quickFilters = [
    { key: 'todos', label: 'Todos', count: insumosSummary.total },
    { key: 'activos', label: 'Activos', count: insumosSummary.activos },
    { key: 'inactivos', label: 'Inactivos', count: insumosSummary.inactivos },
    { key: 'conAsignaciones', label: 'Con asignaciones', count: insumosSummary.conAsignaciones },
    { key: 'sinAsignaciones', label: 'Sin asignaciones', count: insumosSummary.sinAsignaciones },
  ]
  const setQuick = (key) => {
    setQuickFilter(key)
    if (key === 'activos') setFilterActivo('activos')
    else if (key === 'inactivos') setFilterActivo('inactivos')
    else if (key === 'todos') setFilterActivo('todos')
    else setFilterActivo('todos')
  }
  const clearFilters = () => {
    setFilterActivo('activos')
    setQuickFilter('todos')
    setCatalogFilters({ nombre: '', rubro: 'todos' })
    setSortConfig({ key: 'nombre', direction: 'asc' })
  }
  const setCatalogOrder = (value) => {
    const [key, direction] = String(value || 'nombre:asc').split(':')
    setSortConfig({ key, direction: direction || 'asc' })
  }
  const catalogOrderValue = `${sortConfig.key}:${sortConfig.direction}`
  const buttonStyle = { border:'1px solid #22c55e', color:'#14532d', background:'#ffffff', padding:'6px 10px', borderRadius:8 }
  const miniBtnStyle = { border:'1px solid #cbd5e1', color:'#475569', background:'#fff', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:13 }
  const actionBtnStyle = { border:'1px solid #e2e8f0', color:'#1e293b', background:'#f8fafc', padding:'6px 10px', borderRadius:6, cursor:'pointer', fontSize:13 }
  return (
    <div className="insumos-list insumos-page page-container">
      <div className="insumos-hero">
        <div>
          <h2>Gestión de Insumos</h2>
          <p className="section-subtitle">Administrá el catálogo de insumos y sus asignaciones por productor.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn secondary" onClick={onClickImport} disabled={importing} style={{ minHeight: 42, padding: '0 14px' }}>
            {importing ? 'Importando...' : '↑ Importar Excel'}
          </button>
          <button className="btn" onClick={openAdd}>+ Agregar insumo</button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xls,.xlsx"
            style={{ display: 'none' }}
            onChange={onImportExcel}
          />
        </div>
      </div>
      <h2 style={{ marginTop: 0, color:'#14532d' }}>Gestión de Insumos</h2>
      <div style={{ color:'#166534', marginTop: 4, marginBottom: 12, fontSize: 18, fontWeight: 600 }}>Catalogo de insumos del IPT</div>
      {error && <DismissibleAlert className="users-msg err" style={{ marginBottom: 8 }}>{error}</DismissibleAlert>}
      <div className="turnos-summary insumos-summary">
        <div className="turnos-summary__chip turnos-summary__chip--total">
          <span className="turnos-summary__label">Mostrados</span>
          <span className="estado-badge expired">{itemsFiltrados.length}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--completed">
          <span className="turnos-summary__label">Activos</span>
          <span className="estado-badge completed">{insumosSummary.activos}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--expired">
          <span className="turnos-summary__label">Inactivos</span>
          <span className="estado-badge expired">{insumosSummary.inactivos}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--confirmed">
          <span className="turnos-summary__label">Rubros</span>
          <span className="estado-badge confirmed">{insumosSummary.rubrosDistintos}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--total">
          <span className="turnos-summary__label">Asignado</span>
          <span className="estado-badge expired">{resumenAsignaciones.totalAsignado}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--total">
          <span className="turnos-summary__label">Entregado</span>
          <span className="estado-badge expired">{resumenAsignaciones.totalEntregado}</span>
        </div>
      </div>
      <div className="insumos-quick-filters" aria-label="Filtros rapidos de insumos">
        {quickFilters.map(filter => (
          <button
            key={filter.key}
            type="button"
            className={`insumos-filter-chip${quickFilter === filter.key ? ' is-active' : ''}`}
            onClick={() => setQuick(filter.key)}
          >
            <span>{filter.label}</span>
            <strong>{filter.count}</strong>
          </button>
        ))}
      </div>
      <div className="filters-bar catalog-filter-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, backgroundColor: '#ffffff', padding: 20, borderRadius: 12, marginBottom: 20, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', alignItems: 'flex-end' }}>
        <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 220px' }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Nombre del insumo</label>
          <input
            type="text"
            className="input-inst"
            placeholder="Buscar por nombre..."
            value={catalogFilters.nombre}
            onChange={e => setCatalogFilters({ ...catalogFilters, nombre: e.target.value })}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, minHeight: 42, borderRadius: 8 }}
          />
        </div>
        <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 180px' }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Rubro</label>
          <select
            className="select-inst"
            value={catalogFilters.rubro}
            onChange={e => setCatalogFilters({ ...catalogFilters, rubro: e.target.value })}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, minHeight: 42, borderRadius: 8 }}
          >
            <option value="todos">Todos los rubros</option>
            {RUBROS_INSUMOS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 180px' }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Estado</label>
          <select
            className="select-inst"
            value={filterActivo}
            onChange={e => { setFilterActivo(e.target.value); setQuickFilter('todos') }}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, minHeight: 42, borderRadius: 8 }}
          >
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 220px' }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Ordenar por</label>
          <select
            className="select-inst"
            value={catalogOrderValue}
            onChange={e => setCatalogOrder(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, minHeight: 42, borderRadius: 8 }}
          >
            <option value="nombre:asc">Nombre A-Z</option>
            <option value="nombre:desc">Nombre Z-A</option>
            <option value="rubro:asc">Rubro A-Z</option>
            <option value="asignado:desc">Mayor asignado</option>
            <option value="asignado:asc">Menor asignado</option>
            <option value="estado:asc">Estado</option>
          </select>
        </div>
        <button type="button" className="btn secondary filter-clear-btn" onClick={clearFilters}>Limpiar filtros</button>
      </div>
      {importResult ? (
        <DismissibleAlert className="users-msg ok" style={{ marginBottom: 12 }}>
          Importacion: {importResult.asignacionesCreadasOActualizadas ?? 0} asignaciones, {importResult.insumosCreadosOActualizados ?? 0} insumos, {importResult.productoresCreados ?? 0} productores creados.
        </DismissibleAlert>
      ) : null}
      {importing ? (
        <div style={{
          marginBottom: 12,
          padding: '16px 18px',
          border: '1px solid #bbf7d0',
          borderRadius: 12,
          background: '#f0fdf4',
          color: '#14532d',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Importando</div>
            <div style={{ fontSize: 14, color: '#166534', marginTop: 2 }}>Espere unos segundos</div>
          </div>
        </div>
      ) : null}
      {loading ? (
        <LoadingState
          title="Cargando insumos..."
          message="Estamos preparando el catalogo y las asignaciones. Espera unos segundos."
        />
      ) : (
        <>
        <div className="table-wrap admin-data-table-wrap insumos-table-wrap">
          <table className="table-inst admin-data-table insumos-data-table" style={{ width:'100%', borderCollapse:'collapse', tableLayout:'auto', minWidth: 1280 }}>
            <thead>
              <tr style={{ background:'#f0fdf4' }}>
                <th style={{ textAlign:'center', width:'20%' }}>
                  <button type="button" className="insumos-sort-button" onClick={() => onSort('nombre')}>
                    <span>Nombre</span>
                    <span className="insumos-sort-mark">{sortMark('nombre')}</span>
                  </button>
                </th>
                <th style={{ textAlign:'center', width:'14%' }}>
                  <button type="button" className="insumos-sort-button" onClick={() => onSort('rubro')}>
                    <span>Rubro</span>
                    <span className="insumos-sort-mark">{sortMark('rubro')}</span>
                  </button>
                </th>
                <th style={{ textAlign:'center', width:'20%' }}>
                  <button type="button" className="insumos-sort-button" onClick={() => onSort('asignado')}>
                    <span>Asignado</span>
                    <span className="insumos-sort-mark">{sortMark('asignado')}</span>
                  </button>
                </th>
                <th style={{ textAlign:'center', width:'12%' }}>
                  <button type="button" className="insumos-sort-button" onClick={() => onSort('estado')}>
                    <span>Estado</span>
                    <span className="insumos-sort-mark">{sortMark('estado')}</span>
                  </button>
                </th>
                <th style={{ textAlign:'center', width:'18%' }}>Descripcion</th>
                <th className="insumos-actions-cell" style={{ textAlign:'center', width: 320, minWidth: 320 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {itemsFiltrados.length===0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 28, textAlign:'center' }}>
                    <div className="insumos-empty-state">
                      <strong>No encontramos insumos con esos criterios.</strong>
                      <span>Proba cambiando los filtros para ver el catalogo completo.</span>
                      <button type="button" className="btn secondary filter-clear-btn" onClick={clearFilters}>Limpiar filtros</button>
                    </div>
                  </td>
                </tr>
              ) : itemsFiltrados.map(i=> (
                <tr key={i.id}>
                  <td style={{ textAlign:'center' }}>{i.nombre}</td>
                  <td style={{ textAlign:'center' }}><span className="insumos-rubro-badge">{rubroLabel(i)}</span></td>
                  <td style={{ textAlign:'center' }}>
                    <span className="insumos-amount-badge">
                      {loadingResumenAsignaciones
                        ? 'Actualizando...'
                        : `${insumoAsignado(i)} ${i.unidad || 'bolsas'}`}
                    </span>
                  </td>
                  <td style={{ textAlign:'center' }}><span className={`insumos-status-badge ${estadoClass(i)}`}>{estadoLabel(i)}</span></td>
                  <td style={{ textAlign:'center' }}>{i.descripcion || '-'}</td>
                  <td className="insumos-actions-cell" style={{ textAlign:'center', width: 320, minWidth: 320 }}>
                    <div className="insumos-actions-grid">
                      <button style={{ ...buttonStyle }} onClick={()=>openEdit(i)}>Modificar</button>
                      <button style={{ ...buttonStyle }} onClick={()=>onDelete(i)}>Eliminar</button>
                      <button className="insumos-action-wide" style={{ ...buttonStyle }} onClick={()=>openAssign(i)}>Asignar a productor</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      <div className="insumos-section-title" style={{ marginTop: 28, color:'#14532d', fontWeight: 900, fontSize: 26, marginBottom: 14 }}>Insumos asignados por productor</div>
      {loadingResumenAsignaciones ? (
        <LoadingState
          compact
          title="Cargando asignaciones..."
          message="Estamos preparando el resumen por productor."
        />
      ) : (
      <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
        <div className="insumos-assignment-summary insumos-assignment-metrics">
          <div className="insumos-metric-chip insumos-metric-chip--productores">
            <span>Productores</span>
            <strong>{resumenAsignaciones.productores}</strong>
          </div>
          <div className="insumos-metric-chip insumos-metric-chip--asignaciones">
            <span>Asignaciones</span>
            <strong>{resumenAsignaciones.asignaciones}</strong>
          </div>
          <div className="insumos-metric-chip insumos-metric-chip--asignado">
            <span>Asignado</span>
            <strong>{resumenAsignaciones.totalAsignado}</strong>
          </div>
          <div className="insumos-metric-chip insumos-metric-chip--entregado">
            <span>Entregado</span>
            <strong>{resumenAsignaciones.totalEntregado}</strong>
          </div>
          <div className="insumos-metric-chip insumos-metric-chip--disponible">
            <span>Disponible</span>
            <strong>{resumenAsignaciones.totalDisponible}</strong>
          </div>
        </div>
        <div className="filters-bar insumos-producer-search" style={{ display: 'flex', gap: 12, backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input-inst"
            placeholder="Buscar por IPT, productor, CUIL, paraje o telefono..."
            value={producerSearchTerm}
            onChange={e => { setProducerSearchTerm(e.target.value); setCurrentPage(1) }}
            style={{ flex: '1 1 320px', margin: 0, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
          />
          {selectedProd ? (
            <button className="btn secondary" onClick={() => { setSelectedProd(''); setProducerSearchTerm('') }} style={{ height: 40, whiteSpace: 'nowrap', borderRadius: 8 }}>
              Cerrar detalle
            </button>
          ) : null}
        </div>
        {selectedProd && (
          <div style={{ marginTop: 20 }}>
            <div className="insumos-assignment-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f0fdf4',
              padding: '12px 20px', 
              borderRadius: '12px 12px 0 0',
              border: '1px solid #dcfce7',
              borderBottom: 'none'
            }}>
              <span className="insumos-assignment-title" style={{ color: '#166534', fontWeight: 600 }}>
                Asignaciones para: {productoresConInsumos.find(p => String(p.ipt || '') === String(selectedProd || ''))?.productorNombre || productores.find(p => String(p.ipt || '') === String(selectedProd || ''))?.nombreCompleto || 'Productor'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="insumos-assignment-ipt" style={{ fontSize: 12, color: '#166534', opacity: 0.8 }}>
                  IPT: {selectedProd || '-'}
                </span>
                <button
                  onClick={refreshAsignacionesProductor}
                  disabled={loadingAsign}
                  title="Recargar insumos del productor"
                  style={{ fontSize: 18, fontWeight: 800, color: '#166534', background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: 8, width: 34, height: 30, cursor: loadingAsign ? 'default' : 'pointer', lineHeight: 1 }}
                >
                  {loadingAsign ? '...' : '↻'}
                </button>
                <button
                  onClick={onEliminarAsignaciones}
                  className="insumos-delete-assignments"
                  style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                >
                  Eliminar todas las asignaciones
                </button>
              </div>
            </div>

            <div className="insumos-assignment-summary" style={{
              border: '1px solid #e2e8f0',
              borderTop: 'none',
              padding: '10px 20px',
              background: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap'
            }}>
              <div className="insumos-summary-item" style={{ color: '#334155', fontWeight: 600, fontSize: 13 }}>
                Asignado: <span style={{ color: '#0f172a' }}>{resumenProd.asignado}</span>
              </div>
              <div className="insumos-summary-item" style={{ color: '#334155', fontWeight: 600, fontSize: 13 }}>
                Entregado: <span style={{ color: '#0f172a' }}>{resumenProd.entregado}</span>
              </div>
              <div className="insumos-summary-item" style={{ color: '#334155', fontWeight: 600, fontSize: 13 }}>
                Disponible: <span style={{ color: resumenProd.tieneDisponible ? '#166534' : '#b91c1c' }}>{resumenProd.disponible}</span>
              </div>
              {!resumenProd.tieneDisponible && (
                <div className="insumos-empty-pill" style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 12
                }}>
                  Sin insumos disponibles
                </div>
              )}
            </div>

            <div className="table-wrap insumos-assignment-table-wrap" style={{
              border: '1px solid #e2e8f0',
              borderRadius: '0 0 12px 12px',
              backgroundColor: '#fff',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}>
              {loadingAsign ? (
                <LoadingState
                  compact
                  title="Cargando asignaciones..."
                  message="Estamos preparando los insumos del productor."
                />
              ) : asignacionesProd.length === 0 ? (
                <div className="insumos-empty-state" style={{
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
                <table className="table-inst" style={{ width:'100%', minWidth: 700, borderCollapse:'collapse', margin: 0 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Insumo</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Asignado</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Entregado</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Disponible</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', minWidth: 200 }}>Descripción</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', minWidth: 280 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asignacionesProd.map(a=> {
                      const ins = items.find(i=> i.id === a.insumoId) || {}
                      const nombreInsumo = ins.nombre || insumoNames[a.insumoId] || ''
                      const unidadIns = ins.unidad || 'bolsas'
                      const asignado = Number(a?.cantidadAsignada ?? 0)
                      const entregado = Number(a?.cantidadEntregada ?? (String(a?.estado || '').toLowerCase() === 'entregado' ? asignado : 0))
                      const disponible = Math.max(0, asignado - entregado)
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
                              {asignado} {unidadIns}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{
                              backgroundColor: '#f1f5f9',
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontWeight: 600,
                              color: '#475569'
                            }}>
                              {entregado} {unidadIns}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{
                              backgroundColor: disponible > 0 ? '#f0fdf4' : '#fef2f2',
                              border: `1px solid ${disponible > 0 ? '#dcfce7' : '#fecaca'}`,
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontWeight: 700,
                              color: disponible > 0 ? '#166534' : '#991b1b'
                            }}>
                              {disponible} {unidadIns}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 13 }}>{a.descripcion || '-'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button className="btn-icon" title="Aumentar" onClick={()=>onQuickAdjust(a, +1)} style={{ ...miniBtnStyle }}>+1</button>
                              <button className="btn-icon" title="Disminuir" onClick={()=>onQuickAdjust(a, -1)} style={{ ...miniBtnStyle }}>-1</button>
                              <button className="btn-compact" onClick={()=>setModal({ type:'assign-edit', asign: a })} style={{ ...actionBtnStyle }}>Cantidad</button>
                              <button className="btn-compact" onClick={()=>handleOpenDeliveryModal(a)} style={{ ...actionBtnStyle, backgroundColor: '#3b82f6', color: 'white' }}>Entrega</button>
                              <button className="btn-compact" onClick={()=>setModal({ type:'assign-desc', asign: a })} style={{ ...actionBtnStyle }}>Nota</button>
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
        <div className="table-wrap insumos-assignment-table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: 12, backgroundColor: '#fff', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="table-inst" style={{ width:'100%', minWidth: 980, borderCollapse:'collapse', margin: 0 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Productor</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>IPT</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Paraje</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Asignado</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Entregado</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Disponible</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Asignaciones</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducers.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 18, textAlign: 'center', color: '#64748b' }}>No hay productores con insumos para mostrar.</td></tr>
              ) : paginatedProducers.map(p => {
                const isSelected = String(selectedProd || '') === String(p.ipt || '')
                return (
                  <tr key={p.ipt} className={isSelected ? 'is-selected' : ''} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>{p.productorNombre || 'Sin nombre'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>{p.ipt}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>{p.paraje || '-'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>{p.totalAsignado}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>{p.totalEntregado}</td>
                    <td className={Number(p.totalDisponible || 0) > 0 ? 'insumos-available-cell' : 'insumos-muted-cell'} style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800 }}>{p.totalDisponible}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>{p.asignaciones}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button className="btn-compact" onClick={() => selectProducer(p)} style={{ ...actionBtnStyle }}>
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {pageCount > 1 && (
            <div style={{ marginTop: 12, padding: '0 14px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ color: '#475569', fontSize: 14 }}>
                Mostrando {paginatedProducers.length} de {filteredProducers.length} productores
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn secondary"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  style={{ minWidth: 90, borderRadius: 8 }}
                >
                  Anterior
                </button>
                <span style={{ color: '#334155', fontWeight: 600 }}>{currentPage} / {pageCount}</span>
                <button
                  className="btn secondary"
                  onClick={() => setCurrentPage(prev => Math.min(pageCount, prev + 1))}
                  disabled={currentPage >= pageCount}
                  style={{ minWidth: 90, borderRadius: 8 }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
        </>
      )}
      <div className="filters-bar insumos-producer-search" style={{
        display: 'none',
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
            <div className="insumos-producer-results" style={{
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
                  className="insumos-producer-result"
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
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = document.body.classList.contains('dark-mode') ? '#1c2940' : '#f1f5f9'}
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
          <>
            <button
              className="btn secondary"
              onClick={refreshAsignacionesProductor}
              disabled={loadingAsign}
              title="Recargar insumos del productor"
              style={{ height: 40, minWidth: 44, whiteSpace: 'nowrap', borderRadius: 8, fontSize: 18, padding: '0 12px' }}
            >
              {loadingAsign ? '...' : '↻'}
            </button>
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
          </>
        )}
      </div>

      {modal && (
        <div className="insumos-modal-backdrop" onMouseDown={(e)=>{ if (e.target === e.currentTarget) setModal(null) }}>
          <div className="insumos-modal" role="dialog" aria-modal="true">
            {modal.type==='add' && (
              <div>
                <h3 style={{ marginTop:0 }}>Agregar insumo</h3>
                <input className="input-inst" placeholder="Nombre del insumo" value={form.nombre} onChange={e=>setForm({ ...form, nombre:e.target.value })} />
                <select className="select-inst" value={form.rubro} onChange={e=>setForm({ ...form, rubro:e.target.value })}>
                  {RUBROS_INSUMOS.map(n=> <option key={n} value={n}>{n}</option>)}
                </select>
                <input className="input-inst" placeholder="Unidad de medida" value={form.unidad} onChange={e=>setForm({ ...form, unidad:e.target.value })} />
                <textarea className="input-inst" placeholder="Descripción" value={form.descripcion} onChange={e=>setForm({ ...form, descripcion:e.target.value })} />
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
                <input className="input-inst" placeholder="Nombre del insumo" value={form.nombre} onChange={e=>setForm({ ...form, nombre:e.target.value })} />
                <select className="select-inst" value={form.rubro} onChange={e=>setForm({ ...form, rubro:e.target.value })}>
                  {RUBROS_INSUMOS.map(n=> <option key={n} value={n}>{n}</option>)}
                </select>
                <input className="input-inst" placeholder="Unidad de medida" value={form.unidad} onChange={e=>setForm({ ...form, unidad:e.target.value })} />
                <textarea className="input-inst" placeholder="Descripción" value={form.descripcion} onChange={e=>setForm({ ...form, descripcion:e.target.value })} />
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
                  <select className="select-inst" value={asignar.productorId} onChange={e=>{ setAsignar({ ...asignar, productorId:e.target.value }); setAssignError('') }}>
                    <option value="">Seleccione productor</option>
                    {productores.filter(p=> iptSearch ? String(p.ipt||'').includes(String(iptSearch)) : true).map(p=> (
                      <option key={p.id} value={p.ipt || ''}>{p.nombreCompleto || p.ipt || p.id} {p.ipt ? `· ${p.ipt}`:''}</option>
                    ))}
                  </select>
                </div>
                <input className="input-inst" placeholder={`Cantidad a asignar (${modal?.insumo?.unidad || 'bolsas'})`} value={asignar.cantidadAsignada} onChange={e=>{ setAsignar({ ...asignar, cantidadAsignada:e.target.value }); setAssignError('') }} />
                {assignError ? (
                  <div style={{ marginTop: 6, color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>
                    {assignError}
                  </div>
                ) : null}
                <div className="form-actions" style={{ marginTop:8 }}>
                  <button style={{ ...buttonStyle, marginRight:8 }} onClick={()=>setModal(null)}>Cancelar</button>
                  <button style={buttonStyle} onClick={onSubmitAssign}>Asignar</button>
                </div>
              </div>
            )}
            {modal.type==='assign-edit' && (
              <div>
                <h3 style={{ marginTop:0 }}>Modificar cantidad</h3>
                <div style={{ marginBottom: 8 }}>Cantidad actual: {modal.asign.cantidadAsignada ?? 0} {items.find(i=>i.id===modal.asign.insumoId)?.unidad || 'bolsas'}</div>
                <input className="input-inst" placeholder={`Nueva cantidad (${items.find(i=>i.id===modal.asign.insumoId)?.unidad || 'bolsas'})`} value={modal.asign.cantidadAsignadaEdit ?? ''} onChange={e=>setModal(m=>({ ...m, asign: { ...m.asign, cantidadAsignadaEdit: e.target.value } }))} />
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

      {/* Confirmación para registrar entregas parciales */}
      <ConfirmDialog
        isOpen={deliveryConfirmDialog.isOpen}
        title="Registrar entrega de insumo"
        message={
          deliveryConfirmDialog.asignacion ? (
            <>
              <p style={{ marginTop: 0 }}>
                <strong>Insumo:</strong> {insumoNames[deliveryConfirmDialog.asignacion.insumoId] || 'N/A'}
              </p>
              <p>
                <strong>Cantidad asignada:</strong> {deliveryConfirmDialog.asignacion.cantidadAsignada || 0}
              </p>
              <p>
                <strong>Cantidad actual entregada:</strong> {deliveryConfirmDialog.asignacion.cantidadEntregada || 0}
              </p>
              <div className="confirm-dialog-info-card">
                <label className="confirm-dialog-info-label">
                  Ingresa cantidad a registrar como entregada:
                </label>
                <input 
                  type="number" 
                  min="0" 
                  max={deliveryConfirmDialog.asignacion.cantidadAsignada || 0}
                  value={deliveryConfirmDialog.asignacion.cantidadEntregadaEdit || 0}
                  onChange={(e) => setDeliveryConfirmDialog(prev => ({
                    ...prev,
                    asignacion: {
                      ...prev.asignacion,
                      cantidadEntregadaEdit: e.target.value
                    }
                  }))}
                  className="input-inst"
                  style={{ width: '100%' }}
                  placeholder="0"
                />
              </div>
            </>
          ) : null
        }
        confirmText="Confirmar entrega"
        cancelText="Cancelar"
        isDangerous={false}
        isLoading={false}
        onConfirm={handleConfirmDelivery}
        onCancel={handleCancelDelivery}
      />
    </div>
  )
}

export default InsumosList
