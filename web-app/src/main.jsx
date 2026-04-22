// web-app/src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";

// estilo global
import "./styles/index.css";


import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext.jsx";
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
import Informes from "./pages/informes.jsx";
import UsersList from "./pages/usersList.jsx";
import Layout from "./components/Layout.jsx";


class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: 24 } },
        React.createElement('div', { style: { maxWidth: 560, width: '100%', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)' } },
          React.createElement('h1', { style: { marginTop: 0, marginBottom: 12, fontSize: 24 } }, 'Se produjo un error inesperado'),
          React.createElement('p', { style: { marginTop: 0, marginBottom: 16, color: '#475569' } }, this.state.error?.message || 'No se pudo renderizar la pantalla actual.'),
          React.createElement('div', { style: { display: 'flex', gap: 12, flexWrap: 'wrap' } },
            React.createElement('button', { className: 'btn primary', onClick: () => window.location.assign('/home') }, 'Ir al inicio'),
            React.createElement('button', { className: 'btn secondary', onClick: () => window.location.reload() }, 'Recargar')
          )
        )
      );
    }
    return this.props.children;
  }
}

const router = createBrowserRouter([
  // Rutas públicas
  
  { path: "/login", element: <Login /> },
  { path: "/403", element: <Forbidden /> },
  { path: "/register", element: <Register /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/forgot-password", element: <ResetPassword /> },

  // Rutas protegidas con Layout
  {
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { path: "/home", element: <Home /> },
      { path: "/", element: <Home /> },
      { path: "/lotes", element: (
        <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]}>
          <LotesList />
        </ProtectedRoute>
      ) },
      { path: "/lotes/nuevo", element: (
        <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]}>
          <LoteAdminForm />
        </ProtectedRoute>
      ) },
      { path: "/lotes/:id", element: (
        <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]}>
          <LoteDetail />
        </ProtectedRoute>
      ) },
      { path: "/lotes/:id/editar", element: (
        <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]}>
          <LoteAdminForm />
        </ProtectedRoute>
      ) },
      { path: "/turnos", element: (
        <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]}>
          <TurnosList />
        </ProtectedRoute>
      ) },
      { path: "/insumos", element: (
        <ProtectedRoute allowedRoles={["Administrador"]}>
          <InsumosList />
        </ProtectedRoute>
      ) },
      { path: "/productores", element: (
        <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]}>
          <ProductoresList />
        </ProtectedRoute>
      ) },
      { path: "/productores/nuevo", element: (
        <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]}>
          <ProductorForm />
        </ProtectedRoute>
      ) },
      { path: "/productores/:id", element: (
        <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]}>
          <ProductorDetail />
        </ProtectedRoute>
      ) },
      { path: "/productores/:id/editar", element: (
        <ProtectedRoute allowedRoles={["Administrador", "Técnico", "Supervisor"]}>
          <ProductorForm />
        </ProtectedRoute>
      ) },
      { path: "/informes", element: (
        <ProtectedRoute allowedRoles={["Administrador", "Supervisor"]}>
          <Informes />
        </ProtectedRoute>
      ) },
      { path: "/users", element: (
        <ProtectedRoute allowedRoles={["Administrador"]}>
          <UsersList />
        </ProtectedRoute>
      ) },
    ],
  },

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
