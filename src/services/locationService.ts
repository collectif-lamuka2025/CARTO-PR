import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  getDocs,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Category, PartnerLocation, DEFAULT_STRATEGIC_CATEGORIES } from '../types';

const CATEGORIES_COLLECTION = 'categories';
const LOCATIONS_COLLECTION = 'locations';
const CACHE_PREFIX = 'carto_categories_';

// Subscribers for sync status
export interface FirebaseSyncStatus {
  hasPendingWrites: boolean;
  fromCache: boolean;
  isOnline: boolean;
}

type SyncStatusListener = (status: FirebaseSyncStatus) => void;
const syncStatusListeners: Set<SyncStatusListener> = new Set();

type CategoriesListener = (categories: Category[]) => void;
const categoryListeners: Set<CategoriesListener> = new Set();

type LocationsListener = (locations: PartnerLocation[]) => void;
const locationListeners: Set<LocationsListener> = new Set();

export function broadcastCategories(categories: Category[]) {
  categoryListeners.forEach((listener) => {
    try {
      listener(categories);
    } catch (e) {
      console.warn('Erreur écouteur catégorie:', e);
    }
  });
}

export function broadcastLocations(locations: PartnerLocation[]) {
  locationListeners.forEach((listener) => {
    try {
      listener(locations);
    } catch (e) {
      console.warn('Erreur écouteur position:', e);
    }
  });
}

function cleanLocationForFirestore(loc: PartnerLocation): Record<string, any> {
  const data: Record<string, any> = {
    id: loc.id,
    name: loc.name.trim(),
    categoryId: loc.categoryId || 'default',
    categoryName: loc.categoryName || 'Général',
    categoryColor: loc.categoryColor || '#3B82F6',
    latitude: Number(loc.latitude),
    longitude: Number(loc.longitude),
    agentId: loc.agentId || 'guest_agent',
    agentEmail: loc.agentEmail || 'agent@terrain.local',
    createdAt: loc.createdAt || new Date().toISOString(),
    updatedAt: loc.updatedAt || new Date().toISOString(),
  };

  if (loc.partnerName && loc.partnerName.trim()) {
    data.partnerName = loc.partnerName.trim();
  }
  if (loc.notes && loc.notes.trim()) {
    data.notes = loc.notes.trim();
  }
  if (loc.phone && loc.phone.trim()) {
    data.phone = loc.phone.trim();
  }
  if (typeof loc.altitude === 'number' && !isNaN(loc.altitude)) {
    data.altitude = loc.altitude;
  }
  if (typeof loc.accuracy === 'number' && !isNaN(loc.accuracy)) {
    data.accuracy = loc.accuracy;
  }

  return data;
}

const CACHE_LOCATIONS_PREFIX = 'carto_locations_';

export function getLocalLocationsCache(userId?: string): PartnerLocation[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = CACHE_LOCATIONS_PREFIX + (userId || 'global');
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    if (userId) {
      const globalStored = localStorage.getItem(CACHE_LOCATIONS_PREFIX + 'global');
      if (globalStored) {
        const parsed = JSON.parse(globalStored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Erreur lecture cache positions:', e);
  }
  return [];
}

export function setLocalLocationsCache(userId: string | undefined, locations: PartnerLocation[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = CACHE_LOCATIONS_PREFIX + (userId || 'global');
    localStorage.setItem(key, JSON.stringify(locations));
    localStorage.setItem(CACHE_LOCATIONS_PREFIX + 'global', JSON.stringify(locations));
  } catch (e) {
    console.warn('Erreur écriture cache positions:', e);
  }
}

function cleanCategoryForFirestore(cat: Category): Record<string, any> {
  const data: Record<string, any> = {
    id: cat.id,
    name: cat.name.trim(),
    color: cat.color || '#10B981',
    icon: cat.icon || 'Store',
    createdBy: cat.createdBy || 'agent',
    createdAt: cat.createdAt || new Date().toISOString(),
  };
  if (cat.description && cat.description.trim()) {
    data.description = cat.description.trim();
  }
  return data;
}

let currentSyncStatus: FirebaseSyncStatus = {
  hasPendingWrites: false,
  fromCache: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
};

function updateSyncStatus(update: Partial<FirebaseSyncStatus>) {
  currentSyncStatus = { ...currentSyncStatus, ...update };
  syncStatusListeners.forEach((l) => l(currentSyncStatus));
}

// Global online/offline event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    updateSyncStatus({ isOnline: true });
  });
  window.addEventListener('offline', () => {
    updateSyncStatus({ isOnline: false });
  });
}

