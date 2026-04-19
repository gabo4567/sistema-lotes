// src/components/OfflineIndicator.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOffline } from '../hooks/useOffline';

const OfflineIndicator = () => {
  const { isOnline, pendingOperations, isProcessing } = useOffline();

  if (isOnline) {
    return null; // No mostrar nada si está online
  }

  return (
    <View style={styles.container}>
      <View style={styles.indicator}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>📶</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Modo sin conexión</Text>
          <Text style={styles.subtitle}>
            {pendingOperations > 0
              ? `${pendingOperations} ${pendingOperations === 1 ? 'cambio pendiente' : 'cambios pendientes'}`
              : 'Los cambios se sincronizarán cuando vuelva la conexión'
            }
          </Text>
          {isProcessing && (
            <Text style={styles.processing}>Sincronizando...</Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fef3c7', // Color amarillo claro
    borderBottomWidth: 1,
    borderBottomColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e', // Color marrón oscuro
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#a16207', // Color marrón
    lineHeight: 16,
  },
  processing: {
    fontSize: 11,
    color: '#059669', // Verde
    fontStyle: 'italic',
    marginTop: 2,
  },
});

export default OfflineIndicator;