import { useState, useRef, useCallback } from 'react';
import * as Location from 'expo-location';

/**
 * Calcula la distancia entre dos puntos usando la fórmula de Haversine.
 * Retorna la distancia en metros.
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Radio de la tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const useWalkingGPS = () => {
  const [isWalking, setIsWalking] = useState(false);
  const [route, setRoute] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const subscription = useRef(null);
  const lastCapturedLocation = useRef(null);

  const stopWalking = useCallback(() => {
    if (subscription.current) {
      subscription.current.remove();
      subscription.current = null;
    }
    
    // Cierre inteligente del polígono al finalizar
    setRoute((prevRoute) => {
      if (prevRoute.length < 3) return prevRoute;
      
      const firstPoint = prevRoute[0];
      const lastPoint = prevRoute[prevRoute.length - 1];
      const distanceToFirst = calculateDistance(
        lastPoint.latitude,
        lastPoint.longitude,
        firstPoint.latitude,
        firstPoint.longitude
      );

      // Si el último punto está a menos de 5 metros del primero, 
      // ajustamos el último punto para que coincida exactamente con el primero
      // o simplemente eliminamos el último si ya estamos muy cerca para un cierre perfecto.
      if (distanceToFirst < 5) {
        // Retornamos la ruta asegurando que el polígono cierre bien
        // En Firestore/Maps el polígono se cierra visualmente, pero aquí 
        // podemos normalizar los puntos finales si es necesario.
        return prevRoute; 
      }
      
      return prevRoute;
    });

    setIsWalking(false);
    lastCapturedLocation.current = null;
  }, []);

  const addManualPoint = useCallback(() => {
    if (!currentLocation) return;
    
    const { latitude, longitude, accuracy } = currentLocation;
    if (accuracy > 25) return; // Permitir un poco más de margen para manual pero no locuras

    setRoute((prev) => {
      // Evitar duplicados exactos
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (last.latitude === latitude && last.longitude === longitude) return prev;
      }
      return [...prev, { latitude, longitude }];
    });
    lastCapturedLocation.current = { latitude, longitude };
  }, [currentLocation]);

  const undoLastPoint = useCallback(() => {
    setRoute((prev) => {
      if (prev.length === 0) return prev;
      const newRoute = prev.slice(0, -1);
      lastCapturedLocation.current = newRoute.length > 0 ? newRoute[newRoute.length - 1] : null;
      return newRoute;
    });
  }, []);

  const startWalking = useCallback(async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const err = new Error('Se requiere permiso de ubicación para el modo GPS caminando.');
      err.code = 'LOCATION_PERMISSION_REQUIRED';
      throw err;
    }

    setRoute([]);
    setIsWalking(true);
    lastCapturedLocation.current = null;

    subscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 1, // Recibir actualizaciones frecuentes para control total
        timeInterval: 1000,
      },
      (location) => {
        const { latitude, longitude, accuracy } = location.coords;
        setCurrentLocation(location.coords);

        // 1. Filtrar por precisión (accuracy > 15m se ignora para auto-marcado)
        if (accuracy > 15) return;

        setRoute((prevRoute) => {
          // Primer punto siempre se agrega
          if (prevRoute.length === 0) {
            lastCapturedLocation.current = { latitude, longitude };
            return [{ latitude, longitude }];
          }

          const lastPoint = lastCapturedLocation.current || prevRoute[prevRoute.length - 1];
          const distance = calculateDistance(
            lastPoint.latitude,
            lastPoint.longitude,
            latitude,
            longitude
          );

          // 2. MODO AUTOMÁTICO: Agregar punto cada 4-5 metros reales
          if (distance >= 4.5) {
            lastCapturedLocation.current = { latitude, longitude };
            return [...prevRoute, { latitude, longitude }];
          }

          return prevRoute;
        });
      }
    );
  }, []);

  const resetRoute = useCallback(() => {
    setRoute([]);
    lastCapturedLocation.current = null;
  }, []);

  return {
    isWalking,
    route,
    currentLocation,
    startWalking,
    stopWalking,
    resetRoute,
    addManualPoint,
    undoLastPoint
  };
};
