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
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
      <form onSubmit={handleSubmit}>
        <h2>Iniciar sesión</h2>
        <div style={{ marginBottom: '10px' }}>
          <input 
            value={email} 
            onChange={e=>setEmail(e.target.value)} 
            placeholder="Email" 
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
            required
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input 
            value={password} 
            onChange={e=>setPassword(e.target.value)} 
            type="password" 
            placeholder="Contraseña" 
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
            required
          />
        </div>
        <button 
          type="submit" 
          style={{ 
            width: '100%', 
            padding: '10px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Entrar
        </button>
      </form>
    </div>
  );
};

export default Login;
