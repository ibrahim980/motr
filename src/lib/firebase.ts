import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

const required = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .map(([k]) => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

if (missing.length) {
  throw new Error(
    `Missing Firebase env vars: ${missing.join(', ')}. Copy .env.example to .env.local and fill in your Firebase project values.`
  );
}

const firebaseConfig: FirebaseOptions = {
  apiKey: required.apiKey,
  authDomain: required.authDomain,
  projectId: required.projectId,
  appId: required.appId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

const databaseId = env.VITE_FIREBASE_DATABASE_ID;

const app = initializeApp(firebaseConfig);
export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
export const auth = getAuth(app);
