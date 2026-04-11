import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app, analytics, auth, provider, db;

if (firebaseConfig.projectId && firebaseConfig.projectId !== "undefined") {
    app = initializeApp(firebaseConfig);
    try {
        analytics = getAnalytics(app);
    } catch (e) {
        console.warn('Analytics initialization failed:', e.message);
    }
    
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    db = getFirestore(app);
} else {
    console.warn("⚠️ Firebase 설정(.env)이 누락되어 로컬 개발 모드로 구동됩니다. 인증/DB 기능은 비활성화됩니다.");
}

export { analytics, auth, provider, db };

export const loginWithGoogle = () => {
    if (!auth) return Promise.reject("Firebase is not initialized");
    return signInWithPopup(auth, provider);
};
export const logout = () => {
    if (!auth) return Promise.resolve();
    return signOut(auth);
};
