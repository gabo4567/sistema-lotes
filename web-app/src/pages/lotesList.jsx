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

  if (loading) return <div>Cargando lotes...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    
    <div>
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <h2>Gestión de Lotes</h2>
      <div className="flex gap-2">
        <Link to="/lotes/nuevo" className="btn">Nuevo lote</Link>
      </div>
      
      {lotes.length === 0 ? (
        <p>No hay lotes registrados.</p>
      ) : (
        <table style={{ marginTop: '20px', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Nombre</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>IPT</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Estado</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Método</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Observaciones (prod)</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Observaciones (técnico)</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((lote) => (
              <tr key={lote.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{lote.nombre || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{lote.ipt || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{lote.estado || 'Pendiente'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{lote.metodoMarcado || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{lote.observacionesProductor || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{lote.observacionesTecnico || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
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
    </div>
    
  );
};

export default LotesList;
