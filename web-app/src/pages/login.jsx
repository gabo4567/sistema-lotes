// src/pages/Login.jsx

import React, { useState, useContext, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import api from "../api/axios";
import { AuthContext } from "../contexts/AuthContextBase.js";
import { notify } from "../utils/alerts";
import { getFirebaseApp } from "../utils/firebaseClient";

import loginBg from "../assets/TABACALES-2023-18.jpg";
import logo from "../assets/cropped-ipt-logo-byn.png";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIREBASE_ERRORS = {
  "auth/invalid-credential": "Email o contraseña incorrectos.",
  "auth/user-disabled": "La cuenta ha sido deshabilitada. Contacte al administrador.",
  "auth/too-many-requests": "Demasiados intentos fallidos. Espere unos minutos e intente de nuevo.",
  "auth/network-request-failed": "No se pudo conectar. Verifique su conexión a internet.",
};

const mapFirebaseError = (err) => {
  const code = String(err?.code || "").trim();
  if (FIREBASE_ERRORS[code]) return FIREBASE_ERRORS[code];

  if (code.startsWith("auth/requests-from-referer-")) {
    return "Firebase bloqueó solicitudes desde este dominio. Configure Authorized Domains en Firebase Auth y los HTTP referrers del API key en Google Cloud.";
  }

  return null;
};

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const auth = getAuth(getFirebaseApp());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = useCallback(() => {
    const trimmed = email.trim();
    setEmailError("");
    setError("");
    if (!trimmed) {
      setEmailError("El email es requerido.");
      return false;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError("Ingrese un email con formato válido.");
      return false;
    }
    if (!password) {
      setError("La contraseña es requerida.");
      return false;
    }
    return true;
  }, [email, password]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;
    if (!validate()) return;
    setLoading(true);
    let firebaseAuthenticated = false;
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const credentials = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      firebaseAuthenticated = true;
      const idToken = await credentials.user.getIdToken();

      const res = await api.post("/auth/login", {
        idToken,
      });

      login(res.data.token, {
        permisos: res.data.permisos || {},
        role: res.data.role || "administrador",
      });
      navigate("/home");

    } catch (err) {
      if (firebaseAuthenticated) {
        try {
          await signOut(auth);
        } catch {
          // noop
        }
      }

      const backendMessage = err?.response?.data?.error || err?.message;

      const fbMsg = mapFirebaseError(err);
      if (fbMsg) {
        setError(fbMsg);
        await notify({ title: "No se pudo iniciar sesión", text: fbMsg, icon: "error" });
        return;
      }

      if (err?.response?.status === 429) {
        const tooMany = "Demasiados intentos fallidos. Espere unos minutos e intente de nuevo.";
        setError(tooMany);
        await notify({ title: "No se pudo iniciar sesión", text: tooMany, icon: "error" });
        return;
      }

      if (backendMessage) {
        setError(backendMessage);
        await notify({ title: "No se pudo iniciar sesión", text: backendMessage, icon: "error" });
        return;
      }

      if (err?.code === "ECONNABORTED") {
        const msg = err?.message || "Conectando al servidor… puede demorar al iniciar. Reintentá en unos segundos.";
        setError(msg);
        await notify({ title: "Error de conexión", text: msg, icon: "error" });
      } else {
        setError("No se pudo iniciar sesión. Intente de nuevo.");
        await notify({ title: "No se pudo iniciar sesión", text: "Intente de nuevo en unos minutos.", icon: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  const forgotTo = `/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`;

  return (
    <div className="login-hero">
      <div className="login-hero__bg" style={{ backgroundImage: `url(${loginBg})` }} aria-hidden="true" />
      <div className="login-hero__overlay" aria-hidden="true" />

      <div className="login-hero__content">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-card__hero-wrap">
              <img className="login-card__hero" src={logo} alt="Instituto Provincial del Tabaco" />
            </div>
          </div>

          <h1 className="login-title">Panel de administración</h1>
          <p className="login-subtitle">Acceso exclusivo para personal autorizado del IPT</p>

          <form onSubmit={handleSubmit} noValidate className="login-form">
            <div className="login-field">
              <label htmlFor="email" className="login-label">Email</label>
              <div className="login-input">
                <span className="login-input__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  id="email"
                  type="email"
                  className="login-input__field"
                  placeholder="tucorreo@dominio.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                  autoComplete="username"
                />
              </div>
              {emailError ? (
                <div className="login-error">{emailError}</div>
              ) : null}
            </div>

            <div className="login-field">
              <label htmlFor="password" className="login-label">Contraseña</label>
              <div className="login-input">
                <span className="login-input__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="login-input__field"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-input__toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </button>

            {error ? <div className="login-error login-error--center">{error}</div> : null}

            <div className="login-forgot">
              <Link to={forgotTo}>¿Olvidaste tu contraseña?</Link>
            </div>

            <div className="login-footer">
              <div>Versión 1.0.0</div>
              <div>© 2026 IPT</div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
