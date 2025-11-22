// mobile-app/src/screens/TurnosScreen.js

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../services/firebase";
import { API_URL } from "../utils/constants";

export default function TurnosScreen() {
  const [fechaInput, setFechaInput] = useState("");
  const [tipo, setTipo] = useState("");
  const [mostrarTipos, setMostrarTipos] = useState(false);
  const tipoOptions = ["Insumo", "Carnet de renovación", "Otra"];
  const [disp, setDisp] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [motivo, setMotivo] = useState("");
  const [view, setView] = useState("list");
  const insets = useSafeAreaInsets();

  const loadList = async () => {
    try {
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const uid = auth.currentUser?.uid;
      const idToken = await auth.currentUser?.getIdToken();
      
      if (!uid || !idToken) return;
      
      const resp = await fetch(`${API_URL}/turnos/productor/${uid}`, {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const j = await resp.json();
      setList(Array.isArray(j) ? j : []);
    } catch {}
  };

  useEffect(() => { loadList(); }, []);

  const toIso = (s) => {
    const m = String(s).trim().match(/^([0-3][0-9])[-/]([0-1][0-9])[-/](\d{4})$/);
    if (!m) return null;
    const dd = m[1], mm = m[2], yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  };

  const checkDisponibilidad = async () => {
    setError("");
    setDisp(null);
    if (!fechaInput || !tipo) { setError("Completá fecha (DD-MM-YYYY) y tipo"); return; }
    const fechaIso = toIso(fechaInput);
    if (!fechaIso) { setError("Fecha inválida. Formato DD-MM-YYYY"); return; }
    try {
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      const tipoParam = tipo.toLowerCase().includes('insumo') ? 'Insumo' : tipo.toLowerCase().includes('renov') ? 'Carnet de renovación' : 'Otra';
      const query = `fechaSolicitada=${encodeURIComponent(fechaIso)}&tipoTurno=${encodeURIComponent(tipoParam)}` + (tipoParam === 'Insumo' && ipt ? `&ipt=${encodeURIComponent(ipt)}` : "");
      console.log("🔍 Verificando disponibilidad para:", { fechaIso, tipo: tipoParam, ipt });
      const resp = await fetch(`${API_URL}/turnos/disponibilidad?${query}`);
      const j = await resp.json();
      console.log("📡 Respuesta del backend:", j);
      const ok = Boolean(j?.disponible);
      console.log("✅ Disponible:", ok);
      setDisp(ok);
      if (!ok) setError(j?.reason || "No disponible");
    } catch (e) { 
      console.error("❌ Error verificando disponibilidad:", e);
      setError("No se pudo verificar disponibilidad"); 
    }
  };

  const solicitarTurno = async () => {
    setError("");
    setLoading(true);
    try {
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      const idToken = await auth.currentUser?.getIdToken();
      
      if (!idToken) throw new Error("No estás autenticado");
      
      const fechaIso = toIso(fechaInput);
      if (!fechaIso) throw new Error("Fecha inválida. Formato DD-MM-YYYY");
      const body = { ipt, fechaSolicitada: fechaIso, tipoTurno: tipo, ...(motivo ? { motivo } : {}) };
      console.log("📝 Solicitando turno con body:", body);
      console.log("🔑 Token de autenticación:", idToken.substring(0, 20) + "...");
      
      const resp = await fetch(`${API_URL}/turnos`, { 
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        }, 
        body: JSON.stringify(body) 
      });
      console.log("📡 Respuesta de solicitud:", resp.status, resp.statusText);
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        console.log("❌ Error en respuesta:", j);
        throw new Error(j?.message || "No se pudo solicitar turno");
      }
      const responseData = await resp.json();
      console.log("✅ Turno creado exitosamente:", responseData);
      setFechaInput("");
      setTipo("");
      setDisp(null);
      setMotivo("");
      await loadList();
      setView('list');
    } catch (e) { 
      console.error("❌ Error solicitando turno:", e);
      setError(e.message || "Error"); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <Text style={styles.title}>Turnos</Text>
      <View style={styles.topBar}>
        <View style={styles.cardBar}>
          <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => setView('form')}>
            <Text style={styles.btnText}>Solicitar Turno</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => setView('list')}>
            <Text style={styles.btnText}>Ver Mis Turnos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {view === 'form' && (
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <TextInput style={styles.input} placeholder="Fecha (DD-MM-YYYY)" value={fechaInput} onChangeText={setFechaInput} />
          <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setMostrarTipos(!mostrarTipos)}>
            <Text style={{ color: tipo ? '#2c3e50' : '#95a5a6' }}>{tipo || 'Tipo de turno'}</Text>
          </TouchableOpacity>
          {mostrarTipos && (
            <View style={styles.dropdown}>
              {tipoOptions.map(opt => (
                <TouchableOpacity key={opt} style={styles.option} onPress={() => { setTipo(opt); setMostrarTipos(false); }}>
                  <Text>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TextInput style={styles.input} placeholder="Motivo (opcional)" value={motivo} onChangeText={setMotivo} multiline numberOfLines={3} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={[styles.row, { marginBottom: Math.max(insets.bottom, 24) }]}>
            <TouchableOpacity style={styles.btn} onPress={checkDisponibilidad}><Text style={styles.btnText}>Ver disponibilidad</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={solicitarTurno} disabled={loading || disp !== true}><Text style={styles.btnText}>{loading ? "Solicitando..." : "Solicitar"}</Text></TouchableOpacity>
          </View>
          {disp !== null && <Text style={{ marginTop: 8 }}>Disponibilidad: {disp ? "Sí" : "No"}</Text>}
        </View>
      )}

      {view === 'list' && (
        <View style={{ padding: 8 }}>
          <Text style={{ fontWeight: "bold", marginBottom: 6 }}>Mis turnos</Text>
          <FlatList 
            data={list} 
            keyExtractor={(item) => item.id} 
            renderItem={({ item }) => (
              <View style={styles.item}>
                <Text style={styles.itemText}>Fecha: {formatDDMMYYYY(item.fechaTurno)}</Text>
                <Text style={styles.itemText}>Tipo: {item.tipoTurno}</Text>
                <Text style={styles.itemText}>Estado: {item.estado}</Text>
                <Text style={styles.itemText}>Motivo: {item.motivo || '-'}</Text>
              </View>
            )} 
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#fff" },
  title: { fontSize: 20, textAlign: "center", marginVertical: 10 },
  topBar: { paddingHorizontal: 8, paddingTop: 4 },
  cardBar: { flexDirection: "row", gap: 12, backgroundColor: "#ffffff", padding: 10, borderRadius: 10, elevation: 3 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12 },
  input: { borderWidth: 1.5, borderColor: "#95a5a6", backgroundColor: "#fdfefe", padding: 12, borderRadius: 10, marginBottom: 12 },
  dropdown: { borderWidth: 1, borderColor: '#dfe6e9', borderRadius: 8, backgroundColor: '#ffffff', marginBottom: 12 },
  option: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#ecf0f1' },
  row: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8 },
  btn: { backgroundColor: "#1e8449", padding: 10, borderRadius: 8 },
  primary: { backgroundColor: "#2ecc71" },
  secondary: { backgroundColor: "#3498db" },
  btnText: { color: "#fff" },
  error: { color: "#c0392b", textAlign: "center", marginBottom: 8 },
  item: { padding: 8, backgroundColor: "#ffffff", borderRadius: 8, marginBottom: 6 },
  itemText: { color: "#34495e" },
});
  const formatDDMMYYYY = (isoOrDdmm) => {
    if (!isoOrDdmm) return "-";
    // if already dd-mm-yyyy
    const mdd = String(isoOrDdmm).match(/^([0-3][0-9])[-/]([0-1][0-9])[-/](\d{4})$/);
    if (mdd) return `${mdd[1]}-${mdd[2]}-${mdd[3]}`;
    const d = new Date(isoOrDdmm);
    if (isNaN(d.getTime())) return String(isoOrDdmm);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth()+1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };