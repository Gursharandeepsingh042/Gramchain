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
// IMPORTANT: apiKey must match the Android API key from google-services.json
// for native Phone Auth to work. The web API key is different and won't work on Android.
const firebaseConfig = {
  apiKey: "AIzaSyC2dDFEBJcj5gJuVB9rYO2s8yIY68XIVCo",
  authDomain: "gramchainn.firebaseapp.com",
  projectId: "gramchainn",
  storageBucket: "gramchainn.firebasestorage.app",
  messagingSenderId: "51986108180",
  appId: "1:51986108180:android:558278ad6455712bb9fc01",
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

let _auth: any = null;
// Always use initializeAuth with AsyncStorage on native platforms for persistence
if (Platform.OS !== 'web') {
  try {
    _auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    console.warn("Failed to initialize auth with AsyncStorage. Fallback to getAuth", e);
    try {
      _auth = getAuth(app);
    } catch (e2) {
      console.warn("Failed to initialize auth. Fallback to dummy to prevent crash", e2);
      _auth = { app } as any;
    }
  }
} else {
  // Web: use default auth without persistence
  try {
    _auth = getAuth(app);
  } catch (e) {
    console.warn("Failed to initialize auth. Fallback to dummy to prevent crash", e);
    _auth = { app } as any;
  }
}

export const auth = _auth as Auth;

// Native Firebase auth (used for Phone Auth — no reCAPTCHA, uses Play Integrity / APNs)
// Use this for: signInWithPhoneNumber(), confirmation.confirm(otp)
// Keep `auth` (JS SDK) for: Google sign-in credential creation
// Lazy-loaded via getRnAuth() to prevent native crashes

// In-memory holder for the ConfirmationResult returned by
// @react-native-firebase/auth's signInWithPhoneNumber(). The object holds
// native handles and cannot be serialized to AsyncStorage; we keep it in
// module memory while the user navigates from phone-entry → verify-otp.
let pendingConfirmation: any = null;
export const setPendingConfirmation = (c: any) => { pendingConfirmation = c; };
export const getPendingConfirmation = () => pendingConfirmation;
export const clearPendingConfirmation = () => { pendingConfirmation = null; };
