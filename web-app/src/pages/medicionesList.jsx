import React, { useEffect, useState } from "react";
import { getMediciones } from "../services/mediciones.service";
import Layout from "../components/Layout";

const MedicionesList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ productor:"", lote:"", tipo:"" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getMediciones(filtros);
      setItems(data || []);
    } catch (e) {
      setError("No se pudo cargar mediciones");
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, []);

  return (
<body>
      <h2>Mediciones</h2>
      <div className="flex gap-2 mb-2">
        <input placeholder="Productor" value={filtros.productor} onChange={e=>setFiltros({...filtros, productor:e.target.value})} />
        <input placeholder="Lote" value={filtros.lote} onChange={e=>setFiltros({...filtros, lote:e.target.value})} />
        <input placeholder="Tipo" value={filtros.tipo} onChange={e=>setFiltros({...filtros, tipo:e.target.value})} />
        <button className="btn" onClick={load}>Filtrar</button>
      </div>
      {loading ? (<div>Cargando…</div>) : error ? (<div className="text-red-600">{error}</div>) : (
        <table className="w-full">
          <thead><tr><th>Productor</th><th>Lote</th><th>Fecha</th><th>Tipo</th><th>Valor</th><th>Técnico</th></tr></thead>
          <tbody>
            {items.map(m => (
              <tr key={m.id}><td>{m.productor}</td><td>{m.lote}</td><td>{m.fecha}</td><td>{m.tipo}</td><td>{m.valorNumerico ?? '-'}</td><td>{m.tecnicoResponsable || '-'}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </body>
  );
};

export default MedicionesList;