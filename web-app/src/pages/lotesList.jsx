import React, { useEffect, useState, useMemo } from "react";
import { lotesService } from "../services/lotes.service";
import { getProductorByIpt } from "../services/productores.service";
import { Link, useNavigate } from "react-router-dom";
import LoteFilters from "../components/LoteFilters";
import Swal from "sweetalert2";
import LoadingState from "../components/LoadingState";
import DismissibleAlert from "../components/DismissibleAlert";

const LotesList = () => {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaModByLoteId, setUltimaModByLoteId] = useState({});
  const [quickFilter, setQuickFilter] = useState("todos");
  const [sortConfig, setSortConfig] = useState(null);
  const navigate = useNavigate();

  // Estado para filtros
  const [filters, setFilters] = useState({
    nombre: "",
    ipt: "",
    orderBy: "newest",
    activo: "activos"
  });

  const handleFilterChange = (key, value) => {
    if (key === "orderBy") setSortConfig(null);
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      nombre: "",
      ipt: "",
      orderBy: "newest",
      activo: "activos"
    });
    setQuickFilter("todos");
    setSortConfig(null);
  };

  const hasCoordinates = (lote) => {
    if (Array.isArray(lote?.poligono) && lote.poligono.length > 0) {
      return lote.poligono.some((p) => {
        const lat = p?.lat ?? p?.latitude;
        const lng = p?.lng ?? p?.longitude;
        return lat !== null && lat !== undefined && lng !== null && lng !== undefined;
      });
    }
    const lat = lote?.lat ?? lote?.latitude;
    const lng = lote?.lng ?? lote?.longitude;
    return lat !== null && lat !== undefined && lng !== null && lng !== undefined;
  };

  const hasProductor = (lote) => Boolean(String(lote?.ipt || lote?.productorIpt || lote?.productorId || "").trim());
  const isActivo = (lote) => lote?.activo !== false;
  const normalizeText = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const loteStatusLabel = (lote) => (isActivo(lote) ? "Activo" : "Inactivo");
  const loteStatusClass = (lote) => (isActivo(lote) ? "is-active" : "is-inactive");
  const coordenadasLabel = (lote) => (hasCoordinates(lote) ? "Con coordenadas" : "Sin coordenadas");
  const coordenadasClass = (lote) => (hasCoordinates(lote) ? "has-coordinates" : "no-coordinates");

  const sortMark = (key) => (
    sortConfig?.key === key ? (sortConfig.direction === "asc" ? "^" : "v") : ""
  );

  const onSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
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
              <div class="lote-history-change" style="border:1px solid #e2e8f0; border-radius:10px; padding:10px; background:#f8fafc;">
                <div class="lote-history-change__field" style="font-weight:700; margin-bottom:6px;">Campo: ${esc(k)}</div>
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
      customClass: {
        popup: "lote-history-swal",
        title: "lote-history-swal__title",
        htmlContainer: "lote-history-swal__html",
        confirmButton: "lote-history-swal__button",
      },
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
            <div class="lote-history-list" style="text-align:left; display:flex; flex-direction:column; gap:12px; max-height:60vh; overflow:auto; padding-right:6px;">
              ${historial
                .map((h) => {
                  const isUpd = String(h?.accion || "").toLowerCase().trim() === "actualizar";
                  const cambiosHtml = isUpd ? renderCambios(h?.cambios) : "<div style='color:#6b7280'>Sin detalles</div>";
                  const nombre = h?.usuarioNombre || h?.usuarioId || "-";
                  return `
                    <div class="lote-history-entry" style="border:1px solid #e2e8f0; border-radius:12px; padding:12px; background:#ffffff;">
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
        const data = await lotesService.getLotes({ activo: "todos" });
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
  }, []);

  const lotesSummary = useMemo(() => {
    const base = Array.isArray(lotes) ? lotes : [];
    return base.reduce((acc, lote) => {
      acc.total += 1;
      if (isActivo(lote)) acc.activos += 1;
      else acc.inactivos += 1;
      if (hasCoordinates(lote)) acc.conCoordenadas += 1;
      else acc.sinCoordenadas += 1;
      if (hasProductor(lote)) acc.conProductor += 1;
      else acc.sinProductor += 1;
      return acc;
    }, {
      total: 0,
      activos: 0,
      inactivos: 0,
      conCoordenadas: 0,
      sinCoordenadas: 0,
      conProductor: 0,
      sinProductor: 0,
    });
  }, [lotes]);

  const quickFilters = [
    { key: "todos", label: "Todos", count: lotesSummary.total },
    { key: "activos", label: "Activos", count: lotesSummary.activos },
    { key: "inactivos", label: "Inactivos", count: lotesSummary.inactivos },
    { key: "conCoordenadas", label: "Con coordenadas", count: lotesSummary.conCoordenadas },
    { key: "sinCoordenadas", label: "Sin coordenadas", count: lotesSummary.sinCoordenadas },
    { key: "conProductor", label: "Con productor", count: lotesSummary.conProductor },
    { key: "sinProductor", label: "Sin productor", count: lotesSummary.sinProductor },
  ];

  const setQuick = (key) => {
    setQuickFilter(key);
    if (key === "activos") setFilters((prev) => ({ ...prev, activo: "activos" }));
    else if (key === "inactivos") setFilters((prev) => ({ ...prev, activo: "inactivos" }));
    else if (filters.activo !== "todos" && key !== "todos") setFilters((prev) => ({ ...prev, activo: "todos" }));
    else if (key === "todos") setFilters((prev) => ({ ...prev, activo: "todos" }));
  };

  // Lógica de filtrado y ordenamiento combinada
  const filteredAndSortedLotes = useMemo(() => {
    let result = [...lotes];

    if (filters.activo !== "todos") {
      result = result.filter((lote) => filters.activo === "activos" ? isActivo(lote) : !isActivo(lote));
    }

    if (quickFilter === "conCoordenadas") result = result.filter(hasCoordinates);
    if (quickFilter === "sinCoordenadas") result = result.filter((lote) => !hasCoordinates(lote));
    if (quickFilter === "conProductor") result = result.filter(hasProductor);
    if (quickFilter === "sinProductor") result = result.filter((lote) => !hasProductor(lote));

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

    const getVal = (v) => {
      if (!v) return 0;
      if (v.toDate) return v.toDate().getTime();
      const d = new Date(v);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    if (sortConfig?.key) {
      const getSortValue = (lote) => {
        if (sortConfig.key === "nombre") return normalizeText(lote?.nombre);
        if (sortConfig.key === "ipt") return Number(lote?.ipt) || String(lote?.ipt || "");
        if (sortConfig.key === "superficie") return Number(lote?.superficie || 0);
        if (sortConfig.key === "productor") return String(lote?.ipt || "");
        if (sortConfig.key === "estado") return loteStatusLabel(lote);
        if (sortConfig.key === "fecha") return getVal(lote?.fechaCreacion);
        return "";
      };
      result.sort((a, b) => {
        const aValue = getSortValue(a);
        const bValue = getSortValue(b);
        const compare = typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue), "es", { numeric: true, sensitivity: "base" });
        return sortConfig.direction === "asc" ? compare : -compare;
      });
      return result;
    }

    // 3. Ordenamiento
    result.sort((a, b) => {
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
  }, [lotes, filters, quickFilter, sortConfig]);

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
          "Tierra arada": lote?.loteArado ? "Sí" : "No",
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 className="users-title" style={{ margin: 0 }}>Gestión de Lotes</h2>
          <p className="section-subtitle">Consultá y gestioná los lotes productivos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link to="/lotes/mapa" className="btn">▣ Mapa general</Link>
          <Link to="/lotes/nuevo" className="btn">+ Nuevo lote</Link>
        </div>
      </div>

      <div className="turnos-summary lotes-summary">
        <div className="turnos-summary__chip turnos-summary__chip--total">
          <span className="turnos-summary__label">Mostrados</span>
          <span className="estado-badge expired">{filteredAndSortedLotes.length}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--completed">
          <span className="turnos-summary__label">Activos</span>
          <span className="estado-badge completed">{lotesSummary.activos}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--expired">
          <span className="turnos-summary__label">Inactivos</span>
          <span className="estado-badge expired">{lotesSummary.inactivos}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--confirmed">
          <span className="turnos-summary__label">Con coordenadas</span>
          <span className="estado-badge confirmed">{lotesSummary.conCoordenadas}</span>
        </div>
        <div className="turnos-summary__chip lotes-summary__chip--warning">
          <span className="turnos-summary__label">Sin coordenadas</span>
          <span className="estado-badge expired">{lotesSummary.sinCoordenadas}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--total">
          <span className="turnos-summary__label">Con productor</span>
          <span className="estado-badge expired">{lotesSummary.conProductor}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--total">
          <span className="turnos-summary__label">Total</span>
          <span className="estado-badge expired">{lotesSummary.total}</span>
        </div>
      </div>

      {lotesSummary.sinCoordenadas > 0 && (
        <DismissibleAlert className="lotes-data-alert">
          Hay {lotesSummary.sinCoordenadas} lote{lotesSummary.sinCoordenadas === 1 ? "" : "s"} sin coordenadas. Revisalos para que aparezcan correctamente en el mapa.
        </DismissibleAlert>
      )}

      <div className="lotes-quick-filters" aria-label="Filtros rapidos de lotes">
        {quickFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`lotes-filter-chip${quickFilter === filter.key ? " is-active" : ""}`}
            onClick={() => setQuick(filter.key)}
          >
            <span>{filter.label}</span>
            <strong>{filter.count}</strong>
          </button>
        ))}
      </div>

      <LoteFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
        onExport={handleExportExcel}
      />

      {loading ? (
        <LoadingState
          title="Cargando lotes..."
          message="Estamos preparando el listado de lotes. Espera unos segundos."
        />
      ) : (
        <>
          {filteredAndSortedLotes.length === 0 ? (
            <div className="lotes-empty-state" style={{
              textAlign: 'center',
              padding: '40px',
              backgroundColor: '#f9fafb', 
              borderRadius: '12px',
              border: '1px dashed #d1d5db',
              color: '#6b7280'
            }}>
              <div className="lotes-empty-state__content">
                <strong>{lotes.length === 0 ? "Todavia no hay lotes cargados." : "No encontramos lotes con esos criterios."}</strong>
                <span>{lotes.length === 0 ? "Cuando cargues el primer lote, va a aparecer en este listado." : "Proba cambiando la busqueda o limpiando los filtros para ver el listado completo."}</span>
                {lotes.length > 0 && <button type="button" className="btn secondary filter-clear-btn" onClick={resetFilters}>Limpiar filtros</button>}
              </div>
            </div>
          ) : (
            <div className="table-wrap lotes-table-wrap">
              <table className="lotes-table lotes-data-table">
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                      <button type="button" className="lotes-sort-button" onClick={() => onSort("nombre")}>
                        <span>Nombre</span>
                        <span className="lotes-sort-mark">{sortMark("nombre")}</span>
                      </button>
                    </th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                      <button type="button" className="lotes-sort-button" onClick={() => onSort("ipt")}>
                        <span>IPT</span>
                        <span className="lotes-sort-mark">{sortMark("ipt")}</span>
                      </button>
                    </th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                      <button type="button" className="lotes-sort-button" onClick={() => onSort("superficie")}>
                        <span>Superficie (ha)</span>
                        <span className="lotes-sort-mark">{sortMark("superficie")}</span>
                      </button>
                    </th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Tierra arada</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Coordenadas</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                      <button type="button" className="lotes-sort-button" onClick={() => onSort("estado")}>
                        <span>Estado</span>
                        <span className="lotes-sort-mark">{sortMark("estado")}</span>
                      </button>
                    </th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Método</th>
                    <th className="lotes-actions-cell" style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Acciones</th>
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
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                        <span className={`estado-badge ${lote.loteArado ? 'completed' : 'pending'}`}>
                          {lote.loteArado ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                        <span className={`lotes-status-badge ${coordenadasClass(lote)}`}>{coordenadasLabel(lote)}</span>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                        <span className={`lotes-status-badge ${loteStatusClass(lote)}`}>{loteStatusLabel(lote)}</span>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{formatMetodo(lote.metodoMarcado)}</td>
                      <td className="lotes-actions-cell" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
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
