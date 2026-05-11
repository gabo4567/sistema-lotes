import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import HomeButton from "../components/HomeButton";
import { lotesService } from "../services/lotes.service";
import { getProductores } from "../services/productores.service";
import { loadGoogleMaps } from "../utils/loadGoogleMaps";
import { attachGoogleMapVisualControls } from "../utils/googleMapVisualControls";

const computeCentroid = (pts) => {
  const arr = Array.isArray(pts) ? pts : [];
  if (!arr.length) return null;
  const sum = arr.reduce(
    (acc, p) => {
      acc.lat += Number(p?.lat) || 0;
      acc.lng += Number(p?.lng) || 0;
      return acc;
    },
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / arr.length, lng: sum.lng / arr.length };
};

const LotesMapaGeneral = () => {
  const navigate = useNavigate();
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const visualControlsCleanupRef = useRef(null);
  const infoWindowRef = useRef(null);
  const polygonsRef = useRef([]);
  const selectedPolygonRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState("");
  const [mapInitError, setMapInitError] = useState("");
  const [lotes, setLotes] = useState([]);
  const [productoresByIpt, setProductoresByIpt] = useState({});
  const [filters, setFilters] = useState({ ipt: "", productor: "" });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [lotesData, productoresResp] = await Promise.all([
          lotesService.getLotes({ activo: "todos" }),
          getProductores(),
        ]);

        const prods = Array.isArray(productoresResp?.data) ? productoresResp.data : [];
        const byIpt = {};
        for (const p of prods) {
          const ipt = p?.ipt != null ? String(p.ipt) : "";
          if (!ipt) continue;
          byIpt[ipt] = p;
        }

        if (cancelled) return;
        setLotes(Array.isArray(lotesData) ? lotesData : []);
        setProductoresByIpt(byIpt);
      } catch (e) {
        if (cancelled) return;
        setError(e?.response?.data?.error || e?.message || "No se pudo cargar lotes/productores");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!key) {
      setMapsReady(false);
      setMapsError("");
      return;
    }

    loadGoogleMaps(key)
      .then(() => {
        if (cancelled) return;
        setMapsReady(true);
        setMapsError("");
      })
      .catch((e) => {
        if (cancelled) return;
        setMapsReady(false);
        setMapsError(e?.message || "No se pudo cargar Google Maps");
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (loading) return;
    if (!mapsReady || !mapElRef.current || !window.google?.maps) return;
    if (mapRef.current) return;

    try {
      setMapInitError("");
      const mapsApi = window.google.maps;
      const fallbackCenter = { lat: -29.13333, lng: -59.26667 };
      const map = new mapsApi.Map(mapElRef.current, {
        center: fallbackCenter,
        zoom: 12,
        mapTypeId: "roadmap",
        fullscreenControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      });

      mapRef.current = map;
      visualControlsCleanupRef.current = attachGoogleMapVisualControls(map, mapsApi);
      infoWindowRef.current = new mapsApi.InfoWindow();

      window.setTimeout(() => {
        mapsApi.event.trigger(map, "resize");
      }, 0);
    } catch (e) {
      setMapInitError(e?.message || "No se pudo inicializar el mapa");
    }
  }, [loading, mapsReady]);

  useEffect(() => {
    return () => {
      if (visualControlsCleanupRef.current) {
        visualControlsCleanupRef.current();
        visualControlsCleanupRef.current = null;
      }
    };
  }, []);

  const filteredLotes = useMemo(() => {
    const iptSearch = String(filters.ipt || "").trim();
    const prodSearch = String(filters.productor || "").trim().toLowerCase();

    return (Array.isArray(lotes) ? lotes : []).filter((l) => {
      const ipt = l?.ipt != null ? String(l.ipt) : "";
      if (iptSearch && !ipt.includes(iptSearch)) return false;

      if (prodSearch) {
        const prod = productoresByIpt?.[ipt];
        const name = String(prod?.nombreCompleto || prod?.nombre || "").toLowerCase();
        if (!name.includes(prodSearch)) return false;
      }

      return Array.isArray(l?.poligono) && l.poligono.length >= 3;
    });
  }, [filters.ipt, filters.productor, lotes, productoresByIpt]);

  const fitToLotes = useCallback((arr) => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    let added = false;
    for (const l of arr) {
      for (const p of l.poligono) {
        if (typeof p?.lat !== "number" || typeof p?.lng !== "number") continue;
        bounds.extend(new window.google.maps.LatLng(p.lat, p.lng));
        added = true;
      }
    }
    if (added) map.fitBounds(bounds);
  }, []);

  const closeInfo = useCallback(() => {
    if (infoWindowRef.current) infoWindowRef.current.close();
    if (selectedPolygonRef.current) {
      selectedPolygonRef.current.setOptions({ strokeWeight: 2, fillOpacity: 0.22 });
      selectedPolygonRef.current = null;
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const mapsApi = window.google?.maps;
    if (!map || !mapsApi) return;

    closeInfo();

    for (const poly of polygonsRef.current) {
      poly.setMap(null);
    }
    polygonsRef.current = [];

    const colors = [
      { stroke: "#1e8449", fill: "rgba(46, 204, 113, 0.22)" },
      { stroke: "#2563eb", fill: "rgba(59, 130, 246, 0.18)" },
      { stroke: "#7c3aed", fill: "rgba(124, 58, 237, 0.16)" },
      { stroke: "#b45309", fill: "rgba(245, 158, 11, 0.16)" },
    ];

    filteredLotes.forEach((lote, idx) => {
      const palette = colors[idx % colors.length];
      const poly = new mapsApi.Polygon({
        paths: lote.poligono,
        strokeColor: palette.stroke,
        strokeOpacity: 1,
        strokeWeight: 2,
        fillColor: palette.fill,
        fillOpacity: 0.22,
        clickable: true,
      });
      poly.setMap(map);
      polygonsRef.current.push(poly);

      poly.addListener("click", (ev) => {
        if (selectedPolygonRef.current && selectedPolygonRef.current !== poly) {
          selectedPolygonRef.current.setOptions({ strokeWeight: 2, fillOpacity: 0.22 });
        }
        selectedPolygonRef.current = poly;
        poly.setOptions({ strokeWeight: 4, fillOpacity: 0.3 });

        const ipt = lote?.ipt != null ? String(lote.ipt) : "";
        const prod = productoresByIpt?.[ipt];
        const prodNombre = prod?.nombreCompleto || prod?.nombre || "-";

        const content = document.createElement("div");
        content.style.maxWidth = "260px";

        const title = document.createElement("div");
        title.style.fontWeight = "800";
        title.style.marginBottom = "6px";
        title.textContent = lote?.nombre || "Lote";
        content.appendChild(title);

        const iptRow = document.createElement("div");
        iptRow.style.fontSize = "13px";
        iptRow.textContent = `IPT: ${ipt || "-"}`;
        content.appendChild(iptRow);

        const prodRow = document.createElement("div");
        prodRow.style.fontSize = "13px";
        prodRow.textContent = `Productor: ${prodNombre}`;
        content.appendChild(prodRow);

        const actions = document.createElement("div");
        actions.style.marginTop = "10px";
        actions.style.display = "flex";
        actions.style.gap = "8px";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn";
        btn.textContent = "Ir al detalle";
        btn.addEventListener("click", () => navigate(`/lotes/${lote.id}`));
        actions.appendChild(btn);

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "btn";
        closeBtn.textContent = "Cerrar";
        closeBtn.addEventListener("click", () => closeInfo());
        actions.appendChild(closeBtn);

        content.appendChild(actions);

        const centroid = computeCentroid(lote.poligono);
        const pos = ev?.latLng || (centroid ? new mapsApi.LatLng(centroid.lat, centroid.lng) : null);
        if (!pos) return;
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.setPosition(pos);
        infoWindowRef.current.open({ map });
      });
    });

    if (filteredLotes.length > 0) {
      fitToLotes(filteredLotes);
    }
  }, [closeInfo, filteredLotes, fitToLotes, navigate, productoresByIpt]);

  return (
    <div className="page-container">
      <div style={{ marginBottom: 8 }}><HomeButton /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Mapa general de lotes</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/lotes" className="btn">Volver</Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(180px, 0.8fr) minmax(260px, 1.2fr) auto auto",
          gap: 12,
          alignItems: "end",
          marginBottom: 16,
          padding: 16,
          background: "#f8fafc",
          border: "1px solid #d9eadc",
          borderRadius: 12,
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
        }}
      >
        <label className="producer-field" style={{ minWidth: 0 }}>
          <span className="producer-field__label">IPT</span>
          <input
            className="input-inst"
            style={{ width: "100%", minHeight: 44, borderRadius: 10, boxSizing: "border-box" }}
            placeholder="Buscar por IPT"
            value={filters.ipt}
            onChange={(e) => setFilters((prev) => ({ ...prev, ipt: e.target.value }))}
          />
        </label>
        <label className="producer-field" style={{ minWidth: 0 }}>
          <span className="producer-field__label">Productor</span>
          <input
            className="input-inst"
            style={{ width: "100%", minHeight: 44, borderRadius: 10, boxSizing: "border-box" }}
            placeholder="Buscar por nombre"
            value={filters.productor}
            onChange={(e) => setFilters((prev) => ({ ...prev, productor: e.target.value }))}
          />
        </label>
        <button
          type="button"
          className="btn"
          style={{ minHeight: 44, whiteSpace: "nowrap" }}
          onClick={() => setFilters({ ipt: "", productor: "" })}
        >
          Limpiar filtros
        </button>
        <div
          style={{
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 14px",
            borderRadius: 10,
            background: "#ffffff",
            border: "1px solid #d9eadc",
            color: "#166534",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {filteredLotes.length} {filteredLotes.length === 1 ? "lote visible" : "lotes visibles"}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 16 }}>Cargando…</div>
      ) : error ? (
        <div style={{ padding: 16, color: "#c0392b" }}>{error}</div>
      ) : !key ? (
        <div style={{ padding: 16, color: "#6b7280" }}>Configurar VITE_GOOGLE_MAPS_API_KEY para ver el mapa general.</div>
      ) : mapsError ? (
        <div style={{ padding: 16, color: "#c0392b" }}>{mapsError}</div>
      ) : !mapsReady ? (
        <div style={{ padding: 16, color: "#6b7280" }}>Cargando mapa…</div>
      ) : mapInitError ? (
        <div style={{ padding: 16, color: "#c0392b" }}>{mapInitError}</div>
      ) : (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "72vh",
            minHeight: 520,
            background: "#eef2ff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}
        >
          <div ref={mapElRef} style={{ width: "100%", height: "100%" }} />
        </div>
      )}
    </div>
  );
};

export default LotesMapaGeneral;
