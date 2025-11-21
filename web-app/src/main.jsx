// web-app/src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";

// estilo global
import "./styles/index.css";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/home.jsx";
import Login from "./pages/login.jsx";
import Register from "./pages/register.jsx";
import ResetPassword from "./pages/resetPassword.jsx";
import LotesList from "./pages/lotesList.jsx";
import LoteAdminForm from "./pages/loteAdminForm.jsx";
import LoteDetail from "./pages/loteDetail.jsx";
import TurnosList from "./pages/turnosList.jsx";
import InsumosList from "./pages/insumosList.jsx";
import Forbidden from "./pages/forbidden.jsx";
import ProductoresList from "./pages/productoresList.jsx";
import ProductorForm from "./pages/productorForm.jsx";
import ProductorDetail from "./pages/productorDetail.jsx";
import MedicionesList from "./pages/medicionesList.jsx";
import MedicionesForm from "./pages/medicionesForm.jsx";
import Informes from "./pages/informes.jsx";
import UsersList from "./pages/usersList.jsx";


class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error) {}
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { style: { padding: 16 } }, `Error de render: ${this.state.error?.message || 'Desconocido'}`);
    }
    return this.props.children;
  }
}

const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  { path: "/403", element: <Forbidden /> },
  { path: "/register", element: <Register /> },
  { path: "/reset-password", element: <ResetPassword /> },

  {
    element: <ProtectedRoute />,
    children: [{ path: "/home", element: <Home /> }],
  },

  {
    element: (
      <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]} />
    ),
    children: [
      { path: "/lotes", element: <LotesList /> },
      { path: "/lotes/nuevo", element: <LoteAdminForm /> },
      { path: "/lotes/:id", element: <LoteDetail /> },
      { path: "/lotes/:id/editar", element: <LoteAdminForm /> },
    ],
  },

  {
    element: (
      <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]} />
    ),
    children: [{ path: "/turnos", element: <TurnosList /> }],
  },

  {
    element: <ProtectedRoute allowedRoles={["Administrador"]} />,
    children: [{ path: "/insumos", element: <InsumosList /> }],
  },

  {
    element: (
      <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]} />
    ),
    children: [
      { path: "/productores", element: <ProductoresList /> },
      { path: "/productores/nuevo", element: <ProductorForm /> },
      { path: "/productores/:id", element: <ProductorDetail /> },
      { path: "/productores/:id/editar", element: <ProductorForm /> },
    ],
  },

  {
    element: (
      <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]} />
    ),
    children: [
      { path: "/mediciones", element: <MedicionesList /> },
      { path: "/mediciones/nueva", element: <MedicionesForm /> },
    ],
  },

  {
    element: <ProtectedRoute allowedRoles={["Administrador", "Supervisor"]} />,
    children: [{ path: "/informes", element: <Informes /> }],
  },
  {
    element: <ProtectedRoute allowedRoles={["Administrador"]} />,
    children: [{ path: "/users", element: <UsersList /> }],
  },

  { path: "*", element: <Login /> },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </AuthProvider>
  </React.StrictMode>
);