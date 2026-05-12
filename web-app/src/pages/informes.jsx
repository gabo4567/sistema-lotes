import React, { useState, useEffect } from "react";
import { resumenGeneral, productoresActivos, insumosResumen, turnosEficiencia } from "../services/informes.service";
import HomeButton from "../components/HomeButton";
import { confirmDialog } from "../utils/alerts";
import { loadGoogleMaps } from "../utils/loadGoogleMaps";
import MapPolygon from "../components/MapPolygon";

const Informes = () => {
  const [tipo, setTipo] = useState("resumen");
  const [data, setData] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [mapView, setMapView] = useState(null);
  const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!mapView || mapView?.polygon) return; // el render de polígono usa componente
    (async () => {
      await loadGoogleMaps(GMAPS_KEY);
      const el = document.getElementById('inf-map-container');
      if (!el || !window.google || !window.google.maps) return;
      const center = { lat: Number(mapView.lat), lng: Number(mapView.lng) };
      const map = new window.google.maps.Map(el, { center, zoom: 15, mapTypeId: 'roadmap', streetViewControl: false });
      new window.google.maps.Marker({ position: center, map, title: mapView.title || 'Ubicación' });
    })();
  }, [mapView]);

  const generar = async () => {
    setLoading(true); setMessage("");
    setHasGenerated(true);
    try {
      let d;
      const params = {};
      if (fechaInicio) params.fechaInicio = fechaInicio;
      if (fechaFin) params.fechaFin = fechaFin;
      if (tipo === "resumen") d = await resumenGeneral(params);
      else if (tipo === "productores") d = await productoresActivos(params);
      else if (tipo === "insumosResumen") d = await insumosResumen(params);
      else if (tipo === "turnosEficiencia") d = await turnosEficiencia(params);
      setData(d);
    } finally { setLoading(false); }
  };

  const expPdf = async () => {
    if (!data) { setMessage("No hay datos para exportar"); return; }
    const ok = await confirmDialog({ 
      title: '¿Generar Documento PDF?', 
      text: 'Se preparará el informe actual para impresión o guardado como PDF.', 
      icon: 'info', 
      confirmButtonText: 'Generar', 
      cancelButtonText: 'Cancelar' 
    });
    if (!ok) return;

    const fechaStr = new Date().toLocaleString();
    const title = `Informe - ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`;

    const tbl = (columns, rows) => {
      const thead = `<thead><tr>${columns.map(c=>`<th>${c}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${formatValue(v)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return `<table class="tbl">${thead}${tbody}</table>`;
    };

    let content = '';
    // ... (logic for content generation remains same but we can clean up headers)
    if (tipo === 'resumen' && data && typeof data === 'object') {
      content += `<div class="doc-section"><h2>1. Resumen General</h2>${tbl(['Usuarios','Productores activos','Lotes activos','Turnos activos'], [[data.totalUsuarios, data.totalProductoresActivos, data.totalLotesActivos, data.totalTurnosActivos]])}<p class="timestamp">Última actualización: ${formatValue(data.ultimaActualizacion)}</p></div>`;
      const usuarios = Array.isArray(data.usuarios)? data.usuarios: [];
      content += `<div class="doc-section"><h3>1.1 Usuarios del sistema</h3>${tbl(['Nombre','Email','Rol','IPT'], usuarios.map(u=>[u.nombre, u.email, u.role, u.ipt||'-']))}</div>`;
      const act = Array.isArray(data.actividadMovil)? data.actividadMovil: [];
      content += `<div class="doc-section"><h3>1.2 Actividad móvil</h3>${tbl(['IPT','Productor','Ingresos','Nuevos lotes','Modificaciones','Turnos'], act.map(a=>[a.productorIpt, a.productorNombre, a.ingresosApp, a.lotesCreados, a.lotesModificados, a.turnosSolicitados]))}</div>`;
      const lotes = Array.isArray(data.lotesConDueno)? data.lotesConDueno: [];
      content += `<div class="doc-section"><h3>1.3 Lotes registrados</h3>${tbl(['Lote','IPT','Productor'], lotes.map(l=>[l.nombre, l.ipt, l.productorNombre]))}</div>`;
    } else if (tipo === 'productores' && Array.isArray(data)) {
      content += `<div class="doc-section"><h2>Listado de Productores Activos</h2>${tbl(['IPT','Nombre','Estado','Lotes','Turnos'], data.map(p=>[p.ipt, p.nombreCompleto||p.nombre, p.estado, p.totalLotes??0, p.totalTurnos??0]))}</div>`;
    } else if (tipo === 'insumosResumen' && data && typeof data === 'object') {
      content += `<div class="doc-section"><h2>Insumos: Resumen de Asignación</h2>${tbl(['Asignado','Entregado','Pendiente'], [[data.totalAsignado, data.totalEntregado, data.totalPendiente]])}</div>`;
      const porInsumo = Object.entries(data.porInsumo||{}).map(([n,m])=>[n, m.asignado||0, m.entregado||0, m.pendiente||0]);
      content += `<div class="doc-section"><h3>Detalle por Insumo</h3>${tbl(['Insumo','Asignado','Entregado','Pendiente'], porInsumo)}</div>`;
    } else if (tipo === 'turnosEficiencia' && data && typeof data === 'object') {
      const conteoRows = Object.entries(data.conteo||{}).map(([k,v])=>[k, v]);
      content += `<div class="doc-section"><h2>Turnos: Eficiencia y Cumplimiento</h2>${tbl(['Estado','Cantidad'], conteoRows)}</div>`;
    }

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page { size: A4; margin: 2cm; }
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 0; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a4d2e; padding-bottom: 15px; margin-bottom: 30px; }
        .header-info h1 { margin: 0; color: #1a4d2e; font-size: 24px; text-transform: uppercase; }
        .header-info p { margin: 5px 0 0; color: #64748b; font-size: 14px; }
        .doc-section { margin-bottom: 30px; page-break-inside: avoid; }
        h2 { color: #1a4d2e; font-size: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
        h3 { color: #334155; font-size: 17px; margin: 20px 0 10px; }
        .tbl { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
        .tbl th { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 8px; text-align: left; color: #475569; font-weight: 700; }
        .tbl td { border: 1px solid #e2e8f0; padding: 8px; color: #1e293b; }
        .tbl tr:nth-child(even) { background-color: #fcfcfc; }
        .timestamp { font-size: 11px; color: #94a3b8; text-align: right; margin-top: 5px; }
        .footer { position: fixed; bottom: 0; width: 100%; font-size: 10px; color: #94a3b8; text-align: center; padding: 10px 0; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-info">
          <h1>Sistema de Gestión Agrícola - IPT</h1>
          <p>${title}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin:0; font-weight:700;">Fecha de Emisión</p>
          <p style="margin:0; color:#64748b;">${fechaStr}</p>
        </div>
      </div>
      ${content}
      <div class="footer">
        Documento generado automáticamente por el Sistema IPT - Página 1
      </div>
    </body>
    </html>`;
    
    const win = window.open('', '_blank');
    if (win) { 
      win.document.write(html); 
      win.document.close(); 
      setTimeout(() => { win.focus(); win.print(); }, 500);
    }
  };

  const expExcel = async () => {
    if (!data) { setMessage("No hay datos para exportar"); return; }
    const ok = await confirmDialog({ 
      title: '¿Exportar a Excel?', 
      text: 'Se generará un archivo de Excel profesional con los datos actuales.', 
      icon: 'question', 
      confirmButtonText: 'Exportar', 
      cancelButtonText: 'Cancelar' 
    });
    if (!ok) return;

    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      
      const addToSheet = (sheetName, jsonData) => {
        const worksheet = XLSX.utils.json_to_sheet(jsonData);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      };

      if (tipo === 'resumen') {
        addToSheet("Resumen", [{
          "Total Usuarios": data.totalUsuarios,
          "Productores Activos": data.totalProductoresActivos,
          "Lotes Activos": data.totalLotesActivos,
          "Turnos Activos": data.totalTurnosActivos,
          "Última Actualización": formatValue(data.ultimaActualizacion)
        }]);
        if (data.usuarios) addToSheet("Usuarios", data.usuarios.map(u => ({ Nombre: u.nombre, Email: u.email, Rol: u.role, IPT: u.ipt || '-' })));
        if (data.actividadMovil) addToSheet("Actividad Móvil", data.actividadMovil);
        if (data.lotesConDueno) addToSheet("Lotes", data.lotesConDueno);
      } else if (tipo === 'productores') {
        addToSheet("Productores", data.map(p => ({ IPT: p.ipt, Nombre: p.nombreCompleto || p.nombre, Estado: p.estado, Lotes: p.totalLotes ?? 0, Turnos: p.totalTurnos ?? 0 })));
      } else if (tipo === 'insumosResumen') {
        addToSheet("Insumos Total", [{ Asignado: data.totalAsignado, Entregado: data.totalEntregado, Pendiente: data.totalPendiente }]);
        addToSheet("Por Insumo", Object.entries(data.porInsumo || {}).map(([n, m]) => ({ Insumo: n, ...m })));
      } else if (tipo === 'turnosEficiencia') {
        addToSheet("Turnos Conteo", [data.conteo || {}]);
        addToSheet("Turnos Porcentaje", [data.porcentaje || {}]);
      } else {
        const rows = Array.isArray(data) ? data : [data];
        addToSheet("Datos", rows);
      }

      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Informe_IPT_${tipo}_${timestamp}.xlsx`);
      setMessage('Archivo Excel generado exitosamente');
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      setMessage("Error al generar el archivo Excel");
    }
  };

  const renderKV = (obj) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj);
    return (
      <div className="result-grid">
        {entries.map(([k, v]) => (
          <div key={k} className="result-card">
            <div className="result-row"><span className="result-label">{k}:</span> {formatValue(v)}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderArray = (arr) => {
    if (!Array.isArray(arr)) return null;
    return (
      <div className="result-grid">
        {arr.map((item, idx) => (
          <div key={idx} className="result-card">
            {typeof item === 'object' && item !== null ? (
              Object.entries(item).map(([k, v]) => (
                <div key={k} className="result-row"><span className="result-label">{k}:</span> {formatValue(v)}</div>
              ))
            ) : (
              <div className="result-row">{formatValue(item)}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const badge = (text, tone = 'ok') => {
    const colors = {
      ok: { bg: '#dcfce7', fg: '#166534', bd: '#22c55e' },
      info: { bg: '#e0f2fe', fg: '#0c4a6e', bd: '#38bdf8' },
      warn: { bg: '#fff7ed', fg: '#7c2d12', bd: '#f59e0b' },
      err: { bg: '#fee2e2', fg: '#7f1d1d', bd: '#ef4444' },
    }[tone] || { bg: '#eef2ff', fg: '#1e3a8a', bd: '#93c5fd' };
    return (
      <span style={{ background: colors.bg, color: colors.fg, border: `1px solid ${colors.bd}`, borderRadius: 999, padding: '6px 12px', fontSize: 14, lineHeight: 1 }}>{text}</span>
    );
  };

  const card = (title, children) => (
    <div className="result-card" style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}>
      <div style={{ fontWeight: 600, color: '#14532d', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );

  const renderResumen = (d) => {
    if (!d || typeof d !== 'object') return renderKV(d);
    const tiles = [
      { k: 'totalUsuarios', label: 'Usuarios' },
      { k: 'totalProductoresActivos', label: 'Productores activos' },
      { k: 'totalLotesActivos', label: 'Lotes activos' },
      { k: 'totalTurnosActivos', label: 'Turnos activos' },
    ];
    return (
      <div className="result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          {tiles.map(t => (
            <div key={t.k} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 12 }}>
              <div style={{ color: '#14532d', fontSize: 13 }}>{t.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#166534' }}>{formatValue(d[t.k])}</div>
            </div>
          ))}
          {card('Última actualización', <div>{formatValue(d.ultimaActualizacion)}</div>)}
        </div>

        {card('Usuarios del sistema', (
          <div style={{ overflowX:'auto' }}>
            <table className="table-inst" style={{ width:'100%', tableLayout:'fixed', minWidth: 600 }}>
              <thead>
                <tr style={{ background:'#f0fdf4' }}>
                  <th>Nombre</th><th>Email</th><th>Rol</th><th>IPT</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(d.usuarios)? d.usuarios : []).map(u => (
                  <tr key={u.id}>
                    <td style={{ width:'28%' }}>{formatValue(u.nombre)}</td>
                    <td style={{ width:'36%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{formatValue(u.email)}</td>
                    <td style={{ width:'20%' }}>{formatValue(u.role)}</td>
                    <td style={{ width:'16%' }}>{formatValue(u.ipt ?? '-')}</td>
                  </tr>
                ))}
                {(!d.usuarios || d.usuarios.length===0) && (<tr><td colSpan={4} style={{ padding:8 }}>Sin datos</td></tr>)}
              </tbody>
            </table>
          </div>
        ))}

        {card('Actividad del productor en la aplicación móvil', (
          <div style={{ overflowX:'auto' }}>
            <table className="table-inst" style={{ width:'100%', tableLayout:'fixed', minWidth: 1040 }}>
              <thead>
                <tr style={{ background:'#f0fdf4' }}>
                  <th style={{ textAlign:'center', width:'12%' }}>IPT</th>
                  <th style={{ textAlign:'left', width:'28%' }}>Productor</th>
                  <th style={{ textAlign:'center', width:'12%' }}>Ingresos a la app</th>
                  <th style={{ textAlign:'center', width:'12%' }}>Nuevos lotes</th>
                  <th style={{ textAlign:'center', width:'12%' }}>Modificaciones de lotes</th>
                  <th style={{ textAlign:'center', width:'12%' }}>Turnos solicitados</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(d.actividadMovil)? d.actividadMovil : []).map((a, idx)=> (
                  <tr key={idx}>
                    <td style={{ textAlign:'center', width:'12%' }}>{formatValue(a.productorIpt)}</td>
                    <td style={{ textAlign:'left', width:'28%', whiteSpace:'normal' }}>{formatValue(a.productorNombre)}</td>
                    <td style={{ textAlign:'center', width:'12%' }}>{formatValue(a.ingresosApp)}</td>
                    <td style={{ textAlign:'center', width:'12%' }}>{formatValue(a.lotesCreados)}</td>
                    <td style={{ textAlign:'center', width:'12%' }}>{formatValue(a.lotesModificados)}</td>
                    <td style={{ textAlign:'center', width:'12%' }}>{formatValue(a.turnosSolicitados)}</td>
                  </tr>
                ))}
                {(!d.actividadMovil || d.actividadMovil.length===0) && (<tr><td colSpan={6} style={{ padding:8, textAlign:'center' }}>Sin datos</td></tr>)}
              </tbody>
            </table>
          </div>
        ))}

        {card('Turnos de productores', (
          <div style={{ overflowX:'auto' }}>
            <table className="table-inst" style={{ width:'100%', tableLayout:'fixed', minWidth: 980 }}>
              <thead>
                <tr style={{ background:'#f0fdf4' }}>
                  <th style={{ textAlign:'center', width:'12%' }}>IPT</th>
                  <th style={{ textAlign:'center', width:'22%' }}>Productor</th>
                  <th style={{ textAlign:'center', width:'16%' }}>Fecha</th>
                  <th style={{ textAlign:'center', width:'14%' }}>Estado</th>
                  <th style={{ textAlign:'center', width:'16%' }}>Tipo</th>
                  <th style={{ textAlign:'center', width:'20%' }}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(d.turnosLista)? d.turnosLista : []).map((t, idx)=> (
                  <tr key={t.id || idx}>
                    <td style={{ textAlign:'center', width:'12%' }}>{formatValue(t.productorIpt)}</td>
                    <td style={{ textAlign:'center', width:'22%', whiteSpace:'normal' }}>{formatValue(t.productorNombre)}</td>
                    <td style={{ textAlign:'center', width:'16%' }}>{formatValue(t.fecha)}</td>
                    <td style={{ textAlign:'center', width:'14%' }}>{formatValue(t.estado)}</td>
                    <td style={{ textAlign:'center', width:'16%' }}>{formatValue(t.tipo)}</td>
                    <td style={{ textAlign:'center', width:'20%' }}>{formatValue(t.motivo)}</td>
                  </tr>
                ))}
                {(!d.turnosLista || d.turnosLista.length===0) && (<tr><td colSpan={6} style={{ padding:8, textAlign:'center' }}>Sin datos</td></tr>)}
              </tbody>
            </table>
          </div>
        ))}

        {card('Lotes con su dueño', (
          <div style={{ overflowX:'auto' }}>
            <table className="table-inst" style={{ width:'100%', tableLayout:'fixed', minWidth: 560 }}>
              <thead>
                <tr style={{ background:'#f0fdf4' }}>
                  <th>Lote</th><th>IPT</th><th>Productor</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(d.lotesConDueno)? d.lotesConDueno : []).map(l => (
                  <tr key={l.id}>
                    <td style={{ width:'40%' }}>{formatValue(l.nombre)}</td>
                    <td style={{ width:'20%' }}>{formatValue(l.ipt)}</td>
                    <td style={{ width:'40%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{formatValue(l.productorNombre || '-')}</td>
                  </tr>
                ))}
                {(!d.lotesConDueno || d.lotesConDueno.length===0) && (<tr><td colSpan={3} style={{ padding:8 }}>Sin datos</td></tr>)}
              </tbody>
            </table>
          </div>
        ))}

        {card('Insumos disponibles por tipo', (
          <div style={{ overflowX:'auto' }}>
            <table className="table-inst" style={{ width:'100%', tableLayout:'fixed', minWidth: 520 }}>
              <thead>
                <tr style={{ background:'#f0fdf4' }}>
                  <th>Tipo</th><th>Cantidad</th><th>Unidad</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(d.insumosDisponibles)? d.insumosDisponibles : []).map(i => (
                  <tr key={i.id}>
                    <td style={{ width:'40%' }}>{formatValue(i.nombre)}</td>
                    <td style={{ width:'30%' }}>{formatValue(i.cantidadDisponible)}</td>
                    <td style={{ width:'30%' }}>{formatValue(i.unidad)}</td>
                  </tr>
                ))}
                {(!d.insumosDisponibles || d.insumosDisponibles.length===0) && (<tr><td colSpan={3} style={{ padding:8 }}>Sin datos</td></tr>)}
              </tbody>
            </table>
          </div>
        ))}

        {card('Insumos asignados a productores', (
          <div style={{ overflowX:'auto' }}>
            <table className="table-inst" style={{ width:'100%', tableLayout:'fixed', minWidth: 640 }}>
              <thead>
                <tr style={{ background:'#f0fdf4' }}>
                  <th>Tipo</th><th>Cantidad asignada</th><th>IPT</th><th>Productor</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(d.insumosAsignadosDetalle)? d.insumosAsignadosDetalle : []).map((r, idx) => (
                  <tr key={idx}>
                    <td style={{ width:'32%' }}>{formatValue(r.tipo)}</td>
                    <td style={{ width:'22%' }}>{formatValue(r.cantidadAsignada)}</td>
                    <td style={{ width:'18%' }}>{formatValue(r.productorIpt)}</td>
                    <td style={{ width:'28%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{formatValue(r.productorNombre)}</td>
                  </tr>
                ))}
                {(!d.insumosAsignadosDetalle || d.insumosAsignadosDetalle.length===0) && (<tr><td colSpan={4} style={{ padding:8 }}>Sin datos</td></tr>)}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  };

  const renderProductores = (arr) => {
    if (!Array.isArray(arr)) return renderArray(arr);
    return (
      <div className="result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        {arr.map((p) => (
          <div key={p.id} className="result-card" style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: '#14532d' }}>
                {p.nombreCompleto || p.nombre || 'Productor'} {p.ipt && <span style={{ color:'#0c4a6e', fontWeight:600 }}>· IPT: {p.ipt}</span>}
              </div>
              {badge(p.estado || 'Activo', (String(p.estado||'').toLowerCase().includes('inac') ? 'warn' : 'ok'))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 8 }}>
              <div>{badge(`Lotes: ${formatValue(p.totalLotes ?? 0)}`, 'info')}</div>
              <div>{badge(`Turnos: ${formatValue(p.totalTurnos ?? 0)}`, 'info')}</div>
              <div>{badge(`Ubicaciones: ${Array.isArray(p.ubicaciones) ? p.ubicaciones.length : 0} de ${Number.isFinite(p.totalCampos) && p.totalCampos > 0 ? p.totalCampos * 4 : 4}`, 'info')}</div>
            </div>
            {p.domicilio && <div style={{ marginBottom: 6 }}><span className="result-label">Domicilio:</span> {formatValue(p.domicilio)}</div>}
            {p.ingreso && <div style={{ marginBottom: 6 }}><span className="result-label">Ingreso:</span> {formatValue(p.ingreso)}</div>}
            {p.corte && <div style={{ marginBottom: 6 }}><span className="result-label">Corte:</span> {formatValue(p.corte)}</div>}
            {p.fechaRegistro && <div style={{ marginBottom: 6 }}><span className="result-label">Fecha de registro:</span> {formatValue(p.fechaRegistro)}</div>}
            {(p.ubicaciones && Array.isArray(p.ubicaciones) && p.ubicaciones.length > 0) && (
              card('Ubicaciones', (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                  {(() => {
                    const items = Array.isArray(p.ubicaciones) ? p.ubicaciones : [];
                    const groups = new Map();
                    for (const u of items) {
                      const gid = u?.campoId != null ? String(u.campoId) : 'principal';
                      const gname = (u?.campoNombre ? String(u.campoNombre) : 'Campo principal').trim() || 'Campo principal';
                      if (!groups.has(gid)) groups.set(gid, { id: gid, nombre: gname, items: [] });
                      groups.get(gid).items.push(u);
                    }
                    const ordered = Array.from(groups.values());

                    return ordered.map((g, gi) => (
                      <div key={g.id} style={{ display:'grid', gridTemplateColumns:'1fr', gap: 8, marginTop: gi === 0 ? 0 : 20 }}>
                        <div style={{ padding: '6px 8px', borderRadius: 8, background: '#ecfdf5', border: '1px dashed #86efac' }}>
                          <div style={{ color:'#14532d', fontWeight: 800 }}>{g.nombre}</div>
                        </div>
                        {g.items.map((u, idx) => (
                          <div key={`${g.id}_${idx}`} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 8 }}>
                            <div style={{ color:'#14532d', fontWeight:600 }}>{u.nombre || 'Ubicación'}</div>
                            {typeof u.lat === 'number' && typeof u.lng === 'number' ? (
                              <button className="btn" style={{ minHeight:32 }} onClick={()=>setMapView({ lat: u.lat, lng: u.lng, title: u.nombre })}>Ver mapa</button>
                            ) : (
                              <span style={{ color:'#7f8c8d' }}>Sin coordenadas</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              ))
            )}

            {Array.isArray(p.lotes) && p.lotes.length > 0 && (
              card('Lista de lotes', (
                <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }}>
                  {p.lotes.map(l => (
                    <div key={l.id} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:12, padding:12 }}>
                      <div className="result-row"><span className="result-label">Nombre:</span> {formatValue(l.nombre)}</div>
                      <div className="result-row"><span className="result-label">Estado:</span> {formatValue(l.estado)}</div>
                      <div className="result-row"><span className="result-label">Superficie:</span> {formatValue(l.superficie)} ha</div>
                      <div className="result-row"><span className="result-label">Método:</span> {formatValue(l.metodo)}</div>
                      <div className="result-row"><span className="result-label">Observaciones (prod):</span> {formatValue(l.observacionesProductor)}</div>
                      <div style={{ marginTop:8 }}>
                        {Array.isArray(l.poligono) && l.poligono.length>=3 ? (
                          <button className="btn" onClick={()=>setMapView({ title:`${l.nombre}`, polygon: l.poligono })}>Ver mapa</button>
                        ) : (
                          <span style={{ color:'#7f8c8d' }}>Sin polígono</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}

            {Array.isArray(p.turnos) && p.turnos.length > 0 && (
              card('Turnos', (
                <div className="table-wrap">
                  <table className="table-inst" style={{ width:'100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign:'center' }}>IPT</th>
                        <th style={{ textAlign:'center' }}>Productor</th>
                        <th style={{ textAlign:'center' }}>Fecha</th>
                        <th style={{ textAlign:'center' }}>Tipo</th>
                        <th style={{ textAlign:'center' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.turnos.map(t => (
                        <tr key={t.id}>
                          <td style={{ textAlign:'center' }}>{formatValue(t.ipt)}</td>
                          <td style={{ textAlign:'center' }}>{formatValue(t.productorNombre)}</td>
                          <td style={{ textAlign:'center' }}>{formatValue(t.fecha)}</td>
                          <td style={{ textAlign:'center' }}>{formatValue(t.tipo)}</td>
                          <td style={{ textAlign:'center' }}>{formatValue(t.estado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderInsumosResumen = (d) => {
    if (!d || typeof d !== 'object') return renderKV(d);
    const headerStyle = { background:'#f0fdf4', color:'#14532d', textAlign:'center' };
    const tableStyle = { width:'100%', borderCollapse:'collapse' };
    return (
      <div className="result-grid" style={{ display:'grid', gap: 18, gridTemplateColumns:'1fr', alignItems:'stretch' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: 16 }}>
          <div style={{ background: '#ecfeff', border: '1px solid #67e8f9', borderRadius: 12, padding: 12 }}>
            <div style={{ color:'#0c4a6e', fontSize: 13 }}>Total asignado</div>
            <div style={{ fontSize: 20, fontWeight: 700, color:'#0c4a6e' }}>{formatValue(d.totalAsignado)}</div>
          </div>
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 12, padding: 12 }}>
            <div style={{ color:'#166534', fontSize: 13 }}>Entregado</div>
            <div style={{ fontSize: 20, fontWeight: 700, color:'#166534' }}>{formatValue(d.totalEntregado)}</div>
          </div>
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 12, padding: 12 }}>
            <div style={{ color:'#7c2d12', fontSize: 13 }}>Pendiente</div>
            <div style={{ fontSize: 20, fontWeight: 700, color:'#7c2d12' }}>{formatValue(d.totalPendiente)}</div>
          </div>
        </div>
        {card('Por insumo', (
          <div style={{ marginTop: 8 }}>
            <table style={{ ...tableStyle, tableLayout:'auto' }}>
              <thead>
                <tr style={headerStyle}>
                <th>Insumo</th><th>Asignado</th><th>Entregado</th><th>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(d.porInsumo || {}).map(([nombre, m]) => (
                  <tr key={nombre}>
                  <td style={{ textAlign:'center' }}>{nombre}</td>
                  <td style={{ textAlign:'center' }}>{formatValue(m.asignado)}</td>
                  <td style={{ textAlign:'center' }}>{formatValue(m.entregado)}</td>
                  <td style={{ textAlign:'center' }}>{formatValue(m.pendiente)}</td>
                  </tr>
                ))}
                {Object.keys(d.porInsumo || {}).length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 8 }}>Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
        {card('Por productor', (
          <div style={{ marginTop: 8 }}>
          <table style={{ ...tableStyle, tableLayout:'auto' }}>
            <thead>
              <tr style={headerStyle}>
                <th>Productor</th><th>IPT</th><th>Asignado</th><th>Entregado</th><th>Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(d.porProductor || {}).map(([pid, m]) => (
                <tr key={pid}>
                  <td style={{ textAlign:'center' }}>{formatValue(m.productorNombre || pid)}</td>
                  <td style={{ textAlign:'center' }}>{formatValue(m.productorIpt || '')}</td>
                  <td style={{ textAlign:'center' }}>{formatValue(m.asignado)}</td>
                  <td style={{ textAlign:'center' }}>{formatValue(m.entregado)}</td>
                  <td style={{ textAlign:'center' }}>{formatValue(m.pendiente)}</td>
                </tr>
              ))}
              {Object.keys(d.porProductor || {}).length === 0 && (
                <tr><td colSpan={5} style={{ padding: 8 }}>Sin datos</td></tr>
              )}
            </tbody>
          </table>
          </div>
        ))}
      </div>
    );
  };

  const renderTurnosEficiencia = (d) => {
    if (!d || typeof d !== 'object') return renderKV(d);
    const entriesC = Object.entries(d.conteo || {});
    const entriesP = Object.entries(d.porcentaje || {});
    return (
      <div className="result-grid" style={{ display:'grid', gap: 12 }}>
        {card('Conteo por estado', (
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap: 8 }}>
            {entriesC.map(([k, v]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, padding:'6px 10px' }}>
                <span style={{ color:'#14532d' }}>{k}</span>
                {badge(formatValue(v), 'info')}
              </div>
            ))}
          </div>
        ))}
        {card('Porcentaje por estado', (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
            {entriesP.map(([k, v]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#ecfeff', border:'1px solid #67e8f9', borderRadius:8, padding:'6px 10px' }}>
                <span style={{ color:'#0c4a6e' }}>{k}</span>
                {badge(`${formatValue(v)}%`, 'info')}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderData = () => {
    if (loading) {
      return (
        <div
          style={{
            marginTop: 8,
            padding: "18px 20px",
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid #d9eadc",
            color: "#2f6f4e",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          Generando informe...
        </div>
      );
    }
    if (!data && !hasGenerated) {
      return (
        <div
          style={{
            marginTop: 8,
            padding: "18px 20px",
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid #d9eadc",
            color: "#2f6f4e",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          Presioná Generar para visualizar el informe seleccionado.
        </div>
      );
    }
    if (!data) return <div className="users-msg err">Sin datos</div>;
    if (tipo === 'resumen') return renderResumen(data);
    if (tipo === 'productores') return renderProductores(data);
    if (tipo === 'insumosResumen') return renderInsumosResumen(data);
    if (tipo === 'turnosEficiencia') return renderTurnosEficiencia(data);
    if (Array.isArray(data)) return renderArray(data);
    return renderKV(data);
  };

  return (
    <div className="informes-container">
      {/* Header de Informes */}
      <div className="informes-header-row">
        <div className="informes-header-left">
          <HomeButton />
          <div className="informes-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <div className="informes-header-titles">
            <h1 className="main-title">Informes y Estadísticas</h1>
            <p className="subtitle">Consultá resúmenes generales, actividad de productores y eficiencia del sistema.</p>
          </div>
        </div>
        <div className="informes-header-actions">
          <button className="btn-informe-action pdf" onClick={expPdf}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Exportar PDF
          </button>
          <button className="btn-informe-action excel" onClick={expExcel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Filtros e Interfaz de Generación */}
      <div className="informes-filters-card">
        <div className="informe-filter-group" style={{ flex: '2' }}>
          <label>Tipo de Informe</label>
          <div className="informe-input-wrapper">
            <select value={tipo} onChange={e=>setTipo(e.target.value)}>
              <option value="resumen">Resumen general</option>
              <option value="productores">Productores activos</option>
              <option value="insumosResumen">Insumos: asignación y consumo</option>
              <option value="turnosEficiencia">Turnos: eficiencia y cumplimiento</option>
            </select>
          </div>
        </div>
        <div className="informe-filter-group">
          <label>Fecha Inicio</label>
          <div className="informe-input-wrapper">
            <input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} />
          </div>
        </div>
        <div className="informe-filter-group">
          <label>Fecha Fin</label>
          <div className="informe-input-wrapper">
            <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} />
          </div>
        </div>
        <button className="btn-clear-filters" onClick={() => { setTipo('resumen'); setFechaInicio(''); setFechaFin(''); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z"></path>
          </svg>
          Limpiar filtros
        </button>
        <button className="btn-informe-action primary" onClick={generar} disabled={loading}>
          {loading ? 'Generando...' : 'Generar Informe'}
        </button>
      </div>

      {message && <div className="alert-box success">{message}</div>}
      
      <div className="results-container">
        {loading ? (
          <div style={{ padding: 60, color: '#1a4d2e', textAlign: 'center', fontSize: '18px', fontWeight: '700' }}>
            Generando informe solicitado...
          </div>
        ) : renderData()}
      </div>

      {mapView && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter: 'blur(4px)' }} onClick={()=>setMapView(null)}>
          <div style={{ width:'90%', maxWidth:1000, background:'#fff', border:'1px solid #e2e8f0', borderRadius:20, padding:24, boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={(e)=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontSize: '20px', fontWeight:800, color:'#1e293b' }}>{mapView.title || 'Ubicación en Mapa'}</div>
              <button className="btn-icon-edit" onClick={()=>setMapView(null)} style={{ padding: 8 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            {Array.isArray(mapView?.polygon) && mapView.polygon.length>=3 ? (
              <MapPolygon points={mapView.polygon} />
            ) : (
              <div id="inf-map-container" style={{ width:'100%', height:500, borderRadius:12 }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Informes;
  const formatValue = (val) => {
    if (val == null) return '-';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(formatValue).join(', ');
    if (val && typeof val === 'object') {
      if (val._seconds != null) return new Date(val._seconds * 1000).toLocaleString();
      if (val.seconds != null) return new Date(val.seconds * 1000).toLocaleString();
      if (val.lat != null && val.lng != null) return `${val.lat}, ${val.lng}`;
      const entries = Object.entries(val);
      return entries.map(([k, v]) => `${k}: ${formatValue(v)}`).join(', ');
    }
    return String(val);
  };
