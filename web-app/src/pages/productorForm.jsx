import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createProductor, getProductorById, updateProductor } from "../services/productores.service";
import Layout from "../components/Layout";

const ProductorForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({ ipt:"", nombreCompleto:"", cuil:"", email:"", telefono:"", domicilioCasa:"", domicilioIngresoCampoLat:"", domicilioIngresoCampoLng:"", estado:"Nuevo", requiereCambioContrasena:true, plantasPorHa:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(()=>{ (async ()=>{
    if (isEdit) {
      try {
        const { data } = await getProductorById(id);
        setForm({
          ipt: data.ipt || "",
          nombreCompleto: data.nombreCompleto || "",
          cuil: data.cuil || "",
          email: data.email || "",
          telefono: data.telefono || "",
          domicilioCasa: data.domicilioCasa || "",
          domicilioIngresoCampoLat: data.domicilioIngresoCampo?.lat ?? "",
          domicilioIngresoCampoLng: data.domicilioIngresoCampo?.lng ?? "",
          estado: data.estado || "Nuevo",
          requiereCambioContrasena: Boolean(data.requiereCambioContrasena),
          plantasPorHa: data.plantasPorHa ?? "",
        });
      } catch {}
    }
  })() }, [id]);

  const onChange = (k, v) => setForm({ ...form, [k]: v });

  const onSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const payload = {
        ipt: String(form.ipt),
        nombreCompleto: form.nombreCompleto,
        cuil: String(form.cuil),
        email: form.email || null,
        telefono: form.telefono || null,
        domicilioCasa: form.domicilioCasa || null,
        domicilioIngresoCampo: (form.domicilioIngresoCampoLat && form.domicilioIngresoCampoLng) ? { lat: Number(form.domicilioIngresoCampoLat), lng: Number(form.domicilioIngresoCampoLng) } : null,
        estado: form.estado,
        requiereCambioContrasena: Boolean(form.requiereCambioContrasena),
        plantasPorHa: form.plantasPorHa ? Number(form.plantasPorHa) : null,
      };
      if (isEdit) {
        await updateProductor(id, payload);
      } else {
        await createProductor(payload);
      }
      navigate('/productores');
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  return (
    <Layout>
      <h2>{isEdit ? 'Editar productor' : 'Nuevo productor'}</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 max-w-xl">
        <input placeholder="IPT" value={form.ipt} onChange={e=>onChange('ipt', e.target.value)} />
        <input placeholder="Nombre completo" value={form.nombreCompleto} onChange={e=>onChange('nombreCompleto', e.target.value)} />
        <input placeholder="CUIL" value={form.cuil} onChange={e=>onChange('cuil', e.target.value)} />
        <input placeholder="Email" value={form.email} onChange={e=>onChange('email', e.target.value)} />
        <input placeholder="Teléfono" value={form.telefono} onChange={e=>onChange('telefono', e.target.value)} />
        <input placeholder="Domicilio (casa)" value={form.domicilioCasa} onChange={e=>onChange('domicilioCasa', e.target.value)} />
        <div className="flex gap-2">
          <input placeholder="Ingreso campo lat" value={form.domicilioIngresoCampoLat} onChange={e=>onChange('domicilioIngresoCampoLat', e.target.value)} />
          <input placeholder="Ingreso campo lng" value={form.domicilioIngresoCampoLng} onChange={e=>onChange('domicilioIngresoCampoLng', e.target.value)} />
        </div>
        <select value={form.estado} onChange={e=>onChange('estado', e.target.value)}>
          <option value="Nuevo">Nuevo</option>
          <option value="Vigente">Vigente</option>
          <option value="Vencido">Vencido</option>
          <option value="Re-empadronado">Re-empadronado</option>
        </select>
        <label>
          <input type="checkbox" checked={form.requiereCambioContrasena} onChange={e=>onChange('requiereCambioContrasena', e.target.checked)} /> Requiere cambio de contraseña
        </label>
        <input placeholder="Plantas por hectárea" value={form.plantasPorHa} onChange={e=>onChange('plantasPorHa', e.target.value)} />
        {error && <div className="text-red-600">{error}</div>}
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Layout>
  );
};

export default ProductorForm;