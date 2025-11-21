## Diagnóstico

* Causa: el error “Component auth has not been registered yet” aparece cuando Firebase Auth no se inicializa con persistencia nativa en React Native/Expo Go o se inicializa múltiples veces durante recargas de Metro/Hermes.

* Archivo implicado: `mobile-app/src/services/firebase.js` — la inicialización de Auth es la responsable. Cualquier uso previo de `getAuth()` o re-ejecuciones del módulo pueden causar el estado “runtime not ready”.

* Orden de carga: asegurarse de importar `src/services/firebase` antes de montar navegación/contextos en `App.js`.

## Cambios Propuestos

### 1) Inicialización única con `initializeAuth` y persistencia RN

* En `mobile-app/src/services/firebase.js` usar singleton con `globalThis` para evitar re-inicializaciones:

```js
import { initializeApp, getApps } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = { /* ...tus claves... */ };

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let auth = globalThis.__firebaseAuth;
if (!auth) {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  globalThis.__firebaseAuth = auth;
}

let db = globalThis.__firebaseDb;
if (!db) {
  db = getFirestore(app);
  globalThis.__firebaseDb = db;
}

export { app, auth, db };
```

* No usar `getAuth()` en RN/Expo Go.

* No importar `firebase/auth/react-native` (tu versión no lo expone).

### 2) Orden de importación

* En `mobile-app/App.js` mantener al inicio:

```js
import "./src/services/firebase";
```

* Luego `AuthProvider` y `AppNavigator`.

### 3) AuthContext sin efectos colaterales

* En `mobile-app/src/context/AuthContext.js` suscribirse desde la instancia `auth` ya inicializada:

```js
import React, { createContext, useState, useEffect } from "react";
import { auth } from "../services/firebase";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => await auth.signOut();

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

* Alternativamente, si se prefiere modular puro, mantener `onAuthStateChanged(auth, cb)` pero siempre después de importar `services/firebase` en `App.js`.

### 4) Pantalla de carga mientras Auth se resuelve

* En `mobile-app/src/navigation/AppNavigator.js` mostrar un overlay si `loading` está `true` antes de decidir Login/Home (ya preparado):

```js
// usar { user, loading } del AuthContext y renderizar ActivityIndicator mientras loading
```

## Verificación

* Limpiar y reiniciar:

  * PC: `npx expo start --port 8082 --clear`.

  * Teléfono: cerrar Expo Go; si persiste, limpiar caché y datos de Expo Go en Android (Ajustes → Apps → Expo Go → Almacenamiento → Borrar caché/datos).

  * Reabrir con el QR/URL actual.

* Comprobar:

  * Sin sesión → aparece Login/Registro interactivo.

  * Con sesión → navega a Home.

  * No debe aparecer “Component auth has not been registered yet”.

## Notas

* Evitar duplicar inicialización en cualquier otra ruta/archivo.

* Mantener una sola instancia de `app`, `auth` y `db` con los flags `globalThis.__firebase*`.

## Siguiente Paso

* Implementar exactamente los cambios propuestos y reiniciar bundler + limpiar Expo Go en el dispositivo. ¿Confirmas que proceda con la aplicación de estos cambios

