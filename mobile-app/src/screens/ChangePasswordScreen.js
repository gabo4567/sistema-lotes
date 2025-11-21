import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import ButtonPrimary from "../components/ButtonPrimary";
import { API_URL } from "../utils/constants";
import { auth } from "../services/firebase";
import { signInWithCustomToken } from "firebase/auth";

export default function ChangePasswordScreen({ route, navigation }) {
  const { ipt } = route.params || {};
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = async () => {
    setError("");
    if (!ipt || !oldPassword || !newPassword || !confirm) {
      setError("Completá todos los campos.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Contraseña demasiado débil (mínimo 6 caracteres).");
      return;
    }
    if (newPassword !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/auth/productor/cambiar-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipt, oldPassword, newPassword }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw { code: "backend", message: j?.error || "No se pudo cambiar la contraseña" };
      }
      const j = await resp.json();
      if (j.token) {
        await signInWithCustomToken(auth, j.token);
        navigation.replace("Home");
        return;
      }
      navigation.navigate("Login");
    } catch (err) {
      const code = err?.code || "error";
      let message = err?.message || "No se pudo cambiar la contraseña.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Cambiar contraseña</Text>
        <TextInput style={styles.input} placeholder="Contraseña actual" secureTextEntry value={oldPassword} onChangeText={setOldPassword} />
        <TextInput style={styles.input} placeholder="Nueva contraseña" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
        <TextInput style={styles.input} placeholder="Confirmar contraseña" secureTextEntry value={confirm} onChangeText={setConfirm} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#2ecc71" style={{ marginVertical: 8 }} /> : <ButtonPrimary title="Guardar" onPress={handleChange} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" },
  card: { width: "90%", backgroundColor: "#ffffff", borderRadius: 16, padding: 20 },
  title: { fontSize: 20, textAlign: "center", marginBottom: 12, color: "#1e8449", fontWeight: "bold" },
  input: { borderWidth: 1.5, borderColor: "#95a5a6", backgroundColor: "#fdfefe", padding: 12, borderRadius: 10, marginBottom: 12 },
  error: { color: "#c0392b", textAlign: "center", marginBottom: 8 },
});