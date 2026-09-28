/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { APIProvider } from '@vis.gl/react-google-maps';
import { auth } from './firebase/config';
import {
  subscribeToCategories,
  subscribeToLocations,
  seedDefaultCategoriesIfEmpty,
  getLocalCategoriesCache,
} from './services/locationService';
import { Category, PartnerLocation } from './types';
import { useGeolocation } from './hooks/useGeolocation';
import { PreferencesProvider, usePreferences } from './context/PreferencesContext';

import { AuthGateView } from './components/AuthGateView';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { WorldMapView } from './components/WorldMapView';
import { CaptureLocationView } from './components/CaptureLocationView';
import { LocationsListView } from './components/LocationsListView';
import { CategoryManagerView } from './components/CategoryManagerView';
import { FieldAssistantView } from './components/FieldAssistantView';
import { SettingsView } from './components/SettingsView';
import { Globe2, Loader2 } from 'lucide-react';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function AppContent() {
  const { accentConfig } = usePreferences();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'map' | 'capture' | 'list' | 'categories' | 'assistant' | 'settings'
  >('map');
  const [categories, setCategories] = useState<Category[]>(() => getLocalCategoriesCache());
  const [locations, setLocations] = useState<PartnerLocation[]>([]);

  const { gps, setSimulatedPosition } = useGeolocation();
  const [routeTarget, setRouteTarget] = useState<PartnerLocation | null>(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        seedDefaultCategoriesIfEmpty(currentUser.uid);
      } else {
        setCategories([]);
        setLocations([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Listen to Categories & Locations scoped to current logged-in user
  useEffect(() => {
    if (!user) {
      setCategories([]);
      setLocations([]);
      return;
    }

    const unsubCategories = subscribeToCategories(
      user.uid,
      (data) => {
        setCategories(data);
      },
      (err) => console.warn('Categories sync error:', err)
    );

    const unsubLocations = subscribeToLocations(
      user.uid,
      (data) => {
        setLocations(data);
      },
      (err) => console.warn('Locations sync error:', err)
    );

    return () => {
      unsubCategories();
      unsubLocations();
    };
  }, [user]);

  // Compute location counts by category
  const locationsCountByCategory = React.useMemo(() => {
    const map: Record<string, number> = {};
    locations.forEach((loc) => {
      map[loc.categoryId] = (map[loc.categoryId] || 0) + 1;
    });
    return map;
  }, [locations]);

  const handleSelectOnMap = (loc: PartnerLocation) => {
    setRouteTarget(null);
    setActiveTab('map');
  };

  const handleTraceRoute = (loc: PartnerLocation) => {
    setRouteTarget(loc);
    setActiveTab('map');
  };

  // 1. Initial Authentication Check Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl animate-pulse mb-4"
          style={{ backgroundColor: accentConfig.hex }}
        >
          <Globe2 className="w-8 h-8" />
        </div>
        <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span>Vérification de la session agent...</span>
        </div>
      </div>
    );
  }

  // 2. Auth Gate: Must be logged in to use the application
  if (!user) {
    return <AuthGateView />;
  }

  // 3. Authenticated App Experience
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-row font-sans selection:bg-blue-600 selection:text-white antialiased overflow-hidden">
      {/* Left Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        locationsCount={locations.length}
      />

      {/* Main View Area with TopHeader */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top Header */}
        <TopHeader activeTab={activeTab} gps={gps} />

        {/* Main Content Pane */}
        <main className="flex-1 overflow-y-auto relative flex flex-col">
          {activeTab === 'map' && (
            <WorldMapView
              locations={locations}
              categories={categories}
              gps={gps}
              routeTarget={routeTarget}
              onClearRoute={() => setRouteTarget(null)}
              onSetRouteTarget={setRouteTarget}
              onSimulateGPS={() => setSimulatedPosition(-4.325142, 15.312984, 298.5, 3.2)}
              onNavigateToCapture={() => setActiveTab('capture')}
            />
          )}

          {activeTab === 'capture' && (
            <CaptureLocationView
              user={user}
              categories={categories}
              onLocationSaved={() => {
                // Keep on capture view
              }}
              onNavigateToMap={() => setActiveTab('map')}
            />
          )}

          {activeTab === 'list' && (
            <LocationsListView
              locations={locations}
              categories={categories}
              onSelectOnMap={handleSelectOnMap}
              onTraceRoute={handleTraceRoute}
            />
          )}

          {activeTab === 'categories' && (
            <CategoryManagerView
              categories={categories}
              user={user}
              locationsCountByCategory={locationsCountByCategory}
            />
          )}

          {activeTab === 'assistant' && (
            <FieldAssistantView gps={gps} locations={locations} />
          )}

          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <PreferencesProvider>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'marker', 'geometry', 'routes']}>
        <AppContent />
      </APIProvider>
    </PreferencesProvider>
  );
}
