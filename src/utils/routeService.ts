/**
 * Route calculation service with offline support.
 * Uses public OSRM router when online for road navigation.
 * Uses Haversine direct geodetic path when offline.
 */

export interface RouteCalculationResult {
  coordinates: [number, number][]; // [longitude, latitude] for MapLibre/GeoJSON
  distanceText: string;
  durationText: string;
  distanceKm: number;
  isDirectLine: boolean;
}

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export async function calculateRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' = 'DRIVING'
): Promise<RouteCalculationResult> {
  const distKm = calculateHaversineDistanceKm(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng
  );

  // Fallback direct line calculation
  const getDirectResult = (): RouteCalculationResult => {
    const speedKmH =
      travelMode === 'WALKING' ? 4.5 : travelMode === 'BICYCLING' ? 15 : 40;
    const durationMin = Math.max(1, Math.round((distKm / speedKmH) * 60));
    const durationText =
      durationMin >= 60
        ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}min`
        : `${durationMin} min`;

    return {
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
      distanceText: distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm} km`,
      durationText: `~${durationText}`,
      distanceKm: distKm,
      isDirectLine: true,
    };
  };

  // If offline, return direct geodetic path immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return getDirectResult();
  }

  // Try online road routing via OSRM public service
  try {
    const profile = travelMode === 'WALKING' ? 'foot' : travelMode === 'BICYCLING' ? 'bike' : 'driving';
    // OSRM accepts lng,lat;lng,lat
    const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4 second timeout

    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const routeDistanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMin = Math.max(1, Math.round(route.duration / 60));
        const durationText =
          durationMin >= 60
            ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}min`
            : `${durationMin} min`;

        return {
          coordinates: route.geometry.coordinates as [number, number][],
          distanceText:
            routeDistanceKm < 1
              ? `${Math.round(routeDistanceKm * 1000)} m`
              : `${routeDistanceKm} km`,
          durationText,
          distanceKm: routeDistanceKm,
          isDirectLine: false,
        };
      }
    }
  } catch (err) {
    console.warn('Routage réseau indisponible, repli tracé direct:', err);
  }

  // Fallback to direct geodetic path on error or offline
  return getDirectResult();
}
