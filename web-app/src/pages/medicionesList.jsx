import React, { useEffect, useState } from "react";
import { getMediciones } from "../services/mediciones.service";
import HomeButton from "../components/HomeButton";

const MedicionesList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ productor:"", lote:"" });
  const [viewer, setViewer] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getMediciones(filtros);
      setItems(data || []);
    } catch (e) {
      setError("No se pudo cargar mediciones");
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, []);

  const formatDate = (d)=>{
    try{
      if(!d) return '-'
      const date = typeof d === 'string' ? new Date(d) : new Date(d)
      if(isNaN(date.getTime())) return String(d)
      const dd = String(date.getDate()).padStart(2,'0')
      const mm = String(date.getMonth()+1).padStart(2,'0')
      const yyyy = date.getFullYear()
      return `${dd}-${mm}-${yyyy}`
    }catch{ return String(d) }
  }

  const tipoBadge = (t)=>{
    const v = String(t||'').toLowerCase()
    if(v.includes('superficie')) return 'estado-badge ok'
    if(v.includes('planta') || v.includes('densidad')) return 'estado-badge info'
    if(v.includes('inspe')) return 'estado-badge warn'
    return 'estado-badge info'
  }

  return (
    <div className="mediciones-list">
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <h2 className="users-title">Mediciones</h2>
      <div className="filters-row">
        <input className="input-inst" placeholder="Productor" value={filtros.productor} onChange={e=>setFiltros({...filtros, productor:e.target.value})} />
        <input className="input-inst" placeholder="Lote" value={filtros.lote} onChange={e=>setFiltros({...filtros, lote:e.target.value})} />
        <button className="btn" onClick={load}>Filtrar</button>
      </div>
      {loading ? (<div>Cargando…</div>) : error ? (<div className="users-msg err">{error}</div>) : (
        <div className="med-grid">
          {items.map(m => (
            <div key={m.id} className="med-card">
              <div className="med-header">
                <div className="med-date">{formatDate(m.fecha)}</div>
                <div className={tipoBadge(m.tipo)}>{m.tipo}</div>
              </div>
              <div className="med-item"><span className="med-label">Productor:</span> {m.productor || '-'}</div>
              <div className="med-item"><span className="med-label">Lote:</span> {m.lote || '-'}</div>
              <div className="med-item"><span className="med-label">Valor:</span> {m.valorNumerico ?? '-'}</div>
              {/* técnico eliminado */}
              {m.observaciones && <div className="med-item"><span className="med-label">Observaciones:</span> {m.observaciones}</div>}
              {m.evidenciaUrl && (
                <div className="med-item"><span className="med-label">Evidencia:</span> <button className="btn-compact" onClick={()=>setViewer({ url: m.evidenciaUrl })}>Ver archivo</button></div>
              )}
            </div>
          ))}
        </div>
      )}
      {viewer && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={()=>setViewer(null)}>
          <div style={{ position:'relative', maxWidth:'92%', maxHeight:'86vh' }} onClick={(e)=>e.stopPropagation()}>
            <img src={viewer.url} alt="Evidencia" style={{ display:'block', maxWidth:'100%', maxHeight:'86vh', borderRadius:12, boxShadow:'0 12px 28px rgba(16,24,32,0.35)' }} />
            <button onClick={()=>setViewer(null)} style={{ position:'absolute', top:-12, right:-12, background:'#fff', border:'1px solid #e5e7eb', borderRadius:999, width:36, height:36, boxShadow:'0 8px 20px rgba(16,24,32,0.25)', cursor:'pointer' }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicionesList;
