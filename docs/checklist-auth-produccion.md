# Checklist de Aceptación — Flujo de Autenticación en Producción

**Sistema:** Panel de administración IPT  
**Versión:** 1.0.0  
**Fecha:** Marzo 2026  
**Entornos:** Frontend → Vercel · Backend → Render · Auth → Firebase Authentication

---

## Requisitos previos

Antes de ejecutar las pruebas verificar:

- [ ] La app está desplegada en Vercel y el backend en Render
- [ ] Firebase Authentication tiene al menos un usuario activo (admin@ipt.gob.ar o similar)
- [ ] Las variables de entorno están configuradas en ambos entornos (ver sección al pie)
- [ ] La consola del navegador (F12 > Console) está abierta para observar errores en tiempo real
- [ ] La pestaña Network (F12 > Network) está abierta para inspeccionar llamadas HTTP

---

## Prueba 1 — Login correcto con credenciales válidas

**Objetivo:** Verificar el flujo completo Firebase → Backend → JWT → Redirección

**Pasos:**
1. Navegar a `https://[tu-dominio].vercel.app/login`
2. Ingresar email y contraseña válidos de un usuario activo
3. Hacer clic en **Ingresar**

**Resultados esperados:**
- [ ] Botón muestra "Ingresando..." y queda deshabilitado mientras carga
- [ ] Aparece toast SweetAlert2 verde: "Inicio de sesión exitoso"
- [ ] Se redirige automáticamente a `/home`
- [ ] En Network se observan dos llamadas exitosas:
  - `POST https://identitytoolkit.googleapis.com/...` → 200 (Firebase)
  - `POST https://[backend].onrender.com/api/auth/login` → 200 con `{ token, role }`
- [ ] En Application > Local Storage existe la clave `token` con un JWT válido

**Si falla:** revisar que `VITE_FIRE_API_KEY` y `VITE_API_URL` están correctamente configuradas en Vercel.

---

## Prueba 2 — Contraseña incorrecta

**Objetivo:** Firebase rechaza el intento y el frontend muestra un mensaje genérico sin enumerar usuarios

**Pasos:**
1. Ingresar un email válido (que exista en Firebase) con una contraseña incorrecta
2. Hacer clic en **Ingresar**

**Resultados esperados:**
- [ ] Aparece toast rojo: "No se pudo iniciar sesión"
- [ ] Mensaje inline debajo del botón: **"Email o contraseña incorrectos."**
- [ ] No se redirige a ninguna otra pantalla
- [ ] No se cierra el formulario
- [ ] En Network: no se realiza llamada al backend (Firebase rechaza antes)
- [ ] Sin `console.error` visible con datos de credenciales

**Nota de seguridad:** el mensaje es intencionalmente genérico (no dice "contraseña incorrecta" ni "email correcto").

---

## Prueba 3 — Usuario inexistente

**Objetivo:** Firebase no devuelve si el email existe o no (evitar enumeración de usuarios)

**Pasos:**
1. Ingresar un email que no existe en Firebase (ej: `noexiste@ipt.gob.ar`)
2. Ingresar cualquier contraseña
3. Hacer clic en **Ingresar**

**Resultados esperados:**
- [ ] El mensaje mostrado es **idéntico** al de contraseña incorrecta: "Email o contraseña incorrectos."
- [ ] No se revela si el email está o no registrado
- [ ] Igual comportamiento visual que Prueba 2

---

## Prueba 4 — Usuario deshabilitado en Firebase

**Objetivo:** Cuenta bloqueada muestra un mensaje específico y no permite el ingreso

**Preparación:** en Firebase Console > Authentication, deshabilitar temporalmente la cuenta de un usuario de prueba.

**Pasos:**
1. Intentar hacer login con la cuenta deshabilitada

**Resultados esperados:**
- [ ] Toast rojo con texto: **"La cuenta ha sido deshabilitada. Contacte al administrador."**
- [ ] No se genera JWT ni redirección
- [ ] Ningún dato interno expuesto en consola

**Restaurar:** rehabilitar la cuenta al finalizar la prueba.

---

## Prueba 5 — Demasiados intentos fallidos

**Objetivo:** Firebase bloquea temporalmente y el rate limiter del backend protege el endpoint

**Pasos:**
1. Ingresar credenciales incorrectas 10+ veces consecutivas rápidamente

