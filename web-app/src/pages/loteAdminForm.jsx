import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { lotesService } from "../services/lotes.service";
import Layout from "../components/Layout";
import MapPolygonEditor from "../components/MapPolygonEditor";
import Swal from "sweetalert2";

const METERS_PER_DEGREE_LAT = 111320;

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

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
  const [locating, setLocating] = useState(false);
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
    if (a === "crear") return "Creó el lote";
    if (a === "actualizar") return "Actualizó el lote";
    if (a === "eliminar") return "Eliminó el lote";
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
              <div style="border:1px solid #e2e8f0; border-radius:10px; padding:10px; background:#f8fafc;">
                <div style="font-weight:700; margin-bottom:6px;">Campo: ${esc(k)}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                  <div><div style="color:#64748b; font-size:12px;">Antes</div><div style="white-space:pre-wrap;">${esc(typeof antes === "object" ? JSON.stringify(antes) : antes)}</div></div>
                  <div><div style="color:#64748b; font-size:12px;">Después</div><div style="white-space:pre-wrap;">${esc(typeof despues === "object" ? JSON.stringify(despues) : despues)}</div></div>
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
      html: "<div style='padding:8px 0'>Cargando historial…</div>",
      confirmButtonText: "Cerrar",
      confirmButtonColor: "#2E7D32",
      width: 800,
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
            <div style="text-align:left; display:flex; flex-direction:column; gap:12px; max-height:60vh; overflow:auto; padding-right:6px;">
              ${historial
                .map((h) => {
                  const isUpd = String(h?.accion || "").toLowerCase().trim() === "actualizar";
                  const cambiosHtml = isUpd ? renderCambios(h?.cambios) : "<div style='color:#6b7280'>Sin detalles</div>";
                  const nombre = h?.usuarioNombre || h?.usuarioId || "-";
                  return `
                    <div style="border:1px solid #e2e8f0; border-radius:12px; padding:12px; background:#ffffff;">
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

  const onChange = (k, v) => setForm({ ...form, [k]: v });

  const parsePoligono = (t) => {
    return String(t).split(/\n+/).map(line=>line.trim()).filter(Boolean).map(line=>{
      const [latStr, lngStr] = line.split(/[,\s]+/);
      const lat = Number(latStr), lng = Number(lngStr);
      if (!isFinite(lat) || !isFinite(lng)) throw new Error("Formato de polígono inválido");
      return { lat, lng };
    });
  };

  const syncPolygonInForm = (points) => {
    const centroid = getPolygonCentroid(points);
    const areaHa = calculatePolygonAreaHa(points);

    setPoly(points);
    setForm((current) => ({
      ...current,
      poligonoText: points.map((point) => `${point.lat},${point.lng}`).join("\n"),
      superficie: current.superficie || areaHa == null ? current.superficie : areaHa.toFixed(2),
      ubicacionLat: current.ubicacionLat || centroid == null ? current.ubicacionLat : String(centroid.lat),
      ubicacionLng: current.ubicacionLng || centroid == null ? current.ubicacionLng : String(centroid.lng),
    }));
  };

  const center = (() => {
    const lat = toFiniteNumber(form.ubicacionLat);
    const lng = toFiniteNumber(form.ubicacionLng);
    return lat != null && lng != null ? { lat, lng } : undefined;
  })();

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("El navegador no soporta geolocalizacion");
      return;
    }

    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({
          ...current,
          ubicacionLat: String(coords.latitude),
          ubicacionLng: String(coords.longitude),
        }));
        setLocating(false);
      },
      (geoError) => {
        setError(geoError.message || "No se pudo obtener la ubicacion actual");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const poligono = (poly && poly.length >= 3) ? poly : parsePoligono(form.poligonoText);
      if (!String(form.ipt || "").trim()) throw new Error("El IPT es obligatorio");

      const centroid = getPolygonCentroid(poligono);
      const superficieCalculada = calculatePolygonAreaHa(poligono);
      const ubicacionLat = toFiniteNumber(form.ubicacionLat);
      const ubicacionLng = toFiniteNumber(form.ubicacionLng);
      const payload = {
        nombre: form.nombre || "",
        ipt: String(form.ipt).trim(),
        superficie: form.superficie ? Number(form.superficie) : superficieCalculada,
        ubicacion: (ubicacionLat != null && ubicacionLng != null) ? { lat: ubicacionLat, lng: ubicacionLng } : centroid,
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
        <h2 className="users-title" style={{ margin: 0 }}>{isEdit ? 'Editar lote' : 'Nuevo lote'}</h2>
        {isEdit ? (
          <button type="button" className="btn secondary" onClick={() => openHistorial(id)}>Ver historial</button>
        ) : null}
      </div>
      {isEdit && ultimaMod?.usuarioId ? (
        <div style={{ marginTop: 8, marginBottom: 12, color: "#475569", fontSize: 14 }}>
          Última modificación: {ultimaMod.usuarioNombre || ultimaMod.usuarioId} · {formatFecha(ultimaMod.fecha)}
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="form-grid">
        <input className="input-inst" placeholder="Nombre del lote" value={form.nombre} onChange={e=>onChange('nombre', e.target.value)} />
        <input className="input-inst" placeholder="IPT" value={form.ipt} onChange={e=>onChange('ipt', e.target.value)} />
        <input className="input-inst" placeholder="Ubicación lat" value={form.ubicacionLat} onChange={e=>onChange('ubicacionLat', e.target.value)} />
        <input className="input-inst" placeholder="Ubicación lng" value={form.ubicacionLng} onChange={e=>onChange('ubicacionLng', e.target.value)} />
        <input className="input-inst" placeholder="Superficie (ha)" value={form.superficie} onChange={e=>onChange('superficie', e.target.value)} />
        <input className="input-inst" value="Método: Aéreo" readOnly style={{ backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }} />
        <button type="button" className="btn" onClick={useCurrentLocation} disabled={locating}>{locating ? 'Ubicando…' : 'Usar mi ubicación'}</button>
        <div className="map-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ marginBottom: 8 }}>Editar polígono en el mapa</div>
          <MapPolygonEditor points={poly} center={center} onChange={syncPolygonInForm} />
          {!hasApiKey && (
            <div style={{ marginTop: 6, color: '#6b7280' }}>Sin API key: usá el campo de texto para cargar el polígono (lat,lng por línea)</div>
          )}
        </div>
        <div style={{ gridColumn: '1 / -1', color: '#6b7280', fontSize: 14 }}>Si dejás la superficie o la ubicación vacías, el sistema las deriva automáticamente desde el polígono.</div>
        <textarea className="input-inst" placeholder="Polígono (una línea por punto: lat,lng)" rows={6} value={form.poligonoText} onChange={e=>onChange('poligonoText', e.target.value)} />
        <textarea className="input-inst" placeholder="Observaciones del técnico" value={form.observacionesTecnico} onChange={e=>onChange('observacionesTecnico', e.target.value)} />
        {error && <div className="users-msg err" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={()=>navigate('/lotes')}>Cancelar</button>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
      </div>
  );
};

export default LoteAdminForm;
