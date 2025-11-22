import React, { useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault(); setError(""); setLink(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password-link", { email });
      setLink(data?.link || "");
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  return (

    <div style={{ maxWidth: 480, margin: "40px auto" }}>
      <h2>Recuperar contraseña</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <input placeholder="Email institucional" value={email} onChange={e=>setEmail(e.target.value)} type="email" />
        <button className="btn" type="submit" disabled={loading}>{loading? 'Generando…' : 'Generar enlace de reseteo'}</button>
        {link && (
          <div>
            <div>Enlace de reseteo generado:</div>
            <a href={link} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{link}</a>
          </div>
        )}
        {error && <div className="text-red-600">{error}</div>}
      </form>
    </div>

  );
};

export default ResetPassword;