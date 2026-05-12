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
    if (filteredAndSortedLotes.length === 0) {
      await Swal.fire({
        title: "Sin lotes para exportar",
        text: "No hay lotes cargados o no hay resultados con los filtros actuales.",
        icon: "info",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#2E7D32",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Exportar Excel",
      text: `Se exportaran ${filteredAndSortedLotes.length} lote(s) segun los filtros actuales. Desea continuar?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Exportar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#2E7D32",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

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
    <div className="lotes-container">
      {/* Header de Lotes */}
      <div className="lotes-header-row">
        <div className="lotes-header-left">
          <HomeButton />
          <div className="lotes-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div className="lotes-header-titles">
            <h1 className="main-title">Gestión de Lotes</h1>
            <p className="subtitle">Administrá y consultá todos los lotes registrados.</p>
          </div>
        </div>
        <div className="lotes-header-actions">
          <Link to="/lotes/mapa" className="btn-lote-action">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
              <line x1="8" y1="2" x2="8" y2="18"></line>
              <line x1="16" y1="6" x2="16" y2="22"></line>
            </svg>
            Mapa general
          </Link>
          <button className="btn-lote-action" onClick={handleExportExcel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Exportar Excel
          </button>
          <Link to="/lotes/nuevo" className="btn-lote-action primary">
            <span style={{ fontSize: '20px', lineHeight: '1' }}>+</span> Nuevo lote
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <LoteFilters 
        filters={filters} 
        onFilterChange={handleFilterChange} 
        onReset={resetFilters} 
      />

      {loading ? (
        <div style={{ padding: 60, color: '#1a4d2e', textAlign: 'center', fontSize: '18px', fontWeight: '700' }}>
          Cargando lotes...
        </div>
      ) : (
        <>
          {filteredAndSortedLotes.length === 0 ? (
            <div className="lotes-empty-state">
              <div className="empty-state-illustration">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <path d="M12 22V12"></path>
                  <path d="M12 8a3 3 0 0 1 3-3h1"></path>
                  <path d="M12 8a3 3 0 0 0-3-3H8"></path>
                  <path d="M12 12l8.73-5.04"></path>
                  <path d="M12 12L3.27 6.96"></path>
                </svg>
              </div>
              <h3 className="empty-state-title">No hay lotes registrados</h3>
              <p className="empty-state-desc">
                {lotes.length === 0 
                  ? "Aún no se han creado lotes. Comenzá agregando un nuevo lote para llevar un mejor control de tu producción."
                  : "No se encontraron lotes con los filtros aplicados. Intentá ajustar tu búsqueda."}
              </p>
              <button className="btn-create-empty" onClick={() => navigate("/lotes/nuevo")}>
                <span style={{ fontSize: '20px', lineHeight: '1' }}>+</span> Crear nuevo lote
              </button>
            </div>
          ) : (
            <div className="users-table-card">
              <div className="table-responsive">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>
                        <div className="th-content">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                          Nombre
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          IPT
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                          Superficie (ha)
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                          Estado
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                          Método
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                          Acciones
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedLotes.map((lote) => (
                      <tr key={lote.id}>
                        <td>
                          <div className="user-info-cell">
                            <div className="user-avatar" style={{ backgroundColor: '#f0fdf4', color: '#166534' }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="user-name">{lote.nombre || '-'}</span>
                              {ultimaModByLoteId[lote.id]?.usuarioId ? (
                                <span className="user-date">
                                  Mod: {ultimaModByLoteId[lote.id]?.usuarioNombre || ultimaModByLoteId[lote.id]?.usuarioId}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td><span className="user-email">{lote.ipt || '-'}</span></td>
                        <td><span className="lotes-superficie">{lote.superficie ? lote.superficie.toFixed(2) : '-'}</span></td>
                        <td>
                          <div className={`status-badge ${lote.activo !== false ? 'active' : 'inactive'}`}>
                            <span className="dot"></span>
                            {lote.estado || 'Activo'}
                          </div>
                        </td>
                        <td><span className="user-date">{formatMetodo(lote.metodoMarcado)}</span></td>
                        <td>
                          <div className="user-actions">
                            <div className="action-buttons-row">
                              <button className="btn-action-activate" onClick={() => navigate(`/lotes/${lote.id}`)}>
                                Ver
                              </button>
                              <button className="btn-action-reset" onClick={() => navigate(`/lotes/${lote.id}/editar`)}>
                                Editar
                              </button>
                            </div>
                            <button className="btn-action-reset" style={{ width: '100%' }} onClick={() => openHistorial(lote.id)}>
                              Historial
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <span className="pagination-info">Total: {filteredAndSortedLotes.length} lotes</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LotesList;
