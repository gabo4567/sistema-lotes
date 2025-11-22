import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import FirebaseTest from "../components/FirebaseTest";
import Navbar from "../components/Navbar";

const Home = () => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div>
      <h1>Sistema de Lotes - Instituto Provincial del Tabaco</h1>
      <FirebaseTest />
        <Navbar />
      <button onClick={handleLogout} style={{ marginTop: '20px' }}>
        Cerrar Sesión
      </button>
    </div>
  );
};

export default Home;