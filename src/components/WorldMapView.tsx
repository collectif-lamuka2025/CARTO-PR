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
} from 'lucide-react';

interface WorldMapViewProps {
  locations: PartnerLocation[];
  categories: Category[];
  onNavigateToCapture: () => void;
  gps?: GPSState;
  routeTarget?: PartnerLocation | null;
  onClearRoute?: () => void;
  onSetRouteTarget?: (loc: PartnerLocation | null) => void;
  onSimulateGPS?: () => void;
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

  // Active route state
  const [activeRouteTarget, setActiveRouteTarget] = useState<PartnerLocation | null>(
    routeTarget || null
  );
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING' | 'BICYCLING'>('DRIVING');
  const [routeInfo, setRouteInfo] = useState<RouteCalculationResult | null>(null);

  // Sync routeTarget prop from parent
  useEffect(() => {
    if (routeTarget) {
      setActiveRouteTarget(routeTarget);
      setSelectedLocation(null);
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

  // 4. Render User Live GPS Marker Beacon
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!originCoords) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'carto-user-beacon select-none pointer-events-none';
      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <span style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background-color: rgba(6, 182, 212, 0.35); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <div style="position: relative; width: 24px; height: 24px; border-radius: 9999px; background: linear-gradient(135deg, #06b6d4, #2563eb); border: 2.5px solid #ffffff; box-shadow: 0 0 12px #06b6d4, 0 4px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
            <div style="width: 8px; height: 8px; border-radius: 9999px; background-color: #ffffff;"></div>
          </div>
          <div style="margin-top: 4px; padding: 2px 7px; border-radius: 9999px; background-color: rgba(15, 23, 42, 0.95); color: #67e8f9; font-size: 9px; font-weight: 800; border: 1px solid rgba(6, 182, 212, 0.4); box-shadow: 0 4px 6px rgba(0,0,0,0.3); white-space: nowrap;">
            Vous êtes ici
          </div>
        </div>
      `;

      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([originCoords.lng, originCoords.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([originCoords.lng, originCoords.lat]);
    }
  }, [originCoords]);

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

  // 6. Draw Route Function
  const drawRouteLayer = (
    map: maplibregl.Map,
    coords: [number, number][],
    mode: 'DRIVING' | 'WALKING' | 'BICYCLING'
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

    // Fit camera to route bounds
    const bounds = new maplibregl.LngLatBounds();
    coords.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds, { padding: { top: 90, bottom: 90, left: 60, right: 60 } });
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
      return;
    }

    let isMounted = true;

    calculateRoute(
      originCoords,
      { lat: activeRouteTarget.latitude, lng: activeRouteTarget.longitude },
      travelMode
    ).then((result) => {
      if (!isMounted) return;
      setRouteInfo(result);
      if (mapRef.current) {
        drawRouteLayer(mapRef.current, result.coordinates, travelMode);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeRouteTarget, originCoords?.lat, originCoords?.lng, travelMode]);

  const handleClearRoute = () => {
    setActiveRouteTarget(null);
    setRouteInfo(null);
    if (mapRef.current) {
      removeRouteLayer(mapRef.current);
    }
    onClearRoute?.();
  };

  const handleStartRoute = (loc: PartnerLocation) => {
    setActiveRouteTarget(loc);
    setSelectedLocation(null);
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

          {/* Collapsible Body: Search + Map Type + Category Pills */}
          {!optionsCollapsed && (
            <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Search */}
                <div className="relative flex-1 sm:max-w-xs">
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Map Type Switcher */}
                <div className="flex items-center gap-2">
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

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                  <Tag className="w-3 h-3" /> {t('common.filter')}:
                </span>

                <button
                  onClick={() => setSelectedCategoryId('all')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                    selectedCategoryId === 'all'
                      ? 'text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                  }`}
                  style={{
                    backgroundColor: selectedCategoryId === 'all' ? accentConfig.hex : undefined,
                  }}
                >
                  <span>{t('map.allCategories')}</span>
                  <span className="text-[10px] px-1 rounded-full bg-white/20 font-bold">
                    {locations.length}
                  </span>
                </button>

                {categories.map((cat) => {
                  const count = categoryCounts[cat.id] || 0;
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                        isSelected
                          ? 'text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                      }`}
                      style={{
                        backgroundColor: isSelected ? cat.color || accentConfig.hex : undefined,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span>{cat.name}</span>
                      <span className="text-[10px] px-1 rounded-full bg-white/20 font-bold">
                        {count}
                      </span>
                    </button>
                  );
                })}
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

        {/* Floating Route Details HUD Card */}
        {activeRouteTarget && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-xl animate-fade-in pointer-events-auto">
            <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-4 shadow-2xl text-white">
              {/* Card Header */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                    <Route className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Itinéraire vers {activeRouteTarget.name}</span>
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

                <button
                  onClick={handleClearRoute}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Fermer l'itinéraire"
                >
                  <X className="w-4 h-4" />
                </button>
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
