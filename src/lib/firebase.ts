import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const env = import.meta.env;

// Public web configuration. Authorization is enforced by Firebase Auth + Database Rules.
// Values come from VITE_* variables when set (a platform's env settings or .env); otherwise the built-in defaults below
// are used, so the project builds and runs on any host with zero configuration.
const pick = (value: string | undefined, fallback: string) => (value && value.trim() ? value.trim() : fallback);

const firebaseConfig = {
  apiKey: pick(env.VITE_FIREBASE_API_KEY, 'AIzaSyABGKzUxZrHlGFUOaaCoLpJFrFNWyPaLn0'),
  authDomain: pick(env.VITE_FIREBASE_AUTH_DOMAIN, 'pdfuploader-49bb0.firebaseapp.com'),
  databaseURL: pick(env.VITE_FIREBASE_DATABASE_URL, 'https://pdfuploader-49bb0-default-rtdb.firebaseio.com'),
  projectId: pick(env.VITE_FIREBASE_PROJECT_ID, 'pdfuploader-49bb0'),
  storageBucket: pick(env.VITE_FIREBASE_STORAGE_BUCKET, 'pdfuploader-49bb0.firebasestorage.app'),
  messagingSenderId: pick(env.VITE_FIREBASE_MESSAGING_SENDER_ID, '407175556689'),
  appId: pick(env.VITE_FIREBASE_APP_ID, '1:407175556689:web:1f87c4239b662832ae5270'),
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);

// The admin session survives closing the site or browser. It ends only on sign out or when the access code is changed
// (changing the code revokes the old refresh token, so every other device is asked for the new code).
void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
