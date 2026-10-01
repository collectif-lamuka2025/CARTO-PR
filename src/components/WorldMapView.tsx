import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initMapLibreWorker } from '../utils/maplibreSetup';
import { Category, PartnerLocation, GPSState } from '../types';
import { usePreferences } from '../context/PreferencesContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getMapLibreStyle, MapTypeMode } from '../utils/mapStyles';
import { calculateRoute, RouteCalculationResult } from '../utils/routeService';
import {
  Layers,
  Search,
  Maximize2,
  Navigation,
  Compass,
  Phone,
  Calendar,
  User,
  ExternalLink,
  Tag,
  MapPin,
  Route,
  X,
  Car,
  Footprints,
  Bike,
  Radio,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  WifiOff,
  Info,
  EyeOff,
  Trash2,
  Crosshair,
  Filter,
  Check,
  Plus,
} from 'lucide-react';

// Distance helper (Haversine formula in meters) to prevent GPS jitter re-calculations
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Integrated MapLibre Control for high-precision GPS positioning (pure icon-only, integrated alongside zoom controls)
class LocateControl implements maplibregl.IControl {
  private container: HTMLElement;
  private btn: HTMLButtonElement;

  constructor(onClick: () => void) {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.title = 'Me localiser avec précision (Vous êtes ici)';
    this.btn.setAttribute('aria-label', 'Me localiser');
    this.btn.className = 'maplibregl-ctrl-locate-btn';
    this.btn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;pointer-events:none;"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;

    const handler = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    };

    this.btn.addEventListener('click', handler);
    this.btn.addEventListener('touchend', handler);
    this.container.appendChild(this.btn);
  }

  onAdd(): HTMLElement {
    return this.container;
  }

  onRemove(): void {
    this.container.parentNode?.removeChild(this.container);
  }

  setLoading(loading: boolean) {
    if (loading) {
      this.btn.style.animation = 'spin 1s linear infinite';
      this.btn.style.color = '#06b6d4';
    } else {
      this.btn.style.animation = '';
      this.btn.style.color = '';
    }
  }
}

interface WorldMapViewProps {
  locations: PartnerLocation[];
  categories: Category[];
  onNavigateToCapture: () => void;
  gps?: GPSState;
  routeTarget?: PartnerLocation | null;
  onClearRoute?: () => void;
  onSetRouteTarget?: (loc: PartnerLocation | null) => void;
  onSimulateGPS?: () => void;
  onRefreshGPS?: () => void;
}

