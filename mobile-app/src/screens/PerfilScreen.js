import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { auth } from "../services/firebase";
import { API_URL } from "../utils/constants";

export default function PerfilScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken(true);
        const tokenResult = await auth.currentUser?.getIdTokenResult();
        const ipt = tokenResult?.claims?.ipt;
        if (!ipt) throw new Error("No se encontró IPT en el token");
        const resp = await fetch(`${API_URL}/productores/ipt/${ipt}`);
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
        <ActivityIndicator color="#2ecc71" />
        <Text style={{ marginTop: 8 }}>Cargando perfil…</Text>
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
    <View style={styles.container}>
      <Text style={styles.title}>Mi Perfil</Text>
      <View style={styles.card}>
        <Text style={styles.item}>IPT: {data?.ipt}</Text>
        <Text style={styles.item}>Nombre: {data?.nombreCompleto}</Text>
        <Text style={styles.item}>CUIL: {data?.cuil}</Text>
        <Text style={styles.item}>Email: {data?.email || "-"}</Text>
        <Text style={styles.item}>Teléfono: {data?.telefono || "-"}</Text>
        <Text style={styles.item}>Domicilio: {data?.domicilioCasa || "-"}</Text>
        <Text style={styles.item}>Plantas/ha: {data?.plantasPorHa ?? "-"}</Text>
        <Text style={styles.item}>Estado: {data?.estado}</Text>
        <Text style={styles.item}>Ingresos app: {data?.historialIngresos ?? 0}</Text>
        <Text style={[styles.item, styles.section]}>Ubicaciones (solo lectura)</Text>
        <Text style={styles.item}>Entrada domicilio: {data?.ubicaciones?.entradaDomicilio?.lat != null ? `${data.ubicaciones.entradaDomicilio.lat.toFixed(6)}, ${data.ubicaciones.entradaDomicilio.lng.toFixed(6)}` : '-'}</Text>
        <Text style={styles.item}>Domicilio/Casa: {data?.ubicaciones?.domicilioCasa?.lat != null ? `${data.ubicaciones.domicilioCasa.lat.toFixed(6)}, ${data.ubicaciones.domicilioCasa.lng.toFixed(6)}` : '-'}</Text>
        <Text style={styles.item}>Entrada campo: {data?.ubicaciones?.entradaCampo?.lat != null ? `${data.ubicaciones.entradaCampo.lat.toFixed(6)}, ${data.ubicaciones.entradaCampo.lng.toFixed(6)}` : '-'}</Text>
        <Text style={styles.item}>Centro campo: {data?.ubicaciones?.centroCampo?.lat != null ? `${data.ubicaciones.centroCampo.lat.toFixed(6)}, ${data.ubicaciones.centroCampo.lng.toFixed(6)}` : '-'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", color: "#1e8449", marginBottom: 12, textAlign: "center" },
  card: { backgroundColor: "#ffffff", borderRadius: 12, padding: 16, elevation: 2 },
  item: { fontSize: 16, marginBottom: 6, color: "#34495e" },
  section: { marginTop: 10, fontWeight: "bold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: "#c0392b" },
});