import React, { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContextBase.js";

const normalizeRole = (role) => {
  const v = String(role || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!v) return "";
  if (v === "productor") return "Productor";
  return "Administrador";
};

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, authReady } = useContext(AuthContext);

  if (!authReady) {
    return null;
  }

  if (!user?.token) {
    return <Navigate to="/login" replace />;
  }

  const effectiveAllowedRoles = allowedRoles || ["Administrador"];
  const role = normalizeRole(user.role) || user.role;
  if (effectiveAllowedRoles && !effectiveAllowedRoles.includes(role)) {
    return <Navigate to="/403" replace />;
  }

  return children || <Outlet />;
}
