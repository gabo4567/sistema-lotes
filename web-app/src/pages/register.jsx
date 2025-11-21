import React, { useState } from "react";
import api from "../api/axios";

const Register = () => {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage(""); setError(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/register", { nombre, email, password, role: "Administrador" });
      setMessage(`Usuario creado: ${data?.user?.email}`);
      setNombre(""); setEmail(""); setPassword("");
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 480, margin: "40px auto" }}>
      <h2>Registrar Administrador</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <input placeholder="Nombre completo" value={nombre} onChange={e=>setNombre(e.target.value)} />
        <input placeholder="Email institucional" value={email} onChange={e=>setEmail(e.target.value)} type="email" />
        <input placeholder="Contraseña inicial" value={password} onChange={e=>setPassword(e.target.value)} type="password" />
        <button className="btn" disabled={loading} type="submit">{loading? 'Creando…' : 'Crear admin'}</button>
        {message && <div className="text-green-700">{message}</div>}
        {error && <div className="text-red-600">{error}</div>}
      </form>
    </div>
  );
};

export default Register;