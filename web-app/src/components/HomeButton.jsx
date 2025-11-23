import React from "react";
import { Link } from "react-router-dom";

const HomeButton = () => {
  return (
    <Link to="/" aria-label="Inicio" title="Inicio" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', textDecoration: 'none' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 10.5L12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5a1.5 1.5 0 0 1-1.5-1.5v-4.5h-3V21a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 3 19.5v-9z" stroke="#1f2937" strokeWidth="1.5" fill="#e5e7eb"/>
      </svg>
    </Link>
  );
};

export default HomeButton;
