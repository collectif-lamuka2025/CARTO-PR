import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
} from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyANEzatTp-UXXTjW0UjfJz8KIroAtpDTo0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'carto-pr.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'carto-pr',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'carto-pr.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '919525800735',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:919525800735:web:f5f13b266cf9c7bf94ce2a',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-2KV098T140',
};

const firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(default)';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  }).catch(() => {});
}

// Silence internal Firestore offline/reconnection console warnings
setLogLevel('silent');

// Enable Firestore native persistent cache for seamless offline writes & background auto-sync
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  firestoreDatabaseId
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export async function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): Promise<FirestoreErrorInfo> {
  const errMessage = error instanceof Error ? error.message : String(error);
  const currentUser = auth.currentUser;
  const authInfo = {
    userId: currentUser?.uid,
    email: currentUser?.email,
    emailVerified: currentUser?.emailVerified,
    isAnonymous: currentUser?.isAnonymous,
    tenantId: currentUser?.tenantId,
  };

  const errorInfo: FirestoreErrorInfo = {
    error: errMessage,
    operationType,
    path,
    authInfo,
  };

  console.error('Firestore Error Details:', errorInfo);
  return errorInfo;
}
