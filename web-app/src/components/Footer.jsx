import React, { useState } from "react";


const Footer = () => {
  const [mapOpen, setMapOpen] = useState(false);
  return (
    <footer className="footer-inst">
      <div className="footer-grid">
        <div className="footer-col">
          <div className="footer-brand">
            <div>IPT</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>Instituto Provincial del Tabaco</div>
          </div>
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
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={()=>setMapOpen(true)}>Ampliar mapa</button>
          </div>
        </div>
      </div>
      <div className="subfooter">
        <div>© 2025 Derechos Reservados Instituto Provincial del Tabaco – Corrientes</div>
        <a href="https://ipt.gob.ar/" target="_blank" rel="noreferrer">Sitio oficial IPT</a>
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
    </footer>
  );
};

export default Footer;

