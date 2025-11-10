import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// Inicializa Firebase (usa variables de entorno en Vite: VITE_FIRE_API_KEY, etc.)
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIRE_PROJECT_ID,
  clientEmail: import.meta.env.VITE_FIRE_CLIENT_EMAIL,
  clientId: import.meta.env.VITE_FIRE_CLIENT_ID,
  authDomain: import.meta.env.VITE_FIRE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIRE_STORAGE_BUCKET
}


const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export default app