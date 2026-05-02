// src/pages/Login.jsx

import React, { useState, useContext, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import api from "../api/axios";
import { AuthContext } from "../contexts/AuthContextBase.js";
import { notify } from "../utils/alerts";
import { getFirebaseApp } from "../utils/firebaseClient";

import bg from "../assets/470694502_1364235428284349_7836195038289849919_n.jpg";
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

      login(res.data.token);
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
    <div className="auth-split">
      {/* LEFT - FORM */}
      <div className="left-col">
        <div className="auth-card">
          <div className="header-center mb-3">
            <img src={logo} alt="Logo" className="logo" />
            <div>
              <div className="admin-title">Panel de administración</div>
              <div className="admin-subtitle">Acceso exclusivo para personal autorizado del IPT</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3 form-group">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                className={`form-control${emailError ? " is-invalid" : ""}`}
                placeholder="tucorreo@dominio.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                autoComplete="username"
              />
              {emailError && (
                <div className="invalid-feedback" style={{ display: "block" }}>{emailError}</div>
              )}
            </div>

            <div className="mb-3 form-group password-wrapper">
              <label htmlFor="password" className="form-label">
                Contraseña
              </label>
              <div className="password-input-wrap">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="toggle-pass"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9.88 9.88C9.33 10.42 9 11.19 9 12C9 13.66 10.34 15 12 15C12.81 15 13.58 14.67 14.12 14.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 7C8 7 4.73 9.11 3 12C4.73 14.89 8 17 12 17C16 17 19.27 14.89 21 12C19.27 9.11 16 7 12 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="actions">
              <button
                type="submit"
                className="btn btn-primary btn-primary-custom"
                disabled={loading}
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>

              {error && <div className="mensajeError">{error}</div>}

              <div className="forgot-link">
                <Link to={forgotTo}>¿Olvidaste tu contraseña?</Link>
              </div>

              <div className="auth-card-footer">
                <div>Versión 1.0.0</div>
                <div>© 2026 IPT</div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT - IMAGE */}
      <div className="right-col">
        <div
          className="bg-img"
          style={{ backgroundImage: `url(${bg})` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

export default Login;
