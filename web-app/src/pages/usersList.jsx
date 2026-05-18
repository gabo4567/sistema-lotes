import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  activateUser,
  createUser,
  deactivateUser,
  getUsers,
  resetPasswordUser,
  updateUserPermisos,
  updateUserRole,
  updateUser,
} from "../services/users.service";
import { notify, confirmDialog } from "../utils/alerts";
import { AuthContext } from "../contexts/AuthContextBase";
import LoadingState from "../components/LoadingState";
import DismissibleAlert from "../components/DismissibleAlert";

const emptyCreateForm = { nombre: "", email: "", password: "", activo: true };

const PERMISSION_KEYS = ["turnos", "productores", "insumos", "lotes", "users", "informes"];
const PERMISSION_LABELS = {
  turnos: "Turnos",
  productores: "Productores",
  insumos: "Insumos",
  lotes: "Lotes",
  users: "Usuarios",
  informes: "Informes",
};
const FULL_ADMIN_PERMISOS = {
  turnos: true,
  productores: true,
  insumos: true,
  lotes: true,
  users: true,
  informes: true,
};
const PROTECTED_ADMIN_EMAILS = new Set(["gabrielparedok@gmail.com"]);

const normalizeRole = (role) => {
  return String(role || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const normalizePermisos = (permisos = {}) => {
  return PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(permisos?.[key]);
    return acc;
  }, {});
};

const getRoleLabel = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === "administrador limitado") return "Administrador limitado";
  return "Administrador";
};

