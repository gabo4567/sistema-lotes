import React, { useCallback, useContext, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { AuthContext } from "../context/AuthContext";
import { getNotificationPermissionInfo, registerPushToken } from "../services/notifications";
import { usePermissionPrompt } from "../components/PermissionPromptModal";

export default function ConfiguracionScreen({ navigation }) {
  const { user, confirmLogout } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const { ask: askPermission, Prompt: PermissionPrompt } = usePermissionPrompt();
  const backBtnTop = useMemo(() => {
    const desired = Math.max(insets.top, 8) + 6;
    const headerTop = Math.max(insets.top, 16) + 4;
    return desired - headerTop;
  }, [insets.top]);

  const [notifStatus, setNotifStatus] = useState(null);
  const [notifCanAskAgain, setNotifCanAskAgain] = useState(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifActionLoading, setNotifActionLoading] = useState(false);

  const [locStatus, setLocStatus] = useState(null);
  const [locCanAskAgain, setLocCanAskAgain] = useState(null);
  const [locServicesEnabled, setLocServicesEnabled] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locActionLoading, setLocActionLoading] = useState(false);

  const refreshNotificationStatus = useCallback(async () => {
    try {
      setNotifLoading(true);
      const info = await getNotificationPermissionInfo();
      setNotifStatus(info?.status ?? null);
      setNotifCanAskAgain(typeof info?.canAskAgain === "boolean" ? info.canAskAgain : null);
    } catch {
      setNotifStatus(null);
      setNotifCanAskAgain(null);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const refreshLocationStatus = useCallback(async () => {
    try {
      setLocLoading(true);
      const perm = await Location.getForegroundPermissionsAsync();
      const status = perm?.status ?? null;
      const canAskAgain = typeof perm?.canAskAgain === "boolean" ? perm.canAskAgain : null;
      setLocStatus(status);
      setLocCanAskAgain(canAskAgain);
      if (status === "granted") {
        const enabled = await Location.hasServicesEnabledAsync().catch(() => null);
        setLocServicesEnabled(typeof enabled === "boolean" ? enabled : null);
      } else {
        setLocServicesEnabled(null);
      }
    } catch {
      setLocStatus(null);
      setLocCanAskAgain(null);
      setLocServicesEnabled(null);
    } finally {
      setLocLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshNotificationStatus();
      refreshLocationStatus();
      return () => {};
    }, [refreshLocationStatus, refreshNotificationStatus])
  );

  const notifLabel = useMemo(() => {
    if (notifStatus === "unsupported_expo_go") return "No disponible en esta versión";
    if (notifStatus === "granted") return "Activadas";
    if (notifCanAskAgain === false) return "Bloqueadas";
    return "Desactivadas";
  }, [notifCanAskAgain, notifStatus]);

  const locLabel = useMemo(() => {
    if (locStatus === "granted") {
      if (locServicesEnabled === false) return "GPS desactivado";
      return "Ubicación activada";
    }
    return "Permiso denegado";
  }, [locServicesEnabled, locStatus]);

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert("No disponible", "No se pudo abrir configuración del sistema");
    }
  }, []);

  const enableNotifications = useCallback(async () => {
    try {
      setNotifActionLoading(true);
      await registerPushToken();
    } catch (e) {
      Alert.alert("Error", e?.message || "No se pudo activar notificaciones");
    } finally {
      setNotifActionLoading(false);
      refreshNotificationStatus();
    }
  }, [refreshNotificationStatus]);

  const enableLocationPermission = useCallback(async () => {
    try {
      setLocActionLoading(true);
      const current = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (current?.status === "granted") {
        await refreshLocationStatus();
        return;
      }

      if (current?.canAskAgain === false) {
        await openSettings();
        return;
      }

      const accepted = await askPermission({
        title: "Activar ubicación",
        body: "Necesitamos tu ubicación para mostrar el mapa y permitir dibujar o medir tus lotes.",
        acceptText: "Habilitar",
        cancelText: "Ahora no",
      });
      if (!accepted) return;

      await Location.requestForegroundPermissionsAsync();
    } catch {}
    finally {
      setLocActionLoading(false);
      refreshLocationStatus();
    }
  }, [askPermission, openSettings, refreshLocationStatus]);

  const accountName = (user?.displayName || "-").toString();
  const accountEmail = (user?.email || "-").toString();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <PermissionPrompt />
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backBtn, { top: backBtnTop }]}
            onPress={() => {
              try {
                navigation.goBack();
              } catch {}
            }}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configuración</Text>
          <Text style={styles.headerSubtitle}>Gestioná permisos y preferencias de la app</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notificaciones</Text>
          <View style={styles.box}>
            <Text style={styles.row}>
              Estado: <Text style={styles.value}>{notifLoading ? "Consultando…" : notifLabel}</Text>
            </Text>
            {notifStatus === "unsupported_expo_go" ? (
              <Text style={styles.hint}>No disponible en esta versión.</Text>
            ) : notifStatus === "granted" ? (
              <Text style={styles.hint}>Recibirás avisos y recordatorios importantes.</Text>
            ) : notifCanAskAgain === false ? (
              <>
                <Text style={styles.hint}>El permiso está bloqueado. Activá notificaciones desde la configuración del sistema.</Text>
                <TouchableOpacity style={[styles.btnFull, styles.btnSecondary]} onPress={openSettings} disabled={notifActionLoading}>
                  <Text style={styles.btnSecondaryText}>Abrir configuración</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.btnFull, styles.btnPrimary, notifActionLoading ? styles.btnDisabled : null]} onPress={enableNotifications} disabled={notifActionLoading}>
                <Text style={styles.btnPrimaryText}>{notifActionLoading ? "Activando…" : "Activar notificaciones"}</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionTitle}>Ubicación</Text>
          <View style={styles.box}>
            <Text style={styles.row}>
              Estado: <Text style={styles.value}>{locLoading ? "Consultando…" : locLabel}</Text>
            </Text>

            {locStatus === "granted" ? (
              locServicesEnabled === false ? (
                <>
                  <Text style={styles.hint}>El permiso está concedido, pero el GPS está apagado.</Text>
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.btnHalf, styles.btnSecondary]} onPress={refreshLocationStatus} disabled={locActionLoading}>
                      <Text style={styles.btnSecondaryText}>Reintentar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnHalf, styles.btnPrimary]} onPress={openSettings} disabled={locActionLoading}>
                      <Text style={styles.btnPrimaryText}>Abrir configuración</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={styles.hint}>La ubicación está lista para el mapa y el modo GPS.</Text>
              )
            ) : locCanAskAgain === false ? (
              <>
                <Text style={styles.hint}>El permiso está bloqueado. Habilitá ubicación desde la configuración del sistema.</Text>
                <TouchableOpacity style={[styles.btnFull, styles.btnSecondary]} onPress={openSettings} disabled={locActionLoading}>
                  <Text style={styles.btnSecondaryText}>Abrir configuración</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.btnFull, styles.btnPrimary, locActionLoading ? styles.btnDisabled : null]} onPress={enableLocationPermission} disabled={locActionLoading}>
                <Text style={styles.btnPrimaryText}>{locActionLoading ? "Solicitando…" : "Activar ubicación"}</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionTitle}>Cuenta</Text>
          <View style={styles.box}>
            <Text style={styles.row}>
              Nombre: <Text style={styles.value}>{accountName}</Text>
            </Text>
            <Text style={styles.row}>
              Email: <Text style={styles.value}>{accountEmail}</Text>
            </Text>
            <TouchableOpacity style={[styles.btnFull, styles.btnDanger]} onPress={confirmLogout}>
              <Text style={styles.btnPrimaryText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Información</Text>
          <View style={styles.box}>
            <Text style={styles.row}>
              Versión: <Text style={styles.value}>v1.0</Text>
            </Text>
            <Text style={styles.hint}>Sistema de gestión de lotes</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  header: { marginTop: 4, marginHorizontal: 2, marginBottom: 10, alignItems: "center" },
  backBtn: { position: "absolute", left: 0, width: 36, height: 36, borderRadius: 12, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(15,23,42,0.10)", alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 18, color: "#1e8449", fontWeight: "800" },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#1e8449", textAlign: "center" },
  headerSubtitle: { marginTop: 4, fontSize: 13, color: "#6b7280", textAlign: "center" },
  card: { backgroundColor: "#ffffff", borderRadius: 16, padding: 18, marginTop: 8, borderWidth: 1, borderColor: "rgba(15,23,42,0.10)", shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  sectionTitle: { marginTop: 10, fontSize: 15, fontWeight: "800", color: "#1e8449" },
  box: { marginTop: 8, backgroundColor: "#f8f9fa", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  row: { fontSize: 14, color: "#34495e", marginBottom: 6 },
  value: { fontWeight: "800", color: "#111827" },
  hint: { marginTop: 4, fontSize: 13, color: "#6b7280" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnFull: { marginTop: 10, minHeight: 42, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnHalf: { flex: 1, minHeight: 42, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#16a34a" },
  btnSecondary: { backgroundColor: "#e5e7eb" },
  btnDanger: { backgroundColor: "#c0392b" },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
  btnSecondaryText: { color: "#111827", fontWeight: "800" },
});
