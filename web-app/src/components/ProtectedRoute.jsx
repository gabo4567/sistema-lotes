import React, { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

const ProtectedRoute = ({ redirectTo = "/login", allowedRoles }) => {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to={redirectTo} replace />;
  if (allowedRoles && user.role && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
