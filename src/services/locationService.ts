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

export function broadcastCategories(categories: Category[]) {
  categoryListeners.forEach((listener) => {
    try {
      listener(categories);
    } catch (e) {
      console.warn('Erreur écouteur catégorie:', e);
    }
  });
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
    const colRef = collection(db, CATEGORIES_COLLECTION);
    const existing = await getDocs(colRef);
    if (!existing.empty) return;

    for (const cat of DEFAULT_STRATEGIC_CATEGORIES) {
      const docPayload = cleanCategoryForFirestore({
        ...cat,
        createdBy: userId,
      });
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
  broadcastCategories(restored);

  try {
    for (const cat of restored) {
      await setDoc(doc(db, CATEGORIES_COLLECTION, cat.id), cleanCategoryForFirestore(cat), { merge: true });
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
export async function savePartnerLocation(location: PartnerLocation): Promise<void> {
  const docRef = doc(db, LOCATIONS_COLLECTION, location.id);
  await setDoc(docRef, location, { merge: true });
}

// ----------------- Delete Partner Location -----------------
export async function deletePartnerLocation(locationId: string): Promise<void> {
  const docRef = doc(db, LOCATIONS_COLLECTION, locationId);
  await deleteDoc(docRef);
}
