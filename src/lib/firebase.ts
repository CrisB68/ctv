import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  projectId: "zinc-replica-lxctm",
  appId: "1:529124697282:web:9f6eb659dcc231cb27c75b",
  apiKey: "AIzaSyCcXvGJmS2XLMbNHGqLZ5fyFrgMipLkV5g",
  authDomain: "zinc-replica-lxctm.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-portalctvagendam-6e5ac8ed-ad0b-4609-bce7-f49cefa27949",
  storageBucket: "zinc-replica-lxctm.firebasestorage.app",
  messagingSenderId: "529124697282",
  measurementId: "",
  oAuthClientId: "529124697282-6mvbvrtp959m4e8cep77bvao6aub86qu.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// Set Firestore log level to silent to prevent noisy transient warnings in sandbox/iframe environments
setLogLevel('silent');

// Initialize Firebase SDK with resilient settings for browser and iframe environments
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);

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
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isOfflineOrTransient =
    errMessage.includes('unavailable') ||
    errMessage.includes('offline') ||
    errMessage.includes('Could not reach') ||
    errMessage.includes('network');

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };

  // Suprime logs verbosos quando estiver temporariamente offline ou reconectando
  if (isOfflineOrTransient) {
    // Modo offline/cache local automático do Firestore
    return errInfo;
  }

  console.warn('Firestore sync notice:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Remove recursivamente todas as propriedades `undefined` de um objeto,
 * pois o Firestore lança erro crítico caso qualquer campo seja `undefined`.
 */
export function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore).filter((item) => item !== undefined);
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned;
  }
  return obj;
}

// Real-time Firestore sync helpers
export function subscribeToCollection<T extends { id: string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  initialSeed?: T[]
) {
  try {
    const colRef = collection(db, collectionName);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (snapshot.empty && initialSeed && initialSeed.length > 0) {
          // Seed the collection if empty in cloud
          initialSeed.forEach((item) => {
            saveDocument(collectionName, item.id, item).catch(() => {});
          });
          onData(initialSeed);
        } else {
          const docs = snapshot.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
          onData(docs);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, collectionName);
      }
    );
    return unsubscribe;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, collectionName);
    return () => {};
  }
}

export async function saveDocument<T extends Record<string, any>>(
  collectionName: string,
  docId: string,
  data: T
) {
  const path = `${collectionName}/${docId}`;
  try {
    const docRef = doc(db, collectionName, docId);
    const sanitized = cleanForFirestore(data);
    await setDoc(docRef, sanitized, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function removeDocument(collectionName: string, docId: string) {
  const path = `${collectionName}/${docId}`;
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}
