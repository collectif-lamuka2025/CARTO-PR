import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Category, PartnerLocation } from '../types';

const CATEGORIES_COLLECTION = 'categories';
const LOCATIONS_COLLECTION = 'locations';

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

// ----------------- Default Categories Seeder -----------------
export async function seedDefaultCategoriesIfEmpty(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const q = query(
      collection(db, CATEGORIES_COLLECTION),
      where('createdBy', '==', userId)
    );
    const existing = await getDocs(q);
    if (!existing.empty) return;

    const defaults: Category[] = [
      {
        id: `cat_${userId}_commerce_1`,
        name: 'Commerces & Boutiques',
        color: '#10B981',
        icon: 'Store',
        description: 'Magasins partenaires, distributeurs et points de vente locaux.',
        createdBy: userId,
        createdAt: new Date().toISOString(),
      },
      {
        id: `cat_${userId}_ong_2`,
        name: 'ONG & Associations',
        color: '#3B82F6',
        icon: 'HeartHandshake',
        description: 'Organisations non-gouvernementales et partenaires communautaires.',
        createdBy: userId,
        createdAt: new Date().toISOString(),
      },
      {
        id: `cat_${userId}_institution_3`,
        name: 'Institutions Publiques',
        color: '#8B5CF6',
        icon: 'Building',
        description: 'Services déconcentrés, mairies et partenaires étatiques.',
        createdBy: userId,
        createdAt: new Date().toISOString(),
      },
      {
        id: `cat_${userId}_sante_4`,
        name: 'Centres de Santé & Pharmacies',
        color: '#EF4444',
        icon: 'Activity',
        description: 'Structures sanitaires et relais de santé partenaires.',
        createdBy: userId,
        createdAt: new Date().toISOString(),
      },
      {
        id: `cat_${userId}_artisans_5`,
        name: 'Artisans & Producteurs',
        color: '#F59E0B',
        icon: 'Sparkles',
        description: 'Artisans, ateliers et producteurs agricoles partenaires.',
        createdBy: userId,
        createdAt: new Date().toISOString(),
      },
    ];

    for (const cat of defaults) {
      await setDoc(doc(db, CATEGORIES_COLLECTION, cat.id), cat, { merge: true });
    }
  } catch (error) {
    console.warn('Initialisation des catégories par défaut via Firebase:', error);
  }
}

// ----------------- Subscription: Categories (Real-time + Offline Firestore Persistence) -----------------
export function subscribeToCategories(
  userId: string,
  onData: (categories: Category[]) => void,
  onError?: (err: Error) => void
) {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const q = query(
    collection(db, CATEGORIES_COLLECTION),
    where('createdBy', '==', userId)
  );

  const unsubscribe = onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const categories: Category[] = [];
      snapshot.forEach((d) => {
        categories.push(d.data() as Category);
      });

      // Sort alphabetically
      categories.sort((a, b) => a.name.localeCompare(b.name));
      onData(categories);

      updateSyncStatus({
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache,
      });
    },
    (error) => {
      console.warn('Souscription catégories Firestore:', error.message);
      onError?.(error);
    }
  );

  return unsubscribe;
}

// ----------------- Subscription: Locations (Real-time + Offline Firestore Persistence) -----------------
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

// ----------------- Save Category (Direct Firebase with Native Offline Cache) -----------------
export async function saveCategory(category: Category): Promise<void> {
  const docRef = doc(db, CATEGORIES_COLLECTION, category.id);
  await setDoc(docRef, category, { merge: true });
}

// ----------------- Delete Category (Direct Firebase with Native Offline Cache) -----------------
export async function deleteCategory(categoryId: string): Promise<void> {
  const docRef = doc(db, CATEGORIES_COLLECTION, categoryId);
  await deleteDoc(docRef);
}

// ----------------- Save Partner Location (Direct Firebase with Native Offline Cache) -----------------
export async function savePartnerLocation(location: PartnerLocation): Promise<void> {
  const docRef = doc(db, LOCATIONS_COLLECTION, location.id);
  await setDoc(docRef, location, { merge: true });
}

// ----------------- Delete Partner Location (Direct Firebase with Native Offline Cache) -----------------
export async function deletePartnerLocation(locationId: string): Promise<void> {
  const docRef = doc(db, LOCATIONS_COLLECTION, locationId);
  await deleteDoc(docRef);
}
