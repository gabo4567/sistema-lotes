import React, { useState } from "react";
import { createMedicion } from "../services/mediciones.service";
import { notify } from "../utils/alerts";

const MedicionesForm = () => {
  const [form, setForm] = useState({ productor:"", lote:"", fecha:"", tipo:"", valorNumerico:"", evidenciaUrl:"", observaciones:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onChange = (k, v) => setForm({ ...form, [k]: v });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await createMedicion(form);
      setSuccess("Medición creada correctamente.");
      notify({ title: "Medición creada", icon: "success" });
      setForm({ productor:"", lote:"", fecha:"", tipo:"", valorNumerico:"", evidenciaUrl:"", observaciones:"" });
    } catch (submitError) {
      setError(submitError?.response?.data?.message || submitError?.message || "No se pudo crear la medición.");
    } finally { setLoading(false); }
  };

  return (
 <div className="mediciones-form">
      <h2>Nueva medición</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <input placeholder="Productor" value={form.productor} onChange={e=>onChange('productor', e.target.value)} />
        <input placeholder="Lote" value={form.lote} onChange={e=>onChange('lote', e.target.value)} />
        <input type="date" placeholder="Fecha" value={form.fecha} onChange={e=>onChange('fecha', e.target.value)} />
        <input placeholder="Tipo" value={form.tipo} onChange={e=>onChange('tipo', e.target.value)} />
        <input type="number" step="any" placeholder="Valor numérico" value={form.valorNumerico} onChange={e=>onChange('valorNumerico', e.target.value)} />
        {/* técnico eliminado */}
        <input placeholder="Evidencia URL" value={form.evidenciaUrl} onChange={e=>onChange('evidenciaUrl', e.target.value)} />
        <textarea placeholder="Observaciones" value={form.observaciones} onChange={e=>onChange('observaciones', e.target.value)} />
        {error && <div className="text-red-600">{error}</div>}
        {success && <div className="text-green-700">{success}</div>}
        <button className="btn" type="submit" disabled={loading}>{loading? 'Guardando…' : 'Guardar'}</button>
      </form>
   </div>
  );
};

export default MedicionesForm;
