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

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, auth, db };
