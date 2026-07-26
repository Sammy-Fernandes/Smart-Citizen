import { Platform } from 'react-native';
import firebaseWeb from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyC_J29mrAmjAFOoUos65aMnH3_itnRNOqE",
  authDomain: "civic-engagement-app-67289.firebaseapp.com",
  projectId: "civic-engagement-app-67289",
  storageBucket: "civic-engagement-app-67289.firebasestorage.app",
  messagingSenderId: "152362654985",
  appId: "1:152362654985:web:1a91295286475653b47f61",
  measurementId: "G-W13ESJ8CTN"
};

let auth: any;
let db: any;
let firestoreExport: any;

if (Platform.OS === 'web') {
  if (!firebaseWeb.apps.length) {
    firebaseWeb.initializeApp(firebaseConfig);
  }
  auth = firebaseWeb.auth();
  db = firebaseWeb.firestore();
  firestoreExport = firebaseWeb.firestore;
  console.log("✅ Firebase initialized for Web via firebase/compat");
} else {
  // Native Android/iOS
  const firebaseNative = require('@react-native-firebase/app').default;
  const firestoreModule = require('@react-native-firebase/firestore').default;
  const authModule = require('@react-native-firebase/auth').default;

  if (!firebaseNative.apps || firebaseNative.apps.length === 0) {
    firebaseNative.initializeApp(firebaseConfig);
  }
  auth = authModule();
  db = firestoreModule();
  firestoreExport = firestoreModule;
  console.log("✅ Firebase initialized for Native via @react-native-firebase");
}

if (__DEV__ && auth?.settings) {
  try {
    auth.settings.appVerificationDisabledForTesting = true;
  } catch (e) {
    // Ignore setting error if unsupported on platform
  }
}

export { auth, db, firestoreExport as firestore };
