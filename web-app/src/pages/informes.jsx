import React, { useState } from "react";
import { resumenGeneral, productoresActivos, insumosResumen, turnosEficiencia, exportarPdf, exportarExcel } from "../services/informes.service";
import HomeButton from "../components/HomeButton";

const Informes = () => {
  const [tipo, setTipo] = useState("resumen");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

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

  const expPdf = () => {
    if (!data) { setMessage("No hay datos para exportar"); return; }
    const title = `Informe - ${tipo}`;
    const htmlRows = Array.isArray(data)
      ? data.map((item) => {
          if (item && typeof item === 'object') {
            return `<div style="margin:6px 0; padding:8px; border:1px solid #ccc; border-radius:8px;">${Object.entries(item)
              .map(([k, v]) => `<div><strong>${k}:</strong> ${formatValue(v)}</div>`)
              .join('')}</div>`;
          }
          return `<div style="margin:6px 0; padding:8px; border:1px solid #ccc; border-radius:8px;">${formatValue(item)}</div>`;
        }).join('')
      : `<div style="margin:6px 0; padding:8px; border:1px solid #ccc; border-radius:8px;">${Object.entries(data)
          .map(([k, v]) => `<div><strong>${k}:</strong> ${formatValue(v)}</div>`)
          .join('')}</div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style> body{ font-family: Arial, sans-serif; padding:16px; } h1{ margin-top:0; } </style>
    </head><body><h1>${title}</h1>${htmlRows}</body></html>`;
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

  const expExcel = () => {
    if (!data) { setMessage("No hay datos para exportar"); return; }
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
      <span style={{ background: colors.bg, color: colors.fg, border: `1px solid ${colors.bd}`, borderRadius: 999, padding: '4px 8px', fontSize: 12 }}>{text}</span>
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
      { k: 'totalMedicionesRegistradas', label: 'Mediciones' },
    ];
    return (
      <div className="result-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {tiles.map(t => (
          <div key={t.k} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 12 }}>
            <div style={{ color: '#14532d', fontSize: 13 }}>{t.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#166534' }}>{formatValue(d[t.k])}</div>
          </div>
        ))}
        {card('Última actualización', <div>{formatValue(d.ultimaActualizacion)}</div>)}
      </div>
    );
  };

  const renderProductores = (arr) => {
    if (!Array.isArray(arr)) return renderArray(arr);
    return (
      <div className="result-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
        {arr.map((p) => (
          <div key={p.id} className="result-card" style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: '#14532d' }}>{p.nombreCompleto || p.ipt || p.id}</div>
              {badge(p.estado || 'Activo', (String(p.estado||'').toLowerCase().includes('inac') ? 'warn' : 'ok'))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>{badge(`Lotes: ${formatValue(p.totalLotes ?? 0)}`, 'info')}</div>
              <div>{badge(`Órdenes: ${formatValue(p.totalOrdenes ?? 0)}`, 'info')}</div>
              <div>{badge(`Turnos: ${formatValue(p.totalTurnos ?? 0)}`, 'info')}</div>
            </div>
            {p.domicilio && <div style={{ marginBottom: 6 }}><span className="result-label">Domicilio:</span> {formatValue(p.domicilio)}</div>}
            {p.ingreso && <div style={{ marginBottom: 6 }}><span className="result-label">Ingreso:</span> {formatValue(p.ingreso)}</div>}
            {p.corte && <div style={{ marginBottom: 6 }}><span className="result-label">Corte:</span> {formatValue(p.corte)}</div>}
            {p.fechaRegistro && <div style={{ marginBottom: 6 }}><span className="result-label">Fecha de registro:</span> {formatValue(p.fechaRegistro)}</div>}
            {(p.ubicaciones || p.ubicacion) && (
              card('Ubicaciones', (
                Array.isArray(p.ubicaciones) ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 6 }}>
                    {p.ubicaciones.map((u, idx) => (
                      <div key={idx} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 6 }}>{formatValue(u)}</div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 6 }}>{formatValue(p.ubicacion)}</div>
                )
              ))
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderInsumosResumen = (d) => {
    if (!d || typeof d !== 'object') return renderKV(d);
    const headerStyle = { background:'#f0fdf4', color:'#14532d' };
    const tableStyle = { width:'100%', borderCollapse:'collapse' };
    return (
      <div className="result-grid" style={{ display:'grid', gap: 12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
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
          <div style={{ overflowX: 'auto' }}>
          <table style={{ ...tableStyle, tableLayout:'fixed', minWidth: 520 }}>
            <thead>
              <tr style={headerStyle}>
                <th>Insumo</th><th>Asignado</th><th>Entregado</th><th>Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(d.porInsumo || {}).map(([nombre, m]) => (
                <tr key={nombre}>
                  <td style={{ width:'40%' }}>{nombre}</td>
                  <td style={{ width:'20%' }}>{formatValue(m.asignado)}</td>
                  <td style={{ width:'20%' }}>{formatValue(m.entregado)}</td>
                  <td style={{ width:'20%' }}>{formatValue(m.pendiente)}</td>
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
          <div style={{ overflowX: 'auto' }}>
          <table style={{ ...tableStyle, tableLayout:'fixed', minWidth: 560 }}>
            <thead>
              <tr style={headerStyle}>
                <th>Productor</th><th>Asignado</th><th>Entregado</th><th>Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(d.porProductor || {}).map(([pid, m]) => (
                <tr key={pid}>
                  <td style={{ width:'40%', maxWidth: 220, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{pid}</td>
                  <td style={{ width:'20%' }}>{formatValue(m.asignado)}</td>
                  <td style={{ width:'20%' }}>{formatValue(m.entregado)}</td>
                  <td style={{ width:'20%' }}>{formatValue(m.pendiente)}</td>
                </tr>
              ))}
              {Object.keys(d.porProductor || {}).length === 0 && (
                <tr><td colSpan={4} style={{ padding: 8 }}>Sin datos</td></tr>
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
        {card('Lead time promedio (días)', <div style={{ fontSize: 20, fontWeight: 700, color:'#14532d' }}>{formatValue(d.leadTimePromedioDias)}</div>)}
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
    <div className="section-card informes">
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
