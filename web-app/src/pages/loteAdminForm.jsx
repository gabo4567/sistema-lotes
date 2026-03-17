import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { lotesService } from "../services/lotes.service";
import Layout from "../components/Layout";
import MapPolygonEditor from "../components/MapPolygonEditor";

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
  const hasApiKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

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
      <div className="section-card prod-form">
      <h2 className="users-title">{isEdit ? 'Editar lote' : 'Nuevo lote'}</h2>
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
