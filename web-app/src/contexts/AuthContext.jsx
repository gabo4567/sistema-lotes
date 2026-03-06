import React, { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

const normalizeRole = (r) => {
  if (!r) return r;
  const map = {
    Administrador: "Administrador",
    Tecnico: "Técnico",
    "Técnico": "Técnico",
    Supervisor: "Supervisor",
  };
  return map[r] || r;
};

const decodeToken = (t) => {
  try {
    const parts = String(t).split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64));
    return json;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  // Inicialización síncrona para evitar parpadeos/redirecciones
  const [user, setUser] = useState(() => {
    const t = localStorage.getItem("token");
    if (t) {
      const p = decodeToken(t);
      const role = normalizeRole(p?.role);
      return p ? { token: t, ...p, role } : { token: t };
    }
    return null;
  });

  // Funciones de login y logout
  const login = (token) => {
    localStorage.setItem("token", token);
    const p = decodeToken(token);
    const role = normalizeRole(p?.role);
    setUser(p ? { token, ...p, role } : { token });
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
  
