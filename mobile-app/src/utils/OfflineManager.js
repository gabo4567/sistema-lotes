// src/utils/OfflineManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_URL } from './constants';

class OfflineManager {
  constructor() {
    this.isOnline = true;
    this.listeners = [];
    this.operationQueue = [];
    this.isProcessingQueue = false;

    // Inicializar detección de conectividad
    this.initializeConnectivity();
  }

  // Inicializar detección de conectividad
  async initializeConnectivity() {
    // Estado inicial
    const netInfo = await NetInfo.fetch();
    this.isOnline = netInfo.isConnected ?? true;
    this.notifyListeners();

    // Escuchar cambios
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? true;

      if (!wasOnline && this.isOnline) {
        // Volvió la conexión - procesar queue
        this.processQueue();
      }

      this.notifyListeners();
    });

    // Cargar operaciones pendientes del storage
    await this.loadPendingOperations();
  }

  // Suscribirse a cambios de conectividad
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notificar a todos los listeners
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  // Agregar operación a la queue
  async addToQueue(operation) {
    const queuedOperation = {
      id: Date.now() + Math.random(),
      ...operation,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    this.operationQueue.push(queuedOperation);
    await this.savePendingOperations();

    // Si estamos online, intentar procesar inmediatamente
    if (this.isOnline) {
      this.processQueue();
    }

    return queuedOperation.id;
  }

  // Procesar la queue de operaciones
  async processQueue() {
    if (this.isProcessingQueue || !this.isOnline || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      for (let i = 0; i < this.operationQueue.length; i++) {
        const operation = this.operationQueue[i];

        try {
          await this.executeOperation(operation);
          // Remover operación exitosa
          this.operationQueue.splice(i, 1);
          i--; // Ajustar índice
          await this.savePendingOperations();
        } catch (error) {
          console.warn('Error ejecutando operación offline:', error);
          operation.retryCount++;

          // Si falló muchas veces, marcar como fallida
          if (operation.retryCount >= 3) {
            operation.status = 'failed';
            operation.error = error.message;
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Ejecutar una operación específica
  async executeOperation(operation) {
    const { type, data, endpoint, method = 'POST' } = operation;

    // Aquí implementarías la lógica específica para cada tipo de operación
    switch (type) {
      case 'CREATE_LOTE':
        return await this.syncCreateLote(data);
      case 'UPDATE_LOTE':
        return await this.syncUpdateLote(data);
      case 'CREATE_TURNO':
        return await this.syncCreateTurno(data);
      case 'UPDATE_UBICACION':
        return await this.syncUpdateUbicacion(data);
      default:
        throw new Error(`Tipo de operación no soportado: ${type}`);
    }
  }

  // Implementaciones específicas de sincronización
  async syncCreateLote(data) {
    const response = await fetch(`${API_URL}/lotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Error sincronizando lote');
    }

    return response.json();
  }

  async syncUpdateLote(data) {
    const response = await fetch(`${API_URL}/lotes/${data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Error sincronizando actualización de lote');
    }

    return response.json();
  }

  async syncCreateTurno(data) {
    const response = await fetch(`${API_URL}/turnos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Error sincronizando turno');
    }

    return response.json();
  }

  async syncUpdateUbicacion(data) {
    const productorId = data?.productorId || data?.id || data?.productor?.id;
    const ubicaciones = data?.ubicaciones;
    const campos = data?.campos;
    const campoActivoId = data?.campoActivoId;
    if (!productorId || (!ubicaciones && !campos && !campoActivoId)) {
      throw new Error('Datos de ubicación incompletos');
    }

    const response = await fetch(`${API_URL}/productores/${productorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify({ ubicaciones, campos, campoActivoId })
    });

    if (!response.ok) {
      throw new Error('Error sincronizando ubicación');
    }

    return response.json();
  }

  // Obtener token de autenticación
  async getAuthToken() {
    const { auth } = await import('../services/firebase');
    const user = auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');
    return await user.getIdToken();
  }

  // Guardar operaciones pendientes en AsyncStorage
  async savePendingOperations() {
    try {
      await AsyncStorage.setItem('offline_operations', JSON.stringify(this.operationQueue));
    } catch (error) {
      console.error('Error guardando operaciones pendientes:', error);
    }
  }

  // Cargar operaciones pendientes desde AsyncStorage
  async loadPendingOperations() {
    try {
      const operations = await AsyncStorage.getItem('offline_operations');
      if (operations) {
        this.operationQueue = JSON.parse(operations);
      }
    } catch (error) {
      console.error('Error cargando operaciones pendientes:', error);
    }
  }

  // Obtener estado actual
  getStatus() {
    return {
      isOnline: this.isOnline,
      pendingOperations: this.operationQueue.length,
      isProcessing: this.isProcessingQueue
    };
  }

  // Limpiar operaciones fallidas (opcional)
  async clearFailedOperations() {
    this.operationQueue = this.operationQueue.filter(op => op.status !== 'failed');
    await this.savePendingOperations();
  }
}

// Singleton
const offlineManager = new OfflineManager();
export default offlineManager;