export const WorldMapView: React.FC<WorldMapViewProps> = ({
  locations,
  categories,
  onNavigateToCapture,
  gps,
  routeTarget,
  onClearRoute,
  onSetRouteTarget,
  onSimulateGPS,
  onRefreshGPS,
}) => {
  const { t, accentConfig } = usePreferences();
  const isOnline = useOnlineStatus();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [optionsCollapsed, setOptionsCollapsed] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<PartnerLocation | null>(null);
  const [mapTypeId, setMapTypeId] = useState<MapTypeMode>('roadmap');
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  // High-precision geolocation and user tracking state
  const [isLocating, setIsLocating] = useState(false);
  const [locateFeedback, setLocateFeedback] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const [lastKnownUserPos, setLastKnownUserPos] = useState<{ lat: number; lng: number; accuracy?: number | null } | null>(null);

  // Category filter dropdown state & refs
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const handleLocateMeRef = useRef<() => void>(() => {});
  const locateControlRef = useRef<LocateControl | null>(null);

  // Close category dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
    };
    if (isCategoryMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCategoryMenuOpen]);

  const activeCategory = useMemo(() => {
    if (selectedCategoryId === 'all') return null;
    return categories.find((c) => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  // Active route state
  const [activeRouteTarget, setActiveRouteTarget] = useState<PartnerLocation | null>(
    routeTarget || null
  );
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING' | 'BICYCLING'>('DRIVING');
  const [routeInfo, setRouteInfo] = useState<RouteCalculationResult | null>(null);
  const [isRoutePanelCollapsed, setIsRoutePanelCollapsed] = useState(false);

  // Tracking refs to prevent unwanted auto-recentering and GPS spam
  const hasFittedRouteRef = useRef<boolean>(false);
  const lastRouteTargetIdRef = useRef<string | null>(null);
  const lastOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastTravelModeRef = useRef<string | null>(null);

  // Sync routeTarget prop from parent
  useEffect(() => {
    if (routeTarget) {
      setActiveRouteTarget(routeTarget);
      setSelectedLocation(null);
      hasFittedRouteRef.current = false;
      setIsRoutePanelCollapsed(false);
    }
  }, [routeTarget]);

  // Origin coordinates derived from live GPS
  const originCoords = useMemo(() => {
    if (
      gps?.latitude !== null &&
      gps?.latitude !== undefined &&
      gps?.longitude !== null &&
      gps?.longitude !== undefined
    ) {
      return { lat: gps.latitude, lng: gps.longitude };
    }
    return null;
  }, [gps?.latitude, gps?.longitude]);

  // Filter locations by selected category and search query
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const matchesCategory =
        selectedCategoryId === 'all' || loc.categoryId === selectedCategoryId;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        loc.name.toLowerCase().includes(query) ||
        (loc.partnerName && loc.partnerName.toLowerCase().includes(query)) ||
        (loc.notes && loc.notes.toLowerCase().includes(query)) ||
        (loc.phone && loc.phone.includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [locations, selectedCategoryId, searchQuery]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    locations.forEach((loc) => {
      counts[loc.categoryId] = (counts[loc.categoryId] || 0) + 1;
    });
    return counts;
  }, [locations]);

  // Default center (average of locations or Kinshasa)
  const defaultCenter = useMemo<[number, number]>(() => {
    if (locations.length > 0) {
      const avgLat = locations.reduce((acc, l) => acc + l.latitude, 0) / locations.length;
      const avgLng = locations.reduce((acc, l) => acc + l.longitude, 0) / locations.length;
      return [avgLng, avgLat]; // [lng, lat]
    }
    return [15.2663, -4.4419]; // Kinshasa / Central Africa
  }, [locations]);

  // 1. Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    initMapLibreWorker();

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapLibreStyle(mapTypeId),
      center: defaultCenter,
      zoom: locations.length > 0 ? 5 : 3,
      maxZoom: 20,
      attributionControl: { compact: true },
    });

    // Gracefully absorb transient tile fetch or offline network errors
    map.on('error', (e) => {
      const msg = e?.error?.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('AJAXError') || msg.includes('404')) {
        return;
      }
      console.warn('Notice carte:', msg);
    });

    // Add integrated high-precision locate control alongside Navigation zoom controls (+ / -)
    const locateCtrl = new LocateControl(() => {
      handleLocateMeRef.current?.();
    });
    map.addControl(locateCtrl, 'bottom-right');
    locateControlRef.current = locateCtrl;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Handle map style changes (Roadmap / Satellite / Hybrid / Terrain)
  const prevMapTypeRef = useRef<MapTypeMode>(mapTypeId);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || prevMapTypeRef.current === mapTypeId) return;
    prevMapTypeRef.current = mapTypeId;

    map.setStyle(getMapLibreStyle(mapTypeId));

    // Re-add route layer after style reload if active
    const handleStyleLoad = () => {
      if (activeRouteTarget && originCoords && routeInfo) {
        drawRouteLayer(map, routeInfo.coordinates, travelMode);
      }
    };
    map.once('style.load', handleStyleLoad);
  }, [mapTypeId, activeRouteTarget, originCoords, routeInfo, travelMode]);

  // 3. Render Location Markers with Custom HTML Elements
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredLocations.forEach((loc) => {
      const color = loc.categoryColor || '#3B82F6';
      const isSelected = selectedLocation?.id === loc.id || activeRouteTarget?.id === loc.id;

      // Create custom pin element
      const el = document.createElement('div');
      el.className = 'carto-partner-marker select-none cursor-pointer';
      el.style.transform = isSelected ? 'scale(1.25)' : 'scale(1)';
      el.style.transition = 'transform 0.2s ease';
      el.title = `${loc.name} (${loc.categoryName || 'Partenaire'})`;

      const initials = loc.name ? loc.name.slice(0, 2).toUpperCase() : '📍';

      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <span style="position: absolute; inset: -4px; border-radius: 9999px; background-color: ${color}; opacity: 0.5; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></span>
          <div style="position: relative; width: 34px; height: 34px; border-radius: 9999px; background-color: ${color}; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
            ${initials}
          </div>
          <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 7px solid ${color}; margin-top: -1px; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));"></div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedLocation(loc);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([loc.longitude, loc.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [filteredLocations, selectedLocation?.id, activeRouteTarget?.id]);

  // Keep lastKnownUserPos up to date whenever originCoords / gps change
  useEffect(() => {
    if (originCoords) {
      setLastKnownUserPos({
        lat: originCoords.lat,
        lng: originCoords.lng,
        accuracy: gps?.accuracy,
      });
    }
  }, [originCoords, gps?.accuracy]);

  // High-precision locate me handler
  const handleLocateMe = () => {
    const map = mapRef.current;
    if (!map) return;

    setIsLocating(true);
    setLocateFeedback(null);

    // Call app-wide GPS refresh
    onRefreshGPS?.();

    // 1. Instant centering if position is already known in state/GPS
    const knownLat = originCoords?.lat ?? lastKnownUserPos?.lat ?? gps?.latitude ?? null;
    const knownLng = originCoords?.lng ?? lastKnownUserPos?.lng ?? gps?.longitude ?? null;
    const knownAcc = gps?.accuracy ?? lastKnownUserPos?.accuracy ?? null;

    if (knownLat !== null && knownLng !== null) {
      map.flyTo({
        center: [knownLng, knownLat],
        zoom: 17.5,
        speed: 1.4,
        curve: 1.2,
        essential: true,
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([knownLng, knownLat]);
      }

      setLocateFeedback({
        message: `Position localisée avec précision (±${knownAcc ? `${knownAcc} m` : 'Optimale'}) — Vous êtes ici`,
        type: 'success',
      });
      setTimeout(() => setLocateFeedback(null), 4000);
    }

    // 2. Request fresh satellite lock via navigator.geolocation
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy * 10) / 10;

          setLastKnownUserPos({ lat, lng, accuracy });

          map.flyTo({
            center: [lng, lat],
            zoom: 17.5,
            speed: 1.4,
            curve: 1.2,
            essential: true,
          });

          if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat([lng, lat]);
          }

          setIsLocating(false);
          setLocateFeedback({
            message: `Position actualisée avec haute précision (±${accuracy} m) — Vous êtes ici`,
            type: 'success',
          });
          setTimeout(() => setLocateFeedback(null), 4000);
        },
        (err) => {
          console.warn('Erreur localisation GPS:', err);
          setIsLocating(false);

          if (knownLat !== null && knownLng !== null) {
            // Already centered on known position
            return;
          }

          if (onSimulateGPS) {
            onSimulateGPS();
            setLocateFeedback({
              message: 'Position de test activée — Vous êtes ici',
              type: 'warning',
            });
            setTimeout(() => setLocateFeedback(null), 4500);
          } else {
            setLocateFeedback({
              message: 'Veuillez autoriser la géolocalisation dans les paramètres de votre navigateur.',
              type: 'warning',
            });
            setTimeout(() => setLocateFeedback(null), 5000);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setIsLocating(false);
      if (knownLat === null && onSimulateGPS) {
        onSimulateGPS();
      }
    }
  };

  // Keep ref up to date so LocateControl always calls the latest handleLocateMe
  handleLocateMeRef.current = handleLocateMe;

  useEffect(() => {
    locateControlRef.current?.setLoading(isLocating);
  }, [isLocating]);

  // 4. Render User Live GPS Marker Beacon
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const effectiveCoords =
      originCoords ||
      (lastKnownUserPos ? { lat: lastKnownUserPos.lat, lng: lastKnownUserPos.lng } : null);

    if (!effectiveCoords) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'carto-user-beacon select-none pointer-events-none';
      el.style.zIndex = '999';
      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 4px 12px rgba(6, 182, 212, 0.6));">
          <span style="position: absolute; width: 48px; height: 48px; border-radius: 9999px; background-color: rgba(6, 182, 212, 0.4); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <div style="position: relative; width: 26px; height: 26px; border-radius: 9999px; background: linear-gradient(135deg, #06b6d4, #2563eb); border: 2.5px solid #ffffff; box-shadow: 0 0 16px #06b6d4, 0 4px 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">
            <div style="width: 8px; height: 8px; border-radius: 9999px; background-color: #ffffff; box-shadow: 0 0 6px #ffffff;"></div>
          </div>
          <div style="margin-top: 4px; padding: 2.5px 8px; border-radius: 9999px; background-color: rgba(15, 23, 42, 0.95); color: #67e8f9; font-size: 10px; font-weight: 800; border: 1.5px solid rgba(6, 182, 212, 0.6); box-shadow: 0 4px 10px rgba(0,0,0,0.4); white-space: nowrap; letter-spacing: 0.02em;">
            📍 Vous êtes ici
          </div>
        </div>
      `;

      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([effectiveCoords.lng, effectiveCoords.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([effectiveCoords.lng, effectiveCoords.lat]);
    }
  }, [originCoords, lastKnownUserPos]);

  // 5. Fit Bounds on filter change or manual recenter
  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeRouteTarget || filteredLocations.length === 0) return;

    if (filteredLocations.length === 1) {
      map.flyTo({
        center: [filteredLocations[0].longitude, filteredLocations[0].latitude],
        zoom: 14,
        essential: true,
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    filteredLocations.forEach((loc) => {
      bounds.extend([loc.longitude, loc.latitude]);
    });

    map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
  }, [filteredLocations, recenterTrigger, activeRouteTarget]);

  // 6. Draw Route Function (with optional shouldFitBounds, default false to avoid hijacking user camera)
  const drawRouteLayer = (
    map: maplibregl.Map,
    coords: [number, number][],
    mode: 'DRIVING' | 'WALKING' | 'BICYCLING',
    shouldFitBounds: boolean = false
  ) => {
    const color = mode === 'WALKING' ? '#10b981' : mode === 'BICYCLING' ? '#f59e0b' : '#38bdf8';

    const geojsonData = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: coords,
      },
    };

    if (map.getSource('active-route')) {
      (map.getSource('active-route') as maplibregl.GeoJSONSource).setData(geojsonData);
      if (map.getLayer('active-route-line')) {
        map.setPaintProperty('active-route-line', 'line-color', color);
      }
      if (map.getLayer('active-route-glow')) {
        map.setPaintProperty('active-route-glow', 'line-color', color);
      }
    } else {
      map.addSource('active-route', {
        type: 'geojson',
        data: geojsonData,
      });

      // Glow casing
      map.addLayer({
        id: 'active-route-glow',
        type: 'line',
        source: 'active-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': color,
          'line-width': 9,
          'line-opacity': 0.45,
          'line-blur': 2,
        },
      });

      // Main line
      map.addLayer({
        id: 'active-route-line',
        type: 'line',
        source: 'active-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': color,
          'line-width': 5,
          'line-opacity': 0.95,
        },
      });
    }

    // Only fit bounds if explicitly requested (e.g. on initial calculation or user click)
    if (shouldFitBounds && coords.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      coords.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, { padding: { top: 90, bottom: 90, left: 60, right: 60 }, maxZoom: 16 });
    }
  };

  const fitRouteBounds = () => {
    const map = mapRef.current;
    if (!map || !routeInfo || routeInfo.coordinates.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    routeInfo.coordinates.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds, {
      padding: { top: 90, bottom: 90, left: 60, right: 60 },
      maxZoom: 16,
    });
  };

  const removeRouteLayer = (map: maplibregl.Map) => {
    if (map.getLayer('active-route-line')) map.removeLayer('active-route-line');
    if (map.getLayer('active-route-glow')) map.removeLayer('active-route-glow');
    if (map.getSource('active-route')) map.removeSource('active-route');
  };

  // 7. Handle Route Itinerary Calculation & Display
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!activeRouteTarget || !originCoords) {
      removeRouteLayer(map);
      setRouteInfo(null);
      hasFittedRouteRef.current = false;
      lastRouteTargetIdRef.current = null;
      lastOriginRef.current = null;
      lastTravelModeRef.current = null;
      return;
    }

    const isNewTarget = lastRouteTargetIdRef.current !== activeRouteTarget.id;
    const isNewMode = lastTravelModeRef.current !== travelMode;
    const movedMeters = lastOriginRef.current
      ? getDistanceMeters(
          lastOriginRef.current.lat,
          lastOriginRef.current.lng,
          originCoords.lat,
          originCoords.lng
        )
      : Infinity;

    // Skip recalculation if same target & mode and user has moved less than 25 meters
    if (!isNewTarget && !isNewMode && movedMeters < 25) {
      return;
    }

    lastRouteTargetIdRef.current = activeRouteTarget.id;
    lastTravelModeRef.current = travelMode;
    lastOriginRef.current = { lat: originCoords.lat, lng: originCoords.lng };

    let isMounted = true;

    calculateRoute(
      originCoords,
      { lat: activeRouteTarget.latitude, lng: activeRouteTarget.longitude },
      travelMode
    ).then((result) => {
      if (!isMounted) return;
      setRouteInfo(result);

      if (mapRef.current) {
        // Fit camera ONCE on new target initial route display, NEVER automatically on subsequent GPS updates
        const shouldFit = !hasFittedRouteRef.current;
        if (shouldFit) {
          hasFittedRouteRef.current = true;
        }
        drawRouteLayer(mapRef.current, result.coordinates, travelMode, shouldFit);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeRouteTarget, originCoords?.lat, originCoords?.lng, travelMode]);

  const handleClearRoute = () => {
    setActiveRouteTarget(null);
    setRouteInfo(null);
    hasFittedRouteRef.current = false;
    lastRouteTargetIdRef.current = null;
    lastOriginRef.current = null;
    lastTravelModeRef.current = null;
    setIsRoutePanelCollapsed(false);
    if (mapRef.current) {
      removeRouteLayer(mapRef.current);
    }
    onClearRoute?.();
  };

  const handleStartRoute = (loc: PartnerLocation) => {
    setActiveRouteTarget(loc);
    setSelectedLocation(null);
    hasFittedRouteRef.current = false;
    lastRouteTargetIdRef.current = null;
    setIsRoutePanelCollapsed(false);
    onSetRouteTarget?.(loc);
  };

  return (
    <div className="flex flex-col flex-1 h-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden relative transition-colors">
      {/* Top Filter & Controls Header (Collapsible) */}
      <div className="bg-white/95 dark:bg-slate-950/95 border-b border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 z-10 shadow-sm dark:shadow-lg backdrop-blur-sm transition-all shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="p-1.5 rounded-lg text-white shrink-0 shadow-sm"
                style={{ backgroundColor: accentConfig.hex }}
              >
                <Layers className="w-4 h-4" />
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {t('map.header')}
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0"
                style={{
                  backgroundColor: `${accentConfig.hex}15`,
                  color: accentConfig.hex,
                  borderColor: `${accentConfig.hex}40`,
                }}
              >
                {filteredLocations.length} / {locations.length}
              </span>
            </div>

            {/* Quick Actions & Collapse Toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Recenter Button */}
              <button
                type="button"
                onClick={() => setRecenterTrigger((p) => p + 1)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title={t('common.reframe')}
              >
                <Maximize2 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span className="hidden sm:inline text-[11px] font-semibold">{t('common.reframe')}</span>
              </button>

              {/* Toggle Options Bar */}
              <button
                type="button"
                onClick={() => setOptionsCollapsed((p) => !p)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer border border-slate-300 dark:border-slate-700"
                title={optionsCollapsed ? t('common.expand') : t('common.collapse')}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">
                  {optionsCollapsed ? t('common.options') : t('common.collapse')}
                </span>
                {optionsCollapsed ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Body: Search + Category Filter Dropdown + Map Type */}
          {!optionsCollapsed && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 animate-fade-in">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('common.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Right Controls: Category Dropdown Filter & Map Type Switcher */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Category Dropdown Filter Button (Déroulant) */}
                <div className="relative" ref={categoryMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                      selectedCategoryId !== 'all'
                        ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-100 ring-1 ring-blue-400/40'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="Filtrer les partenaires par catégorie"
                    aria-expanded={isCategoryMenuOpen}
                  >
                    <Filter className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />

                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Catégorie :</span>
                      {activeCategory ? (
                        <span className="flex items-center gap-1.5 font-bold truncate max-w-[130px] sm:max-w-[170px]">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: activeCategory.color || '#3B82F6' }}
                          />
                          <span className="truncate">{activeCategory.name}</span>
                        </span>
                      ) : (
                        <span className="font-bold">Toutes</span>
                      )}
                    </span>

                    <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                      {selectedCategoryId === 'all' ? locations.length : (categoryCounts[selectedCategoryId] || 0)}
                    </span>

                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                        isCategoryMenuOpen ? 'rotate-180 text-blue-600 dark:text-cyan-400' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu Panel: Dérouler les catégories pour sélectionner ou enrôler */}
                  {isCategoryMenuOpen && (
                    <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-72 sm:w-84 max-h-[75vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-fade-in">
                      {/* Header */}
                      <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Filtrer par catégorie
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          {categories.length} catégories
                        </span>
                      </div>

                      {/* Category List */}
                      <div className="overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40">
                        {/* Option: Toutes les catégories */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId('all');
                              setIsCategoryMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              selectedCategoryId === 'all'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                  selectedCategoryId === 'all'
                                    ? 'border-white bg-white text-blue-600'
                                    : 'border-slate-400'
                                }`}
                              >
                                {selectedCategoryId === 'all' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </span>
                              <span>Toutes les catégories</span>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                selectedCategoryId === 'all'
                                  ? 'bg-white/25 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {locations.length}
                            </span>
                          </button>
                        </div>

                        {/* Individual Category Items */}
                        <div className="pt-1 space-y-1">
                          {categories.map((cat) => {
                            const count = categoryCounts[cat.id] || 0;
                            const isSelected = selectedCategoryId === cat.id;

                            return (
                              <div
                                key={cat.id}
                                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all ${
                                  isSelected
                                    ? 'bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-700/60'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCategoryId(cat.id);
                                    setIsCategoryMenuOpen(false);
                                  }}
                                  className="flex-1 flex items-center gap-2 text-left text-xs font-semibold cursor-pointer min-w-0 pr-2"
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs flex items-center justify-center text-white text-[9px]"
                                    style={{ backgroundColor: cat.color || '#3B82F6' }}
                                  >
                                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </span>
                                  <span
                                    className={`truncate ${
                                      isSelected
                                        ? 'text-blue-950 dark:text-blue-100 font-bold'
                                        : 'text-slate-800 dark:text-slate-200'
                                    }`}
                                  >
                                    {cat.name}
                                  </span>
                                </button>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      isSelected
                                        ? 'bg-blue-200 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    {count}
                                  </span>

                                  {/* Quick Enrol / Relever button for this category */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsCategoryMenuOpen(false);
                                      onNavigateToCapture();
                                    }}
                                    className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-0.5 border border-emerald-300/40"
                                    title={`Enrôler un nouveau partenaire sous ${cat.name}`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span className="hidden sm:inline">Enrôler</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCategoryMenuOpen(false);
                            onNavigateToCapture();
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Enrôler un partenaire</span>
                        </button>

                        {selectedCategoryId !== 'all' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId('all');
                              setIsCategoryMenuOpen(false);
                            }}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                          >
                            Réinitialiser
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reset filter button if active */}
                {selectedCategoryId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId('all')}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Effacer le filtre et afficher toutes les catégories"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Map Type Switcher */}
                <select
                  value={mapTypeId}
                  onChange={(e) => setMapTypeId(e.target.value as MapTypeMode)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="roadmap">🗺️ {t('map.modeRoad')} (Carto)</option>
                  <option value="satellite">🛰️ {t('map.modeSat')} (HD)</option>
                  <option value="hybrid">🌐 {t('map.modeHyb')}</option>
                  <option value="terrain">⛰️ {t('map.modeTer')}</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Map Container */}
      <div className="relative flex-1 w-full h-full">
        {/* MapLibre Container Ref */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* User Requirement 4: Discrete Offline Indicator ("Mode hors ligne — zones déjà visitées uniquement") */}
        {!isOnline && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 animate-fade-in pointer-events-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-semibold shadow-xl">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Mode hors ligne — zones déjà visitées uniquement</span>
              <span
                className="ml-1 text-[10px] text-slate-400 border-l border-slate-700 pl-2 hidden sm:inline"
                title="Les tuiles des zones déjà explorées sont servies depuis le cache local."
              >
                Tuiles en cache
              </span>
            </div>
          </div>
        )}

        {/* Selected Partner Location Floating Card */}
        {selectedLocation && (
          <div className="absolute bottom-6 right-4 sm:right-6 z-20 w-[92%] sm:w-96 max-h-[85vh] overflow-y-auto animate-fade-in pointer-events-auto">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xl text-slate-900 dark:text-slate-100">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs"
                  style={{
                    backgroundColor: selectedLocation.categoryColor || '#3B82F6',
                  }}
                >
                  {selectedLocation.categoryName || 'Partenaire'}
                </span>
                <button
                  onClick={() => setSelectedLocation(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug">
                {selectedLocation.name}
              </h3>
              {selectedLocation.partnerName && (
                <p className="text-xs text-blue-600 dark:text-cyan-400 font-semibold mt-0.5">
                  👤 {selectedLocation.partnerName}
                </p>
              )}

              {/* Coordinates Grid */}
              <div className="mt-2.5 p-2.5 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Latitude</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLocation.latitude.toFixed(6)}°
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Longitude</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLocation.longitude.toFixed(6)}°
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Altitude</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLocation.altitude !== null && selectedLocation.altitude !== undefined
                      ? `${selectedLocation.altitude} m`
                      : 'N/D'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Précision GPS</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {selectedLocation.accuracy !== null && selectedLocation.accuracy !== undefined
                      ? `± ${selectedLocation.accuracy} m`
                      : 'Optimale'}
                  </span>
                </div>
              </div>

              {/* Phone & Notes */}
              {selectedLocation.phone && (
                <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <a
                    href={`tel:${selectedLocation.phone}`}
                    className="font-medium hover:underline text-blue-600 dark:text-cyan-400"
                  >
                    {selectedLocation.phone}
                  </a>
                </div>
              )}

              {selectedLocation.notes && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 italic bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 line-clamp-3">
                  "{selectedLocation.notes}"
                </p>
              )}

              {/* Agent & Date Footer */}
              <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1 truncate max-w-[150px]">
                  <User className="w-3 h-3 text-slate-400" />
                  {selectedLocation.agentEmail || 'Agent terrain'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {new Date(selectedLocation.createdAt).toLocaleDateString('fr-FR')}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="mt-3 pt-1 flex flex-col gap-2">
                <button
                  onClick={() => handleStartRoute(selectedLocation)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
                >
                  <Route className="w-4 h-4 text-cyan-300" />
                  <span>Tracer l'itinéraire direct</span>
                </button>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedLocation.latitude},${selectedLocation.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ouvrir dans Google Maps externe</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Floating Route Details HUD Card (Expanded) */}
        {activeRouteTarget && !isRoutePanelCollapsed && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-xl animate-fade-in pointer-events-auto">
            <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-4 shadow-2xl text-white">
              {/* Card Header */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                    <Route className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                      <span>Itinéraire vers {activeRouteTarget.partnerName || activeRouteTarget.name}</span>
                    </h2>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold inline-block mt-0.5"
                      style={{
                        backgroundColor: (activeRouteTarget.categoryColor || '#3B82F6') + '33',
                        color: activeRouteTarget.categoryColor || '#60a5fa',
                      }}
                    >
                      ● {activeRouteTarget.categoryName || 'Partenaire'}
                    </span>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Recenter button */}
                  <button
                    onClick={fitRouteBounds}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Recentrer la vue sur l'itinéraire"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>

                  {/* Minimize / Hide window button (keeps route line visible) */}
                  <button
                    onClick={() => setIsRoutePanelCollapsed(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer text-xs font-semibold"
                    title="Masquer la fenêtre pour explorer librement la carte (le tracé reste affiché)"
                  >
                    <ChevronUp className="w-4 h-4" />
                    <span className="hidden sm:inline">Masquer</span>
                  </button>

                  {/* Close window (minimizes panel so route is NOT lost) */}
                  <button
                    onClick={() => setIsRoutePanelCollapsed(true)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Fermer la fenêtre (le tracé reste affiché sur la carte)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Origin & Destination Telemetry */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <span>Départ : Votre position exacte</span>
                  </div>
                  {originCoords ? (
                    <div className="mt-1 font-mono text-[11px] text-slate-200">
                      {originCoords.lat.toFixed(5)}°, {originCoords.lng.toFixed(5)}°
                      {gps?.accuracy && (
                        <span className="text-[10px] text-emerald-400 ml-1.5 font-sans">
                          (±{gps.accuracy}m)
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-amber-400">Signal GPS en attente...</span>
                      {onSimulateGPS && (
                        <button
                          onClick={onSimulateGPS}
                          className="px-2 py-0.5 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold cursor-pointer"
                        >
                          Position Test
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    <span>Arrivée : {activeRouteTarget.partnerName || activeRouteTarget.name}</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-200">
                    {activeRouteTarget.latitude.toFixed(5)}°, {activeRouteTarget.longitude.toFixed(5)}°
                  </div>
                </div>
              </div>

              {/* Mode Selector & Distance / Navigation Bar */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-800/80">
                {/* Transport Mode */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 text-xs">
                  <button
                    onClick={() => setTravelMode('DRIVING')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      travelMode === 'DRIVING'
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>Voiture</span>
                  </button>
                  <button
                    onClick={() => setTravelMode('WALKING')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      travelMode === 'WALKING'
                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Footprints className="w-3.5 h-3.5" />
                    <span>À pied</span>
                  </button>
                  <button
                    onClick={() => setTravelMode('BICYCLING')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      travelMode === 'BICYCLING'
                        ? 'bg-amber-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Bike className="w-3.5 h-3.5" />
                    <span>Vélo</span>
                  </button>
                </div>

                {/* Distance & Duration badge */}
                {routeInfo && (
                  <div className="flex items-center gap-2.5 bg-blue-950/70 px-3 py-1.5 rounded-xl border border-blue-500/30 text-xs">
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-bold">
                        Distance {routeInfo.isDirectLine && '(vol d’oiseau)'}
                      </span>
                      <span className="font-bold text-cyan-300 text-xs sm:text-sm">
                        {routeInfo.distanceText}
                      </span>
                    </div>
                    <div className="w-[1px] h-5 bg-slate-700" />
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-bold">
                        Durée
                      </span>
                      <span className="font-bold text-white text-xs sm:text-sm">
                        {routeInfo.durationText}
                      </span>
                    </div>
                  </div>
                )}

                {/* External Voice GPS Launcher */}
                {originCoords && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${originCoords.lat},${originCoords.lng}&destination=${activeRouteTarget.latitude},${activeRouteTarget.longitude}&travelmode=${travelMode.toLowerCase()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md transition-all border border-emerald-400/30"
                    title="Lancer le guidage vocal tour-par-tour dans Google Maps"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Guidage GPS externe</span>
                  </a>
                )}
              </div>

              {/* Bottom Card Controls: Minimize (keep route) vs Clear (delete route) */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsRoutePanelCollapsed(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition-colors cursor-pointer text-[11px] font-medium"
                  title="Masquer cette fenêtre pour naviguer librement sur la carte (le tracé reste affiché)"
                >
                  <EyeOff className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Masquer la fenêtre (garder le tracé)</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearRoute}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer text-[11px] font-medium"
                  title="Effacer le tracé et annuler l'itinéraire"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Effacer l'itinéraire</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Route Details HUD Card (Minimized Pill - keeps route line 100% active on the map) */}
        {activeRouteTarget && isRoutePanelCollapsed && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-fade-in max-w-[94%]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-cyan-500/50 shadow-2xl text-white text-xs">
              <span className="p-1 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
                <Route className="w-4 h-4" />
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-slate-100 truncate max-w-[130px] sm:max-w-[200px]">
                  {activeRouteTarget.partnerName || activeRouteTarget.name}
                </span>
                {routeInfo && (
                  <span className="text-cyan-300 font-mono text-[11px] bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-500/30 shrink-0">
                    {routeInfo.distanceText} • {routeInfo.durationText}
                  </span>
                )}
              </div>

              <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

              {/* Recenter button */}
              <button
                onClick={fitRouteBounds}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Recentrer la carte sur l'itinéraire"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {/* Expand / Details button */}
              <button
                onClick={() => setIsRoutePanelCollapsed(false)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-sm"
                title="Afficher les options et détails de l'itinéraire"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Options & Détails</span>
              </button>

              {/* Clear route button */}
              <button
                onClick={handleClearRoute}
                className="p-1.5 rounded-lg hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                title="Effacer le tracé et quitter l'itinéraire"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Floating Quick Legend & Stats Badge */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none hidden lg:block">
          <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-xl pointer-events-auto text-xs max-w-xs">
            <p className="font-bold text-slate-200 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-cyan-400" />
              Légende Cartographie Partenaires
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Chaque point vibrant avec halo correspond à un partenaire identifié par vos agents
              selon sa catégorie.
            </p>
            <div className="mt-2 space-y-1">
              {categories.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-[11px] text-slate-300">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="truncate">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating High-Precision Notification Feedback Toast */}
        {locateFeedback && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-fade-in max-w-[90%]">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md border ${
                locateFeedback.type === 'success'
                  ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/60'
                  : 'bg-amber-950/90 text-amber-200 border-amber-500/60'
              }`}
            >
              <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{locateFeedback.message}</span>
            </div>
          </div>
        )}

        {/* Empty state notice if category has no points */}
        {filteredLocations.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs pointer-events-none">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md text-center shadow-2xl pointer-events-auto">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">
                Aucun partenaire dans cette sélection
              </h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                {selectedCategoryId !== 'all'
                  ? 'Aucune position n’a encore été enregistrée sous cette catégorie.'
                  : 'Commencez par déployer vos agents sur le terrain et relever des positions GPS.'}
              </p>
              <div className="flex justify-center gap-2">
                {selectedCategoryId !== 'all' && (
                  <button
                    onClick={() => setSelectedCategoryId('all')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
                  >
                    Voir toutes les catégories
                  </button>
                )}
                <button
                  onClick={onNavigateToCapture}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Relever une position maintenant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
