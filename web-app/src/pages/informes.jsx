import React, { useState, useEffect } from "react";
import { resumenGeneral, productoresActivos, insumosResumen, turnosEficiencia } from "../services/informes.service";
import HomeButton from "../components/HomeButton";
import { confirmDialog } from "../utils/alerts";
import { loadGoogleMaps } from "../utils/loadGoogleMaps";
import MapPolygon from "../components/MapPolygon";

const Informes = () => {
  const [tipo, setTipo] = useState("resumen");
  const [data, setData] = useState(null);
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
      const map = new window.google.maps.Map(el, { center, zoom: 15, mapTypeId: 'roadmap' });
      new window.google.maps.Marker({ position: center, map, title: mapView.title || 'Ubicación' });
    })();
  }, [mapView]);

  const generar = async () => {
    setLoading(true); setMessage("");
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
    const ok = await confirmDialog({ title: '¿Exportar a PDF?', text: 'Se generará el informe actual en formato PDF.', icon: 'warning', confirmButtonText: 'Exportar', cancelButtonText: 'Cancelar' });
    if (!ok) return;
    const title = `Informe - ${tipo}`;

    const tbl = (columns, rows) => {
      const thead = `<thead><tr>${columns.map(c=>`<th>${c}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${formatValue(v)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return `<table class="tbl">${thead}${tbody}</table>`;
    };

    let content = '';
    if (tipo === 'resumen' && data && typeof data === 'object') {
      content += `<section><h2>Resumen</h2>${tbl(['Usuarios','Productores activos','Lotes activos','Turnos activos'], [[data.totalUsuarios, data.totalProductoresActivos, data.totalLotesActivos, data.totalTurnosActivos]])}<div class="small">Última actualización: ${formatValue(data.ultimaActualizacion)}</div></section>`;
      const usuarios = Array.isArray(data.usuarios)? data.usuarios: [];
      content += `<section><h3>Usuarios del sistema</h3>${tbl(['Nombre','Email','Rol','IPT'], usuarios.map(u=>[u.nombre, u.email, u.role, u.ipt||'-']))}</section>`;
      const act = Array.isArray(data.actividadMovil)? data.actividadMovil: [];
      content += `<section><h3>Actividad móvil</h3>${tbl(['IPT','Productor','Ingresos','Nuevos lotes','Modificaciones','Turnos'], act.map(a=>[a.productorIpt, a.productorNombre, a.ingresosApp, a.lotesCreados, a.lotesModificados, a.turnosSolicitados]))}</section>`;
      const lotes = Array.isArray(data.lotesConDueno)? data.lotesConDueno: [];
      content += `<section><h3>Lotes con dueño</h3>${tbl(['Lote','IPT','Productor'], lotes.map(l=>[l.nombre, l.ipt, l.productorNombre]))}</section>`;
      const disp = Array.isArray(data.insumosDisponibles)? data.insumosDisponibles: [];
      content += `<section><h3>Insumos disponibles</h3>${tbl(['Tipo','Cantidad','Unidad'], disp.map(i=>[i.nombre, i.cantidadDisponible, i.unidad]))}</section>`;
      const det = Array.isArray(data.insumosAsignadosDetalle)? data.insumosAsignadosDetalle: [];
      content += `<section><h3>Insumos asignados</h3>${tbl(['Tipo','Asignado','IPT','Productor'], det.map(r=>[r.tipo, r.cantidadAsignada, r.productorIpt, r.productorNombre]))}</section>`;
      const trs = Array.isArray(data.turnosLista)? data.turnosLista: [];
      content += `<section><h3>Turnos de productores</h3>${tbl(['IPT','Productor','Fecha','Estado','Tipo','Motivo'], trs.map(t=>[t.productorIpt, t.productorNombre, t.fecha, t.estado, t.tipo, t.motivo]))}</section>`;
    } else if (tipo === 'productores' && Array.isArray(data)) {
      content += `<section><h2>Productores activos</h2>${tbl(['IPT','Nombre','Estado','Lotes','Turnos'], data.map(p=>[p.ipt, p.nombreCompleto||p.nombre, p.estado, p.totalLotes??0, p.totalTurnos??0]))}</section>`;
    } else if (tipo === 'insumosResumen' && data && typeof data === 'object') {
      content += `<section><h2>Insumos: asignación y consumo</h2>${tbl(['Asignado','Entregado','Pendiente'], [[data.totalAsignado, data.totalEntregado, data.totalPendiente]])}</section>`;
      const porInsumo = Object.entries(data.porInsumo||{}).map(([n,m])=>[n, m.asignado||0, m.entregado||0, m.pendiente||0]);
      content += `<section><h3>Por insumo</h3>${tbl(['Insumo','Asignado','Entregado','Pendiente'], porInsumo)}</section>`;
      const porProd = Object.entries(data.porProductor||{}).map(([pid,m])=>[m.productorNombre||pid, m.productorIpt||'', m.asignado||0, m.entregado||0, m.pendiente||0]);
      content += `<section><h3>Por productor</h3>${tbl(['Productor','IPT','Asignado','Entregado','Pendiente'], porProd)}</section>`;
    } else if (tipo === 'turnosEficiencia' && data && typeof data === 'object') {
      const conteoRows = Object.entries(data.conteo||{}).map(([k,v])=>[k, v]);
      const porcRows = Object.entries(data.porcentaje||{}).map(([k,v])=>[k, v+'%']);
      content += `<section><h2>Turnos: eficiencia y cumplimiento</h2>${tbl(['Estado','Cantidad'], conteoRows)}${tbl(['Estado','%'], porcRows)}</section>`;
    } else {
      const rows = Array.isArray(data)? data: [data];
      content += rows.map(r=>`<section>${tbl(Object.keys(r||{}), [Object.values(r||{})])}</section>`).join('');
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body{ font-family: Arial, sans-serif; padding:16px; }
        h1{ margin-top:0; }
        h2{ margin:12px 0 6px; color:#14532d; }
        h3{ margin:10px 0 6px; color:#166534; }
        .tbl{ width:100%; border-collapse:collapse; margin-bottom:10px; }
        .tbl th{ background:#f0fdf4; border:1px solid #e5e7eb; padding:6px; text-align:center; }
        .tbl td{ border:1px solid #e5e7eb; padding:6px; text-align:center; }
        .small{ font-size:12px; color:#555; margin-bottom:8px; }
        section{ page-break-inside:auto; }
      </style>
    </head><body><h1>${title}</h1>${content}</body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.focus(); win.print(); }
  };

  const toCsv = (val) => {
    if (Array.isArray(val)) {
      const rows = [];
      let headers = [];
      val.forEach((item) => {
        if (item && typeof item === 'object') {
          const keys = Object.keys(item);
          headers = Array.from(new Set([...headers, ...keys]));
        }
      });
      rows.push(headers.join(','));
      val.forEach((item) => {
        if (item && typeof item === 'object') {
          rows.push(headers.map((h) => JSON.stringify(formatValue(item[h] ?? ''))).join(','));
        } else {
          rows.push(JSON.stringify(formatValue(item ?? '')));
        }
      });
      return rows.join('\n');
    }
    if (val && typeof val === 'object') {
      const rows = Object.entries(val).map(([k, v]) => `${JSON.stringify(k)},${JSON.stringify(formatValue(v))}`);
      return ['clave,valor', ...rows].join('\n');
    }
    return `valor\n${JSON.stringify(formatValue(val ?? ''))}`;
  };

  const expExcel = async () => {
    if (!data) { setMessage("No hay datos para exportar"); return; }
    const ok = await confirmDialog({ title: '¿Exportar a Excel?', text: 'Se generará el informe actual en CSV (Excel).', icon: 'warning', confirmButtonText: 'Exportar', cancelButtonText: 'Cancelar' });
    if (!ok) return;
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe-${tipo}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage('Archivo CSV generado');
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
    if (!data) return <div className="users-msg err">Sin datos</div>;
    if (tipo === 'resumen') return renderResumen(data);
    if (tipo === 'productores') return renderProductores(data);
    if (tipo === 'insumosResumen') return renderInsumosResumen(data);
    if (tipo === 'turnosEficiencia') return renderTurnosEficiencia(data);
    if (Array.isArray(data)) return renderArray(data);
    return renderKV(data);
  };

  return (
    <div className="section-card informes page-container">
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <h2 className="users-title">Informes</h2>
      <div className="inf-controls">
        <select className="select-inst select-lg" value={tipo} onChange={e=>setTipo(e.target.value)}>
          <option value="resumen">Resumen general</option>
          <option value="productores">Productores activos</option>
          <option value="insumosResumen">Insumos: asignación y consumo</option>
          <option value="turnosEficiencia">Turnos: eficiencia y cumplimiento</option>
        </select>
        <div style={{ display:'flex', alignItems:'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#14532d', marginBottom: 4 }}>Fecha inicio</div>
            <input className="input-inst" type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#14532d', marginBottom: 4 }}>Fecha fin</div>
            <input className="input-inst" type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} />
          </div>
        </div>
        <div className="inf-actions">
          <button className="btn" onClick={generar}>{loading? 'Generando…' : 'Generar'}</button>
          <button className="btn" onClick={expPdf}>Exportar PDF</button>
          <button className="btn" onClick={expExcel}>Exportar Excel</button>
        </div>
      </div>
      {message && <div className="users-msg ok" style={{ marginBottom: 10 }}>{message}</div>}
      {renderData()}
      {mapView && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={()=>setMapView(null)}>
          <div style={{ width:'86%', maxWidth:900, background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:12, boxShadow:'0 12px 30px rgba(16,24,32,0.20)' }} onClick={(e)=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontWeight:700, color:'#14532d' }}>{mapView.title || 'Ubicación'}</div>
              <button className="btn" onClick={()=>setMapView(null)}>Cerrar</button>
            </div>
            {Array.isArray(mapView?.polygon) && mapView.polygon.length>=3 ? (
              <MapPolygon points={mapView.polygon} />
            ) : (
              <div id="inf-map-container" style={{ width:'100%', height:420, borderRadius:12 }} />
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
