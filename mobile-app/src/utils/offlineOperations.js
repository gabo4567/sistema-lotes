// src/utils/offlineOperations.js
import offlineManager from './OfflineManager';
import { API_URL } from './constants';

// Operaciones offline para Lotes
export const offlineLotesOperations = {
  // Crear lote offline
  createLote: async (loteData) => {
    try {
      // Intentar crear online primero
      if (offlineManager.isOnline) {
        const response = await fetch(`${API_URL}/lotes`, {
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
      }

      // Si falla o está offline, agregar a queue
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
      // Agregar a queue si hay error
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
        const response = await fetch(`${API_URL}/lotes/${loteId}`, {
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
      }

      // Agregar a queue
      await offlineManager.addToQueue({
        type: 'UPDATE_LOTE',
        data: { ...loteData, id: loteId },
        endpoint: `/lotes/${loteId}`,
        method: 'PUT'
      });

      return { ...loteData, id: loteId, _isOffline: true };

    } catch (error) {
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
        const response = await fetch(`${API_URL}/turnos`, {
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
        if (!productorId || !ubicaciones) {
          throw new Error('Datos de ubicación incompletos');
        }

        const response = await fetch(`${API_URL}/productores/${productorId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await offlineManager.getAuthToken()}`
          },
          body: JSON.stringify({ ubicaciones })
        });

        if (response.ok) {
          return await response.json();
        }
      }

      await offlineManager.addToQueue({
        type: 'UPDATE_UBICACION',
        data: ubicacionData,
        endpoint: '/productores/:id',
        method: 'PUT'
      });

      return { ...ubicacionData, _isOffline: true };

    } catch (error) {
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
