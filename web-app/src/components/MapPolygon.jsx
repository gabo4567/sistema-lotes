import React, { useEffect, useRef, useState } from "react";

const MapPolygon = ({ points = [] }) => {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!key) return;
    if (window.google && window.google.maps) { setReady(true); return; }
    const id = "gmaps-js";
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=drawing`;
    s.async = true;
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, [key]);

  useEffect(() => {
    if (!ready || !containerRef.current || !window.google || !window.google.maps) return;
    const valid = Array.isArray(points) && points.length >= 1;
    const center = valid ? { lat: points[0].lat, lng: points[0].lng } : { lat: -29.18, lng: -59.26 };
    const map = new window.google.maps.Map(containerRef.current, { center, zoom: 15, mapTypeId: "terrain" });
    if (Array.isArray(points) && points.length >= 3) {
      const poly = new window.google.maps.Polygon({ paths: points, strokeColor: "#1d4ed8", strokeWeight: 2, fillColor: "#93c5fd", fillOpacity: 0.6 });
      poly.setMap(map);
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach(p => bounds.extend(new window.google.maps.LatLng(p.lat, p.lng)));
      map.fitBounds(bounds);
    }
  }, [ready, points]);

  if (!key) {
    const w = 340, h = 340;
    const pts = Array.isArray(points) ? points : [];
    const lats = pts.map(p=>p.lat), lngs = pts.map(p=>p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const toX = (lng) => ((lng - minLng) / (maxLng - minLng || 1)) * (w-20) + 10;
    const toY = (lat) => ((maxLat - lat) / (maxLat - minLat || 1)) * (h-20) + 10;
    const svgPts = pts.map(p=>`${toX(p.lng)},${toY(p.lat)}`).join(" ");
    return (
      <div>
        <div style={{ marginBottom: 8 }}>Configurar VITE_GOOGLE_MAPS_API_KEY para mapa interactivo</div>
        <svg width={w} height={h} style={{ background:'#f8fafc', border:'1px solid #e5e7eb' }}>
          {pts.length >= 3 && <polygon points={svgPts} fill="#93c5fd" stroke="#1d4ed8" strokeWidth={2} />}
        </svg>
      </div>
    );
  }
  return <div ref={containerRef} style={{ width: 360, height: 360, background: "#eef2ff" }} />;
};

export default MapPolygon;