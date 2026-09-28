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
  } catch (e) {
    console.warn('Erreur écriture cache catégories:', e);
  }
}

// ----------------- Default Strategic Categories Seeder -----------------
export async function seedDefaultCategoriesIfEmpty(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const colRef = collection(db, CATEGORIES_COLLECTION);
    const existing = await getDocs(colRef);
    if (!existing.empty) return;

    for (const cat of DEFAULT_STRATEGIC_CATEGORIES) {
      const docPayload: Category = {
        ...cat,
        createdBy: userId,
      };
      await setDoc(doc(db, CATEGORIES_COLLECTION, cat.id), docPayload, { merge: true });
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

  setLocalCategoriesCache(userId, restored);

  try {
    for (const cat of restored) {
      await setDoc(doc(db, CATEGORIES_COLLECTION, cat.id), cat, { merge: true });
    }
  } catch (error) {
    console.warn('Erreur restauration catégories stratégiques:', error);
  }

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

  if (!userId) {
    return () => {};
  }

  const colRef = collection(db, CATEGORIES_COLLECTION);

  const unsubscribe = onSnapshot(
    colRef,
    { includeMetadataChanges: true },
    async (snapshot) => {
      if (snapshot.empty) {
        // If Firestore is completely empty, seed the strategic categories
        await seedDefaultCategoriesIfEmpty(userId);
        onData(DEFAULT_STRATEGIC_CATEGORIES);
        setLocalCategoriesCache(userId, DEFAULT_STRATEGIC_CATEGORIES);
      } else {
        const categories: Category[] = [];
        snapshot.forEach((d) => {
          categories.push(d.data() as Category);
        });

        // Sort alphabetically by category name
        categories.sort((a, b) => a.name.localeCompare(b.name));
        setLocalCategoriesCache(userId, categories);
        onData(categories);
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

  return unsubscribe;
}

// ----------------- Subscription: Locations -----------------
export function subscribeToLocations(
  userId: string,
  onData: (locations: PartnerLocation[]) => void,
  onError?: (err: Error) => void
) {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const q = query(
    collection(db, LOCATIONS_COLLECTION),
    where('agentId', '==', userId)
  );

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
      onData(locations);

      updateSyncStatus({
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache,
      });
    },
    (error) => {
      console.warn('Souscription positions partenaires Firestore:', error.message);
      onError?.(error);
    }
  );

  return unsubscribe;
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
export async function saveCategory(category: Category): Promise<void> {
  const current = getLocalCategoriesCache(category.createdBy);
  const existingIdx = current.findIndex((c) => c.id === category.id);
  let updated: Category[];
  if (existingIdx >= 0) {
    updated = current.map((c) => (c.id === category.id ? category : c));
  } else {
    updated = [...current, category];
  }
  setLocalCategoriesCache(category.createdBy, updated);

  const docRef = doc(db, CATEGORIES_COLLECTION, category.id);
  await setDoc(docRef, category, { merge: true });
}

// ----------------- Delete Category -----------------
export async function deleteCategory(categoryId: string, userId?: string): Promise<void> {
  const current = getLocalCategoriesCache(userId);
  const updated = current.filter((c) => c.id !== categoryId);
  setLocalCategoriesCache(userId, updated);

  const docRef = doc(db, CATEGORIES_COLLECTION, categoryId);
  await deleteDoc(docRef);
}

// ----------------- Save Partner Location -----------------
export async function savePartnerLocation(location: PartnerLocation): Promise<void> {
  const docRef = doc(db, LOCATIONS_COLLECTION, location.id);
  await setDoc(docRef, location, { merge: true });
}

// ----------------- Delete Partner Location -----------------
export async function deletePartnerLocation(locationId: string): Promise<void> {
  const docRef = doc(db, LOCATIONS_COLLECTION, locationId);
  await deleteDoc(docRef);
}
