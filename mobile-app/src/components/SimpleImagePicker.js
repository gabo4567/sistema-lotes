// src/components/SimpleImagePicker.js
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from "../utils/constants";

const SimpleImagePicker = ({ onImageCaptured, existingImageUrl = null }) => {
  const buildImageUrl = (u) => {
    if (!u) return null;
    try {
      const origin = String(API_URL).replace(/\/api\/?$/, "");
      if (/^https?:\/\//i.test(u)) {
        const abs = new URL(u);
        if (abs.hostname === "localhost" || abs.hostname === "127.0.0.1" || abs.hostname === "::1") {
          return origin + abs.pathname;
        }
        if (abs.pathname.startsWith("/uploads/")) {
          return origin + abs.pathname;
        }
        return u;
      }
      if (u.startsWith("/")) return origin + u;
      return u;
    } catch {
      return u;
    }
  };

  const [capturedImage, setCapturedImage] = useState(buildImageUrl(existingImageUrl));

  const selectFromGallery = async () => {
    try {
      console.log('📸 Abriendo selector de galería...');
      
      // No solicitar permisos, usar el método directo
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      console.log('📋 Resultado de galería:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log('✅ Imagen seleccionada:', imageUri);
        setCapturedImage(imageUri);
        onImageCaptured(imageUri);
      } else {
        console.log('❌ Usuario canceló o error en selección');
      }
    } catch (error) {
      console.error('❌ Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo abrir la galería: ' + error.message);
    }
  };

  const takePicture = async () => {
    try {
      console.log('📷 Abriendo cámara...');
      
      // Usar el image picker para cámara también
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      console.log('📋 Resultado de cámara:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log('✅ Foto tomada:', imageUri);
        setCapturedImage(imageUri);
        onImageCaptured(imageUri);
      } else {
        console.log('❌ Usuario canceló o error en captura');
      }
    } catch (error) {
      console.error('❌ Error al tomar foto:', error);
      Alert.alert('Error', 'No se pudo abrir la cámara: ' + error.message);
    }
  };

  const resetImage = () => {
    setCapturedImage(null);
    onImageCaptured(null);
  };

  if (capturedImage) {
    return (
      <View style={styles.container}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: capturedImage }} style={styles.capturedImage} />
        </View>
        <View style={styles.imageActions}>
          <TouchableOpacity style={styles.buttonSecondary} onPress={resetImage}>
            <Text style={styles.buttonText}>Tomar otra</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.button} onPress={takePicture}>
          <Text style={styles.buttonText}>📸 Tomar Foto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={selectFromGallery}>
          <Text style={styles.buttonText}>📷 Seleccionar de Galería</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
  },
  actionButtons: {
    gap: 10,
  },
  button: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#6B7280',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  capturedImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
});

export default SimpleImagePicker;
