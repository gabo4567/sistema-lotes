import React from "react";

const LoteFilters = ({ filters, onFilterChange, onReset, onExport }) => {
  const containerStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    backgroundColor: "#ffffff",
    padding: "18px",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    marginBottom: "24px",
    alignItems: "flex-end",
    border: "1px solid #e5e7eb"
  };

  const fieldStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flex: "1 1 155px",
    minWidth: "140px"
  };

  const labelStyle = {
    fontSize: "15px",
    fontWeight: "600",
    color: "#374151"
  };

  const inputStyle = {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "16px",
    minHeight: "46px",
    outline: "none",
    transition: "border-color 0.2s",
    width: "100%",
    boxSizing: "border-box"
  };

  const resetBtnStyle = {
    padding: "8px 14px",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    transition: "all 0.2s",
    height: "42px",
    minWidth: "132px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  };

  return (
    <div style={containerStyle} className="lote-filters-bar">
      <div style={{ ...fieldStyle, flex: "1.05 1 170px", minWidth: "155px" }}>
        <label style={labelStyle}>Nombre del lote</label>
        <input
          type="text"
          placeholder="Buscar por nombre..."
          style={inputStyle}
          value={filters.nombre}
          onChange={(e) => onFilterChange("nombre", e.target.value)}
        />
      </div>

      <div style={{ ...fieldStyle, flex: "0.85 1 135px", minWidth: "120px" }}>
        <label style={labelStyle}>Número IPT</label>
        <input
          type="number"
          placeholder="Filtrar por IPT..."
          style={inputStyle}
          value={filters.ipt}
          onChange={(e) => onFilterChange("ipt", e.target.value)}
        />
      </div>

      <div style={{ ...fieldStyle, flex: "0.9 1 140px", minWidth: "125px" }}>
        <label style={labelStyle}>Estado</label>
        <select
          style={inputStyle}
          value={filters.activo}
          onChange={(e) => onFilterChange("activo", e.target.value)}
        >
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      <div style={{ ...fieldStyle, flex: "1 1 165px", minWidth: "150px" }}>
        <label style={labelStyle}>Ordenar por</label>
        <select
          style={inputStyle}
          value={filters.orderBy}
          onChange={(e) => onFilterChange("orderBy", e.target.value)}
        >
          <option value="newest">Más nuevos primero</option>
          <option value="oldest">Más antiguos primero</option>
          <option value="areaDesc">Mayor superficie</option>
          <option value="areaAsc">Menor superficie</option>
          <option value="nameAZ">Nombre A-Z</option>
          <option value="nameZA">Nombre Z-A</option>
        </select>
      </div>

      <button 
        type="button" 
        className="filter-clear-btn"
        style={resetBtnStyle} 
        onClick={onReset}
        onMouseOver={(e) => e.target.style.backgroundColor = "#e5e7eb"}
        onMouseOut={(e) => e.target.style.backgroundColor = "#f3f4f6"}
      >
        Limpiar filtros
      </button>
      <button
        type="button"
        className="btn secondary"
        style={{ padding: "8px 14px", fontSize: 16, height: 42, borderRadius: 8, display: "flex", alignItems: "center", gap: 6, minWidth: 94 }}
        onClick={onExport}
      >
        ↓ Excel
      </button>
    </div>
  );
};

export default LoteFilters;
