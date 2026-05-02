// src/utils/OfflineManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_URL } from './constants';

class OfflineManager {
  constructor() {
    this.isOnline = true;
    this.listeners = [];
    this.operationListeners = [];
    this.operationQueue = [];
    this.isProcessingQueue = false;
    this.backendWarmedUp = false;
    this.inFlight = new Map();

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

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  isRetryableStatus(status) {
    return status === 502 || status === 503 || status === 504;
  }

  async fetchWithRetry(url, options = {}) {
    if (options?._dedupe !== false) {
      const method = String(options?.method || "GET").toUpperCase();
      const isMutating = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
      const body = (() => {
        const b = options?.body;
        if (b === undefined || b === null) return "";
        if (typeof b === "string") return b;
        try {
          return JSON.stringify(b);
        } catch {
          return String(b);
        }
      })();
      const lockKey = options?._lockKey ? String(options._lockKey) : `${method} ${String(url)} ${body}`;
      const existing = this.inFlight.get(lockKey);
      if (existing) return existing.then((r) => r.clone());
      const headers = (options?.headers && typeof options.headers === "object") ? { ...options.headers } : {};
      if (isMutating && !headers["Idempotency-Key"] && !headers["idempotency-key"]) {
        const rand = Math.random().toString(16).slice(2);
        headers["Idempotency-Key"] = `k_${Date.now().toString(16)}_${rand}`;
      }
      const p = (async () => this.fetchWithRetry(url, { ...options, headers, _dedupe: false }))().finally(() => {
        this.inFlight.delete(lockKey);
      });
      this.inFlight.set(lockKey, p);
      return p.then((r) => r.clone());
    }

    const method = String(options?.method || "GET").toUpperCase();
    const canRetry = method === "GET";
    const maxRetries = canRetry ? 2 : 0;
    const baseDelayMs = 900;
    const timeoutMs = this.backendWarmedUp ? 15000 : 25000;

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const attemptTimeoutMs = attempt === 0 ? timeoutMs : 15000;
        const resp = await this.fetchWithTimeout(url, options, attemptTimeoutMs);
        if (!resp.ok && this.isRetryableStatus(resp.status) && attempt < maxRetries) {
          await this.sleep(baseDelayMs * (attempt + 1));
          continue;
        }
        if (resp.ok) this.backendWarmedUp = true;
        if (!resp.ok && this.isRetryableStatus(resp.status)) {
          const err = new Error("Conectando al servidor… puede demorar al iniciar. Reintentá en unos segundos.");
          err.code = "SERVER_WAKING";
          throw err;
        }
        return resp;
      } catch (e) {
        lastError = e;
        const isAbort = e?.name === "AbortError";
        if (!canRetry || attempt >= maxRetries) break;
        if (!isAbort && String(e?.message || "").toLowerCase().includes("network request failed") === false) {
          break;
        }
        await this.sleep(baseDelayMs * (attempt + 1));
      }
    }

