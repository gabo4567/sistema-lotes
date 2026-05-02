import React, { useState, useContext } from "react";
import { View, TextInput, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { auth } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";
import ButtonPrimary from "../components/ButtonPrimary";
import { API_URL } from "../utils/constants";
import { signInWithCustomToken } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../api/api";

export default function LoginScreen({ navigation }) {
  const { setUser } = useContext(AuthContext);
  const [ipt, setIpt] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    if (!ipt || !password) {
      setError("Completá IPT y contraseña.");
      return;
    }

    const iptRegex = /^\d{4,10}$/;
    if (!iptRegex.test(String(ipt).trim())) {
      setError("IPT inválido (4 a 10 dígitos).");
      return;
    }

    setLoading(true);

    try {
      if (__DEV__) console.log("API_URL:", API_URL);
      const resp = await apiFetch(`${API_URL}/auth/login-productor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipt: String(ipt).trim(), password }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw { code: "backend", message: j?.error || "Login fallido" };
      }
      const j = await resp.json();
      if (j.requiereCambioContrasena) {
        navigation.navigate("ChangePassword", { ipt: String(ipt).trim() });
        return;
      }
      await signInWithCustomToken(auth, j.token);
      setUser(auth.currentUser);
    } catch (err) {
      const code = err?.code || "auth/error";
      let message = "Error al iniciar sesión.";

      if (code === "backend") message = err?.message || message;
      else if (code === "auth/invalid-credential") message = "Credenciales incorrectas.";
      else if (code === "OFFLINE") message = "Sin conexión a internet.";
      else if (code === "SERVER_WAKING") message = err?.message || "Conectando al servidor…";
      else if (String(err?.message || "").includes("Network request failed")) message = "No se pudo conectar al servidor.";

      setError(message);
      if (__DEV__) console.log("login error:", code, err?.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Sistema de Gestión - IPT</Text>
        <Text style={styles.subtitle}>Iniciar sesión</Text>

        <TextInput
          style={[styles.input, styles.inputSpacing]}
          placeholder="IPT"
          placeholderTextColor="#7f8c8d"
          keyboardType="number-pad"
          autoCapitalize="none"
          value={ipt}
          onChangeText={setIpt}
        />

        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, { paddingRight: 45 }]}
            placeholder="Contraseña"
            placeholderTextColor="#7f8c8d"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity 
            style={styles.toggle} 
            onPress={() => setShowPassword(v => !v)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={showPassword ? "eye-off-outline" : "eye-outline"} 
              size={22} 
              color="#7f8c8d" 
            />
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color="#2ecc71" style={{ marginVertical: 8 }} />
        ) : (
          <ButtonPrimary title="Ingresar" onPress={handleLogin} />
        )}

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Versión 1.0.0</Text>
          <Text style={styles.copyrightText}>© 2026 IPT</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" },
  card: { width: "90%", backgroundColor: "#ffffff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  title: { fontSize: 26, textAlign: "center", marginBottom: 8, color: "#1e8449", fontWeight: "bold" },
  subtitle: { fontSize: 16, textAlign: "center", marginBottom: 16, color: "#1e8449" },
  inputWrapper: { position: "relative", marginBottom: 12 },
  input: { borderWidth: 1.5, borderColor: "#95a5a6", backgroundColor: "#fdfefe", padding: 12, borderRadius: 10, color: "#2c3e50" },
  inputSpacing: { marginBottom: 12 },
  toggle: { 
    position: "absolute", 
    right: 0, 
    height: "100%", 
    width: 45, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  versionContainer: { marginTop: 20, alignItems: "center" },
  versionText: { fontSize: 14, color: "#7f8c8d", fontWeight: "600" },
  copyrightText: { fontSize: 12, color: "#95a5a6", marginTop: 4 },
  error: { color: "#c0392b", textAlign: "center", marginBottom: 8 },
});
