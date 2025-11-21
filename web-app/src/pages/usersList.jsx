import React, { useEffect, useState } from "react";
import { getUsers, updateUser, deactivateUser, resetPasswordUser } from "../services/users.service";
import Layout from "../components/Layout";

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
      await updateUser(uid, { role });
      setMsg("Rol actualizado");
      setItems(items.map(u => u.id === uid ? { ...u, role } : u));
    } catch {
      setError("No se pudo actualizar rol");
    }
  };

  const onDeactivate = async (uid) => {
    try {
      await deactivateUser(uid);
      setMsg("Usuario desactivado");
      setItems(items.map(u => u.id === uid ? { ...u, estado: "Inactivo" } : u));
    } catch {
      setError("No se pudo desactivar usuario");
    }
  };

  const onResetPassword = async (uid) => {
    try {
      const { link } = await resetPasswordUser(uid);
      setMsg("Enlace de reseteo generado");
      window.open(link, "_blank");
    } catch {
      setError("No se pudo generar enlace de reseteo");
    }
  };

  if (loading) return <Layout><div>Cargando…</div></Layout>;
  if (error) return <Layout><div className="text-red-600">{error}</div></Layout>;

  return (
    <Layout>
      <h2>Usuarios</h2>
      {msg && <div className="text-green-700 mb-2">{msg}</div>}
      <table className="w-full">
        <thead>
          <tr><th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {items.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.nombre || '-'}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.role || ''} onChange={e=>onChangeRole(u.id, e.target.value)}>
                  <option value="">(sin rol)</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Tecnico">Tecnico</option>
                  <option value="Supervisor">Supervisor</option>
                </select>
              </td>
              <td>{u.estado || 'Activo'}</td>
              <td>{u.ultimoAcceso ? new Date(u.ultimoAcceso.seconds ? u.ultimoAcceso.seconds*1000 : u.ultimoAcceso).toLocaleString() : '-'}</td>
              <td>
                <button className="btn" onClick={()=>onResetPassword(u.id)}>Restablecer contraseña</button>
                <button className="btn" style={{ marginLeft: 8 }} onClick={()=>onDeactivate(u.id)}>Desactivar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
};

export default UsersList;