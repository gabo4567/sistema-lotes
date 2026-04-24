// src/components/OfflineIndicator.js
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { useOffline } from '../hooks/useOffline';

const OfflineIndicator = () => {
  const { isOnline, pendingOperations, failedOperations, lastFailedError, isProcessing, retryFailedOperations, syncNow } = useOffline();
  const [isManualActionRunning, setIsManualActionRunning] = useState(false);

  const shouldShow = useMemo(() => {
    return !isOnline || isProcessing || pendingOperations > 0 || failedOperations > 0;
  }, [failedOperations, isOnline, isProcessing, pendingOperations]);

  if (!shouldShow) return null;

  const statusTitle = !isOnline
    ? 'Sin conexión'
    : isProcessing
      ? 'Sincronizando...'
      : failedOperations > 0
        ? 'No se pudieron sincronizar cambios'
        : pendingOperations > 0
          ? 'Cambios pendientes'
          : 'Estado';

  const statusSubtitle = !isOnline
    ? (pendingOperations > 0
        ? `${pendingOperations} ${pendingOperations === 1 ? 'cambio pendiente' : 'cambios pendientes'}`
        : 'Los cambios se sincronizarán cuando vuelva la conexión')
    : failedOperations > 0
      ? `${failedOperations} ${failedOperations === 1 ? 'operación fallida' : 'operaciones fallidas'}${lastFailedError ? `: ${String(lastFailedError).slice(0, 120)}${String(lastFailedError).length > 120 ? '…' : ''}` : ''}`
      : pendingOperations > 0
        ? `${pendingOperations} ${pendingOperations === 1 ? 'cambio pendiente' : 'cambios pendientes'}`
        : 'Listo';

  return (
    <View
      style={[
        styles.container,
        { paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 14 },
      ]}
    >
      <View style={styles.indicator}>
        <View style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{statusTitle}</Text>
          <Text style={styles.subtitle}>{statusSubtitle}</Text>
          {isProcessing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color="#059669" />
              <Text style={styles.processing}>Sincronizando...</Text>
            </View>
          ) : null}
        </View>
        {isOnline && !isProcessing && (pendingOperations > 0 || failedOperations > 0) ? (
          <View style={styles.actions}>
            {failedOperations > 0 ? (
              <TouchableOpacity
                style={[styles.actionBtn, isManualActionRunning && styles.actionBtnDisabled]}
                disabled={isManualActionRunning}
                onPress={async () => {
                  try {
                    setIsManualActionRunning(true);
                    await retryFailedOperations();
                  } finally {
                    setIsManualActionRunning(false);
                  }
                }}
              >
                <Text style={styles.actionText}>Reintentar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, isManualActionRunning && styles.actionBtnDisabled]}
                disabled={isManualActionRunning}
                onPress={async () => {
                  try {
                    setIsManualActionRunning(true);
                    await syncNow();
                  } finally {
                    setIsManualActionRunning(false);
                  }
                }}
              >
                <Text style={styles.actionText}>Sincronizar</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fef3c7',
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
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#f59e0b',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#a16207',
    lineHeight: 16,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  processing: {
    fontSize: 11,
    color: '#059669',
    fontStyle: 'italic',
  },
  actions: {
    marginLeft: 12,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#1e8449',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default OfflineIndicator;
