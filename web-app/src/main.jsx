// web-app/src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";

// estilo global
import "./styles/index.css";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/home";
import Login from "./pages/login";
import LotesList from "./pages/lotesList";
import LoteForm from "./pages/lotesForm";
import TurnosList from "./pages/turnosList";
import InsumosList from "./pages/insumosList";
import Forbidden from "./pages/forbidden";
import ProductoresList from "./pages/productoresList";
import MedicionesList from "./pages/medicionesList";
import MedicionesForm from "./pages/medicionesForm";
import Informes from "./pages/informes";

const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  { path: "/403", element: <Forbidden /> },

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
      { path: "/lotes/nuevo", element: <LoteForm /> },
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
    children: [{ path: "/productores", element: <ProductoresList /> }],
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

  { path: "*", element: <Login /> },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);