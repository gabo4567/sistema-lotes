import React, { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

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

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      const p = decodeToken(t);
      setUser(p ? { token: t, ...p } : { token: t });
    }
  }, []);
  
// Funciones de login y logout
  const login = (token) => {
    localStorage.setItem("token", token);
    const p = decodeToken(token);
    setUser(p ? { token, ...p } : { token });
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
