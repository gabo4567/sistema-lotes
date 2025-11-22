import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { lotesService } from "../services/lotes.service";
import Layout from "../components/Layout";
import MapPolygonEditor from "../components/MapPolygonEditor";

const LoteAdminForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({ ipt:"", superficie:"", ubicacionLat:"", ubicacionLng:"", metodoMarcado:"aereo", observacionesTecnico:"", poligonoText:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [poly, setPoly] = useState([]);
  const hasApiKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

  useEffect(()=>{ (async ()=>{
    if (isEdit) {
      try {
        const data = await lotesService.getLote(id);
        const polyText = Array.isArray(data.poligono) ? data.poligono.map(p=>`${p.lat},${p.lng}`).join("\n") : "";
        setForm({
          ipt: data.ipt || "",
          superficie: data.superficie ?? "",
          ubicacionLat: data.ubicacion?.lat ?? "",
          ubicacionLng: data.ubicacion?.lng ?? "",
          metodoMarcado: data.metodoMarcado || "aereo",
          observacionesTecnico: data.observacionesTecnico || "",
          poligonoText: polyText,
        });
        setPoly(Array.isArray(data.poligono) ? data.poligono : []);
      } catch {}
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

  const onSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const poligono = (poly && poly.length >= 3) ? poly : parsePoligono(form.poligonoText);
      const payload = {
        ipt: String(form.ipt),
        superficie: form.superficie ? Number(form.superficie) : null,
        ubicacion: (form.ubicacionLat && form.ubicacionLng) ? { lat: Number(form.ubicacionLat), lng: Number(form.ubicacionLng) } : null,
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
      <body>
      <h2>{isEdit ? 'Editar lote' : 'Nuevo lote'}</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 max-w-xl">
        <input placeholder="IPT" value={form.ipt} onChange={e=>onChange('ipt', e.target.value)} />
        <div className="flex gap-2">
          <input placeholder="Ubicación lat" value={form.ubicacionLat} onChange={e=>onChange('ubicacionLat', e.target.value)} />
          <input placeholder="Ubicación lng" value={form.ubicacionLng} onChange={e=>onChange('ubicacionLng', e.target.value)} />
        </div>
        <input placeholder="Superficie (ha)" value={form.superficie} onChange={e=>onChange('superficie', e.target.value)} />
        <select value={form.metodoMarcado} onChange={e=>onChange('metodoMarcado', e.target.value)}>
          <option value="aereo">Aéreo</option>
          <option value="GPS">GPS</option>
        </select>
        <div>
          <div style={{ marginBottom: 8 }}>Editar polígono en el mapa</div>
          <MapPolygonEditor points={poly} onChange={(pts)=>{ setPoly(pts); setForm(f=>({ ...f, poligonoText: pts.map(p=>`${p.lat},${p.lng}`).join('\n') })); }} />
          {!hasApiKey && (
            <div style={{ marginTop: 6, color: '#6b7280' }}>Sin API key: usá el campo de texto para cargar el polígono (lat,lng por línea)</div>
          )}
        </div>
        <textarea placeholder="Polígono (una línea por punto: lat,lng)" rows={6} value={form.poligonoText} onChange={e=>onChange('poligonoText', e.target.value)} />
        <textarea placeholder="Observaciones del técnico" value={form.observacionesTecnico} onChange={e=>onChange('observacionesTecnico', e.target.value)} />
        {error && <div className="text-red-600">{error}</div>}
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</button>
      </form>
      </body>
  );
};

export default LoteAdminForm;