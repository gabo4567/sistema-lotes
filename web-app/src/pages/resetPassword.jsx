import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { notify } from "../utils/alerts";
import { getFirebaseApp } from "../utils/firebaseClient";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BACKEND_RESET_ERRORS = {
  429: "Demasiados intentos. Intente nuevamente en unos minutos.",
};

const buildRateLimitMessage = (payload) => {
  const attempts = Number(payload?.attempts);
  const maxAttempts = Number(payload?.maxAttempts);
  const retryAfterSeconds = Number(payload?.retryAfterSeconds);

  if (Number.isFinite(attempts) && Number.isFinite(maxAttempts)) {
    const base = `Se alcanzó el límite de recuperación de contraseña (${attempts}/${maxAttempts} intentos).`;
    if (Number.isFinite(retryAfterSeconds)) {
      return `${base} Intente nuevamente en ${retryAfterSeconds} segundos.`;
    }
    return `${base} Intente nuevamente en unos minutos.`;
  }

  return BACKEND_RESET_ERRORS[429];
};

const mapFirebaseResetError = (error) => {
  const code = String(error?.code || "").trim();

  if (code === "auth/too-many-requests") {
    return "Demasiados intentos. Intente nuevamente en unos minutos.";
  }

  if (code === "auth/invalid-email") {
    return "Ingrese un correo electrónico válido.";
  }

  if (code.startsWith("auth/requests-from-referer-")) {
    return "Firebase bloqueó este dominio en la API key o en dominios autorizados.";
  }

  if (code === "auth/unauthorized-continue-uri") {
    return "La URL de continuación no está autorizada en Firebase.";
  }

  return null;
};

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const auth = getAuth(getFirebaseApp());

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
      const message = response?.data?.message || "Si el correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña en breve.";
      setSuccess(message);
      await notify({ title: "Enlace de recuperación enviado", text: message, icon: "success" });
    } catch (err) {
      if (err?.response?.status === 429) {
        const msg = buildRateLimitMessage(err?.response?.data);
        setError(msg);
        await notify({ title: "No se pudo enviar el correo", text: msg, icon: "error" });
        return;
      }

      const isRecoverableBackendFailure =
        Number(err?.response?.status) >= 500 ||
        String(err?.message || "").toLowerCase().includes("timeout") ||
        String(err?.response?.data?.error || "").toLowerCase().includes("restablecimiento");

      if (isRecoverableBackendFailure) {
        let firebaseFallbackError = null;
        try {
          const continueUrl = String(import.meta.env.VITE_PASSWORD_RESET_CONTINUE_URL || window.location.origin + "/login").trim();
          try {
            await sendPasswordResetEmail(auth, emailNormalized, { url: continueUrl, handleCodeInApp: false });
          } catch (firstFallbackError) {
            firebaseFallbackError = firstFallbackError;
            await sendPasswordResetEmail(auth, emailNormalized);
          }

          const message = "Si el correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña en breve.";
          setSuccess(message);
          await notify({ title: "Enlace de recuperación enviado", text: message, icon: "success" });
          return;
        } catch (finalFallbackError) {
          const mappedFirebase = mapFirebaseResetError(finalFallbackError || firebaseFallbackError);
          if (mappedFirebase) {
            setError(mappedFirebase);
            await notify({ title: "No se pudo enviar el correo", text: mappedFirebase, icon: "error" });
            return;
          }
        }
      }

      const message = err?.response?.data?.error || "No se pudo procesar la recuperación de contraseña.";
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
            <div style={{ fontSize: "13px", color: "#166534", marginBottom: "4px", fontWeight: "600" }}>✅ Correo enviado correctamente</div>
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