import React from "react";
import ReactDOM from "react-dom/client";
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/index.css'; // tu CSS personalizado (ver abajo)
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/home";
import Login from "./pages/login";
import LotesList from "./pages/lotesList";
import LoteForm from "./pages/lotesForm";
import TurnosList from "./pages/turnosList";
import InsumosList from "./pages/insumosList";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home/>} />
            <Route path="/lotes" element={<LotesList/>} />
            <Route path="/lotes/nuevo" element={<LoteForm/>} />
            <Route path="/turnos" element={<TurnosList/>} />
            <Route path="/insumos" element={<InsumosList/>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
