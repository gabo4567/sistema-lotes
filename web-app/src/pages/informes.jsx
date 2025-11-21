import React, { useState } from "react";
import Layout from "../components/Layout";
import { resumenGeneral, productoresActivos, ordenesPorMes, turnosPorEstado, medicionesPorLote, exportarPdf, exportarExcel } from "../services/informes.service";

const Informes = () => {
  const [tipo, setTipo] = useState("resumen");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const generar = async () => {
    setLoading(true); setMessage("");
    try {
      let d;
      if (tipo === "resumen") d = await resumenGeneral();
      else if (tipo === "productores") d = await productoresActivos();
      else if (tipo === "ordenesMes") d = await ordenesPorMes();
      else if (tipo === "turnosEstado") d = await turnosPorEstado();
      else if (tipo === "medicionesLote") d = await medicionesPorLote();
      setData(d);
    } finally { setLoading(false); }
  };

  const expPdf = async () => { const r = await exportarPdf(tipo); setMessage(r?.message || ""); };
  const expExcel = async () => { const r = await exportarExcel(tipo); setMessage(r?.message || ""); };

  return (
    <Layout>
      <h2>Informes</h2>
      <div className="flex gap-2 mb-2">
        <select value={tipo} onChange={e=>setTipo(e.target.value)}>
          <option value="resumen">Resumen general</option>
          <option value="productores">Productores activos</option>
          <option value="ordenesMes">Órdenes por mes</option>
          <option value="turnosEstado">Turnos por estado</option>
          <option value="medicionesLote">Mediciones por lote</option>
        </select>
        <button className="btn" onClick={generar}>{loading? 'Generando…' : 'Generar'}</button>
        <button className="btn" onClick={expPdf}>Exportar PDF</button>
        <button className="btn" onClick={expExcel}>Exportar Excel</button>
      </div>
      {message && <div className="mb-2">{message}</div>}
      <pre style={{ background:'#fff', padding:12, borderRadius:8 }}>{data ? JSON.stringify(data, null, 2) : 'Sin datos'}</pre>
    </Layout>
  );
};

export default Informes;