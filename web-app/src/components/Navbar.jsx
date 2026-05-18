import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContextBase.js";
import { confirmDialog } from "../utils/alerts";

const Navbar = () => {
  const location = useLocation();
  const { logout, user } = useContext(AuthContext);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("ipt-dark-mode") === "true");
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("ipt-dark-mode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    document.body.classList.toggle("sidebar-open", sidebarOpen);
    document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("sidebar-open");
      document.body.classList.remove("sidebar-collapsed");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sidebarOpen, sidebarCollapsed]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isActive = (path) => {
    if (path === "/home") return location.pathname === "/" || location.pathname === "/home";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const permisos = user?.permisos || {};
  const role = String(user?.role || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  const permissionLabels = {
    turnos: "Turnos",
    productores: "Productores",
    insumos: "Insumos",
    lotes: "Lotes",
    users: "Usuarios",
    informes: "Informes",
  };
  const protectedAdminEmails = new Set(["gabrielparedok@gmail.com"]);
  const userEmail = String(user?.email || "").trim().toLowerCase();
  const isPrincipalAdmin = Boolean(user?.protectedAdmin || user?.adminPrincipal || protectedAdminEmails.has(userEmail));
  const displayName = String(user?.nombre || user?.displayName || user?.name || "Administrador").trim();
  const displayEmail = userEmail || "Sin correo registrado";
  const roleLabel = isPrincipalAdmin
    ? "Administrador principal"
    : role === "administrador limitado"
      ? "Administrador limitado"
      : "Administrador";
  const activePermissions = Object.entries(permissionLabels).filter(([key]) => permisos?.[key]);

  const menuItems = useMemo(() => {
    const items = [
      {
        label: "Inicio",
        path: "/home",
        visible: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.8 12 3l9 7.8"></path>
            <path d="M5.5 9.2V21h13V9.2"></path>
            <path d="M9.5 21v-6h5v6"></path>
          </svg>
        ),
      },

      {
        label: "Turnos",
        path: "/turnos",
        visible: permisos.turnos,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="16.5" rx="2.5"></rect>
            <path d="M8 3v4M16 3v4M3 10h18"></path>
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01M16 17.5h.01"></path>
          </svg>
        ),
      },

      {
        label: "Insumos",
        path: "/insumos",
        visible: permisos.insumos,
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11 20h2v-6.6c2.7-.2 5.2-1.6 6.8-3.8.3-.4 0-.9-.5-.9-3 0-5.3 1-6.9 3.1C11.1 8.7 8.7 7 5.2 7c-.5 0-.8.6-.5 1 1.6 2.6 3.7 4.3 6.3 5v7Z"></path>
            <path d="M6.5 21h11c.5 0 .8-.4.8-.8s-.4-.8-.8-.8h-11c-.5 0-.8.4-.8.8s.3.8.8.8Z"></path>
          </svg>
        ),
      },

      {
        label: "Lotes",
        path: "/lotes",
        visible: permisos.lotes,
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 18.9c4.1-4 8.6-5.5 14.8-5.1L21 14c-4.2 1.2-7.9 3.1-11.2 5.6H4.1c-.9 0-1.4-.4-1.1-.7Z"></path>
            <path d="M3.2 15.3c3.8-3.1 8.2-4.7 13.7-4.7l3.5.1c.5 0 .7.6.3.9l-1.4 1.1c-6.4-.9-11.6.4-15.9 4.2-.6.5-1.1-1.1-.2-1.6Z"></path>
            <path d="M4.5 11.9c3.4-2.2 7.1-3.3 11.2-3.3h2c.5 0 .7.6.3.9l-.9.8c-5.2-.1-9.6 1.1-13.2 3.8-.5.4-.5-1.8.6-2.2Z"></path>
          </svg>
        ),
      },

      {
        label: "Productores",
        path: "/productores",
        visible: permisos.productores,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 20v-1.5a4 4 0 0 0-4-4H6.5a4 4 0 0 0-4 4V20"></path>
            <circle cx="9.2" cy="7.5" r="3.4"></circle>
            <path d="M21.5 20v-1.2a3.4 3.4 0 0 0-2.8-3.3M16.5 4.3a3.3 3.3 0 0 1 0 6.4"></path>
          </svg>
        ),
      },

      {
        label: "Usuarios",
        path: "/users",
        visible: role === "administrador" && permisos.users,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 20v-1.4a4.2 4.2 0 0 0-4.2-4.2H9.2A4.2 4.2 0 0 0 5 18.6V20"></path>
            <circle cx="12" cy="7.5" r="3.4"></circle>
          </svg>
        ),
      },

      {
        label: "Informes",
        path: "/informes",
        visible: permisos.informes,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20V10"></path>
            <path d="M10.5 20V5M17 20v-8"></path>
            <path d="M3 20h18"></path>
          </svg>
        ),
      },
    ];

    return items.filter((i) => i.visible);
  }, [
    permisos.informes,
    permisos.insumos,
    permisos.lotes,
    permisos.productores,
    permisos.turnos,
    permisos.users,
    role,
  ]);

  const toggleMenu = () => {
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (isMobile) {
      setSidebarOpen((v) => !v);
      setSidebarCollapsed(false);
      return;
    }
    setSidebarCollapsed((v) => !v);
    setSidebarOpen(false);
  };

  const openMobileMenu = () => {
    setSidebarCollapsed(false);
    setSidebarOpen(true);
  };

  const handleLogout = async () => {
    const ok = await confirmDialog({
      title: "¿Cerrar sesión?",
      text: "Se cerrará la sesión actual.",
      icon: "warning",
      confirmButtonText: "Cerrar sesión",
      cancelButtonText: "Cancelar",
    });

    if (ok) {
      await logout({ redirect: true });
    }
  };

  return (
    <>
      <button type="button" className="mobile-menu-btn" onClick={openMobileMenu} aria-label="Abrir menú">
        <span />
        <span />
        <span />
      </button>

      {sidebarOpen ? (
        <button type="button" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú" />
      ) : null}

      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <button type="button" className="sidebar-menu-btn" onClick={toggleMenu} aria-label="Menú">
          <span />
          <span />
          <span />
        </button>

        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="sidebar-brand__mark">IPT</div>
            <div className="sidebar-brand__name">Instituto Provincial del Tabaco</div>
          </div>

          <nav className="sidebar-nav" aria-label="Navegación">
            {menuItems.map((it) => (
              <Link
                key={it.path}
                to={it.path}
                className={`sidebar-link${isActive(it.path) ? " active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-icon-wrapper" aria-hidden="true">{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <div className="sidebar-account__avatar" aria-hidden="true">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="sidebar-account__body">
              <div className="sidebar-account__name">{displayName}</div>
              <div className="sidebar-account__email">{displayEmail}</div>
              <div className="sidebar-account__role">{roleLabel}</div>
            </div>
            <button type="button" className="sidebar-account__profile" onClick={() => setProfileOpen(true)}>
              Mi perfil
            </button>
          </div>

          <button type="button" className="sidebar-link logout-link" onClick={handleLogout}>
            <span className="sidebar-icon-wrapper" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 17l5-5-5-5"></path>
                <path d="M15 12H3"></path>
                <path d="M21 21V3"></path>
              </svg>
            </span>
            <span>Cerrar Sesión</span>
          </button>

          <div className="theme-toggle" role="group" aria-label="Tema">
            <span className="theme-toggle__text">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.8A8.5 8.5 0 0 1 11.2 3a6.5 6.5 0 1 0 9.8 9.8Z"></path>
              </svg>
              Modo oscuro
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
                aria-label="Alternar modo oscuro"
              />
              <span className="slider" />
            </label>
          </div>
        </div>
      </aside>

      {profileOpen ? (
        <div className="profile-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setProfileOpen(false); }}>
          <div className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
            <div className="profile-modal__header">
              <div>
                <div id="profile-modal-title" className="profile-modal__title">Mi perfil</div>
                <div className="profile-modal__subtitle">Cuenta conectada al sistema web</div>
              </div>
              <button type="button" className="profile-modal__close" onClick={() => setProfileOpen(false)}>Cerrar</button>
            </div>

            <div className="profile-modal__identity">
              <div className="profile-modal__avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</div>
              <div>
                <div className="profile-modal__name">{displayName}</div>
                <div className="profile-modal__email">{displayEmail}</div>
                <span className="profile-modal__role">{roleLabel}</span>
              </div>
            </div>

            <div className="profile-modal__grid">
              <div className="profile-field">
                <span>Estado</span>
                <strong>Activo</strong>
              </div>
              <div className="profile-field">
                <span>Identificador</span>
                <strong>{user?.uid || "-"}</strong>
              </div>
            </div>

            <div className="profile-permissions">
              <div className="profile-permissions__title">Permisos activos</div>
              <div className="profile-permissions__list">
                {activePermissions.length > 0 ? activePermissions.map(([key, label]) => (
                  <span key={key} className="profile-permissions__chip">{label}</span>
                )) : (
                  <span className="profile-permissions__empty">Sin permisos activos</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default Navbar;
