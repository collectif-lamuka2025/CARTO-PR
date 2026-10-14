import { useState, useEffect, useCallback, useRef } from 'react';
import { GPSState } from '../types';

const STORAGE_KEY = 'carto_last_known_gps';

export function useGeolocation() {
  // Initialize state immediately from cached position if available (0ms instant fix)
  const [gps, setGps] = useState<GPSState>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return {
            latitude: parsed.lat,
            longitude: parsed.lng,
            altitude: parsed.alt ?? null,
            accuracy: parsed.acc ?? null,
            heading: parsed.heading ?? null,
            speed: null,
            timestamp: parsed.timestamp ?? Date.now(),
            error: null,
            loading: true, // still acquiring fresh satellite fix
            watching: true,
            isHighPrecision: (parsed.acc ?? 99) <= 10,
            satelliteFixType: 'cached',
          };
        }
      }
    } catch (e) {
      console.warn('Erreur lecture cache GPS:', e);
    }

    return {
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
      isHighPrecision: false,
      satelliteFixType: null,
    };
  });

  const watchIdRef = useRef<number | null>(null);
  const bestAccuracyRef = useRef<number>(gps.accuracy ?? 9999);
  const headingRef = useRef<number | null>(null);

  // Compass / Device Orientation Listener for real-time heading
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      let heading: number | null = null;
      // iOS Safari provides webkitCompassHeading (0 = North)
      if ('webkitCompassHeading' in e && typeof (e as any).webkitCompassHeading === 'number') {
        heading = Math.round((e as any).webkitCompassHeading);
      } else if (e.alpha !== null && typeof e.alpha === 'number') {
        heading = Math.round(360 - e.alpha);
        if (heading < 0) heading += 360;
        if (heading >= 360) heading -= 360;
      }

      if (heading !== null) {
        headingRef.current = heading;
        setGps((prev) => {
          if (prev.heading === heading) return prev;
          return { ...prev, heading };
        });
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientationabsolute', handleOrientation as any, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as any, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  const updateSuccess = useCallback((pos: GeolocationPosition, fixType: 'fast' | 'gnss' = 'gnss') => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const alt = pos.coords.altitude !== null ? Math.round(pos.coords.altitude * 10) / 10 : null;
    const acc = Math.round(pos.coords.accuracy * 10) / 10;
    const spd = pos.coords.speed !== null ? Math.round(pos.coords.speed * 3.6 * 10) / 10 : null;
    const heading = pos.coords.heading ?? headingRef.current;

    // Track best accuracy
    if (acc < bestAccuracyRef.current) {
      bestAccuracyRef.current = acc;
    }

    // Persist valid position to localStorage for immediate subsequent app launches
    if (acc <= 50) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            lat,
            lng,
            alt,
            acc,
            heading,
            timestamp: pos.timestamp,
          })
        );
      } catch (e) {
        // ignore
      }
    }

    setGps({
      latitude: lat,
      longitude: lng,
      altitude: alt,
      accuracy: acc,
      heading,
      speed: spd,
      timestamp: pos.timestamp,
      error: null,
      loading: false,
      watching: true,
      isHighPrecision: acc <= 10,
      satelliteFixType: fixType,
    });
  }, []);

  const updateError = useCallback((err: GeolocationPositionError) => {
    let message = 'Impossible de récupérer la position GPS.';
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = 'Accès à la géolocalisation refusé. Veuillez autoriser le GPS dans les réglages du navigateur.';
        break;
      case err.POSITION_UNAVAILABLE:
        message = 'Signal satellite faible. Déplacez-vous à ciel ouvert pour une meilleure triangulation GNSS.';
        break;
      case err.TIMEOUT:
        message = 'Délai d’acquisition satellite dépassé. Recherche active en cours...';
        break;
    }
    setGps((prev) => ({
      ...prev,
      error: prev.latitude !== null ? null : message, // Keep existing coords if already available
      loading: false,
    }));
  }, []);

  // Dual-Tier Geolocation: Fast Fix first (<300ms) + Deep GNSS Satellite Precision
  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGps((prev) => ({
        ...prev,
        error: 'La géolocalisation n’est pas prise en charge par ce terminal.',
        loading: false,
      }));
      return;
    }

    setGps((prev) => ({ ...prev, loading: prev.latitude === null }));

    // 1. FAST WARM FIX: Network / WiFi / Cellular instant triangulated position (50-300ms)
    navigator.geolocation.getCurrentPosition(
      (pos) => updateSuccess(pos, 'fast'),
      () => {}, // ignore non-fatal fallback errors since continuous high-accuracy watch is initiated
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 120000 }
    );

    // 2. HIGH ACCURACY GNSS SATELLITE LOCK: Continuous hardware polling
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 0,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => updateSuccess(pos, 'gnss'),
      updateError,
      options
    );
  }, [updateSuccess, updateError]);

  // Recalibrate / Boost GNSS satellite precision
  const refreshPosition = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    setGps((prev) => ({ ...prev, loading: true }));

    // Force clear and restart hardware satellite acquisition
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => updateSuccess(pos, 'gnss'),
      updateError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Re-engage continuous tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => updateSuccess(pos, 'gnss'),
      updateError,
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
    );
  }, [updateSuccess, updateError]);

  const setSimulatedPosition = useCallback((lat: number, lng: number, alt: number = 320, acc: number = 3.5) => {
    setGps({
      latitude: lat,
      longitude: lng,
      altitude: alt,
      accuracy: acc,
      heading: headingRef.current ?? 45,
      speed: 0,
      timestamp: Date.now(),
      error: null,
      loading: false,
      watching: true,
      isHighPrecision: true,
      satelliteFixType: 'gnss',
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
