// src/screens/PoligonoScreen.js

import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";

export default function PoligonoScreen() {
  const [points, setPoints] = useState([]);

  const handleMapPress = (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setPoints([...points, { latitude, longitude }]);
  };

  const undoLastPoint = () => {
    setPoints(points.slice(0, -1));
  };

  const savePolygon = () => {
    if (points.length < 3) {
      alert("El polígono necesita al menos 3 puntos.");
      return;
    }

    // 🔥 Guardar en Firestore
    // import { db } from "../services/firebase";
    // addDoc(collection(db, "lotes"), { vertices: points });

    alert("Polígono guardado correctamente (lógica disponible).");
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        onPress={handleMapPress}
        initialRegion={{
          latitude: -29.1402, // Goya aproximadamente
          longitude: -59.2653,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {points.map((point, index) => (
          <Marker
            key={index}
            coordinate={point}
            pinColor="red"
          />
        ))}

        {points.length >= 3 && (
          <Polygon
            coordinates={points}
            strokeWidth={2}
            strokeColor="rgba(0, 150, 255, 0.8)"
            fillColor="rgba(0, 150, 255, 0.2)"
          />
        )}
      </MapView>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.button} onPress={undoLastPoint}>
          <Text style={styles.buttonText}>Deshacer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={savePolygon}>
          <Text style={styles.buttonText}>Guardar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  buttons: {
    flexDirection: "row",
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    gap: 10
  },

  button: {
    backgroundColor: "#007bff",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10
  },

  buttonText: { color: "white", fontWeight: "bold" }
});
