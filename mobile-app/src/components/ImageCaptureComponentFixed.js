// src/components/ImageCaptureComponentFixed.js
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet, Alert, Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

const ImageCaptureComponentFixed = ({ onImageCaptured, existingImageUrl = null }) => {
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState(null);
  const [capturedImage, setCapturedImage] = useState(existingImageUrl);
  const [cameraRef, setCameraRef] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      setIsLoading(true);
      
      // Verificar estado actual de permisos
      const cameraStatus = await Camera.getCameraPermissionsAsync();
      const mediaStatus = await MediaLibrary.getPermissionsAsync();
      
      console.log('📷 Estado inicial cámara:', cameraStatus.status);
      console.log('📸 Estado inicial galería:', mediaStatus.status);

      // Si no están concedidos, solicitarlos
      if (cameraStatus.status !== 'granted') {
        console.log('🔄 Solicitando permiso de cámara...');
        const cameraPermission = await Camera.requestCameraPermissionsAsync();
        console.log('📷 Nuevo estado cámara:', cameraPermission.status);
        setHasCameraPermission(cameraPermission.status === 'granted');
      } else {
        setHasCameraPermission(true);
      }

      if (mediaStatus.status !== 'granted') {
        console.log('🔄 Solicitando permiso de galería...');
        const mediaLibraryPermission = await MediaLibrary.requestPermissionsAsync();
        console.log('📸 Nuevo estado galería:', mediaLibraryPermission.status);
        setHasMediaLibraryPermission(mediaLibraryPermission.status === 'granted');
      } else {
        setHasMediaLibraryPermission(true);
      }

    } catch (error) {
      console.error('❌ Error al verificar permisos:', error);
      Alert.alert('Error', 'No se pudieron verificar los permisos de la cámara');
    } finally {
      setIsLoading(false);
    }
  };

  const takePicture = async () => {
    if (cameraRef && hasCameraPermission) {
      try {
        const photo = await cameraRef.takePictureAsync({
          quality: 0.7,
          base64: false,
        });
        
        console.log('📸 Foto tomada:', photo.uri);
        setCapturedImage(photo.uri);
        onImageCaptured(photo.uri);
      } catch (error) {
        console.error('❌ Error al tomar foto:', error);
        Alert.alert('Error', 'No se pudo tomar la foto');
      }
    } else {
      Alert.alert('Error', 'No hay permisos de cámara o la cámara no está lista');
    }
  };

  const selectFromGallery = async () => {
    try {
      if (!hasMediaLibraryPermission) {
        Alert.alert('Permiso requerido', 'Se necesita permiso para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('📷 Imagen seleccionada:', result.assets[0].uri);
        setCapturedImage(result.assets[0].uri);
        onImageCaptured(result.assets[0].uri);
      }
    } catch (error) {
      console.error('❌ Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const resetImage = () => {
    setCapturedImage(null);
    onImageCaptured(null);
  };

  // Estados de carga y permisos
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Verificando permisos...</Text>
      </View>
    );
  }

  if (hasCameraPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Se requiere permiso de cámara para tomar fotos
        </Text>
        <TouchableOpacity style={styles.button} onPress={checkPermissions}>
          <Text style={styles.buttonText}>Reintentar permisos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonSecondary} onPress={selectFromGallery}>
          <Text style={styles.buttonText}>Usar solo galería</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Si tenemos imagen capturada, mostrarla
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

  // Vista de cámara activa
  return (
    <View style={styles.container}>
      {hasCameraPermission ? (
        <Camera
          style={styles.camera}
          type={Camera.Constants.Type.back}
          ref={ref => setCameraRef(ref)}
          ratio="4:3"
        >
          <View style={styles.cameraContainer}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <Text style={styles.captureButtonText}>📸</Text>
            </TouchableOpacity>
          </View>
        </Camera>
      ) : (
        <View style={styles.noCameraContainer}>
          <Text style={styles.noCameraText}>Cámara no disponible</Text>
        </View>
      )}
      
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.button} onPress={selectFromGallery}>
          <Text style={styles.buttonText}>📷 Seleccionar de galería</Text>
        </TouchableOpacity>
        {hasCameraPermission && (
          <TouchableOpacity style={styles.buttonSecondary} onPress={checkPermissions}>
            <Text style={styles.buttonText}>🔧 Verificar permisos</Text>
          </TouchableOpacity>
        )}
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
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  captureContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
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
    paddingVertical: 15,
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
  },
  capturedImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    gap: 10,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    paddingHorizontal: 20,
  },
  noCameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  noCameraText: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default ImageCaptureComponentFixed;