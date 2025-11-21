## Objetivo
Traer los últimos cambios del remoto y publicar tus correcciones directamente en `main`, manteniendo el historial limpio y evitando conflictos.

## Plan
1) Preparar el estado local
- `git status` para ver cambios.
- `git stash push -u -m "backup/pre-sync"` para respaldar si hay cambios sin commitear.

2) Configurar remoto y rama principal
- Verificar remoto: `git remote -v` (si falta: `git remote add origin https://github.com/gabo4567/sistema-lotes.git`).
- Traer referencias: `git fetch origin --prune`.
- Cambiar a `main`: `git checkout -B main origin/main`.
- Actualizar `main`: `git pull --rebase origin main`.

3) Reaplicar y consolidar tus cambios
- `git stash pop` para recuperar cambios locales.
- Resolver conflictos si aparecen: editar archivos, `git add ...`, `git rebase --continue` (solo si aplica).

4) Commit directo a main
- `git add .`
- `git commit -m "Mobile: auth v9 + API_URL dinámico + lotes editar/eliminar + push notifications; Backend: endpoints lotes/productores + notificaciones; Web: router protegido y fallback"`

5) Seguridad (.gitignore)
- Confirmar que no se suben secretos:
  - `mobile-app/.env`
  - `backend/serviceAccountKey.json`
  - `**/.env`
- Si están trackeados: `git rm --cached <archivo>` y `git commit -m "chore: remove secrets from VCS"`.

6) Publicar en remoto (main)
- `git push origin main`.

7) Verificación post-publicación
- Backend: `npm run dev` en `backend` (http://localhost:3000/).
- Web: `npm run dev` en `web-app` (http://localhost:5173/).
- Mobile: `npx expo start --port 8082` en `mobile-app`.

¿Confirmás que ejecute este plan para sincronizar y subir todo directamente a `main`?