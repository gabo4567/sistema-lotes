import React from "react";
import { Link } from "react-router-dom";
import heroBanner from "../assets/banner-home.png";

const Home = () => {
  const cards = [
    {
      title: "Turnos",
      desc: "Gestioná y visualizá los turnos asignados.",
      link: "/turnos",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="16.5" rx="2.5"></rect>
          <path d="M8 3v4M16 3v4M3 10h18"></path>
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01M16 17.5h.01"></path>
        </svg>
      ),
      btnText: "Ver turnos",
    },
    {
      title: "Insumos",
      desc: "Administrá los insumos disponibles y su stock.",
      link: "/insumos",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11 20h2v-6.6c2.7-.2 5.2-1.6 6.8-3.8.3-.4 0-.9-.5-.9-3 0-5.3 1-6.9 3.1C11.1 8.7 8.7 7 5.2 7c-.5 0-.8.6-.5 1 1.6 2.6 3.7 4.3 6.3 5v7Z"></path>
          <path d="M6.5 21h11c.5 0 .8-.4.8-.8s-.4-.8-.8-.8h-11c-.5 0-.8.4-.8.8s.3.8.8.8Z"></path>
        </svg>
      ),
      btnText: "Ver insumos",
    },
    {
      title: "Lotes",
      desc: "Consultá y gestioná los lotes productivos.",
      link: "/lotes",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3 18.9c4.1-4 8.6-5.5 14.8-5.1L21 14c-4.2 1.2-7.9 3.1-11.2 5.6H4.1c-.9 0-1.4-.4-1.1-.7Z"></path>
          <path d="M3.2 15.3c3.8-3.1 8.2-4.7 13.7-4.7l3.5.1c.5 0 .7.6.3.9l-1.4 1.1c-6.4-.9-11.6.4-15.9 4.2-.6.5-1.1-1.1-.2-1.6Z"></path>
          <path d="M4.5 11.9c3.4-2.2 7.1-3.3 11.2-3.3h2c.5 0 .7.6.3.9l-.9.8c-5.2-.1-9.6 1.1-13.2 3.8-.5.4-.5-1.8.6-2.2Z"></path>
        </svg>
      ),
      btnText: "Ver lotes",
    },
  ];

  return (
    <div className="dashboard-home">
      <section
        className="hero-banner"
        style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.26) 48%, rgba(0,0,0,0.1) 100%),
            url(${heroBanner})
          `,
        }}
      >
        <div className="hero-overlay">
          <div className="hero-content">
            <h1>Sistema de Gestión<br />Agrícola - IPT</h1>
            <p>
              Administración de turnos,<br />
              lotes y productores
            </p>
          </div>
        </div>
      </section>

      <section className="dashboard-welcome">
        <div className="welcome-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3.2 4.5 7v5.2c0 4.6 3.1 7.4 7.5 8.6 4.4-1.2 7.5-4 7.5-8.6V7L12 3.2Z" />
            <path d="M8.2 12.1 10.8 15l5.2-6" />
          </svg>
        </div>

        <div className="welcome-text">
          <h2>Bienvenido al Sistema de Gestión Agrícola del IPT</h2>
          <p>
            Desde acá podés administrar turnos, insumos, lotes y productores
            de manera simple y eficiente.
          </p>
        </div>
      </section>

      <section className="dashboard-cards">
        {cards.map((card) => (
          <div className="dashboard-card" key={card.title}>
            <div className="dashboard-icon">{card.icon}</div>

            <h3>{card.title}</h3>
            <p>{card.desc}</p>

            <Link to={card.link} className="dashboard-action-btn">
              {card.btnText}
              <span className="arrow">›</span>
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Home;
