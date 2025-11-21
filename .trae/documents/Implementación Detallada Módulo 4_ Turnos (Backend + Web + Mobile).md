## Backend
- Archivos: `backend/src/controllers/turnos.controller.js`, `backend/src/routes/turnos.routes.js`
- Endpoints:
  1) POST `/api/turnos`
     - Implementar `createTurno(req,res)` que reciba `{ ipt, fechaSolicitada, tipoTurno }` y cree turno con:
       - `estado: "Solicitado"`, `temporada: currentSeason`, `fechaCreacion: new Date()`
       - Validar duplicados por día (reusar lógica existente si ya está) y que `ipt` exista en `productores` activos.
  2) GET `/api/turnos/productor/:ipt`
     - `getTurnosByProductor(req,res)` lista turnos del productor ordenados por `fechaSolicitada` desc.
  3) GET `/api/turnos/disponibilidad`
     - `getDisponibilidad(req,res)` con `?fechaSolicitada=YYYY-MM-DD&tipoTurno=...` y retorna `{ disponible: true|false }` (regla simple: límite de N turnos por día por tipo; configurable).
  4) PATCH `/api/turnos/:id/estado`
     - Reusar/ajustar controlador existente para estados permitidos `Solicitado|Aprobado|Cancelado|Vencido`, aceptando `motivo` opcional.
- Rutas: añadir y exportar estos handlers en `turnos.routes.js`.

## Web
- Servicios: `web-app/src/services/turnos.service.js`
  - Corregir a base `/turnos`:
    - `getTurnos()` → `GET /turnos`
    - `setEstadoTurno(id, estado, motivo)` → `PATCH /turnos/:id/estado`
    - `getTurnosPorProductor(ipt)` → `GET /turnos/productor/:ipt`
    - `getDisponibilidad(fecha, tipo)` → `GET /turnos/disponibilidad?fechaSolicitada=...&tipoTurno=...`
- Página: `web-app/src/pages/turnosList.jsx`
  - Cargar listado con filtros por `estado`, `temporada`.
  - Acciones: Aprobar / Cancelar (según rol), mostrar fecha de confirmación si aplica.
  - Usar `ProtectedRoute` y roles ya configurados.

## Mobile
- Pantalla: `mobile-app/src/screens/TurnosScreen.js`
  - Formulario para solicitar turno:
    - Inputs: `fechaSolicitada` (DatePicker), `tipoTurno` (selector)
    - Botón “Ver disponibilidad” (consulta y muestra `Sí/No`)
    - Botón “Solicitar turno” (POST `/turnos`)
  - Historial:
    - Lista `GET /turnos/productor/:ipt` con `estado`, `motivo`, `fechaSolicitada`
  - Obtener `ipt` desde claims del token con `auth.currentUser.getIdTokenResult()`.

## Verificación
- Backend: probar creación, disponibilidad y cambio de estado.
- Web: verificar listado y acciones según rol.
- Mobile: solicitar turno y ver historial en dispositivo físico.

## Entregables
- Controladores y rutas en backend.
- Servicios y página de turnos en web.
- Pantalla de Turnos en mobile.

## Siguiente Paso
- Implemento los cambios ahora y te muestro evidencias de funcionamiento para cerrar el módulo. ¿Confirmás?