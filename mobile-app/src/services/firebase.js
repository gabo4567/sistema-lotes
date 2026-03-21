import { initializeApp, getApps } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCdkIQhs8Xe0GD53qara8p05kjky5sc2bE",
  authDomain: "sistema-lotes-4ce37.firebaseapp.com",
  projectId: "sistema-lotes-4ce37",
  storageBucket: "sistema-lotes-4ce37.firebasestorage.app",
  messagingSenderId: "377269576799",
  appId: "1:377269576799:web:223164fc4fc09d1c4567ea",
};

let app;
let auth;
let db;

// 🔥 INICIALIZACIÓN CORRECTA PARA EXPO GO Y STANDALONE
// Wrapped in try/catch so any initialization failure doesn't crash the app
try {
  if (!globalThis.__firebaseApp) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    globalThis.__firebaseApp = app;
  } else {
    app = globalThis.__firebaseApp;
  }

  if (!globalThis.__firebaseAuth) {
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch (authErr) {
      // auth/already-initialized: another call already set it up – reuse it
      auth = getAuth(app);
    }
    globalThis.__firebaseAuth = auth;
  } else {
    auth = globalThis.__firebaseAuth;
  }

  if (!globalThis.__firebaseDb) {
    db = getFirestore(app);
    globalThis.__firebaseDb = db;
  } else {
    db = globalThis.__firebaseDb;
  }

  if (__DEV__) {
    console.log("firebase project:", {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
    });
  }
} catch (e) {
  // Store the error so AuthContext can surface it to the user
  globalThis.__firebaseInitError = e?.message || "Firebase init failed";
  if (__DEV__) console.error("Firebase initialization error:", e?.message);
}

export { auth, db };