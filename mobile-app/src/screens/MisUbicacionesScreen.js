// src/screens/MisUbicacionesScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../utils/constants';
import { authFetch, getCurrentAuthContext } from '../api/api';
import { offlineUbicacionesOperations } from '../utils/offlineOperations';

const UBIC_TYPES = [
  { key: 'entradaDomicilio', label: 'Entrada del domicilio' },
  { key: 'domicilioCasa', label: 'Domicilio / Casa' },
  { key: 'entradaCampo', label: 'Entrada al campo' },
  { key: 'centroCampo', label: 'Centro del campo' },
];

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

  const requested = productor?.campoActivoId ? String(productor.campoActivoId) : '';
  const campoActivoId = requested && campos.some((c) => c.id === requested) ? requested : campos[0]?.id;
  return { campos, campoActivoId };
};

export default function MisUbicacionesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [productor, setProductor] = useState(null);
  const [selectedCampoId, setSelectedCampoId] = useState(null);
  const [addCampoVisible, setAddCampoVisible] = useState(false);
  const [nuevoCampoNombre, setNuevoCampoNombre] = useState('');
  const [editCampoVisible, setEditCampoVisible] = useState(false);
  const [editCampoId, setEditCampoId] = useState(null);
  const [editCampoNombre, setEditCampoNombre] = useState('');

  const loadProductor = async () => {
    try {
      setLoading(true);
      setError('');
      const { ipt } = await getCurrentAuthContext();
      if (!ipt) throw new Error('No se encontró IPT');
      const resp = await authFetch(`${API_URL}/productores/ipt/${ipt}`);
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

  useEffect(() => {
    if (!productor) return;
    const { campoActivoId } = normalizeCampos(productor);
    setSelectedCampoId(campoActivoId);
  }, [productor?.id]);

  const persistCampos = async ({ campos, campoActivoId, ubicaciones }) => {
    await offlineUbicacionesOperations.updateUbicacion({
      productorId: productor?.id,
      campos,
      campoActivoId,
      ubicaciones,
    });
  };

  const selectCampo = async (campoId) => {
    if (!productor) return;
    const normalized = normalizeCampos(productor);
    const campo = normalized.campos.find((c) => c.id === campoId) || normalized.campos[0];
    if (!campo) return;

    setSelectedCampoId(campo.id);
    setProductor((prev) => prev ? ({ ...prev, campos: normalized.campos, campoActivoId: campo.id, ubicaciones: campo.ubicaciones }) : prev);
    try {
      await persistCampos({ campos: normalized.campos, campoActivoId: campo.id, ubicaciones: campo.ubicaciones });
    } catch {}
  };

  const createCampo = async () => {
    const nombre = String(nuevoCampoNombre || '').trim();
    if (!nombre) {
      Alert.alert('Nombre requerido', 'Ingresá un nombre para el campo.');
      return;
    }
    if (!productor) return;

    const normalized = normalizeCampos(productor);
    const newCampo = {
      id: `c_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      nombre,
      ubicaciones: ensureUbicacionesShape({}),
    };
    const updatedCampos = [...normalized.campos, newCampo];

    setAddCampoVisible(false);
    setNuevoCampoNombre('');
    setSelectedCampoId(newCampo.id);
    setProductor((prev) => prev ? ({ ...prev, campos: updatedCampos, campoActivoId: newCampo.id, ubicaciones: newCampo.ubicaciones }) : prev);

    try {
      await persistCampos({ campos: updatedCampos, campoActivoId: newCampo.id, ubicaciones: newCampo.ubicaciones });
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo crear el campo');
    }
  };

  const openEditCampoNombre = () => {
    if (!selectedCampo) return;
    setEditCampoId(selectedCampo.id);
    setEditCampoNombre(selectedCampo.nombre || '');
    setEditCampoVisible(true);
  };

  const saveEditCampoNombre = async () => {
    const nombre = String(editCampoNombre || '').trim();
    if (!nombre) {
      Alert.alert('Nombre requerido', 'Ingresá un nombre para el campo.');
      return;
    }
    if (!productor) return;
    if (!editCampoId) return;

    const normalized = normalizeCampos(productor);
    const updatedCampos = normalized.campos.map((c) => (c.id === editCampoId ? { ...c, nombre } : c));
    const activeCampoId = selectedCampoId && updatedCampos.some((c) => c.id === selectedCampoId) ? selectedCampoId : updatedCampos[0]?.id;
    const activeCampo = updatedCampos.find((c) => c.id === activeCampoId) || updatedCampos[0];

    setEditCampoVisible(false);
    setEditCampoId(null);
    setEditCampoNombre('');
    setProductor((prev) =>
      prev
        ? {
            ...prev,
            campos: updatedCampos,
            campoActivoId: activeCampo?.id,
            ubicaciones: activeCampo?.ubicaciones,
          }
        : prev
    );

    try {
      await persistCampos({ campos: updatedCampos, campoActivoId: activeCampo?.id, ubicaciones: activeCampo?.ubicaciones });
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar el nombre del campo');
    }
  };

  const deleteCampo = async (campoId) => {
    if (!productor) return;
    const normalized = normalizeCampos(productor);
    if (!campoId || campoId === 'principal') return;
    if (normalized.campos.length <= 1) {
      Alert.alert('No permitido', 'No puedes eliminar el único campo disponible.');
      return;
    }

    const updatedCampos = normalized.campos.filter((c) => c.id !== campoId);
    const nextActiveId =
      campoId === selectedCampoId
        ? updatedCampos[0]?.id
        : updatedCampos.some((c) => c.id === selectedCampoId)
        ? selectedCampoId
        : updatedCampos[0]?.id;
    const nextCampo = updatedCampos.find((c) => c.id === nextActiveId) || updatedCampos[0];

    setSelectedCampoId(nextCampo?.id || null);
    setProductor((prev) =>
      prev
        ? {
            ...prev,
            campos: updatedCampos,
            campoActivoId: nextCampo?.id,
            ubicaciones: nextCampo?.ubicaciones,
          }
        : prev
    );

    try {
      await persistCampos({ campos: updatedCampos, campoActivoId: nextCampo?.id, ubicaciones: nextCampo?.ubicaciones });
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo eliminar el campo');
    }
  };

  const confirmDeleteCampo = () => {
    if (!selectedCampo || selectedCampo.id === 'principal') return;
    Alert.alert(
      'Eliminar campo',
      'Se eliminarán también sus ubicaciones asociadas. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteCampo(selectedCampo.id) },
      ]
    );
  };

  const goEdit = (type) => {
    const normalized = normalizeCampos(productor);
    const campo = normalized.campos.find((c) => c.id === selectedCampoId) || normalized.campos[0];
    navigation.navigate('EditarUbicacion', { tipo: type, productor, campoId: campo?.id });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Text style={styles.title}>Mis Ubicaciones</Text>
        <Text style={styles.loadingText}>Cargando ubicaciones...</Text>
        <ActivityIndicator color="#1e8449" style={{ marginTop: 8 }} />
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

  const normalized = normalizeCampos(productor);
  const campos = normalized.campos;
  const selectedCampo = campos.find((c) => c.id === selectedCampoId) || campos[0];
  const ubic = selectedCampo?.ubicaciones || {};

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <Text style={styles.title}>Mis Ubicaciones</Text>

      <View style={styles.fieldBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fieldBarContent}>
          {campos.map((c) => {
            const active = c.id === selectedCampo?.id;
            return (
              <TouchableOpacity key={c.id} style={[styles.fieldTab, active && styles.fieldTabActive]} onPress={() => selectCampo(c.id)}>
                <Text style={[styles.fieldTabText, active && styles.fieldTabTextActive]} numberOfLines={1}>
                  {c.nombre}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[styles.fieldTab, styles.fieldTabAdd]} onPress={() => setAddCampoVisible(true)}>
            <Text style={styles.fieldTabText}>+ Campo</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {selectedCampo ? (
        <View style={styles.fieldActionsContainer}>
          <Text style={styles.fieldActionsTitle}>{selectedCampo.nombre}</Text>
          <View style={styles.fieldActionsButtonsRow}>
            <TouchableOpacity style={styles.editCampoBtn} onPress={openEditCampoNombre}>
              <Text style={styles.editCampoBtnText}>Cambiar nombre</Text>
            </TouchableOpacity>
            {selectedCampo.id !== 'principal' ? (
              <TouchableOpacity style={styles.deleteCampoBtn} onPress={confirmDeleteCampo}>
                <Text style={styles.deleteCampoBtnText}>Eliminar campo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

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

      <Modal visible={addCampoVisible} transparent animationType="fade" onRequestClose={() => setAddCampoVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo campo</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre del campo"
              value={nuevoCampoNombre}
              onChangeText={setNuevoCampoNombre}
              autoFocus
              maxLength={60}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={createCampo}>
                <Text style={styles.modalBtnText}>Crear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => setAddCampoVisible(false)}>
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editCampoVisible} transparent animationType="fade" onRequestClose={() => setEditCampoVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cambiar nombre del campo</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nuevo nombre"
              value={editCampoNombre}
              onChangeText={setEditCampoNombre}
              autoFocus
              maxLength={60}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={saveEditCampoNombre}>
                <Text style={styles.modalBtnText}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => setEditCampoVisible(false)}>
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1e8449', textAlign: 'center', marginBottom: 12 },
  fieldBar: { marginBottom: 12 },
  fieldBarContent: { gap: 8, paddingRight: 8 },
  fieldTab: { backgroundColor: '#ffffff', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(15,23,42,0.12)' },
  fieldTabActive: { borderColor: '#1e8449' },
  fieldTabAdd: { borderColor: '#3498db' },
  fieldTabText: { color: '#34495e', fontWeight: '600', maxWidth: 180 },
  fieldTabTextActive: { color: '#1e8449' },
  fieldActionsContainer: { gap: 10, marginBottom: 12 },
  fieldActionsTitle: { color: '#1e8449', fontWeight: '800' },
  fieldActionsButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  editCampoBtn: { backgroundColor: '#1e8449', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', flexGrow: 1, minWidth: 160 },
  editCampoBtnText: { color: '#fff', fontWeight: '800' },
  deleteCampoBtn: { backgroundColor: '#c0392b', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', flexGrow: 1, minWidth: 160 },
  deleteCampoBtnText: { color: '#fff', fontWeight: '800' },
  list: { gap: 12 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, elevation: 2 },
  cardTitle: { fontSize: 16, color: '#34495e', fontWeight: '600' },
  cardSub: { fontSize: 14, color: '#7f8c8d', marginTop: 6 },
  badge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, color: '#fff', overflow: 'hidden' },
  error: { color: '#c0392b', textAlign: 'center' },
  loadingText: { textAlign: 'center', color: '#1e8449', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '92%', backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1e8449', textAlign: 'center', marginBottom: 10 },
  modalInput: { backgroundColor: '#f7f7f7', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10 },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: '#2ecc71' },
  modalBtnSecondary: { backgroundColor: '#3498db' },
  modalBtnText: { color: '#fff', fontWeight: '700' },
});