// ----------------- Local Storage Cache Helpers -----------------
export function getLocalCategoriesCache(userId?: string): Category[] {
  if (typeof window === 'undefined') return DEFAULT_STRATEGIC_CATEGORIES;
  try {
    const key = CACHE_PREFIX + (userId || 'global');
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Also check global key if specific user key was empty
    if (userId) {
      const globalStored = localStorage.getItem(CACHE_PREFIX + 'global');
      if (globalStored) {
        const parsed = JSON.parse(globalStored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Erreur lecture cache catégories:', e);
  }
  return DEFAULT_STRATEGIC_CATEGORIES;
}

export function setLocalCategoriesCache(userId: string | undefined, categories: Category[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = CACHE_PREFIX + (userId || 'global');
    localStorage.setItem(key, JSON.stringify(categories));
    localStorage.setItem(CACHE_PREFIX + 'global', JSON.stringify(categories));
  } catch (e) {
    console.warn('Erreur écriture cache catégories:', e);
  }
}

// ----------------- Default Strategic Categories Seeder -----------------
export async function seedDefaultCategoriesIfEmpty(userId: string): Promise<void> {
  if (!userId) return;
  try {
    for (const cat of DEFAULT_STRATEGIC_CATEGORIES) {
      const docPayload = cleanCategoryForFirestore({
        ...cat,
        createdBy: userId,
      });
      setDoc(doc(db, CATEGORIES_COLLECTION, cat.id), docPayload, { merge: true }).catch(() => {});
    }
  } catch (error) {
    console.warn('Initialisation des catégories par défaut via Firebase:', error);
  }
}

export async function restoreStrategicCategories(userId: string): Promise<Category[]> {
  const restored: Category[] = DEFAULT_STRATEGIC_CATEGORIES.map((cat) => ({
    ...cat,
    createdBy: userId || 'system',
    createdAt: new Date().toISOString(),
  }));

  // 1. Identify obsolete or custom categories to clean up
  const current = getLocalCategoriesCache(userId);
  const defaultIds = new Set(restored.map((c) => c.id));
  const toDelete = current.filter((c) => !defaultIds.has(c.id));

  // 2. Synchronous immediate local update:
  // Write to localStorage & trigger React state updates in ALL components right away!
  setLocalCategoriesCache(userId, restored);
  setLocalCategoriesCache('global', restored);
  broadcastCategories(restored);

  // 3. Update IndexedDB asynchronously in background (don't block UI)
  (async () => {
    try {
      const { getLocalDB } = await import('./db');
      const localDb = await getLocalDB();
      const tx = localDb.transaction('categories', 'readwrite');
      await tx.store.clear();
      for (const cat of restored) {
        await tx.store.put(cat);
      }
      await tx.done;
    } catch (e) {
      console.warn('Erreur mise à jour IndexedDB catégories:', e);
    }
  })();

  // 4. Update Firestore in the background with local cache persistence without blocking UI
  (async () => {
    try {
      // Delete old non-default categories
      for (const cat of toDelete) {
        try {
          deleteDoc(doc(db, CATEGORIES_COLLECTION, cat.id)).catch(() => {});
        } catch (_) {}
      }

      // Write default categories
      for (const cat of restored) {
        try {
          const payload = cleanCategoryForFirestore(cat);
          setDoc(doc(db, CATEGORIES_COLLECTION, cat.id), payload, { merge: true }).catch(() => {});
        } catch (_) {}
      }
    } catch (error) {
      console.warn('Erreur synchronisation Firestore catégories par défaut:', error);
    }
  })();

  return restored;
}

// ----------------- Subscription: Categories -----------------
export function subscribeToCategories(
  userId: string,
  onData: (categories: Category[]) => void,
  onError?: (err: Error) => void
) {
  // Deliver cached or strategic defaults immediately so UI never starts empty
  const initial = getLocalCategoriesCache(userId);
  onData(initial);

  // Register for immediate local broadcasts
  categoryListeners.add(onData);

  if (!userId) {
    return () => {
      categoryListeners.delete(onData);
    };
  }

  const colRef = collection(db, CATEGORIES_COLLECTION);

  const unsubscribe = onSnapshot(
    colRef,
    { includeMetadataChanges: true },
    async (snapshot) => {
      if (snapshot.empty) {
        const current = getLocalCategoriesCache(userId);
        if (current.length === 0) {
          await seedDefaultCategoriesIfEmpty(userId);
          onData(DEFAULT_STRATEGIC_CATEGORIES);
          setLocalCategoriesCache(userId, DEFAULT_STRATEGIC_CATEGORIES);
          broadcastCategories(DEFAULT_STRATEGIC_CATEGORIES);
        }
      } else {
        const categories: Category[] = [];
        snapshot.forEach((d) => {
          categories.push(d.data() as Category);
        });

        // Sort alphabetically by category name
        categories.sort((a, b) => a.name.localeCompare(b.name));
        setLocalCategoriesCache(userId, categories);
        broadcastCategories(categories);
      }

      updateSyncStatus({
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache,
      });
    },
    (error) => {
      console.warn('Souscription catégories Firestore:', error.message);
      // Fallback on error to cached data
      onData(getLocalCategoriesCache(userId));
      onError?.(error);
    }
  );

  return () => {
    categoryListeners.delete(onData);
    unsubscribe();
  };
}

// ----------------- Subscription: Locations -----------------
export function subscribeToLocations(
  userId: string,
  onData: (locations: PartnerLocation[]) => void,
  onError?: (err: Error) => void
) {
  // Deliver cached locations immediately so UI displays recorded points without delay
  const initial = getLocalLocationsCache(userId);
  onData(initial);

  locationListeners.add(onData);

  if (!userId) {
    return () => {
      locationListeners.delete(onData);
    };
  }

  const colRef = collection(db, LOCATIONS_COLLECTION);
  const q = query(colRef, where('agentId', '==', userId));

  const unsubscribe = onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const locations: PartnerLocation[] = [];
      snapshot.forEach((d) => {
        locations.push(d.data() as PartnerLocation);
      });

      // Sort by newest first
      locations.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setLocalLocationsCache(userId, locations);
      broadcastLocations(locations);

      updateSyncStatus({
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache,
      });
    },
    (error) => {
      console.warn('Souscription positions partenaires Firestore (mode hors-ligne):', error.message);
      // Fallback on cached data
      onData(getLocalLocationsCache(userId));
      onError?.(error);
    }
  );

  return () => {
    locationListeners.delete(onData);
    unsubscribe();
  };
}

// ----------------- Subscription: Sync Status -----------------
export function subscribeToSyncStatus(listener: SyncStatusListener) {
  syncStatusListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    syncStatusListeners.delete(listener);
  };
}

