import React, { useEffect, useState, useContext } from "react";
import { getProductores, resetPasswordProductor, marcarReempadronado } from "../services/productores.service";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

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
    try {
      await resetPasswordProductor(ipt);
      alert("Contraseña reseteada (CUIL en próximo ingreso)");
    } catch {
      alert("No se pudo resetear contraseña");
    }
  };

  const onReempadronado = async (ipt) => {
    try {
      await marcarReempadronado(ipt);
      alert("Productor marcado como re-empadronado");
      load();
    } catch {
      alert("No se pudo marcar re-empadronado");
    }
  };

  const onVer = (id) => { navigate(`/productores/${id}`); };
  const onEditar = (id) => { navigate(`/productores/${id}/editar`); };

  if (loading) return <div style={{ padding: 24 }}>Cargando…</div>;
  if (error) return <div style={{ padding: 24, color: "#c0392b" }}>{error}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2>Productores</h2>
      <div style={{ marginBottom: 12 }}>
        <Link to="/productores/nuevo" className="btn">Nuevo productor</Link>
      </div>
      <table style={{ width: "100%" }}>
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
                <button className="btn" onClick={() => onVer(p.id)}>Ver</button>
                <button className="btn" style={{ marginLeft: 8 }} onClick={() => onEditar(p.id)}>Editar</button>
                <button className="btn" style={{ marginLeft: 8 }} onClick={() => onResetPassword(p.ipt)}>Reset contraseña</button>
                <button className="btn" style={{ marginLeft: 8 }} onClick={() => onReempadronado(p.ipt)}>Re-empadronado</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductoresList;