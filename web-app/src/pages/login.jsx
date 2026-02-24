// src/pages/Login.jsx

import React, { useState, useContext } from "react";
import api from "../api/axios";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

import bg from "../assets/470694502_1364235428284349_7836195038289849919_n.jpg";
import logo from "../assets/cropped-ipt-logo-byn.png";

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      const { token } = res.data;

      login(token);
      navigate("/home");

    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || (err?.code === 'ECONNABORTED' ? 'No se pudo conectar al servidor' : "Credenciales inválidas");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

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
                className="form-control"
                placeholder="tucorreo@dominio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
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
                  required
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
                <a href="/reset-password">¿Olvidaste tu contraseña?</a>
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
