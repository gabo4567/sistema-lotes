import React from "react";
import { LogBox, View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";

// IMPORTÁ firebase ANTES de TODO
import "./src/services/firebase";

import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { useEffect } from "react";
import { setupNotifications, registerPushToken } from "./src/services/notifications";

// ── Error boundary ────────────────────────────────────────────────────────────
// Catches any React render error and shows the message on screen instead of
// letting the app crash silently (helps diagnose issues on physical devices).
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (__DEV__) console.error("ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || "Error desconocido";
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.title}>Error al iniciar la app</Text>
          <Text style={ebStyles.subtitle}>
            Tomá una captura de pantalla y compartila:
          </Text>
          <ScrollView style={ebStyles.box}>
            <Text style={ebStyles.msg} selectable>{msg}</Text>
          </ScrollView>
          <TouchableOpacity
            style={ebStyles.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={ebStyles.btnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const ebStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" },
  title:     { fontSize: 20, fontWeight: "bold", color: "#c0392b", marginBottom: 8, textAlign: "center" },
  subtitle:  { fontSize: 13, color: "#555", marginBottom: 12, textAlign: "center" },
  box:       { maxHeight: 250, width: "100%", backgroundColor: "#f4f4f4", borderRadius: 8, padding: 12, marginBottom: 20 },
  msg:       { fontSize: 12, color: "#333", fontFamily: "monospace" },
  btn:       { backgroundColor: "#228B22", paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8 },
  btnText:   { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  LogBox.ignoreLogs([
    "The action 'RESET' with payload",
  ]);
  useEffect(() => {
    (async () => {
      try {
        await setupNotifications();
      } catch {}
      try {
        await registerPushToken();
      } catch {}
    })();
  }, []);
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}
