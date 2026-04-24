// src/screens/LotesScreen.js

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  BackHandler,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import MapView, { Marker, Polygon, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../utils/constants";
import { useWalkingGPS } from "../hooks/useWalkingGPS";
import { authFetch, getCurrentAuthContext } from "../api/api";
import { offlineLotesOperations } from "../utils/offlineOperations";
import { useOffline } from "../hooks/useOffline";
import { auth } from "../services/firebase";

const DETAIL_MAP_HEIGHT = Math.max(240, Math.min(380, Math.round(Dimensions.get("window").height * 0.42)));

export default function LotesScreen() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [mode, setMode] = useState("aereo");
  const [points, setPoints] = useState([]);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [nombre, setNombre] = useState("");
  const [observacionesProductor, setObservacionesProductor] = useState("");
  const [creating, setCreating] = useState(false);
  const [createStep, setCreateStep] = useState("polygon");
  const [polygonConfirmed, setPolygonConfirmed] = useState(false);
  const [viewingList, setViewingList] = useState(false);
  const [viewMode, setViewMode] = useState("normal");
  const [viewingDetailFromList, setViewingDetailFromList] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editObservaciones, setEditObservaciones] = useState("");
  const [showingOfflineData, setShowingOfflineData] = useState(false);

  const mapRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { isWalking, route, startWalking, stopWalking, resetRoute, addManualPoint, undoLastPoint, currentLocation } = useWalkingGPS();
  const { isOnline, pendingOperations, isProcessing, subscribeOperations } = useOffline();
  const prevPendingOpsRef = useRef(pendingOperations);

  useEffect(() => {
    if (mode === "gps" && route.length > 0) {
      setPoints(route);
    }
  }, [route, mode]);

  useEffect(() => {
    return () => {
      if (isWalking) stopWalking();
    };
  }, [isWalking, stopWalking]);

  useEffect(() => {
    if (createStep === "polygon") {
      setPolygonConfirmed(false);
    }
  }, [points, mode, createStep]);

  // Intercept Android hardware back button to step backward through the creation flow
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (createStep === "form") {
          // form → polygon step
          setCreateStep("polygon");
          return true;
        }
        if (viewingDetailFromList) {
          closeDetailFromList();
          return true;
        }
        if (creating) {
          // polygon step → cancel creation
          cancelCreate();
          return true;
        }
        if (viewMode === "listOnly" || viewMode === "mapOnly") {
          setViewMode("normal");
          setSelected(null);
          setViewingList(false);
          return true;
        }
        if (viewingList) {
          setViewingList(false);
          return true;
        }
        if (selected) {
          setSelected(null);
          setPoints([]);
          setPolygonConfirmed(false);
          return true;
        }
        // nothing active → let react-navigation handle (navigate back to Home)
        return false;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [createStep, creating, viewingList, selected, viewingDetailFromList, viewMode])
  );

  const requestLocationAccess = useCallback(async () => {
    try {
      setRequestingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationPermissionDenied(true);
        setLocation(null);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocationPermissionDenied(false);
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } finally {
      setRequestingLocation(false);
    }
  }, []);

  const loadList = async () => {
    const uid = auth.currentUser?.uid ? String(auth.currentUser.uid) : "unknown";
    const cacheKey = `cache_lotes_${uid}`;

    if (!isOnline) {
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        const parsed = raw ? JSON.parse(raw) : [];
        const cached = Array.isArray(parsed) ? parsed : [];

        let queuedCreates = [];
        try {
          const opsRaw = await AsyncStorage.getItem("offline_operations");
          const ops = opsRaw ? JSON.parse(opsRaw) : [];
          const createOps = Array.isArray(ops) ? ops.filter((op) => op?.type === "CREATE_LOTE") : [];
          queuedCreates = createOps.map((op) => ({
            ...(op?.data || {}),
            id: `temp_${op.id}`,
            estado: "Pendiente",
            observacionesTecnico: "",
            _isOffline: true,
            _operationId: op.id,
            _queuedAt: op.timestamp,
          }));
        } catch {}

        const byId = new Map();
        for (const item of cached) {
          if (!item?.id) continue;
          byId.set(String(item.id), item);
        }
        for (const item of queuedCreates) {
          if (!item?.id) continue;
          const key = String(item.id);
          if (!byId.has(key)) byId.set(key, item);
        }

        setList(Array.from(byId.values()));
        setErrorMsg(null);
      } catch {
        setList([]);
        setErrorMsg("No se pudieron cargar los lotes guardados sin conexión");
      } finally {
        setShowingOfflineData(true);
      }
      return;
    }

    try {
      setShowingOfflineData(false);
      setErrorMsg(null);
      const { ipt } = await getCurrentAuthContext();
      if (!ipt) throw new Error("No se encontró IPT del productor");
      const resp = await authFetch(`${API_URL}/lotes/productor/${ipt}`);
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload?.error || "No se pudieron cargar los lotes");
      }
      const j = await resp.json();
      const next = Array.isArray(j) ? j : [];
      setList(next);
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {}
    } catch (error) {
      setList([]);
      setErrorMsg(error.message || "No se pudieron cargar los lotes");
    }
  };

  useEffect(() => {
    loadList();
    requestLocationAccess();
  }, [requestLocationAccess, isOnline]);

  useEffect(() => {
    const prev = prevPendingOpsRef.current;
    if (isOnline && prev > 0 && pendingOperations === 0 && !isProcessing) {
      loadList();
    }
    prevPendingOpsRef.current = pendingOperations;
  }, [isOnline, isProcessing, pendingOperations]);

  useEffect(() => {
    const uid = auth.currentUser?.uid ? String(auth.currentUser.uid) : "unknown";
    const cacheKey = `cache_lotes_${uid}`;
    const unsubscribe = subscribeOperations(async (event) => {
      if (event?.status !== "success") return;
      if (event?.operation?.type !== "CREATE_LOTE") return;

      const tempId = `temp_${event.operation.id}`;
      const real = event.result && typeof event.result === "object" ? { ...event.result, _isOffline: false } : null;
      if (!real?.id) return;

      setList((prev) => {
        const prevArr = Array.isArray(prev) ? prev : [];
        let foundTemp = false;
        const replaced = prevArr.map((item) => {
          if (String(item?.id) === String(tempId)) {
            foundTemp = true;
            return real;
          }
          return item;
        });
        const merged = foundTemp ? replaced : [real, ...replaced];
        const seen = new Set();
        return merged.filter((item) => {
          const key = String(item?.id);
          if (!key) return false;
          if (key === String(tempId)) return false;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });

      setSelected((prev) => (String(prev?.id) === String(tempId) ? real : prev));

      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        const parsed = raw ? JSON.parse(raw) : [];
        const cached = Array.isArray(parsed) ? parsed : [];
        let foundTemp = false;
        const replaced = cached.map((item) => {
          if (String(item?.id) === String(tempId)) {
            foundTemp = true;
            return real;
          }
          return item;
        });
        const merged = foundTemp ? replaced : [real, ...replaced];
        const seen = new Set();
        const next = merged.filter((item) => {
          const key = String(item?.id);
          if (!key) return false;
          if (key === String(tempId)) return false;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        await AsyncStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {}
    });

    return unsubscribe;
  }, [subscribeOperations]);

  const onMapPress = (e) => {
    if (!creating || createStep !== "polygon" || mode !== "aereo") return;
    const { coordinate } = e.nativeEvent;
    const newPt = { latitude: coordinate.latitude, longitude: coordinate.longitude };

    setPoints((prev) => [...prev, newPt]);
  };

  const clearPolygon = () => {
    setPoints([]);
    setPolygonConfirmed(false);
    if (mode === "gps") resetRoute();
  };

  const undoPoint = () => {
    if (mode === "gps") {
      undoLastPoint();
      return;
    }
    setPoints((prev) => prev.slice(0, -1));
  };

  const clearPolygonAndStop = () => {
    if (isWalking) stopWalking();
    clearPolygon();
  };

  const cancelCreateAndStop = () => {
    if (isWalking) stopWalking();
    if (mode === "gps") resetRoute();
    cancelCreate();
  };

  const goToMapView = () => {
    setViewMode("mapOnly");
    setCreating(false);
    setSelected(null);
    setViewingList(false);
    setViewingDetailFromList(false);
  };

  const goToListView = () => {
    setViewMode("listOnly");
    setCreating(false);
    setSelected(null);
    setViewingList(false);
    setViewingDetailFromList(false);
  };

  const closeDetailFromList = () => {
    setViewingDetailFromList(false);
    setSelected(null);
    setViewMode("listOnly");
  };

  const startCreate = () => {
    if (!location) {
      Alert.alert("Ubicación requerida", "Necesitas habilitar la ubicación para crear o editar polígonos de lotes.");
      return;
    }
    setCreating(true);
    setSelected(null);
    setPoints([]);
    setNombre("");
    setObservacionesProductor("");
    setMode("aereo");
    setCreateStep("polygon");
    setPolygonConfirmed(false);
    setViewingList(false);
    setViewMode("normal");
    setViewingDetailFromList(false);
  };

  const cancelCreate = () => {
    setCreating(false);
    setPoints([]);
    setNombre("");
    setObservacionesProductor("");
    setCreateStep("polygon");
    setPolygonConfirmed(false);
  };

  const toFormStep = () => {
    if (!polygonConfirmed) {
      Alert.alert("Confirmación requerida", "Debes confirmar el polígono antes de continuar.");
      return;
    }
    setCreateStep("form");
  };

  const toPolygonStep = () => {
    setCreateStep("polygon");
  };

  const degreesToRadians = (deg) => (deg * Math.PI) / 180;
  const computeAreaHa = (pts) => {
    if (!Array.isArray(pts) || pts.length < 3) return 0;

    const cleanPts = pts
      .map((p) => ({
        lat: Number(p.latitude || p.lat || 0),
        lng: Number(p.longitude || p.lng || 0),
      }))
      .filter((p, i, arr) => {
        if (i === 0) return true;
        return p.lat !== arr[i - 1].lat || p.lng !== arr[i - 1].lng;
      });

    if (cleanPts.length < 3) return 0;

    const R = 6378137;
    const lat0 = cleanPts[0].lat;
    const lon0 = cleanPts[0].lng;
    const cosLat0 = Math.cos(degreesToRadians(lat0));

    const projected = cleanPts.map((p) => {
      const x = degreesToRadians(p.lng - lon0) * R * cosLat0;
      const y = degreesToRadians(p.lat - lat0) * R;
      return { x, y };
    });

    let area = 0;
    for (let i = 0; i < projected.length; i++) {
      const j = (i + 1) % projected.length;
      area += projected[i].x * projected[j].y;
      area -= projected[j].x * projected[i].y;
    }

    area = Math.abs(area) / 2;
    return area / 10000;
  };

  const currentAreaHa = computeAreaHa(points);

  const savePolygon = async () => {
    if (points.length < 3) {
      Alert.alert("Polígono incompleto", "Necesitas al menos 3 puntos para formar un polígono válido.");
      return;
    }
    if (currentAreaHa <= 0) {
      Alert.alert("Superficie inválida", "La superficie del polígono debe ser mayor a 0 hectáreas. Revisa los puntos e intenta nuevamente.");
      return;
    }

    setSaving(true);
    try {
      const { ipt } = await getCurrentAuthContext();
      const poligono = points.map((p) => ({ lat: p.latitude, lng: p.longitude }));
      const metodoMarcado = mode === "gps" ? "GPS" : "aereo";

      let result;
      let successMessage = "";
      let wasOffline = false;

      if (selected && selected.estado !== "Validado") {
        // Actualizar lote existente
        result = await offlineLotesOperations.updateLote(selected.id, {
          poligono,
          metodoMarcado,
          superficie: Number(currentAreaHa.toFixed(4)),
        });
        successMessage = "Tu lote ha sido actualizado correctamente.";
      } else {
        // Crear nuevo lote
        if (!nombre || nombre.trim().length < 3) {
          throw new Error("Nombre del lote inválido (mínimo 3 caracteres)");
        }
        const body = {
          ipt,
          poligono,
          metodoMarcado,
          nombre: nombre.trim(),
          observacionesProductor: observacionesProductor?.slice(0, 500) || "",
          superficie: Number(currentAreaHa.toFixed(4)),
        };

        result = await offlineLotesOperations.createLote(body);
        successMessage = "Tu lote ha sido guardado correctamente.";
        wasOffline = result._isOffline;
      }

      // Limpiar formulario
      clearPolygon();
      setSelected(null);
      setNombre("");
      setObservacionesProductor("");
      setCreating(false);
      setCreateStep("polygon");

      // Recargar lista si estamos online
      if (isOnline && !wasOffline) {
        loadList();
      }

      // Mostrar mensaje de éxito
      const finalMessage = wasOffline
        ? `${successMessage} Se sincronizará cuando recuperes la conexión a internet.`
        : successMessage;

      Alert.alert(
        wasOffline ? "Guardado offline" : "¡Éxito!",
        finalMessage,
        [{ text: "Aceptar", onPress: () => {} }]
      );

    } catch (e) {
      Alert.alert(
        "Error al guardar",
        e.message || "No se pudo guardar el lote. Por favor, intenta nuevamente.",
        [{ text: "Aceptar", onPress: () => {} }]
      );
    } finally {
      setSaving(false);
    }
  };

  const selectItem = (item, fromList = false) => {
    setSelected(item);
    setCreating(false);
    setCreateStep("polygon");
    setViewingList(false);
    if (fromList) {
      setViewingDetailFromList(true);
    }
    const pts = (item.poligono || []).map((pt) => ({ latitude: pt.lat, longitude: pt.lng }));
    setPoints(pts);
    if (pts.length > 0 && mapRef.current?.fitToCoordinates) {
      mapRef.current.fitToCoordinates(pts, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    if (selected.estado === "Validado") {
      Alert.alert("No permitido", "No se puede eliminar un lote validado");
      return;
    }

    Alert.alert("Eliminar lote", "¿Estás seguro de que deseas eliminar este lote?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            const resp = await authFetch(`${API_URL}/lotes/${selected.id}`, { method: "DELETE" });
            if (!resp.ok) {
              const j = await resp.json().catch(() => ({}));
              throw new Error(j?.error || "No se pudo eliminar el lote");
            }
            if (viewingDetailFromList) {
              closeDetailFromList();
            } else {
              setSelected(null);
            }
            clearPolygon();
            loadList();
            Alert.alert(
              "Lote eliminado",
              "El lote ha sido eliminado correctamente de tu lista.",
              [{ text: "Aceptar", onPress: () => {} }]
            );
          } catch (e) {
            Alert.alert(
              "Error al eliminar",
              e.message || "No se pudo eliminar el lote. Por favor, intenta nuevamente.",
              [{ text: "Aceptar", onPress: () => {} }]
            );
          }
        },
      },
    ]);
  };

  const getPolygonRegion = (pts) => {
    if (!pts || pts.length === 0) return location;
    const lats = pts.map((p) => p.latitude);
    const lngs = pts.map((p) => p.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.003) * 1.8,
      longitudeDelta: Math.max(maxLng - minLng, 0.003) * 1.8,
    };
  };

  const isMapaTabActive = !creating && viewMode !== "listOnly";
  const isLotesTabActive = !creating && viewMode === "listOnly";

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mis Lotes</Text>

      {showingOfflineData && (
        <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#fff7ed", borderColor: "#fed7aa", borderWidth: 1, borderRadius: 10 }}>
          <Text style={{ color: "#9a3412" }}>Mostrando datos sin conexión</Text>
        </View>
      )}

      {errorMsg && <Text>{errorMsg}</Text>}

      <View style={styles.topBar}>
        <View style={styles.cardBar}>
          <TouchableOpacity
            style={[styles.tabBtn, styles.tabBtnNuevo, creating && styles.tabBtnActive]}
            onPress={startCreate}
          >
            <Text style={[styles.tabBtnText, creating && styles.tabBtnTextActive]}>Nuevo Lote</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, styles.tabBtnMapa, isMapaTabActive && styles.tabBtnActive]}
            onPress={goToMapView}
          >
            <Text style={[styles.tabBtnText, isMapaTabActive && styles.tabBtnTextActive]}>Mapa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, styles.tabBtnLotes, isLotesTabActive && styles.tabBtnActive]}
            onPress={goToListView}
          >
            <Text style={[styles.tabBtnText, isLotesTabActive && styles.tabBtnTextActive]}>Lotes</Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode !== "listOnly" && !(creating && createStep === "form") && (location ? (
        <MapView
          ref={mapRef}
          style={[styles.map, viewMode === "mapOnly" ? styles.mapFullscreen : creating ? styles.mapCreating : null, { marginBottom: 4 }]}
          initialRegion={location}
          onPress={onMapPress}
        >
          <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} title="Mi ubicación" />

          {isWalking && currentLocation && (
            <Marker coordinate={{ latitude: currentLocation.latitude, longitude: currentLocation.longitude }}>
              <View style={styles.currentPosMarker}>
                <View style={styles.currentPosDot} />
              </View>
            </Marker>
          )}

          {points.length >= 1 && (
            <>
              {points.map((p, i) => (
                <Marker key={`p-${i}`} coordinate={p} />
              ))}
              {points.length >= 3 && !isWalking && (
                <Polygon coordinates={points} strokeColor="#1e8449" fillColor="rgba(46, 204, 113, 0.2)" strokeWidth={2} />
              )}
              {isWalking && points.length >= 2 && (
                <Polyline coordinates={points} strokeColor="#1e8449" strokeWidth={3} lineDashPattern={[1]} />
              )}
            </>
          )}
        </MapView>
      ) : locationPermissionDenied ? (
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Permiso de ubicación denegado</Text>
          <Text style={styles.permissionText}>
            Para usar el mapa de lotes necesitamos acceso a tu ubicación. Puedes seguir viendo la lista de lotes y volver a habilitar el permiso cuando quieras.
          </Text>
          <View style={styles.permissionActions}>
            <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={requestLocationAccess}>
              <Text style={styles.btnText}>Reintentar permiso</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.primary]}
              onPress={async () => {
                try {
                  await Linking.openSettings();
                } catch {
                  Alert.alert("No disponible", "No se pudo abrir configuración del sistema.");
                }
              }}
            >
              <Text style={styles.btnText}>Abrir configuración</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingLocation}>{requestingLocation ? "Cargando ubicación..." : "Cargando ubicación..."}</Text>
          <ActivityIndicator size="large" color="#1e8449" style={{ marginTop: 8 }} />
        </View>
      ))}

      {creating && createStep === "polygon" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.grid, { marginBottom: 6 }]}>
            {!isWalking ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    mode === "aereo" ? styles.modeBtnActive : styles.modeBtnInactive,
                  ]}
                  onPress={() => setMode("aereo")}
                >
                  <Text style={[styles.modeBtnText, mode === "aereo" ? styles.modeBtnTextActive : styles.modeBtnTextInactive]}>
                    ✈ Dibujo aéreo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    mode === "gps" ? styles.modeBtnActive : styles.modeBtnInactive,
                  ]}
                  onPress={() => setMode("gps")}
                >
                  <Text style={[styles.modeBtnText, mode === "gps" ? styles.modeBtnTextActive : styles.modeBtnTextInactive]}>
                    🛰 GPS caminando
                  </Text>
                </TouchableOpacity>
                <View style={[styles.modeBadge, mode === "gps" ? styles.modeBadgeGps : styles.modeBadgeAereo]}>
                  <View style={[styles.modeDot, mode === "gps" ? styles.modeDotGps : styles.modeDotAereo]} />
                  <Text style={styles.modeBadgeText}>Modo actual: {mode === "gps" ? "GPS caminando" : "Dibujo aéreo"}</Text>
                </View>
                {mode === "gps" && (
                  <TouchableOpacity
                    style={[styles.gridBtn, { backgroundColor: "#2ecc71" }]}
                    onPress={async () => {
                      try {
                        await startWalking();
                      } catch (error) {
                        Alert.alert("Permiso requerido", error?.message || "No se pudo iniciar el modo GPS.");
                      }
                    }}
                  >
                    <Text style={styles.btnText}>▶ Iniciar recorrido</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.gridBtn, { backgroundColor: "#f39c12", opacity: points.length === 0 ? 0.6 : 1 }]}
                  onPress={undoPoint}
                  disabled={points.length === 0}
                >
                  <Text style={styles.btnText}>← Deshacer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gridBtn} onPress={clearPolygon}>
                  <Text style={styles.btnText}>Limpiar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.gridBtn, { backgroundColor: "#c0392b" }]} onPress={cancelCreateAndStop}>
                  <Text style={styles.btnText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.gpsControls}>
                <View style={styles.gpsStatusHeader}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.gpsStatusText}>Grabando recorrido: {points.length} puntos</Text>
                </View>
                <View style={[styles.modeBadge, styles.modeBadgeGps]}>
                  <View style={[styles.modeDot, styles.modeDotGps]} />
                  <Text style={styles.modeBadgeText}>Modo actual: GPS caminando</Text>
                </View>

                <View style={styles.gpsActionRow}>
                  <TouchableOpacity style={[styles.gpsActionBtn, { backgroundColor: "#3498db" }]} onPress={addManualPoint}>
                    <Text style={styles.btnText}>📍 Punto manual</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.gpsActionBtn, { backgroundColor: "#f39c12" }]} onPress={undoLastPoint} disabled={points.length === 0}>
                    <Text style={styles.btnText}>← Deshacer</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.gpsActionRow}>
                  <TouchableOpacity style={[styles.gpsActionBtn, { backgroundColor: "#1e8449" }]} onPress={clearPolygonAndStop}>
                    <Text style={styles.btnText}>Limpiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.gpsActionBtn, { backgroundColor: "#c0392b" }]} onPress={cancelCreateAndStop}>
                    <Text style={styles.btnText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.gpsFinishBtn, { backgroundColor: "#c0392b" }]}
                  onPress={() => {
                    if (points.length < 3) {
                      Alert.alert("Aviso", "Necesitas al menos 3 puntos para finalizar el recorrido.");
                    } else {
                      stopWalking();
                    }
                  }}
                >
                  <Text style={styles.btnText}>Finalizar y cerrar polígono</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={[styles.formInfo, { marginBottom: 4 }]}>
            <Text style={[styles.itemText, { textAlign: "center" }]}>
              {points.length < 3
                ? "Dibujá al menos 3 puntos para formar el polígono"
                : polygonConfirmed
                ? "Polígono confirmado. Ya puedes continuar"
                : "Revisá el polígono y confirma para continuar"}
            </Text>
          </View>

          {points.length >= 3 && (
            <View style={[styles.infoPanel, { marginBottom: 6 }]}>
              <Text style={styles.itemText}>Superficie: {currentAreaHa.toFixed(2)} ha</Text>
              <Text style={styles.itemText}>Método: {mode === "gps" ? "GPS" : "aéreo"}</Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={[styles.btn, polygonConfirmed ? styles.secondary : styles.primary]}
                  onPress={() => setPolygonConfirmed(true)}
                  disabled={currentAreaHa <= 0}
                >
                  <Text style={styles.btnText}>{polygonConfirmed ? "Polígono confirmado" : "Confirmar polígono"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.primary]} onPress={toFormStep} disabled={currentAreaHa <= 0 || !polygonConfirmed}>
                  <Text style={styles.btnText}>Continuar</Text>
                </TouchableOpacity>
              </View>
              {!polygonConfirmed ? (
                <Text style={styles.confirmHint}>Primero confirma el polígono para pasar a la siguiente fase.</Text>
              ) : (
                <Text style={styles.confirmHint}>Si agregas o editas puntos, se pedirá confirmar nuevamente.</Text>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {creating && createStep === "form" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={Math.max(insets.top + 16, 40)}
        >
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
          >
            {/* Non-interactive polygon preview */}
            <View pointerEvents="none">
              <MapView
                style={styles.mapThumbnail}
                region={getPolygonRegion(points)}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                {points.map((p, i) => (
                  <Marker key={`t-${i}`} coordinate={p} />
                ))}
                {points.length >= 3 && (
                  <Polygon
                    coordinates={points}
                    strokeColor="#1e8449"
                    fillColor="rgba(46, 204, 113, 0.2)"
                    strokeWidth={2}
                  />
                )}
              </MapView>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Datos del lote</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre del lote *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Lote Norte"
                  value={nombre}
                  onChangeText={setNombre}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Observaciones del productor (opcional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Notas propias"
                  value={observacionesProductor}
                  onChangeText={setObservacionesProductor}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                />
              </View>

              <View style={[styles.formInfo, { backgroundColor: "#f0faf4", borderRadius: 8, marginBottom: 14 }]}>
                <Text style={styles.itemText}>Superficie: {currentAreaHa.toFixed(2)} ha</Text>
                <Text style={styles.itemText}>Método: {mode === "gps" ? "GPS" : "aéreo"}</Text>
                <Text style={styles.itemText}>Estado: Pendiente</Text>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity style={[styles.btn, styles.primary, { flex: 1 }]} onPress={savePolygon} disabled={saving}>
                  <Text style={[styles.btnText, { textAlign: "center" }]}>{saving ? "Guardando..." : "Guardar lote"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={toPolygonStep}>
                  <Text style={styles.btnText}>Volver</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {!creating && selected && !viewingDetailFromList && viewMode !== "listOnly" && (
        <View style={[styles.details, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Text style={styles.formTitle}>Detalle del lote</Text>
          <Text style={styles.itemText}>Nombre: {selected.nombre || "-"}</Text>
          <Text style={styles.itemText}>Estado: {selected.estado}</Text>
          <Text style={styles.itemText}>
            Superficie: {typeof selected.superficie === "number" ? selected.superficie : computeAreaHa((selected.poligono || []).map((pt) => ({ latitude: pt.lat, longitude: pt.lng }))).toFixed(2)} ha
          </Text>
          <Text style={styles.itemText}>Método: {selected.metodoMarcado}</Text>
          <Text style={styles.itemText}>Observaciones (prod): {selected.observacionesProductor || "-"}</Text>
          <Text style={styles.itemText}>Observaciones (técnico): {selected.observacionesTecnico || "-"}</Text>
          {selected.estado !== "Validado" && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.btn, styles.primary]}
                onPress={() => {
                  setEditNombre(selected.nombre || "");
                  setEditObservaciones(selected.observacionesProductor || "");
                  setEditModalVisible(true);
                }}
              >
                <Text style={styles.btnText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: "#c0392b" }]} onPress={deleteSelected}>
                <Text style={styles.btnText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {viewMode === "listOnly" && !viewingDetailFromList && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
          <View style={{ padding: 8 }}>
            <Text style={{ fontWeight: "bold", marginBottom: 6, fontSize: 16, color: "#1e8449" }}>Lista de lotes</Text>
            <FlatList
              data={list}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No tienes lotes registrados aún</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[styles.item, selected?.id === item.id ? styles.itemSelected : null]}>
                  {item._isOffline ? (
                    <Text style={styles.loteSyncBadge}>Pendiente de sincronización</Text>
                  ) : null}
                  <Text style={styles.itemText}>Nombre: {item.nombre || "-"}</Text>
                  <Text style={styles.itemText}>Estado: {item.estado}</Text>
                  <Text style={styles.itemText}>
                    Superficie: {typeof item.superficie === "number" ? item.superficie : computeAreaHa((item.poligono || []).map((pt) => ({ latitude: pt.lat, longitude: pt.lng }))).toFixed(2)} ha
                  </Text>
                  <Text style={styles.itemText}>Método: {item.metodoMarcado}</Text>
                  <Text style={styles.itemText}>Observaciones (prod): {item.observacionesProductor || "-"}</Text>
                  <Text style={styles.itemText}>Observaciones (técnico): {item.observacionesTecnico || "-"}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => selectItem(item, true)}>
                      <Text style={styles.btnText}>Ver detalle</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </View>
        </ScrollView>
      )}

      {viewingDetailFromList && selected && (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={styles.detailMap}
            region={getPolygonRegion(points)}
          >
            {points.map((p, i) => (
              <Marker key={`d-${i}`} coordinate={p} />
            ))}
            {points.length >= 3 && (
              <Polygon
                coordinates={points}
                strokeColor="#1e8449"
                fillColor="rgba(46, 204, 113, 0.2)"
                strokeWidth={2}
              />
            )}
          </MapView>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
          >
            <View style={styles.detailsCard}>
              <Text style={styles.formTitle}>Detalle del lote</Text>
              {selected._isOffline ? (
                <Text style={[styles.loteSyncBadge, { marginBottom: 8 }]}>Pendiente de sincronización</Text>
              ) : null}
              <Text style={styles.itemText}>Nombre: {selected.nombre || "-"}</Text>
              <Text style={styles.itemText}>Estado: {selected.estado}</Text>
              <Text style={styles.itemText}>
                Superficie: {typeof selected.superficie === "number" ? selected.superficie : computeAreaHa((selected.poligono || []).map((pt) => ({ latitude: pt.lat, longitude: pt.lng }))).toFixed(2)} ha
              </Text>
              <Text style={styles.itemText}>Método: {selected.metodoMarcado}</Text>
              <Text style={styles.itemText}>Observaciones (prod): {selected.observacionesProductor || "-"}</Text>
              <Text style={styles.itemText}>Observaciones (técnico): {selected.observacionesTecnico || "-"}</Text>

              {selected.estado !== "Validado" && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.btn, styles.primary]}
                    onPress={() => {
                      setEditNombre(selected.nombre || "");
                      setEditObservaciones(selected.observacionesProductor || "");
                      setEditModalVisible(true);
                    }}
                  >
                    <Text style={styles.btnText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: "#c0392b" }]} onPress={deleteSelected}>
                    <Text style={styles.btnText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.btn, styles.secondary, styles.backButton]}
                onPress={closeDetailFromList}
              >
                <Text style={styles.btnText}>Volver</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {viewMode !== "mapOnly" && viewMode !== "listOnly" && viewingList && !viewingDetailFromList && (
        <View style={{ padding: 8, paddingBottom: Math.max(insets.bottom, 20) }}>
          <Text style={{ fontWeight: "bold", marginBottom: 6 }}>Lista de lotes</Text>
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No tienes lotes registrados aún</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.item, selected?.id === item.id ? styles.itemSelected : null]}>
                {item._isOffline ? (
                  <Text style={styles.loteSyncBadge}>Pendiente de sincronización</Text>
                ) : null}
                <Text style={styles.itemText}>Nombre: {item.nombre || "-"}</Text>
                <Text style={styles.itemText}>Estado: {item.estado}</Text>
                <Text style={styles.itemText}>
                  Superficie: {typeof item.superficie === "number" ? item.superficie : computeAreaHa((item.poligono || []).map((pt) => ({ latitude: pt.lat, longitude: pt.lng }))).toFixed(2)} ha
                </Text>
                <Text style={styles.itemText}>Método: {item.metodoMarcado}</Text>
                <Text style={styles.itemText}>Observaciones (prod): {item.observacionesProductor || "-"}</Text>
                <Text style={styles.itemText}>Observaciones (técnico): {item.observacionesTecnico || "-"}</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                  <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => selectItem(item)}>
                    <Text style={styles.btnText}>Ver detalle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
          />
        </View>
      )}

      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.formTitle}>Editar lote (pendiente)</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput style={styles.input} value={editNombre} onChangeText={setEditNombre} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Observaciones (max 500)</Text>
              <TextInput style={[styles.input, styles.textArea]} value={editObservaciones} onChangeText={setEditObservaciones} multiline numberOfLines={4} maxLength={500} />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={[styles.btn, styles.primary]}
                onPress={async () => {
                  try {
                    if (!selected) return;
                    if (!editNombre || editNombre.trim().length < 3) throw new Error("Nombre inválido");
                    const resp = await authFetch(`${API_URL}/lotes/${selected.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ nombre: editNombre.trim(), observacionesProductor: editObservaciones?.slice(0, 500) || "" }),
                    });
                    if (!resp.ok) throw new Error("No se pudo actualizar");
                    setEditModalVisible(false);
                    loadList();
                    const updated = list.find((l) => l.id === selected.id);
                    if (updated) selectItem(updated);
                    Alert.alert("OK", "Lote actualizado");
                  } catch (e) {
                    Alert.alert("Error", e.message || "No se pudo actualizar");
                  }
                }}
              >
                <Text style={styles.btnText}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, textAlign: "center", marginVertical: 10, color: "#1e8449" },
  map: { flex: 1, minHeight: 280 },
  mapCreating: { flex: 0, height: 280 },
  mapFullscreen: { flex: 1 },
  mapThumbnail: { height: 190, width: "100%" },
  formCard: { padding: 14, backgroundColor: "#ffffff" },
  row: { flexDirection: "row", justifyContent: "space-around", padding: 8 },
  topBar: { paddingHorizontal: 8, paddingTop: 4 },
  cardBar: { flexDirection: "row", gap: 8, backgroundColor: "#ffffff", padding: 8, borderRadius: 10, elevation: 3, justifyContent: "space-between" },
  form: { padding: 8, backgroundColor: "#ffffff" },
  formTitle: { fontWeight: "bold", marginBottom: 6 },
  formInfo: { padding: 6, alignItems: "center" },
  infoPanel: { padding: 8, backgroundColor: "#ffffff", marginHorizontal: 8, borderRadius: 8, marginTop: 4 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  confirmHint: { marginTop: 6, color: "#6b7280", fontSize: 12 },
  inputGroup: { marginBottom: 8 },
  label: { color: "#34495e", marginBottom: 4 },
  input: { backgroundColor: "#f7f7f7", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 8 },
  textArea: { height: 80, textAlignVertical: "top" },
  btn: { backgroundColor: "#1e8449", padding: 8, borderRadius: 8 },
  btnActive: { backgroundColor: "#2ecc71" },
  primary: { backgroundColor: "#2ecc71" },
  secondary: { backgroundColor: "#3498db" },
  btnText: { color: "#fff" },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, borderWidth: 2.5, borderColor: "transparent", opacity: 0.55 },
  tabBtnNuevo: { backgroundColor: "#27ae60" },
  tabBtnMapa: { backgroundColor: "#2980b9" },
  tabBtnLotes: { backgroundColor: "#2980b9" },
  tabBtnActive: { borderColor: "#fff", elevation: 6, shadowColor: "#000", shadowOpacity: 0.22, shadowOffset: { width: 0, height: 3 }, shadowRadius: 5, opacity: 1 },
  tabBtnText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  tabBtnTextActive: { fontWeight: "800" },
  item: { backgroundColor: "#ffffff", borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: "rgba(15,23,42,0.10)", shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  itemSelected: { borderWidth: 2, borderColor: "#2ecc71" },
  loteSyncBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "#fef3c7", color: "#92400e", overflow: "hidden", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  itemText: { color: "#34495e" },
  details: { padding: 8, backgroundColor: "#ffffff" },
  detailMap: { height: DETAIL_MAP_HEIGHT },
  detailsCard: { padding: 14, backgroundColor: "#ffffff" },
  backButton: { marginTop: 12, alignSelf: "flex-start", paddingHorizontal: 18 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", backgroundColor: "#fff", borderRadius: 12, padding: 12 },
  loadingContainer: { justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  loadingLocation: { color: "#1e8449", marginTop: 0, textAlign: "center" },
  permissionCard: { marginHorizontal: 8, marginBottom: 8, padding: 16, borderRadius: 12, backgroundColor: "#fff3f3", borderWidth: 1, borderColor: "#f3cccc" },
  permissionTitle: { color: "#8b1e2d", fontWeight: "700", marginBottom: 6, textAlign: "center" },
  permissionText: { color: "#34495e", textAlign: "center", marginBottom: 12, lineHeight: 20 },
  permissionActions: { flexDirection: "row", gap: 10, justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  gridBtn: {
    width: "46%",
    margin: 4,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#1e8449",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    elevation: 4,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  modeBtn: {
    width: "46%",
    margin: 4,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  modeBtnActive: {
    backgroundColor: "#1e8449",
    borderColor: "#2ecc71",
    borderWidth: 2,
    elevation: 6,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  modeBtnInactive: {
    backgroundColor: "#f3f4f6",
    borderColor: "rgba(15,23,42,0.12)",
    opacity: 0.78,
  },
  modeBtnText: { fontWeight: "900" },
  modeBtnTextActive: { color: "#ffffff" },
  modeBtnTextInactive: { color: "#6b7280" },
  modeBadge: {
    width: "96%",
    marginTop: 4,
    marginBottom: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  modeBadgeAereo: { backgroundColor: "#f0faf4", borderColor: "rgba(30,132,73,0.18)" },
  modeBadgeGps: { backgroundColor: "#eef6ff", borderColor: "rgba(52,152,219,0.18)" },
  modeBadgeText: { color: "#2c3e50", fontWeight: "800" },
  modeDot: { width: 10, height: 10, borderRadius: 5 },
  modeDotAereo: { backgroundColor: "#2ecc71" },
  modeDotGps: { backgroundColor: "#3498db" },
  gpsControls: { width: "95%", padding: 12, backgroundColor: "#fff", borderRadius: 12, elevation: 5, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  gpsStatusHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, justifyContent: "center" },
  gpsStatusText: { fontSize: 16, fontWeight: "bold", color: "#2c3e50" },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#e74c3c", marginRight: 8 },
  gpsActionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, gap: 10 },
  gpsActionBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  gpsFinishBtn: { width: "100%", padding: 14, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  currentPosMarker: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(52, 152, 219, 0.2)", alignItems: "center", justifyContent: "center" },
  currentPosDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#3498db", borderWeight: 2, borderColor: "#fff" },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    marginTop: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  emptyText: {
    color: "#7f8c8d",
    fontSize: 16,
    textAlign: "center",
  },
});
