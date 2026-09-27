import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Category, PartnerLocation } from '../types';

export interface SyncAction {
  id: string;
  type: 'SAVE_LOCATION' | 'DELETE_LOCATION' | 'SAVE_CATEGORY' | 'DELETE_CATEGORY';
  payload: any;
  timestamp: number;
}

interface CartoPartnerDB extends DBSchema {
  categories: {
    key: string;
    value: Category;
    indexes: { 'by-name': string };
  };
  locations: {
    key: string;
    value: PartnerLocation;
    indexes: { 'by-category': string; 'by-createdAt': string };
  };
  syncQueue: {
    key: string;
    value: SyncAction;
    indexes: { 'by-timestamp': number };
  };
}

const DB_NAME = 'carto_partenaires_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CartoPartnerDB>> | null = null;

export function getLocalDB(): Promise<IDBPDatabase<CartoPartnerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CartoPartnerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Categories store
        if (!db.objectStoreNames.contains('categories')) {
          const catStore = db.createObjectStore('categories', { keyPath: 'id' });
          catStore.createIndex('by-name', 'name');
        }

        // Locations store
        if (!db.objectStoreNames.contains('locations')) {
          const locStore = db.createObjectStore('locations', { keyPath: 'id' });
          locStore.createIndex('by-category', 'categoryId');
          locStore.createIndex('by-createdAt', 'createdAt');
        }

        // Outbox Sync Queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
}

// ----------------- Categories Local Cache -----------------
export async function getLocalCategories(userId?: string): Promise<Category[]> {
  const db = await getLocalDB();
  const list = await db.getAll('categories');
  const filtered = userId ? list.filter((c) => c.createdBy === userId) : list;
  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

export async function putLocalCategory(category: Category): Promise<void> {
  const db = await getLocalDB();
  await db.put('categories', category);
}

export async function putLocalCategoriesBatch(categories: Category[]): Promise<void> {
  const db = await getLocalDB();
  const tx = db.transaction('categories', 'readwrite');
  for (const cat of categories) {
    await tx.store.put(cat);
  }
  await tx.done;
}

export async function deleteLocalCategory(categoryId: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('categories', categoryId);
}

// ----------------- Locations Local Cache -----------------
export async function getLocalLocations(userId?: string): Promise<PartnerLocation[]> {
  const db = await getLocalDB();
  const list = await db.getAll('locations');
  const filtered = userId ? list.filter((l) => l.agentId === userId) : list;
  return filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function putLocalLocation(location: PartnerLocation): Promise<void> {
  const db = await getLocalDB();
  await db.put('locations', location);
}

export async function putLocalLocationsBatch(locations: PartnerLocation[]): Promise<void> {
  const db = await getLocalDB();
  const tx = db.transaction('locations', 'readwrite');
  for (const loc of locations) {
    await tx.store.put(loc);
  }
  await tx.done;
}

export async function deleteLocalLocation(locationId: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('locations', locationId);
}

// ----------------- Outbox Sync Queue -----------------
export async function enqueueSyncAction(
  type: SyncAction['type'],
  payload: any
): Promise<SyncAction> {
  const db = await getLocalDB();
  const action: SyncAction = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    timestamp: Date.now(),
  };
  await db.put('syncQueue', action);
  return action;
}

export async function getSyncQueue(): Promise<SyncAction[]> {
  const db = await getLocalDB();
  const list = await db.getAll('syncQueue');
  return list.sort((a, b) => a.timestamp - b.timestamp);
}

export async function removeSyncAction(id: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('syncQueue', id);
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getLocalDB();
  await db.clear('syncQueue');
}
