import React, { useEffect, useState } from "react";
import { lotesService } from "../services/lotes.service";
import { Link, useNavigate } from "react-router-dom";
import HomeButton from "../components/HomeButton";
import Layout from "../components/Layout";

const LotesList = () => {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const formatMetodo = (metodo) => {
    if (!metodo) return '-';
    const metodoLower = String(metodo).toLowerCase().trim();
    if (metodoLower === 'aéreo' || metodoLower === 'aereo') return 'Aéreo';
    if (metodoLower === 'gps') return 'GPS caminando';
    return metodo;
  };

  useEffect(() => {
    const fetchLotes = async () => {
      try {
        setLoading(true);
        const data = await lotesService.getLotes();
        setLotes(data);
        setError(null);
      } catch (err) {
        console.error("Error al cargar lotes:", err);
        setError("Error al cargar los lotes. Por favor, intente nuevamente.");
      } finally {
        setLoading(false);
      }
    };

    fetchLotes();
  }, []);

  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    
    <div>
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <h2>Gestión de Lotes</h2>
      {loading ? (
        <div>Cargando lotes...</div>
      ) : (
      <>
        <div className="flex gap-2">
          <Link to="/lotes/nuevo" className="btn">Nuevo lote</Link>
        </div>
      
      {lotes.length === 0 ? (
        <p>No hay lotes registrados.</p>
      ) : (
        <table style={{ marginTop: '20px', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Nombre</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>IPT</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Estado</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Método</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Observaciones (prod)</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Observaciones (técnico)</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((lote) => (
              <tr key={lote.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.nombre || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.ipt || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.estado || 'Pendiente'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{formatMetodo(lote.metodoMarcado)}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.observacionesProductor || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.observacionesTecnico || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                  <div className="actions-col">
                    <button className="btn" onClick={()=>navigate(`/lotes/${lote.id}`)}>Ver</button>
                    <button className="btn" onClick={()=>navigate(`/lotes/${lote.id}/editar`)}>Editar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </>
      )}
    </div>
    
  );
};

export default LotesList;
