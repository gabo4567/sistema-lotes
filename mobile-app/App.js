import React, { useContext, useMemo, useState } from "react";
import { LogBox, View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal } from "react-native";

// IMPORTÁ firebase ANTES de TODO
import "./src/services/firebase";

import AppNavigator from "./src/navigation/AppNavigator";
import { AuthContext, AuthProvider } from "./src/context/AuthContext";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { getNotificationPermissionStatus, registerPushToken, setupNotifications } from "./src/services/notifications";
import { checkAcceptedTurnosFromApi } from "./src/services/turnoAcceptedNotifier";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
    })();
  }, []);
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <NotificationPermissionGate />
          <AppNavigator />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const NotificationPermissionGate = () => {
  const { user } = useContext(AuthContext);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState("ask"); // ask | expoGo
  const title = useMemo(() => {
    return mode === "expoGo" ? "Notificaciones" : "Activar notificaciones";
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user) return;
        const prompted = await AsyncStorage.getItem("notif_permission_prompted_v1");
        if (prompted) return;
        const status = await getNotificationPermissionStatus();
        if (status === "granted") {
          await AsyncStorage.setItem("notif_permission_prompted_v1", "1");
          return;
        }
        if (status === "unsupported_expo_go" || Constants?.appOwnership === "expo") {
          if (!cancelled) {
            setMode("expoGo");
            setVisible(true);
          }
          return;
        }
        if (!cancelled) {
          setMode("ask");
          setVisible(true);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await checkAcceptedTurnosFromApi();
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => setVisible(false)}>
      <View style={permStyles.backdrop}>
        <View style={permStyles.card}>
          <Text style={permStyles.title}>{title}</Text>

          {mode === "expoGo" ? (
            <>
              <Text style={permStyles.body}>
                Para recibir avisos del IPT, instalá la app en el teléfono. En Expo Go las notificaciones pueden no funcionar correctamente.
              </Text>
              <View style={permStyles.actions}>
                <TouchableOpacity
                  style={[permStyles.btn, permStyles.btnPrimary]}
                  onPress={async () => {
                    try {
                      await AsyncStorage.setItem("notif_permission_prompted_v1", "1");
                    } catch {}
                    setVisible(false);
                  }}
                >
                  <Text style={permStyles.btnPrimaryText}>Entendido</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={permStyles.body}>
                Activá las notificaciones para recibir avisos de turnos, recordatorios y novedades importantes del IPT.
              </Text>
              <View style={permStyles.actions}>
                <TouchableOpacity
                  style={[permStyles.btn, permStyles.btnSecondary]}
                  onPress={async () => {
                    try {
                      await AsyncStorage.setItem("notif_permission_prompted_v1", "1");
                    } catch {}
                    setVisible(false);
                  }}
                >
                  <Text style={permStyles.btnSecondaryText}>Ahora no</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[permStyles.btn, permStyles.btnPrimary]}
                  onPress={async () => {
                    try {
                      await AsyncStorage.setItem("notif_permission_prompted_v1", "1");
                    } catch {}
                    setVisible(false);
                    try {
                      await registerPushToken();
                    } catch {}
                  }}
                >
                  <Text style={permStyles.btnPrimaryText}>Activar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const permStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)", justifyContent: "center", alignItems: "center", padding: 20 },
  card: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "rgba(15,23,42,0.10)", shadowColor: "#0f172a", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  title: { fontSize: 18, fontWeight: "900", color: "#166534", marginBottom: 8, textAlign: "center" },
  body: { fontSize: 14, color: "#374151", lineHeight: 20, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 16 },
  btn: { flex: 1, minHeight: 42, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#16a34a" },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
  btnSecondary: { backgroundColor: "#e5e7eb" },
  btnSecondaryText: { color: "#111827", fontWeight: "800" },
});
