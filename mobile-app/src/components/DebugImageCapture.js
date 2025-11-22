// src/components/DebugImageCapture.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import ImageCaptureComponentFixed from './ImageCaptureComponentFixed';
import SimpleImagePicker from './SimpleImagePicker';

const DebugImageCapture = ({ onImageCaptured }) => {
  const [useSimpleVersion, setUseSimpleVersion] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev, newLog].slice(-10)); // Mantener últimos 10 logs
    console.log(newLog);
  };

  const handleImageCaptured = (imageUri) => {
    addLog(`✅ Imagen capturada: ${imageUri ? 'ÉXITO' : 'FALLÓ'}`);
    onImageCaptured(imageUri);
  };

  const toggleVersion = () => {
    setUseSimpleVersion(!useSimpleVersion);
    addLog(`🔄 Cambiando a versión: ${!useSimpleVersion ? 'Simple' : 'Completa'}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Captura de Imagen</Text>
        <TouchableOpacity style={styles.toggleButton} onPress={toggleVersion}>
          <Text style={styles.toggleButtonText}>
            Usar versión: {useSimpleVersion ? 'Simple' : 'Completa'}
          </Text>
        </TouchableOpacity>
      </View>

      {useSimpleVersion ? (
        <SimpleImagePicker 
          onImageCaptured={handleImageCaptured}
        />
      ) : (
        <ImageCaptureComponentFixed 
          onImageCaptured={handleImageCaptured}
        />
      )}

      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>Logs de depuración:</Text>
        <ScrollView style={styles.logsScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  toggleButton: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  logsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  logsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  logsScroll: {
    maxHeight: 100,
  },
  logText: {
    fontSize: 12,
    color: '#555',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
});

export default DebugImageCapture;