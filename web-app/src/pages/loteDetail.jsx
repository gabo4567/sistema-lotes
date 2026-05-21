import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { lotesService } from "../services/lotes.service";
import { confirmDialog } from "../utils/alerts";
import MapPolygon from "../components/MapPolygon";
import LoadingState from "../components/LoadingState";
import DismissibleAlert from "../components/DismissibleAlert";

const LoteDetail = () => {
  const { id } = useParams();
  const [lote, setLote] = useState(null);
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      setIsLoading(true);
      await lotesService.cambiarEstado(id, { estado, observacionesTecnico: obs });
      setMsg(`Estado actualizado a ${estado}`);
      setError("");
      setLote({ ...lote, estado, observacionesTecnico: obs });
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionRequest = async (action) => {
    const isValidAction = action === "validar" || action === "rechazar";
    if (!isValidAction) return;

    const title = action === "validar" ? "Validar lote" : "Rechazar lote";
    const text = action === "validar"
      ? "Estás a punto de validar este lote. El productor será notificado de esto."
      : "Estás a punto de rechazar este lote. El productor será notificado de este rechazo.";
    const confirmButtonText = action === "validar" ? "Enviar" : "Rechazar";

    const ok = await confirmDialog({
      title,
      text,
      icon: "warning",
      confirmButtonText,
      cancelButtonText: "Cancelar",
    });

    if (!ok) return;
    setEstado(action === "validar" ? "Validado" : "Rechazado");
  };

  return (
  <div className="lote-detail page-container section-card">
      {error && <DismissibleAlert className="users-msg err" style={{ marginBottom: 8 }}>{error}</DismissibleAlert>}
      {!lote ? (
        <LoadingState
          title="Cargando lote..."
          message="Estamos preparando la informacion del lote. Espera unos segundos."
        />
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <h2 className="users-title" style={{ margin: 0 }}>{lote.nombre || ''}</h2>
            <Link to="/lotes" className="btn">Volver</Link>
          </div>

          <div className="detail-grid" style={{ marginBottom: 12 }}>
            <div className="detail-item">
              <div className="detail-item__label">IPT</div>
              <div className="detail-item__value">{lote.ipt || "-"}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item__label">Estado</div>
              <div className="detail-item__value">{lote.estado || "-"}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item__label">Método</div>
              <div className="detail-item__value">{formatMetodo(lote.metodoMarcado)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item__label">Tierra arada</div>
              <div className="detail-item__value">{lote.loteArado ? "Sí" : "No"}</div>
            </div>
          </div>

          <div className="map-card" style={{ marginTop: 0 }}>
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              <div className="lote-detail__section-title">Polígono del lote</div>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: "100%", maxWidth: 900 }}>
                <MapPolygon points={lote.poligono || []} />
              </div>
            </div>
          </div>

          <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label className="lote-detail__field-label">Observaciones del administrador</label>
              <textarea
                className="input-inst"
                placeholder="Observaciones del administrador"
                value={obs}
                onChange={e=>setObs(e.target.value)}
                style={{ minHeight: 98, resize: "vertical", lineHeight: 1.45 }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button 
                className="btn" 
                onClick={() => handleActionRequest("validar")}
                disabled={isLoading}
              >
                Validar
              </button>
              <button 
                className="btn" 
                onClick={() => handleActionRequest("rechazar")}
                disabled={isLoading}
              >
                Rechazar
              </button>
            </div>
            {msg && <DismissibleAlert className="users-msg ok">{msg}</DismissibleAlert>}
            {error && <DismissibleAlert className="users-msg err">{error}</DismissibleAlert>}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoteDetail;
