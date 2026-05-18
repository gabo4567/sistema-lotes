import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { lotesService } from "../services/lotes.service";
import MapPolygonEditor from "../components/MapPolygonEditor";
import DismissibleAlert from "../components/DismissibleAlert";
import Swal from "sweetalert2";

const METERS_PER_DEGREE_LAT = 111320;

const toFiniteNumber = (value) => {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const LoteField = ({ label, hint, wide = false, children }) => (
  <label className={`producer-field lote-field ${wide ? "lote-field--wide" : ""}`}>
    <span className="producer-field__label">{label}</span>
    {children}
    {hint ? <span className="lote-field__hint">{hint}</span> : null}
  </label>
);

const ReadOnlyValue = ({ value, multiline = false }) => (
  <div className={`producer-field__value lote-readonly-value ${multiline ? "lote-readonly-value--multiline" : ""}`}>
    {value || "Se completara al dibujar el poligono."}
  </div>
);

const calculatePolygonAreaHa = (polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return null;

  const averageLatRadians = (polygon.reduce((sum, point) => sum + point.lat, 0) / polygon.length) * (Math.PI / 180);
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(averageLatRadians);

  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentX = current.lng * metersPerDegreeLng;
    const currentY = current.lat * METERS_PER_DEGREE_LAT;
    const nextX = next.lng * metersPerDegreeLng;
    const nextY = next.lat * METERS_PER_DEGREE_LAT;
    area += currentX * nextY - nextX * currentY;
  }

  return Math.abs(area / 2) / 10000;
};

