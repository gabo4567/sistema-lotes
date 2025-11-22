// src/components/ImageCaptureComponent.js
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet, Alert } from 'react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

const ImageCaptureComponent = ({ onImageCaptured, existingImageUrl = null }) => {
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState(null);
  const [capturedImage, setCapturedImage] = useState(existingImageUrl);
  const [cameraRef, setCameraRef] = useState(null);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    console.log('🔍 Solicitando permisos de cámara...');
    const cameraPermission = await Camera.requestCameraPermissionsAsync();
    console.log('📷 Permiso de cámara:', cameraPermission.status);
    
    console.log('🔍 Solicitando permisos de galería...');
    const mediaLibraryPermission = await MediaLibrary.requestPermissionsAsync();
    console.log('📸 Permiso de galería:', mediaLibraryPermission.status);
    
    setHasCameraPermission(cameraPermission.status === 'granted');
    setHasMediaLibraryPermission(mediaLibraryPermission.status === 'granted');
  };

  const takePicture = async () => {
    if (cameraRef) {
      try {
        const photo = await cameraRef.takePictureAsync({
          quality: 0.7,
          base64: false,
        });
        
        setCapturedImage(photo.uri);
        onImageCaptured(photo.uri);
      } catch (error) {
        Alert.alert('Error', 'No se pudo tomar la foto');
        console.error('Error taking picture:', error);
      }
    }
  };

  const selectFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled) {
        setCapturedImage(result.assets[0].uri);
        onImageCaptured(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
      console.error('Error selecting image:', error);
    }
  };

  const resetImage = () => {
    setCapturedImage(null);
    onImageCaptured(null);
  };

  if (hasCameraPermission === null || hasMediaLibraryPermission === null) {
    console.log('⏳ Esperando permisos - Cámara:', hasCameraPermission, 'Galería:', hasMediaLibraryPermission);
    return <Text>Solicitando permisos...</Text>;
  }

  console.log('✅ Permisos concedidos - Cámara:', hasCameraPermission, 'Galería:', hasMediaLibraryPermission);

  if (hasCameraPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Se requiere permiso de cámara para tomar fotos
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermissions}>
          <Text style={styles.buttonText}>Solicitar permisos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {capturedImage ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: capturedImage }} style={styles.capturedImage} />
          <View style={styles.imageActions}>
            <TouchableOpacity style={styles.buttonSecondary} onPress={resetImage}>
              <Text style={styles.buttonText}>Tomar otra</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.captureContainer}>
          <Camera
            style={styles.camera}
            type={Camera.Constants.Type.back}
            ref={ref => setCameraRef(ref)}
          >
            <View style={styles.cameraContainer}>
              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <Text style={styles.captureButtonText}>📸</Text>
              </TouchableOpacity>
            </View>
          </Camera>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.button} onPress={selectFromGallery}>
              <Text style={styles.buttonText}>📷 Seleccionar de galería</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  captureContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: 20,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  captureButtonText: {
    fontSize: 24,
  },
  actionButtons: {
    padding: 20,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonSecondary: {
    backgroundColor: '#6B7280',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageContainer: {
    flex: 1,
    padding: 20,
  },
  capturedImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 20,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
});

export default ImageCaptureComponent;