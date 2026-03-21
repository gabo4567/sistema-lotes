import React, { useState } from "react";


const Footer = () => {
  const [mapOpen, setMapOpen] = useState(false);
  return (
    <div className="footer-root">
      <footer className="footer-inst footer-inst--admin">
        <div className="footer-grid footer-grid--admin">
          
          {/* Sección Izquierda: Logos y Contacto */}
          <div className="footer-left">
            
            {/* Logos alineados horizontalmente, centrados hacia la izquierda, más grandes y separados */}
            <div className="footer-logos">
              <img 
                src="https://ipt.gob.ar/wp-content/uploads/2023/05/IPT-LOGO-06.png" 
                alt="Logo IPT" 
                className="footer-logo footer-logo--ipt"
              />
              <img 
                src="https://ipt.gob.ar/wp-content/uploads/2023/05/MINISTERIO-DE-PRODUCCION-05.png" 
                alt="Ministerio de Producción" 
                className="footer-logo"
              />
              <img 
                src="https://ipt.gob.ar/wp-content/uploads/2023/05/GOBIERNO-DE-CORRIENTES-2-05.png" 
                alt="Gobierno de Corrientes" 
                className="footer-logo"
              />
            </div>

            {/* Información de contacto alineada a la izquierda abajo */}
            <ul className="footer-contact footer-contact--admin">
              <li className="footer-contact-item">
                <span>📍</span> Agustín P. Justo 1187, Goya, Corrientes, 3450
              </li>
              <li className="footer-contact-item">
                <span>📞</span> +54 3777 433066
              </li>
              <li className="footer-contact-item">
                <span>✉️</span> contacto@ipt.gob.ar
              </li>
              <li className="footer-contact-item">
                <span>🕒</span> Lunes a Viernes de 7:00hs a 13:00hs
              </li>
            </ul>
          </div>

          {/* Sección Derecha: Mapa */}
          <div className="footer-map footer-map--admin">
            <div className="footer-title footer-title--admin">Dónde nos encontramos</div>
            <div className="map-embed map-embed--admin">
              <iframe
                title="Ubicación IPT"
                src="https://maps.google.com/maps?q=Instituto%20Provincial%20del%20Tabaco%20Goya&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="footer-map-action">
              <button className="btn footer-map-btn" onClick={()=>setMapOpen(true)}>Ampliar mapa</button>
            </div>
          </div>
        </div>
      </footer>

      {/* Subfooter fuera del fondo gris, ocupando todo el ancho */}
      <div className="subfooter-container">
        <div className="subfooter subfooter--admin">
          <div className="subfooter-copy">© 2026 Derechos Reservados Instituto Provincial del Tabaco – Corrientes</div>
          <div className="subfooter-link-wrap">
            <a href="https://ipt.gob.ar/" target="_blank" rel="noreferrer" className="subfooter-link">Sitio oficial IPT</a>
          </div>
        </div>
      </div>

      {mapOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={()=>setMapOpen(false)}>
          <div style={{ position:'relative', width:'90%', maxWidth:1000, background:'#fff', borderRadius:12, boxShadow:'0 12px 30px rgba(16,24,32,0.25)', border:'1px solid #e5e7eb' }} onClick={(e)=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:12 }}>
              <div style={{ fontWeight:700, color:'#14532d' }}>Instituto Provincial del Tabaco — Mapa</div>
              <button className="btn" onClick={()=>setMapOpen(false)}>Cerrar</button>
            </div>
            <div style={{ width:'100%', height:520, borderTop:'1px solid #e5e7eb' }}>
              <iframe
                title="Ubicación IPT (ampliado)"
                src="https://www.google.com/maps?q=Instituto+Provincial+del+Tabaco+Goya&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                style={{ width:'100%', height:'100%', border:0 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Footer;

