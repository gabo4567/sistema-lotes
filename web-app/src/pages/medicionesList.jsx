import React, { useEffect, useState } from "react";
import { getMediciones } from "../services/mediciones.service";
import { getProductores } from "../services/productores.service";
import HomeButton from "../components/HomeButton";

const MedicionesList = () => {
  const [items, setItems] = useState([]);
  const [productores, setProductores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ productor:"", lote:"" });
  const [viewer, setViewer] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [data, prodData] = await Promise.all([getMediciones(), getProductores()]);
      const all = Array.isArray(data) ? data : [];
      const prods = Array.isArray(prodData?.data) ? prodData.data : (Array.isArray(prodData) ? prodData : []);
      setItems(all);
      setProductores(prods);
    } catch (e) {
      console.error(e);
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

  const groupedItems = React.useMemo(() => {
    // 1. Filtrar
    const match = (text, pattern) => {
      if (!pattern) return true;
      const pat = String(pattern).toLowerCase().trim();
      const txt = String(text||"").toLowerCase();
      return txt.includes(pat);
    };
    const filtered = items.filter(m =>
      match(m.productor, filtros.productor) && match(m.lote, filtros.lote)
    );

    // 2. Agrupar por productor (IPT + Nombre)
    const groups = {};
    filtered.forEach(m => {
      // Intentar extraer IPT y Nombre usando la lista de productores cargada
      let prodNombre = 'Productor Desconocido';
      let prodIpt = '';

      // m.productor puede ser un IPT (string numérico) o un nombre
      const val = String(m.productor || '').trim();
      
      // Buscar en la lista de productores
      // Intentamos coincidir por IPT o por Nombre Completo
      // IMPORTANTE: Convertir a String para comparar
      const found = productores.find(p => 
        String(p.ipt) === val || 
        String(p.nombreCompleto || '').trim().toLowerCase() === val.toLowerCase() ||
        String(p.nombre || '').trim().toLowerCase() === val.toLowerCase()
      );

      if (found) {
        prodNombre = found.nombreCompleto || found.nombre || 'Sin Nombre';
        prodIpt = found.ipt || '';
      } else {
        // Si no se encuentra, inferir
        if (/^\d+$/.test(val)) {
          // Si parece un número, asumimos que es el IPT
          prodIpt = val;
          // Intento de fallback: buscar si el productor existe aunque no coincida exactamente el campo 'productor' de la medición
          const foundByIpt = productores.find(p => String(p.ipt) === val);
          if (foundByIpt) {
             prodNombre = foundByIpt.nombreCompleto || foundByIpt.nombre || 'Sin Nombre';
          } else {
             prodNombre = 'Productor Desconocido'; 
          }
        } else {
          // Si no es número, asumimos que es el nombre
          prodNombre = val || 'Productor Desconocido';
          prodIpt = m.ipt || ''; // Si venía en el objeto original
        }
      }

      // Clave única para agrupar
      const key = prodIpt ? `${prodIpt}` : prodNombre;
      
      if (!groups[key]) {
        groups[key] = {
          nombre: prodNombre,
          ipt: prodIpt,
          mediciones: []
        };
      }
      groups[key].mediciones.push(m);
    });

    return Object.values(groups);
  }, [items, filtros, productores]);

  const tipoBadge = (t)=>{
    const v = String(t||'').toLowerCase()
    if(v.includes('superficie')) return 'estado-badge ok'
    if(v.includes('planta') || v.includes('densidad')) return 'estado-badge info'
    if(v.includes('inspe')) return 'estado-badge warn'
    return 'estado-badge info'
  }

  const buildImageUrl = (u) => {
    if (!u) return "";
    const origin = window.location.origin;
    const isTunnel = /devtunnels\.ms/.test(origin) && /-\d{4}\./.test(origin);
    let root;
    const env = import.meta.env.VITE_API_URL;
    if (isTunnel) {
      root = origin.replace(/-\d{4}\./, '-3000.');
    } else if (env) {
      // Evitar mixed content: si env es http y página https, usa origin
      if (/^http:\/\//i.test(env) && window.location.protocol === 'https:') {
        root = origin;
      } else {
        root = env.replace(/\/api\/?$/, "");
      }
    } else {
      root = origin;
    }

    try {
      const abs = new URL(u);
      // Si evidencia viene con host local/IP, usa solo el path
      const pathname = abs.pathname || '/';
      return root.replace(/\/$/,'') + pathname;
    } catch {
      // u puede ser relativo, asegurar concatenación correcta
      return root.replace(/\/$/,'') + (u.startsWith('/') ? u : '/' + u);
    }
  };

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {groupedItems.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No hay mediciones para mostrar</div>
          ) : groupedItems.map((group, idx) => (
            <div key={idx} className="productor-group" style={{ 
              backgroundColor: '#fff', 
              borderRadius: 16, 
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
            }}>
              <div style={{ 
                padding: '16px 24px', 
                backgroundColor: '#f8fafc', 
                borderBottom: '1px solid #cbd5e1',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#0f172a' }}>Productor:</span> <span style={{ color: '#166534' }}>{group.nombre}</span>
                </div>
                {group.ipt && (
                  <div style={{ fontSize: 16, color: '#334155', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#0f172a' }}>N° IPT:</span> <span style={{ color: '#166534' }}>{group.ipt}</span>
                  </div>
                )}
              </div>
              
              <div className="med-grid" style={{ padding: 20 }}>
                {group.mediciones.map(m => (
                  <div key={m.id} className="med-card" style={{ border: '2px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', backgroundColor: '#fff' }}>
                    <div className="med-header">
                      <div className="med-date">{formatDate(m.fecha)}</div>
                      <div className={tipoBadge(m.tipo)}>{m.tipo}</div>
                    </div>
                    {/* Productor ya está en el header del grupo, no hace falta repetirlo */}
                    <div className="med-item"><span className="med-label">Lote:</span> {m.lote || '-'}</div>
                    <div className="med-item"><span className="med-label">Valor:</span> {m.valorNumerico ?? '-'}</div>
                    {m.observaciones && <div className="med-item"><span className="med-label">Observaciones:</span> {m.observaciones}</div>}
                    {m.evidenciaUrl && (
                      <div className="med-item"><span className="med-label">Evidencia:</span> <button className="btn-compact" onClick={()=>setViewer({ url: buildImageUrl(m.evidenciaUrl) })}>Ver archivo</button></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {viewer && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={()=>setViewer(null)}>
          <div style={{ position:'relative', maxWidth:'92%', maxHeight:'86vh' }} onClick={(e)=>e.stopPropagation()}>
            <img src={viewer.url} alt="Evidencia" style={{ display:'block', maxWidth:'100%', maxHeight:'86vh', borderRadius:12, boxShadow:'0 12px 28px rgba(16,24,32,0.35)' }} onError={(e)=>{ e.currentTarget.alt='No se pudo cargar la imagen'; e.currentTarget.style.display='none'; }} />
            {!viewer.url && (<div style={{ padding:12, textAlign:'center' }}>Sin imagen</div>)}
            <button onClick={()=>setViewer(null)} style={{ position:'absolute', top:-12, right:-12, background:'#fff', border:'1px solid #e5e7eb', borderRadius:999, width:36, height:36, boxShadow:'0 8px 20px rgba(16,24,32,0.25)', cursor:'pointer' }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicionesList;
