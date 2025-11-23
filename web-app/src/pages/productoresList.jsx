import React, { useEffect, useState, useContext } from "react";
import { getProductores, resetPasswordProductor, marcarReempadronado } from "../services/productores.service";
import { Link, useNavigate } from "react-router-dom";
import HomeButton from "../components/HomeButton";
import { AuthContext } from "../contexts/AuthContext";
import { confirmDialog, notify } from "../utils/alerts";

const ProductoresList = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getProductores();
      setItems(data || []);
    } catch (e) {
      setError("No se pudo cargar productores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

  if (loading) return <div style={{ padding: 24 }}>Cargando…</div>;
  if (error) return <div style={{ padding: 24, color: "#c0392b" }}>{error}</div>;

  return (
    <div className="section-card prod-list">
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <h2 className="users-title">Productores</h2>
      <div style={{ marginBottom: 12 }}>
        <Link to="/productores/nuevo" className="btn">Nuevo productor</Link>
      </div>
      <div className="table-wrap">
        <table className="table-inst">
          <thead>
            <tr>
              <th>IPT</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Ingresos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.ipt}</td>
                <td>{p.nombreCompleto}</td>
                <td>{p.estado}</td>
                <td>{p.historialIngresos ?? 0}</td>
                <td>
                  <div className="actions-col">
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
    </div>
  );
};

export default ProductoresList;
