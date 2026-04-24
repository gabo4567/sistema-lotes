import React, { useEffect, useMemo, useRef, useState } from "react";
import { createProductor, getProductores, resetPasswordProductor, marcarReempadronado } from "../services/productores.service";
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
    const digits = String(raw ?? '').replace(/\D/g, '');
    const noLeftZeros = digits.replace(/^0+/, '');
    return noLeftZeros;
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

      const getCol = (row, name) => {
        if (!row || typeof row !== "object") return "";
        const wanted = String(name || "").trim().toLowerCase();
        const key = Object.keys(row).find((k) => String(k).trim().toLowerCase() === wanted);
        return key ? row[key] : "";
      };

      let imported = 0;
      let duplicated = 0;
      const seen = new Set(existingIptSet);
      const rowsWithData = rows.filter((r) => {
        const ipt = normalizeIpt(getCol(r, "ipt"));
        const nombre = String(getCol(r, "nombre")).trim();
        return Boolean(ipt) || Boolean(nombre);
      });

      if (rowsWithData.length === 0) {
        await notify({ title: "Archivo inválido", text: "No se encontraron columnas/filas válidas", icon: "error" });
        return;
      }

      for (const row of rowsWithData) {
        const ipt = normalizeIpt(getCol(row, "ipt"));
        const nombre = String(getCol(row, "nombre")).trim();
        const cuil = String(getCol(row, "cuil")).trim();
        if (!ipt || !nombre || !cuil) continue;
        if (seen.has(ipt)) {
          duplicated += 1;
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
          seen.add(ipt);
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

  const onVer = (id) => { navigate(`/productores/${id}`); };
  const onEditar = (id) => { navigate(`/productores/${id}/editar`); };

  if (error) return <div style={{ padding: 24, color: "#c0392b" }}>{error}</div>;

  return (
    <div className="users-list page-container" style={{ width: '100%' }}>
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      {loading ? (
        <div style={{ padding: 24 }}>Cargando…</div>
      ) : (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: 12, flexWrap: 'wrap' }}>
          <h2 className="users-title" style={{ margin: 0 }}>Gestión de Productores</h2>
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
        <div className="filters-bar" style={{ 
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
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>IPT</label>
            <input
              type="text"
              className="input-inst"
              placeholder="Filtrar por IPT..."
              value={iptFilter}
              onChange={e=>setIptFilter(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 16 }}
            />
          </div>
          <div className="filter-item" style={{ flex: 1, minWidth: 260 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Nombre</label>
            <input
              type="text"
              className="input-inst"
              placeholder="Filtrar por nombre..."
              value={nameFilter}
              onChange={e=>setNameFilter(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 16 }}
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
      <div className="table-wrap">
        <table className="table-inst" style={{ borderCollapse: 'collapse', width: '100%' }}>
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
                  <div className="actions-col" style={{ display:'grid', gridTemplateColumns:'auto auto', gap:8, justifyItems:'center', alignItems:'center' }}>
                    <button className="btn btn-compact" onClick={() => onVer(p.id)}>Ver</button>
                    <button className="btn btn-compact" onClick={() => onEditar(p.id)}>Editar</button>
                    <button className="btn btn-compact" onClick={() => onResetPassword(p.ipt)}>Reset contraseña</button>
                    <button className="btn btn-compact" onClick={() => onReempadronado(p.ipt)}>Re-empadronado</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
};

export default ProductoresList;
