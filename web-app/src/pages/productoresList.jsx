import React, { useEffect, useMemo, useRef, useState } from "react";
import { createProductor, deleteProductor, getProductores, resetPasswordProductor, marcarReempadronado } from "../services/productores.service";
import { Link, useNavigate } from "react-router-dom";
import { confirmDialog, notify } from "../utils/alerts";
import LoadingState from "../components/LoadingState";

const ProductoresList = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [iptFilter, setIptFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [quickFilter, setQuickFilter] = useState("todos");
  const [sortConfig, setSortConfig] = useState({ key: "ipt", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const PAGE_SIZE = 20;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getProductores();
      setItems(data || []);
    } catch {
      setError("No se pudo cargar productores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const normalize = (s) => String(s||"").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizeIpt = (raw) => {
    if (raw === null || raw === undefined) return "";
    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) return "";
      if (Number.isInteger(raw)) {
        const s = String(raw).replace(/\D/g, "");
        return s.replace(/^0+/, "");
      }
      const rounded = Math.round(raw);
      if (Math.abs(raw - rounded) < 1e-9) {
        const s = String(rounded).replace(/\D/g, "");
        return s.replace(/^0+/, "");
      }
      return "";
    }
    const s = String(raw).trim();
    if (!s) return "";
    const low = s.toLowerCase();
    if (low === "nan" || low === "undefined" || low === "null") return "";
    const numericCandidate = s.replace(/\s+/g, "").replace(",", ".");
    if (/^\d+(\.\d+)?(e[+-]?\d+)?$/i.test(numericCandidate)) {
      const n = Number(numericCandidate);
      if (Number.isFinite(n) && Number.isInteger(n)) {
        const out = String(n).replace(/\D/g, "");
        return out.replace(/^0+/, "");
      }
    }
    const digits = s.replace(/\D/g, "");
    return digits.replace(/^0+/, "");
  };

  const existingIptSet = useMemo(() => {
    return new Set((items || []).map((p) => normalizeIpt(p?.ipt)).filter(Boolean));
  }, [items]);

  const hasPhone = (p) => Boolean(String(p?.telefono || "").trim());
  const hasLocalidad = (p) => Boolean(String(p?.domicilioCasa || p?.localidad || "").trim());
  const hasIngresos = (p) => Number(p?.historialIngresos || 0) > 0;
  const isReempadronado = (p) => String(p?.estado || "").toLowerCase().includes("re-empadronado");
  const isActivo = (p) => p?.activo !== false;
  const isIncomplete = (p) => !hasPhone(p) || !hasLocalidad(p);

  const getEstadoLabel = (p) => {
    if (!isActivo(p)) return "Inactivo";
    if (isReempadronado(p)) return "Re-empadronado";
    return p?.estado || "Nuevo";
  };

  const getEstadoClass = (p) => {
    if (!isActivo(p)) return "is-inactive";
    if (isReempadronado(p)) return "is-reempadronado";
    return "is-new";
  };

  const sortValue = (p, key) => {
    if (key === "ipt") return Number(normalizeIpt(p?.ipt)) || 0;
    if (key === "nombre") return normalize(p?.nombreCompleto || p?.nombre || "");
    if (key === "estado") return normalize(getEstadoLabel(p));
    if (key === "ingresos") return Number(p?.historialIngresos || 0);
    return "";
  };

  const onSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortMark = (key) => (
    sortConfig.key === key ? (sortConfig.direction === "asc" ? "^" : "v") : ""
  );

  const viewItems = useMemo(() => {
    const filtered = items.filter(p => {
      const okIpt = iptFilter ? String(p.ipt||"").includes(String(iptFilter)) : true;
      const okName = nameFilter ? normalize(p.nombreCompleto||p.nombre||"").includes(normalize(nameFilter)) : true;
      const okQuick = (() => {
        if (quickFilter === "activos") return isActivo(p);
        if (quickFilter === "inactivos") return !isActivo(p);
        if (quickFilter === "reempadronados") return isReempadronado(p);
        if (quickFilter === "conIngresos") return hasIngresos(p);
        if (quickFilter === "sinTelefono") return !hasPhone(p);
        if (quickFilter === "incompletos") return isIncomplete(p);
        return true;
      })();
      return okIpt && okName && okQuick;
    });

    return [...filtered].sort((a, b) => {
      const aValue = sortValue(a, sortConfig.key);
      const bValue = sortValue(b, sortConfig.key);
      const result = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), "es", { numeric: true, sensitivity: "base" });
      return sortConfig.direction === "asc" ? result : -result;
    });
  }, [items, iptFilter, nameFilter, quickFilter, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(viewItems.length / PAGE_SIZE));
  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return viewItems.slice(start, start + PAGE_SIZE);
  }, [viewItems, currentPage]);

  const productoresSummary = useMemo(() => {
    const base = Array.isArray(items) ? items : [];
    return base.reduce((acc, p) => {
      acc.total += 1;
      if (!isActivo(p)) acc.inactivos += 1;
      else acc.activos += 1;
      if (isReempadronado(p)) acc.reempadronados += 1;
      if (hasIngresos(p)) acc.conIngresos += 1;
      if (!hasPhone(p)) acc.sinTelefono += 1;
      if (!hasLocalidad(p)) acc.sinLocalidad += 1;
      if (isIncomplete(p)) acc.incompletos += 1;
      return acc;
    }, {
      total: 0,
      activos: 0,
      inactivos: 0,
      reempadronados: 0,
      conIngresos: 0,
      sinTelefono: 0,
      sinLocalidad: 0,
      incompletos: 0,
    });
  }, [items]);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  useEffect(() => {
    setCurrentPage(1);
  }, [iptFilter, nameFilter, quickFilter]);

  const quickFilters = [
    { key: "todos", label: "Todos", count: productoresSummary.total },
    { key: "activos", label: "Activos", count: productoresSummary.activos },
    { key: "inactivos", label: "Inactivos", count: productoresSummary.inactivos },
    { key: "reempadronados", label: "Re-empadronados", count: productoresSummary.reempadronados },
    { key: "conIngresos", label: "Con ingresos", count: productoresSummary.conIngresos },
    { key: "sinTelefono", label: "Sin telefono", count: productoresSummary.sinTelefono },
    { key: "incompletos", label: "Datos incompletos", count: productoresSummary.incompletos },
  ];

  const clearFilters = () => {
    setIptFilter("");
    setNameFilter("");
    setQuickFilter("todos");
  };

  const onClickImport = () => {
    if (importing) return;
    const el = fileInputRef.current;
    if (el) el.click();
  };

  const onImportFile = async (file) => {
    if (!file) return;
    if (importing) return;
    if (!String(file.name || '').toLowerCase().endsWith('.xlsx')) {
      await notify({ title: "Archivo inválido", text: "Seleccioná un archivo .xlsx", icon: "error" });
      return;
    }

    setImporting(true);
    try {
      const XLSX = await import("xlsx");

      const buf = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
        reader.readAsArrayBuffer(file);
      });

      const workbook = XLSX.read(buf, { type: "array" });
      const firstSheetName = workbook?.SheetNames?.[0];
      if (!firstSheetName) {
        await notify({ title: "Archivo vacío", text: "El archivo no tiene hojas", icon: "error" });
        return;
      }
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!Array.isArray(rows) || rows.length === 0) {
        await notify({ title: "Archivo vacío", text: "No se encontraron filas para importar", icon: "error" });
        return;
      }

      const normalizeKey = (k) => String(k || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const getCol = (row, name) => {
        if (!row || typeof row !== "object") return "";
        const wanted = normalizeKey(name);
        const keys = Object.keys(row);
        const key = keys.find((k) => normalizeKey(k) === wanted)
          || keys.find((k) => normalizeKey(k).replace(/\s+/g, "") === wanted.replace(/\s+/g, ""))
          || keys.find((k) => normalizeKey(k).replace(/\s+/g, "").startsWith(wanted.replace(/\s+/g, "")));
        return key ? row[key] : "";
      };

      let imported = 0;
      let duplicated = 0;
      const existingSeen = new Set(existingIptSet);
      const fileSeen = new Set();
      const rowsWithData = rows.filter((r) => {
        const ipt = normalizeIpt(getCol(r, "ipt"));
        const nombre = String(getCol(r, "nombre")).trim();
        return Boolean(ipt) || Boolean(nombre);
      });

      if (rowsWithData.length === 0) {
        await notify({ title: "Archivo inválido", text: "No se encontraron columnas/filas válidas", icon: "error" });
        return;
      }

      const logLimit = 50;
      for (let idx = 0; idx < rowsWithData.length; idx += 1) {
        const row = rowsWithData[idx];
        const iptRaw = getCol(row, "ipt");
        const ipt = normalizeIpt(iptRaw);
        const nombreRaw = getCol(row, "nombre");
        const nombre = String(nombreRaw ?? "").trim();
        const cuilRaw = getCol(row, "cuil");
        const cuil = String(cuilRaw ?? "").trim();
        if (idx < logLimit) {
          console.log("[IMPORT XLSX] fila", idx + 1, { iptRaw, ipt, nombre: nombre || null, cuil: cuil || null });
        }
        if (!ipt || !nombre || !cuil) {
          if (idx < logLimit) console.log("[IMPORT XLSX] ignorada (faltan requeridos)", idx + 1);
          continue;
        }
        if (fileSeen.has(ipt)) {
          duplicated += 1;
          if (idx < logLimit) console.log("[IMPORT XLSX] duplicada dentro del archivo", idx + 1, { ipt });
          continue;
        }
        if (existingSeen.has(ipt)) {
          duplicated += 1;
          if (idx < logLimit) console.log("[IMPORT XLSX] duplicada contra sistema", idx + 1, { ipt });
          continue;
        }

        const telefonoRaw = getCol(row, "telefono");
        const telefono = String(telefonoRaw ?? "").trim() || "";

        const localidadRaw = getCol(row, "localidad");
        const localidad = String(localidadRaw ?? "").trim() || "";

        const emailRaw = getCol(row, "email");
        const email = String(emailRaw ?? "").trim() || "";

        try {
          await createProductor({
            ipt: String(ipt),
            nombreCompleto: nombre,
            cuil: String(cuil),
            telefono: telefono || "",
            domicilioCasa: localidad || "",
            email: email || "",
          });
          imported += 1;
          fileSeen.add(ipt);
          existingSeen.add(ipt);
        } catch {
          continue;
        }
      }

      await notify({
        title: "Importación finalizada",
        text: `${imported} productores importados. ${duplicated} duplicados ignorados.`,
        icon: "success",
      });
      await load();
    } catch {
      await notify({ title: "Error", text: "No se pudo importar el archivo. Verificá que sea un .xlsx válido.", icon: "error" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onResetPassword = async (ipt) => {
    const ok = await confirmDialog({ title: "¿Estás seguro?", text: "¿Estás seguro de que deseas resetear la contraseña del productor a su CUIL nuevamente?", icon: "warning", confirmButtonText: "Resetear", cancelButtonText: "Cancelar" });
    if (!ok) return;
    try {
      await resetPasswordProductor(ipt);
      await notify({ title: "Listo", text: "Contraseña reseteada (CUIL en próximo ingreso)", icon: "success" });
    } catch {
      await notify({ title: "Error", text: "No se pudo resetear contraseña", icon: "error" });
    }
  };

  const onReempadronado = async (ipt) => {
    const ok = await confirmDialog({ title: "¿Estás seguro?", text: "¿Estás seguro de que deseas reempadronar al productor?", icon: "warning", confirmButtonText: "Re-empadronar", cancelButtonText: "Cancelar" });
    if (!ok) return;
    try {
      await marcarReempadronado(ipt);
      await notify({ title: "Listo", text: "Productor marcado como re-empadronado", icon: "success" });
      load();
    } catch {
      await notify({ title: "Error", text: "No se pudo marcar re-empadronado", icon: "error" });
    }
  };

  const onDesactivar = async (productor) => {
    const nombre = productor?.nombreCompleto || productor?.nombre || productor?.ipt || "este productor";
    const ok = await confirmDialog({
      title: "Desactivar productor",
      text: `El productor ${nombre} quedará inactivo, pero no se borrará de la base de datos.`,
      icon: "warning",
      confirmButtonText: "Desactivar",
      cancelButtonText: "Cancelar",
    });
    if (!ok) return;
    try {
      await deleteProductor(productor.ipt);
      await notify({ title: "Productor desactivado", icon: "success" });
      load();
    } catch {
      await notify({ title: "Error", text: "No se pudo desactivar el productor", icon: "error" });
    }
  };

  const onVer = (id) => { navigate(`/productores/${id}`); };
  const onEditar = (id) => { navigate(`/productores/${id}/editar`); };

  if (error) return <div style={{ padding: 24, color: "#c0392b" }}>{error}</div>;

  return (
    <div className="prod-list page-container" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="users-title" style={{ margin: 0 }}>Gestión de Productores</h2>
          <p className="section-subtitle">Consultá, filtrá y administrá la información de los productores.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btn" style={{ fontFamily: "inherit", fontSize: "inherit" }} onClick={onClickImport} disabled={importing}>
            {importing ? "Importando…" : "↑ Importar Excel"}
          </button>
          <Link to="/productores/nuevo" className="btn" style={{ fontFamily: "inherit", fontSize: "inherit" }}>+ Nuevo productor</Link>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={(e) => onImportFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <div className="turnos-summary productores-summary">
        <div className="turnos-summary__chip turnos-summary__chip--total">
          <span className="turnos-summary__label">Mostrados</span>
          <span className="estado-badge expired">{viewItems.length}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--confirmed">
          <span className="turnos-summary__label">Activos</span>
          <span className="estado-badge confirmed">{productoresSummary.activos}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--expired">
          <span className="turnos-summary__label">Inactivos</span>
          <span className="estado-badge expired">{productoresSummary.inactivos}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--completed">
          <span className="turnos-summary__label">Re-empadronados</span>
          <span className="estado-badge completed">{productoresSummary.reempadronados}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--insumo" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <span className="turnos-summary__label" style={{ color: '#1d4ed8' }}>Con ingresos</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1d4ed8' }}>{productoresSummary.conIngresos}</span>
        </div>
        <div className="turnos-summary__chip turnos-summary__chip--total">
          <span className="turnos-summary__label">Total</span>
          <span className="estado-badge expired">{productoresSummary.total}</span>
        </div>
        <div className="turnos-summary__chip productores-summary__chip--warning">
          <span className="turnos-summary__label">Datos incompletos</span>
          <span className="estado-badge expired">{productoresSummary.incompletos}</span>
        </div>
        <div className="turnos-summary__chip productores-summary__chip--warning">
          <span className="turnos-summary__label">Sin localidad</span>
          <span className="estado-badge expired">{productoresSummary.sinLocalidad}</span>
        </div>
      </div>

      <div className="productores-quick-filters" aria-label="Filtros rapidos de productores">
        {quickFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`productores-filter-chip${quickFilter === filter.key ? " is-active" : ""}`}
            onClick={() => setQuickFilter(filter.key)}
          >
            <span>{filter.label}</span>
            <strong>{filter.count}</strong>
          </button>
        ))}
      </div>

      <div className="filters-bar productores-filters-bar" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        backgroundColor: '#ffffff',
        padding: 20, 
        borderRadius: 12, 
        marginBottom: 20,
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        alignItems: 'flex-end'
      }}>
        <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 220px' }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151' }}>IPT</label>
          <input
            type="text"
            className="input-inst"
            placeholder="Filtrar por IPT..."
            value={iptFilter}
            onChange={e=>setIptFilter(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, minHeight: 42, borderRadius: 8 }}
          />
        </div>
        <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 260px' }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151' }}>Nombre</label>
          <input
            type="text"
            className="input-inst"
            placeholder="Filtrar por nombre..."
            value={nameFilter}
            onChange={e=>setNameFilter(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, minHeight: 42, borderRadius: 8 }}
          />
        </div>
        <button
          className="btn secondary filter-clear-btn"
          onClick={clearFilters}
        >
          Limpiar filtros
        </button>
      </div>

      {loading ? (
        <LoadingState
          title="Cargando productores..."
          message="Estamos preparando el listado de productores. Espera unos segundos."
        />
      ) : (
        <div className="table-wrap admin-data-table-wrap productores-table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="table-inst admin-data-table productores-table" style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1320, tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                  <button type="button" className="productores-sort-button" onClick={() => onSort("ipt")}>
                    <span>IPT</span>
                    <span className="productores-sort-mark">{sortMark("ipt")}</span>
                  </button>
                </th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                  <button type="button" className="productores-sort-button" onClick={() => onSort("nombre")}>
                    <span>Nombre</span>
                    <span className="productores-sort-mark">{sortMark("nombre")}</span>
                  </button>
                </th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Teléfono</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Localidad</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                  <button type="button" className="productores-sort-button" onClick={() => onSort("estado")}>
                    <span>Estado</span>
                    <span className="productores-sort-mark">{sortMark("estado")}</span>
                  </button>
                </th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                  <button type="button" className="productores-sort-button" onClick={() => onSort("ingresos")}>
                    <span>Ingresos</span>
                    <span className="productores-sort-mark">{sortMark("ingresos")}</span>
                  </button>
                </th>
                <th className="productores-actions-cell" style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', width: 340 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ border: '1px solid #ddd', padding: '28px 12px', textAlign:'center' }}>
                    <div className="productores-empty-state">
                      <strong>No encontramos productores con esos criterios.</strong>
                      <span>Proba cambiando la busqueda o limpiando los filtros para ver el listado completo.</span>
                      <button type="button" className="btn secondary filter-clear-btn" onClick={clearFilters}>Limpiar filtros</button>
                    </div>
                  </td>
                </tr>
              ) : pagedItems.map((p) => (
                <tr key={p.id || p.ipt}>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{p.ipt || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }} title={p.nombreCompleto || ''}>{p.nombreCompleto || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }} title={p.telefono || ''}>{p.telefono || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }} title={p.domicilioCasa || ''}>{p.domicilioCasa || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                    <span className={`productores-status-badge ${getEstadoClass(p)}`}>{getEstadoLabel(p)}</span>
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{p.historialIngresos ?? 0}</td>
                  <td className="productores-actions-cell" style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', minWidth: 340 }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))',
                        gap: 8,
                        justifyItems: 'stretch',
                        alignItems: 'center',
                        maxWidth: 300,
                        margin: '0 auto'
                      }}
                    >
                      <button className="btn btn-compact" onClick={() => onVer(p.ipt)} style={{ minWidth: 0 }}>Ver</button>
                      <button className="btn btn-compact" onClick={() => onEditar(p.ipt)} style={{ minWidth: 0 }}>Editar</button>
                      <button className="btn btn-compact" onClick={() => onResetPassword(p.ipt)} style={{ minWidth: 0 }}>Reset contraseña</button>
                      <button className="btn btn-compact" onClick={() => onReempadronado(p.ipt)} style={{ minWidth: 0 }}>Re-empadronar</button>
                      <button
                        className="btn btn-danger btn-compact"
                        onClick={() => onDesactivar(p)}
                        style={{ gridColumn: '1 / -1', minWidth: 0 }}
                      >
                        Desactivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pageCount > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
              <div style={{ color: '#475569', fontSize: 14 }}>
                Mostrando {pagedItems.length} de {viewItems.length} productores
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn secondary"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  style={{ minWidth: 90, borderRadius: 8 }}
                >
                  Anterior
                </button>
                <span style={{ color: '#334155', fontWeight: 600 }}>{currentPage} / {pageCount}</span>
                <button
                  className="btn secondary"
                  onClick={() => setCurrentPage(prev => Math.min(pageCount, prev + 1))}
                  disabled={currentPage >= pageCount}
                  style={{ minWidth: 90, borderRadius: 8 }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductoresList;
