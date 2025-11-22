// src/screens/CrearMedicionScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { auth } from '../services/firebase';
import { API_URL } from '../utils/constants';
import SimpleImagePicker from '../components/SimpleImagePicker';

const TIPOS_MEDICION = [
  'PH',
  'Humedad',
  'Temperatura',
  'Conductividad',
  'Nitrogeno',
  'Fosforo',
  'Potasio',
  'Otros'
];

export default function CrearMedicionScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    lote: '',
    tipo: 'PH',
    valorNumerico: '',
    observaciones: '',
    tecnicoResponsable: '',
  });
  const [capturedImage, setCapturedImage] = useState(null);
  const insets = useSafeAreaInsets();

  const handleImageCaptured = (imageUri) => {
    setCapturedImage(imageUri);
  };

  const uploadImage = async (imageUri) => {
    try {
      console.log('📸 Iniciando upload de imagen:', imageUri);
      
      const formData = new FormData();
      
      // Para archivos locales, usar el URI directamente
      const filename = imageUri.split('/').pop();
      const match = filename.match(/\.([^.]+)$/);
      const fileType = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('imagen', {
        uri: imageUri,
        type: fileType,
        name: filename || 'medicion.jpg',
      });

      console.log('📤 Enviando formData:', {
        uri: imageUri.substring(0, 50) + '...',
        type: fileType,
        name: filename
      });

      const uploadResponse = await fetch(`${API_URL}/upload/medicion-imagen`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          // No establecer Content-Type, fetch lo hará automáticamente con boundary
        },
      });

      console.log('📨 Respuesta del servidor:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Error del servidor:', errorText);
        throw new Error(`Error al subir imagen: ${uploadResponse.status} - ${errorText}`);
      }

      const result = await uploadResponse.json();
      console.log('✅ Upload exitoso, URL:', result.imageUrl);
      return result.imageUrl;
    } catch (error) {
      console.error('❌ Error uploading image:', error);
      Alert.alert('Error de imagen', 'No se pudo subir la imagen: ' + error.message);
      return ''; // Retornar string vacío para continuar sin imagen
    }
  };

  const handleSubmit = async () => {
    if (!formData.lote || !formData.valorNumerico || !formData.tecnicoResponsable) {
      Alert.alert('Error', 'Por favor complete todos los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      const idToken = await auth.currentUser?.getIdToken();

      if (!ipt) {
        Alert.alert('Error', 'No se pudo obtener el IPT del usuario');
        return;
      }

      let imageUrl = '';
      if (capturedImage) {
        console.log('📸 Procesando imagen capturada...');
        imageUrl = await uploadImage(capturedImage);
        console.log('✅ URL de imagen resultante:', imageUrl || 'VACÍA');
      } else {
        console.log('ℹ️ Sin imagen para subir');
      }

      const medicionData = {
        productor: ipt,
        lote: formData.lote,
        fecha: new Date().toISOString(),
        tipo: formData.tipo,
        valorNumerico: parseFloat(formData.valorNumerico),
        tecnicoResponsable: formData.tecnicoResponsable,
        observaciones: formData.observaciones,
        evidenciaUrl: imageUrl,
      };

      const response = await fetch(`${API_URL}/mediciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(medicionData),
      });

      if (!response.ok) {
        throw new Error('Error al crear medición');
      }

      const mensajeExito = imageUrl 
        ? 'Medición creada correctamente con imagen'
        : 'Medición creada correctamente (sin imagen)';
      
      Alert.alert('Éxito', mensajeExito, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (error) {
      console.error('Error creating medicion:', error);
      Alert.alert('Error', 'No se pudo crear la medición');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Crear Nueva Medición</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lote *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ingrese el nombre del lote"
            value={formData.lote}
            onChangeText={(text) => setFormData({ ...formData, lote: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tipo de Medición *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.tipo}
              onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              style={styles.picker}
            >
              {TIPOS_MEDICION.map((tipo) => (
                <Picker.Item key={tipo} label={tipo} value={tipo} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Valor Numérico *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ingrese el valor medido"
            value={formData.valorNumerico}
            onChangeText={(text) => setFormData({ ...formData, valorNumerico: text })}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Técnico Responsable *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre del técnico"
            value={formData.tecnicoResponsable}
            onChangeText={(text) => setFormData({ ...formData, tecnicoResponsable: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Observaciones</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Observaciones adicionales (opcional)"
            value={formData.observaciones}
            onChangeText={(text) => setFormData({ ...formData, observaciones: text })}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Evidencia Fotográfica</Text>
          <SimpleImagePicker
            onImageCaptured={handleImageCaptured}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { marginBottom: Math.max(insets.bottom, 24) }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Crear Medición</Text>
          )}
        </TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  formContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});