const getPolygonCentroid = (polygon) => {
  if (!Array.isArray(polygon) || polygon.length === 0) return null;
  const sum = polygon.reduce((accumulator, point) => ({ lat: accumulator.lat + point.lat, lng: accumulator.lng + point.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / polygon.length, lng: sum.lng / polygon.length };
};

const LoteAdminForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({ nombre:"", ipt:"", superficie:"", ubicacionLat:"", ubicacionLng:"", metodoMarcado:"aereo", observacionesTecnico:"", poligonoText:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [poly, setPoly] = useState([]);
  const [ultimaMod, setUltimaMod] = useState(null);
  const hasApiKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

  const formatFecha = (ts) => {
    if (!ts) return "-";
    try {
      const d =
        typeof ts?.toDate === "function"
          ? ts.toDate()
          : typeof ts?._seconds === "number"
            ? new Date(ts._seconds * 1000)
            : typeof ts?.seconds === "number"
              ? new Date(ts.seconds * 1000)
              : new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    } catch {
      return "-";
    }
  };

  const accionLabel = (accion) => {
    const a = String(accion || "").toLowerCase().trim();
    if (a === "crear") return "Cre\u00f3 el lote";
    if (a === "actualizar") return "Actualiz\u00f3 el lote";
    if (a === "eliminar") return "Elimin\u00f3 el lote";
    return accion || "-";
  };

  const renderCambios = (cambios) => {
    if (!cambios || typeof cambios !== "object") return "<div style='color:#6b7280'>Sin detalles</div>";
    const entries = Object.entries(cambios);
    if (entries.length === 0) return "<div style='color:#6b7280'>Sin detalles</div>";
    const esc = (v) => {
      try {
        return String(v)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      } catch {
        return "";
      }
    };
    return `
      <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
        ${entries
          .map(([k, v]) => {
            const antes = v?.antes ?? "-";
            const despues = v?.despues ?? "-";
            return `
              <div class="lote-history-change" style="border:1px solid #e2e8f0; border-radius:10px; padding:10px; background:#f8fafc;">
                <div class="lote-history-change__field" style="font-weight:700; margin-bottom:6px;">Campo: ${esc(k)}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                  <div><div style="color:#64748b; font-size:12px;">Antes</div><div style="white-space:pre-wrap;">${esc(typeof antes === "object" ? JSON.stringify(antes) : antes)}</div></div>
                  <div><div style="color:#64748b; font-size:12px;">Despu\u00e9s</div><div style="white-space:pre-wrap;">${esc(typeof despues === "object" ? JSON.stringify(despues) : despues)}</div></div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const openHistorial = async (loteId) => {
    await Swal.fire({
      title: "Historial del lote",
      html: "<div style='padding:8px 0'>Cargando historial...</div>",
      confirmButtonText: "Cerrar",
      confirmButtonColor: "#2E7D32",
      width: 800,
      customClass: {
        popup: "lote-history-swal",
        title: "lote-history-swal__title",
        htmlContainer: "lote-history-swal__html",
        confirmButton: "lote-history-swal__button",
      },
      didOpen: async () => {
        try {
          Swal.showLoading();
          const data = await lotesService.getHistorialLote(loteId);
          const historial = Array.isArray(data) ? data : [];
          const top = historial[0];
          setUltimaMod(top ? { usuarioId: top.usuarioId, usuarioNombre: top.usuarioNombre, fecha: top.fecha } : null);
          if (historial.length === 0) {
            Swal.update({
              html: "<div style='color:#6b7280; padding:8px 0'>Sin historial</div>",
              showConfirmButton: true,
            });
            Swal.hideLoading();
            return;
          }
          const html = `
            <div class="lote-history-list" style="text-align:left; display:flex; flex-direction:column; gap:12px; max-height:60vh; overflow:auto; padding-right:6px;">
              ${historial
                .map((h) => {
                  const isUpd = String(h?.accion || "").toLowerCase().trim() === "actualizar";
                  const cambiosHtml = isUpd ? renderCambios(h?.cambios) : "<div style='color:#6b7280'>Sin detalles</div>";
                  const nombre = h?.usuarioNombre || h?.usuarioId || "-";
                  return `
                    <div class="lote-history-entry" style="border:1px solid #e2e8f0; border-radius:12px; padding:12px; background:#ffffff;">
                      <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                        <div style="font-weight:800;">${accionLabel(h?.accion)}</div>
                        <div style="color:#64748b;">${formatFecha(h?.fecha)}</div>
                      </div>
                      <div style="margin-top:6px; color:#475569;">Usuario: <span style="font-weight:700;">${nombre}</span></div>
                      ${cambiosHtml}
                    </div>
                  `;
                })
                .join("")}
            </div>
          `;
          Swal.update({ html, showConfirmButton: true });
          Swal.hideLoading();
        } catch {
          Swal.update({
            html: "<div style='color:#b91c1c; padding:8px 0'>No se pudo cargar el historial</div>",
            showConfirmButton: true,
          });
          Swal.hideLoading();
        }
      },
    });
  };

  useEffect(()=>{ (async ()=>{
    if (isEdit) {
      try {
        const data = await lotesService.getLote(id);
        const polyText = Array.isArray(data.poligono) ? data.poligono.map(p=>`${p.lat},${p.lng}`).join("\n") : "";
        setForm({
          nombre: data.nombre || "",
          ipt: data.ipt || "",
          superficie: data.superficie ?? "",
          ubicacionLat: data.ubicacion?.lat ?? "",
          ubicacionLng: data.ubicacion?.lng ?? "",
          metodoMarcado: "aereo",
          observacionesTecnico: data.observacionesTecnico || "",
          poligonoText: polyText,
        });
        setPoly(Array.isArray(data.poligono) ? data.poligono : []);
        try {
          const hist = await lotesService.getHistorialLote(id);
          const arr = Array.isArray(hist) ? hist : [];
          const top = arr[0];
          setUltimaMod(top ? { usuarioId: top.usuarioId, usuarioNombre: top.usuarioNombre, fecha: top.fecha } : null);
        } catch {
          setUltimaMod(null);
        }
      } catch (err) {
        setError(err.message || "No se pudo cargar el lote");
      }
    }
  })() }, [id]);

  const onChange = (k, v) => setForm((current) => ({ ...current, [k]: v }));

  const parsePoligono = (t) => {
    return String(t).split(/\n+/).map(line=>line.trim()).filter(Boolean).map(line=>{
      const [latStr, lngStr] = line.split(/[,\s]+/);
      const lat = Number(latStr), lng = Number(lngStr);
      if (!isFinite(lat) || !isFinite(lng)) throw new Error("Formato de pol\u00edgono inv\u00e1lido");
      return { lat, lng };
    });
  };

  const syncPolygonInForm = useCallback((points) => {
    const centroid = getPolygonCentroid(points);
    const areaHa = calculatePolygonAreaHa(points);

    setPoly(points);
    setForm((current) => ({
      ...current,
      poligonoText: points.map((point) => `${point.lat},${point.lng}`).join("\n"),
      superficie: areaHa == null ? "" : areaHa.toFixed(2),
      ubicacionLat: centroid == null ? "" : String(centroid.lat),
      ubicacionLng: centroid == null ? "" : String(centroid.lng),
    }));
  }, []);

  const center = useMemo(() => {
    const lat = toFiniteNumber(form.ubicacionLat);
    const lng = toFiniteNumber(form.ubicacionLng);
    return lat != null && lng != null ? { lat, lng } : undefined;
  }, [form.ubicacionLat, form.ubicacionLng]);

  const ubicacionTexto = form.ubicacionLat && form.ubicacionLng
    ? `Latitud: ${form.ubicacionLat}\nLongitud: ${form.ubicacionLng}`
    : "";

  const superficieTexto = form.superficie ? `${form.superficie} ha` : "";

  const onSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const poligono = (poly && poly.length >= 3) ? poly : parsePoligono(form.poligonoText);
      if (!Array.isArray(poligono) || poligono.length < 3) throw new Error("Dibuje el poligono del lote antes de guardar");
      if (!String(form.ipt || "").trim()) throw new Error("El IPT es obligatorio");

      const centroid = getPolygonCentroid(poligono);
      const superficieCalculada = calculatePolygonAreaHa(poligono);
      const payload = {
        nombre: form.nombre || "",
        ipt: String(form.ipt).trim(),
        superficie: superficieCalculada,
        ubicacion: centroid,
        poligono,
        metodoMarcado: form.metodoMarcado,
        observacionesTecnico: form.observacionesTecnico || "",
      };
      if (isEdit) {
        await lotesService.updateLote(id, payload);
      } else {
        await lotesService.createLote(payload);
      }
      navigate('/lotes');
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="section-card prod-form page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 className="users-title" style={{ margin: 0 }}>{isEdit ? "Editar lote" : "Nuevo lote"}</h2>
        {isEdit ? (
          <button type="button" className="btn secondary" onClick={() => openHistorial(id)}>Ver historial</button>
        ) : null}
      </div>
      {isEdit && ultimaMod?.usuarioId ? (
        <div style={{ marginTop: 8, marginBottom: 12, color: "#475569", fontSize: 14 }}>
          {"\u00daltima modificaci\u00f3n"}: {ultimaMod.usuarioNombre || ultimaMod.usuarioId} - {formatFecha(ultimaMod.fecha)}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="form-grid lote-form">
        <LoteField label="Nombre del lote">
          <input className="input-inst" placeholder="Ej: Lote del Sur" value={form.nombre} onChange={e=>onChange('nombre', e.target.value)} />
        </LoteField>

        <LoteField label="IPT del productor">
          <input className="input-inst" placeholder="Ej: 654321" value={form.ipt} onChange={e=>onChange('ipt', e.target.value)} />
        </LoteField>

        <div className="map-card lote-map-card" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
            <div className="producer-field__label">{"Pol\u00edgono del lote"}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 900 }}>
              <MapPolygonEditor points={poly} center={center} onChange={syncPolygonInForm} />
            </div>
          </div>
          {!hasApiKey && (
            <div className="lote-field__hint" style={{ marginTop: 6 }}>{"Sin API key: usa el campo de texto para cargar el pol\u00edgono (lat,lng por l\u00ednea)"}</div>
          )}
        </div>

        <LoteField
          label={"Coordenadas del pol\u00edgono"}
          hint={"Se generan automaticamente cuando el administrador dibuja el poligono en el mapa."}
          wide
        >
          <ReadOnlyValue value={form.poligonoText} multiline />
        </LoteField>

        <LoteField
          label={"Superficie (hect\u00e1reas)"}
          hint={"Se calcula automaticamente a partir del poligono."}
        >
          <ReadOnlyValue value={superficieTexto} />
        </LoteField>

        <LoteField
          label={"Ubicaci\u00f3n"}
          hint={"Punto de referencia calculado automaticamente desde el poligono."}
        >
          <ReadOnlyValue value={ubicacionTexto} multiline />
        </LoteField>

        <LoteField label="Observaciones del administrador">
          <textarea className="input-inst" placeholder="Observaciones del administrador" value={form.observacionesTecnico} onChange={e=>onChange('observacionesTecnico', e.target.value)} />
        </LoteField>

        <LoteField label={"M\u00e9todo"}>
          <ReadOnlyValue value={"A\u00e9reo"} />
        </LoteField>

        {error && <DismissibleAlert className="users-msg err" style={{ gridColumn: '1 / -1' }}>{error}</DismissibleAlert>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={()=>navigate('/lotes')}>Cancelar</button>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
};

export default LoteAdminForm;
