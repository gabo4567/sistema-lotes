## Qué pasa ahora

* La pantalla de Login aparece, pero registrar usuario falla con mensaje genérico. En Firebase, el registro falla si:

  * El proveedor Email/Password está deshabilitado.

  * La contraseña tiene menos de 6 caracteres.

  * El correo ya existe o es inválido.

  * El `firebaseConfig` apunta a otro proyecto o hay problemas de red.

* En Expo Go, debemos usar `initializeAuth(...)` y evitar `getAuth()`, ya está aplicado. Falta visibilidad de errores.

## Cómo iniciar sesión ahora (sin tocar el código)

* Entra a Firebase Console → Authentication → Users → "Add user".

* Crea un usuario de prueba (por ejemplo: `prueba@correo.com`, contraseña fuerte ≥ 6 caracteres).

* En la app, usa ese correo y contraseña en la pantalla de Login.

* Si entra, verás Home; si no, el error proviene de configuración/credenciales.

## Cambios propuestos en la app

### 1) Registrar con feedback de error detallado

* `src/screens/RegisterScreen.js`:

  * Mostrar `err.code` y mensajes específicos (invalid-email, weak-password, email-already-in-use, network-request-failed, internal-error).

  * Validar mínimo de contraseña (≥6).

### 2) Login con feedback completo

* `src/screens/LoginScreen.js`:

  * Mostrar `err.code` y mensajes específicos (invalid-credential, wrong-password, user-not-found, invalid-email, network-request-failed).

### 3) Diagnóstico de configuración

* Verificación rápida en tiempo de ejecución:

  * Log del `projectId` y `authDomain` de `firebaseConfig` al iniciar (solo en dev) para confirmar el proyecto correcto.

  * Mensaje si `Email/Password` no está habilitado (documentaremos cómo habilitarlo en la consola).

### 4) UX

* Deshabilitar botones mientras `loading=true` y evitar toques múltiples.

* Mantener la pantalla de carga si `AuthContext.loading` está activo.

## Entregables concretos

* Actualizaciones en `RegisterScreen.js` y `LoginScreen.js` para surfacing de errores y validaciones.

* Logs de configuración en dev.

* Instrucciones claras para habilitar Email/Password en Firebase Console.

## Verificación

* Reiniciar bundler: `npx expo start --port 8082 --clear`.

* Cerrar Expo Go; si persiste, borrar caché/datos de Expo Go.

* Probar:

  * Registro con contraseña ≥6 y correo válido.

  * Login con usuario desde Firebase Console.

  * Confirmar navegación a Home.

## ¿Procedo?

* Si confirmas, aplicaré las modificaciones propuestas y te entregaré los mensajes de error claros y la verificación de configuración en la app.

