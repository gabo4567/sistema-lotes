import React, { useState } from "react";


const Footer = () => {
  const [mapOpen, setMapOpen] = useState(false);
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      <footer className="footer-inst" style={{ backgroundColor: '#4b5563', color: '#fff', padding: '40px 0 40px 0', width: '100%' }}>
        <div className="footer-grid" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', maxWidth: 1200, margin: '0 auto', padding: '0 20px', gap: 20 }}>
          
          {/* Sección Izquierda: Logos y Contacto */}
          <div className="footer-left" style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column', gap: 40 }}>
            
            {/* Logos alineados horizontalmente, centrados hacia la izquierda, más grandes y separados */}
            <div style={{ display: 'flex', gap: 60, alignItems: 'center', justifyContent: 'center', marginLeft: '0' }}>
              <img 
                src="https://ipt.gob.ar/wp-content/uploads/2023/05/IPT-LOGO-06.png" 
                alt="Logo IPT" 
                style={{ height: 120, objectFit: 'contain' }} 
              />
              <img 
                src="https://ipt.gob.ar/wp-content/uploads/2023/05/MINISTERIO-DE-PRODUCCION-05.png" 
                alt="Ministerio de Producción" 
                style={{ height: 110, objectFit: 'contain' }} 
              />
              <img 
                src="https://ipt.gob.ar/wp-content/uploads/2023/05/GOBIERNO-DE-CORRIENTES-2-05.png" 
                alt="Gobierno de Corrientes" 
                style={{ height: 110, objectFit: 'contain' }} 
              />
            </div>

            {/* Información de contacto alineada a la izquierda abajo */}
            <ul className="footer-contact" style={{ listStyle: 'none', padding: 0, fontSize: 17, lineHeight: 2.2, marginLeft: '20px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>📍</span> Agustín P. Justo 1187, Goya, Corrientes, 3450
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>📞</span> +54 3777 433066
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>✉️</span> contacto@ipt.gob.ar
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>🕒</span> Lunes a Viernes de 7:00hs a 13:00hs
              </li>
            </ul>
          </div>

          {/* Sección Derecha: Mapa */}
          <div className="footer-map" style={{ flex: '0 1 350px' }}>
            <div className="footer-title" style={{ fontWeight: 700, marginBottom: 12, fontSize: 18 }}>Dónde nos encontramos</div>
            <div className="map-embed" style={{ borderRadius: 8, overflow: 'hidden', height: 220 }}>
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
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={()=>setMapOpen(true)} style={{ backgroundColor: '#fff', color: '#166534', border: 'none', fontWeight: 600 }}>Ampliar mapa</button>
            </div>
          </div>
        </div>
      </footer>

      {/* Subfooter fuera del fondo gris, ocupando todo el ancho */}
      <div className="subfooter-container" style={{ backgroundColor: '#fff', width: '100%', borderTop: '1px solid #e5e7eb' }}>
        <div className="subfooter" style={{ padding: '30px 40px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#374151', textAlign: 'center' }}>© 2026 Derechos Reservados Instituto Provincial del Tabaco – Corrientes</div>
          <div style={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)' }}>
            <a href="https://ipt.gob.ar/" target="_blank" rel="noreferrer" style={{ color: '#22c55e', textDecoration: 'underline', fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>Sitio oficial IPT</a>
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

