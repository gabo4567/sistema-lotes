import React, { useState, useContext } from "react";
import { View, TextInput, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { auth } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";
import ButtonPrimary from "../components/ButtonPrimary";
import { API_URL } from "../utils/constants";
import { signInWithCustomToken } from "firebase/auth";

export default function LoginScreen({ navigation }) {
  const { setUser } = useContext(AuthContext);
  const [ipt, setIpt] = useState("");
  const [password, setPassword] = useState("");
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
      const resp = await fetch(`${API_URL}/auth/login-productor`, {
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
        <Text style={styles.title}>Sistema de Lotes</Text>
        <Text style={styles.subtitle}>Iniciar sesión</Text>

        <TextInput
          style={styles.input}
          placeholder="IPT"
          placeholderTextColor="#7f8c8d"
          keyboardType="number-pad"
          autoCapitalize="none"
          value={ipt}
          onChangeText={setIpt}
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#7f8c8d"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color="#2ecc71" style={{ marginVertical: 8 }} />
        ) : (
          <ButtonPrimary title="Ingresar" onPress={handleLogin} />
        )}

        <TouchableOpacity onPress={() => navigation.navigate("Register")}> 
          <Text style={styles.link}>¿No tenés cuenta? Registrate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" },
  card: { width: "90%", backgroundColor: "#ffffff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  title: { fontSize: 26, textAlign: "center", marginBottom: 8, color: "#1e8449", fontWeight: "bold" },
  subtitle: { fontSize: 16, textAlign: "center", marginBottom: 16, color: "#1e8449" },
  input: { borderWidth: 1.5, borderColor: "#95a5a6", backgroundColor: "#fdfefe", padding: 12, borderRadius: 10, marginBottom: 12 },
  link: { color: "#1e8449", textAlign: "center", marginTop: 12, fontWeight: "600" },
  error: { color: "#c0392b", textAlign: "center", marginBottom: 8 },
});
