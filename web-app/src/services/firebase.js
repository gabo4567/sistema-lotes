import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFirebaseApp } from "../utils/firebaseClient";

const app = getFirebaseApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;