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
      const msg = err?.response?.data?.message || "Credenciales inválidas";
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
          <div className="d-flex align-items-center mb-3">
            <img src={logo} alt="Logo" className="logo me-3" />
            <div>
              <h4 className="mb-0">Login</h4>
              <small className="text-muted">Panel de administración</small>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="email" className="form-label visually-hidden">
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

            <div className="mb-3">
              <label
                htmlFor="password"
                className="form-label visually-hidden"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-primary-custom"
              disabled={loading}
            >
              {loading ? "Ingresando..." : "Entrar"}
            </button>

            {error && <div className="mensajeError">{error}</div>}

            <div className="text-center mt-3">
              <a
                href="/reset-password"
                style={{ color: "var(--color-2)", fontWeight: 700 }}
              >
                ¿Olvidaste tu contraseña?
              </a>
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
