import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "../utils/constants";
import { authFetch, getCurrentAuthContext } from "../api/api";

const UBIC_TYPES = [
  { key: "entradaDomicilio", label: "Entrada domicilio" },
  { key: "domicilioCasa", label: "Domicilio (Casa)" },
  { key: "entradaCampo", label: "Entrada campo" },
  { key: "centroCampo", label: "Centro campo" },
];

const normalizeCampos = (productor) => {
  const rawCampos = Array.isArray(productor?.campos) ? productor.campos : [];
  if (rawCampos.length > 0) {
    const campos = rawCampos
      .map((c, i) => ({
        id: c?.id ? String(c.id) : `campo_${i + 1}`,
        nombre: (c?.nombre ? String(c.nombre) : "").trim() || `Campo ${i + 1}`,
        ubicaciones: c?.ubicaciones && typeof c.ubicaciones === "object" ? c.ubicaciones : {},
      }))
      .filter((c) => c.id);
    return campos.length > 0 ? campos : [{ id: "principal", nombre: "Campo principal", ubicaciones: productor?.ubicaciones || {} }];
  }
  return [{ id: "principal", nombre: "Campo principal", ubicaciones: productor?.ubicaciones || {} }];
};

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

  const campos = normalizeCampos(data);

  const renderUbicaciones = (ubicaciones) => (
    <View style={styles.ubicacionesContainer}>
      {UBIC_TYPES.map(({ key, label }, idx) => {
        const item = ubicaciones?.[key];
        const hasCoords = item?.lat != null && item?.lng != null;
        return (
          <View key={key}>
            <View style={styles.ubicacionItem}>
              <Text style={styles.ubicacionLabel}>{label}</Text>
              <Text style={styles.ubicacionCoords}>
                {hasCoords ? `Lat: ${Number(item.lat).toFixed(6)}  Lng: ${Number(item.lng).toFixed(6)}` : "-"}
              </Text>
            </View>
            {idx < UBIC_TYPES.length - 1 ? <View style={styles.separator} /> : null}
          </View>
        );
      })}
    </View>
  );

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

          <View style={styles.camposContainer}>
            {campos.map((c, idx) => (
              <View key={c.id} style={[styles.campoBlock, idx > 0 ? styles.campoBlockSpacing : null]}>
                <View style={styles.campoHeader}>
                  <Text style={styles.campoTitle}>{c.nombre}</Text>
                </View>
                {renderUbicaciones(c.ubicaciones)}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", color: "#1e8449", marginBottom: 20, textAlign: "center" },
  card: { backgroundColor: "#ffffff", borderRadius: 16, padding: 18, marginTop: 10, borderWidth: 1, borderColor: "rgba(15,23,42,0.10)", shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  item: { fontSize: 16, marginBottom: 6, color: "#34495e" },
  section: { marginTop: 10, fontWeight: "bold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: "#c0392b" },
  camposContainer: { marginTop: 12 },
  campoBlock: {},
  campoBlockSpacing: { marginTop: 14 },
  campoHeader: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#ecfdf5", borderRadius: 10, borderWidth: 1, borderColor: "#d1fae5" },
  campoTitle: { color: "#1e8449", fontWeight: "800", textAlign: "center" },
  ubicacionesContainer: { marginTop: 12, backgroundColor: "#f8f9fa", borderRadius: 8, padding: 12 },
  ubicacionItem: { alignItems: "center", paddingVertical: 8 },
  ubicacionLabel: { fontSize: 14, fontWeight: "600", color: "#1e8449", marginBottom: 4 },
  ubicacionCoords: { fontSize: 13, color: "#7f8c8d", textAlign: "center" },
  separator: { height: 1, backgroundColor: "#e0e0e0", marginVertical: 8 },
});
