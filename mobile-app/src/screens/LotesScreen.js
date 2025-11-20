// src/screens/LotesScreen.js

import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from "react-native";
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
  const mapRef = useRef(null);

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
    if (mode !== "aereo") return;
    const { coordinate } = e.nativeEvent;
    setPoints((prev) => [...prev, { latitude: coordinate.latitude, longitude: coordinate.longitude }]);
  };

  useEffect(() => {
    let watch;
    (async () => {
      if (mode === "gps") {
        watch = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 5 }, (pos) => {
          const c = pos.coords;
          setPoints((prev) => [...prev, { latitude: c.latitude, longitude: c.longitude }]);
        });
      }
    })();
    return () => {
      if (watch) watch.remove();
    };
  }, [mode]);

  const clearPolygon = () => setPoints([]);

  const savePolygon = async () => {
    if (points.length < 3) {
      alert("Polígono insuficiente");
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
        const body = { ipt, poligono, metodoMarcado };
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
    <View style={styles.container}>
      <Text style={styles.title}>Mis Lotes</Text>

      {errorMsg && <Text>{errorMsg}</Text>}

      {location ? (
        <MapView ref={mapRef} style={styles.map} initialRegion={location} onPress={onMapPress}>
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

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, mode === "aereo" ? styles.btnActive : null]} onPress={() => setMode("aereo")}>
          <Text style={styles.btnText}>Dibujo aéreo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, mode === "gps" ? styles.btnActive : null]} onPress={() => setMode("gps")}>
          <Text style={styles.btnText}>GPS caminando</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={clearPolygon}>
          <Text style={styles.btnText}>Limpiar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={savePolygon} disabled={saving}>
          <Text style={styles.btnText}>{saving ? "Guardando..." : selected ? "Guardar cambios" : "Guardar"}</Text>
        </TouchableOpacity>
        {selected && selected.estado !== "Validado" && (
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#c0392b" }]} onPress={deleteSelected}>
            <Text style={styles.btnText}>Eliminar</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ padding: 8 }}>
        <Text style={{ fontWeight: "bold", marginBottom: 6 }}>Lista de lotes</Text>
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => selectItem(item)}>
              <View style={[styles.item, selected?.id === item.id ? styles.itemSelected : null]}>
                <Text style={styles.itemText}>Estado: {item.estado}</Text>
                <Text style={styles.itemText}>Método: {item.metodoMarcado}</Text>
                <Text style={styles.itemText}>Observaciones: {item.observacionesTecnico || "-"}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, textAlign: "center", marginVertical: 10 },
  map: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-around", padding: 8 },
  btn: { backgroundColor: "#1e8449", padding: 8, borderRadius: 8 },
  btnActive: { backgroundColor: "#2ecc71" },
  btnText: { color: "#fff" },
  item: { padding: 8, backgroundColor: "#ffffff", borderRadius: 8, marginBottom: 6 },
  itemSelected: { borderWidth: 2, borderColor: "#2ecc71" },
  itemText: { color: "#34495e" },
});
