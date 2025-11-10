import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import FirebaseTest from "../components/FirebaseTest";
import Layout from "../components/Layout";

const Home = () => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl">Sistema de Lotes - Instituto Provincial del Tabaco</h1>
        <p>Panel de administración - Resumen rápido: número de productores, turnos hoy, insumos disponibles...</p>
        <FirebaseTest />
        <nav style={{ marginTop: "20px" }}>
          <Link to="/lotes">Ver Lotes</Link>
        </nav>
        <button onClick={handleLogout} style={{ marginTop: "20px" }}>
          Cerrar Sesión
        </button>
      </div>
    </Layout>
  );
};

export default Home;
