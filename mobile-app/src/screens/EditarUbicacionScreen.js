// src/screens/EditarUbicacionScreen.js
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { auth } from '../services/firebase';
import { API_URL } from '../utils/constants';

const LABELS = {
  entradaDomicilio: 'Entrada del domicilio',
  domicilioCasa: 'Domicilio / Casa',
  entradaCampo: 'Entrada al campo',
  centroCampo: 'Centro del campo',
};

export default function EditarUbicacionScreen({ route, navigation }) {
  const { tipo, productor } = route.params || {};
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);
  const [marker, setMarker] = useState(null);
  const [saving, setSaving] = useState(false);

  const current = productor?.ubicaciones?.[tipo];

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos', 'Se necesita permiso de ubicación');
        return;
      }
      let initial = null;
      if (current?.lat != null && current?.lng != null) {
        initial = { latitude: current.lat, longitude: current.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        setMarker({ latitude: current.lat, longitude: current.lng });
      } else {
        const loc = await Location.getCurrentPositionAsync({});
        initial = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
      }
      setRegion(initial);
    })();
  }, []);

  const onMapPress = (e) => {
    const { coordinate } = e.nativeEvent;
    setMarker({ latitude: coordinate.latitude, longitude: coordinate.longitude });
  };

  const validateCoord = (pt) => pt && isFinite(pt.latitude) && isFinite(pt.longitude);

  const save = async () => {
    if (!validateCoord(marker)) { Alert.alert('Error', 'Coordenadas inválidas'); return; }
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const updated = {
        ...(productor?.ubicaciones || {}),
        [tipo]: { lat: marker.latitude, lng: marker.longitude, activo: true, updatedAt: new Date().toISOString() },
      };
      const resp = await fetch(`${API_URL}/productores/${productor.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ ubicaciones: updated }),
      });
      if (!resp.ok) throw new Error('No se pudo guardar');
      Alert.alert('OK', 'Ubicación guardada', [{ text: 'Volver', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar');
    } finally { setSaving(false); }
  };

  const softDelete = async () => {
    if (!current) { Alert.alert('Info', 'No hay ubicación para eliminar'); return; }
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const updated = {
        ...(productor?.ubicaciones || {}),
        [tipo]: { ...(productor?.ubicaciones?.[tipo] || {}), activo: false, updatedAt: new Date().toISOString() },
      };
      const resp = await fetch(`${API_URL}/productores/${productor.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ ubicaciones: updated }),
      });
      if (!resp.ok) throw new Error('No se pudo eliminar');
      Alert.alert('OK', 'Ubicación desactivada', [{ text: 'Volver', onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert('Error', e.message || 'No se pudo eliminar'); }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}> 
      <Text style={styles.title}>{LABELS[tipo] || 'Editar ubicación'}</Text>
      {region ? (
        <MapView style={[styles.map, { marginBottom: Math.max(insets.bottom, 16) }]} initialRegion={region} onPress={onMapPress} ref={mapRef}>
          {marker && (
            <Marker draggable coordinate={marker} onDragEnd={({ nativeEvent }) => setMarker(nativeEvent.coordinate)} />
          )}
        </MapView>
      ) : (
        <Text style={styles.info}>Cargando mapa…</Text>
      )}
      <View style={styles.panel}>
        <Text style={styles.info}>{marker ? `Lat: ${marker.latitude.toFixed(6)}  Lng: ${marker.longitude.toFixed(6)}` : 'Tocá el mapa para marcar'}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.primary]} onPress={save} disabled={saving || !marker}>
            <Text style={styles.btnText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => navigation.goBack()}>
            <Text style={styles.btnText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#c0392b' }]} onPress={softDelete}>
            <Text style={styles.btnText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 12 },
  title: { fontSize: 20, textAlign: 'center', marginBottom: 8, color: '#1e8449', fontWeight: 'bold' },
  map: { flex: 1 },
  panel: { backgroundColor: '#ffffff', padding: 12, borderRadius: 12, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  btn: { backgroundColor: '#1e8449', padding: 10, borderRadius: 8, flexGrow: 1, alignItems: 'center', marginHorizontal: 4 },
  primary: { backgroundColor: '#2ecc71' },
  secondary: { backgroundColor: '#3498db' },
  btnText: { color: '#fff', fontWeight: '600' },
  info: { textAlign: 'center', color: '#34495e' },
});