## Objetivo
- Alinear el módulo de Turnos con el Documento Oficial: solicitud desde mobile, disponibilidad (Sí/No), historial del productor, y gestión en web con estados y temporada.

## Backend
- Endpoints a implementar/ajustar:
  - `POST /turnos`
    - Body: `{ ipt, fechaSolicitada, tipoTurno }`
    - Estado inicial: `Solicitado`, setea `temporada` vigente.
    - Validaciones: evitar duplicados por día (ya existe lógica), rango de fechas, productor válido.
  - `GET /turnos/productor/:ipt`
    - Lista de turnos del productor (historial), ordenados por `fechaSolicitada` desc.
  - `GET /turnos/disponibilidad`
    - Query: `?fechaSolicitada=YYYY-MM-DD&tipoTurno=<tipo>`
    - Respuesta: `{ disponible: true|false }` (reglas simples: ventana de capacidad por día y tipo; placeholder configurable para “Sí/No”).
  - `PATCH /turnos/:id/estado`
    - Body: `{ estado, motivo? }` con estados permitidos: `Solicitado|Aprobado|Cancelado|Vencido`.
  - Opcional: `GET /turnos?temporada=...&estado=...` para filtros en web.

## Web
- Servicio
  - `web-app/src/services/turnos.service.js`
    - Corregir base a `/turnos`:
      - `getTurnos()` → `GET /turnos`
      - `setEstadoTurno(id, estado)` → `PATCH /turnos/:id/estado`
      - `getTurnosPorProductor(ipt)` → `GET /turnos/productor/:ipt`
      - `getDisponibilidad(fecha, tipo)` → `GET /turnos/disponibilidad`
  - `web-app/src/pages/turnosList.jsx`
    - Mostrar listado con filtros por estado/temporada.
    - Acciones: aprobar, cancelar (según rol y reglas); mostrar fecha confirmación.
  - Roles
    - Mantener permisos: aprobación/cancelación disponibles para `Administrador|Técnico|Supervisor` según se decida; cierre de temporada sólo `Administrador`.

## Mobile
- `mobile-app/src/screens/TurnosScreen.js`
  - Formulario: `fechaSolicitada` (date picker), `tipoTurno` (select simple).
  - Botón “Ver disponibilidad” (muestra `Sí/No`).
  - Botón “Solicitar turno” → `POST /turnos`.
  - Sección “Mis turnos”: `GET /turnos/productor/:ipt` con estado y motivo.
  - UX: deshabilitar acciones mientras carga, manejo de errores amigable.

## Verificación
- Backend: probar endpoints en local; asegurar que duplicado por día se respeta y `PATCH /estado` aplica reglas.
- Web: validar que la página de turnos lista y permite acciones según rol.
- Mobile: solicitar turno desde dispositivo físico, consultar disponibilidad y ver historial.

## Entregables
- Código backend para endpoint de disponibilidad y listados por productor.
- Servicio y página de turnos en web apuntando a `/turnos` con acciones.
- Pantalla de Turnos en mobile con solicitud y historial.

## ¿Procedo?
- Si confirmás, implemento de inmediato los cambios en backend, web y mobile, y te muestro cómo validarlos paso a paso.