import React, { useContext } from "react";
import { View, Button, Text, StyleSheet } from "react-native";
import { AuthContext } from "../context/AuthContext";

export default function HomeScreen({ navigation }) {
  const { logout, user } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido, {user?.email}</Text>
      <Button title="Ver Lotes" onPress={() => navigation.navigate("Lotes")} />
      <Button title="Turnos" onPress={() => navigation.navigate("Turnos")} />
      <Button title="Perfil" onPress={() => navigation.navigate("Perfil")} />
      <Button title="Cerrar sesión" onPress={logout} color="red" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 22, textAlign: "center", marginBottom: 20 },
});
