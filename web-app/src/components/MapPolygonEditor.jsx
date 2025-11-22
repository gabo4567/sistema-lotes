import React, { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../utils/loadGoogleMaps";

const MapPolygonEditor = ({ points = [], onChange, center }) => {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

useEffect(() => {
  if (!key) return;
  loadGoogleMaps(key).then(() => setReady(true));
}, [key]);

  useEffect(() => {
    if (!ready || !containerRef.current || !window.google || !window.google.maps || !window.google.maps.drawing) return;
    const initial = Array.isArray(points) && points.length ? points : null;
    const c = center || (initial ? { lat: initial[0].lat, lng: initial[0].lng } : { lat: -29.18, lng: -59.26 });
    const map = new window.google.maps.Map(containerRef.current, { center: c, zoom: 15, mapTypeId: "terrain" });
    let polygon = null;
    if (initial && initial.length >= 3) {
      polygon = new window.google.maps.Polygon({ paths: initial, strokeColor: "#1d4ed8", strokeWeight: 2, fillColor: "#93c5fd", fillOpacity: 0.4, editable: true });
      polygon.setMap(map);
      const bounds = new window.google.maps.LatLngBounds();
      initial.forEach(p => bounds.extend(new window.google.maps.LatLng(p.lat, p.lng)));
      map.fitBounds(bounds);
    }
    const dm = new window.google.maps.drawing.DrawingManager({ drawingMode: null, drawingControl: true, drawingControlOptions: { position: window.google.maps.ControlPosition.TOP_CENTER, drawingModes: [window.google.maps.drawing.OverlayType.POLYGON] }, polygonOptions: { strokeColor: "#1d4ed8", strokeWeight: 2, fillColor: "#93c5fd", fillOpacity: 0.4, editable: true } });
    dm.setMap(map);
    window.google.maps.event.addListener(dm, "overlaycomplete", (e) => {
      if (e.type === window.google.maps.drawing.OverlayType.POLYGON) {
        if (polygon) polygon.setMap(null);
        polygon = e.overlay;
        const path = polygon.getPath();
        const pts = [];
        for (let i = 0; i < path.getLength(); i++) {
          const ll = path.getAt(i);
          pts.push({ lat: ll.lat(), lng: ll.lng() });
        }
        onChange && onChange(pts);
      }
    });
    if (polygon) {
      const path = polygon.getPath();
      const emit = () => {
        const pts = [];
        for (let i = 0; i < path.getLength(); i++) {
          const ll = path.getAt(i);
          pts.push({ lat: ll.lat(), lng: ll.lng() });
        }
        onChange && onChange(pts);
      };
      window.google.maps.event.addListener(path, "set_at", emit);
      window.google.maps.event.addListener(path, "insert_at", emit);
      window.google.maps.event.addListener(path, "remove_at", emit);
    }
  }, [ready, points, onChange, center]);

  if (!key) return null;
  return <div ref={containerRef} style={{ width: 640, height: 420, background: "#eef2ff" }} />;
};

export default MapPolygonEditor;