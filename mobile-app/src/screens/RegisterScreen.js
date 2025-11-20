import React, { useState } from "react";
import { View, TextInput, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { auth } from "../services/firebase";
import ButtonPrimary from "../components/ButtonPrimary";

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");

    if (!email || !password) {
      setError("Completá correo y contraseña.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Correo inválido.");
      return;
    }
    if ((password || "").length < 6) {
      setError("Contraseña demasiado débil (mínimo 6 caracteres).");
      return;
    }

    setLoading(true);

    try {
      await auth.createUserWithEmailAndPassword(
        email.trim(),
        password
      );

      navigation.navigate("Login");
    } catch (err) {
      const code = err?.code || "auth/error";
      let message = "No se pudo registrar.";

      if (code === "auth/invalid-email") message = "Correo inválido.";
      else if (code === "auth/weak-password") message = "Contraseña demasiado débil.";
      else if (code === "auth/email-already-in-use") message = "Correo ya registrado.";
      else if (code === "auth/network-request-failed") message = "Error de red. Verificá tu conexión.";
      else if (code === "auth/internal-error") message = "Error interno de autenticación.";

      setError(message);
      if (__DEV__) console.log("register error:", code, err?.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Crear cuenta</Text>

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#7f8c8d"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
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
          <ButtonPrimary title="Registrarse" onPress={handleRegister} />
        )}

        <TouchableOpacity onPress={() => navigation.navigate("Login")}> 
          <Text style={styles.link}>¿Ya tenés cuenta? Iniciá sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" },
  card: { width: "90%", backgroundColor: "#ffffff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  title: { fontSize: 24, textAlign: "center", marginBottom: 16, color: "#1e8449", fontWeight: "bold" },
  input: { borderWidth: 1.5, borderColor: "#95a5a6", backgroundColor: "#fdfefe", padding: 12, borderRadius: 10, marginBottom: 12 },
  link: { color: "#1e8449", textAlign: "center", marginTop: 12, fontWeight: "600" },
  error: { color: "#c0392b", textAlign: "center", marginBottom: 8 },
});
