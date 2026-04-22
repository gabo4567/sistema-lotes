import React, { useEffect, useState, useMemo } from "react";
import { lotesService } from "../services/lotes.service";
import { Link, useNavigate } from "react-router-dom";
import HomeButton from "../components/HomeButton";
import Layout from "../components/Layout";
import LoteFilters from "../components/LoteFilters";

const LotesList = () => {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Estado para filtros
  const [filters, setFilters] = useState({
    nombre: "",
    ipt: "",
    orderBy: "newest",
    activo: "activos"
  });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      nombre: "",
      ipt: "",
      orderBy: "newest",
      activo: "activos"
    });
  };

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
        const data = await lotesService.getLotes({ activo: filters.activo });
        setLotes(data);
        setError(null);
      } catch (err) {
        console.error("Error al cargar lotes:", err);
        setError(err.message || "Error al cargar los lotes. Por favor, intente nuevamente.");
      } finally {
        setLoading(false);
      }
    };

    fetchLotes();
  }, [filters.activo]);

  // Lógica de filtrado y ordenamiento combinada
  const filteredAndSortedLotes = useMemo(() => {
    let result = [...lotes];

    // 1. Filtro por nombre (contains, case insensitive)
    if (filters.nombre) {
      const search = filters.nombre.toLowerCase().trim();
      result = result.filter(lote => 
        (lote.nombre || "").toLowerCase().includes(search)
      );
    }

    // 2. Filtro por IPT
    if (filters.ipt) {
      const iptSearch = String(filters.ipt).trim();
      result = result.filter(lote => 
        String(lote.ipt || "").includes(iptSearch)
      );
    }

    // 3. Ordenamiento
    result.sort((a, b) => {
      const getVal = (v) => {
        if (!v) return 0;
        if (v.toDate) return v.toDate().getTime();
        const d = new Date(v);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };

      switch (filters.orderBy) {
        case "newest": {
          return getVal(b.fechaCreacion) - getVal(a.fechaCreacion);
        }
        case "oldest": {
          const valA = getVal(a.fechaCreacion);
          const valB = getVal(b.fechaCreacion);
          // Si alguno no tiene fecha, ponerlo al final
          if (valA === 0) return 1;
          if (valB === 0) return -1;
          return valA - valB;
        }
        case "areaDesc":
          return (b.superficie || 0) - (a.superficie || 0);
        case "areaAsc":
          return (a.superficie || 0) - (b.superficie || 0);
        case "nameAZ":
          return (a.nombre || "").localeCompare(b.nombre || "", undefined, { sensitivity: 'base' });
        case "nameZA":
          return (b.nombre || "").localeCompare(a.nombre || "", undefined, { sensitivity: 'base' });
        default:
          return 0;
      }
    });

    return result;
  }, [lotes, filters]);

  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    
    <div className="page-container">
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>Gestión de Lotes</h2>
        <Link to="/lotes/nuevo" className="btn">Nuevo lote</Link>
      </div>

      {loading ? (
        <div>Cargando lotes...</div>
      ) : (
      <>
        <LoteFilters 
          filters={filters} 
          onFilterChange={handleFilterChange} 
          onReset={resetFilters} 
        />
      
      {filteredAndSortedLotes.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          backgroundColor: '#f9fafb', 
          borderRadius: '12px',
          border: '1px dashed #d1d5db',
          color: '#6b7280'
        }}>
          {lotes.length === 0 ? "No hay lotes registrados." : "No se encontraron lotes con los filtros aplicados."}
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Nombre</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>IPT</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Superficie (ha)</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Estado</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Método</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedLotes.map((lote) => (
                <tr key={lote.id}>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.nombre || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.ipt || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.superficie ? lote.superficie.toFixed(2) : '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.estado || 'Pendiente'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{formatMetodo(lote.metodoMarcado)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                    <div className="actions-col" style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="btn" onClick={()=>navigate(`/lotes/${lote.id}`)}>Ver</button>
                      <button className="btn" onClick={()=>navigate(`/lotes/${lote.id}/editar`)}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}
    </div>
    
  );
};

export default LotesList;
