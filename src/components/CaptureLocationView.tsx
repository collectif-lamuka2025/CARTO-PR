import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initMapLibreWorker } from '../utils/maplibreSetup';
import { useGeolocation } from '../hooks/useGeolocation';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Category, PartnerLocation } from '../types';
import { savePartnerLocation, saveCategory } from '../services/locationService';
import { usePreferences } from '../context/PreferencesContext';
import { getMapLibreStyle, MapTypeMode } from '../utils/mapStyles';
import {
  Navigation,
  Compass,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Sparkles,
  MapPin,
  Tag,
  Phone,
  User as UserIcon,
  Radio,
  WifiOff,
  Crosshair,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';

interface CaptureLocationViewProps {
  user: User | null;
  categories: Category[];
  onLocationSaved: (location: PartnerLocation) => void;
  onNavigateToMap: () => void;
}

export const CaptureLocationView: React.FC<CaptureLocationViewProps> = ({
  user,
  categories,
  onLocationSaved,
  onNavigateToMap,
}) => {
  const { t, accentConfig } = usePreferences();
  const { gps, refreshPosition } = useGeolocation();
  const isOnline = useOnlineStatus();
  const [recenterTrigger, setRecentertrigger] = useState(0);
  const [displayMode, setDisplayMode] = useState<'map' | 'radar'>('map');
  const [mapTypeId, setMapTypeId] = useState<MapTypeMode>('roadmap');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const layerMenuRef = useRef<HTMLDivElement>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const hasInitiallyCentered = useRef(false);

  // Close layer dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layerMenuRef.current && !layerMenuRef.current.contains(e.target as Node)) {
        setIsLayerMenuOpen(false);
      }
    };
    if (isLayerMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLayerMenuOpen]);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    categories[0]?.id || ''
  );

  // Auto-sync selectedCategoryId if empty or current category was deleted
  React.useEffect(() => {
    if (categories.length > 0) {
      const exists = categories.some((c) => c.id === selectedCategoryId);
      if (!exists || !selectedCategoryId) {
        setSelectedCategoryId(categories[0].id);
      }
    }
  }, [categories, selectedCategoryId]);

  // Quick inline category creation state
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#EC4899');

  // Saving state & alert
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected or captured pin
  const [pinnedCoords, setPinnedCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Determine active coordinates
  const activeLat = pinnedCoords?.lat ?? gps.latitude;
  const activeLng = pinnedCoords?.lng ?? gps.longitude;

  // Initialize and update MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      initMapLibreWorker();
      const defaultLng = activeLng ?? 15.312;
      const defaultLat = activeLat ?? -4.325;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getMapLibreStyle('roadmap'),
        center: [defaultLng, defaultLat],
        zoom: 16,
        maxZoom: 20,
      });

      // Gracefully absorb transient tile fetch or offline network errors
      map.on('error', (e) => {
        const msg = e?.error?.message || '';
        if (msg.includes('Failed to fetch') || msg.includes('AJAXError') || msg.includes('404')) {
          return;
        }
        console.warn('Notice carte capture:', msg);
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
      mapRef.current = map;

      // Ensure map resizes when loaded
      map.on('load', () => {
        map.resize();
      });
    }

    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    if (mapContainerRef.current) {
      observer.observe(mapContainerRef.current);
    }

    return () => {
      observer.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle map style changes dynamically without losing camera or marker
  const prevMapTypeRef = useRef<MapTypeMode>(mapTypeId);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || prevMapTypeRef.current === mapTypeId) return;
    prevMapTypeRef.current = mapTypeId;
    map.setStyle(getMapLibreStyle(mapTypeId));
  }, [mapTypeId]);

  // Update marker position and initial center
  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeLat === null || activeLng === null) return;

    // Create or update marker
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'capture-beacon select-none pointer-events-none';
      el.innerHTML = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <span style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.35); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <div style="position: relative; width: 24px; height: 24px; border-radius: 9999px; background-color: #10b981; border: 2.5px solid #ffffff; box-shadow: 0 0 10px #10b981, 0 4px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
            <div style="width: 8px; height: 8px; border-radius: 9999px; background-color: #ffffff;"></div>
          </div>
        </div>
      `;

      markerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([activeLng, activeLat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([activeLng, activeLat]);
    }

    // Initial center on first fix
    if (!hasInitiallyCentered.current) {
      hasInitiallyCentered.current = true;
      map.setCenter([activeLng, activeLat]);
      map.setZoom(16);
    }
  }, [activeLat, activeLng]);

  // Recenter trigger
  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeLat === null || activeLng === null || recenterTrigger === 0) return;

    map.flyTo({
      center: [activeLng, activeLat],
      zoom: 16,
      essential: true,
    });
  }, [recenterTrigger, activeLat, activeLng]);

  // Resize map when switching displayMode to map
  useEffect(() => {
    if (displayMode === 'map' && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.resize();
      }, 100);
    }
  }, [displayMode]);

  // Handle open registration modal
  const handleOpenRegisterModal = () => {
    if (activeLat === null || activeLng === null) {
      setErrorMessage('En attente du signal GPS. Veuillez patienter ou utiliser la position simulée.');
      return;
    }
    setPinnedCoords({ lat: activeLat, lng: activeLng });
    setIsModalOpen(true);
    setErrorMessage(null);
  };

  // Inline category quick creation
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const newCat: Category = {
      id: 'cat_' + Date.now(),
      name: newCatName.trim(),
      color: newCatColor,
      createdBy: user?.uid || 'guest_agent',
      createdAt: new Date().toISOString(),
    };
    try {
      await saveCategory(newCat);
      setSelectedCategoryId(newCat.id);
      setNewCatName('');
      setShowAddCategory(false);
    } catch (err) {
      console.error('Erreur création catégorie:', err);
    }
  };

  // Submit Partner Location Record
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationName.trim() || activeLat === null || activeLng === null) {
      setErrorMessage('Le nom de la position est requis.');
      return;
    }

    const cat = categories.find((c) => c.id === selectedCategoryId) || categories[0];

    const newLocation: PartnerLocation = {
      id: 'loc_' + Date.now(),
      name: locationName.trim(),
      partnerName: partnerName.trim() || undefined,
      categoryId: cat ? cat.id : 'default',
      categoryName: cat ? cat.name : 'Général',
      categoryColor: cat ? cat.color : '#3B82F6',
      latitude: activeLat,
      longitude: activeLng,
      altitude: gps.altitude,
      accuracy: gps.accuracy,
      notes: notes.trim() || undefined,
      phone: phone.trim() || undefined,
      agentId: user?.uid || 'guest_agent',
      agentEmail: user?.email || 'agent@terrain.local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    try {
      await savePartnerLocation(newLocation);
      onLocationSaved(newLocation);
      setIsModalOpen(false);
      setSuccessMessage(`Position « ${newLocation.name} » enregistrée avec succès !`);

      // Reset form
      setLocationName('');
      setPartnerName('');
      setPhone('');
      setNotes('');
      setPinnedCoords(null);
    } catch (err: any) {
      console.warn('Info enregistrement position locale:', err);
      onLocationSaved(newLocation);
      setIsModalOpen(false);
      setSuccessMessage(`Position « ${newLocation.name} » enregistrée avec succès !`);
      setLocationName('');
      setPartnerName('');
      setPhone('');
      setNotes('');
      setPinnedCoords(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Evaluate accuracy tier
  const getAccuracyBadge = (accuracy: number | null) => {
    if (accuracy === null) return { label: 'Inconnue', color: 'bg-slate-700 text-slate-300' };
    if (accuracy <= 6)
      return { label: `± ${accuracy}m (Excellente)`, color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
    if (accuracy <= 15)
      return { label: `± ${accuracy}m (Très bonne)`, color: 'bg-teal-500/20 text-teal-400 border border-teal-500/30' };
    if (accuracy <= 30)
      return { label: `± ${accuracy}m (Standard)`, color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' };
    return { label: `± ${accuracy}m (Approximative)`, color: 'bg-rose-500/20 text-rose-400 border border-rose-500/30' };
  };

  const accBadge = getAccuracyBadge(gps.accuracy);

  return (
    <div className="flex flex-col flex-1 h-full w-full bg-slate-100 dark:bg-slate-950 overflow-hidden relative">
      {/* Sleek, ultra-compact Top Header Bar */}
      <div className="bg-white/95 dark:bg-slate-950/95 border-b border-slate-200 dark:border-slate-800 px-3 py-2 sm:px-4 z-20 shadow-xs backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between gap-3">
          {/* Title & Live Satellite Pill */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="p-1.5 rounded-lg text-white shadow-sm shrink-0"
              style={{ backgroundColor: accentConfig.hex }}
            >
              <Navigation className="w-4 h-4 animate-pulse" />
            </span>
            <div className="flex items-center gap-2 truncate">
              <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {t('capture.header')}
              </h1>
              <span className="hidden xs:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                GNSS Actif
              </span>
            </div>
          </div>

          {/* Quick Actions: Display Mode Switcher (Carte / Radar) + Recenter + Refresh GPS */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Display Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setDisplayMode('map')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  displayMode === 'map'
                    ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🗺️ Carte
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('radar')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  displayMode === 'radar'
                    ? 'bg-white dark:bg-emerald-600 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>Radar</span>
              </button>
            </div>

            {/* Map Style Selector Button (Small icon only, no text) */}
            {displayMode === 'map' && (
              <div className="relative" ref={layerMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsLayerMenuOpen((p) => !p)}
                  className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-xs flex items-center justify-center ${
                    isLayerMenuOpen
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'
                  }`}
                  title="Changer le type de vue de la carte (Plan, Satellite, Hybride, Relief, Nuit)"
                  aria-label="Changer le type de vue de la carte"
                  aria-expanded={isLayerMenuOpen}
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>

                {/* Dropdown Menu for Map Views */}
                {isLayerMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden py-1.5 animate-fade-in text-xs">
                    <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Vue de la carte</span>
                      <span className="text-[9px] text-slate-400 font-normal">HD & Hors-ligne</span>
                    </div>

                    <div className="p-1 space-y-0.5">
                      {[
                        { id: 'roadmap', name: 'Plan cartographie', desc: 'Rues, axes & bâtis', icon: '🗺️' },
                        { id: 'satellite', name: 'Satellite HD', desc: 'Imagerie aérienne Maxar', icon: '🛰️' },
                        { id: 'hybrid', name: 'Hybride', desc: 'Satellite + voirie & repères', icon: '🌐' },
                        { id: 'terrain', name: 'Relief / Topo', desc: 'Courbes de niveau & altitude', icon: '⛰️' },
                        { id: 'dark', name: 'Nuit / Sombre', desc: 'Contraste élevé pour obscurité', icon: '🌙' },
                      ].map((style) => {
                        const isSelected = mapTypeId === style.id;
                        return (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => {
                              setMapTypeId(style.id as MapTypeMode);
                              setIsLayerMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-700/60 text-blue-900 dark:text-blue-200'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-base shrink-0">{style.icon}</span>
                              <div className="min-w-0">
                                <div className={`text-xs truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>
                                  {style.name}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">{style.desc}</div>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-1 stroke-[2.5]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recenter Button (when in Map mode) */}
            {displayMode === 'map' && (
              <button
                type="button"
                onClick={() => setRecentertrigger((p) => p + 1)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                title="Recentrer la carte"
              >
                <Compass className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden sm:inline text-[11px]">Recentrer</span>
              </button>
            )}

            {/* Refresh GPS Button */}
            <button
              type="button"
              onClick={refreshPosition}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
              title="Rafraîchir le signal GPS"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span className="hidden sm:inline text-[11px]">{t('capture.refreshGps')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Full-Screen Viewport: Satellite Tracking & Realtime Map */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center">
        {/* MapLibre Map (Occupies full space) */}
        <div
          ref={mapContainerRef}
          className={`w-full h-full ${displayMode === 'map' ? 'block' : 'hidden'}`}
        />

        {/* High-Tech Offline Radar View (Occupies full space) */}
        {displayMode === 'radar' && (
          <div className="w-full h-full relative flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black select-none p-4">
            {/* Concentric Radar Rings */}
            <div className="relative w-80 h-80 sm:w-[480px] sm:h-[480px] rounded-full border border-emerald-500/30 flex items-center justify-center shadow-2xl shadow-emerald-500/10">
              {/* 75% ring */}
              <div className="w-3/4 h-3/4 rounded-full border border-dashed border-emerald-500/25 flex items-center justify-center">
                {/* 50% ring */}
                <div className="w-2/3 h-2/3 rounded-full border border-emerald-500/20 flex items-center justify-center">
                  {/* 25% ring */}
                  <div className="w-1/2 h-1/2 rounded-full border border-dashed border-emerald-500/30 flex items-center justify-center" />
                </div>
              </div>

              {/* Crosshairs */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-full h-[1px] bg-emerald-500/30" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-full w-[1px] bg-emerald-500/30" />
              </div>

              {/* Radar Rotating Sweep Line */}
              <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                <div className="w-1/2 h-1/2 origin-bottom-right bg-gradient-to-tr from-emerald-500/20 via-transparent to-transparent animate-spin [animation-duration:4s]" />
              </div>

              {/* Cardinal Points */}
              <span className="absolute top-2 text-[11px] font-bold text-emerald-400 font-mono">N 0°</span>
              <span className="absolute bottom-2 text-[11px] font-bold text-slate-500 font-mono">S 180°</span>
              <span className="absolute right-2 text-[11px] font-bold text-slate-500 font-mono">E 90°</span>
              <span className="absolute left-2 text-[11px] font-bold text-slate-500 font-mono">O 270°</span>

              {/* Center Point - Agent GPS Beacon */}
              <div className="relative z-10 flex items-center justify-center">
                <span className="absolute w-12 h-12 rounded-full bg-emerald-400/40 animate-ping" />
                <span className="absolute w-8 h-8 rounded-full bg-emerald-500/60 blur-xs" />
                <div className="w-6 h-6 rounded-full bg-emerald-400 border-2 border-white shadow-xl flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-slate-950" />
                </div>
              </div>

              {/* Range Labels */}
              <span className="absolute right-12 top-1/2 -translate-y-4 text-[10px] font-mono text-emerald-500/60">
                25m
              </span>
              <span className="absolute right-4 top-1/2 -translate-y-4 text-[10px] font-mono text-emerald-500/60">
                50m
              </span>
            </div>
          </div>
        )}

        {/* Floating Telemetry Glassmorphic HUD Badge (Top-Left) */}
        <div className="absolute top-3 left-3 z-10 pointer-events-auto">
          <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 p-2.5 sm:p-3 rounded-2xl shadow-2xl text-white text-xs max-w-[280px] sm:max-w-xs transition-all">
            <div className="flex items-center justify-between gap-3 mb-2 pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Repérage Satellite Direct</span>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${accBadge.color}`}>
                {accBadge.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px]">
              <div>
                <span className="text-[9px] text-slate-400 block font-sans">Latitude</span>
                <span className="text-slate-100 font-bold">
                  {activeLat !== null ? `${activeLat.toFixed(6)}°` : 'En attente...'}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block font-sans">Longitude</span>
                <span className="text-slate-100 font-bold">
                  {activeLng !== null ? `${activeLng.toFixed(6)}°` : 'En attente...'}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block font-sans">Altitude</span>
                <span className="text-slate-300">
                  {gps.altitude !== null ? `${gps.altitude} m` : 'N/D'}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block font-sans">Incertitude</span>
                <span className="text-emerald-400 font-bold">
                  {gps.accuracy !== null ? `±${gps.accuracy} m` : '...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Offline Indicator */}
        {!isOnline && (
          <div className="absolute top-3 right-3 z-10 pointer-events-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-semibold shadow-lg">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Hors-Ligne (zones explorées en cache)</span>
              <span className="sm:hidden">Hors-Ligne</span>
            </div>
          </div>
        )}

        {/* Floating Success Alert Toast */}
        {successMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-fade-in max-w-[90%] sm:max-w-md">
            <div className="p-3 rounded-2xl bg-emerald-950/95 border border-emerald-500/60 text-emerald-200 text-xs shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{successMessage}</span>
              </div>
              <button
                onClick={onNavigateToMap}
                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs cursor-pointer shrink-0"
              >
                Voir sur Carte →
              </button>
            </div>
          </div>
        )}

        {/* Floating GPS Error Toast */}
        {gps.error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-fade-in max-w-[90%] sm:max-w-md">
            <div className="p-3 rounded-2xl bg-rose-950/95 border border-rose-500/60 text-rose-200 text-xs shadow-2xl backdrop-blur-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-semibold">{gps.error}</span>
            </div>
          </div>
        )}

        {/* Floating Save Trigger over Map */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-4 pointer-events-auto">
          <button
            onClick={handleOpenRegisterModal}
            disabled={activeLat === null || activeLng === null}
            className={`w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r ${accentConfig.gradientClass} text-white font-extrabold text-sm sm:text-base shadow-2xl border border-white/20 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer`}
          >
            <MapPin className="w-5 h-5 animate-bounce shrink-0" />
            <span>{t('capture.recordBtn')}</span>
          </button>
        </div>
      </div>

      {/* Registration Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100">
            {/* Modal Title */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                  Enregistrer la Position Partenaire
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Attribuez un nom, un partenaire et une catégorie à ce relevé terrain
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* GPS Coordinates Freeze Recap */}
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">Latitude</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                  {activeLat?.toFixed(6)}°
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">Longitude</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                  {activeLng?.toFixed(6)}°
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">Altitude</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                  {gps.altitude !== null ? `${gps.altitude} m` : 'N/D'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">Précision</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {gps.accuracy !== null ? `± ${gps.accuracy} m` : 'Standard'}
                </span>
              </div>
            </div>

            {!isOnline && (
              <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-500/40 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Mode Hors-Ligne Firebase :</strong> Ce relevé est sauvegardé dans le cache sécurisé de votre appareil et sera automatiquement synchronisé avec la base cloud dès le retour de la connexion internet.
                </span>
              </div>
            )}

            <form onSubmit={handleSaveLocation} className="mt-4 space-y-4">
              {/* Location Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nom de la position / du lieu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Boutique Centrale, Dépôt Régional, Atelier Nord"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Partner Contact Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nom du partenaire rencontré / Responsable
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ex: M. Jean-Marc Bakambu"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Category Selector with Inline Add Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Catégorie du partenaire <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(!showAddCategory)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nouvelle catégorie</span>
                  </button>
                </div>

                {/* Inline Category Creator if expanded */}
                {showAddCategory && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-blue-300 dark:border-blue-500/40 mb-3 space-y-2">
                    <p className="text-[11px] font-bold text-blue-600 dark:text-blue-300">
                      Ajouter une nouvelle catégorie
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nom (ex: Pharmacie, Dépôt...)"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                      />
                      <input
                        type="color"
                        value={newCatColor}
                        onChange={(e) => setNewCatColor(e.target.value)}
                        className="w-9 h-8 bg-transparent rounded cursor-pointer"
                        title="Couleur distinctive"
                      />
                      <button
                        type="button"
                        onClick={handleCreateCategory}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                      >
                        Créer
                      </button>
                    </div>
                  </div>
                )}

                {/* Categories Grid Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {categories.map((c) => {
                    const isSelected = selectedCategoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(c.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-slate-800 border-blue-600 dark:border-white text-slate-900 dark:text-white font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="font-medium truncate">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Numéro de téléphone / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    placeholder="ex: +243 81 234 5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes de terrain / Compte-rendu de visite
                </label>
                <textarea
                  rows={2}
                  placeholder="Observations sur l’accès, accords conclus, remarques..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer border border-slate-200 dark:border-transparent"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Enregistrement en cours...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmer & Enregistrer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
