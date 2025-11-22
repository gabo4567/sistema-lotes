import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getProductorById, getHistorialIngresos } from "../services/productores.service";
import Layout from "../components/Layout";

const ProductorDetail = () => {
  const { id } = useParams();
  const [prod, setProd] = useState(null);
  const [hist, setHist] = useState(null);
  const [error, setError] = useState("");

  useEffect(()=>{ (async ()=>{
    try {
      const { data } = await getProductorById(id);
      setProd(data);
      if (data?.ipt) {
        const { data: h } = await getHistorialIngresos(data.ipt);
        setHist(h);
      }
    } catch (e) {
      setError("No se pudo cargar productor");
    }
  })() }, [id]);

  return (
<body>
      {!prod ? (<div>Cargando…</div>) : (
        <div>
          <h2>Productor {prod.nombreCompleto || ''}</h2>
          <div>IPT: {prod.ipt}</div>
          <div>CUIL: {prod.cuil}</div>
          <div>Email: {prod.email || '-'}</div>
          <div>Teléfono: {prod.telefono || '-'}</div>
          <div>Domicilio: {prod.domicilioCasa || '-'}</div>
          <div>Ingreso al campo: {prod.domicilioIngresoCampo ? `${prod.domicilioIngresoCampo.lat}, ${prod.domicilioIngresoCampo.lng}` : '-'}</div>
          <div>Estado: {prod.estado}</div>
          <div>Requiere cambio de contraseña: {String(prod.requiereCambioContrasena)}</div>
          <div>Plantas/ha: {prod.plantasPorHa ?? '-'}</div>
          <h3 style={{ marginTop: 16 }}>Historial de ingresos</h3>
          <pre style={{ background:'#fff', padding:12, borderRadius:8 }}>{hist ? JSON.stringify(hist, null, 2) : 'Sin datos'}</pre>
          {error && <div className="text-red-600">{error}</div>}
        </div>
      )}
    </body>
  );
};

export default ProductorDetail;