## Objetivo
Traer los últimos cambios del repositorio remoto, integrar sin conflictos con tus cambios locales y publicar una rama limpia con todas las correcciones (mobile, backend y web) para probar y revisar.

## Plan de Trabajo
### 1) Preparación y respaldo local
- Verificar que estás en la raíz del proyecto `sistema-lotes`.
- Respaldar cambios locales con una stash por si hay divergencias:
  - `git status`
  - `git stash push -u -m "backup/local-pre-sync"`

### 2) Configuración de Git y remoto
- Inicializar Git si aún no está:
  - `git init`
- Configurar remoto si falta (o verificarlo):
  - `git remote -v`
  - Si no existe, agregar: `git remote add origin https://github.com/gabo4567/sistema-lotes.git`

### 3) Traer cambios del remoto
- Obtener todas las ramas y el historial:
  - `git fetch origin --prune`
- Identificar la rama principal (asumimos `main`):
  - `git branch -r`
- Posicionarse en la rama principal y traer cambios con rebase:
  - `git checkout -B main origin/main`
  - `git pull --rebase origin main`

### 4) Reaplicar tus cambios locales
- Restaurar tu stash y resolver posibles conflictos:
  - `git stash pop`
- Revisar conflictos (si los hubiera):
  - `git status`
  - Editar archivos en conflicto, `git add <archivos>`, y continuar rebase si corresponde:
  - `git rebase --continue` (solo si el rebase quedó pendiente)

### 5) Crear una rama de trabajo para publicar
- Crear una rama descriptiva para tus cambios y mantener `main` limpio:
  - `git checkout -b feature/mobile-auth-notifications-lotes`
- Verificar archivos a incluir:
  - `git status`
  - `git add .`
  - `git commit -m "Mobile: auth v9, API_URL dinámico, lotes editar/eliminar, push notifications; Backend: endpoints lotes/productores y notificaciones; Web: router y rutas protegidas"`

### 6) Seguridad y .gitignore
- Asegurarte de NO subir secretos:
  - Agregar/confirmar `.gitignore` entradas:
    - `mobile-app/.env`
    - `backend/serviceAccountKey.json`
    - `**/.env`
  - Si estos archivos se han trackeado alguna vez: `git rm --cached <archivo>` y commitear la remoción.

### 7) Publicar al remoto
- Subir la rama:
  - `git push -u origin feature/mobile-auth-notifications-lotes`
- Crear Pull Request en GitHub desde esa rama hacia `main`.

### 8) Probar todo tras sincronización
- Backend: `cd backend && npm install && npm run dev` (http://localhost:3000/)
- Web: `cd web-app && npm install && npm run dev` (http://localhost:5173/)
- Mobile: `cd mobile-app && npm install && npx expo start --port 8082`
- Verificar:
  - Login mobile por IPT+contraseña
  - Lotes: selección, edición y eliminación (no “Validado”)
  - Validación lote desde web → llega notificación al móvil (push token registrado)
  - Rutas web: login en `/`, home en `/home`, secciones protegidas por rol

## Notas de compatibilidad
- Variables de entorno:
  - Mobile: `EXPO_PUBLIC_API_URL=http://<IP-PC>:3000/api` en `mobile-app/.env`
  - Web (opcional): `VITE_API_URL=http://localhost:3000/api`
- Si la rama principal del repo no es `main` sino `master`, usar ese nombre en los comandos de checkout/pull.

## Resultado esperado
- Rama `feature/mobile-auth-notifications-lotes` publicada con todas las correcciones.
- PR abierto listo para revisión y despliegue.

¿Confirmás ejecutar este plan para sincronizar y publicar los cambios en GitHub?