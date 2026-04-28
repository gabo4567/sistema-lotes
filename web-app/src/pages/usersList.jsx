import React, { useEffect, useState, useMemo } from "react";
import { getUsers, deactivateUser, resetPasswordUser, activateUser } from "../services/users.service";
import { notify } from "../utils/alerts";
import { getProductorByIpt, resetPasswordProductor } from "../services/productores.service";
import HomeButton from "../components/HomeButton";
import { confirmDialog } from "../utils/alerts";


const UsersList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  // Estados para filtros
  const [filtros, setFiltros] = useState({
    nombre: "",
    rol: "todos"
  });

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
          else if (u?.activo === true && cur?.activo !== true) map.set(key, u);
        });
        // Excluir explícitamente al usuario indicado: nombre Gabriel y email gabriel@example.com
        return Array.from(map.values()).filter(u => !(norm(u?.nombre)==='gabriel' && norm(u?.email)==='gabriel@example.com'));
      };
      setItems(dedup());
    } catch {
      setError("No se pudieron cargar usuarios");
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, []);

  const itemsFiltrados = useMemo(() => {
    return items.filter(u => {
      // Filtro por nombre
      if (filtros.nombre) {
        const search = filtros.nombre.toLowerCase();
        const matchNombre = (u.nombre || '').toLowerCase().includes(search);
        const matchEmail = (u.email || '').toLowerCase().includes(search);
        if (!matchNombre && !matchEmail) return false;
      }
      // Filtro por rol
      if (filtros.rol !== 'todos') {
        if (String(u.role || '').toLowerCase() !== filtros.rol.toLowerCase()) return false;
      }
      return true;
    });
  }, [items, filtros]);

  const onDeactivate = async (uid) => {
    const u = items.find(x=>x.id===uid);
    if (u?.activo === false) {
      await notify({ title: 'El usuario ya está desactivado', icon: 'info' });
      return;
    }
    const ok = await confirmDialog({ title: "¿Estás seguro?", text: `¿Desactivar al usuario ${u?.nombre || u?.email || uid}?`, icon: "warning", confirmButtonText: "Desactivar", cancelButtonText: "Cancelar" });
    if (!ok) return;
    try {
      await deactivateUser(uid);
      setMsg("Usuario desactivado");
      setItems(items.map(u => u.id === uid ? { ...u, activo: false } : u));
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
      } catch { null }
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

  const onActivate = async (uid, activo) => {
    if (activo === true) {
      await notify({ title: 'El usuario está activo', icon: 'info' });
      return;
    }
    const ok = await confirmDialog({ title: '¿Estás seguro de que deseas activar este usuario?', text: '', icon: 'warning', confirmButtonText: 'Activar', cancelButtonText: 'Cancelar' });
    if (!ok) return;
    try {
      await activateUser(uid);
      setMsg('Usuario activado');
      setItems(items.map(u => u.id === uid ? { ...u, activo: true } : u));
    } catch {
      setError('No se pudo activar usuario');
    }
  };
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
    <div className="users-list page-container" style={{ width: '100%' }}>
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <h2 className="users-title">Gestión de Usuarios</h2>
      <div className="filters-bar" style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 12, 
        backgroundColor: '#f8fafc', 
        padding: 16, 
        borderRadius: 12, 
        marginBottom: 20,
        border: '1px solid #e2e8f0',
        alignItems: 'flex-end'
      }}>
        <div className="filter-item" style={{ flex: 1, minWidth: 250 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Nombre / Email</label>
          <input 
            type="text" 
            className="input-inst" 
            placeholder="Buscar por nombre o email..."
            value={filtros.nombre}
            onChange={e => setFiltros({ ...filtros, nombre: e.target.value })}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 16 }}
          />
        </div>

        <div className="filter-item" style={{ width: 200 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Rol</label>
          <select 
            className="select-inst" 
            value={filtros.rol}
            onChange={e => setFiltros({ ...filtros, rol: e.target.value })}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 16 }}
          >
            <option value="todos">Todos los roles</option>
            <option value="Administrador">Administrador</option>
            <option value="Productor">Productor</option>
          </select>
        </div>

        <button 
          className="btn secondary" 
          onClick={() => setFiltros({ nombre: '', rol: 'todos' })}
          style={{ height: 38, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          Limpiar Filtros
        </button>
      </div>

      {msg && <div className="users-msg ok">{msg}</div>}
      {error && <div className="users-msg err">{error}</div>}

      {loading ? (
        <div style={{ padding: 16, color:'#166534', textAlign: 'center' }}>Cargando usuarios...</div>
      ) : (
        <div className="table-wrap" style={{ width: '100%' }}>
          <table className="table-inst" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Nombre</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>IPT</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Email</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Rol</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Estado</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Último acceso</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {itemsFiltrados.map(u => (
                <tr key={u.id}>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{u.nombre || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{u.ipt || u.productorIpt || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{u.email}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                    {String(u.role || '').toLowerCase() === 'productor' ? (
                      <span>{u.role || '-'}</span>
                    ) : (
                      <span>Administrador</span>
                    )}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{u.activo !== false ? 'Activo' : 'Inactivo'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{formatTimestamp(u.ultimoAcceso)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                    <div className="actions-col" style={{ display:'grid', gridTemplateColumns:'auto auto', gap:8, justifyItems:'center', alignItems:'center' }}>
                      <button className="btn btn-compact" onClick={()=>onActivate(u.id, u.activo)}>Activar</button>
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
      )}
    </div>
  );
};

export default UsersList;
