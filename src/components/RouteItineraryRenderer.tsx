import React, { useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { PartnerLocation } from '../types';

declare const google: any;

interface RouteItineraryRendererProps {
  origin: { lat: number; lng: number } | null;
  destination: PartnerLocation;
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING';
  onRouteCalculated: (info: {
    distance: string;
    duration: string;
    stepsCount?: number;
    isDirectLine?: boolean;
  }) => void;
}

// Distance calculation for fallback / offline
function getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
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

export const RouteItineraryRenderer: React.FC<RouteItineraryRendererProps> = ({
  origin,
  destination,
  travelMode,
  onRouteCalculated,
}) => {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const rendererRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !origin) return;

    const destCoords = { lat: destination.latitude, lng: destination.longitude };

    // Clean up any previous renderers or polylines
    if (rendererRef.current) {
      rendererRef.current.setMap(null);
      rendererRef.current = null;
    }
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // Fallback direct line renderer
    const renderDirectPolyline = (reason?: string) => {
      console.warn('Utilisation tracé géodésique direct:', reason);
      const distKm = getHaversineDistanceKm(
        origin.lat,
        origin.lng,
        destCoords.lat,
        destCoords.lng
      );

      // Estimate time: ~40 km/h driving, 4.5 km/h walking, 15 km/h bicycling
      const speedKmH =
        travelMode === 'WALKING' ? 4.5 : travelMode === 'BICYCLING' ? 15 : 40;
      const durationMin = Math.max(1, Math.round((distKm / speedKmH) * 60));
      const durationText =
        durationMin >= 60
          ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}min`
          : `${durationMin} min`;

      onRouteCalculated({
        distance: distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm} km`,
        duration: `~${durationText}`,
        isDirectLine: true,
      });

      const poly = new google.maps.Polyline({
        path: [origin, destCoords],
        geodesic: true,
        strokeColor: '#38bdf8',
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 3,
              fillColor: '#38bdf8',
              fillOpacity: 1,
              strokeWeight: 1,
              strokeColor: '#ffffff',
            },
            offset: '50%',
          },
        ],
      });
      polylineRef.current = poly;

      // Fit bounds to show both points with comfort padding
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(destCoords);
      map.fitBounds(bounds, { top: 90, right: 60, bottom: 90, left: 60 });
    };

    // If routes library is loaded and online, request turn-by-turn road route
    if (routesLibrary && navigator.onLine) {
      try {
        const directionsService = new routesLibrary.DirectionsService();
        const directionsRenderer = new routesLibrary.DirectionsRenderer({
          map,
          suppressMarkers: true, // We render our custom high-visibility markers
          polylineOptions: {
            strokeColor: travelMode === 'WALKING' ? '#10b981' : '#2563eb',
            strokeWeight: 6,
            strokeOpacity: 0.85,
          },
        });
        rendererRef.current = directionsRenderer;

        const modeMap: Record<string, any> = {
          DRIVING: google.maps.TravelMode.DRIVING,
          WALKING: google.maps.TravelMode.WALKING,
          BICYCLING: google.maps.TravelMode.BICYCLING,
        };

        directionsService.route(
          {
            origin,
            destination: destCoords,
            travelMode: modeMap[travelMode] || google.maps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              directionsRenderer.setDirections(result);

              const leg = result.routes[0]?.legs[0];
              if (leg) {
                onRouteCalculated({
                  distance: leg.distance?.text || 'Calculée',
                  duration: leg.duration?.text || 'Calculée',
                  stepsCount: leg.steps?.length || 0,
                  isDirectLine: false,
                });
              }

              // Fit map camera bounds to route
              if (result.routes[0]?.bounds) {
                map.fitBounds(result.routes[0].bounds, {
                  top: 90,
                  right: 60,
                  bottom: 90,
                  left: 60,
                });
              }
            } else {
              renderDirectPolyline(`DirectionsService status: ${status}`);
            }
          }
        );
      } catch (err: any) {
        renderDirectPolyline(err?.message || 'Erreur service');
      }
    } else {
      // Offline mode or service unavailable
      renderDirectPolyline('Mode hors-ligne');
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.setMap(null);
      }
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [map, routesLibrary, origin?.lat, origin?.lng, destination.id, travelMode]);

  return null;
};
