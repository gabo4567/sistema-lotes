import { getAuth } from 'firebase/auth'
import { getFirebaseApp } from './firebaseClient'

const app = getFirebaseApp()
export const auth = getAuth(app)
export default app