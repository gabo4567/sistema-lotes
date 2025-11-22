// src/screens/EditMedicionScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { auth } from '../services/firebase';
import { API_URL } from '../utils/constants';
import SimpleImagePicker from '../components/SimpleImagePicker';

const TIPOS_MEDICION = [ 'PH', 'Humedad', 'Temperatura', 'Conductividad', 'Nitrogeno', 'Fosforo', 'Potasio', 'Otros' ];

export default function EditMedicionScreen({ route, navigation }) {
  const { medicion } = route.params || {};
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    lote: medicion?.lote || '',
    tipo: medicion?.tipo || 'PH',
    valorNumerico: medicion?.valorNumerico != null ? String(medicion.valorNumerico) : '',
    observaciones: medicion?.observaciones || '',
    tecnicoResponsable: medicion?.tecnicoResponsable || '',
  });
  const [capturedImage, setCapturedImage] = useState(null);

  const handleImageCaptured = (imageUri) => { setCapturedImage(imageUri); };

  const uploadImage = async (imageUri) => {
    try {
      const fd = new FormData();
      const filename = imageUri.split('/').pop();
      const match = filename.match(/\.([^.]+)$/);
      const fileType = match ? `image/${match[1]}` : 'image/jpeg';
      fd.append('imagen', { uri: imageUri, type: fileType, name: filename || 'medicion.jpg' });
      const resp = await fetch(`${API_URL}/upload/medicion-imagen`, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error('Error al subir imagen');
      const j = await resp.json();
      return j.imageUrl;
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo subir la imagen');
      return medicion?.evidenciaUrl || '';
    }
  };

  const handleSubmit = async () => {
    if (!formData.lote || !formData.valorNumerico || !formData.tecnicoResponsable) {
      Alert.alert('Error', 'Completá los campos requeridos');
      return;
    }
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      let imageUrl = medicion?.evidenciaUrl || '';
      if (capturedImage) imageUrl = await uploadImage(capturedImage);
      const payload = {
        lote: formData.lote,
        tipo: formData.tipo,
        valorNumerico: parseFloat(formData.valorNumerico),
        observaciones: formData.observaciones,
        tecnicoResponsable: formData.tecnicoResponsable,
        evidenciaUrl: imageUrl,
      };
      const resp = await fetch(`${API_URL}/mediciones/${medicion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error('No se pudo actualizar');
      Alert.alert('OK', 'Medición actualizada', [{ text: 'Volver', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo actualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Editar Medición</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lote *</Text>
            <TextInput style={styles.input} value={formData.lote} onChangeText={(text) => setFormData({ ...formData, lote: text })} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo *</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })} style={styles.picker}>
                {TIPOS_MEDICION.map((tipo) => (<Picker.Item key={tipo} label={tipo} value={tipo} />))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Valor *</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={formData.valorNumerico} onChangeText={(text) => setFormData({ ...formData, valorNumerico: text })} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Técnico *</Text>
            <TextInput style={styles.input} value={formData.tecnicoResponsable} onChangeText={(text) => setFormData({ ...formData, tecnicoResponsable: text })} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Observaciones</Text>
            <TextInput style={[styles.input, styles.textArea]} multiline numberOfLines={4} value={formData.observaciones} onChangeText={(text) => setFormData({ ...formData, observaciones: text })} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Foto</Text>
            <SimpleImagePicker onImageCaptured={handleImageCaptured} existingImageUrl={medicion?.evidenciaUrl || null} />
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={[styles.submitButton]} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Guardar cambios</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelButton]} onPress={() => navigation.goBack()}>
              <Text style={styles.submitButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  formContainer: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333', textAlign: 'center' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  pickerContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' },
  picker: { height: 50 },
  submitButton: { backgroundColor: '#3B82F6', padding: 15, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#6B7280', padding: 15, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});