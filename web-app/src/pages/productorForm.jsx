import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createProductor, getProductorById, updateProductor } from "../services/productores.service";

const FormField = ({ label, children }) => (
  <label className="producer-field">
    <span className="producer-field__label">{label}</span>
    {children}
  </label>
);

const ProductorForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({ ipt:"", nombreCompleto:"", cuil:"", email:"", telefono:"", domicilioCasa:"", domicilioIngresoCampoLat:"", domicilioIngresoCampoLng:"", estado:"Nuevo", requiereCambioContrasena:true });
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
        });
      } catch {
        setError("No se pudo cargar productor");
      }
    }
  })() }, [id]);

  const onChange = (k, v) => setForm({ ...form, [k]: v });

  const onTelChange = (v) => {
    const onlyNums = v.replace(/\D/g, "");
    if (onlyNums.length <= 13) {
      onChange("telefono", onlyNums);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.email && !emailRegex.test(form.email)) {
      setError("Ingrese un correo electr\u00f3nico v\u00e1lido.");
      setLoading(false);
      return;
    }

    const telRegex = /^\d{10,13}$/;
    if (form.telefono && !telRegex.test(form.telefono)) {
      setError("El n\u00famero debe contener solo d\u00edgitos (10 a 13 n\u00fameros).");
      setLoading(false);
      return;
    }

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
    <div className="section-card prod-form page-container">
      <h2 className="users-title">{isEdit ? 'Editar productor' : 'Nuevo productor'}</h2>
      <form onSubmit={onSubmit} className="form-grid">
        <FormField label="IPT">
          <input className="input-inst" placeholder="IPT" value={form.ipt} onChange={e=>onChange('ipt', e.target.value)} />
        </FormField>

        <FormField label="Nombre completo">
          <input className="input-inst" placeholder="Nombre completo" value={form.nombreCompleto} onChange={e=>onChange('nombreCompleto', e.target.value)} />
        </FormField>

        <FormField label="CUIL">
          <input className="input-inst" placeholder="CUIL" value={form.cuil} onChange={e=>onChange('cuil', e.target.value)} />
        </FormField>

        <FormField label="Email">
          <input className="input-inst" placeholder="Email" value={form.email} onChange={e=>onChange('email', e.target.value)} />
        </FormField>

        <FormField label={"Tel\u00e9fono"}>
          <input className="input-inst" placeholder={"Tel\u00e9fono"} value={form.telefono} onChange={e=>onTelChange(e.target.value)} />
        </FormField>

        <FormField label="Localidad">
          <input className="input-inst" placeholder="Localidad" value={form.domicilioCasa} onChange={e=>onChange('domicilioCasa', e.target.value)} />
        </FormField>

        {isEdit && (
          <>
            <FormField label="Ingreso campo latitud">
              <input className="input-inst" placeholder="Ingreso campo lat" value={form.domicilioIngresoCampoLat} onChange={e=>onChange('domicilioIngresoCampoLat', e.target.value)} />
            </FormField>

            <FormField label="Ingreso campo longitud">
              <input className="input-inst" placeholder="Ingreso campo lng" value={form.domicilioIngresoCampoLng} onChange={e=>onChange('domicilioIngresoCampoLng', e.target.value)} />
            </FormField>
          </>
        )}

        {isEdit && (
          <FormField label="Estado">
            <select className="select-inst" value={form.estado} onChange={e=>onChange('estado', e.target.value)}>
              <option value="Nuevo">Nuevo</option>
              <option value="Vigente">Vigente</option>
              <option value="Vencido">Vencido</option>
              <option value="Re-empadronado">Re-empadronado</option>
            </select>
          </FormField>
        )}

        <label className="producer-field">
          <span className="producer-field__label">Acceso</span>
          <span className="producer-checkbox-card">
            <input type="checkbox" checked={form.requiereCambioContrasena} onChange={e=>onChange('requiereCambioContrasena', e.target.checked)} />
            {"Requiere cambio de contrase\u00f1a"}
          </span>
        </label>

        {error && <div className="users-msg err" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={()=>navigate('/productores')}>Cancelar</button>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
};

export default ProductorForm;