// ----------------- Save Category -----------------
export async function saveCategory(category: Category): Promise<Category[]> {
  const cleanCat: Category = {
    id: category.id,
    name: category.name.trim(),
    color: category.color || '#10B981',
    icon: category.icon || 'Store',
    description: category.description?.trim() || undefined,
    createdBy: category.createdBy || 'agent',
    createdAt: category.createdAt || new Date().toISOString(),
  };

  const current = getLocalCategoriesCache(cleanCat.createdBy);
  const existingIdx = current.findIndex((c) => c.id === cleanCat.id);
  let updated: Category[];
  if (existingIdx >= 0) {
    updated = current.map((c) => (c.id === cleanCat.id ? cleanCat : c));
  } else {
    updated = [...current, cleanCat];
  }

  // Sort alphabetically by category name
  updated.sort((a, b) => a.name.localeCompare(b.name));

  setLocalCategoriesCache(cleanCat.createdBy, updated);
  broadcastCategories(updated);

  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, cleanCat.id);
    const payload = cleanCategoryForFirestore(cleanCat);
    await setDoc(docRef, payload, { merge: true });
  } catch (err: any) {
    console.warn('Sauvegarde catégorie Firestore différée ou locale:', err?.message || err);
  }

  return updated;
}

// ----------------- Delete Category -----------------
export async function deleteCategory(categoryId: string, userId?: string): Promise<Category[]> {
  const current = getLocalCategoriesCache(userId);
  const updated = current.filter((c) => c.id !== categoryId);
  setLocalCategoriesCache(userId, updated);
  broadcastCategories(updated);

  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, categoryId);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.warn('Suppression catégorie Firestore différée ou locale:', err?.message || err);
  }

  return updated;
}

