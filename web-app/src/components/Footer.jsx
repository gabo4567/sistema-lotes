import React, { useState } from "react";

const Footer = () => {
  const [mapOpen, setMapOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const openMap = () => {
    setMapLoaded(false);
    setMapOpen(true);
  };

  const closeMap = () => {
    setMapOpen(false);
    setMapLoaded(false);
  };

  return (
    <div className="footer-root">
      <footer className="footer-inst footer-inst--admin">
        <div className="footer-grid footer-grid--admin">
          <div className="footer-left">
            <div className="footer-logos">
              <img
                src="https://ipt.gob.ar/wp-content/uploads/2023/05/IPT-LOGO-06.png"
                alt="Logo IPT"
                className="footer-logo footer-logo--ipt"
              />
              <img
                src="https://ipt.gob.ar/wp-content/uploads/2023/05/MINISTERIO-DE-PRODUCCION-05.png"
                alt="Ministerio de Produccion"
                className="footer-logo"
              />
              <img
                src="https://ipt.gob.ar/wp-content/uploads/2023/05/GOBIERNO-DE-CORRIENTES-2-05.png"
                alt="Gobierno de Corrientes"
                className="footer-logo"
              />
            </div>

            <ul className="footer-contact footer-contact--admin">
              <li className="footer-contact-item">
                <span aria-hidden="true">📍</span> Agust&iacute;n P. Justo 1187, Goya, Corrientes, 3450
              </li>
              <li className="footer-contact-item">
                <span aria-hidden="true">📞</span> +54 3777 433066
              </li>
              <li className="footer-contact-item">
                <span aria-hidden="true">✉️</span> contacto@ipt.gob.ar
              </li>
              <li className="footer-contact-item">
                <span aria-hidden="true">🕒</span> Lunes a Viernes de 7:00hs a 13:00hs
              </li>
            </ul>
          </div>

          <div className="footer-map footer-map--admin">
            <div className="footer-title footer-title--admin">D&oacute;nde nos encontramos</div>
            <div className="map-embed map-embed--admin">
              <iframe
                title="Ubicacion IPT"
                src="https://maps.google.com/maps?q=Instituto%20Provincial%20del%20Tabaco%20Goya&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="footer-map-action">
              <button className="btn footer-map-btn" onClick={openMap}>Ampliar mapa</button>
            </div>
          </div>
        </div>
      </footer>

      <div className="subfooter-container">
        <div className="subfooter subfooter--admin">
          <div className="subfooter-copy">&copy; 2026 Derechos Reservados Instituto Provincial del Tabaco - Corrientes</div>
          <div className="subfooter-link-wrap">
            <a href="https://ipt.gob.ar/" target="_blank" rel="noreferrer" className="subfooter-link">Sitio oficial IPT</a>
          </div>
        </div>
      </div>

      {mapOpen && (
        <div className="footer-map-modal-backdrop" onClick={closeMap}>
          <div className="footer-map-modal" onClick={(e) => e.stopPropagation()}>
            <div className="footer-map-modal__header">
              <div className="footer-map-modal__title">Instituto Provincial del Tabaco - Mapa</div>
              <button className="btn footer-map-modal__close" onClick={closeMap}>Cerrar</button>
            </div>
            <div className="footer-map-modal__map">
              {!mapLoaded && (
                <div className="footer-map-modal__loading" role="status" aria-live="polite">
                  <span className="footer-map-modal__spinner" aria-hidden="true" />
                  <span>Cargando mapa...</span>
                </div>
              )}
              <iframe
                className={`footer-map-modal__iframe${mapLoaded ? " is-loaded" : ""}`}
                title="Ubicacion IPT ampliado"
                src="https://www.google.com/maps?q=Instituto+Provincial+del+Tabaco+Goya&output=embed"
                loading="lazy"
                onLoad={() => setMapLoaded(true)}
                referrerPolicy="no-referrer-when-downgrade"
                style={{ width: "100%", height: "100%", border: 0 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Footer;
