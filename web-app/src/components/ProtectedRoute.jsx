import React, { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContextBase.js";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, authReady } = useContext(AuthContext);

  if (!authReady) {
    return null;
  }

  if (!user?.token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return children || <Outlet />;
}