// ----------------- Save Partner Location -----------------
export async function savePartnerLocation(location: PartnerLocation): Promise<PartnerLocation[]> {
  const cleanLoc: PartnerLocation = {
    id: location.id,
    name: location.name.trim(),
    partnerName: location.partnerName?.trim() || undefined,
    categoryId: location.categoryId || 'default',
    categoryName: location.categoryName || 'Général',
    categoryColor: location.categoryColor || '#3B82F6',
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    altitude: typeof location.altitude === 'number' ? location.altitude : null,
    accuracy: typeof location.accuracy === 'number' ? location.accuracy : null,
    notes: location.notes?.trim() || undefined,
    phone: location.phone?.trim() || undefined,
    agentId: location.agentId || 'guest_agent',
    agentEmail: location.agentEmail || 'agent@terrain.local',
    createdAt: location.createdAt || new Date().toISOString(),
    updatedAt: location.updatedAt || new Date().toISOString(),
  };

  const current = getLocalLocationsCache(cleanLoc.agentId);
  const existingIdx = current.findIndex((l) => l.id === cleanLoc.id);
  let updated: PartnerLocation[];
  if (existingIdx >= 0) {
    updated = current.map((l) => (l.id === cleanLoc.id ? cleanLoc : l));
  } else {
    updated = [cleanLoc, ...current];
  }

  setLocalLocationsCache(cleanLoc.agentId, updated);
  broadcastLocations(updated);

  try {
    const docRef = doc(db, LOCATIONS_COLLECTION, cleanLoc.id);
    const payload = cleanLocationForFirestore(cleanLoc);
    await setDoc(docRef, payload, { merge: true });
  } catch (err: any) {
    console.warn('Sauvegarde position Firestore différée ou locale:', err?.message || err);
  }

  return updated;
}

// ----------------- Update Partner Location Category Only -----------------
/**
 * Updates exclusively the category of a partner location while keeping all GPS coordinates,
 * altitude, accuracy, contact info, notes, agent metadata, and creation timestamp 100% intact.
 */
export async function updatePartnerLocationCategory(
  location: PartnerLocation,
  newCategory: Category
): Promise<PartnerLocation> {
  const updatedLocation: PartnerLocation = {
    ...location,
    categoryId: newCategory.id,
    categoryName: newCategory.name,
    categoryColor: newCategory.color,
    updatedAt: new Date().toISOString(),
  };

  await savePartnerLocation(updatedLocation);

  // Sync to local IndexedDB for full offline resilience
  try {
    const { putLocalLocation } = await import('./db');
    await putLocalLocation(updatedLocation);
  } catch (e) {
    // Non-blocking
  }

  return updatedLocation;
}

// ----------------- Delete Partner Location -----------------
export async function deletePartnerLocation(locationId: string, userId?: string): Promise<PartnerLocation[]> {
  const current = getLocalLocationsCache(userId);
  const updated = current.filter((l) => l.id !== locationId);
  setLocalLocationsCache(userId, updated);
  broadcastLocations(updated);

  try {
    const docRef = doc(db, LOCATIONS_COLLECTION, locationId);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.warn('Suppression position Firestore différée ou locale:', err?.message || err);
  }

  return updated;
}
