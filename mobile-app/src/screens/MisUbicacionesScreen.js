// src/screens/MisUbicacionesScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../services/firebase';
import { API_URL } from '../utils/constants';

const UBIC_TYPES = [
  { key: 'entradaDomicilio', label: 'Entrada del domicilio' },
  { key: 'domicilioCasa', label: 'Domicilio / Casa' },
  { key: 'entradaCampo', label: 'Entrada al campo' },
  { key: 'centroCampo', label: 'Centro del campo' },
];

export default function MisUbicacionesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [productor, setProductor] = useState(null);

  const loadProductor = async () => {
    try {
      setLoading(true);
      setError('');
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      if (!ipt) throw new Error('No se encontró IPT');
      const resp = await fetch(`${API_URL}/productores/ipt/${ipt}`);
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || 'No se pudo cargar el productor');
      }
      const j = await resp.json();
      setProductor(j);
    } catch (e) {
      setError(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProductor(); }, []);
  useEffect(() => { const unsub = navigation.addListener('focus', loadProductor); return unsub; }, [navigation]);

  const goEdit = (type) => {
    navigation.navigate('EditarUbicacion', { tipo: type, productor });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Text style={styles.title}>Mis Ubicaciones</Text>
        <ActivityIndicator color="#2ecc71" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Text style={styles.title}>Mis Ubicaciones</Text>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  const ubic = productor?.ubicaciones || {};

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <Text style={styles.title}>Mis Ubicaciones</Text>
      <View style={styles.list}>
        {UBIC_TYPES.map(({ key, label }) => {
          const item = ubic?.[key];
          const active = item?.activo !== false && item?.lat != null && item?.lng != null;
          return (
            <TouchableOpacity key={key} style={styles.card} onPress={() => goEdit(key)}>
              <Text style={styles.cardTitle}>{label}</Text>
              <Text style={styles.cardSub}>{active ? `Lat: ${item.lat.toFixed(6)}  Lng: ${item.lng.toFixed(6)}` : 'Sin coordenadas'}</Text>
              <Text style={[styles.badge, { backgroundColor: active ? '#2ecc71' : '#95a5a6' }]}>{active ? 'Activo' : 'Inactivo'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1e8449', textAlign: 'center', marginBottom: 12 },
  list: { gap: 12 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, elevation: 2 },
  cardTitle: { fontSize: 16, color: '#34495e', fontWeight: '600' },
  cardSub: { fontSize: 14, color: '#7f8c8d', marginTop: 6 },
  badge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, color: '#fff', overflow: 'hidden' },
  error: { color: '#c0392b', textAlign: 'center' },
});