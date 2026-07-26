import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Config extracted from mobile app config/firebase.ts
const firebaseConfig = {
    apiKey: "AIzaSyC_J29mrAmjAFOoUos65aMnH3_itnRNOqE",
    authDomain: "civic-engagement-app-67289.firebaseapp.com",
    projectId: "civic-engagement-app-67289",
    storageBucket: "civic-engagement-app-67289.firebasestorage.app",
    messagingSenderId: "152362654985",
    appId: "1:152362654985:web:1a91295286475653b47f61",
    measurementId: "G-W13ESJ8CTN"
};

// Singleton pattern to prevent Next.js Turbopack HMR re-initialization assertion errors
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const globalWithFirebase = globalThis as unknown as {
    __FIREBASE_AUTH__?: ReturnType<typeof getAuth>;
    __FIREBASE_DB__?: ReturnType<typeof getFirestore>;
};

const auth = globalWithFirebase.__FIREBASE_AUTH__ || (globalWithFirebase.__FIREBASE_AUTH__ = getAuth(app));
const db = globalWithFirebase.__FIREBASE_DB__ || (globalWithFirebase.__FIREBASE_DB__ = getFirestore(app));

export { app, auth, db };
