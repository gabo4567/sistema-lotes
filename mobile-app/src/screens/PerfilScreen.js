import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "../utils/constants";
import { authFetch, getCurrentAuthContext } from "../api/api";

export default function PerfilScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { ipt } = await getCurrentAuthContext();
        if (!ipt) throw new Error("No se encontró IPT en el token");
        const resp = await authFetch(`${API_URL}/productores/ipt/${ipt}`);
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          throw new Error(j?.error || "No se pudo obtener el perfil");
        }
        const j = await resp.json();
        if (mounted) setData(j);
      } catch (e) {
        if (mounted) setError(e.message || "Error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ marginTop: 8, color: '#1e8449' }}>Cargando perfil…</Text>
        <ActivityIndicator color="#1e8449" style={{ marginTop: 8 }} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}>
        <Text style={styles.title}>Mi Perfil</Text>
        <View style={styles.card}>
          <Text style={styles.item}>Número de IPT: {data?.ipt}</Text>
          <Text style={styles.item}>Nombre: {data?.nombreCompleto}</Text>
          <Text style={styles.item}>CUIL: {data?.cuil}</Text>
          <Text style={styles.item}>Email: {data?.email || "-"}</Text>
          <Text style={styles.item}>Teléfono: {data?.telefono || "-"}</Text>
          <Text style={styles.item}>Domicilio: {data?.domicilioCasa || "-"}</Text>
          <Text style={styles.item}>Plantas/ha: {data?.plantasPorHa ?? "-"}</Text>
          <Text style={styles.item}>Estado: {data?.estado}</Text>
          <Text style={styles.item}>Ingresos app: {data?.historialIngresos ?? 0}</Text>
          
          <Text style={[styles.item, styles.section]}>Ubicaciones (solo lectura):</Text>
          
          <View style={styles.ubicacionesContainer}>
            <View style={styles.ubicacionItem}>
              <Text style={styles.ubicacionLabel}>Entrada domicilio</Text>
              <Text style={styles.ubicacionCoords}>
                {data?.ubicaciones?.entradaDomicilio?.lat != null ? `Lat: ${data.ubicaciones.entradaDomicilio.lat.toFixed(6)}  Lng: ${data.ubicaciones.entradaDomicilio.lng.toFixed(6)}` : '-'}
              </Text>
            </View>
            <View style={styles.separator} />
            
            <View style={styles.ubicacionItem}>
              <Text style={styles.ubicacionLabel}>Domicilio (Casa)</Text>
              <Text style={styles.ubicacionCoords}>
                {data?.ubicaciones?.domicilioCasa?.lat != null ? `Lat: ${data.ubicaciones.domicilioCasa.lat.toFixed(6)}  Lng: ${data.ubicaciones.domicilioCasa.lng.toFixed(6)}` : '-'}
              </Text>
            </View>
            <View style={styles.separator} />
            
            <View style={styles.ubicacionItem}>
              <Text style={styles.ubicacionLabel}>Entrada campo</Text>
              <Text style={styles.ubicacionCoords}>
                {data?.ubicaciones?.entradaCampo?.lat != null ? `Lat: ${data.ubicaciones.entradaCampo.lat.toFixed(6)}  Lng: ${data.ubicaciones.entradaCampo.lng.toFixed(6)}` : '-'}
              </Text>
            </View>
            <View style={styles.separator} />
            
            <View style={styles.ubicacionItem}>
              <Text style={styles.ubicacionLabel}>Centro campo</Text>
              <Text style={styles.ubicacionCoords}>
                {data?.ubicaciones?.centroCampo?.lat != null ? `Lat: ${data.ubicaciones.centroCampo.lat.toFixed(6)}  Lng: ${data.ubicaciones.centroCampo.lng.toFixed(6)}` : '-'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", color: "#1e8449", marginBottom: 20, textAlign: "center" },
  card: { backgroundColor: "#ffffff", borderRadius: 12, padding: 16, elevation: 2, marginTop: 10 },
  item: { fontSize: 16, marginBottom: 6, color: "#34495e" },
  section: { marginTop: 10, fontWeight: "bold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: "#c0392b" },
  ubicacionesContainer: { marginTop: 12, backgroundColor: "#f8f9fa", borderRadius: 8, padding: 12 },
  ubicacionItem: { alignItems: "center", paddingVertical: 8 },
  ubicacionLabel: { fontSize: 14, fontWeight: "600", color: "#1e8449", marginBottom: 4 },
  ubicacionCoords: { fontSize: 13, color: "#7f8c8d", textAlign: "center" },
  separator: { height: 1, backgroundColor: "#e0e0e0", marginVertical: 8 },
});