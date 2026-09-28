import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { useGeolocation } from '../hooks/useGeolocation';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Category, PartnerLocation } from '../types';
import { savePartnerLocation, saveCategory } from '../services/locationService';
import { usePreferences } from '../context/PreferencesContext';
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
} from 'lucide-react';

interface CaptureLocationViewProps {
  user: User | null;
  categories: Category[];
  onLocationSaved: (location: PartnerLocation) => void;
  onNavigateToMap: () => void;
}

// Controller to pan map ONLY once on initial detection or when user clicks Recentrer
function RecenterController({
  coords,
  trigger,
}: {
  coords: { lat: number; lng: number } | null;
  trigger: number;
}) {
  const map = useMap();
  const hasInitiallyCentered = React.useRef(false);
  const prevTrigger = React.useRef(trigger);

  // 1. One-time initial centering when position is first acquired
  React.useEffect(() => {
    if (!map || !coords) return;
    if (!hasInitiallyCentered.current) {
      hasInitiallyCentered.current = true;
      map.setCenter(coords);
      map.setZoom(16);
    }
  }, [map, coords?.lat, coords?.lng]);

  // 2. Only pan when user explicitly clicks the "Recentrer" button
  React.useEffect(() => {
    if (!map || !coords) return;
    if (trigger !== prevTrigger.current) {
      prevTrigger.current = trigger;
      map.panTo(coords);
    }
  }, [map, trigger, coords]);

  return null;
}

