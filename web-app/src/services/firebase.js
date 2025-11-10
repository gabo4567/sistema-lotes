// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdkIQhs8Xe0GD53qara8p05kjky5sc2bE",
  authDomain: "sistema-lotes-4ce37.firebaseapp.com",
  projectId: "sistema-lotes-4ce37",
  storageBucket: "sistema-lotes-4ce37.firebasestorage.app",
  messagingSenderId: "377269576799",
  appId: "1:377269576799:web:223164fc4fc09d1c4567ea"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;