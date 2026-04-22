// src/screens/EditarUbicacionScreen.js
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { offlineUbicacionesOperations } from '../utils/offlineOperations';

const LABELS = {
  entradaDomicilio: 'Entrada del domicilio',
  domicilioCasa: 'Domicilio / Casa',
  entradaCampo: 'Entrada al campo',
  centroCampo: 'Centro del campo',
};

const buildEmptyUbicaciones = () => ({
  entradaDomicilio: { activo: false },
  domicilioCasa: { activo: false },
  entradaCampo: { activo: false },
  centroCampo: { activo: false },
});

const ensureUbicacionesShape = (ubicaciones) => {
  const base = buildEmptyUbicaciones();
  const src = ubicaciones && typeof ubicaciones === 'object' ? ubicaciones : {};
  const out = { ...base };
  for (const k of Object.keys(base)) {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = { ...base[k], ...v };
  }
  return out;
};

const normalizeCampos = (productor) => {
  let campos = Array.isArray(productor?.campos) ? productor.campos : [];
  if (!campos.length) {
    campos = [{ id: 'principal', nombre: 'Campo principal', ubicaciones: ensureUbicacionesShape(productor?.ubicaciones) }];
  } else {
    campos = campos
      .map((c, i) => ({
        id: c?.id ? String(c.id) : `campo_${i + 1}`,
        nombre: (c?.nombre ? String(c.nombre) : '').trim() || `Campo ${i + 1}`,
        ubicaciones: ensureUbicacionesShape(c?.ubicaciones),
      }))
      .filter((c) => c.id);
    if (!campos.length) {
      campos = [{ id: 'principal', nombre: 'Campo principal', ubicaciones: ensureUbicacionesShape(productor?.ubicaciones) }];
    }
  }
  return campos;
};

export default function EditarUbicacionScreen({ route, navigation }) {
  const { tipo, productor, campoId } = route.params || {};
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);
  const [marker, setMarker] = useState(null);
  const [saving, setSaving] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  const campos = normalizeCampos(productor);
  const requestedCampoId = campoId ? String(campoId) : '';
  const fallbackCampoId = productor?.campoActivoId ? String(productor.campoActivoId) : '';
  const selectedCampo =
    (requestedCampoId && campos.find((c) => c.id === requestedCampoId)) ||
    (fallbackCampoId && campos.find((c) => c.id === fallbackCampoId)) ||
    campos[0];
  const current = selectedCampo?.ubicaciones?.[tipo];

  const requestLocationAccess = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationPermissionDenied(true);
      setRegion(null);
      return;
    }
    setLocationPermissionDenied(false);

    let initial = null;
    if (current?.lat != null && current?.lng != null) {
      initial = { latitude: current.lat, longitude: current.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setMarker({ latitude: current.lat, longitude: current.lng });
    } else {
      const loc = await Location.getCurrentPositionAsync({});
      initial = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    }
    setRegion(initial);
  };

  useEffect(() => {
    (async () => {
      await requestLocationAccess();
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
      const updatedCampoUbicaciones = {
        ...(selectedCampo?.ubicaciones || {}),
        [tipo]: { lat: marker.latitude, lng: marker.longitude, activo: true, updatedAt: new Date().toISOString() },
      };
      const updatedCampos = campos.map((c) => (c.id === selectedCampo?.id ? { ...c, ubicaciones: updatedCampoUbicaciones } : c));
      const result = await offlineUbicacionesOperations.updateUbicacion({
        productorId: productor.id,
        campos: updatedCampos,
        campoActivoId: selectedCampo?.id,
        ubicaciones: updatedCampoUbicaciones,
      });
      const wasOffline = Boolean(result?._isOffline);
      Alert.alert(
        wasOffline ? 'Guardado offline' : 'OK',
        wasOffline ? 'Ubicación guardada. Se sincronizará cuando recuperes la conexión.' : 'Ubicación guardada',
        [{ text: 'Volver', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar');
    } finally { setSaving(false); }
  };

  const softDelete = async () => {
    if (!current) { Alert.alert('Info', 'No hay ubicación para eliminar'); return; }
    try {
      const updatedCampoUbicaciones = {
        ...(selectedCampo?.ubicaciones || {}),
        [tipo]: { ...(selectedCampo?.ubicaciones?.[tipo] || {}), activo: false, updatedAt: new Date().toISOString() },
      };
      const updatedCampos = campos.map((c) => (c.id === selectedCampo?.id ? { ...c, ubicaciones: updatedCampoUbicaciones } : c));
      const result = await offlineUbicacionesOperations.updateUbicacion({
        productorId: productor.id,
        campos: updatedCampos,
        campoActivoId: selectedCampo?.id,
        ubicaciones: updatedCampoUbicaciones,
      });
      const wasOffline = Boolean(result?._isOffline);
      Alert.alert(
        wasOffline ? 'Guardado offline' : 'OK',
        wasOffline ? 'Ubicación desactivada. Se sincronizará cuando recuperes la conexión.' : 'Ubicación desactivada',
        [{ text: 'Volver', onPress: () => navigation.goBack() }]
      );
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
      ) : locationPermissionDenied ? (
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Permiso de ubicación denegado</Text>
          <Text style={styles.info}>Para editar ubicaciones debes habilitar el permiso de ubicación.</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={requestLocationAccess}>
              <Text style={styles.btnText}>Reintentar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.primary]}
              onPress={async () => {
                try {
                  await Linking.openSettings();
                } catch {
                  Alert.alert('No disponible', 'No se pudo abrir configuración del sistema');
                }
              }}
            >
              <Text style={styles.btnText}>Abrir configuración</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.info}>Cargando mapa…</Text>
      )}
      <View style={styles.panel}>
        <Text style={styles.info}>{marker ? `Lat: ${marker.latitude.toFixed(6)}  Lng: ${marker.longitude.toFixed(6)}` : 'Tocá el mapa para marcar'}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.primary]} onPress={save} disabled={saving || !marker}>
            <Text style={styles.btnText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#c0392b' }]}
            onPress={() => {
              Alert.alert(
                'Eliminar ubicación',
                '¿Estás seguro de que deseas eliminar esta ubicación?',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Eliminar', style: 'destructive', onPress: () => softDelete() },
                ]
              );
            }}
          >
            <Text style={styles.btnText}>Eliminar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => navigation.goBack()}>
            <Text style={styles.btnText}>Cancelar</Text>
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
  permissionCard: { padding: 16, borderRadius: 12, backgroundColor: '#fff3f3', borderWidth: 1, borderColor: '#f3cccc', marginBottom: 12 },
  permissionTitle: { fontSize: 16, textAlign: 'center', marginBottom: 8, color: '#8b1e2d', fontWeight: '700' },
  panel: { backgroundColor: '#ffffff', padding: 12, borderRadius: 12, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  btn: { backgroundColor: '#1e8449', padding: 10, borderRadius: 8, flexGrow: 1, alignItems: 'center', marginHorizontal: 4 },
  primary: { backgroundColor: '#2ecc71' },
  secondary: { backgroundColor: '#3498db' },
  btnText: { color: '#fff', fontWeight: '600' },
  info: { textAlign: 'center', color: '#34495e' },
});
