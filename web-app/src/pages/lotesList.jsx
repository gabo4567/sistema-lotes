import React, { useEffect, useState, useMemo } from "react";
import { lotesService } from "../services/lotes.service";
import { getProductorByIpt } from "../services/productores.service";
import { Link, useNavigate } from "react-router-dom";
import HomeButton from "../components/HomeButton";
import LoteFilters from "../components/LoteFilters";
import Swal from "sweetalert2";

const LotesList = () => {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaModByLoteId, setUltimaModByLoteId] = useState({});
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

  const formatFecha = (ts) => {
    if (!ts) return "-";
    try {
      const d =
        typeof ts?.toDate === "function"
          ? ts.toDate()
          : typeof ts?._seconds === "number"
            ? new Date(ts._seconds * 1000)
            : typeof ts?.seconds === "number"
              ? new Date(ts.seconds * 1000)
              : new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    } catch {
      return "-";
    }
  };

  const accionLabel = (accion) => {
    const a = String(accion || "").toLowerCase().trim();
    if (a === "crear") return "Creó el lote";
    if (a === "actualizar") return "Actualizó el lote";
    if (a === "eliminar") return "Eliminó el lote";
    return accion || "-";
  };

  const renderCambios = (cambios) => {
    if (!cambios || typeof cambios !== "object") return "<div style='color:#6b7280'>Sin detalles</div>";
    const entries = Object.entries(cambios);
    if (entries.length === 0) return "<div style='color:#6b7280'>Sin detalles</div>";
    const esc = (v) => {
      try {
        return String(v)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      } catch {
        return "";
      }
    };
    return `
      <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
        ${entries
          .map(([k, v]) => {
            const antes = v?.antes ?? "-";
            const despues = v?.despues ?? "-";
            return `
              <div style="border:1px solid #e2e8f0; border-radius:10px; padding:10px; background:#f8fafc;">
                <div style="font-weight:700; margin-bottom:6px;">Campo: ${esc(k)}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                  <div><div style="color:#64748b; font-size:12px;">Antes</div><div style="white-space:pre-wrap;">${esc(typeof antes === "object" ? JSON.stringify(antes) : antes)}</div></div>
                  <div><div style="color:#64748b; font-size:12px;">Después</div><div style="white-space:pre-wrap;">${esc(typeof despues === "object" ? JSON.stringify(despues) : despues)}</div></div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const openHistorial = async (loteId) => {
    await Swal.fire({
      title: "Historial del lote",
      html: "<div style='padding:8px 0'>Cargando historial…</div>",
      confirmButtonText: "Cerrar",
      confirmButtonColor: "#2E7D32",
      width: 800,
      didOpen: async () => {
        try {
          Swal.showLoading();
          const data = await lotesService.getHistorialLote(loteId);
          const historial = Array.isArray(data) ? data : [];
          const top = historial[0];
          if (top?.usuarioId) {
            setUltimaModByLoteId((prev) => ({
              ...prev,
              [loteId]: { usuarioId: top.usuarioId, usuarioNombre: top.usuarioNombre, fecha: top.fecha },
            }));
          }
          if (historial.length === 0) {
            Swal.update({
              html: "<div style='color:#6b7280; padding:8px 0'>Sin historial</div>",
              showConfirmButton: true,
            });
            Swal.hideLoading();
            return;
          }
          const html = `
            <div style="text-align:left; display:flex; flex-direction:column; gap:12px; max-height:60vh; overflow:auto; padding-right:6px;">
              ${historial
                .map((h) => {
                  const isUpd = String(h?.accion || "").toLowerCase().trim() === "actualizar";
                  const cambiosHtml = isUpd ? renderCambios(h?.cambios) : "<div style='color:#6b7280'>Sin detalles</div>";
                  const nombre = h?.usuarioNombre || h?.usuarioId || "-";
                  return `
                    <div style="border:1px solid #e2e8f0; border-radius:12px; padding:12px; background:#ffffff;">
                      <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                        <div style="font-weight:800;">${accionLabel(h?.accion)}</div>
                        <div style="color:#64748b;">${formatFecha(h?.fecha)}</div>
                      </div>
                      <div style="margin-top:6px; color:#475569;">Usuario: <span style="font-weight:700;">${nombre}</span></div>
                      ${cambiosHtml}
                    </div>
                  `;
                })
                .join("")}
            </div>
          `;
          Swal.update({ html, showConfirmButton: true });
          Swal.hideLoading();
        } catch {
          Swal.update({
            html: "<div style='color:#b91c1c; padding:8px 0'>No se pudo cargar el historial</div>",
            showConfirmButton: true,
          });
          Swal.hideLoading();
        }
      },
    });
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

  const handleExportExcel = async () => {
    try {
      // Importar xlsx dinámicamente
      const XLSXModule = await import("xlsx");
      const XLSX = XLSXModule?.default || XLSXModule;

      const ipts = Array.from(
        new Set(
          filteredAndSortedLotes
            .map((l) => (l?.ipt != null ? String(l.ipt).trim() : ""))
            .filter(Boolean)
        )
      );

      const productoresByIpt = new Map();
      await Promise.all(
        ipts.map(async (ipt) => {
          try {
            const resp = await getProductorByIpt(ipt);
            productoresByIpt.set(ipt, resp?.data || null);
          } catch {
            productoresByIpt.set(ipt, null);
          }
        })
      );

      const exportData = filteredAndSortedLotes.map((lote) => {
        const ipt = lote?.ipt != null ? String(lote.ipt).trim() : "";
        const productor = ipt ? productoresByIpt.get(ipt) : null;
        const coords =
          lote?.poligono && Array.isArray(lote.poligono)
            ? lote.poligono
                .map((p) => {
                  const lat = p?.lat ?? p?.latitude;
                  const lng = p?.lng ?? p?.longitude;
                  if (lat == null || lng == null) return null;
                  return `${lat},${lng}`;
                })
                .filter(Boolean)
                .join(" | ")
            : "";

        return {
          "IPT del productor": ipt || "-",
          "Nombre del productor": productor?.nombreCompleto || "-",
          "Nombre del lote": lote?.nombre || "-",
          Coordenadas: coords || "-",
        };
      });

      // Crear workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Lotes");

      // Descargar archivo
      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `lotes_export_${timestamp}.xlsx`);
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      alert("Error al exportar los datos a Excel. Por favor, intente nuevamente.");
    }
  };

  return (
    
    <div className="page-container">
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>Gestión de Lotes</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link to="/lotes/mapa" className="btn">Mapa general</Link>
          <button className="btn" onClick={handleExportExcel} disabled={filteredAndSortedLotes.length === 0}>Exportar Excel</button>
          <Link to="/lotes/nuevo" className="btn">Nuevo lote</Link>
        </div>
      </div>

      <LoteFilters 
        filters={filters} 
        onFilterChange={handleFilterChange} 
        onReset={resetFilters} 
      />

      {loading ? (
        <div style={{ padding: 16, color:'#166534', textAlign: 'center' }}>Cargando lotes...</div>
      ) : (
        <>
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
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                        <div>{lote.nombre || '-'}</div>
                        {ultimaModByLoteId[lote.id]?.usuarioId ? (
                          <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                            Última modificación: {ultimaModByLoteId[lote.id]?.usuarioNombre || ultimaModByLoteId[lote.id]?.usuarioId}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.ipt || '-'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.superficie ? lote.superficie.toFixed(2) : '-'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{lote.estado || 'Pendiente'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{formatMetodo(lote.metodoMarcado)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                        <div className="actions-col" style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button className="btn" onClick={()=>navigate(`/lotes/${lote.id}`)}>Ver</button>
                          <button className="btn" onClick={()=>navigate(`/lotes/${lote.id}/editar`)}>Editar</button>
                          <button className="btn secondary" onClick={() => openHistorial(lote.id)}>Historial</button>
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
