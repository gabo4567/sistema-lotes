// src/hooks/useOffline.js
import { useState, useEffect } from 'react';
import offlineManager from '../utils/OfflineManager';

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(offlineManager.isOnline);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [failedOperations, setFailedOperations] = useState(0);
  const [lastFailedError, setLastFailedError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Suscribirse a cambios de conectividad
    const unsubscribe = offlineManager.subscribe((online) => {
      setIsOnline(online);
    });

    // Actualizar estado periódicamente
    const interval = setInterval(() => {
      const status = offlineManager.getStatus();
      setPendingOperations(status.pendingOperations);
      setFailedOperations(status.failedOperations || 0);
      setLastFailedError(status.lastFailedError || null);
      setIsProcessing(status.isProcessing);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const addToQueue = (operation) => {
    return offlineManager.addToQueue(operation);
  };

  const getStatus = () => {
    return offlineManager.getStatus();
  };

  const clearFailedOperations = () => {
    return offlineManager.clearFailedOperations();
  };

  const retryFailedOperations = () => {
    return offlineManager.retryFailedOperations();
  };

  const syncNow = () => {
    return offlineManager.syncNow();
  };

  const subscribeOperations = (listener) => {
    return offlineManager.subscribeOperations(listener);
  };

  return {
    isOnline,
    pendingOperations,
    failedOperations,
    lastFailedError,
    isProcessing,
    addToQueue,
    getStatus,
    clearFailedOperations,
    retryFailedOperations,
    syncNow,
    subscribeOperations
  };
};
