import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getProductorById, getHistorialIngresos } from "../services/productores.service";

const DetailField = ({ label, value, wide = false }) => (
  <div className={`producer-field ${wide ? "producer-field--wide" : ""}`}>
    <div className="producer-field__label">{label}</div>
    <div className="producer-field__value">{value === 0 || value ? value : "-"}</div>
  </div>
);

const ProductorDetail = () => {
  const { id } = useParams();
  const [prod, setProd] = useState(null);
  const [hist, setHist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setHistLoading(false);
        setProd(null);
        setHist(null);
        setError("");
        const { data } = await getProductorById(id);
        if (!alive) return;
        setProd(data);
        if (data?.ipt) {
          setHistLoading(true);
          const { data: h } = await getHistorialIngresos(data.ipt);
          if (!alive) return;
          setHist(typeof h === "object" && h !== null && "historialIngresos" in h ? h.historialIngresos : h);
        } else {
          setHist([]);
        }
      } catch {
        if (alive) setError("No se pudo cargar productor");
      } finally {
        if (alive) {
          setLoading(false);
          setHistLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const entradaCampo = (() => {
    const c = prod?.domicilioIngresoCoord || prod?.domicilioIngresoCampo || prod?.ubicaciones?.entradaCampo;
    return c && typeof c.lat === "number" && typeof c.lng === "number" ? `${c.lat}, ${c.lng}` : "-";
  })();

  return (
    <div className="section-card prod-detail page-container">
      {loading && !prod ? (
        <div className="producer-detail-loading">Cargando productor...</div>
      ) : !prod ? (
        <div className="producer-detail-loading">No se pudo mostrar el productor.</div>
      ) : (
        <>
          <h2 className="users-title">{prod.nombreCompleto || "Productor"}</h2>

          <div className="producer-detail-grid">
            <DetailField label="IPT" value={prod.ipt} />
            <DetailField label="CUIL" value={prod.cuil} />
            <DetailField label="Email" value={prod.email} wide />
            <DetailField label={"Tel\u00e9fono"} value={prod.telefono} />
            <DetailField label="Localidad" value={prod.domicilioCasa} />
            <DetailField label="Ingreso al campo" value={entradaCampo} wide />
            <DetailField label="Estado" value={prod.estado} />
            <DetailField label={"Cambio de contrase\u00f1a"} value={prod.requiereCambioContrasena ? "Requerido" : "No requerido"} />
          </div>

          <h3 className="producer-section-title">Historial de ingresos</h3>
          {histLoading ? (
            <div className="producer-detail-loading producer-detail-loading--inline">Cargando historial de ingresos...</div>
          ) : Array.isArray(hist) && hist.length > 0 ? (
            <div className="producer-detail-grid">
              {hist.map((h, idx) => (
                <React.Fragment key={idx}>
                  <DetailField label="Fecha" value={h.fecha ? new Date(h.fecha).toLocaleDateString() : "-"} />
                  <DetailField label={"Acci\u00f3n"} value={h.accion || "-"} />
                  <DetailField label={"Observaci\u00f3n"} value={h.observacion || "-"} wide />
                </React.Fragment>
              ))}
            </div>
          ) : typeof hist === "number" ? (
            <div className="producer-detail-grid">
              <DetailField label="Ingresos totales" value={hist} wide />
            </div>
          ) : (
            <div className="producer-detail-empty">Sin datos de ingresos registrados.</div>
          )}
          {error && <div className="users-msg err" style={{ marginTop: 8 }}>{error}</div>}
        </>
      )}
    </div>
  );
};

export default ProductorDetail;
