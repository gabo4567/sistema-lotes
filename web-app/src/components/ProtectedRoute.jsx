import React, { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useContext(AuthContext);

  const hasToken = !!localStorage.getItem("token");
  const hasSession = !!sessionStorage.getItem("session_active");

  // Requerir inicio de sesión por pestaña: si no hay sesión de pestaña, forzar login
  if (!hasSession) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return children;
  }
