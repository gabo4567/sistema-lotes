## Objetivo
- Incluir `role` en el token de autenticación web y proteger rutas según rol (Administrador / Técnico / Supervisor). Actualizar contexto y guardas de navegación para respetar permisos.

## Cambios en Backend
- **Añadir rol al token de login web**
  - En `backend/src/controllers/auth.controller.js` ➜ `loginUser`:
    - Leer el documento del usuario en `users` por `uid`.
    - Obtener `role` (Administrador/Técnico/Supervisor) y `estado`.
    - Emitir un **JWT propio** con `role`, `uid`, `email` y expiración.
    - Alternativa: emitir `customToken` con claims y, adicionalmente, un JWT para la web (recomendado por simplicidad).
  - Añadir middleware `requireAuth` y `requireRole(roles)`:
    - Verificar el JWT (cabecera `Authorization: Bearer`), extraer `role` y validar.
    - Ubicación: `backend/src/middlewares/auth.js`.
  - Proteger rutas administrativas:
    - En `backend/src/server.js`, aplicar `requireRole(["Administrador"])` sobre rutas de gestión sensibles (usuarios, validaciones de lotes, cierre de temporada de turnos, informes avanzados).

## Cambios en Web Frontend
- **Contexto de Auth**
  - `web-app/src/contexts/AuthContext.jsx`:
    - Al hacer login, guardar `token` y **parsear JWT** para obtener `role`, `uid`, `email`.
    - Exponer `user` con `role` y un helper `hasRole(role)`.
- **Axios con token**
  - `web-app/src/api/axios.js` ya inserta `Authorization: Bearer ${token}`; mantenerlo.
- **Rutas protegidas por rol**
  - `web-app/src/components/ProtectedRoute.jsx`:
    - Aceptar `allowedRoles` como prop.
    - Si `!user` → redirigir a login.
    - Si `allowedRoles && !allowedRoles.includes(user.role)` → redirigir a 403 o mostrar componente de “Acceso denegado”.
- **Enrutador**
  - En el router principal, envolver páginas con `ProtectedRoute` y establecer `allowedRoles` según el Documento Oficial:
    - Usuarios: `Administrador`.
    - Productores (gestión web): `Administrador`, `Técnico`, `Supervisor`.
    - Validación de lotes: `Técnico`, `Supervisor`.
    - Informes: `Administrador`, `Supervisor`.
    - Cierre de temporada de turnos: `Administrador`.
- **UI/UX**
  - Página 403 simple para acceso denegado.
  - Mostrar el rol y nombre en el header.

## Verificación
- Crear usuario web con `role` en `users`.
- Hacer login y ver que `AuthContext` contiene `role`.
- Intentar acceder a rutas sin permiso y confirmar redirección/403.
- Acceder con rol correcto y confirmar operación.

## Entregables
- Backend: JWT de login con `role` y middlewares de autorización; protección de rutas sensibles.
- Web: Contexto con `role`, `ProtectedRoute` por roles y ajuste del router.

## Siguiente paso
- ¿Confirmás que implemente este módulo ahora? Tras finalizar y demostrarlo funcionando, avanzamos con “Productores (backend + web + mobile)”. 