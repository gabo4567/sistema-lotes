import React, { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContextBase.js";

const normalizeRole = (role) => {
  return String(role || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

export default function ProtectedRoute({
  children,
  allowedRoles,
  requiredPermission,
}) {
  const { user, authReady } = useContext(AuthContext);

  if (!authReady) {
    return null;
  }

  if (!user?.token) {
    return <Navigate to="/login" replace />;
  }

  const effectiveAllowedRoles =
    allowedRoles?.map((r) => normalizeRole(r)) || [
      "administrador",
      "administrador limitado",
    ];

  const role = normalizeRole(user.role) || user.role;

  if (
    effectiveAllowedRoles &&
    !effectiveAllowedRoles.includes(role)
  ) {
    return <Navigate to="/403" replace />;
  }

  // ✅ permisos reales
  if (requiredPermission) {
    const permisos = user?.permisos || {};

    if (!permisos[requiredPermission]) {
      return <Navigate to="/403" replace />;
    }
  }

  return children || <Outlet />;
}