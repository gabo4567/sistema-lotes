import React, { useEffect, useState } from "react";
import { getUsers, updateUser, deactivateUser, resetPasswordUser } from "../services/users.service";
import HomeButton from "../components/HomeButton";
import { confirmDialog, promptDialog } from "../utils/alerts";


const UsersList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true); setError(""); setMsg("");
    try {
      const data = await getUsers();
      setItems(data || []);
    } catch (e) {
      setError("No se pudieron cargar usuarios");
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, []);

  const onChangeRole = async (uid, role) => {
    try {
      const payload = { role };
      if (role === 'Productor') {
        const ipt = await promptDialog({ title: 'Asignar IPT', text: 'Ingrese el número de IPT para este productor', inputLabel: 'IPT', inputPlaceholder: 'Ej: 123456', confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar' });
        if (!ipt) return;
        payload.ipt = String(ipt).trim();
      }
      await updateUser(uid, payload);
      setMsg("Rol actualizado");
      setItems(items.map(u => u.id === uid ? { ...u, role, ipt: payload.ipt ?? u.ipt } : u));
    } catch {
      setError("No se pudo actualizar rol");
    }
  };

  const onDeactivate = async (uid) => {
    const ok = await confirmDialog({ title: "¿Estás seguro?", text: "¿Estás seguro de que deseas desactivar este usuario?", icon: "warning", confirmButtonText: "Desactivar", cancelButtonText: "Cancelar" });
    if (!ok) return;
    try {
      await deactivateUser(uid);
      setMsg("Usuario desactivado");
      setItems(items.map(u => u.id === uid ? { ...u, estado: "Inactivo" } : u));
    } catch {
      setError("No se pudo desactivar usuario");
    }
  };

  const onResetPassword = async (uid) => {
    const ok = await confirmDialog({ title: "¿Estás seguro?", text: "¿Estás seguro de que quieres restablecer la contraseña del usuario a su CUIL nuevamente?", icon: "warning", confirmButtonText: "Restablecer", cancelButtonText: "Cancelar" });
    if (!ok) return;
    try {
      const { link } = await resetPasswordUser(uid);
      setMsg("Enlace de reseteo generado");
      window.open(link, "_blank");
    } catch {
      setError("No se pudo generar enlace de reseteo");
    }
  };
  if (loading) return <div>Cargando usuarios...</div>;
  if (error) return <div className="text-red-700">{error}</div>;

  const formatTimestamp = (ts) => {
    if (!ts) return "-";
    try {
      if (typeof ts.toDate === "function") return ts.toDate().toLocaleString();
      if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000).toLocaleString();
      if (typeof ts._seconds === "number") return new Date(ts._seconds * 1000).toLocaleString(); // fallback si llega serializado
      if (typeof ts === "number") return new Date(ts).toLocaleString();
      if (typeof ts === "string") return new Date(ts).toLocaleString();
      return "-";
    } catch {
      return "-";
    }
  };

  return (
    <div className="users-list">
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <h2 className="users-title">Usuarios</h2>
      {msg && <div className="users-msg ok">{msg}</div>}
      {error && <div className="users-msg err">{error}</div>}
      <div className="table-wrap">
        <table className="table-inst">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>IPT</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Último acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(u => (
              <tr key={u.id}>
                <td>{u.nombre || '-'}</td>
                <td>{u.ipt || u.productorIpt || '-'}</td>
                <td>{u.email}</td>
                <td>
                  <select className="select-inst" value={u.role || ''} onChange={e=>onChangeRole(u.id, e.target.value)}>
                    <option value="Administrador">Administrador</option>
                    <option value="Técnico">Técnico</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Productor">Productor</option>
                  </select>
                </td>
                <td>{u.estado || 'Activo'}</td>
                <td>{formatTimestamp(u.ultimoAcceso)}</td>
                <td>
                  <div className="actions-row">
                    <button className="btn" onClick={()=>onResetPassword(u.id)}>Restablecer contraseña</button>
                    <button className="btn btn-danger" onClick={()=>onDeactivate(u.id)}>Desactivar</button>
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

export default UsersList;
