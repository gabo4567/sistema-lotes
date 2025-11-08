import React, { useState, useContext } from "react";
import api from "../api/axios";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevenir recarga de página
    try {
      const res = await api.post("/auth/login", { email, password });
      // Suponiendo que devuelve { token }
      const { token } = res.data;
      login(token); // Actualizar contexto de autenticación
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Credenciales inválidas");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Iniciar sesión</h2>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
      <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Contraseña" />
      <button type="submit">Entrar</button>
    </form>
  );
};

export default Login;
