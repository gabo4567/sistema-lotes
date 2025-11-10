import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { lotesService } from "../services/lotes.service";

const LotesList = () => {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <div>
      <h2>Gestión de Lotes</h2>
      <Link to="/">← Volver al Inicio</Link>

      {lotes.length === 0 ? (
        <p>No hay lotes registrados.</p>
      ) : (
        <table
          style={{
            marginTop: "20px",
            borderCollapse: "collapse",
            width: "100%",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f0f0f0" }}>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>ID</th>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>Nombre</th>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>Detalles</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((lote) => (
              <tr key={lote.id}>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{lote.id}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                  {lote.nombre || "Sin nombre"}
                </td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                  {lote.descripcion || lote.detalle || "Sin detalles"}
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
