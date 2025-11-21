## Objetivo

* Completar Mediciones (backend + web + mobile) y Informes (backend + web) según el Documento Oficial.

## Mediciones (Backend)

* Endpoints

  * POST `/api/mediciones`

    * Body: `{ productor, lote, fecha, tipo, valorNumerico, tecnicoResponsable, evidenciaUrl?, observaciones? }`

    * Guarda en `mediciones` con `activo:true`.

  * GET `/api/mediciones` (filtros opcionales por `productor`, `lote`, `tipo`, `fecha` rango).

  * GET `/api/mediciones/:id`.

  * PUT `/api/mediciones/:id` (actualiza campos, incluido `evidenciaUrl`, `observaciones`).

  * DELETE `/api/mediciones/:id` (soft delete: `activo:false`).

* Cambios en `backend/src/controllers/mediciones.controller.js` y `routes` correspondientes.

## Mediciones (Web)

* Servicios `web-app/src/services/mediciones.service.js`

  * `createMedicion`, `getMediciones`, `updateMedicion`, `deleteMedicion`.

* Páginas

  * `web-app/src/pages/medicionesList.jsx` con filtros y listado.

  * `web-app/src/pages/medicionesForm.jsx` para alta/edición (carga de evidencia como URL; opcional integración con storage más adelante).

* Roles

  * Acceso para `Técnico` y `Administrador`; `Supervisor` consulta.

## Mediciones (Mobile)

* Pantalla `mobile-app/src/screens/MedicionesScreen.js`

  * Solo lectura: lista mediciones del productor con filtros por lote/tipo.

## Informes (Backend)

* Endpoints

  * POST `/api/informes/generar`

    * Body con `tipoInforme` + parámetros (`temporada`, `productor?`).

    * Responde `resultados` (JSON/tabla) y `fechaGeneracion`.

  * GET `/api/informes/export`

    * Query: `tipo`, `temporada`, `formato=pdf|xlsx`.

    * Genera PDF/Excel (PDF: `pdf-lib` simple; Excel: `SheetJS`) y devuelve archivo (stream o URL temporal).

  * POST `/api/informes/enviar`

    * Body: `{ tipo, temporada, formato, destinatarioEmail }`.

    * Genera y envía por email (usando `nodemailer`).

* Cambios en `backend/src/controllers/informes.controller.js` y `routes`.

## Informes (Web)

* Servicios `web-app/src/services/informes.service.js`

  * `generarInforme`, `exportarInforme`, `enviarInforme`.

* Páginas `web-app/src/pages/informes.jsx`

  * Selector de tipo/temporada/productor opcional.

  * Botones `Generar`, `Exportar PDF`, `Exportar Excel`, `Enviar email`.

  * Muestra tabla/JSON de resultados.

* Roles

  * Acceso para `Administrador` y `Supervisor`.

## Verificación

* Backend: probar CRUD mediciones; generación/exportación/envío de informes (mock SMTP si no hay credenciales reales).

* Web: alta/edición/listado mediciones; generar y exportar informes.

* Mobile: lista de mediciones por productor, lectura correcta.

## Entregables

* Endpoints y controladores ajustados.

* Servicios y páginas en web.

* Pantalla de lectura en mobile.

## Siguiente Paso

* ¿Confirmás que implemente estos módulos ahora para cerrar el ciclo y validar en tu entorno?

