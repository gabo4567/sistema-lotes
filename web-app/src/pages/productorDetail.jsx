import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getProductorById, getHistorialIngresos } from "../services/productores.service";
import Layout from "../components/Layout";

const ProductorDetail = () => {
  const { id } = useParams();
  const [prod, setProd] = useState(null);
  const [hist, setHist] = useState(null);
  const [error, setError] = useState("");

  useEffect(()=>{ (async ()=>{
    try {
      const { data } = await getProductorById(id);
      setProd(data);
      if (data?.ipt) {
        const { data: h } = await getHistorialIngresos(data.ipt);
        setHist(typeof h === 'object' && h !== null && 'historialIngresos' in h ? h.historialIngresos : h);
      }
    } catch (e) {
      setError("No se pudo cargar productor");
    }
  })() }, [id]);

  return (
    <div className="section-card prod-detail">
      {!prod ? (
        <div>Cargando…</div>
      ) : (
        <>
          <h2 className="users-title">{prod.nombreCompleto || 'Productor'}</h2>
          <div className="detail-grid">
            <div className="detail-item"><span className="detail-label">IPT:</span> {prod.ipt}</div>
            <div className="detail-item"><span className="detail-label">CUIL:</span> {prod.cuil}</div>
            <div className="detail-item"><span className="detail-label">Email:</span> {prod.email || '-'}</div>
            <div className="detail-item"><span className="detail-label">Teléfono:</span> {prod.telefono || '-'}</div>
            <div className="detail-item"><span className="detail-label">Domicilio:</span> {prod.domicilioCasa || '-'}</div>
            <div className="detail-item"><span className="detail-label">Ingreso al campo:</span> {prod.domicilioIngresoCampo ? `${prod.domicilioIngresoCampo.lat}, ${prod.domicilioIngresoCampo.lng}` : '-'}</div>
            <div className="detail-item"><span className="detail-label">Estado:</span> {prod.estado}</div>
            <div className="detail-item"><span className="detail-label">Requiere cambio de contraseña:</span> {String(prod.requiereCambioContrasena)}</div>
            <div className="detail-item"><span className="detail-label">Plantas/ha:</span> {prod.plantasPorHa ?? '-'}</div>
          </div>
          <h3 className="users-title" style={{ marginTop: 16 }}>Historial de ingresos</h3>
          {Array.isArray(hist) && hist.length > 0 ? (
            <div className="hist-grid">
              {hist.map((h, idx) => (
                <div key={idx} className="hist-card">
                  <div className="hist-row"><span className="hist-label">Fecha:</span> {h.fecha ? new Date(h.fecha).toLocaleDateString() : '-'}</div>
                  <div className="hist-row"><span className="hist-label">Acción:</span> {h.accion || '-'}</div>
                  <div className="hist-row"><span className="hist-label">Observación:</span> {h.observacion || '-'}</div>
                </div>
              ))}
            </div>
          ) : typeof hist === 'number' ? (
            <div className="hist-grid">
              <div className="hist-card">
                <div className="hist-row"><span className="hist-label">Ingresos totales:</span> {hist}</div>
              </div>
            </div>
          ) : (
            <div className="users-msg err" style={{ marginTop: 8 }}>Sin datos</div>
          )}
          {error && <div className="users-msg err" style={{ marginTop: 8 }}>{error}</div>}
        </>
      )}
    </div>
  );
};

export default ProductorDetail;
