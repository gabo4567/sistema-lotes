import React from "react";

const LoteFilters = ({ filters, onFilterChange, onReset }) => {
  return (
    <div className="lotes-filters-card">
      <div className="lote-filter-group">
        <label>Nombre del lote</label>
        <div className="lote-input-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="with-icon"
            placeholder="Buscar por nombre..."
            value={filters.nombre}
            onChange={(e) => onFilterChange("nombre", e.target.value)}
          />
        </div>
      </div>

      <div className="lote-filter-group">
        <label>Número IPT</label>
        <div className="lote-input-wrapper">
          <input
            type="number"
            placeholder="Filtrar por IPT..."
            value={filters.ipt}
            onChange={(e) => onFilterChange("ipt", e.target.value)}
          />
        </div>
      </div>

      <div className="lote-filter-group">
        <label>Estado</label>
        <div className="lote-input-wrapper">
          <select
            value={filters.activo}
            onChange={(e) => onFilterChange("activo", e.target.value)}
          >
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>

      <div className="lote-filter-group">
        <label>Ordenar por</label>
        <div className="lote-input-wrapper">
          <select
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
      </div>

      <button type="button" className="btn-clear-filters" onClick={onReset}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z"></path>
        </svg>
        Limpiar filtros
      </button>
    </div>
  );
};

export default LoteFilters;
