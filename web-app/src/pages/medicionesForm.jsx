import React, { useState } from "react";
import { createMedicion } from "../services/mediciones.service";
import Layout from "../components/Layout";

const MedicionesForm = () => {
  const [form, setForm] = useState({ productor:"", lote:"", fecha:"", tipo:"", valorNumerico:"", tecnicoResponsable:"", evidenciaUrl:"", observaciones:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (k, v) => setForm({ ...form, [k]: v });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await createMedicion(form);
      alert("Medición creada");
      setForm({ productor:"", lote:"", fecha:"", tipo:"", valorNumerico:"", tecnicoResponsable:"", evidenciaUrl:"", observaciones:"" });
    } catch { setError("No se pudo crear"); } finally { setLoading(false); }
  };

  return (
    <Layout>
      <h2>Nueva medición</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <input placeholder="Productor" value={form.productor} onChange={e=>onChange('productor', e.target.value)} />
        <input placeholder="Lote" value={form.lote} onChange={e=>onChange('lote', e.target.value)} />
        <input placeholder="Fecha" value={form.fecha} onChange={e=>onChange('fecha', e.target.value)} />
        <input placeholder="Tipo" value={form.tipo} onChange={e=>onChange('tipo', e.target.value)} />
        <input placeholder="Valor numérico" value={form.valorNumerico} onChange={e=>onChange('valorNumerico', e.target.value)} />
        <input placeholder="Técnico responsable" value={form.tecnicoResponsable} onChange={e=>onChange('tecnicoResponsable', e.target.value)} />
        <input placeholder="Evidencia URL" value={form.evidenciaUrl} onChange={e=>onChange('evidenciaUrl', e.target.value)} />
        <textarea placeholder="Observaciones" value={form.observaciones} onChange={e=>onChange('observaciones', e.target.value)} />
        {error && <div className="text-red-600">{error}</div>}
        <button className="btn" type="submit" disabled={loading}>{loading? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Layout>
  );
};

export default MedicionesForm;