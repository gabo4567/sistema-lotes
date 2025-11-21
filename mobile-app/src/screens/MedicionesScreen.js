import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from "react-native";
import { auth } from "../services/firebase";
import { API_URL } from "../utils/constants";

export default function MedicionesScreen() {
  const [items, setItems] = useState([]);
  const [tipo, setTipo] = useState("");
  const [lote, setLote] = useState("");

  const load = async () => {
    try {
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      const params = new URLSearchParams();
      if (ipt) params.append("productor", ipt);
      if (tipo) params.append("tipo", tipo);
      if (lote) params.append("lote", lote);
      const resp = await fetch(`${API_URL}/mediciones?${params.toString()}`);
      const j = await resp.json();
      setItems(Array.isArray(j) ? j : []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Mediciones</Text>
      <View style={styles.row}>
        <TextInput style={styles.input} placeholder="Tipo" value={tipo} onChangeText={setTipo} />
        <TextInput style={styles.input} placeholder="Lote" value={lote} onChangeText={setLote} />
        <TouchableOpacity style={styles.btn} onPress={load}><Text style={styles.btnText}>Filtrar</Text></TouchableOpacity>
      </View>
      <FlatList data={items} keyExtractor={(item)=>item.id} renderItem={({item}) => (
        <View style={styles.item}>
          <Text style={styles.itemText}>Fecha: {item.fecha}</Text>
          <Text style={styles.itemText}>Tipo: {item.tipo}</Text>
          <Text style={styles.itemText}>Valor: {item.valorNumerico ?? '-'}</Text>
          <Text style={styles.itemText}>Técnico: {item.tecnicoResponsable || '-'}</Text>
        </View>
      )} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#fff" },
  title: { fontSize: 20, textAlign: "center", marginVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  input: { flex: 1, borderWidth: 1.5, borderColor: "#95a5a6", backgroundColor: "#fdfefe", padding: 10, borderRadius: 8 },
  btn: { backgroundColor: "#1e8449", padding: 10, borderRadius: 8 },
  btnText: { color: "#fff" },
  item: { padding: 8, backgroundColor: "#ffffff", borderRadius: 8, marginBottom: 6 },
  itemText: { color: "#34495e" },
});