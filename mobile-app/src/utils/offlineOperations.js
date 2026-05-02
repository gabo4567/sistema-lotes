// src/utils/offlineOperations.js
import offlineManager from './OfflineManager';
import { API_URL } from './constants';

// Operaciones offline para Lotes
export const offlineLotesOperations = {
  // Crear lote offline
  createLote: async (loteData) => {
    try {
      if (offlineManager.isOnline) {
        const response = await offlineManager.fetchWithRetry(`${API_URL}/lotes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await offlineManager.getAuthToken()}`
          },
          body: JSON.stringify(loteData)
        });

        if (response.ok) {
          return await response.json();
        }
        let msg = 'Error al guardar lote'
        try {
          const j = await response.json()
          msg = j?.message || j?.error || msg
        } catch {}
        throw new Error(msg)
      }

      const operationId = await offlineManager.addToQueue({
        type: 'CREATE_LOTE',
        data: loteData,
        endpoint: '/lotes',
        method: 'POST'
      });

      // Devolver un objeto temporal con ID de operación
      return {
        ...loteData,
        id: `temp_${operationId}`,
        _isOffline: true,
        _operationId: operationId
      };

    } catch (error) {
      if (error?.code === 'SERVER_WAKING') throw error
      if (offlineManager.isOnline && error?.code !== 'OFFLINE') throw error
      const operationId = await offlineManager.addToQueue({
        type: 'CREATE_LOTE',
        data: loteData,
        endpoint: '/lotes',
        method: 'POST'
      });

      return {
        ...loteData,
        id: `temp_${operationId}`,
        _isOffline: true,
        _operationId: operationId
      };
    }
  },

  // Actualizar lote offline
  updateLote: async (loteId, loteData) => {
    try {
      if (offlineManager.isOnline) {
        const response = await offlineManager.fetchWithRetry(`${API_URL}/lotes/${loteId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await offlineManager.getAuthToken()}`
          },
          body: JSON.stringify(loteData)
        });

        if (response.ok) {
          return await response.json();
        }
        let msg = 'Error al actualizar lote'
        try {
          const j = await response.json()
          msg = j?.message || j?.error || msg
        } catch {}
        throw new Error(msg)
      }

      await offlineManager.addToQueue({
        type: 'UPDATE_LOTE',
        data: { ...loteData, id: loteId },
        endpoint: `/lotes/${loteId}`,
        method: 'PUT'
      });

      return { ...loteData, id: loteId, _isOffline: true };

    } catch (error) {
      if (error?.code === 'SERVER_WAKING') throw error
      if (offlineManager.isOnline && error?.code !== 'OFFLINE') throw error
      await offlineManager.addToQueue({
        type: 'UPDATE_LOTE',
        data: { ...loteData, id: loteId },
        endpoint: `/lotes/${loteId}`,
        method: 'PUT'
      });

      return { ...loteData, id: loteId, _isOffline: true };
    }
  }
};

// Operaciones offline para Turnos
export const offlineTurnosOperations = {
  createTurno: async (turnoData) => {
    try {
      if (offlineManager.isOnline) {
        const response = await offlineManager.fetchWithRetry(`${API_URL}/turnos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await offlineManager.getAuthToken()}`
          },
          body: JSON.stringify(turnoData)
        });

        if (response.ok) {
          return await response.json();
        }
        let msg = 'Error al solicitar turno'
        try {
          const j = await response.json()
          msg = j?.message || j?.error || msg
        } catch {}
        throw new Error(msg)
      }

      const operationId = await offlineManager.addToQueue({
        type: 'CREATE_TURNO',
        data: turnoData,
        endpoint: '/turnos',
        method: 'POST'
      });

      return {
        ...turnoData,
        id: `temp_${operationId}`,
        _isOffline: true,
        _operationId: operationId
      };

    } catch (error) {
      if (error?.code === 'SERVER_WAKING') throw error
      if (offlineManager.isOnline && error?.code !== 'OFFLINE') throw error
      const operationId = await offlineManager.addToQueue({
        type: 'CREATE_TURNO',
        data: turnoData,
        endpoint: '/turnos',
        method: 'POST'
      });

      return {
        ...turnoData,
        id: `temp_${operationId}`,
        _isOffline: true,
        _operationId: operationId
      };
    }
  }
};

// Operaciones offline para Ubicaciones
export const offlineUbicacionesOperations = {
  updateUbicacion: async (ubicacionData) => {
    try {
      if (offlineManager.isOnline) {
        const productorId = ubicacionData?.productorId || ubicacionData?.id || ubicacionData?.productor?.id;
        const ubicaciones = ubicacionData?.ubicaciones;
        const campos = ubicacionData?.campos;
        const campoActivoId = ubicacionData?.campoActivoId;
        if (!productorId || (!ubicaciones && !campos && !campoActivoId)) {
          throw new Error('Datos de ubicación incompletos');
        }

        const response = await offlineManager.fetchWithRetry(`${API_URL}/productores/${productorId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await offlineManager.getAuthToken()}`
          },
          body: JSON.stringify({ ubicaciones, campos, campoActivoId })
        });

        if (response.ok) {
          return await response.json();
        }
        let msg = 'Error al actualizar ubicación'
        try {
          const j = await response.json()
          msg = j?.message || j?.error || msg
        } catch {}
        throw new Error(msg)
      }

      await offlineManager.addToQueue({
        type: 'UPDATE_UBICACION',
        data: ubicacionData,
        endpoint: '/productores/:id',
        method: 'PUT'
      });

      return { ...ubicacionData, _isOffline: true };

    } catch (error) {
      if (error?.code === 'SERVER_WAKING') throw error
      if (offlineManager.isOnline && error?.code !== 'OFFLINE') throw error
      await offlineManager.addToQueue({
        type: 'UPDATE_UBICACION',
        data: ubicacionData,
        endpoint: '/productores/:id',
        method: 'PUT'
      });

      return { ...ubicacionData, _isOffline: true };
    }
  }
};

// Función helper para mostrar notificaciones offline
export const showOfflineNotification = (message) => {
  // Aquí podrías integrar con un sistema de notificaciones
  console.log('Offline operation:', message);
};
