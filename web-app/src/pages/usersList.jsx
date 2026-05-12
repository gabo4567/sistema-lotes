import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  activateUser,
  createUser,
  deactivateUser,
  getUsers,
  resetPasswordUser,
  updateUser,
} from "../services/users.service";
import { notify, confirmDialog } from "../utils/alerts";
import HomeButton from "../components/HomeButton";
import { AuthContext } from "../contexts/AuthContextBase";

const emptyCreateForm = { nombre: "", email: "", password: "", activo: true };

const UsersList = () => {
  const { user } = useContext(AuthContext);
  const currentUid = user?.uid;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [filtros, setFiltros] = useState({ nombre: "" });
  const [modal, setModal] = useState(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState({ uid: "", nombre: "", activo: true });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const data = await getUsers();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const itemsFiltrados = useMemo(() => {
    const search = filtros.nombre.trim().toLowerCase();
    if (!search) return items;
    return items.filter((u) => {
      const nombre = String(u.nombre || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      return nombre.includes(search) || email.includes(search);
    });
  }, [items, filtros]);

  const openCreate = () => {
    setCreateForm(emptyCreateForm);
    setFormError("");
    setModal("create");
  };

  const openEdit = (u) => {
    setEditForm({ uid: u.id, nombre: u.nombre || "", activo: u.activo !== false });
    setFormError("");
    setModal("edit");
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
    setFormError("");
  };

  const onCreate = async () => {
    const nombre = createForm.nombre.trim();
    const email = createForm.email.trim().toLowerCase();
    const password = createForm.password;
    if (!nombre) return setFormError("Ingrese el nombre del administrador.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setFormError("Ingrese un email valido.");
    if (password.length < 6) return setFormError("La contrasena debe tener al menos 6 caracteres.");

    setSaving(true);
    setFormError("");
    try {
      await createUser({ nombre, email, password, activo: createForm.activo });
      setMsg("Administrador creado");
      setModal(null);
      setCreateForm(emptyCreateForm);
      await load();
    } catch (e) {
      setFormError(e?.message || "No se pudo crear el administrador");
    } finally {
      setSaving(false);
    }
  };

  const onSaveEdit = async () => {
    const nombre = editForm.nombre.trim();
    if (!nombre) return setFormError("El nombre no puede estar vacio.");
    if (editForm.uid === currentUid && editForm.activo === false) {
      return setFormError("No puede desactivar su propio usuario.");
    }

    setSaving(true);
    setFormError("");
    try {
      await updateUser(editForm.uid, { nombre, activo: editForm.activo });
      setItems(items.map((u) => (u.id === editForm.uid ? { ...u, nombre, activo: editForm.activo } : u)));
      setMsg("Administrador actualizado");
      setModal(null);
    } catch (e) {
      setFormError(e?.message || "No se pudo actualizar el administrador");
    } finally {
      setSaving(false);
    }
  };

  const onDeactivate = async (uid) => {
    const u = items.find((x) => x.id === uid);
    if (uid === currentUid) {
      await notify({ title: "No puede desactivar su propio usuario", icon: "error" });
      return;
    }
    if (u?.activo === false) {
      await notify({ title: "El usuario ya esta desactivado", icon: "info" });
      return;
    }
    const ok = await confirmDialog({
      title: "Desactivar administrador",
      text: `Desactivar a ${u?.nombre || u?.email || uid}?`,
      icon: "warning",
      confirmButtonText: "Desactivar",
      cancelButtonText: "Cancelar",
    });
    if (!ok) return;
    try {
      await deactivateUser(uid);
      setMsg("Usuario desactivado");
      setItems(items.map((item) => (item.id === uid ? { ...item, activo: false } : item)));
    } catch (e) {
      setError(e?.message || "No se pudo desactivar usuario");
    }
  };

  const onActivate = async (uid, activo) => {
    if (activo === true) {
      await notify({ title: "El usuario esta activo", icon: "info" });
      return;
    }
    const ok = await confirmDialog({
      title: "Activar administrador",
      text: "",
      icon: "warning",
      confirmButtonText: "Activar",
      cancelButtonText: "Cancelar",
    });
    if (!ok) return;
    try {
      await activateUser(uid);
      setMsg("Usuario activado");
      setItems(items.map((item) => (item.id === uid ? { ...item, activo: true } : item)));
    } catch (e) {
      setError(e?.message || "No se pudo activar usuario");
    }
  };

  const onResetPassword = async (uid) => {
    const u = items.find((x) => x.id === uid);
    const ok = await confirmDialog({
      title: "Restablecer contrase\u00f1a",
      text: `Generar enlace para ${u?.nombre || u?.email || uid}?`,
      icon: "warning",
      confirmButtonText: "Restablecer",
      cancelButtonText: "Cancelar",
    });
    if (!ok) return;
    try {
      const { link } = await resetPasswordUser(uid);
      setMsg("Enlace de reseteo generado");
      window.open(link, "_blank");
    } catch (e) {
      setError(e?.message || "No se pudo generar enlace de reseteo");
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "-";
    try {
      const d = typeof ts.toDate === "function" ? ts.toDate()
        : typeof ts.seconds === "number" ? new Date(ts.seconds * 1000)
          : typeof ts._seconds === "number" ? new Date(ts._seconds * 1000)
            : typeof ts === "number" ? new Date(ts)
              : new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
    } catch {
      return "-";
    }
  };

  return (
    <div className="users-list-container">
      {/* Header */}
      <div className="users-header-row">
        <div className="users-header-left">
          <HomeButton />
          <div className="users-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2.2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4V21"></path>
              <circle cx="12" cy="7.2" r="3.4"></circle>
            </svg>
          </div>
          <div className="users-header-titles">
            <h1 className="main-title">Gestión de Usuarios</h1>
            <p className="subtitle">Administrá los usuarios del sistema y sus permisos.</p>
          </div>
        </div>
        <button className="btn-new-user" onClick={openCreate}>
          <span className="plus-icon">+</span> Nuevo usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="users-filters-card">
        <div className="filter-group">
          <label>Nombre / Email</label>
          <div className="search-input-wrapper">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={filtros.nombre}
              onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })}
            />
          </div>
        </div>
        <button className="btn-clear-filters" onClick={() => setFiltros({ nombre: "" })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z"></path>
          </svg>
          Limpiar filtros
        </button>
      </div>

      {msg && <div className="alert-box success">{msg}</div>}
      {error && <div className="alert-box error">{error}</div>}

      {/* Tabla */}
      <div className="users-table-card">
        {loading ? (
          <div className="loading-state">Cargando usuarios...</div>
        ) : (
          <div className="table-responsive">
            <table className="users-table">
              <thead>
                <tr>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      Nombre
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                      Email
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                      Rol
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7"></path>
                        <circle cx="18" cy="18" r="4"></circle>
                      </svg>
                      Estado
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      Último acceso
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                      Acciones
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.map((u) => {
                  const initials = (u.nombre || u.email || "??").split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
                  const isUserActive = u.activo !== false;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-info-cell">
                          <div className="user-avatar">{initials}</div>
                          <span className="user-name">{u.nombre || "Sin nombre"}</span>
                          <button className="btn-icon-edit" onClick={() => openEdit(u)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                        </div>
                      </td>
                      <td><span className="user-email">{u.email}</span></td>
                      <td><span className="user-role">Administrador</span></td>
                      <td>
                        <div className={`status-badge ${isUserActive ? 'active' : 'inactive'}`}>
                          <span className="dot"></span>
                          {isUserActive ? "Activo" : "Inactivo"}
                        </div>
                      </td>
                      <td><span className="user-date">{formatTimestamp(u.ultimoAcceso)}</span></td>
                      <td>
                        <div className="user-actions">
                          <div className="action-buttons-row">
                            <button className="btn-action-activate" onClick={() => onActivate(u.id, u.activo)} disabled={isUserActive}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
                              Activar
                            </button>
                            <button className="btn-action-deactivate" onClick={() => onDeactivate(u.id)} disabled={!isUserActive}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line></svg>
                              Desactivar
                            </button>
                          </div>
                          <button className="btn-action-reset" onClick={() => onResetPassword(u.id)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            Restablecer contraseña
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="table-footer">
          <span className="pagination-info">Total: {itemsFiltrados.length} usuarios</span>
        </div>
      </div>

      {/* Modales - Se mantienen pero se les puede aplicar el estilo de los otros */}
      {modal && (
        <div className="insumos-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="insumos-modal" role="dialog" aria-modal="true">
            {modal === "create" ? (
              <div>
                <h3 style={{ marginTop: 0 }}>Nuevo usuario</h3>
                <input className="input-inst" placeholder="Nombre completo" value={createForm.nombre} onChange={(e) => { setCreateForm({ ...createForm, nombre: e.target.value }); setFormError(""); }} />
                <input className="input-inst" placeholder="Email institucional" type="email" value={createForm.email} onChange={(e) => { setCreateForm({ ...createForm, email: e.target.value }); setFormError(""); }} />
                <input className="input-inst" placeholder="Contraseña temporal" type="password" value={createForm.password} onChange={(e) => { setCreateForm({ ...createForm, password: e.target.value }); setFormError(""); }} />
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700, color: "#334155" }}>
                  <input type="checkbox" checked={createForm.activo} onChange={(e) => setCreateForm({ ...createForm, activo: e.target.checked })} />
                  Activo
                </label>
                {formError ? <div style={{ color: "#b91c1c", fontSize: 13, fontWeight: 700, marginTop: 8 }}>{formError}</div> : null}
                <div className="form-actions" style={{ marginTop: 16 }}>
                  <button type="button" className="btn-modal-cancel" onClick={closeModal} disabled={saving}>Cancelar</button>
                  <button type="button" className="btn-modal-confirm" onClick={onCreate} disabled={saving}>{saving ? "Guardando..." : "Crear"}</button>
                </div>
              </div>
            ) : (
              <div>
                <h3 style={{ marginTop: 0 }}>Editar usuario</h3>
                <div style={{ marginBottom: 15 }}>
                  <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: "#64748b" }}>Nombre</label>
                  <input className="input-inst" placeholder="Nombre completo" value={editForm.nombre} onChange={(e) => { setEditForm({ ...editForm, nombre: e.target.value }); setFormError(""); }} />
                </div>
                <div style={{ marginBottom: 15 }}>
                  <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: "#64748b" }}>Estado</label>
                  <select className="select-inst" value={editForm.activo ? "true" : "false"} onChange={(e) => { setEditForm({ ...editForm, activo: e.target.value === "true" }); setFormError(""); }}>
                    <option value="true">Activo</option>
                    <option value="false" disabled={editForm.uid === currentUid}>Inactivo</option>
                  </select>
                </div>
                {formError ? <div style={{ color: "#b91c1c", fontSize: 13, fontWeight: 700, marginTop: 8 }}>{formError}</div> : null}
                <div className="form-actions" style={{ marginTop: 16 }}>
                  <button type="button" className="btn-modal-cancel" onClick={closeModal} disabled={saving}>Cancelar</button>
                  <button type="button" className="btn-modal-confirm" onClick={onSaveEdit} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersList;
