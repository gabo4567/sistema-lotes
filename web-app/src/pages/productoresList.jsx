import React, { useEffect, useMemo, useRef, useState } from "react";
import { createProductor, deleteProductor, getProductores, getProductoresInactivos, activateProductor, resetPasswordProductor, marcarReempadronado } from "../services/productores.service";
import { Link, useNavigate } from "react-router-dom";
import { confirmDialog, notify } from "../utils/alerts";

const ProductoresList = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [inactiveItems, setInactiveItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [iptFilter, setIptFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [importing, setImporting] = useState(false);
  const [viewType, setViewType] = useState("activos"); // 'activos' o 'inactivos'

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: activos } = await getProductores();
      const { data: inactivos } = await getProductoresInactivos();
      setItems(activos || []);
      setInactiveItems(inactivos || []);
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

  const viewItems = (viewType === "activos" ? items : inactiveItems).filter(p => {
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

  const onActivar = async (productor) => {
    const nombre = productor?.nombreCompleto || productor?.nombre || productor?.ipt || "este productor";
    const ok = await confirmDialog({
      title: "Activar productor",
      text: `¿Deseas activar nuevamente al productor ${nombre}?`,
      icon: "info",
      confirmButtonText: "Activar",
      cancelButtonText: "Cancelar",
    });
    if (!ok) return;
    try {
      await activateProductor(productor.id);
      await notify({ title: "Productor activado", icon: "success" });
      load();
    } catch {
      await notify({ title: "Error", text: "No se pudo activar el productor", icon: "error" });
    }
  };

  const onVer = (id) => { navigate(`/productores/${id}`); };
  const onEditar = (id) => { navigate(`/productores/${id}/editar`); };

  if (error) return <div style={{ padding: 24, color: "#c0392b" }}>{error}</div>;

  return (
    <div className="users-list page-container" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="users-title" style={{ margin: 0 }}>Gestión de Productores</h2>
          <p className="section-subtitle">Consultá, filtrá y administrá la información de los productores.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btn" style={{ fontFamily: "inherit", fontSize: "inherit" }} onClick={onClickImport} disabled={importing}>
            {importing ? "Importando…" : "Importar Excel"}
          </button>
          <Link to="/productores/nuevo" className="btn" style={{ fontFamily: "inherit", fontSize: "inherit" }}>Nuevo productor</Link>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={(e) => onImportFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {/* Tabs para cambiar entre activos e inactivos */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 20,
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: 0
      }}>
        <button
          onClick={() => { setViewType('activos'); setIptFilter(''); setNameFilter(''); }}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: 16,
            fontWeight: viewType === 'activos' ? 600 : 500,
            color: viewType === 'activos' ? '#166534' : '#64748b',
            borderBottom: viewType === 'activos' ? '3px solid #166534' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          Activos <span style={{
            backgroundColor: '#dbeafe',
            color: '#0c4a6e',
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            minWidth: 24,
            textAlign: 'center'
          }}>{items.length}</span>
        </button>
        <button
          onClick={() => { setViewType('inactivos'); setIptFilter(''); setNameFilter(''); }}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: 16,
            fontWeight: viewType === 'inactivos' ? 600 : 500,
            color: viewType === 'inactivos' ? '#dc2626' : '#64748b',
            borderBottom: viewType === 'inactivos' ? '3px solid #dc2626' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          Inactivos <span style={{
            backgroundColor: '#fee2e2',
            color: '#7f1d1d',
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            minWidth: 24,
            textAlign: 'center'
          }}>{inactiveItems.length}</span>
        </button>
      </div>

      <div className="filters-bar productores-filters-bar" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        backgroundColor: '#f8fafc',
        padding: 16, 
        borderRadius: 12, 
        marginBottom: 20,
        border: '1px solid #e2e8f0',
        alignItems: 'flex-end'
      }}>
        <div className="filter-item" style={{ flex: 1, minWidth: 220 }}>
          <label style={{ display: 'block', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>IPT</label>
          <input
            type="text"
            className="input-inst"
            placeholder="Filtrar por IPT..."
            value={iptFilter}
            onChange={e=>setIptFilter(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 17 }}
          />
        </div>
        <div className="filter-item" style={{ flex: 1, minWidth: 260 }}>
          <label style={{ display: 'block', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Nombre</label>
          <input
            type="text"
            className="input-inst"
            placeholder="Filtrar por nombre..."
            value={nameFilter}
            onChange={e=>setNameFilter(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 17 }}
          />
        </div>
        <button
          className="btn secondary"
          onClick={() => { setIptFilter(''); setNameFilter(''); }}
          style={{ height: 38, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          Limpiar Filtros
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 16, color:'#166534', textAlign: 'center' }}>Cargando…</div>
      ) : (
        <div className="table-wrap admin-data-table-wrap">
          <table className="table-inst admin-data-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>IPT</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Nombre</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Teléfono</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Localidad</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Estado</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Ingresos</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {viewItems.length === 0 ? (
                <tr><td colSpan={7} style={{ border: '1px solid #ddd', padding: '12px', textAlign:'center' }}>Sin resultados</td></tr>
              ) : viewItems.map((p) => (
                <tr key={p.id}>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{p.ipt || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }} title={p.nombreCompleto || ''}>{p.nombreCompleto || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }} title={p.telefono || ''}>{p.telefono || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }} title={p.domicilioCasa || ''}>{p.domicilioCasa || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{p.estado || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{p.historialIngresos ?? 0}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
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
                      <button className="btn btn-compact" onClick={() => onVer(p.id)} style={{ minWidth: 0 }}>Ver</button>
                      {viewType === 'activos' ? (
                        <>
                          <button className="btn btn-compact" onClick={() => onEditar(p.id)} style={{ minWidth: 0 }}>Editar</button>
                          <button className="btn btn-compact" onClick={() => onResetPassword(p.ipt)} style={{ minWidth: 0 }}>Reset contraseña</button>
                          <button className="btn btn-compact" onClick={() => onReempadronado(p.ipt)} style={{ minWidth: 0 }}>Re-empadronar</button>
                          <button
                            className="btn btn-danger btn-compact"
                            onClick={() => onDesactivar(p)}
                            style={{ gridColumn: '1 / -1', minWidth: 0 }}
                          >
                            Desactivar
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-compact"
                          onClick={() => onActivar(p)}
                          style={{ gridColumn: '1 / -1', minWidth: 0, backgroundColor: '#16a34a', color: '#fff' }}
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProductoresList;
