## Objetivo
- Autenticar productores con `IPT + contraseña` (inicial = CUIL), emitir `customToken` para mobile, forzar cambio de contraseña en primer ingreso y actualizar `historialIngresos`.

## Cambios en Backend
- **Nuevos endpoints**
  - `POST /auth/login-productor`
    - Body: `{ ipt: string, password: string }`
    - Pasos:
      - Buscar `productor` por `ipt` en `Firestore` (`collection: productores`).
      - Validar `estado` (permitir `Nuevo|Vigente|Re-empadronado`, rechazar `Vencido`).
      - Si `requiereCambioContrasena === true` ⇒ comparar `password` con `cuil` (o con `passwordHash` si se decidió hashear la inicial).
      - Si `requiereCambioContrasena === false` ⇒ comparar `password` con `passwordHash`.
      - Emitir `customToken` con claims `{ role: 'productor', ipt }` usando `admin.auth().createCustomToken(ipt, claims)`.
      - Actualizar `historialIngresos` (`increment(1)`).
      - Responder `{ token, requiereCambioContrasena }`.
  - `POST /auth/productor/cambiar-password`
    - Body: `{ ipt, oldPassword, newPassword }`
    - Validaciones:
      - Si `requiereCambioContrasena === true`: `oldPassword` debe coincidir con `cuil` (o `passwordHash` en inicial).
      - Reglas: `newPassword.length >= 6`.
    - Acciones:
      - Guardar `passwordHash` (bcrypt) en `productores`.
      - Establecer `requiereCambioContrasena = false`.
      - Opcional: invalidar sesiones anteriores.
- **Ubicaciones de código**
  - Rutas: `backend/src/routes/auth.routes.js`
  - Controlador: `backend/src/controllers/auth.controller.js`
  - Admin SDK: `backend/src/utils/firebase.js`
- **Modelo Firestore (productores)**
  - Campos nuevos/confirmados: `ipt (pk)`, `cuil`, `passwordHash`, `requiereCambioContrasena:boolean`, `historialIngresos:number`, `estado`, `domicilioIngresoCoord`, `plantasPorHa`, etc.
- **Seguridad**
  - Usar `bcryptjs` para `passwordHash` (inicial y nueva).
  - Nunca devolver datos sensibles.

## Cambios en Mobile (Expo/React Native)
- **Login productor**
  - `mobile-app/src/screens/LoginScreen.js`
    - Inputs: `ipt` (numérico 4–10 dígitos), `password`.
    - Acción: `POST /auth/login-productor`.
    - Si `requiereCambioContrasena === true`: navegar a `ChangePasswordScreen`.
    - Si `false`: `auth.signInWithCustomToken(token)` y navegar a `Home`.
- **Cambio de contraseña obligatorio**
  - Nueva pantalla: `mobile-app/src/screens/ChangePasswordScreen.js`
    - Inputs: `oldPassword`, `newPassword`, `confirm`.
    - Acción: `POST /auth/productor/cambiar-password`.
    - Al éxito: `auth.signInWithCustomToken(token)` (opcional si el backend retorna uno, o re-login), y continuar a `Home`.
- **Contexto y navegación**
  - `mobile-app/src/context/AuthContext.js`: mantener `onAuthStateChanged`.
  - `mobile-app/src/navigation/AppNavigator.js`: gateo según `user`; incluir ruta de cambio de contraseña si es requerido (basado en respuesta del backend o consulta rápida del productor).
- **Eliminaciones/Ajustes**
  - Quitar registro por email/contraseña en mobile.

## Verificación
- **Flujos a probar**
  - Primer ingreso: `ipt` + `cuil` ⇒ redirige a cambio de contraseña ⇒ vuelve a Home con `requiereCambioContrasena=false`.
  - Ingreso posterior: `ipt` + nueva contraseña ⇒ entra directo.
  - Errores manejados: `productor no encontrado`, `estado inválido`, `contraseña incorrecta`, `red`, `reglas de longitud`.
- **Pruebas**
  - Backend: pruebas a endpoints con productor de ejemplo en Firestore.
  - Mobile: probar en dispositivo físico con Expo Go.

## Entregables
- Backend: nuevas rutas y controlador con lógica de login/cambio de contraseña, actualización de modelo `productores`.
- Mobile: Login productor con `customToken`, pantalla de cambio de contraseña y navegación actualizada.

## Siguiente paso
- ¿Confirmás que implemente este módulo ahora? Tras finalizar y demostrarlo funcionando, avanzo con “Roles y permisos en la Web” como segundo módulo.