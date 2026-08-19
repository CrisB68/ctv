import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
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

// Initialize Firebase SDK
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
  
  // Se for apenas estado offline temporário, registra apenas como informação
  if (errMessage.includes('unavailable') || errMessage.includes('offline') || errMessage.includes('Could not reach')) {
    console.info('Firestore em cache/offline:', path);
  } else {
    console.warn('Firestore sync notice:', JSON.stringify(errInfo));
  }
  return errInfo;
}

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'therapies', 'test_connection'));
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (msg.includes('unavailable') || msg.includes('offline') || msg.includes('Could not reach')) {
      console.info('Firestore: Operando em modo offline / cache local enquanto sincroniza com a nuvem.');
    }
  }
}

testConnection();

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
    await setDoc(docRef, data, { merge: true });
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
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}
