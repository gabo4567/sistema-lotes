import React from "react";

const Footer = () => {
  return (
    <footer className="footer-inst">
      <div className="footer-grid">
        <div className="footer-col">
          <div className="footer-brand">IPT</div>
          <div className="footer-slogan">Junto al productor siempre!</div>
          <ul className="footer-contact">
            <li>📍 Agustín P. Justo 1187, Goya, Corrientes, 3450</li>
            <li>📞 +54 3777 433066</li>
            <li>✉️ contacto@ipt.gob.ar</li>
            <li>🕒 Lunes a Viernes de 7:00hs a 13:00hs</li>
          </ul>
        </div>
        <div className="footer-col footer-badges">
          <div className="footer-badge">Ministerio de Producción</div>
          <div className="footer-badge">Corrientes</div>
        </div>
        <div className="footer-col footer-map">
          <div className="footer-title">Dónde nos encontramos</div>
          <div className="map-embed">
            <iframe
              title="Ubicación IPT"
              src="https://www.google.com/maps?q=Instituto+Provincial+del+Tabaco+Goya&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
      <div className="subfooter">
        <div>© 2025 Derechos Reservados Instituto Provincial del Tabaco – Corrientes</div>
        <a href="https://ipt.gob.ar/" target="_blank" rel="noreferrer">Sitio oficial IPT</a>
      </div>
    </footer>
  );
};

export default Footer;

