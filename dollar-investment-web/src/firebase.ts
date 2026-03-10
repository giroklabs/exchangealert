import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCtK8kOMXaZ4XOvrHhZ2-a6NTfUKRZFnxo",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dollar-invest-c893e.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dollar-invest-c893e",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dollar-invest-c893e.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "747458976052",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:747458976052:web:813f52cc7bd6d193bd2d61",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

export const loginWithGoogle = () => signInWithPopup(auth, provider);
export const logout = () => signOut(auth);
