import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { lotesService } from "../services/lotes.service";
import Layout from "../components/Layout";
import MapPolygon from "../components/MapPolygon";

const LoteDetail = () => {
  const { id } = useParams();
  const [lote, setLote] = useState(null);
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const formatMetodo = (metodo) => {
    if (!metodo) return "-";
    const metodoLower = String(metodo).toLowerCase().trim();
    if (metodoLower === "aéreo" || metodoLower === "aereo") return "Aéreo";
    if (metodoLower === "gps") return "GPS caminando";
    return metodo;
  };

  useEffect(()=>{ (async ()=>{
    try { const data = await lotesService.getLote(id); setLote(data); setObs(data?.observacionesTecnico || ""); setError(""); }
    catch (e) { setError(e?.response?.data?.error || "No se pudo cargar lote"); }
  })() }, [id]);


  const setEstado = async (estado) => {
    try {
      await lotesService.cambiarEstado(id, { estado, observacionesTecnico: obs });
      setMsg(`Estado actualizado a ${estado}`);
      setError("");
      setLote({ ...lote, estado, observacionesTecnico: obs });
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  return (
  <div className="lote-detail page-container section-card">
      {error && <div className="text-red-600" style={{ marginBottom: 8 }}>{error}</div>}
      {!lote ? (<div>Cargando…</div>) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <h2 className="users-title" style={{ margin: 0 }}>{lote.nombre || ''}</h2>
            <Link to="/lotes" className="btn">Volver</Link>
          </div>

          <div className="detail-grid" style={{ marginBottom: 12 }}>
            <div className="detail-item">
              <div style={{ fontSize: 12, fontWeight: 800, color: "#14532d", letterSpacing: ".02em", textTransform: "uppercase" }}>IPT</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{lote.ipt || "-"}</div>
            </div>
            <div className="detail-item">
              <div style={{ fontSize: 12, fontWeight: 800, color: "#14532d", letterSpacing: ".02em", textTransform: "uppercase" }}>Estado</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{lote.estado || "-"}</div>
            </div>
            <div className="detail-item">
              <div style={{ fontSize: 12, fontWeight: 800, color: "#14532d", letterSpacing: ".02em", textTransform: "uppercase" }}>Método</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{formatMetodo(lote.metodoMarcado)}</div>
            </div>
          </div>

          <div className="map-card" style={{ marginTop: 0 }}>
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              <div style={{ fontWeight: 800, color: "#111827" }}>Polígono del lote</div>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: "100%", maxWidth: 900 }}>
                <MapPolygon points={lote.poligono || []} />
              </div>
            </div>
          </div>

          <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Observaciones del administrador</label>
              <textarea className="input-inst" placeholder="Observaciones del administrador" value={obs} onChange={e=>setObs(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="btn" onClick={()=>setEstado('Validado')}>Validar</button>
              <button className="btn" onClick={()=>setEstado('Rechazado')}>Rechazar</button>
            </div>
            {msg && <div className="text-green-700">{msg}</div>}
            {error && <div className="text-red-600">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoteDetail;
