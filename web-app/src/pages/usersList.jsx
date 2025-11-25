import React, { useEffect, useState } from "react";
import { getUsers, updateUser, deactivateUser, resetPasswordUser, activateUser } from "../services/users.service";
import { notify } from "../utils/alerts";
import { getProductorByIpt, resetPasswordProductor } from "../services/productores.service";
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
      const arr = Array.isArray(data) ? data : [];
      const dedup = () => {
        const map = new Map();
        const norm = (e)=>String(e||'').toLowerCase();
        arr.forEach(u=>{
          const key = norm(u.email);
          if (!key) { map.set(`${u.id}_${Math.random()}`, u); return; }
          const cur = map.get(key);
          if (!cur) { map.set(key, u); return; }
          const preferJuanGabriel = (x)=> norm(x?.nombre)==='juan gabriel' && norm(x?.role)==='productor';
          if (preferJuanGabriel(u)) map.set(key, u);
          else if (preferJuanGabriel(cur)) map.set(key, cur);
          else if (norm(u?.estado)==='activo' && norm(cur?.estado)!=='activo') map.set(key, u);
        });
        // Excluir explícitamente al usuario indicado: nombre Gabriel y email gabriel@example.com
        return Array.from(map.values()).filter(u => !(norm(u?.nombre)==='gabriel' && norm(u?.email)==='gabriel@example.com'));
      };
      setItems(dedup());
    } catch (e) {
      setError("No se pudieron cargar usuarios");
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, []);

  const onChangeRole = async (uid, role) => {
    try {
      const payload = { role };
      const usr = items.find(u=>u.id===uid);
      const okAssign = await confirmDialog({ title: '¿Estás seguro?', text: `¿Estás seguro de que deseas asignar el rol ${role} al usuario ${usr?.nombre || usr?.email || uid}?`, icon: 'warning', confirmButtonText: 'Asignar', cancelButtonText: 'Cancelar' });
      if (!okAssign) return;
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
    const u = items.find(x=>x.id===uid);
    if (String(u?.estado||'').toLowerCase()==='inactivo') {
      await notify({ title: 'El usuario ya está desactivado', icon: 'info' });
      return;
    }
    const ok = await confirmDialog({ title: "¿Estás seguro?", text: `¿Desactivar al usuario ${u?.nombre || u?.email || uid}?`, icon: "warning", confirmButtonText: "Desactivar", cancelButtonText: "Cancelar" });
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
    const u = items.find(x=>x.id===uid);
    const roleNorm = String(u?.role||'').toLowerCase();
    const iptUse = u?.ipt || u?.productorIpt;
    if (roleNorm === 'productor') {
      if (!iptUse) { await notify({ title: 'Este productor no tiene IPT asociado', icon: 'warning' }); return; }
      try {
        const { data } = await getProductorByIpt(iptUse);
        if (data && (data.requiereCambioContrasena === true)) {
          await notify({ title: 'La contraseña ya está establecida a su CUIL', icon: 'info' });
          return;
        }
      } catch {}
      const ok = await confirmDialog({ title: "¿Estás seguro?", text: `¿Restablecer la contraseña del productor ${u?.nombre || u?.email || uid} a su CUIL?`, icon: "warning", confirmButtonText: "Restablecer", cancelButtonText: "Cancelar" });
      if (!ok) return;
      try {
        await resetPasswordProductor(iptUse);
        await notify({ title: 'Contraseña del productor establecida a su CUIL', icon: 'success' });
      } catch {
        setError("No se pudo restablecer contraseña del productor");
      }
      return;
    }
    const ok = await confirmDialog({ title: "¿Estás seguro?", text: `¿Restablecer la contraseña del usuario ${u?.nombre || u?.email || uid}?`, icon: "warning", confirmButtonText: "Restablecer", cancelButtonText: "Cancelar" });
    if (!ok) return;
    try {
      const { link } = await resetPasswordUser(uid);
      setMsg("Enlace de reseteo generado");
      window.open(link, "_blank");
    } catch {
      setError("No se pudo generar enlace de reseteo");
    }
  };

  const onActivate = async (uid, estado) => {
    if (String(estado || '').toLowerCase() === 'activo') {
      await notify({ title: 'El usuario está activo', icon: 'info' });
      return;
    }
    const ok = await confirmDialog({ title: '¿Estás seguro de que deseas activar este usuario?', text: '', icon: 'warning', confirmButtonText: 'Activar', cancelButtonText: 'Cancelar' });
    if (!ok) return;
    try {
      await activateUser(uid);
      setMsg('Usuario activado');
      setItems(items.map(u => u.id === uid ? { ...u, estado: 'Activo' } : u));
    } catch {
      setError('No se pudo activar usuario');
    }
  };
  if (loading) return <div>Cargando usuarios...</div>;
  if (error) return <div className="text-red-700">{error}</div>;

  const formatTimestamp = (ts) => {
    if (!ts) return "-";
    try {
      const d = typeof ts.toDate === "function" ? ts.toDate()
        : typeof ts.seconds === "number" ? new Date(ts.seconds * 1000)
        : typeof ts._seconds === "number" ? new Date(ts._seconds * 1000)
        : typeof ts === "number" ? new Date(ts)
        : new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2,'0');
      const min = String(d.getMinutes()).padStart(2,'0');
      const ss = String(d.getSeconds()).padStart(2,'0');
      return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss}`;
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
                  <div className="actions-col" style={{ display:'grid', gridTemplateColumns:'auto auto', gap:8, justifyItems:'center', alignItems:'center' }}>
                    <button className="btn btn-compact" onClick={()=>onActivate(u.id, u.estado)}>Activar</button>
                    <button className="btn btn-danger btn-compact" onClick={()=>onDeactivate(u.id)}>Desactivar</button>
                    <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'center' }}>
                      <button className="btn" onClick={()=>onResetPassword(u.id)}>Restablecer contraseña</button>
                    </div>
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
