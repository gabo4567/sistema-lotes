import React, { useCallback, useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../utils/loadGoogleMaps";

const DEFAULT_GOYA_CENTER = { lat: -29.13333, lng: -59.26667 };

const isValidLatLng = (value) => (
  value &&
  Number.isFinite(Number(value.lat)) &&
  Number.isFinite(Number(value.lng)) &&
  Number(value.lat) >= -90 &&
  Number(value.lat) <= 90 &&
  Number(value.lng) >= -180 &&
  Number(value.lng) <= 180
);

const normalizePoint = (point) => ({ lat: Number(point.lat), lng: Number(point.lng) });

const areSamePoints = (a = [], b = []) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((point, index) => (
    Math.abs(Number(point.lat) - Number(b[index]?.lat)) < 0.0000001 &&
    Math.abs(Number(point.lng) - Number(b[index]?.lng)) < 0.0000001
  ));
};

const clonePoints = (nextPoints = []) => nextPoints.map(normalizePoint);

const MapPolygonEditor = ({ points = [], onChange, center }) => {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const mapToolsControlRef = useRef(null);
  const polygonRef = useRef(null);
  const polygonListenersRef = useRef([]);
  const onChangeRef = useRef(onChange);
  const lastAppliedPointsRef = useRef([]);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const didFitBoundsRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false, canClear: false });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const refreshHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
      canClear: lastAppliedPointsRef.current.length > 0,
    });
  }, []);

  const emitChange = useCallback((nextPoints) => {
    const cleanPoints = clonePoints(nextPoints);
    lastAppliedPointsRef.current = cleanPoints;
    refreshHistoryState();
    onChangeRef.current && onChangeRef.current(cleanPoints);
  }, [refreshHistoryState]);

  const pushUndoSnapshot = useCallback((snapshot) => {
    const cleanSnapshot = clonePoints(snapshot);
    const lastUndo = undoStackRef.current[undoStackRef.current.length - 1];
    if (lastUndo && areSamePoints(cleanSnapshot, lastUndo)) return;
    undoStackRef.current.push(cleanSnapshot);
    redoStackRef.current = [];
    refreshHistoryState();
  }, [refreshHistoryState]);

  const clearPolygonListeners = useCallback(() => {
    polygonListenersRef.current.forEach((listener) => listener.remove());
    polygonListenersRef.current = [];
  }, []);

  const getPathPoints = useCallback((path) => {
    const nextPoints = [];
    for (let index = 0; index < path.getLength(); index += 1) {
      const latLng = path.getAt(index);
      nextPoints.push({ lat: latLng.lat(), lng: latLng.lng() });
    }
    return nextPoints;
  }, []);

  const bindPolygonEdition = useCallback((nextPolygon) => {
    clearPolygonListeners();
    const path = nextPolygon.getPath();
    let beforeEdit = null;
    const captureBeforeEdit = () => {
      beforeEdit = clonePoints(lastAppliedPointsRef.current);
    };
    const emitAfterEdit = () => {
      if (beforeEdit) pushUndoSnapshot(beforeEdit);
      beforeEdit = null;
      emitChange(getPathPoints(path));
    };

    polygonListenersRef.current = [
      window.google.maps.event.addListener(path, "dragstart", captureBeforeEdit),
      window.google.maps.event.addListener(path, "dragend", emitAfterEdit),
      window.google.maps.event.addListener(path, "set_at", () => {
        if (!beforeEdit) pushUndoSnapshot(lastAppliedPointsRef.current);
        beforeEdit = null;
        emitChange(getPathPoints(path));
      }),
      window.google.maps.event.addListener(path, "insert_at", () => {
        pushUndoSnapshot(lastAppliedPointsRef.current);
        emitChange(getPathPoints(path));
      }),
      window.google.maps.event.addListener(path, "remove_at", () => {
        pushUndoSnapshot(lastAppliedPointsRef.current);
        emitChange(getPathPoints(path));
      }),
    ];
  }, [clearPolygonListeners, emitChange, getPathPoints, pushUndoSnapshot]);

  const applyPolygonPoints = useCallback((nextPoints, { fitBounds = false, emit = false } = {}) => {
    if (!mapRef.current || !window.google || !window.google.maps) return;

    const cleanPoints = clonePoints(nextPoints);
    clearPolygonListeners();

    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }

    if (cleanPoints.length >= 3) {
      const polygon = new window.google.maps.Polygon({
        paths: cleanPoints,
        strokeColor: "#1d4ed8",
        strokeWeight: 2,
        fillColor: "#93c5fd",
        fillOpacity: 0.4,
        editable: true,
      });

      polygonRef.current = polygon;
      polygon.setMap(mapRef.current);
      bindPolygonEdition(polygon);

      if (fitBounds) {
        const bounds = new window.google.maps.LatLngBounds();
        cleanPoints.forEach(p => bounds.extend(new window.google.maps.LatLng(p.lat, p.lng)));
        mapRef.current.fitBounds(bounds);
        didFitBoundsRef.current = true;
      }
    }

    lastAppliedPointsRef.current = cleanPoints;
    refreshHistoryState();
    if (emit) onChangeRef.current && onChangeRef.current(cleanPoints);
  }, [bindPolygonEdition, clearPolygonListeners, refreshHistoryState]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const current = clonePoints(lastAppliedPointsRef.current);
    const previous = undoStackRef.current.pop();
    redoStackRef.current.push(current);
    applyPolygonPoints(previous, { emit: true });
  }, [applyPolygonPoints]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const current = clonePoints(lastAppliedPointsRef.current);
    const next = redoStackRef.current.pop();
    undoStackRef.current.push(current);
    applyPolygonPoints(next, { emit: true });
  }, [applyPolygonPoints]);

  const handleClear = useCallback(() => {
    if (lastAppliedPointsRef.current.length === 0) return;
    pushUndoSnapshot(lastAppliedPointsRef.current);
    applyPolygonPoints([], { emit: true });
  }, [applyPolygonPoints, pushUndoSnapshot]);

  useEffect(() => {
    if (!mapToolsControlRef.current) return;
    const { undoButton, redoButton, clearButton } = mapToolsControlRef.current;
    undoButton.disabled = !historyState.canUndo;
    redoButton.disabled = !historyState.canRedo;
    clearButton.disabled = !historyState.canClear;
  }, [historyState]);

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
    if (mapRef.current) return;

    const initial = Array.isArray(points) && points.length ? points.map(normalizePoint) : null;
    const c = isValidLatLng(center)
      ? normalizePoint(center)
      : initial
        ? normalizePoint(initial[0])
        : DEFAULT_GOYA_CENTER;

    const map = new window.google.maps.Map(containerRef.current, {
      center: c,
      zoom: initial ? 15 : 13,
      mapTypeId: "roadmap",
      fullscreenControl: true,
      mapTypeControl: true,
      mapTypeControlOptions: {
        position: window.google.maps.ControlPosition.TOP_LEFT,
        style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        mapTypeIds: ["roadmap", "terrain", "satellite", "hybrid"],
      },
      streetViewControl: false,
    });
    mapRef.current = map;

    const toolsControl = document.createElement("div");
    toolsControl.setAttribute("role", "toolbar");
    toolsControl.setAttribute("aria-label", "Herramientas del poligono");
    Object.assign(toolsControl.style, toolsControlStyle);

    const createToolButton = ({ label, icon, onClick }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.title = label;
      button.setAttribute("aria-label", label);
      Object.assign(button.style, toolButtonStyle);
      button.textContent = icon;
      button.addEventListener("click", onClick);
      return button;
    };

    const undoButton = createToolButton({ label: "Deshacer", icon: "\u21B6", onClick: handleUndo });
    const redoButton = createToolButton({ label: "Rehacer", icon: "\u21B7", onClick: handleRedo });
    const clearButton = createToolButton({ label: "Limpiar", icon: "\u232B", onClick: handleClear });
    toolsControl.append(undoButton, redoButton, clearButton);
    mapToolsControlRef.current = { container: toolsControl, undoButton, redoButton, clearButton };
    refreshHistoryState();
    map.controls[window.google.maps.ControlPosition.BOTTOM_CENTER].push(toolsControl);

    if (initial && initial.length >= 3) {
      applyPolygonPoints(initial, { fitBounds: true });
    }
    const dm = new window.google.maps.drawing.DrawingManager({ drawingMode: null, drawingControl: true, drawingControlOptions: { position: window.google.maps.ControlPosition.TOP_CENTER, drawingModes: [window.google.maps.drawing.OverlayType.POLYGON] }, polygonOptions: { strokeColor: "#1d4ed8", strokeWeight: 2, fillColor: "#93c5fd", fillOpacity: 0.4, editable: true } });
    drawingManagerRef.current = dm;
    dm.setMap(map);
    const overlayListener = window.google.maps.event.addListener(dm, "overlaycomplete", (e) => {
      if (e.type === window.google.maps.drawing.OverlayType.POLYGON) {
        pushUndoSnapshot(lastAppliedPointsRef.current);
        clearPolygonListeners();
        if (polygonRef.current) polygonRef.current.setMap(null);
        polygonRef.current = e.overlay;
        didFitBoundsRef.current = true;
        bindPolygonEdition(polygonRef.current);
        emitChange(getPathPoints(polygonRef.current.getPath()));
        dm.setDrawingMode(null);
      }
    });

    return () => {
      clearPolygonListeners();
      overlayListener.remove();
      dm.setMap(null);
      drawingManagerRef.current = null;
      if (mapToolsControlRef.current) {
        mapToolsControlRef.current.undoButton.removeEventListener("click", handleUndo);
        mapToolsControlRef.current.redoButton.removeEventListener("click", handleRedo);
        mapToolsControlRef.current.clearButton.removeEventListener("click", handleClear);
        mapToolsControlRef.current.container.remove();
        mapToolsControlRef.current = null;
      }
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
      mapRef.current = null;
    };
  }, [applyPolygonPoints, bindPolygonEdition, clearPolygonListeners, emitChange, getPathPoints, handleClear, handleRedo, handleUndo, pushUndoSnapshot, ready, refreshHistoryState]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google || !window.google.maps) return;

    const nextPoints = Array.isArray(points) ? points.map(normalizePoint) : [];
    if (areSamePoints(nextPoints, lastAppliedPointsRef.current)) return;

    applyPolygonPoints(nextPoints, { fitBounds: !didFitBoundsRef.current });
  }, [applyPolygonPoints, ready, points]);

  if (!key) return null;
  if (loadError) {
    return <div style={{ color: "#b91c1c" }}>{loadError}</div>;
  }
  return <div ref={containerRef} style={{ width: "100%", height: 420, minHeight: 420, background: "#eef2ff", borderRadius: 12 }} />;
};

const toolsControlStyle = {
  display: "flex",
  gap: "4px",
  margin: "0 0 24px 0",
  background: "#ffffff",
  border: "1px solid #dadce0",
  borderRadius: "2px",
  boxShadow: "0 1px 4px rgba(60, 64, 67, 0.3)",
  padding: "2px",
};

const toolButtonStyle = {
  width: "32px",
  height: "32px",
  border: "0",
  borderRadius: "2px",
  background: "#ffffff",
  color: "#3c4043",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontFamily: "Arial, sans-serif",
  fontSize: "21px",
  lineHeight: "1",
};

export default MapPolygonEditor;
