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
    <div className="users-list page-container" style={{ width: "100%" }}>
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <h2 className="users-title" style={{ margin: 0 }}>Gestion de Usuarios</h2>
        <button className="btn" onClick={openCreate}>Nuevo administrador</button>
      </div>

      <div className="filters-bar" style={{ display: "flex", flexWrap: "wrap", gap: 12, backgroundColor: "#f8fafc", padding: 16, borderRadius: 12, marginBottom: 20, border: "1px solid #e2e8f0", alignItems: "flex-end" }}>
        <div className="filter-item" style={{ flex: 1, minWidth: 250 }}>
          <label style={{ display: "block", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Nombre / Email</label>
          <input
            type="text"
            className="input-inst"
            placeholder="Buscar por nombre o email..."
            value={filtros.nombre}
            onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 17 }}
          />
        </div>
        <button className="btn secondary" onClick={() => setFiltros({ nombre: "" })} style={{ height: 38 }}>
          Limpiar filtros
        </button>
      </div>

      {msg && <div className="users-msg ok">{msg}</div>}
      {error && <div className="users-msg err">{error}</div>}

      {loading ? (
        <div style={{ padding: 16, color: "#166534", textAlign: "center" }}>Cargando usuarios...</div>
      ) : (
        <div className="table-wrap" style={{ width: "100%" }}>
          <table className="table-inst" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>Nombre</th>
                <th style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>Email</th>
                <th style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>Rol</th>
                <th style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>Estado</th>
                <th style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>Ultimo acceso</th>
                <th style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {itemsFiltrados.map((u) => {
                return (
                  <tr key={u.id}>
                    <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "center" }}>{u.nombre || "Sin nombre"}</td>
                    <td style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>{u.email}</td>
                    <td style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>Administrador</td>
                    <td style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>{u.activo !== false ? "Activo" : "Inactivo"}</td>
                    <td style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>{formatTimestamp(u.ultimoAcceso)}</td>
                    <td style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <button className="btn btn-compact" onClick={() => openEdit(u)} style={{ minWidth: 212 }}>Editar</button>
                        <button className="btn btn-compact" onClick={() => onResetPassword(u.id)} style={{ minWidth: 212 }}>
                          Restablecer contraseña
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {itemsFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 18, textAlign: "center", color: "#64748b" }}>No se encontraron administradores.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div className="insumos-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="insumos-modal" role="dialog" aria-modal="true">
            {modal === "create" ? (
              <div>
                <h3 style={{ marginTop: 0 }}>Nuevo administrador</h3>
                <input className="input-inst" placeholder="Nombre completo" value={createForm.nombre} onChange={(e) => { setCreateForm({ ...createForm, nombre: e.target.value }); setFormError(""); }} />
                <input className="input-inst" placeholder="Email institucional" type="email" value={createForm.email} onChange={(e) => { setCreateForm({ ...createForm, email: e.target.value }); setFormError(""); }} />
                <input className="input-inst" placeholder="Contrasena temporal" type="password" value={createForm.password} onChange={(e) => { setCreateForm({ ...createForm, password: e.target.value }); setFormError(""); }} />
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700, color: "#334155" }}>
                  <input type="checkbox" checked={createForm.activo} onChange={(e) => setCreateForm({ ...createForm, activo: e.target.checked })} />
                  Activo
                </label>
                {formError ? <div style={{ gridColumn: "1 / -1", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{formError}</div> : null}
                <div className="form-actions" style={{ marginTop: 8 }}>
                  <button type="button" onClick={closeModal} disabled={saving}>Cancelar</button>
                  <button type="button" onClick={onCreate} disabled={saving}>{saving ? "Guardando..." : "Crear"}</button>
                </div>
              </div>
            ) : (
              <div>
                <h3 style={{ marginTop: 0 }}>Editar administrador</h3>
                <div>
                  <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: "#64748b" }}>Nombre</label>
                  <input className="input-inst" placeholder="Nombre completo" value={editForm.nombre} onChange={(e) => { setEditForm({ ...editForm, nombre: e.target.value }); setFormError(""); }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: "#64748b" }}>Estado</label>
                  <select className="select-inst" value={editForm.activo ? "true" : "false"} onChange={(e) => { setEditForm({ ...editForm, activo: e.target.value === "true" }); setFormError(""); }}>
                    <option value="true">Activo</option>
                    <option value="false" disabled={editForm.uid === currentUid}>Inactivo</option>
                  </select>
                </div>
                {formError ? <div style={{ gridColumn: "1 / -1", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{formError}</div> : null}
                <div className="form-actions" style={{ marginTop: 8 }}>
                  <button type="button" onClick={closeModal} disabled={saving}>Cancelar</button>
                  <button type="button" onClick={onSaveEdit} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UsersList;
