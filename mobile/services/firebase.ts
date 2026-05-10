import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
// React Native: must use initializeAuth + AsyncStorage persistence on first init.
// @ts-ignore
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// React Native Firebase — used for Phone Auth (works without reCAPTCHA via Play Integrity)
// Lazy-load only when explicitly requested to prevent native crashes
let rnAuth: any = null;
let rnAuthLoaded = false;

export const getRnAuth = () => {
  if (Platform.OS === 'web') return null;
  if (!rnAuthLoaded) {
    try {
      rnAuth = require('@react-native-firebase/auth').default;
      rnAuthLoaded = true;
    } catch (e) {
      console.warn('Failed to load @react-native-firebase/auth:', e);
    }
  }
  return rnAuth;
};

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
  // Only use React Native persistence on native platforms
  if (Platform.OS !== 'web') {
    try {
      _auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch (e2) {
      console.warn("Failed to initialize auth. Fallback to dummy to prevent crash", e2);
      _auth = { app } as any;
    }
  } else {
    // Web: use default auth without persistence
    _auth = { app } as any;
  }
}

export const auth = _auth as Auth;

// Native Firebase auth (used for Phone Auth — no reCAPTCHA, uses Play Integrity / APNs)
// Use this for: signInWithPhoneNumber(), confirmation.confirm(otp)
// Keep `auth` (JS SDK) for: Google sign-in credential creation
// Lazy-loaded via getRnAuth() to prevent native crashes
