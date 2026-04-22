import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContextBase.js";
import { confirmDialog } from "../utils/alerts";

const Home = () => {
  const { logout } = useContext(AuthContext);
  const handleLogout = async () => {
    const ok = await confirmDialog({ title: "¿Estás seguro?", text: "¿Estás seguro de que deseas cerrar sesión?", icon: "warning", confirmButtonText: "Cerrar sesión", cancelButtonText: "Cancelar" });
    if (ok) logout();
  };
  const options = [
    { type: "link", to: "/home", label: "Home", className: "menu-btn menu-btn--home" },
    { type: "link", to: "/turnos", label: "Turnos", className: "menu-btn" },
    { type: "link", to: "/lotes", label: "Lotes", className: "menu-btn" },
    { type: "link", to: "/users", label: "Usuarios", className: "menu-btn" },
    { type: "link", to: "/productores", label: "Productores", className: "menu-btn" },
    { type: "link", to: "/insumos", label: "Insumos", className: "menu-btn" },
    { type: "link", to: "/informes", label: "Informes", className: "menu-btn" },
    { type: "button", onClick: handleLogout, label: "Cerrar Sesión", className: "menu-btn menu-btn--danger" },
  ];

  return (
    <div className="home-container">
      <div className="home-hero">
        <h1 className="home-title">Sistema de Gestión Agrícola - IPT</h1>
        <p className="home-subtitle">Administración de turnos, lotes y productores</p>
      </div>

      <div className="menu-grid">
        {options.map((opt, idx) => (
          opt.type === "link" ? (
            <Link key={`${opt.label}-${idx}`} to={opt.to} className={opt.className}>
              {opt.label}
            </Link>
          ) : (
            <button key={`${opt.label}-${idx}`} className={opt.className} onClick={opt.onClick}>
              {opt.label}
            </button>
          )
        ))}
      </div>
    </div>
  );
};

export default Home;
