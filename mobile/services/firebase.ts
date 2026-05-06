import { initializeApp, getApps, getApp } from 'firebase/app';
// React Native: must use initializeAuth + AsyncStorage persistence on first init.
// @ts-ignore
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration derived from google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyAY9EVPePh8sMz_D-6PoECbPz4peLQPx9o",
  authDomain: "gramchainn.firebaseapp.com",
  projectId: "gramchainn",
  storageBucket: "gramchainn.firebasestorage.app",
  messagingSenderId: "51986108180",
  appId: "1:51986108180:web:6840775c10f3bab2b9fc01",
  measurementId: "G-64LWY3F57R"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

let _auth: any = null;
try {
  _auth = getAuth(app);
} catch (e) {
  try {
    _auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e2) {
    console.warn("Failed to initialize auth. Fallback to dummy to prevent crash", e2);
    _auth = { app } as any;
  }
}

export const auth = _auth as Auth;
