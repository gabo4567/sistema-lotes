import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { lotesService } from "../services/lotes.service";
import Layout from "../components/Layout";
import MapPolygon from "../components/MapPolygon";

const LoteDetail = () => {
  const { id } = useParams();
  const [lote, setLote] = useState(null);
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

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
  <body>
      {error && <div className="text-red-600" style={{ marginBottom: 8 }}>{error}</div>}
      {!lote ? (<div>Cargando…</div>) : (
        <div>
          <h2>Lote {id}</h2>
          <div>IPT: {lote.ipt}</div>
          <div>Estado: {lote.estado}</div>
          <div>Método: {lote.metodoMarcado}</div>
          <div style={{ margin: '12px 0' }}>
            <MapPolygon points={lote.poligono || []} />
          </div>
          <div className="flex flex-col gap-2" style={{ maxWidth: 480 }}>
            <textarea placeholder="Observaciones del técnico" value={obs} onChange={e=>setObs(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn" onClick={()=>setEstado('Validado')}>Validar</button>
              <button className="btn" onClick={()=>setEstado('Rechazado')}>Rechazar</button>
            </div>
            {msg && <div className="text-green-700">{msg}</div>}
            {error && <div className="text-red-600">{error}</div>}
          </div>
        </div>
      )}
    </body>
  );
};

export default LoteDetail;