// src/screens/LotesScreen.js

import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, TextInput, Modal } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polygon } from "react-native-maps";
import * as Location from "expo-location";
import { auth } from "../services/firebase";
import { API_URL } from "../utils/constants";

export default function LotesScreen() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [mode, setMode] = useState("aereo");
  const [points, setPoints] = useState([]);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [nombre, setNombre] = useState("");
  const [observacionesProductor, setObservacionesProductor] = useState("");
  const [creating, setCreating] = useState(false);
  const [createStep, setCreateStep] = useState("polygon");
  const [viewingList, setViewingList] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editObservaciones, setEditObservaciones] = useState("");
  const mapRef = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Se necesita permiso de ubicación.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      loadList();
    })();
  }, []);

  const loadList = async () => {
    try {
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      if (!ipt) return;
      const resp = await fetch(`${API_URL}/lotes/productor/${ipt}`);
      const j = await resp.json();
      setList(Array.isArray(j) ? j : []);
    } catch {}
  };

  const onMapPress = (e) => {
    if (!creating || createStep !== "polygon" || mode !== "aereo") return;
    const { coordinate } = e.nativeEvent;
    setPoints((prev) => [...prev, { latitude: coordinate.latitude, longitude: coordinate.longitude }]);
  };

  useEffect(() => {
    let watch;
    (async () => {
      if (creating && createStep === "polygon" && mode === "gps") {
        watch = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 5 }, (pos) => {
          const c = pos.coords;
          setPoints((prev) => [...prev, { latitude: c.latitude, longitude: c.longitude }]);
        });
      }
    })();
    return () => {
      if (watch) watch.remove();
    };
  }, [mode, creating, createStep]);

  const clearPolygon = () => setPoints([]);

  const startCreate = () => {
    setCreating(true);
    setSelected(null);
    setPoints([]);
    setNombre("");
    setObservacionesProductor("");
    setMode("aereo");
    setCreateStep("polygon");
    setViewingList(false);
  };

  const cancelCreate = () => {
    setCreating(false);
    setPoints([]);
    setNombre("");
    setObservacionesProductor("");
    setCreateStep("polygon");
  };

  const toFormStep = () => {
    setCreateStep("form");
  };

  const toPolygonStep = () => {
    setCreateStep("polygon");
  };

  const degreesToRadians = (deg) => (deg * Math.PI) / 180;
  const computeAreaHa = (pts) => {
    if (!Array.isArray(pts) || pts.length < 3) return 0;
    const R = 6378137;
    const lat0 = pts.reduce((s, p) => s + p.latitude, 0) / pts.length;
    const cosLat0 = Math.cos(degreesToRadians(lat0));
    const projected = pts.map((p) => {
      const x = degreesToRadians(p.longitude) * R * cosLat0;
      const y = degreesToRadians(p.latitude) * R;
      return { x, y };
    });
    let area = 0;
    for (let i = 0, j = projected.length - 1; i < projected.length; j = i++) {
      area += projected[j].x * projected[i].y - projected[i].x * projected[j].y;
    }
    area = Math.abs(area) / 2; // m^2
    return area / 10000; // ha
  };

  const currentAreaHa = computeAreaHa(points);

  const savePolygon = async () => {
    if (points.length < 3) {
      alert("Polígono insuficiente");
      return;
    }
    if (currentAreaHa <= 0) {
      alert("Superficie inválida");
      return;
    }
    setSaving(true);
    try {
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      const poligono = points.map((p) => ({ lat: p.latitude, lng: p.longitude }));
      const metodoMarcado = mode === "gps" ? "GPS" : "aereo";
      let resp;
      if (selected && selected.estado !== "Validado") {
        resp = await fetch(`${API_URL}/lotes/${selected.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ poligono, metodoMarcado }),
        });
      } else {
        if (!nombre || nombre.trim().length < 3) {
          throw new Error("Nombre del lote inválido (mínimo 3 caracteres)");
        }
        const body = { ipt, poligono, metodoMarcado, nombre: nombre.trim(), observacionesProductor: observacionesProductor?.slice(0,500) || "", superficie: Number(currentAreaHa.toFixed(4)) };
        resp = await fetch(`${API_URL}/lotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || "No se pudo guardar el lote");
      }
      clearPolygon();
      setSelected(null);
      setNombre("");
      setObservacionesProductor("");
      setCreating(false);
      setCreateStep("polygon");
      loadList();
      alert("Lote guardado");
    } catch (e) {
      alert(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const selectItem = (item) => {
    setSelected(item);
    setCreating(false);
    setCreateStep("polygon");
    setViewingList(false);
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
    try {
      const resp = await fetch(`${API_URL}/lotes/${selected.id}`, { method: "DELETE" });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || "No se pudo eliminar el lote");
      }
      setSelected(null);
      clearPolygon();
      loadList();
      Alert.alert("Eliminado", "Lote eliminado correctamente");
    } catch (e) {
      Alert.alert("Error", e.message || "No se pudo eliminar");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <Text style={styles.title}>Mis Lotes</Text>

      {errorMsg && <Text>{errorMsg}</Text>}

      <View style={styles.topBar}>
        <View style={styles.cardBar}>
          <TouchableOpacity style={[styles.btn, styles.primary]} onPress={startCreate}>
            <Text style={styles.btnText}>Nuevo Lote</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => { setViewingList(true); setCreating(false); setSelected(null); }}>
            <Text style={styles.btnText}>Ver lista de lotes</Text>
          </TouchableOpacity>
        </View>
      </View>

      {location ? (
        <MapView ref={mapRef} style={[styles.map, { marginBottom: Math.max(insets.bottom, 16) }]} initialRegion={location} onPress={onMapPress}>
          <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} title="Mi ubicación" />
          {points.length >= 1 && (
            <>
              {points.map((p, i) => (
                <Marker key={`p-${i}`} coordinate={p} />
              ))}
              {points.length >= 3 && (
                <Polygon coordinates={points} strokeColor="#1e8449" fillColor="rgba(46, 204, 113, 0.2)" strokeWidth={2} />
              )}
            </>
          )}
        </MapView>
      ) : (
        <Text>Cargando ubicación...</Text>
      )}

      {creating && createStep === "polygon" && (
        <View style={[styles.row, { marginBottom: Math.max(insets.bottom, 24) }]}>
          <TouchableOpacity style={[styles.btn, mode === "aereo" ? styles.btnActive : null]} onPress={() => setMode("aereo")}>
            <Text style={styles.btnText}>Dibujo aéreo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, mode === "gps" ? styles.btnActive : null]} onPress={() => setMode("gps")}>
            <Text style={styles.btnText}>GPS caminando</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={clearPolygon}>
            <Text style={styles.btnText}>Limpiar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#c0392b" }]} onPress={cancelCreate}>
            <Text style={styles.btnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      {creating && createStep === "polygon" && (
        <View style={[styles.formInfo, { marginBottom: Math.max(insets.bottom, 12) }]}><Text style={styles.itemText}>Dibujá el polígono para continuar</Text></View>
      )}

      {creating && createStep === "polygon" && points.length >= 3 && (
        <View style={[styles.infoPanel, { marginBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.itemText}>Superficie: {currentAreaHa.toFixed(2)} ha</Text>
          <Text style={styles.itemText}>Método: {mode === "gps" ? "GPS" : "aéreo"}</Text>
          <TouchableOpacity style={[styles.btn, styles.primary]} onPress={toFormStep} disabled={currentAreaHa <= 0}>
            <Text style={styles.btnText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      )}

      {creating && createStep === "form" && (
        <View style={[styles.form, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Text style={styles.formTitle}>Datos del lote</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre del lote *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Lote Norte"
              value={nombre}
              onChangeText={setNombre}
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
          <View style={styles.formInfo}>
            <Text style={styles.itemText}>Superficie (ha): {currentAreaHa.toFixed(2)}</Text>
            <Text style={styles.itemText}>Método: {mode === "gps" ? "GPS" : "aéreo"}</Text>
            <Text style={styles.itemText}>Estado: Pendiente</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity style={[styles.btn, styles.primary]} onPress={savePolygon} disabled={saving}>
              <Text style={styles.btnText}>{saving ? "Guardando..." : "Guardar lote"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={toPolygonStep}>
              <Text style={styles.btnText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!creating && selected && (
        <View style={[styles.details, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Text style={styles.formTitle}>Detalle del lote</Text>
          <Text style={styles.itemText}>Nombre: {selected.nombre || "-"}</Text>
          <Text style={styles.itemText}>Estado: {selected.estado}</Text>
          <Text style={styles.itemText}>Superficie: {typeof selected.superficie === "number" ? selected.superficie : computeAreaHa((selected.poligono||[]).map(pt=>({latitude:pt.lat,longitude:pt.lng}))).toFixed(2)} ha</Text>
          <Text style={styles.itemText}>Método: {selected.metodoMarcado}</Text>
          <Text style={styles.itemText}>Observaciones (prod): {selected.observacionesProductor || "-"}</Text>
          <Text style={styles.itemText}>Observaciones: {selected.observacionesTecnico || "-"}</Text>
          {selected.estado !== "Validado" && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => { setEditNombre(selected.nombre || ""); setEditObservaciones(selected.observacionesProductor || ""); setEditModalVisible(true); }}>
                <Text style={styles.btnText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: "#c0392b" }]} onPress={deleteSelected}>
                <Text style={styles.btnText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {viewingList && (
        <View style={{ padding: 8, paddingBottom: Math.max(insets.bottom, 24) }}>
          <Text style={{ fontWeight: "bold", marginBottom: 6 }}>Lista de lotes</Text>
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[styles.item, selected?.id === item.id ? styles.itemSelected : null]}>
                <Text style={styles.itemText}>Nombre: {item.nombre || "-"}</Text>
                <Text style={styles.itemText}>Estado: {item.estado}</Text>
                <Text style={styles.itemText}>Superficie: {typeof item.superficie === "number" ? item.superficie : computeAreaHa((item.poligono||[]).map(pt=>({latitude:pt.lat,longitude:pt.lng}))).toFixed(2)} ha</Text>
                <Text style={styles.itemText}>Método: {item.metodoMarcado}</Text>
                <Text style={styles.itemText}>Observaciones (prod): {item.observacionesProductor || "-"}</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                  <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => selectItem(item)}>
                    <Text style={styles.btnText}>Ver detalle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
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
                    const resp = await fetch(`${API_URL}/lotes/${selected.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ nombre: editNombre.trim(), observacionesProductor: editObservaciones?.slice(0,500) || "" }),
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
  title: { fontSize: 20, textAlign: "center", marginVertical: 10 },
  map: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-around", padding: 8 },
  topBar: { paddingHorizontal: 8, paddingTop: 4 },
  cardBar: { flexDirection: "row", gap: 12, backgroundColor: "#ffffff", padding: 10, borderRadius: 10, elevation: 3 },
  form: { padding: 8, backgroundColor: "#ffffff" },
  formTitle: { fontWeight: "bold", marginBottom: 6 },
  formInfo: { padding: 8 },
  infoPanel: { padding: 8, backgroundColor: "#ffffff", marginHorizontal: 8, borderRadius: 8, marginTop: 8 },
  inputGroup: { marginBottom: 8 },
  label: { color: "#34495e", marginBottom: 4 },
  input: { backgroundColor: "#f7f7f7", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 8 },
  textArea: { height: 80, textAlignVertical: "top" },
  btn: { backgroundColor: "#1e8449", padding: 8, borderRadius: 8 },
  btnActive: { backgroundColor: "#2ecc71" },
  primary: { backgroundColor: "#2ecc71" },
  secondary: { backgroundColor: "#3498db" },
  btnText: { color: "#fff" },
  item: { padding: 8, backgroundColor: "#ffffff", borderRadius: 8, marginBottom: 6 },
  itemSelected: { borderWidth: 2, borderColor: "#2ecc71" },
  itemText: { color: "#34495e" },
  details: { padding: 8, backgroundColor: "#ffffff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", backgroundColor: "#fff", borderRadius: 12, padding: 12 },
});
