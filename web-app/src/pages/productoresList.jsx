import React, { useEffect, useState } from "react";
import { getProductores, resetPasswordProductor, marcarReempadronado } from "../services/productores.service";
import { Link, useNavigate } from "react-router-dom";
import HomeButton from "../components/HomeButton";
import { confirmDialog, notify } from "../utils/alerts";

const ProductoresList = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [iptFilter, setIptFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getProductores();
      setItems(data || []);
    } catch {
      setError("No se pudo cargar productores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const normalize = (s) => String(s||"").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const viewItems = items.filter(p => {
    const okIpt = iptFilter ? String(p.ipt||"").includes(String(iptFilter)) : true;
    const okName = nameFilter ? normalize(p.nombreCompleto||p.nombre||"").includes(normalize(nameFilter)) : true;
    return okIpt && okName;
  });

  const onResetPassword = async (ipt) => {
    const ok = await confirmDialog({ title: "¿Estás seguro?", text: "¿Estás seguro de que deseas resetear la contraseña del productor a su CUIL nuevamente?", icon: "warning", confirmButtonText: "Resetear", cancelButtonText: "Cancelar" });
    if (!ok) return;
    try {
      await resetPasswordProductor(ipt);
      await notify({ title: "Listo", text: "Contraseña reseteada (CUIL en próximo ingreso)", icon: "success" });
    } catch {
      await notify({ title: "Error", text: "No se pudo resetear contraseña", icon: "error" });
    }
  };

  const onReempadronado = async (ipt) => {
    const ok = await confirmDialog({ title: "¿Estás seguro?", text: "¿Estás seguro de que deseas reempadronar al productor?", icon: "warning", confirmButtonText: "Re-empadronar", cancelButtonText: "Cancelar" });
    if (!ok) return;
    try {
      await marcarReempadronado(ipt);
      await notify({ title: "Listo", text: "Productor marcado como re-empadronado", icon: "success" });
      load();
    } catch {
      await notify({ title: "Error", text: "No se pudo marcar re-empadronado", icon: "error" });
    }
  };

  const onVer = (id) => { navigate(`/productores/${id}`); };
  const onEditar = (id) => { navigate(`/productores/${id}/editar`); };

  if (error) return <div style={{ padding: 24, color: "#c0392b" }}>{error}</div>;

  return (
    <div className="section-card prod-list page-container">
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <h2 className="users-title">Productores</h2>
      {loading ? (
        <div style={{ padding: 24 }}>Cargando…</div>
      ) : (
      <>
        <div style={{ marginBottom: 12 }}>
          <Link to="/productores/nuevo" className="btn">Nuevo productor</Link>
        </div>
        <div className="filters-row" style={{ display:'flex', flexWrap: 'wrap', gap:8, marginBottom:12 }}>
          <input className="input-inst" style={{ flex: '1 1 200px' }} placeholder="Filtrar por IPT" value={iptFilter} onChange={e=>setIptFilter(e.target.value)} />
          <input className="input-inst" style={{ flex: '1 1 200px' }} placeholder="Filtrar por nombre" value={nameFilter} onChange={e=>setNameFilter(e.target.value)} />
        </div>
      <div className="table-wrap">
        <table className="table-inst" style={{ minWidth: 1000, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '20%', textAlign: 'center' }}>IPT</th>
              <th style={{ width: '20%', textAlign: 'center' }}>Nombre</th>
              <th style={{ width: '20%', textAlign: 'center' }}>Estado</th>
              <th style={{ width: '20%', textAlign: 'center' }}>Ingresos</th>
              <th style={{ width: '20%', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {viewItems.length === 0 ? (
              <tr><td colSpan={5} style={{ padding:12, textAlign:'center' }}>Sin resultados</td></tr>
            ) : viewItems.map((p) => (
              <tr key={p.id}>
                <td style={{ textAlign: 'center', width: '20%' }}>{p.ipt}</td>
                <td style={{ textAlign: 'center', width: '20%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.nombreCompleto}>{p.nombreCompleto}</td>
                <td style={{ textAlign: 'center', width: '20%' }}>{p.estado}</td>
                <td style={{ textAlign: 'center', width: '20%' }}>{p.historialIngresos ?? 0}</td>
                <td style={{ textAlign: 'center', width: '20%' }}>
                  <div className="actions-col" style={{ justifyContent: 'center', display: 'flex', gap: 4 }}>
                    <button className="btn" onClick={() => onVer(p.id)}>Ver</button>
                    <button className="btn" onClick={() => onEditar(p.id)}>Editar</button>
                    <button className="btn" onClick={() => onResetPassword(p.ipt)}>Reset contraseña</button>
                    <button className="btn" onClick={() => onReempadronado(p.ipt)}>Re-empadronado</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
};

export default ProductoresList;