    const net = await NetInfo.fetch().catch(() => null);
    const isConnected = net?.isConnected ?? true;
    if (!isConnected) {
      const err = new Error("Sin conexión a internet.");
      err.code = "OFFLINE";
      throw err;
    }
    if (lastError?.code === "SERVER_WAKING") throw lastError;
    const err = new Error("El servidor está iniciando o demorando en responder. Reintentá en unos segundos.");
    err.code = "SERVER_WAKING";
    throw err;
  }

  // Suscribirse a cambios de conectividad
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  subscribeOperations(listener) {
    this.operationListeners.push(listener);
    return () => {
      this.operationListeners = this.operationListeners.filter(l => l !== listener);
    };
  }

  // Notificar a todos los listeners
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  notifyOperationListeners(event) {
    this.operationListeners.forEach(listener => listener(event));
  }

  // Agregar operación a la queue
  async addToQueue(operation) {
    const queuedOperation = {
      id: Date.now() + Math.random(),
      ...operation,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
      lastError: null,
      lastAttemptAt: null
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
    if (this.isProcessingQueue || !this.isOnline) {
      return;
    }

    await this.loadPendingOperations();

    if (this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      for (let i = 0; i < this.operationQueue.length; i++) {
        const operation = this.operationQueue[i];
        if (operation?.status === 'failed') {
          continue;
        }

        try {
          const result = await this.executeOperation(operation);
          // Remover operación exitosa
          this.operationQueue.splice(i, 1);
          i--; // Ajustar índice
          await this.savePendingOperations();
          this.notifyOperationListeners({ status: 'success', operation, result });
        } catch (error) {
          console.warn('Error ejecutando operación offline:', error);
          operation.lastAttemptAt = new Date().toISOString();
          operation.lastError = error?.message || String(error);

          if (error?.nonRetryable) {
            const wasFailed = operation.status === 'failed';
            operation.status = 'failed';
            operation.error = operation.lastError;
            operation.retryCount = Math.max(Number(operation.retryCount || 0), 3);
            if (!wasFailed) {
              this.notifyOperationListeners({ status: 'failed', operation, error: operation.error });
            }
            await this.savePendingOperations();
            continue;
          }

          operation.retryCount = (operation.retryCount || 0) + 1;

          // Si falló muchas veces, marcar como fallida
          if (operation.retryCount >= 3) {
            const wasFailed = operation.status === 'failed';
            operation.status = 'failed';
            operation.error = operation.lastError;
            if (!wasFailed) {
              this.notifyOperationListeners({ status: 'failed', operation, error: operation.error });
            }
          }
          await this.savePendingOperations();
        }
      }
      await this.savePendingOperations();
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Ejecutar una operación específica
  async executeOperation(operation) {
    const { type } = operation;

    // Aquí implementarías la lógica específica para cada tipo de operación
    switch (type) {
      case 'CREATE_LOTE':
        return await this.syncCreateLote(operation);
      case 'UPDATE_LOTE':
        return await this.syncUpdateLote(operation);
      case 'CREATE_TURNO':
        return await this.syncCreateTurno(operation);
      case 'UPDATE_UBICACION':
        return await this.syncUpdateUbicacion(operation);
      default:
        throw new Error(`Tipo de operación no soportado: ${type}`);
    }
  }

  // Implementaciones específicas de sincronización
  async syncCreateLote(operation) {
    const data = operation?.data;
    const response = await this.fetchWithRetry(`${API_URL}/lotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`,
        'Idempotency-Key': `offline_${String(operation?.id)}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Error sincronizando lote');
    }

    return response.json();
  }

  async syncUpdateLote(operation) {
    const data = operation?.data;
    const response = await this.fetchWithRetry(`${API_URL}/lotes/${data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`,
        'Idempotency-Key': `offline_${String(operation?.id)}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Error sincronizando actualización de lote');
    }

    return response.json();
  }

  async syncCreateTurno(operation) {
    const data = operation?.data;
    const response = await this.fetchWithRetry(`${API_URL}/turnos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`,
        'Idempotency-Key': `offline_${String(operation?.id)}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      let msg = 'No se pudo sincronizar el turno';
      try {
        const j = await response.json();
        msg = j?.message || j?.error || msg;
      } catch {
        try {
          const t = await response.text();
          if (t) msg = t;
        } catch {}
      }
      const err = new Error(msg);
      err.httpStatus = response.status;
      err.nonRetryable = response.status >= 400 && response.status < 500 && response.status !== 429;
      throw err;
    }

    return response.json();
  }

  async syncUpdateUbicacion(operation) {
    const data = operation?.data;
    const productorId = data?.productorId || data?.id || data?.productor?.id;
    const ubicaciones = data?.ubicaciones;
    const campos = data?.campos;
    const campoActivoId = data?.campoActivoId;
    if (!productorId || (!ubicaciones && !campos && !campoActivoId)) {
      throw new Error('Datos de ubicación incompletos');
    }

    const response = await this.fetchWithRetry(`${API_URL}/productores/${productorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`,
        'Idempotency-Key': `offline_${String(operation?.id)}`
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
    const failed = this.operationQueue.filter(op => op?.status === 'failed');
    const pending = this.operationQueue.filter(op => op?.status !== 'failed');
    return {
      isOnline: this.isOnline,
      pendingOperations: pending.length,
      failedOperations: failed.length,
      lastFailedError: failed.length > 0 ? (failed[failed.length - 1]?.error || failed[failed.length - 1]?.lastError || null) : null,
      isProcessing: this.isProcessingQueue
    };
  }

  // Limpiar operaciones fallidas (opcional)
  async clearFailedOperations() {
    this.operationQueue = this.operationQueue.filter(op => op.status !== 'failed');
    await this.savePendingOperations();
  }

  async clearPendingOperations() {
    this.operationQueue = this.operationQueue.filter(op => op?.status === 'failed');
    await this.savePendingOperations();
  }

  async retryFailedOperations() {
    let changed = false;
    this.operationQueue = this.operationQueue.map(op => {
      if (op?.status !== 'failed') return op;
      changed = true;
      return {
        ...op,
        status: 'pending',
        retryCount: 0,
        lastError: null,
        error: null,
        lastAttemptAt: null
      };
    });
    if (changed) {
      await this.savePendingOperations();
    }
    if (this.isOnline) {
      await this.processQueue();
    }
  }

  async syncNow() {
    if (!this.isOnline) return;
    await this.processQueue();
  }
}

// Singleton
const offlineManager = new OfflineManager();
export default offlineManager;