**Resultados esperados:**
- [ ] A partir del 5.º–8.º intento, Firebase comienza a rechazar con un desafío reCAPTCHA o devuelve `auth/too-many-requests`
- [ ] Mensaje mostrado: **"Demasiados intentos fallidos. Espere unos minutos e intente de nuevo."**
- [ ] Si algún intento llega al backend (raro), responde HTTP 429: "Demasiados intentos de inicio de sesión"
- [ ] El bloqueo se levanta solo después de unos minutos sin necesidad de acción extra

---

## Prueba 6 — Refresh de página con sesión activa

**Objetivo:** La sesión se restaura automáticamente sin logout ni redirección a /login

**Pasos:**
1. Iniciar sesión exitosamente (ya autenticado en /home)
2. Presionar **F5** o recargar con `Ctrl+R`

**Resultados esperados:**
- [ ] La pantalla carga directamente en `/home` (sin flashear /login)
- [ ] El nombre de usuario y rol se restauran correctamente en la UI
- [ ] En Network se observa una llamada silenciosa a `POST /api/auth/login` que renueva el JWT automáticamente
- [ ] El Firebase ID Token se refresca transparentemente si está por vencer

**Mecanismo que lo hace funcionar:** `onAuthStateChanged` en `AuthContext` detecta la sesión de Firebase persistida y revalida contra el backend antes de marcar `authReady = true`. `ProtectedRoute` espera `authReady` antes de decidir redirigir.

---

## Prueba 7 — Token JWT del sistema expirado (simulación)

**Objetivo:** Cuando el JWT propio expira (24h), el sistema hace logout automático

**Preparación (sin esperar 24h):**
1. Abrir Application > Local Storage en DevTools
2. Reemplazar el valor de `token` con un JWT modificado: cambiar `exp` al pasado  
   — O simplemente modificar un carácter para invalidar la firma

**Pasos:**
1. Intentar navegar a cualquier ruta protegida (ej: `/lotes`)

**Resultados esperados:**
- [ ] El backend responde HTTP 401
- [ ] El interceptor de Axios detecta el 401 y llama al `authFailureHandler`
- [ ] Se ejecuta `logout({ redirect: true })`
- [ ] El usuario es redirigido a `/login`
- [ ] El `localStorage.token` queda eliminado
- [ ] No hay datos sensibles en consola

---

## Prueba 8 — Logout

**Objetivo:** Cerrar sesión limpia completamente el estado de autenticación

**Pasos:**
1. Estando autenticado, hacer clic en el botón de **Cerrar sesión** (en Home o Navbar)
2. Intentar navegar manualmente a `/home`

**Resultados esperados:**
- [ ] El `localStorage.token` es eliminado inmediatamente
- [ ] La sesión de Firebase queda cerrada (verificable en Firebase Console > Authentication)
- [ ] Al intentar acceder a `/home`, se redirige a `/login`
- [ ] No queda ningún dato de usuario en memoria
- [ ] Presionar "Atrás" en el navegador no restaura la sesión

---

## Prueba 9 — Validación del formulario de login (sin envío al servidor)

**Objetivo:** Errores de formato se detectan en cliente sin consumir requests

**Sub-casos:**

| Acción | Resultado esperado |
|---|---|
| Enviar formulario vacío | "El email es requerido." bajo el campo email |
| Email sin formato válido (`a@b`) | "Ingrese un email con formato válido." |
| Email válido pero sin contraseña | "La contraseña es requerida." |
| Hacer clic múltiples veces rápido | Solo se procesa el primer clic (botón deshabilitado) |

**Verificar en Network:** ninguna llamada HTTP debe generarse en estos casos.

---

## Prueba 10 — Flujo completo de recuperación de contraseña

**Objetivo:** El usuario recupera acceso sin que el sistema exponga si el email existe o no

**Pasos:**
1. En el login, escribir el email y hacer clic en **¿Olvidaste tu contraseña?**
2. Verificar que el email se pre-rellena en la pantalla de recuperación
3. Hacer clic en **Enviar enlace de recuperación**
4. Revisar la bandeja de entrada del email registrado
5. Hacer clic en el enlace del correo
6. Establecer una nueva contraseña
7. Verificar que se redirige de vuelta al login (o al `continueUrl` configurado)
8. Hacer login con la nueva contraseña

