import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { API_URL } from "../utils/constants";
import { authFetch, getCurrentAuthContext } from "../api/api";

const CATEGORIAS = ["Arada", "Almácigo", "Transplante", "Cosecha"];

const ProgressBar = ({ value, total }) => {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { flex: pct, backgroundColor: pct >= 1 ? "#16a34a" : "#22c55e" }]} />
      <View style={{ flex: Math.max(0, 1 - pct) }} />
    </View>
  );
};

export default function MisInsumosScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const { currentUser, tokenResult } = await getCurrentAuthContext();
      const productorId = tokenResult?.claims?.productorId || currentUser?.uid;
      if (!productorId) throw new Error("No se pudo identificar el productor");
      const resp = await authFetch(`${API_URL}/insumos/productor/${productorId}/disponibilidad`);
      if (!resp.ok) throw new Error("Error al obtener insumos");
      const json = await resp.json();
      setData(json);
    } catch (e) {
      setError(e?.message || "Error al cargar insumos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const porCategoria = data?.porCategoria || {};
  const categoriasCargadas = Object.keys(porCategoria);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis Insumos</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Cargando insumos…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchData(); }}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
        >
          {/* Banner resumen */}
          <View style={styles.banner}>
            <View style={styles.bannerItem}>
              <Text style={styles.bannerValue}>{data?.totalAsignado ?? 0}</Text>
              <Text style={styles.bannerLabel}>Asignado</Text>
            </View>
            <View style={styles.bannerDivider} />
            <View style={styles.bannerItem}>
              <Text style={styles.bannerValue}>{data?.totalEntregado ?? 0}</Text>
              <Text style={styles.bannerLabel}>Entregado</Text>
            </View>
            <View style={styles.bannerDivider} />
            <View style={styles.bannerItem}>
              <Text style={[styles.bannerValue, { color: (data?.totalDisponible ?? 0) > 0 ? "#16a34a" : "#6b7280" }]}>
                {data?.totalDisponible ?? 0}
              </Text>
              <Text style={styles.bannerLabel}>Disponible</Text>
            </View>
          </View>

          {/* Tarjetas por categoría */}
          {categoriasCargadas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No tenés insumos asignados.</Text>
            </View>
          ) : (
            CATEGORIAS.filter((c) => porCategoria[c]).map((cat) => {
              const v = porCategoria[cat];
              const disponible = v.disponible ?? 0;
              const asignado = v.asignado ?? 0;
              const entregado = v.entregado ?? 0;
              return (
                <View key={cat} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{cat}</Text>
                    <View style={[styles.badge, disponible > 0 ? styles.badgeGreen : styles.badgeGray]}>
                      <Text style={[styles.badgeText, disponible > 0 ? styles.badgeTextGreen : styles.badgeTextGray]}>
                        {disponible > 0 ? `${disponible} disponible` : "Entregado"}
                      </Text>
                    </View>
                  </View>
                  <ProgressBar value={entregado} total={asignado} />
                  <View style={styles.cardRow}>
                    <Text style={styles.cardStat}>Asig: <Text style={styles.cardStatValue}>{asignado}</Text></Text>
                    <Text style={styles.cardStat}>Ent: <Text style={styles.cardStatValue}>{entregado}</Text></Text>
                    <Text style={styles.cardStat}>Disp: <Text style={[styles.cardStatValue, { color: disponible > 0 ? "#16a34a" : "#6b7280" }]}>{disponible}</Text></Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { backgroundColor: "#ffffff", paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  backBtn: { marginBottom: 6 },
  backText: { fontSize: 14, color: "#16a34a", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 10, color: "#6b7280", fontSize: 14 },
  errorText: { color: "#b91c1c", fontSize: 14, textAlign: "center", marginBottom: 12 },
  retryBtn: { backgroundColor: "#22c55e", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 40 },
  banner: { flexDirection: "row", backgroundColor: "#ffffff", borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  bannerItem: { flex: 1, alignItems: "center" },
  bannerValue: { fontSize: 22, fontWeight: "700", color: "#111827" },
  bannerLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  bannerDivider: { width: 1, backgroundColor: "#e5e7eb", marginHorizontal: 4 },
  emptyCard: { backgroundColor: "#ffffff", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { color: "#6b7280", fontSize: 14 },
  card: { backgroundColor: "#ffffff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  badgeGreen: { backgroundColor: "#dcfce7" },
  badgeGray: { backgroundColor: "#f3f4f6" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeTextGreen: { color: "#166534" },
  badgeTextGray: { color: "#6b7280" },
  progressTrack: { flexDirection: "row", height: 6, borderRadius: 99, backgroundColor: "#e5e7eb", overflow: "hidden", marginBottom: 10 },
  progressFill: { borderRadius: 99 },
  cardRow: { flexDirection: "row", justifyContent: "space-between" },
  cardStat: { fontSize: 12, color: "#6b7280" },
  cardStatValue: { fontWeight: "700", color: "#111827" },
});
