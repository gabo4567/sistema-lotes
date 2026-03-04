import React from "react";

const LoteFilters = ({ filters, onFilterChange, onReset }) => {
  const containerStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    backgroundColor: "#ffffff",
    padding: "20px",
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
    flex: "1 1 200px"
  };

  const labelStyle = {
    fontSize: "14px",
    fontWeight: "600",
    color: "#374151"
  };

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
    width: "100%"
  };

  const resetBtnStyle = {
    padding: "10px 20px",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    transition: "all 0.2s",
    height: "42px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  };

  return (
    <div style={containerStyle} className="lote-filters-bar">
      <div style={fieldStyle}>
        <label style={labelStyle}>Nombre del lote</label>
        <input
          type="text"
          placeholder="Buscar por nombre..."
          style={inputStyle}
          value={filters.nombre}
          onChange={(e) => onFilterChange("nombre", e.target.value)}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Número IPT</label>
        <input
          type="number"
          placeholder="Filtrar por IPT..."
          style={inputStyle}
          value={filters.ipt}
          onChange={(e) => onFilterChange("ipt", e.target.value)}
        />
      </div>

      <div style={fieldStyle}>
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
        style={resetBtnStyle} 
        onClick={onReset}
        onMouseOver={(e) => e.target.style.backgroundColor = "#e5e7eb"}
        onMouseOut={(e) => e.target.style.backgroundColor = "#f3f4f6"}
      >
        Limpiar filtros
      </button>
    </div>
  );
};

export default LoteFilters;
