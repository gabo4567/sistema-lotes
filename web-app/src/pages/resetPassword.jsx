import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { notify } from "../utils/alerts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIREBASE_RESET_ERRORS = {
  "auth/invalid-email": "Ingrese un correo electrónico válido.",
  "auth/network-request-failed": "No se pudo conectar. Verifique su conexión a internet.",
  "auth/too-many-requests": "Demasiados intentos. Intente nuevamente en unos minutos.",
};

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const emailNormalized = String(email || "").trim().toLowerCase();
    setError("");
    setSuccess("");

    if (!EMAIL_REGEX.test(emailNormalized)) {
      const msg = "Ingrese un correo electrónico válido.";
      setError(msg);
      await notify({ title: "Correo inválido", text: msg, icon: "error" });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/reset-password-link", { email: emailNormalized });

      const message = response?.data?.message || "Si el correo está registrado, enviamos un enlace para restablecer la contraseña.";
      setSuccess(message);
      await notify({ title: "Correo de recuperación enviado", text: message, icon: "success" });
    } catch (err) {
      if (err?.response?.status === 429) {
        const tooMany = "Demasiados intentos. Intente nuevamente en unos minutos.";
        setError(tooMany);
        await notify({ title: "No se pudo enviar el correo", text: tooMany, icon: "error" });
        return;
      }

      const backendMessage = err?.response?.data?.error;
      const message = backendMessage || FIREBASE_RESET_ERRORS[err?.code] || "No se pudo procesar la recuperación de contraseña.";
      setError(message);
      await notify({ title: "No se pudo enviar el correo", text: message, icon: "error" });
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", padding: "32px", background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link to="/login" style={{ color: "#166534", fontSize: "14px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          ← Volver al inicio de sesión
        </Link>
      </div>
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
          {loading ? 'Enviando correo...' : 'Enviar enlace de recuperación'}
        </button>

        {success && (
          <div style={{ marginTop: "20px", padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
            <div style={{ fontSize: "13px", color: "#166534", marginBottom: "4px", fontWeight: "600" }}>✅ Solicitud registrada:</div>
            <div style={{ color: '#15803d', wordBreak: "break-word", fontSize: "13px" }}>{success}</div>
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