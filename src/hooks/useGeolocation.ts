import { useState, useEffect, useCallback, useRef } from 'react';
import { GPSState } from '../types';

export function useGeolocation() {
  const [gps, setGps] = useState<GPSState>({
    latitude: null,
    longitude: null,
    altitude: null,
    accuracy: null,
    heading: null,
    speed: null,
    timestamp: null,
    error: null,
    loading: true,
    watching: false,
  });

  const watchIdRef = useRef<number | null>(null);

  const updateSuccess = useCallback((pos: GeolocationPosition) => {
    setGps({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude: pos.coords.altitude !== null ? Math.round(pos.coords.altitude * 10) / 10 : null,
      accuracy: Math.round(pos.coords.accuracy * 10) / 10,
      heading: pos.coords.heading,
      speed: pos.coords.speed !== null ? Math.round(pos.coords.speed * 3.6 * 10) / 10 : null, // km/h
      timestamp: pos.timestamp,
      error: null,
      loading: false,
      watching: true,
    });
  }, []);

  const updateError = useCallback((err: GeolocationPositionError) => {
    let message = 'Impossible de récupérer la position GPS.';
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = 'Accès à la géolocalisation refusé. Veuillez autoriser le GPS dans votre navigateur.';
        break;
      case err.POSITION_UNAVAILABLE:
        message = 'Signal GPS non disponible. Déplacez-vous à ciel ouvert pour une meilleure réception satellite.';
        break;
      case err.TIMEOUT:
        message = 'Le délai de géolocalisation a expiré. Nouvelle tentative en cours...';
        break;
    }
    setGps((prev) => ({
      ...prev,
      error: message,
      loading: false,
    }));
  }, []);

  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGps((prev) => ({
        ...prev,
        error: 'La géolocalisation n’est pas prise en charge par ce terminal.',
        loading: false,
      }));
      return;
    }

    setGps((prev) => ({ ...prev, loading: true }));

    // Force high accuracy for field precision surveying
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 2000,
    };

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(updateSuccess, updateError, options);
  }, [updateSuccess, updateError]);

  const refreshPosition = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    setGps((prev) => ({ ...prev, loading: true }));
    navigator.geolocation.getCurrentPosition(
      updateSuccess,
      updateError,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [updateSuccess, updateError]);

  const setSimulatedPosition = useCallback((lat: number, lng: number, alt: number = 320, acc: number = 4.5) => {
    setGps({
      latitude: lat,
      longitude: lng,
      altitude: alt,
      accuracy: acc,
      heading: 45,
      speed: 0,
      timestamp: Date.now(),
      error: null,
      loading: false,
      watching: true,
    });
  }, []);

  useEffect(() => {
    startWatching();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [startWatching]);

  return {
    gps,
    refreshPosition,
    startWatching,
    setSimulatedPosition,
  };
}
