import React, { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../utils/loadGoogleMaps";

const MapPolygonEditor = ({ points = [], onChange, center }) => {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!key) {
      setReady(false);
      setLoadError("");
      return;
    }

    loadGoogleMaps(key)
      .then(() => {
        if (cancelled) return;
        setReady(true);
        setLoadError("");
      })
      .catch((error) => {
        if (cancelled) return;
        setReady(false);
        setLoadError(error.message || "No se pudo cargar el mapa");
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!ready || !containerRef.current || !window.google || !window.google.maps || !window.google.maps.drawing) return;

    const initial = Array.isArray(points) && points.length ? points : null;
    const c = center || (initial ? { lat: initial[0].lat, lng: initial[0].lng } : { lat: -29.18, lng: -59.26 });
    const map = new window.google.maps.Map(containerRef.current, { center: c, zoom: 15, mapTypeId: "terrain" });
    let polygon = null;
    let polygonListeners = [];

    const clearPolygonListeners = () => {
      polygonListeners.forEach((listener) => listener.remove());
      polygonListeners = [];
    };

    const emitPoints = (path) => {
      const nextPoints = [];
      for (let index = 0; index < path.getLength(); index += 1) {
        const latLng = path.getAt(index);
        nextPoints.push({ lat: latLng.lat(), lng: latLng.lng() });
      }
      onChange && onChange(nextPoints);
    };

    const bindPolygonEdition = (nextPolygon) => {
      clearPolygonListeners();
      const path = nextPolygon.getPath();
      const emit = () => emitPoints(path);

      polygonListeners = [
        window.google.maps.event.addListener(path, "set_at", emit),
        window.google.maps.event.addListener(path, "insert_at", emit),
        window.google.maps.event.addListener(path, "remove_at", emit),
      ];
    };

    if (initial && initial.length >= 3) {
      polygon = new window.google.maps.Polygon({ paths: initial, strokeColor: "#1d4ed8", strokeWeight: 2, fillColor: "#93c5fd", fillOpacity: 0.4, editable: true });
      polygon.setMap(map);
      const bounds = new window.google.maps.LatLngBounds();
      initial.forEach(p => bounds.extend(new window.google.maps.LatLng(p.lat, p.lng)));
      map.fitBounds(bounds);
      bindPolygonEdition(polygon);
    }
    const dm = new window.google.maps.drawing.DrawingManager({ drawingMode: null, drawingControl: true, drawingControlOptions: { position: window.google.maps.ControlPosition.TOP_CENTER, drawingModes: [window.google.maps.drawing.OverlayType.POLYGON] }, polygonOptions: { strokeColor: "#1d4ed8", strokeWeight: 2, fillColor: "#93c5fd", fillOpacity: 0.4, editable: true } });
    dm.setMap(map);
    const overlayListener = window.google.maps.event.addListener(dm, "overlaycomplete", (e) => {
      if (e.type === window.google.maps.drawing.OverlayType.POLYGON) {
        if (polygon) polygon.setMap(null);
        polygon = e.overlay;
        bindPolygonEdition(polygon);
        emitPoints(polygon.getPath());
        dm.setDrawingMode(null);
      }
    });

    return () => {
      clearPolygonListeners();
      overlayListener.remove();
      dm.setMap(null);
      if (polygon) {
        polygon.setMap(null);
      }
    };
  }, [ready, points, onChange, center]);

  if (!key) return null;
  if (loadError) {
    return <div style={{ color: "#b91c1c" }}>{loadError}</div>;
  }
  return <div ref={containerRef} style={{ width: "100%", height: 420, minHeight: 420, background: "#eef2ff", borderRadius: 12 }} />;
};

export default MapPolygonEditor;
