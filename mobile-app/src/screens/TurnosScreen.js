import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { auth } from "../services/firebase";
import { API_URL } from "../utils/constants";

export default function TurnosScreen() {
  const [fecha, setFecha] = useState("");
  const [tipo, setTipo] = useState("");
  const [disp, setDisp] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadList = async () => {
    try {
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      if (!ipt) return;
      const resp = await fetch(`${API_URL}/turnos/productor/${ipt}`);
      const j = await resp.json();
      setList(Array.isArray(j) ? j : []);
    } catch {}
  };

  useEffect(() => { loadList(); }, []);

  const checkDisponibilidad = async () => {
    setError("");
    setDisp(null);
    if (!fecha || !tipo) { setError("Completá fecha y tipo"); return; }
    try {
      const resp = await fetch(`${API_URL}/turnos/disponibilidad?fechaSolicitada=${encodeURIComponent(fecha)}&tipoTurno=${encodeURIComponent(tipo)}`);
      const j = await resp.json();
      setDisp(Boolean(j?.disponible));
    } catch { setError("No se pudo verificar disponibilidad"); }
  };

  const solicitarTurno = async () => {
    setError("");
    setLoading(true);
    try {
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      const body = { ipt, fechaSolicitada: fecha, tipoTurno: tipo };
      const resp = await fetch(`${API_URL}/turnos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.message || "No se pudo solicitar turno");
      }
      setFecha("");
      setTipo("");
      setDisp(null);
      await loadList();
    } catch (e) { setError(e.message || "Error"); } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Turnos</Text>
      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Fecha (YYYY-MM-DD)" value={fecha} onChangeText={setFecha} />
        <TextInput style={styles.input} placeholder="Tipo de turno" value={tipo} onChangeText={setTipo} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={checkDisponibilidad}><Text style={styles.btnText}>Ver disponibilidad</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={solicitarTurno} disabled={loading}><Text style={styles.btnText}>{loading ? "Solicitando..." : "Solicitar"}</Text></TouchableOpacity>
        </View>
        {disp !== null && <Text style={{ marginTop: 8 }}>Disponibilidad: {disp ? "Sí" : "No"}</Text>}
      </View>

      <View style={{ padding: 8 }}>
        <Text style={{ fontWeight: "bold", marginBottom: 6 }}>Mis turnos</Text>
        <FlatList data={list} keyExtractor={(item) => item.id} renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemText}>Fecha: {item.fechaTurno}</Text>
            <Text style={styles.itemText}>Tipo: {item.tipoTurno}</Text>
            <Text style={styles.itemText}>Estado: {item.estado}</Text>
            <Text style={styles.itemText}>Motivo: {item.motivo || '-'}</Text>
          </View>
        )} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#fff" },
  title: { fontSize: 20, textAlign: "center", marginVertical: 10 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12 },
  input: { borderWidth: 1.5, borderColor: "#95a5a6", backgroundColor: "#fdfefe", padding: 12, borderRadius: 10, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8 },
  btn: { backgroundColor: "#1e8449", padding: 10, borderRadius: 8 },
  btnText: { color: "#fff" },
  error: { color: "#c0392b", textAlign: "center", marginBottom: 8 },
  item: { padding: 8, backgroundColor: "#ffffff", borderRadius: 8, marginBottom: 6 },
  itemText: { color: "#34495e" },
});