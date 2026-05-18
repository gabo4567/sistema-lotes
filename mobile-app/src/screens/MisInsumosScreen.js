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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "../utils/constants";
import { authFetch, getCurrentAuthContext } from "../api/api";

const CATEGORIAS = ["Arada", "Almácigo", "Transplante", "Cosecha"];

const normalizeKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatCantidad = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("es-AR").format(n);
};

const getOrderedInsumos = (porCategoria = {}) => {
  const entries = Object.entries(porCategoria || {}).filter(([, value]) => value && typeof value === "object");
  const used = new Set();
  const ordered = [];

  for (const categoria of CATEGORIAS) {
    const found = entries.find(([key]) => normalizeKey(key) === normalizeKey(categoria));
    if (found) {
      used.add(found[0]);
      ordered.push(found);
    }
  }

  entries
    .filter(([key]) => !used.has(key))
    .sort(([a], [b]) => String(a).localeCompare(String(b), "es"))
    .forEach((entry) => ordered.push(entry));

  return ordered;
};

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
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const { ipt } = await getCurrentAuthContext();
      if (!ipt) throw new Error("No se pudo identificar el IPT del productor");
      const resp = await authFetch(`${API_URL}/insumos/productor/${ipt}/disponibilidad`);
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
  const insumosCargados = getOrderedInsumos(porCategoria);
  const totalAsignado = Number(data?.totalAsignado || 0);
  const totalEntregado = Number(data?.totalEntregado || 0);
  const totalDisponible = Number(data?.totalDisponible || 0);
  const tieneDisponible = totalDisponible > 0;
  const primeraCategoriaDisponible = insumosCargados.find(([, item]) => Number(item?.disponible || 0) > 0)?.[0] || "";
  const categoriaParaTurno = CATEGORIAS.find((cat) => normalizeKey(cat) === normalizeKey(primeraCategoriaDisponible)) || "";

  const goSolicitarTurno = () => {
    navigation.navigate("Turnos", {
      presetTipo: "insumo",
      categoriaInsumo: categoriaParaTurno,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Insumos</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Cargando insumos…</Text>
          <ActivityIndicator color="#1e8449" style={styles.loadingSpinner} />
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
              <Text style={styles.bannerValue}>{formatCantidad(totalAsignado)}</Text>
              <Text style={styles.bannerLabel}>Asignado</Text>
            </View>
            <View style={styles.bannerDivider} />
            <View style={styles.bannerItem}>
              <Text style={styles.bannerValue}>{formatCantidad(totalEntregado)}</Text>
              <Text style={styles.bannerLabel}>Entregado</Text>
            </View>
            <View style={styles.bannerDivider} />
            <View style={styles.bannerItem}>
              <Text style={[styles.bannerValue, { color: tieneDisponible ? "#16a34a" : "#6b7280" }]}>
                {formatCantidad(totalDisponible)}
              </Text>
              <Text style={styles.bannerLabel}>Disponible</Text>
            </View>
          </View>

          <Text style={styles.summaryHint}>
            Estos son los insumos registrados por el IPT para tu cuenta.
          </Text>

          {tieneDisponible ? (
            <View style={styles.availableNotice}>
              <Text style={styles.availableTitle}>Tenés insumos disponibles para retirar.</Text>
              <Text style={styles.availableText}>
                Podés solicitar un turno de retiro desde la sección Turnos.
              </Text>
              <TouchableOpacity style={styles.turnoBtn} onPress={goSolicitarTurno}>
                <Text style={styles.turnoBtnText}>Solicitar turno de retiro</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Tarjetas por categoría */}
          {insumosCargados.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Todavía no tenés insumos disponibles.</Text>
              <Text style={styles.emptyText}>
                Cuando el IPT registre una asignación para tu cuenta, la vas a ver acá.
              </Text>
            </View>
          ) : (
            insumosCargados.map(([cat, v]) => {
              const disponible = v.disponible ?? 0;
              const asignado = v.asignado ?? 0;
              const entregado = v.entregado ?? 0;
              return (
                <View key={cat} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{cat}</Text>
                    <View style={[styles.badge, disponible > 0 ? styles.badgeGreen : styles.badgeGray]}>
                      <Text
                        style={[styles.badgeText, disponible > 0 ? styles.badgeTextGreen : styles.badgeTextGray]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
                        {disponible > 0 ? `${formatCantidad(disponible)} disponible` : "Sin disponible"}
                      </Text>
                    </View>
                  </View>
                  <ProgressBar value={entregado} total={asignado} />
                  <View style={styles.cardRow}>
                    <View style={styles.cardStatBlock}>
                      <Text style={styles.cardStatLabel}>Asignado</Text>
                      <Text style={styles.cardStatValue}>{formatCantidad(asignado)}</Text>
                    </View>
                    <View style={styles.cardStatBlock}>
                      <Text style={styles.cardStatLabel}>Entregado</Text>
                      <Text style={styles.cardStatValue}>{formatCantidad(entregado)}</Text>
                    </View>
                    <View style={styles.cardStatBlock}>
                      <Text style={styles.cardStatLabel}>Disponible</Text>
                      <Text style={[styles.cardStatValue, { color: disponible > 0 ? "#16a34a" : "#6b7280" }]}>
                        {formatCantidad(disponible)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  title: { fontSize: 22, fontWeight: "bold", color: "#1e8449", textAlign: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { color: "#1e8449", fontSize: 14 },
  loadingSpinner: { marginTop: 8 },
  errorText: { color: "#b91c1c", fontSize: 14, textAlign: "center", marginBottom: 12 },
  retryBtn: { backgroundColor: "#22c55e", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 40 },
  banner: { flexDirection: "row", backgroundColor: "#ffffff", borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  bannerItem: { flex: 1, alignItems: "center" },
  bannerValue: { fontSize: 22, fontWeight: "700", color: "#111827" },
  bannerLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  bannerDivider: { width: 1, backgroundColor: "#e5e7eb", marginHorizontal: 4 },
  summaryHint: { color: "#6b7280", fontSize: 13, lineHeight: 18, marginBottom: 12 },
  availableNotice: {
    backgroundColor: "#ecfdf5",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  availableTitle: { color: "#166534", fontSize: 15, fontWeight: "800", marginBottom: 4 },
  availableText: { color: "#345044", fontSize: 13, lineHeight: 18 },
  turnoBtn: {
    marginTop: 12,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  turnoBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 14 },
  emptyCard: { backgroundColor: "#ffffff", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyTitle: { color: "#111827", fontSize: 15, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  emptyText: { color: "#6b7280", fontSize: 14, textAlign: "center", lineHeight: 19 },
  card: { backgroundColor: "#ffffff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  cardTitle: { flex: 1, flexShrink: 1, fontSize: 16, fontWeight: "700", color: "#111827", lineHeight: 21 },
  badge: {
    flexShrink: 0,
    minWidth: 82,
    maxWidth: 112,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
  },
  badgeGreen: { backgroundColor: "#dcfce7" },
  badgeGray: { backgroundColor: "#f3f4f6" },
  badgeText: { fontSize: 11, fontWeight: "700", textAlign: "center", lineHeight: 13 },
  badgeTextGreen: { color: "#166534" },
  badgeTextGray: { color: "#6b7280" },
  progressTrack: { flexDirection: "row", height: 6, borderRadius: 99, backgroundColor: "#e5e7eb", overflow: "hidden", marginBottom: 10 },
  progressFill: { borderRadius: 99 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cardStatBlock: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  cardStatLabel: { fontSize: 11, color: "#6b7280", marginBottom: 3 },
  cardStatValue: { fontWeight: "800", color: "#111827", fontSize: 14 },
});