**Resultados esperados:**
- [ ] El campo email viene pre-cargado desde la URL
- [ ] Al enviar: toast verde "Correo de recuperación enviado" + mensaje en pantalla
- [ ] **Si el email NO existe:** se muestra el mismo mensaje de éxito (previene enumeración)
- [ ] El correo llega desde Firebase (no-reply@[proyecto].firebaseapp.com)
- [ ] El enlace del correo lleva a la pantalla de reset de Firebase
- [ ] Después del reset, el usuario es redirigido a `/login` (o a la URL configurada en `VITE_PASSWORD_RESET_CONTINUE_URL`)
- [ ] El nuevo login funciona correctamente con la nueva contraseña

**Error de formato:**
- [ ] Al enviar un email inválido (`abc`): "Ingrese un correo electrónico válido." + toast rojo

---

## Prueba 11 — Rutas 404 (SPA fallback en Vercel)

**Objetivo:** El acceso directo por URL a rutas de la SPA no devuelve 404

**Pasos:**
1. Sin estar autenticado, abrir directamente en el navegador:
   - `https://[tu-dominio].vercel.app/login`
   - `https://[tu-dominio].vercel.app/forgot-password`
   - `https://[tu-dominio].vercel.app/reset-password`
   - `https://[tu-dominio].vercel.app/home`

**Resultados esperados:**
- [ ] Ninguna URL devuelve un error 404 de Vercel
- [ ] Las rutas públicas muestran su pantalla correctamente
- [ ] `/home` redirige a `/login` si no hay sesión activa
- [ ] `/forgot-password` y `/reset-password` muestran la misma pantalla de recuperación

**Mecanismo:** el archivo `vercel.json` con `"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]` hace que todas las rutas sean manejadas por React Router.

---

## Prueba 12 — Protección de rutas por rol

**Objetivo:** Un usuario con rol "Técnico" no puede acceder a secciones de "Administrador"

**Pasos:**
1. Autenticarse con una cuenta de rol **Técnico**
2. Navegar manualmente a `/insumos` (solo Administradores)
3. Navegar manualmente a `/users` (solo Administradores)

**Resultados esperados:**
- [ ] Se redirige a `/403` en lugar de cargar la pantalla
- [ ] No se realizan llamadas al backend de recursos no autorizados

---

## Variables de entorno — Verificación final

### Frontend (Vercel)

| Variable | Valor esperado |
|---|---|
| `VITE_API_URL` | `https://[backend].onrender.com` (sin `/api`) |
| `VITE_FIREBASE_API_KEY` | API Key de Firebase (producción) |
| `VITE_FIREBASE_AUTH_DOMAIN` | `[proyecto].firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | ID del proyecto Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Bucket de Firebase Storage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID de Firebase |
| `VITE_FIREBASE_APP_ID` | App ID de Firebase |
| `VITE_PASSWORD_RESET_CONTINUE_URL` | `https://[tu-dominio].vercel.app/login` |

> Compatibilidad temporal: el frontend también acepta `VITE_FIRE_*` por backward compatibility, pero para producción usar `VITE_FIREBASE_*`.

### Backend (Render)

| Variable | Valor esperado |
|---|---|
| `JWT_SECRET` | Cadena segura ≥ 32 chars (generar con `openssl rand -base64 48`) |
| `ALLOWED_ORIGINS` | `https://[tu-dominio].vercel.app` (sin trailing slash) |
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo de la service account (en una sola línea) |
| `NODE_ENV` | `production` |
| `WEB_EMAIL_DOMAIN` | (opcional) `ipt.gob.ar` para restringir registros |
| `WEB_PASSWORD_RESET_CONTINUE_URL` | `https://[tu-dominio].vercel.app/login` |

---

## Resultado esperado global

| Escenario | Implementado | Verificado en demo |
|---|---|---|
| Login correcto | ✅ | ⬜ |
| Contraseña incorrecta | ✅ | ⬜ |
| Usuario inexistente (sin enumeración) | ✅ | ⬜ |
| Usuario deshabilitado | ✅ | ⬜ |
| Demasiados intentos | ✅ | ⬜ |
| Refresh de página con sesión | ✅ | ⬜ |
| Token expirado → logout automático | ✅ | ⬜ |
| Logout limpio | ✅ | ⬜ |
| Validación formulario cliente | ✅ | ⬜ |
| Recuperación de contraseña | ✅ | ⬜ |
| Sin 404 en rutas SPA | ✅ | ⬜ |
| Protección por roles | ✅ | ⬜ |
