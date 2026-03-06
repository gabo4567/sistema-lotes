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
    <div style={{ maxWidth: 480, margin: "60px auto", padding: "32px", background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0" }}>
      <h2 style={{ textAlign: "center", marginBottom: "24px", color: "#1e293b", fontSize: "24px", fontWeight: "700" }}>Recuperar contraseña</h2>
      <p style={{ textAlign: "center", color: "#64748b", marginBottom: "32px", fontSize: "14px" }}>
        Ingresa tu correo institucional y te enviaremos un enlace para restablecer tu acceso.
      </p>
      
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>Email institucional</label>
          <input 
            className="input-inst" 
            placeholder="ejemplo@ipt.gob.ar" 
            value={email} 
            onChange={e=>setEmail(e.target.value)} 
            type="email" 
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "15px" }}
          />
        </div>
        
        <button 
          className="btn" 
          type="submit" 
          disabled={loading}
          style={{ 
            width: "100%", 
            padding: "12px", 
            borderRadius: "8px", 
            backgroundColor: "#166534", 
            color: "#fff", 
            fontWeight: "600",
            border: "none",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.8 : 1,
            marginTop: "8px"
          }}
        >
          {loading ? 'Generando enlace...' : 'Enviar enlace de recuperación'}
        </button>

        {link && (
          <div style={{ marginTop: "20px", padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
            <div style={{ fontSize: "13px", color: "#166534", marginBottom: "4px", fontWeight: "600" }}>✅ Enlace generado con éxito:</div>
            <a href={link} target="_blank" rel="noreferrer" style={{ color: '#15803d', wordBreak: "break-all", fontSize: "13px", textDecoration: "underline" }}>{link}</a>
          </div>
        )}
        
        {error && (
          <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "14px", textAlign: "center" }}>
            ⚠️ {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default ResetPassword;