export const CaptureLocationView: React.FC<CaptureLocationViewProps> = ({
  user,
  categories,
  onLocationSaved,
  onNavigateToMap,
}) => {
  const { t, accentConfig } = usePreferences();
  const { gps, refreshPosition, setSimulatedPosition } = useGeolocation();
  const isOnline = useOnlineStatus();
  const [recenterTrigger, setRecentertrigger] = useState(0);
  const [displayMode, setDisplayMode] = useState<'map' | 'radar'>('map');
  const [telemetryCollapsed, setTelemetryCollapsed] = useState(false);

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
      console.error('Erreur enregistrement position:', err);
      setErrorMessage(err?.message || 'Erreur lors de l’enregistrement de la position.');
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
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Top Banner / Context */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="p-2 rounded-xl text-white shadow-md"
                style={{ backgroundColor: accentConfig.hex }}
              >
                <Navigation className="w-5 h-5 animate-pulse" />
              </span>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {t('capture.header')}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              {t('capture.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={refreshPosition}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
              title="Rafraîchir le signal GPS"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('capture.refreshGps')}</span>
            </button>

            {/* Quick Demo Simulator button for easy evaluation without walking */}
            <button
              onClick={() => {
                // Kinshasa Center simulation
                setSimulatedPosition(-4.325142, 15.312984, 298.5, 3.2);
                setRecentertrigger((p) => p + 1);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-cyan-950/60 hover:bg-blue-100 dark:hover:bg-cyan-900 text-blue-700 dark:text-cyan-300 border border-blue-200 dark:border-cyan-800/60 text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="Simuler un point GPS terrain"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>{t('capture.testPosition')}</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-600/40 text-emerald-200 text-xs flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={onNavigateToMap}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs cursor-pointer"
            >
              Voir sur la Carte Globale →
            </button>
          </div>
        )}

        {/* Error Alert */}
        {gps.error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/70 border border-rose-600/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{gps.error}</span>
          </div>
        )}
      </div>

      {/* GPS Telemetry Dashboard - Collapsible */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-lg transition-all">
        <div
          className="p-3 sm:px-4 flex items-center justify-between cursor-pointer select-none bg-slate-50 dark:bg-slate-950/70 hover:bg-slate-100 dark:hover:bg-slate-950/90 transition-colors"
          onClick={() => setTelemetryCollapsed((p) => !p)}
        >
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500 dark:text-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t('capture.telemetry')}
            </span>
            {telemetryCollapsed && activeLat !== null && (
              <span className="text-xs font-mono text-blue-600 dark:text-cyan-400 ml-2 hidden sm:inline">
                ({activeLat.toFixed(5)}°, {activeLng?.toFixed(5)}° · ±{gps.accuracy}m)
              </span>
            )}
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium cursor-pointer"
          >
            <span>{telemetryCollapsed ? t('common.expand') : t('common.collapse')}</span>
            {telemetryCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {!telemetryCollapsed && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800/80 animate-fade-in">
            {/* Latitude Card */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-12 h-12 bg-blue-500/5 rounded-bl-full" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {t('capture.lat')}
              </span>
              <div className="mt-1 font-mono text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {activeLat !== null ? `${activeLat.toFixed(6)}°` : '...'}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">WGS84 Décimal</span>
            </div>

            {/* Longitude Card */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/5 rounded-bl-full" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {t('capture.lng')}
              </span>
              <div className="mt-1 font-mono text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {activeLng !== null ? `${activeLng.toFixed(6)}°` : '...'}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">WGS84 Décimal</span>
            </div>

            {/* Altitude Card */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-12 h-12 bg-purple-500/5 rounded-bl-full" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {t('capture.alt')}
              </span>
              <div className="mt-1 font-mono text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {gps.altitude !== null ? `${gps.altitude} m` : 'N/D'}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">Niveau de la mer</span>
            </div>

            {/* Precision Card */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/5 rounded-bl-full" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {t('capture.acc')}
              </span>
              <div className="mt-1">
                <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold font-mono ${accBadge.color}`}>
                  {accBadge.label}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">Rayon d’incertitude</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Interactive Map & Action Trigger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl relative">
        {/* Map Header / Actions */}
        <div className="bg-slate-50 dark:bg-slate-950 p-3 sm:px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {displayMode === 'map' ? 'Repérage Satellite en Direct' : 'Radar GPS Haute Précision (100% Hors-Ligne)'}
            </span>
            {!isOnline && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-semibold">
                Hors-Ligne
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Display Mode Toggle */}
            <div className="flex items-center bg-slate-200 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setDisplayMode('map')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  displayMode === 'map'
                    ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🗺️ Carte
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('radar')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  displayMode === 'radar'
                    ? 'bg-white dark:bg-emerald-600 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>Radar GPS</span>
              </button>
            </div>

            {displayMode === 'map' && (
              <button
                onClick={() => setRecentertrigger((p) => p + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer transition-colors"
              >
                <Compass className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden sm:inline">Recentrer</span>
              </button>
            )}
          </div>
        </div>

        {/* Viewport: Map or Offline Radar */}
        <div className="h-[380px] sm:h-[450px] w-full relative bg-slate-950 flex items-center justify-center overflow-hidden">
          {displayMode === 'map' ? (
            <Map
              id="capture_realtime_map"
              mapId="capture_realtime_map_id"
              defaultCenter={{
                lat: activeLat ?? -4.325,
                lng: activeLng ?? 15.312,
              }}
              defaultZoom={16}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
              {activeLat !== null && activeLng !== null && (
                <>
                  <RecenterController
                    coords={{ lat: activeLat, lng: activeLng }}
                    trigger={recenterTrigger}
                  />
                  <AdvancedMarker position={{ lat: activeLat, lng: activeLng }}>
                    {/* Realtime Live Agent Beacon Marker */}
                    <div className="relative flex items-center justify-center">
                      <span className="absolute w-12 h-12 rounded-full bg-emerald-400/30 animate-ping pointer-events-none" />
                      <span className="absolute w-8 h-8 rounded-full bg-emerald-500/50 blur-xs" />
                      <div className="relative w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-white">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    </div>
                  </AdvancedMarker>
                </>
              )}
            </Map>
          ) : (
            /* High-Tech Offline Radar Grid View */
            <div className="w-full h-full relative flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black select-none p-4">
              {/* Concentric Radar Rings */}
              <div className="relative w-72 h-72 sm:w-96 sm:h-96 rounded-full border border-emerald-500/30 flex items-center justify-center shadow-2xl shadow-emerald-500/10">
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
                  <div className="w-5 h-5 rounded-full bg-emerald-400 border-2 border-white shadow-xl flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                  </div>
                </div>

                {/* Range Labels */}
                <span className="absolute right-12 top-1/2 -translate-y-4 text-[9px] font-mono text-emerald-500/60">
                  25m
                </span>
                <span className="absolute right-4 top-1/2 -translate-y-4 text-[9px] font-mono text-emerald-500/60">
                  50m
                </span>
              </div>

              {/* Offline Overlay HUD Card */}
              <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md border border-emerald-500/30 p-3 rounded-xl shadow-lg max-w-xs text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>Module GNSS Satellite Déconnecté du Web</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Les données satellites physiques de votre appareil sont lues en direct et
                  conservées en mémoire IndexedDB sans dépendance réseau.
                </p>
              </div>
            </div>
          )}

          {/* Floating Save Trigger over Map */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 w-full max-w-sm px-4">
            <button
              onClick={handleOpenRegisterModal}
              disabled={activeLat === null || activeLng === null}
              className={`w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r ${accentConfig.gradientClass} text-white font-extrabold text-sm sm:text-base shadow-2xl border border-white/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer`}
            >
              <MapPin className="w-5 h-5 animate-bounce" />
              <span>{t('capture.recordBtn')}</span>
            </button>
          </div>
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