const UsersList = () => {
  const { user } = useContext(AuthContext);
  const currentUid = user?.uid;
  const canManageAccess = normalizeRole(user?.role) === "administrador" && user?.permisos?.users === true;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [filtros, setFiltros] = useState({ nombre: "", rol: "todos", estado: "todos", acceso: "todos" });
  const [quickFilter, setQuickFilter] = useState("todos");
  const [sortConfig, setSortConfig] = useState({ key: "nombre", direction: "asc" });
  const [modal, setModal] = useState(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState({ uid: "", nombre: "", activo: true });
  const [permissionsForm, setPermissionsForm] = useState({ uid: "", permisos: normalizePermisos() });
  const [roleForm, setRoleForm] = useState({ uid: "", role: "administrador" });
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

  const timestampValue = (ts) => {
    if (!ts) return 0;
    try {
      const d = typeof ts.toDate === "function" ? ts.toDate()
        : typeof ts.seconds === "number" ? new Date(ts.seconds * 1000)
          : typeof ts._seconds === "number" ? new Date(ts._seconds * 1000)
            : typeof ts === "number" ? new Date(ts)
              : new Date(ts);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    } catch {
      return 0;
    }
  };

  const hasUltimoAcceso = (u) => timestampValue(u?.ultimoAcceso) > 0;
  const isActivo = (u) => u?.activo !== false;
  const isAdministrador = (u) => normalizeRole(u?.role) === "administrador";
  const hasPermisosPersonalizados = (u) => normalizeRole(u?.role) === "administrador limitado";
  const normalizeText = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isProtectedAdmin = (u) => {
    const email = String(u?.email || "").trim().toLowerCase();
    return Boolean(u?.protectedAdmin || u?.adminPrincipal || u?.primaryAdmin || PROTECTED_ADMIN_EMAILS.has(email));
  };

  const estadoLabel = (u) => (isActivo(u) ? "Activo" : "Inactivo");
  const estadoClass = (u) => (isActivo(u) ? "is-active" : "is-inactive");
  const roleClass = (u) => (isAdministrador(u) ? "is-admin" : "is-limited");

  const sortMark = (key) => (
    sortConfig.key === key ? (sortConfig.direction === "asc" ? "^" : "v") : ""
  );

  const onSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const usersSummary = useMemo(() => {
    const base = Array.isArray(items) ? items : [];
    return base.reduce((acc, u) => {
      acc.total += 1;
      if (isActivo(u)) acc.activos += 1;
      else acc.inactivos += 1;
      if (isAdministrador(u)) acc.administradores += 1;
      if (hasPermisosPersonalizados(u)) acc.personalizados += 1;
      if (isActivo(u) && !hasUltimoAcceso(u)) acc.sinUltimoAcceso += 1;
      return acc;
    }, {
      total: 0,
      activos: 0,
      inactivos: 0,
      administradores: 0,
      personalizados: 0,
      sinUltimoAcceso: 0,
    });
  }, [items]);

  const itemsFiltrados = useMemo(() => {
    const search = filtros.nombre.trim().toLowerCase();
    const filtered = items.filter((u) => {
      const nombre = String(u.nombre || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      const okSearch = search ? nombre.includes(search) || email.includes(search) : true;
      const okRol = filtros.rol === "todos"
        ? true
        : filtros.rol === "administrador"
          ? isAdministrador(u)
          : hasPermisosPersonalizados(u);
      const okEstado = filtros.estado === "todos"
        ? true
        : filtros.estado === "activos"
          ? isActivo(u)
          : !isActivo(u);
      const okAcceso = filtros.acceso === "todos"
        ? true
        : filtros.acceso === "con"
          ? hasUltimoAcceso(u)
          : !hasUltimoAcceso(u);
      const okQuick = (() => {
        if (quickFilter === "activos") return isActivo(u);
        if (quickFilter === "inactivos") return !isActivo(u);
        if (quickFilter === "administradores") return isAdministrador(u);
        if (quickFilter === "sinUltimoAcceso") return !hasUltimoAcceso(u);
        if (quickFilter === "personalizados") return hasPermisosPersonalizados(u);
        return true;
      })();
      return okSearch && okRol && okEstado && okAcceso && okQuick;
    });

    return [...filtered].sort((a, b) => {
      const getValue = (u) => {
        if (sortConfig.key === "nombre") return normalizeText(u?.nombre);
        if (sortConfig.key === "email") return normalizeText(u?.email);
        if (sortConfig.key === "rol") return normalizeText(getRoleLabel(u?.role));
        if (sortConfig.key === "estado") return estadoLabel(u);
        if (sortConfig.key === "ultimoAcceso") return timestampValue(u?.ultimoAcceso);
        return "";
      };
      const aValue = getValue(a);
      const bValue = getValue(b);
      const compare = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), "es", { numeric: true, sensitivity: "base" });
      return sortConfig.direction === "asc" ? compare : -compare;
    });
  }, [items, filtros, quickFilter, sortConfig]);

  const quickFilters = [
    { key: "todos", label: "Todos", count: usersSummary.total },
    { key: "activos", label: "Activos", count: usersSummary.activos },
    { key: "inactivos", label: "Inactivos", count: usersSummary.inactivos },
    { key: "administradores", label: "Administradores", count: usersSummary.administradores },
    { key: "sinUltimoAcceso", label: "Sin ultimo acceso", count: usersSummary.sinUltimoAcceso },
    { key: "personalizados", label: "Permisos personalizados", count: usersSummary.personalizados },
  ];

  const clearFilters = () => {
    setFiltros({ nombre: "", rol: "todos", estado: "todos", acceso: "todos" });
    setQuickFilter("todos");
    setSortConfig({ key: "nombre", direction: "asc" });
  };
  const setUsersOrder = (value) => {
    const [key, direction] = String(value || "nombre:asc").split(":");
    setSortConfig({ key, direction: direction || "asc" });
  };
  const usersOrderValue = `${sortConfig.key}:${sortConfig.direction}`;

  const openCreate = () => {
    setCreateForm(emptyCreateForm);
    setFormError("");
    setModal("create");
  };

  const openEdit = (u) => {
    if (isProtectedAdmin(u) && u.id !== currentUid) {
      notify({ title: "Este administrador principal esta protegido", icon: "info" });
      return;
    }
    setEditForm({ uid: u.id, nombre: u.nombre || "", activo: u.activo !== false });
    setFormError("");
    setModal("edit");
  };

  const openPermissions = (u) => {
    if (isProtectedAdmin(u)) {
      notify({ title: "Los permisos del administrador principal estan protegidos", icon: "info" });
      return;
    }
    setPermissionsForm({
      uid: u.id,
      permisos: normalizeRole(u.role) === "administrador"
        ? { ...FULL_ADMIN_PERMISOS }
        : normalizePermisos(u.permisos),
    });
    setFormError("");
    setModal("permissions");
  };

  const openRole = (u) => {
    if (isProtectedAdmin(u)) {
      notify({ title: "El rol del administrador principal esta protegido", icon: "info" });
      return;
    }
    setRoleForm({
      uid: u.id,
      role: normalizeRole(u.role) === "administrador limitado"
        ? "administrador limitado"
        : "administrador",
    });
    setFormError("");
    setModal("role");
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

  const onSavePermissions = async () => {
    const target = items.find((u) => u.id === permissionsForm.uid);
    if (!target) return setFormError("Usuario no encontrado.");
    if (isProtectedAdmin(target)) {
      return setFormError("Los permisos del administrador principal estan protegidos.");
    }
    if (permissionsForm.uid === currentUid) {
      return setFormError("No puede editar sus propios permisos.");
    }
    if (normalizeRole(target.role) === "administrador") {
      return setFormError("Los permisos de un administrador completo no se editan manualmente.");
    }

    setSaving(true);
    setFormError("");
    try {
      const res = await updateUserPermisos(permissionsForm.uid, permissionsForm.permisos);
      setItems(items.map((u) => (
        u.id === permissionsForm.uid
          ? { ...u, permisos: normalizePermisos(res.permisos || permissionsForm.permisos) }
          : u
      )));
      setMsg("Permisos actualizados");
      setModal(null);
    } catch (e) {
      setFormError(e?.message || "No se pudieron actualizar los permisos");
    } finally {
      setSaving(false);
    }
  };

  const onSaveRole = async () => {
    const target = items.find((u) => u.id === roleForm.uid);
    if (isProtectedAdmin(target)) {
      return setFormError("El rol del administrador principal esta protegido.");
    }
    if (roleForm.uid === currentUid) {
      return setFormError("No puede editar su propio rol.");
    }

    setSaving(true);
    setFormError("");
    try {
      const res = await updateUserRole(roleForm.uid, roleForm.role);
      setItems(items.map((u) => (
        u.id === roleForm.uid
          ? { ...u, role: res.role || roleForm.role, permisos: normalizePermisos(res.permisos || u.permisos) }
          : u
      )));
      setMsg("Rol actualizado");
      setModal(null);
    } catch (e) {
      setFormError(e?.message || "No se pudo actualizar el rol");
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
    if (isProtectedAdmin(u)) {
      await notify({ title: "Este administrador principal esta protegido", icon: "error" });
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
    const u = items.find((x) => x.id === uid);
    if (isProtectedAdmin(u) && uid !== currentUid) {
      await notify({ title: "Este administrador principal esta protegido", icon: "error" });
      return;
    }
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
    if (isProtectedAdmin(u) && uid !== currentUid) {
      await notify({ title: "Este administrador principal esta protegido", icon: "error" });
      return;
    }
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
    <div className="usuarios-page page-container" style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h2 className="users-title" style={{ margin: 0 }}>Gestión de Usuarios</h2>
          <p className="section-subtitle">Administrá los accesos y permisos del personal autorizado.</p>
        </div>
        <button className="btn" onClick={openCreate}>+ Nuevo administrador</button>
      </div>

      <div className="turnos-summary usuarios-summary">
        <div className="turnos-summary__chip turnos-summary__chip--total">
          <span className="turnos-summary__label">Mostrados</span>
          <span className="estado-badge expired">{itemsFiltrados.length}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--completed">
          <span className="turnos-summary__label">Activos</span>
          <span className="estado-badge completed">{usersSummary.activos}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--expired">
          <span className="turnos-summary__label">Inactivos</span>
          <span className="estado-badge expired">{usersSummary.inactivos}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--confirmed">
          <span className="turnos-summary__label">Administradores</span>
          <span className="estado-badge confirmed">{usersSummary.administradores}</span>
        </div>
        <div className="turnos-summary__chip usuarios-summary__chip--warning">
          <span className="turnos-summary__label">Sin ultimo acceso</span>
          <span className="estado-badge expired">{usersSummary.sinUltimoAcceso}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--total">
          <span className="turnos-summary__label">Total</span>
          <span className="estado-badge expired">{usersSummary.total}</span>
        </div>
      </div>

      <div className="usuarios-quick-filters" aria-label="Filtros rapidos de usuarios">
        {quickFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`usuarios-filter-chip${quickFilter === filter.key ? " is-active" : ""}`}
            onClick={() => setQuickFilter(filter.key)}
          >
            <span>{filter.label}</span>
            <strong>{filter.count}</strong>
          </button>
        ))}
      </div>

      <div className="filters-bar usuarios-filters-bar" style={{ display: "flex", flexWrap: "wrap", gap: 10, backgroundColor: "#ffffff", padding: 18, borderRadius: 12, marginBottom: 20, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", alignItems: "flex-end" }}>
        <div className="filter-item" style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1.15 1 190px", minWidth: 170 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151" }}>Nombre / Email</label>
          <input
            type="text"
            className="input-inst"
            placeholder="Buscar por nombre o email..."
            value={filtros.nombre}
            onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 14, minHeight: 42, borderRadius: 8 }}
          />
        </div>
        <div className="filter-item" style={{ display: "flex", flexDirection: "column", gap: 6, flex: "0.95 1 160px", minWidth: 145 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151" }}>Rol</label>
          <select className="select-inst" value={filtros.rol} onChange={(e) => setFiltros({ ...filtros, rol: e.target.value })} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, minHeight: 42, borderRadius: 8 }}>
            <option value="todos">Todos los roles</option>
            <option value="administrador">Administradores</option>
            <option value="limitado">Administradores limitados</option>
          </select>
        </div>
        <div className="filter-item" style={{ display: "flex", flexDirection: "column", gap: 6, flex: "0.8 1 130px", minWidth: 120 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151" }}>Estado</label>
          <select className="select-inst" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, minHeight: 42, borderRadius: 8 }}>
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </div>
        <div className="filter-item" style={{ display: "flex", flexDirection: "column", gap: 6, flex: "0.9 1 150px", minWidth: 135 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151" }}>Último acceso</label>
          <select className="select-inst" value={filtros.acceso} onChange={(e) => setFiltros({ ...filtros, acceso: e.target.value })} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, minHeight: 42, borderRadius: 8 }}>
            <option value="todos">Todos</option>
            <option value="con">Con acceso</option>
            <option value="sin">Sin acceso</option>
          </select>
        </div>
        <div className="filter-item" style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 170px", minWidth: 155 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151" }}>Ordenar por</label>
          <select className="select-inst" value={usersOrderValue} onChange={(e) => setUsersOrder(e.target.value)} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, minHeight: 42, borderRadius: 8 }}>
            <option value="nombre:asc">Nombre A-Z</option>
            <option value="nombre:desc">Nombre Z-A</option>
            <option value="email:asc">Email A-Z</option>
            <option value="rol:asc">Rol</option>
            <option value="estado:asc">Estado</option>
            <option value="ultimoAcceso:desc">Último acceso reciente</option>
            <option value="ultimoAcceso:asc">Último acceso antiguo</option>
          </select>
        </div>
        <button className="btn secondary filter-clear-btn" onClick={clearFilters} style={{ minWidth: 132, height: 42, padding: "8px 14px" }}>
          Limpiar filtros
        </button>
      </div>

      {usersSummary.sinUltimoAcceso > 0 && (
        <DismissibleAlert className="usuarios-security-alert">
          Hay {usersSummary.sinUltimoAcceso} usuario{usersSummary.sinUltimoAcceso === 1 ? "" : "s"} activo{usersSummary.sinUltimoAcceso === 1 ? "" : "s"} sin ultimo acceso registrado.
        </DismissibleAlert>
      )}

      {msg && <DismissibleAlert className="users-msg ok">{msg}</DismissibleAlert>}
      {error && <DismissibleAlert className="users-msg err">{error}</DismissibleAlert>}

      {loading ? (
        <LoadingState
          title="Cargando usuarios..."
          message="Estamos preparando el listado de usuarios. Espera unos segundos."
        />
      ) : (
        <div className="table-wrap admin-data-table-wrap usuarios-table-wrap" style={{ width: "100%" }}>
          <table className="table-inst admin-data-table usuarios-data-table" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>
                  <button type="button" className="usuarios-sort-button" onClick={() => onSort("nombre")}>
                    <span>Nombre</span>
                    <span className="usuarios-sort-mark">{sortMark("nombre")}</span>
                  </button>
                </th>
                <th style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>
                  <button type="button" className="usuarios-sort-button" onClick={() => onSort("email")}>
                    <span>Email</span>
                    <span className="usuarios-sort-mark">{sortMark("email")}</span>
                  </button>
                </th>
                <th style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>
                  <button type="button" className="usuarios-sort-button" onClick={() => onSort("rol")}>
                    <span>Rol</span>
                    <span className="usuarios-sort-mark">{sortMark("rol")}</span>
                  </button>
                </th>
                <th style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>
                  <button type="button" className="usuarios-sort-button" onClick={() => onSort("estado")}>
                    <span>Estado</span>
                    <span className="usuarios-sort-mark">{sortMark("estado")}</span>
                  </button>
                </th>
                <th style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>
                  <button type="button" className="usuarios-sort-button" onClick={() => onSort("ultimoAcceso")}>
                    <span>Ultimo acceso</span>
                    <span className="usuarios-sort-mark">{sortMark("ultimoAcceso")}</span>
                  </button>
                </th>
                <th className="usuarios-actions-cell" style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {itemsFiltrados.map((u) => {
                const protectedAdmin = isProtectedAdmin(u);
                const protectedFromCurrentUser = protectedAdmin && u.id !== currentUid;
                return (
                  <tr key={u.id}>
                    <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "center" }}>{u.nombre || "Sin nombre"}</td>
                    <td style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>{u.email}</td>
                    <td style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>
                      <div style={{ display: "inline-flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                        <span className={`usuarios-role-badge ${roleClass(u)}`}>{getRoleLabel(u.role)}</span>
                        {protectedAdmin ? <span className="usuarios-protected-badge">Principal</span> : null}
                      </div>
                    </td>
                    <td style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>
                      <span className={`usuarios-status-badge ${estadoClass(u)}`}>{estadoLabel(u)}</span>
                    </td>
                    <td style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>
                      {hasUltimoAcceso(u) ? formatTimestamp(u.ultimoAcceso) : <span className="usuarios-access-badge">Sin acceso registrado</span>}
                    </td>
                    <td className="usuarios-actions-cell" style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>
                      <div className="usuarios-actions-grid">
                        <button className="btn btn-compact" onClick={() => openEdit(u)} disabled={protectedFromCurrentUser}>Editar</button>
                        {u.activo === false ? (
                          <button className="btn btn-compact secondary" onClick={() => onActivate(u.id, u.activo !== false)} disabled={protectedFromCurrentUser}>
                            Activar
                          </button>
                        ) : (
                          <button className="btn btn-compact secondary" onClick={() => onDeactivate(u.id)} disabled={u.id === currentUid || protectedFromCurrentUser}>
                            Desactivar
                          </button>
                        )}
                        {canManageAccess ? (
                          <>
                            <button
                              className="btn btn-compact secondary"
                              onClick={() => openRole(u)}
                              disabled={u.id === currentUid || protectedAdmin}
                            >
                              Cambiar rol
                            </button>
                            <button
                              className="btn btn-compact secondary"
                              onClick={() => openPermissions(u)}
                              disabled={u.id === currentUid || protectedAdmin || normalizeRole(u.role) === "administrador"}
                            >
                              Editar permisos
                            </button>
                          </>
                        ) : null}
                        <button className="btn btn-compact usuarios-action-wide" onClick={() => onResetPassword(u.id)} disabled={protectedFromCurrentUser}>
                          Restablecer contraseña
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {itemsFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 28, textAlign: "center", color: "#64748b" }}>
                    <div className="usuarios-empty-state">
                      <strong>No encontramos usuarios con esos criterios.</strong>
                      <span>Proba cambiando la busqueda o limpiando los filtros para ver el listado completo.</span>
                      <button type="button" className="btn secondary filter-clear-btn" onClick={clearFilters}>Limpiar filtros</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div className="insumos-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="insumos-modal usuarios-modal" role="dialog" aria-modal="true">
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
            ) : modal === "edit" ? (
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
            ) : modal === "permissions" ? (
              <div>
                <h3 style={{ marginTop: 0 }}>Editar permisos</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  {PERMISSION_KEYS.map((key) => (
                    <label key={key} style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700, color: "#334155" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(permissionsForm.permisos[key])}
                        onChange={(e) => {
                          setPermissionsForm({
                            ...permissionsForm,
                            permisos: {
                              ...permissionsForm.permisos,
                              [key]: e.target.checked,
                            },
                          });
                          setFormError("");
                        }}
                      />
                      {PERMISSION_LABELS[key]}
                    </label>
                  ))}
                </div>
                {formError ? <div style={{ gridColumn: "1 / -1", color: "#b91c1c", fontSize: 13, fontWeight: 700, marginTop: 10 }}>{formError}</div> : null}
                <div className="form-actions" style={{ marginTop: 12 }}>
                  <button type="button" onClick={closeModal} disabled={saving}>Cancelar</button>
                  <button type="button" onClick={onSavePermissions} disabled={saving}>{saving ? "Guardando..." : "Guardar permisos"}</button>
                </div>
              </div>
            ) : (
              <div>
                <h3 style={{ marginTop: 0 }}>Cambiar rol</h3>
                <div>
                  <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: "#64748b" }}>Rol</label>
                  <select
                    className="select-inst"
                    value={roleForm.role}
                    onChange={(e) => {
                      setRoleForm({ ...roleForm, role: e.target.value });
                      setFormError("");
                    }}
                  >
                    <option value="administrador">Administrador</option>
                    <option value="administrador limitado">Administrador limitado</option>
                  </select>
                </div>
                <p className="section-subtitle" style={{ marginTop: 10 }}>
                  Administrador recibe todos los permisos automaticamente. Administrador limitado usa permisos personalizados.
                </p>
                {formError ? <div style={{ gridColumn: "1 / -1", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{formError}</div> : null}
                <div className="form-actions" style={{ marginTop: 8 }}>
                  <button type="button" onClick={closeModal} disabled={saving}>Cancelar</button>
                  <button type="button" onClick={onSaveRole} disabled={saving}>{saving ? "Guardando..." : "Guardar rol"}</button>
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
