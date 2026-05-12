import React, { useEffect, useMemo, useRef, useState } from "react";
import { createProductor, deleteProductor, getProductores, resetPasswordProductor, marcarReempadronado } from "../services/productores.service";
import { Link, useNavigate } from "react-router-dom";
import HomeButton from "../components/HomeButton";
import { confirmDialog, notify } from "../utils/alerts";

const ProductoresList = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [iptFilter, setIptFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [importing, setImporting] = useState(false);

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

  const viewItems = items.filter(p => {
    const okIpt = iptFilter ? String(p.ipt||"").includes(String(iptFilter)) : true;
    const okName = nameFilter ? normalize(p.nombreCompleto||p.nombre||"").includes(normalize(nameFilter)) : true;
    return okIpt && okName;
  });

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
      await deleteProductor(productor.id);
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
    <div className="productores-container">
      {/* Header de Productores */}
      <div className="productores-header-row">
        <div className="productores-header-left">
          <HomeButton />
          <div className="productores-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div className="productores-header-titles">
            <h1 className="main-title">Gestión de Productores</h1>
            <p className="subtitle">Administrá la base de datos de productores y su información de contacto.</p>
          </div>
        </div>
        <div className="productores-header-actions">
          <button className="btn-productor-action" onClick={onClickImport} disabled={importing}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            {importing ? "Importando..." : "Importar Excel"}
          </button>
          <Link to="/productores/nuevo" className="btn-productor-action primary">
            <span style={{ fontSize: '20px', lineHeight: '1' }}>+</span> Nuevo productor
          </Link>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={(e) => onImportFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="productores-filters-card">
        <div className="productor-filter-group" style={{ flex: '0 0 240px' }}>
          <label>IPT</label>
          <div className="productor-input-wrapper">
            <input
              type="text"
              placeholder="Filtrar por IPT..."
              value={iptFilter}
              onChange={e => setIptFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="productor-filter-group">
          <label>Nombre del productor</label>
          <div className="productor-input-wrapper">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={nameFilter}
              onChange={e => setNameFilter(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-clear-filters" onClick={() => { setIptFilter(''); setNameFilter(''); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z"></path>
          </svg>
          Limpiar filtros
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 60, color: '#1a4d2e', textAlign: 'center', fontSize: '18px', fontWeight: '700' }}>
          Cargando productores...
        </div>
      ) : (
        <div className="users-table-card">
          <div className="table-responsive">
            <table className="users-table">
              <thead>
                <tr>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                      IPT / Nombre
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                      Contacto
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      Localidad
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
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                      Ingresos
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
                {viewItems.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No se encontraron productores</td></tr>
                ) : viewItems.map((p) => {
                  const initials = (p.nombreCompleto || p.nombre || "??").split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="user-info-cell">
                          <div className="user-avatar">{initials}</div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="user-name">{p.nombreCompleto || '-'}</span>
                            <span className="user-email">IPT: {p.ipt || '-'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className="user-email" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            {p.telefono || '-'}
                          </span>
                          <span className="user-email" style={{ fontSize: '12px', opacity: 0.8 }}>{p.email || ''}</span>
                        </div>
                      </td>
                      <td><span className="user-date">{p.domicilioCasa || '-'}</span></td>
                      <td>
                        <div className={`status-badge ${p.estado === 'Activo' ? 'active' : 'inactive'}`}>
                          <span className="dot"></span>
                          {p.estado || 'Activo'}
                        </div>
                      </td>
                      <td>
                        <span className="user-role" style={{ backgroundColor: '#f0fdf4', color: '#166534' }}>
                          {p.historialIngresos ?? 0} ingresos
                        </span>
                      </td>
                      <td>
                        <div className="user-actions">
                          <div className="action-buttons-row">
                            <button className="btn-action-activate" onClick={() => onVer(p.id)}>Ver</button>
                            <button className="btn-action-reset" onClick={() => onEditar(p.id)}>Editar</button>
                          </div>
                          <div className="action-buttons-row">
                            <button className="btn-action-reset" style={{ flex: 1 }} onClick={() => onResetPassword(p.ipt)}>Reset Clave</button>
                            <button className="btn-action-activate" style={{ flex: 1 }} onClick={() => onReempadronado(p.ipt)}>Re-empadronar</button>
                          </div>
                          <button className="btn-action-deactivate" onClick={() => onDesactivar(p)}>Desactivar Productor</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span className="pagination-info">Total: {viewItems.length} productores</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductoresList;
