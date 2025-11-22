// src/screens/HomeScreen.js

import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { AuthContext } from "../context/AuthContext";
import ButtonPrimary from "../components/ButtonPrimary";

export default function HomeScreen({ navigation }) {
  const { logout, user } = useContext(AuthContext);

  const displayName = user?.displayName || user?.email || "Usuario";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¡Bienvenido!</Text>
      <Text style={styles.subtitle}>{displayName}</Text>

      <View style={styles.actions}>
        <ButtonPrimary title="Ver mis lotes" onPress={() => navigation.navigate("Lotes")} />
        <ButtonPrimary title="Mis mediciones" onPress={() => navigation.navigate("Mediciones")} />
        <ButtonPrimary title="Mis ubicaciones" onPress={() => navigation.navigate("MisUbicaciones")} />
        <ButtonPrimary title="Mis turnos" onPress={() => navigation.navigate("Turnos")} />
        <ButtonPrimary title="Perfil" onPress={() => navigation.navigate("Perfil")} />
      </View>

      <View style={{ marginTop: 10 }}>
        <ButtonPrimary title="Cerrar sesión" onPress={logout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#ffffff" },
  title: { fontSize: 24, textAlign: "center", marginBottom: 8, color: "#1e8449", fontWeight: "bold" },
  subtitle: { fontSize: 16, textAlign: "center", marginBottom: 20, color: "#2ecc71" },
  actions: { marginVertical: 8 },
});
