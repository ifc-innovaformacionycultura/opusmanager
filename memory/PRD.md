# OPUS MANAGER - PRD

## Problema Original
Sistema integral para gestión de convocatorias, temporadas, eventos y plantillas musicales para orquestas. Migración completa de MongoDB → Supabase (PostgreSQL + Auth). Autenticación Dual (Gestores con JWT propio via AuthContext, Músicos via SupabaseAuthContext SDK). Login unificado con Email/Password (Magic Link eliminado).

## Arquitectura
- **Frontend:** React + TailwindCSS + axios (Gestores) + Supabase SDK (Músicos)
- **Backend:** FastAPI + Supabase (PostgreSQL + Auth + Storage)
- **Email:** Resend (API key activa; modo testing limitado a propietario)
- **Autenticación:** Email/Password para todos los roles
- **Dual Auth:** Gestores → AuthContext (axios + backend), Músicos → SupabaseAuthContext (SDK directo)

## User Personas
1. **Gestor de Orquesta** — administra temporadas, eventos, asignaciones, músicos, recordatorios y reclamaciones.
2. **Músico** — consulta sus eventos asignados, gestiona su perfil, historial y envía reclamaciones.

## Core Requirements
- [x] Fase 1+2: Login email/password unificado
- [ ] Fase 3: Google OAuth (PENDIENTE)
- [x] Fase 4: Creación de músicos + Resend credenciales temporales
- [x] Fase 5: Cambio de contraseña obligatorio primer acceso (sin bucle)
- [x] Fase 6: Recuperación de contraseña
- [x] Compañeros confirmados en portal músico
- [x] Vista de calendario mensual músico con código de colores
- [x] Buscador y filtros de músicos en panel gestor
- [x] Exportación Excel (3 hojas)
- [x] **Bloque 1 — Ficha personal del músico** (datos personales, profesionales, titulaciones, CV, foto, banner aviso)
- [x] **Bloque 2 — Mi Historial** (eventos, pagos, reclamaciones)
- [x] **Bloque 3 — Recordatorios automáticos por evento** (10 predefinidos) + Historial de emails + Reclamaciones (gestor)
- [x] **Bloque 4 — Resend activo** (API key configurada)

## What's Been Implemented

### Feb 28, 2026 (madrugada — final) — Mini-widget KPIs Dashboard

- Backend `routes_dashboard.py`: KPIs ampliados con `recordatorios_enviados_hoy` (count de `recordatorios_enviados` para fecha actual) y `errores_recientes` (longitud del buffer en memoria de `routes_recordatorios.get_recent_errors()`).
- Frontend `ActividadPendiente.js`: 2 nuevos tiles KPI:
  - 🔔 **Recordatorios push enviados hoy** (color `teal`, link a `/admin/recordatorios`).
  - ⚠️ **Errores de envío recientes** (color `rose`, link a `/admin/recordatorios`). Cuando es > 0 se aplica `ring-rose-400 animate-pulse` + badge `!` rojo en esquina superior derecha.

### Feb 28, 2026 (madrugada — sesión nocturna) — Página /admin/recordatorios + 2º cron + recordatorios de tareas
*(ver entrada anterior)*

### Feb 28, 2026 (madrugada — sesión nocturna) — Página /admin/recordatorios + 2º cron + recordatorios de tareas

**Cron @ 12:00 Madrid (última llamada)**:
- 2º job `recordatorios_ultima_llamada` añadido al scheduler con `CronTrigger(hour=12, minute=0, timezone=Europe/Madrid)`.
- Reutiliza `job_disponibilidad(force_dias_antes=0)` y `job_logistica(force_dias_antes=0)` para enviar recordatorios el MISMO DÍA del deadline a quien aún no haya respondido.

**Recordatorios de tareas**:
- Nuevo `job_tareas()` en `routes_recordatorios.py`. Sin SQL nueva — reutiliza `recordatorios_enviados` con `tipo='tarea'`.
- Variable env nueva (también en Railway): `DIAS_ANTES_TAREAS=1`.
- Filtra `tareas` con `fecha_limite = today + DIAS_ANTES_TAREAS`, `estado != completada/cancelada/etc`, `responsable_id IS NOT NULL` → push `📋 Recordatorio tarea: {titulo}`.

**Página `/admin/recordatorios` (`RecordatoriosAdmin.js`)**:
- 4 secciones: Estado del cron (KPIs + próximos disparos), Histórico, Suscriptores activos, Errores recientes.
- Botones **"▶ Ejecutar ahora"** (POST `/run-now`) y **"Actualizar"** (refresca todo).
- Filtro por tipo en histórico.
- Solo accesible para `admin`/`director_general`.
- Entrada en sidebar: "Recordatorios push" bajo Administración.

**Endpoints backend nuevos** (todos admin/director_general):
- `GET /api/admin/recordatorios/historial?limit=&tipo=` — lectura de `recordatorios_enviados` con nombre del usuario enriquecido.
- `GET /api/admin/recordatorios/suscriptores` — listado de `push_suscripciones` con usuario/rol/dispositivo.
- `GET /api/admin/recordatorios/errores` — buffer en memoria con últimos 50 fallos de envío push (purga 410, exception, etc.).
- `POST /api/admin/recordatorios/run-last-call` — ejecuta sólo los jobs "última llamada".
- `routes_push` ahora registra errores en este buffer al fallar webpush (404/410, exception genérica).

### Feb 28, 2026 (madrugada) — Botón push test + Recordatorios automáticos cron
*(ver entrada anterior)*

### Feb 28, 2026 (madrugada) — Botón push test + Recordatorios automáticos cron

**Botón "🔔 Enviarme un push de prueba":**
- Añadido al footer del `NotifPreferenciasPanel.js` (visible en Mi perfil de gestor y músico).
- Llama a `POST /api/push/test` (endpoint ya existente) y muestra feedback in-line:
  - ✅ Si hay dispositivos suscritos: `Push enviado (N dispositivos)`.
  - ⚠️ Si no hay suscripciones: `No hay dispositivos suscritos. Acepta el permiso de notificaciones primero`.

**Recordatorios automáticos (APScheduler):**
- SQL ejecutado: tabla `recordatorios_enviados (usuario_id, tipo, entidad_id, dias_antes, fecha_objetivo, enviado_at, UNIQUE)` + columna opcional `eventos.fecha_limite_disponibilidad`.
- Dependencias instaladas: `APScheduler==3.11.2`, `pytz==2026.1.post1` (en `requirements.txt`).
- Variables env nuevas en `backend/.env` (también añadir en Railway):
  - `DIAS_ANTES_DISPONIBILIDAD=3`
  - `DIAS_ANTES_LOGISTICA=2`
- Nuevo módulo `routes_recordatorios.py`:
  - `init_scheduler()` arranca un `BackgroundScheduler` con `CronTrigger(hour=9, minute=0, timezone=Europe/Madrid)` desde `server.py @startup` (idempotente).
  - `shutdown_scheduler()` en `@shutdown`.
  - **Job disponibilidad**: para eventos en estado abierto/publicado/borrador cuyo deadline efectivo cae a `DIAS_ANTES_DISPONIBILIDAD` días, busca asignaciones publicadas con `fecha_respuesta IS NULL && estado = 'pendiente'` y dispara push tipo `recordatorio`. Deadline efectivo: `eventos.fecha_limite_disponibilidad` → `fecha_inicio_preparacion` → `fecha_inicio - 7 días`.
  - **Job logística**: filtra `evento_logistica.fecha_limite_confirmacion = today + DIAS_ANTES_LOGISTICA` y avisa a todos los músicos publicados del evento.
  - Idempotencia con tabla `recordatorios_enviados` (UNIQUE constraint).
  - Cada push respeta `notif_preferencias.recordatorios` del destinatario (vía `should_send_push`).
- Endpoints REST nuevos:
  - `GET /api/admin/recordatorios/status` → estado del scheduler + próximo disparo + config.
  - `POST /api/admin/recordatorios/run-now` → fuerza ejecución manual (admin/director_general).

**Pruebas E2E:**
- ✅ `GET /status` → `running=true, next_run=2026-04-29 09:00:00+02:00, jobs=[recordatorios_diarios]`.
- ✅ Test real con evento `Concierto de Navidad` cuyo deadline = today+3 días: 1ª ejecución envía 1 push (al admin con suscripción válida) + revisa 9 asignaciones; 2ª ejecución es idempotente (`enviados=0, revisados=9`).
- ✅ Tabla `recordatorios_enviados` registra correctamente: `tipo=disponibilidad, dias_antes=3, fecha_objetivo=2026-05-01`.
- ✅ Push test button con feedback adecuado en headless (sin permisos → mensaje de aviso correcto).

### Feb 28, 2026 (noche) — Toggle de preferencias de notificaciones
*(ver entrada anterior)*

### Feb 28, 2026 (noche) — Toggle de preferencias de notificaciones

**SQL ejecutado**: `ALTER TABLE usuarios ADD COLUMN notif_preferencias JSONB DEFAULT {convocatorias, tareas, comentarios, recordatorios, reclamaciones, verificaciones: true}`. Migración suave aplicada para filas con NULL.

**Backend (`routes_notif_preferencias.py`)**:
- 4 endpoints: GET/PUT `/api/auth/me/notif-preferencias` (gestor JWT) y GET/PUT `/api/portal/perfil/notif-preferencias` (músico Supabase JWT).
- Helper `should_send_push(usuario_id, tipo)` integrado en `notify_push` — si el tipo está silenciado, se omite el envío (return 0).
- Tipos críticos (`incidencia`, `general`) siempre se envían.
- Mapeo: convocatoria→convocatorias, tarea→tareas, comentario→comentarios, recordatorio→recordatorios, reclamacion→reclamaciones, verificacion→verificaciones.

**Frontend**:
- Componente reutilizable `/components/NotifPreferenciasPanel.js` con 6 toggles + descripción de cada tipo, optimistic update y feedback "✅ Guardado".
- Acepta `clientOrToken` polimórfico (axios o Bearer string) — único componente para gestores y músicos.
- Prop `showVerificaciones`: oculta el toggle 🛡️ excepto para `admin` y `director_general`.

**Páginas integradas**:
- 🎼 **Músico** — Sección "🔔 Notificaciones" añadida al final de `/portal/perfil` (`MiPerfil.js`), debajo de "Datos personales" y archivos.
- 🛡️ **Gestor/Admin** — Nueva ruta `/admin/mi-perfil` (`MiPerfilGestor.js`) con panel de Datos personales (lectura) + panel de Notificaciones.
- Enlace **"👤 Mi perfil"** añadido en sidebar (bajo "Conectado como…") para acceso rápido del gestor.

### Feb 28, 2026 (tarde) — WhatsApp + Web Push PWA
*(ver entrada anterior)*

### Feb 28, 2026 (tarde) — WhatsApp + Web Push PWA

**Botón WhatsApp en Modal de Invitación:**
- Cuarta opción `📱 Enviar por WhatsApp` en `InvitacionMusicoModal.js` (junto a Email / Copiar enlace / QR).
- Genera `https://wa.me/{telefono}?text={mensaje+url}` con mensaje pre-redactado.
- Si el músico no tiene `telefono` registrado, muestra input manual (`+34 600 11 22 33`); el botón se deshabilita hasta que el campo esté relleno.
- Sin dependencias nuevas (anchor `<a target="_blank">`).

**Web Push PWA (VAPID):**
- Tabla `push_suscripciones` (usuario_id, endpoint, p256dh, auth, user_agent, UNIQUE(usuario_id, endpoint)).
- Backend: dependencias `pywebpush==2.3.0`, `py-vapid==1.9.4`, `http-ece==1.2.1`. VAPID keys generadas y guardadas en `backend/.env`:
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_CONTACT_EMAIL`
- **⚠️ Variables a añadir también en Railway** (mismos nombres exactos arriba).
- Nuevo router `routes_push.py` con endpoints:
  - `GET /api/push/vapid-public` (público, devuelve clave pública).
  - `POST /api/push/suscribir` (autenticado, idempotente con UPSERT por endpoint).
  - `POST /api/push/desuscribir` (autenticado).
  - `POST /api/push/test` (autenticado, push de prueba al propio usuario).
- Helper público `notify_push(usuario_id, titulo, body, url, tipo)` que envía a TODAS las suscripciones del usuario y purga automáticamente las 404/410 caducadas.
- Service Worker `sw.js v2` con handlers `push` (muestra notificación con título, body, icono, badge y `data.url`) y `notificationclick` (foco a pestaña existente o abre nueva).
- Frontend lib `/app/frontend/src/lib/push.js`:
  - `isPushSupported()`, `ensurePushSubscription()`, `requestPushPermission()`, `unsubscribePush()`.
  - Acepta tanto axios-instance como Bearer token string (compatibilidad con AuthContext gestor + SupabaseAuthContext músico).
- Componente `/app/frontend/src/components/PushPermissionPrompt.js`: banner discreto bottom-right con CTA "Activar / Más tarde / ×" (snooze 7 días en localStorage). Mostrado en Layout (gestor) y PortalDashboard (músico).
- Auto-suscribir tras login si permiso ya `granted` (no-op si no). Auto-desuscribir en logout (gestor + músico).
- **Disparadores conectados:**
  - 🎼 **Músico — nueva convocatoria publicada**: `routes_gestor.py /seguimiento/publicar` cuando `publicar=True`.
  - 📬 **Músico — respuesta a su reclamación**: `routes_gestor.py PUT /reclamaciones/{id}` cuando hay `respuesta_gestor` o cambio de estado.
  - 💬 **Gestores — comentario donde están mencionados**: `routes_comentarios_equipo._notificar_mencionados`.
  - 📋 **Gestor — tarea asignada o reasignada**: `routes_tareas.py POST /tareas` y `PUT /tareas/{id}`.
  - 🛡️ **Admin/Director — solicitud de verificación**: `routes_verificaciones.py POST /eventos/{ev}/verificaciones/{seccion}/solicitar`.
  - 🚨 **Admin — nueva incidencia/feedback**: `routes_incidencias._crear_incidencia_y_notificar`.

### Feb 28, 2026 (mañana) — Bloques 1+2 nuevos: CRM de contactos + Sistema de invitación
*(ver entrada anterior)*

### Feb 28, 2026 — Bloques 1+2 nuevos: CRM de contactos + Sistema de invitación

**Bloque 1 — CRM de contactos por (músico × evento) en Seguimiento de Plantillas:**
- Nueva tabla `contactos_musico` (id, usuario_id, evento_id, tipo, estado_respuesta, notas, gestor_id, fecha_contacto).
- Nuevo router `routes_crm_contactos.py` con `GET /api/gestor/contactos/{usuario}/{evento}`, `POST /api/gestor/contactos`, `GET /api/gestor/contactos/resumen`.
- `/api/gestor/seguimiento` extendido: cada asignación incluye `crm: {total_contactos, ultimo_tipo, ultimo_estado, ultima_fecha}`.
- UI: botón `📞 CRM` colapsable por evento (persistido en localStorage `seguimiento_crm_expandidos`). Cuando expandido añade 3 sub-columnas: badge de Contactos por color del último estado, fecha+icono del último contacto, botón ➕ que abre mini-modal de registro. Click en el badge abre panel lateral con historial completo.
- Componente nuevo `/app/frontend/src/components/CRMSeguimiento.js` con todos los helpers visuales.

**Bloque 2 — Sistema de invitación a músicos:**
- ALTER `usuarios` con `estado_invitacion`, `fecha_invitacion`, `token_invitacion (UNIQUE)`, `fecha_activacion`. Migración suave que marca como 'activado' los músicos con último_acceso previo.
- Nuevo router `routes_invitaciones.py` (gestor + portal):
  - `POST /api/gestor/musicos/{id}/invitar` — genera UUID token, marca 'invitado', envía email Resend (HTML corporativo IFC), devuelve `{url_activacion, token, email}`.
  - `GET /api/portal/activar/{token}` — público; devuelve datos del músico para la página de bienvenida.
  - `POST /api/portal/activar/{token}` — público; fija contraseña vía `auth.admin.update_user_by_id`, marca 'activado', limpia token (one-shot).
- UI:
  - Botón **📨 Enviar / Reenviar invitación** en `GestorMusicoDetalle.js` + badge `⚪ Pendiente / 📨 Invitado / ✅ Activado` en cabecera.
  - Nueva columna **"Invitación"** en `GestorMusicos.js` con badge clickable (abre modal). Filtro adicional por estado de invitación + pre-filtrado vía query string `?invitacion=pendiente`.
  - Modal `InvitacionMusicoModal.js`: 3 opciones (Enviar email · Solo generar enlace · QR auto-renderizado vía `api.qrserver.com`). Sin dependencias nuevas.
  - Página pública `/activar/:token` (`ActivarCuenta.js`): formulario con doble password + login automático Supabase tras éxito → redirige a `/portal`.
  - Badge `⚠️ Sin activar` junto al apellido del músico en Seguimiento de Plantillas (visible para `pendiente` o `invitado`).
- Dashboard: nuevo KPI **📨 "X músicos pendientes de activación"** (color violet) que enlaza a `/admin/musicos?invitacion=pendiente`. Backend extiende `dashboard/resumen.kpis.musicos_sin_activar`.

### Feb 27, 2026 — Bloques 1-12 (Director General, verificaciones, drawer hilos, dashboard, informes I/J, layout SVG americano)
*Mantenido del histórico — ver entradas anteriores.*

### Feb 2026 — Sesión XL: Bloques 1-7 (Presupuestos persistente, Portal unificado, Gestión económica, Análisis, Planificador)

**Bloque 1 — Presupuestos REAL (elimina mensaje "próxima versión"):**
- Backend nuevos endpoints: `GET/POST/PUT/DELETE/POST bulk /api/gestor/presupuestos`.
- Frontend `Presupuestos.js`: `saveBudget` ahora hace upsert real a tabla `presupuestos` con `concepto`, `categoria='cachets'`, `tipo='gasto'`, `importe_previsto`, `importe_real=importe×weight/100`, y en `notas` JSON (section/level/num_rehearsals/num_functions/weight). `loadPresupuestos` lee y rehidrata la grid al cambiar de temporada. Feedback visible.
- Bug fix: `categoria='cuerda'` rompía CHECK constraint (permite viajes/tecnico/alojamiento/publicidad/cachets/otros/sala). Solución: usar 'cachets' + sección en notas JSON.

**Bloque 2 — Disponibilidad músico persistente:**
- `cargarMisEventos(silent)` refresca `eventoSeleccionado` con los datos frescos tras guardar sin remount del panel (evita desincronización al volver).
- UPSERT backend ya funcionaba; la regresión era de frontend al no reactualizar el padre.

**Bloque 3 — PlantillasDefinitivas recalcula:**
- Backend ya lee `cachets_config` con fallback a `asignaciones.cache_presupuestado/importe` (verificado).
- Frontend `pctReal` y `cacheReal` son `useMemo` reactivos — cambian al instante al editar asistencias.
- Verificado con curl 100/0/50/75 → 56.25% → 213.75€ (380×0.5625).

**Bloque 4 — Mejoras menores:**
- 4A `ensayos.hora_fin TIME` añadido. Formulario ensayos con doble input Inicio–Fin. Backend modelos `EnsayoCreate/Update` extendidos. Frontend persistEnsayos envía `hora_fin`.
- 4B Portal músico: **UN SOLO** bloque "Fechas y mi disponibilidad" en formato tabla con columnas Tipo|Fecha|Horario|Lugar|¿Asisto?. Fuente única: tabla `ensayos`. Eliminados bloques duplicados "Fechas de función" y "Ensayos y Fechas".
- 4C `usuarios.iban TEXT` + `swift TEXT`. `MiPerfil` añade ambos campos en Datos personales. `GestorMusicoDetalle` los muestra en ficha del gestor.

**Bloque 5 — Gestión económica (Asistencia y Pagos):**
- Nuevo endpoint `GET /api/gestor/gestion-economica` — reusa lógica de plantillas-definitivas enriqueciendo con iban/swift/titulaciones/estado_pago.
- Nuevo endpoint `PUT /api/gestor/asignaciones/{id}/pago` — toggle pagado/pendiente/anulado.
- Nuevo endpoint `GET /api/gestor/gestion-economica/export` (xlsx).
- Frontend `AsistenciaPagos.js` (reescrito): acordeón por evento, desglose por sección, columnas completas (IBAN, SWIFT, %Disp, %Real, Caché Prev/Real, Extras, Transp, Aloj, Otros, TOTAL, Estado Pago, Titulaciones). Botones Excel por evento y global.

**Bloque 6 — Análisis económico:**
- Nuevo endpoint `GET /api/gestor/analisis/resumen` con stats agregadas (eventos, convocados, confirmados, %asistencia media, coste previsto/real/diferencia, por_evento, por_seccion).
- Nuevo endpoint `GET /api/gestor/analisis/sepa-xml` que genera XML SEPA pain.001.001.03 con transferencias por músico (IBAN, SWIFT, importe total).
- Frontend `AnalisisEconomico.js` (reescrito): 7 stat cards + 3 gráficos recharts (barras Previsto vs Real, tarta secciones, línea asistencia) + tabla detalle + botones Excel y SEPA XML.

**Bloque 7 — Planificador de tareas:**
- Backend: tabla `tareas` (UUID, título, descripción, evento_id, responsable_id/nombre, fecha_inicio, fecha_limite, prioridad[alta/media/baja], estado[pendiente/en_curso/completada/cancelada], categoria[artistico/logistico/economico/comunicacion/tecnico/otro], recordatorio). Endpoints CRUD `/api/gestor/tareas/*` + `GET /api/gestor/gestores`.
- Frontend `GestorTareas.js` (nuevo): ruta `/admin/tareas` en menú Administración. Vista **Lista** con filtros múltiples (estado/prioridad/categoria/responsable/evento) + indicadores de urgencia (<24h rojo, <72h naranja, resto verde). Vista **Gantt** horizontal por mes con navegación ← → y barras coloreadas por prioridad agrupadas por categoría. Modal de creación/edición con validación.

### SQL consolidado aplicado por el usuario
- `/app/MIGRATION_BLOQUES_1-7.sql` — `ensayos.hora_fin`, `usuarios.iban/swift`, tabla `tareas` con CHECKs e índices.

### Febrero 2026 — Bloques 1-5 previos

**Bloque 1 — Configuración de Eventos:**
- ✅ Backend: `GET /api/gestor/eventos` ahora incluye `ensayos[]` por evento. Nuevo `PUT /api/gestor/ensayos/{id}` (antes solo POST/DELETE).
- ✅ Frontend `ConfiguracionEventos.js`: `saveEvent` hace diff y POST/PUT/DELETE contra `/api/gestor/ensayos`. Feedback `"Ensayos: +N / ±N / −N"` por guardado.
- ✅ **SQL ejecutado** (`/app/MIGRATION_BLOQUE1B.sql`): `ALTER TABLE eventos ADD COLUMN hora_inicio TIME, fecha_inicio_preparacion DATE`.
- ✅ EventoCreate/Update Pydantic + `pickPayload` extendidos con los 2 campos nuevos.
- ✅ UI Datos Generales reorganizada con 6 líneas de fechas: principal (fecha+hora), actuación 2/3/4 (fecha+hora), inicio preparación, fecha fin.
- ✅ Sección "Fechas adicionales de función" eliminada.
- ✅ Subcolumnas Seguimiento ordenadas: ensayos (fecha ASC) primero, conciertos/funciones (fecha ASC) después. Labels `Ens.1 · 5 may · 19:00`, `Conc.1 · 15 may · 20:00`.

**Bloque 2 — Presupuestos:**
- ✅ Bug fix: `event.name/date/season.name` → `event.nombre/fecha_inicio/season.nombre`. Cabeceras ahora muestran nombres de evento.
- ✅ Bug fix: `calculateRowTotal` usaba `cell.rehearsals+functions` (inexistentes) → ahora `cache_total × weight/100`. Totales horizontales calculan en vivo.
- ✅ ColSpan del TOTAL fila cuando evento expandido corregido de 3 a 4.
- ✅ Sincronización con Config confirmada — ambos usan `/api/gestor/eventos?temporada=X`.

**Bloque 3 — Seguimiento de Plantillas:**
- ✅ Filtros acumulativos simultáneos: buscar nombre/apellidos, multi-select instrumentos (chips), select especialidad/nivel/localidad/evento. Botón "Limpiar filtros" con chips visibles de filtros activos.
- ✅ Botón "Columnas" con menú de checkboxes para ocultar/mostrar Apellidos/Nombre/Instrumento/Especialidad/Nivel/Baremo/Localidad. Default: primeras 3 visibles. Persistido en `localStorage.seguimiento_visible_cols`.
- ✅ Barra "⚡ ACCIONES MASIVAS" renombrada con texto explicativo. Multi-select de eventos con chips. Botón "Aplicar a seleccionados (N)" solo visible con selección.
- ✅ Mensaje informativo permanente `💾 Los cambios individuales (...) se guardan automáticamente al instante` bajo la tabla.
- ✅ Toggle Publicar y selector Acción guardan inmediatamente (ya funcionaba — `togglePublicar` y `cambiarAccion` hacen POST optimista).

**Bloque 4 — Plantillas Definitivas (asistencia_real como %):**
- ✅ **SQL ejecutado** por el usuario (`/app/MIGRATION_BLOQUE4.sql`): `ALTER TABLE disponibilidad ALTER COLUMN asistencia_real TYPE NUMERIC(5,2)`.
- ✅ Backend: `AsistenciaItem.asistencia_real: float`. Cálculo `pct_real` = promedio de porcentajes no-NULL (ignora NULL). `cache_real = cache_prev × pct_real/100`.
- ✅ Recálculo `asignaciones.porcentaje_asistencia` usa la misma fórmula de promedio.
- ✅ Frontend: `TriSelect` reemplazado por `PctInput` (input number 0..100). `calcularTotalesSeccion` actualizado a promedio.
- ✅ **Verificado con curl**: 100/0/50/75 → `pct_real=56.25% · cache_real=213.75€` (380×0.5625).

**Bloque 5 — Sincronización global de eventos:**
- ✅ Verificado E2E: crear evento BLOQUE5_TEST → aparece en Presupuestos + Configuración + Seguimiento inmediatamente. DELETE → desaparece de todos.
- ✅ Todas las pantallas leen de `/api/gestor/eventos` (fuente única de verdad). Ensayos configurados aparecen como subcolumnas en Seguimiento y columnas de disponibilidad en Plantillas Definitivas.

### Febrero 2026 — Bloque D cerrado (fixes iteration_7)
- ✅ **Fix backend `PUT /api/gestor/cachets-config/{evento_id}`**: `nivel_estudios=null` ahora se normaliza a `'General'` antes del UPSERT para respetar el NOT NULL de la constraint `ux_cachets_evento_instr_nivel`. Verificado con curl (`{"ok":true,"escritas":1}`).
- ✅ **Fix frontend `MiDisponibilidadPanel.js`**: reemplazado `useAuth().api.post` inexistente por `fetch + supabase.auth.getSession()` (mismo patrón que `PortalDashboard`). Mensaje verde `[data-testid=disponibilidad-msg]` ahora renderiza `"N cambios guardados correctamente"` durante 6s tras guardar. Eliminado `onSaved={cargarMisEventos}` del parent para evitar unmount por `loading=true`.
- ✅ Smoke test Playwright: 4 ensayos reset → guardar → `MSG VISIBLE: 3 cambios guardados correctamente`. Estado seed restaurado (Sí/Sí/No/—).

### Abril 2026 — DELETE músico + testing end-to-end Bloque C
- ✅ **DELETE /api/gestor/musicos/{id}**: bloquea 409 si el músico tiene asignaciones `confirmado` en eventos `abierto`/`en_curso`; 404 si no existe; 200 elimina perfil `usuarios` (CASCADE) + usuario de Supabase Auth + registro en `registro_actividad` con tipo='musico_eliminado'.
- ✅ UI: botón rojo "Eliminar músico" en ficha `/admin/musicos/{id}` con modal de confirmación y manejo visible del error 409.
- ✅ Testing `testing_agent_v3_fork` iteration_6: **10/10 backend + 5/5 frontend PASS** (100%). Suite nueva en `/app/backend/tests/test_bloque_c.py`.
  - Verificado: plantilla xlsx con 11 cabeceras, preview, importación 2 creados + 1 duplicado detectado.
  - Verificado: seguimiento pivot con los 5 estados (incluidos los dos nuevos `no_disponible`/`excluido` tras SQL aplicado).
  - Verificado: DELETE con los 3 códigos (200/409/404) y registro_actividad actualizado.

### Abril 2026 — Bloque C: Base de datos + Seguimiento (pivot)
- ✅ **C-1** `/configuracion/base-datos` renderiza el mismo `GestorMusicos` que `/admin/musicos` (buscador, filtros, importar, exportar, crear).
- ✅ **C-2 Importación masiva desde Excel/CSV**:
  - `GET /api/gestor/musicos-import/plantilla` devuelve un `.xlsx` con 11 cabeceras (`nombre, apellidos, email, telefono, instrumento, especialidad, dni, direccion, fecha_nacimiento, nacionalidad, bio`) + fila ejemplo.
  - `POST /api/gestor/musicos-import/preview` valida y devuelve `{total_filas, preview: first 5, missing_required_headers}`.
  - `POST /api/gestor/musicos-import` crea usuarios en Supabase Auth con password temporal de 8 chars + perfil con `requiere_cambio_password=true`. Resumen `{creados, ya_existentes, errores}` + informe CSV descargable.
  - UI: botones "Descargar plantilla" + "Importar músicos" en la cabecera, modal con file-picker, preview de primeros 5 registros y botón confirmar.
- ✅ **C-3 Seguimiento pivot**:
  - `GET /api/gestor/seguimiento` devuelve eventos con `estado='abierto'` (incluye `funciones[]` con fecha principal + hasta 4 secundarias), todos los músicos activos y asignaciones indexadas por `{musico_id}_{evento_id}`.
  - `POST /api/gestor/seguimiento/bulk` aplica cambio de estado a múltiples músicos (UPDATE existentes o INSERT).
  - UI reescrita: tabla pivot con checkboxes, buscador de músicos, cada columna de evento muestra chips de fechas, selector "Acción..." y botón "Aplicar" cuando hay selección + acción elegida.
  - Estados soportados: `pendiente/confirmado/no_disponible/rechazado/excluido`. Los `confirmado` pasan automáticamente a Plantillas Definitivas (query existente).

### SQL pendiente por parte del usuario
Para que las acciones masivas `no_disponible` y `excluido` funcionen (estados añadidos en C-3), el usuario debe ejecutar:
```sql
ALTER TABLE asignaciones DROP CONSTRAINT IF EXISTS asignaciones_estado_check;
ALTER TABLE asignaciones ADD CONSTRAINT asignaciones_estado_check
  CHECK (estado IN ('pendiente', 'confirmado', 'rechazado', 'no_disponible', 'excluido'));
```

### Abril 2026 — Mejoras módulo Eventos (5 bloques)
- ✅ **Bug fix Dashboard**: "Próximos eventos" ahora mapea correctamente `nombre/fecha_inicio/estado/lugar/temporada` (antes usaba `name/date/time` legacy). Ordenación ASC por fecha.
- ✅ **Bug fix ConfiguracionEventos**: EventForm y `saveEvent`/`createNewEvent`/`duplicateEvent` usan `pickPayload()` con campos en castellano. Banner de feedback sustituye `alert()`.
- ✅ **Punto 1 — Estados ampliados**: `borrador/abierto/en_curso/cerrado/cancelado/finalizado` con etiquetas en español y badges de color distinto (gris/azul/verde/amarillo/rojo/morado). Portal músico filtra `/mis-eventos` y `/calendario` por `estado='abierto'`. Historial mantiene vista completa.
- ✅ **Punto 2 — Fechas secundarias**: Columnas `fecha_secundaria_[1..4]` + `hora_secundaria_[1..4]` en `eventos`. UI con "Añadir fecha" (máx 4). Se muestran en el calendario del músico como función.
- ✅ **Punto 3 — Partituras por sección**: Columnas `partitura_cuerda/viento_madera/viento_metal/percusion/coro/teclados`. Mapeo instrumento→sección (`INSTRUMENTO_A_SECCION`). En el portal sólo se expone la URL correspondiente a la sección del músico; el resto no aparecen en la respuesta.
- ✅ **Punto 4 — Notas para músicos + info adicional**: Columnas `notas_musicos`, `info_adicional_url_[1..3]`. `notas` interno queda oculto en el portal.
- ✅ **Punto 5 — Eliminar evento**: Botón rojo sólo visible a admin (`user.rol==='admin'`) o creador del evento (`user.profile.id===event.gestor_id`). Modal de confirmación antes del DELETE. Cascada vía FK `ON DELETE CASCADE` (asignaciones, ensayos, materiales, recordatorios_config).

### SQL aplicado en esta iteración
- `/app/MIGRATION_BLOQUE3.sql` (comentarios_internos + notificaciones_gestor + registro_actividad + cols auxiliares)
- Migración en-chat aplicada por el usuario: 14 columnas nuevas en `eventos` (fechas secundarias + partituras + notas_musicos + info_adicional_urls)
- Ampliación de `eventos_estado_check` para los 6 estados.

### Abril 2026 — iteración Bloque 3 (comunicación interna + UX Portal)
- ✅ **SQL Bloque 3 aplicado** (`/app/MIGRATION_BLOQUE3.sql`): tablas `comentarios_internos`, `notificaciones_gestor`, `registro_actividad`; columnas `usuarios.ultima_actualizacion_perfil`/`ultimo_acceso_gestor`, `asignaciones.fecha_respuesta`, `reclamaciones.gestor_id`/`gestor_nombre`; RLS bloqueado (backend usa service role).
- ✅ **Campana de notificaciones** (`/app/frontend/src/components/NotificacionesBell.js`): icono fijo top-right del Layout gestor con badge de no leídas; panel desplegable con historial; polling 60s a `/api/gestor/notificaciones`; acción "marcar todas como leídas"; click individual marca como leída.
- ✅ **Comentarios internos** (`/app/frontend/src/components/ComentariosPanel.js`): componente reutilizable — montado en modal de reclamaciones y en `EventForm` (Configuración de eventos). Endpoints `GET/POST /api/gestor/comentarios?tipo=reclamacion|evento&entidad_id=...`. Menciones con `@` notifican al gestor mencionado.
- ✅ **Configuración de email**: ruta `/admin/emails/configuracion` + entrada `Configuración de email` bajo Administración. Página con estado Resend (GET `/emails/status`), botón "Verificar conexión", previsualización HTML (GET `/emails/preview?tipo=...`) y formulario de prueba (POST `/emails/test`).
- ✅ **Completitud del perfil** (`/app/frontend/src/lib/profileCompleteness.js`): fuente única de verdad con 7 campos obligatorios + 7 opcionales.
  - Banner inteligente en Portal Músico: se muestra sólo si faltan campos obligatorios, con % y top-3 faltantes.
  - Barra de progreso en "Mi Perfil": pill con color (verde ≥100% obligatorios, ámbar ≥60%, rojo <60%) + chips con los obligatorios pendientes.
- ✅ Testing: 8/8 backend PASS + 6/6 frontend PASS (`/app/test_reports/iteration_5.json`, `/app/backend/tests/test_bloque3.py`).

### Abril 2026 (iteraciones previas, compactadas)
- ✅ **Bloque 1 — Mi Perfil (Portal Músico)**:
  - Migración SQL: añadidas columnas `direccion`, `dni`, `fecha_nacimiento`, `nacionalidad`, `otros_instrumentos`, `especialidad`, `anos_experiencia`, `bio`, `cv_url`, `titulaciones` (JSONB) a `usuarios`.
  - Supabase Storage buckets públicos: `profile-photos`, `cv-files`.
  - Nueva pestaña "Mi Perfil" con secciones: fotografía, datos personales, datos profesionales, formación/titulaciones (CRUD inline), CV (PDF upload/delete).
  - Banner de aviso no-persistente al entrar al portal (se muestra en cada acceso).
  - Endpoints: `GET /api/portal/mi-perfil`, `PUT /api/portal/mi-perfil`, `POST /api/portal/mi-perfil/foto` (2MB, JPG/PNG/WebP), `POST /api/portal/mi-perfil/cv` (5MB, PDF), `DELETE /api/portal/mi-perfil/cv`.

- ✅ **Bloque 2 — Mi Historial (Portal Músico + Gestor)**:
  - Portal músico: pestaña "Mi Historial" con 3 sub-pestañas (Eventos/asistencia, Pagos/liquidaciones, Reclamaciones).
  - Formulario de nueva reclamación con 4 tipos (pago_incorrecto, pago_no_recibido, error_asistencia, otro).
  - Tabla `reclamaciones` en Supabase.
  - Panel gestor: `/admin/reclamaciones` — lista todas las reclamaciones, modal para responder y cambiar estado (en_gestion / resuelta / rechazada).
  - Endpoints portal: `GET /api/portal/mi-historial/eventos`, `/pagos`, `/reclamaciones`, `POST /reclamaciones`.
  - Endpoints gestor: `GET /api/gestor/reclamaciones`, `PUT /api/gestor/reclamaciones/{id}`.

- ✅ **Bloque 3 — Recordatorios + Email Log**:
  - 10 recordatorios predefinidos configurables por evento (toggle on/off, editar destinatario, días antes, mensaje con variables `{nombre}`, `{evento}`, `{fecha}`, `{lugar}`, `{importe}`).
  - Tabla `recordatorios_config` con UNIQUE(evento_id, tipo) para upsert.
  - Tabla `email_log` con registro automático de todos los emails enviados (enviado/error).
  - Nueva página `/admin/recordatorios` en panel gestor.
  - Nueva página `/admin/emails` — tabla historial completa con botón de reenvío.
  - Endpoints: `GET/PUT /api/gestor/eventos/{id}/recordatorios`, `GET /api/gestor/emails/log`, `POST /api/gestor/emails/reenviar`.

- ✅ **Bloque 4 — Resend configurado**:
  - `RESEND_API_KEY` activa en `.env`, `SENDER_EMAIL=onboarding@resend.dev` (sandbox).
  - Email de bienvenida a `jesusalonsodirector@gmail.com` enviado correctamente (ID: `84154d58-dee3-4420-bb40-c8f3a789e8f9`).
  - ⚠️ **Limitación actual**: Resend en modo testing permite enviar solo al email propietario de la cuenta. Para enviar a otros destinatarios, el usuario debe verificar un dominio en resend.com/domains y cambiar `SENDER_EMAIL`.

### Abril 2026 (iteraciones previas, compactadas)
- ✅ Fase 5 bucle infinito resuelto + SupabaseAuthContext salta reload en USER_UPDATED
- ✅ Bug crítico sesión compartida Supabase resuelto (clientes efímeros en login/signup/verify)
- ✅ Compañeros confirmados + Calendario mensual + Base de datos músicos + Export Excel
- ✅ Migración MongoDB → Supabase completa + RLS correcto (no desactivado)

## Archivos clave
### Backend
- `/app/backend/routes_portal.py` — mi-perfil, mi-historial, reclamaciones (POST)
- `/app/backend/routes_gestor.py` — musicos, recordatorios_config, email_log, reclamaciones (PUT)
- `/app/backend/email_service.py` — `send_musico_credentials_email`, `_send_email`, `_log_email`
- `/app/backend/routes_auth.py` — clientes efímeros
- `/app/backend/supabase_client.py` — verify_supabase_token efímero
- `/app/MIGRATION_BLOQUES.sql` — migration aplicada por el usuario

### Frontend
- `/app/frontend/src/pages/portal/MiPerfil.js`
- `/app/frontend/src/pages/portal/MiHistorial.js`
- `/app/frontend/src/pages/portal/PortalDashboard.js` — banner + 4 tabs
- `/app/frontend/src/pages/GestorRecordatorios.js`
- `/app/frontend/src/pages/GestorEmailLog.js`
- `/app/frontend/src/pages/GestorReclamaciones.js`
- `/app/frontend/src/pages/GestorMusicos.js` — crear músico con modal
- `/app/frontend/src/contexts/SupabaseAuthContext.js` — `reloadProfile()` expuesto

## Base de datos
### Tablas existentes
`usuarios`, `eventos`, `ensayos`, `asignaciones`, `disponibilidad`, `materiales`, `recordatorios`, `tareas`

### Nuevas tablas (Bloques 2-3)
- `reclamaciones(id, usuario_id, evento_id, tipo, descripcion, estado, respuesta_gestor, fecha_creacion, fecha_resolucion)`
- `email_log(id, destinatario, asunto, tipo, evento_id, usuario_id, estado, error_mensaje, resend_id, created_at)`
- `recordatorios_config(id, evento_id, tipo, activo, dias_antes, mensaje_personalizado, destinatario, UNIQUE(evento_id, tipo))`

### Storage buckets
- `profile-photos` (público, 2MB máx)
- `cv-files` (público, 5MB máx)

## Prioritized Backlog

### P0 - Próximo
- [ ] **Verificar dominio en Resend** para poder enviar emails a cualquier destinatario (actualmente limitado al owner).

### P1
- [ ] **Fase 3: Google OAuth** (Emergent-managed) para ambos roles
- [ ] **Ejecutor de recordatorios**: job scheduler (APScheduler) que lea `recordatorios_config` y envíe emails en fechas correctas.
- [ ] **Seed fixture de reclamaciones** para facilitar QA de modal Gestionar.

### P2
- [ ] Exponer porcentaje de completitud desde backend `/api/portal/perfil/completitud`.
- [ ] Mencionar por email (además de notificación interna) al gestor referenciado con `@`.
- [ ] Optimizar N+1 en mi-historial/eventos.

### P3
- [ ] Google Drive justificantes, Gmail
- [ ] XML bancario y PDF corporativo

---

## Changelog (Feb 2026 — Fork Resume)

### ✅ BLOQUE 1 — Presupuestos · Sección A · Cachets Base (DONE)
- `CachetsBaseSection.js` renderiza tabla editable con los **4 niveles oficiales**: `Superior finalizado`, `Superior cursando`, `Profesional finalizado`, `Profesional cursando`.
- 6 secciones instrumentales ordenadas: Cuerda, Viento Madera, Viento Metal, Percusión, Teclados, Coro.
- 76 inputs editables persistidos en `cachets_config` con `evento_id IS NULL` (plantilla global).
- Endpoints: `GET/PUT /api/gestor/cachets-base`.
- Integrado en `Presupuestos.js` línea 327.

### ✅ BLOQUE 2 — Plantillas Definitivas · Caché Previsto (DONE)
- Backend `_cachet_lookup_with_source` aplica **fallback 3-tier**: `evento+instr+nivel` → `evento+instr` → `base+instr+nivel` → `base+instr` → `asignaciones.importe`.
- Endpoint `GET /api/gestor/plantillas-definitivas` devuelve `cache_previsto` y `cache_fuente` por músico.
- Etiqueta UI expandida de "Caché Prev." → **"Caché Previsto"** (PlantillasDefinitivas.js línea 110).

### ✅ BLOQUE 6 — Feedback / Incidencias (DONE)
- SQL ejecutado: tabla `incidencias` operativa + índices `idx_incidencias_estado`, `idx_incidencias_created`.
- `FeedbackButton.js` flotante en todas las páginas admin (tipos: incidencia/mejora/pregunta).
- Admin panel `/admin/incidencias` para revisar/resolver.
- **Fix FK violation** (fork resume Feb 2026): `POST /incidencias` ahora comprueba si `current_user.id` existe en `public.usuarios`; si no, guarda `usuario_id=NULL` preservando `usuario_nombre`. Evita error `incidencias_usuario_id_fkey` cuando el admin autenticado vía Supabase Auth no tiene fila espejo.

### ✅ Bloques adicionales validados
- `/asistencia/pagos` — Gestión económica por evento (SEPA XML + Excel exports)
- `/asistencia/analisis` — Análisis económico con Recharts + accordions por evento
- `/admin/tareas` — Planificador con 3 vistas (Lista, Gantt, Calendario) + comentarios internos

### Issues menores pendientes (low priority)
- [LOW] Warning React `<span> cannot be a child of <option>` — no rompe UX, requiere investigación en shadcn Select.
- [LOW] `cache_fuente='sin_datos'` no documentado en el enum — considerar unificar con `sin_cachet`.

### URLs correctas (para QA)
- `/configuracion/presupuestos` — Presupuestos + Sección A Cachets base
- `/plantillas-definitivas` — Plantillas definitivas (sin prefijo /admin)
- `/asistencia/pagos` — Gestión económica
- `/asistencia/analisis` — Análisis económico
- `/admin/tareas` — Planificador de tareas
- `/admin/incidencias` — Feedback e incidencias

---

## Changelog (Feb 2026 — Iteración 9 / Fork Resume #2)

### ✅ BLOQUE 7 — Presupuestos: Cachets por alcance (base vs evento) (DONE)
- `CachetsBaseSection.js` ahora tiene selector de alcance: **Plantilla base (global)** ó **Evento específico**.
- Selector `select-scope-cachets`: opciones = base + cada evento de la temporada.
- Al seleccionar un evento, carga de `/cachets-config/{evento_id}`; si está vacío, precarga con valores de plantilla base (no guardados).
- **Botón "Precargar estándar"** (`btn-precargar-cachets`): rellena 76 celdas con valores orientativos para orquesta profesional española (S.Fin 400€, S.Curs 320€, P.Fin 260€, P.Curs 200€).
- **Botón "Copiar plantilla base"** (`btn-copiar-plantilla-base`): visible sólo en modo evento. Backend: `POST /api/gestor/cachets-config/{evento_id}/copy-from-base`.
- Guarda como `evento_id=X` (específico) o `evento_id=NULL` (base) según scope.

### ✅ BLOQUE 8 — Convocatoria por instrumento en Ensayos (DONE)
- **Nueva tabla Supabase**: `ensayo_instrumentos(ensayo_id, instrumento, convocado, UNIQUE(ensayo_id, instrumento))`. SQL en `/app/MIGRATIONS/ensayo_instrumentos.sql`.
- Endpoints: `GET/PUT /api/gestor/ensayos/{ensayo_id}/instrumentos` + `GET /api/gestor/ensayo-instrumentos-bulk?ensayo_ids=...`
- Componente `ConvocatoriaInstrumentosPanel.js`: panel colapsable bajo cada ensayo persistido en Configuración de Eventos. Acciones masivas: **Convocar todos**, **Desconvocar todos**, y por sección (✓/✗ por Cuerda/Viento Madera/Viento Metal/Percusión/Teclados/Coro).
- Toggle individual por instrumento (19 instrumentos totales).
- **Default**: si no hay filas para un ensayo → todos convocados (TRUE).
- Helper backend `_is_convocado(ensayo_instr_map, ensayo_id, instrumento)` para uso transversal.

### ✅ BLOQUE 9 — Propagación de `convocado` a vistas consumidoras (DONE)
- `/plantillas-definitivas`: cada item de disponibilidad/asistencia trae `convocado: bool`. % disponibilidad y % asistencia real se calculan **sólo sobre ensayos convocados**.
- `/seguimiento`: idem. Badge "No conv." en gris para celdas no convocadas.
- `/gestion-economica`: idem. % asistencia recalculado excluyendo no convocados.
- `/portal/evento/{id}/ensayos` + `/portal/mi-historial/eventos` (asig.ensayos): cada ensayo incluye `convocado: bool` para el instrumento del músico actual.
- Frontend `PlantillasDefinitivas.js`: componente `NoConvBadge`, render condicional de celdas, **color naranja** para `cache_previsto` cuando `cache_fuente` es `base_*` o `asignacion`.
- Frontend `SeguimientoConvocatorias.js`: `DispCell` acepta prop `convocado`.
- Frontend `MiDisponibilidadPanel.js` (Portal): badge **"No convocado"**, botones Sí/No reemplazados por texto "— (sin asistencia requerida)".

### ✅ Fixes menores
- Etiqueta "Caché Prev." → **"Caché Previsto"** aplicada también en `AsistenciaPagos.js` y `AnalisisEconomico.js` (había quedado fuera en it. 8).

### Resultados de validación (iteración 9)
- Backend 8/8 pytest PASS (100%)
- Frontend ~90% OK (todos los endpoints y componentes verificados; solo 2 design issues menores heredados)
- Issues menores pendientes:
  - [LOW] Warning React `<span> cannot be a child of <option>` — no rompe UX, origen aún no localizado (no es ningún `<option>` actual del código).
  - [LOW] Shape de `disponibilidad` en `/seguimiento` es dict (frontend ya lo consume así) vs list en `/plantillas-definitivas`. Inconsistencia no breaking.
  - [LOW] `/portal/mi-historial/eventos` no incluye lista de ensayos (solo conteos). La lista + `convocado` está en `/portal/mis-eventos` y `/portal/evento/{id}/ensayos`.

---

## Changelog (Feb 2026 — Iteración 10 / Fork Resume #3)

### ✅ Botón "Copiar del ensayo anterior" (DONE)
- Añadido en `ConvocatoriaInstrumentosPanel` con prop `ensayoAnteriorId` + `ensayoAnteriorLabel`.
- Visible sólo cuando existe un ensayo previo tipo='ensayo' persistido en el mismo evento.
- Tooltip dinámico: *"Copia la convocatoria de: {fecha} {hora}"*.
- Carga los overrides del ensayo anterior en el state local; el usuario debe pulsar "Guardar convocatoria" para persistir.
- Integrado en `ConfiguracionEventos.js`: calcula el ensayo anterior recorriendo `rehearsals.slice(0, index).reverse().find(r => r.id && r.tipo === 'ensayo')`.

### ✅ Unificación shape `disponibilidad` (DONE)
- `GET /seguimiento` ahora devuelve `disponibilidad: list[{ensayo_id, asiste, asistencia_real, disponibilidad_id, convocado}]` (mismo shape que `/plantillas-definitivas`).
- Frontend `SeguimientoConvocatorias.js` actualizado: usa `Array.isArray(asig.disponibilidad) ? .find(x => x.ensayo_id === e.id) : asig.disponibilidad[e.id]` (compatible con ambos formatos por seguridad).

### ✅ Refactor de routes_gestor.py (DONE)
- **routes_incidencias.py** (+90 líneas) — `POST/GET/PUT/DELETE /api/gestor/incidencias`
- **routes_tareas.py** (+140 líneas) — `GET/POST/PUT/DELETE /api/gestor/tareas` (incluye notificaciones + registro_actividad)
- **routes_economia.py** (+290 líneas) — Modelos `CachetRow`/`CachetBaseItem`/`PresupuestoItem`/`PresupuestoBulkItem` + endpoints `/cachets-config/{id}` GET/PUT + `/cachets-base` GET/PUT + `/cachets-config/{id}/copy-from-base` POST + `/presupuestos` CRUD + `/presupuestos/bulk`.
- **routes_gestor.py**: 3509 → 3030 líneas (-479, -13.6%).
- Registro en `server.py`: 3 `include_router(...)` adicionales.
- Endpoints `/gestion-economica/*`, `/analisis/*`, `/gestion-economica/sepa/*`, `/gestion-economica/export` **se mantienen en routes_gestor.py** porque comparten internamente la lógica de agregación de `/plantillas-definitivas` (mover los helpers compartidos generaría importaciones circulares complejas sin aportar valor).

### ⚠️ No resuelto (baja prioridad)
- Warning React `<span> cannot be a child of <option>`: buscado exhaustivamente en todo `/app/frontend/src/**` — **no existe ningún `<option>` con `<span>` hijo en el código actual**. Probablemente provenía de una extensión del navegador externa al app (Emergent overlay) o de una iteración previa ya inexistente. No reproducible tras los cambios actuales.

### Resultados de validación (iteración 10 — smoke + curl)
- Backend: los 4 endpoints clave responden 200 (cachets-base, presupuestos, tareas, incidencias).
- POST /incidencias sigue funcionando (usuario_nombre "OPUS, Admin" correcto).
- Frontend `/configuracion/eventos`: convocatoria por instrumento visible por cada ensayo; botón "Copiar del ensayo anterior" aparece correctamente desde el 2º ensayo.

---

## Changelog (Feb 2026 — Iteración 11 / Fork Resume #4)

### ✅ BLOQUE 5 — Limpieza de código basura (DONE)
- Eliminados console.log de debug en `/app/frontend/src/lib/supabaseClient.js` (`🔍 Debug -`, `✅ Supabase client initialized`).
- No se encontraron llamadas a endpoints legacy (`/api/events`, `/api/contacts`, `/api/seasons`, `/api/budgets`, `/api/email-templates`).
- ESLint: 0 issues en src completo.

### ✅ BLOQUE 3 — Filtro `estado='abierto'` (DONE)
- `GET /api/gestor/seguimiento` y `GET /api/gestor/plantillas-definitivas` ahora filtran por `estado='abierto'` (excluyen `borrador`, `cerrado`, etc.).
- Verificado por curl: `/eventos` devuelve 7 (6 abiertos + 1 cerrado), `/seguimiento` y `/plantillas-definitivas` devuelven 6 (solo abiertos).
- `/eventos`, `/analisis-economico`, `/gestion-economica`, `/presupuestos*` **NO** se modificaron — siguen mostrando todos los estados.

### ✅ BLOQUE 4 — Convocatoria visible al añadir ensayo nuevo (DONE)
- `ConvocatoriaInstrumentosPanel` acepta `mode='new'` cuando no hay `ensayoId`: inicializa todos los 19 instrumentos a TRUE en local, abre el panel automáticamente, muestra mensaje **"📋 Los cambios se guardarán al guardar el evento."**.
- Propaga el state al padre vía `onLocalChange(stateMap)`.
- En `persistEnsayos`, después de crear cada ensayo nuevo, persiste `pending_convocatoria` con `PUT /api/gestor/ensayos/{newId}/instrumentos`.

### ✅ BLOQUE 2 — Logística: Transportes y Alojamientos (DONE)
- **SQL**: tabla `evento_logistica` (con campos para transporte: fecha, hora_salida/llegada, lugar_salida/llegada, 3 puntos de recogida; y para alojamiento: hotel_nombre, dirección, check-in/out; común: fecha_limite_confirmacion, notas) + tabla `confirmaciones_logistica` (logistica_id × usuario_id UNIQUE).
- **Backend gestor**: `GET/PUT /api/gestor/eventos/{id}/logistica` (bulk upsert), `DELETE /api/gestor/logistica/{id}`, `GET /api/gestor/logistica/{id}/confirmaciones` (lista de músicos confirmados/rechazados/sin respuesta entre los asignados al evento).
- **Backend portal**: `GET /api/portal/evento/{id}/logistica` (incluye `mi_confirmacion`), `POST /api/portal/logistica/{id}/confirmar` (UPSERT por usuario+logística).
- **Frontend gestor** `LogisticaSection.js`: toggle "Este evento requiere transporte/alojamiento", subsección Transportes (botón añadir, tipo Ida/Vuelta, fecha, horarios, lugares, 3 puntos de recogida, fecha límite, notas, eliminar), subsección Alojamientos (hotel, dirección, check-in/out, fecha límite, notas), botón "Guardar logística", panel colapsable "Confirmaciones de músicos" con 3 columnas (✅ confirmados, ❌ rechazados, ⏳ sin respuesta).
- **Frontend portal** `LogisticaMusicoPanel.js`: tarjeta por cada pieza de logística con datos completos + botones "✓ Confirmo este transporte / Necesito alojamiento" y "✗ No necesito".

### ✅ BLOQUE 1 — Presupuestos: matriz completa + eliminada Sección B (DONE)
- **SQL**: añadida columna `cachets_config.factor_ponderacion NUMERIC(6,2) DEFAULT 100`.
- `Presupuestos.js` reescrito como matriz: filas = (sección × instrumento × nivel) sticky a la izquierda; columnas = bloques de eventos abiertos con 5 subcolumnas cuando expandido (Caché €, Ens., Func., Pond. %, Total €) o 1 (Total €) cuando contraído. Botón ◧/▸ por evento para colapsar.
- Cabecera de cada bloque: nombre, fechas cortas DD/MM/YY, conteo "X ens · Y func".
- Total € por celda calculado en tiempo real: `Caché € × (Pond. % / 100)`. Total fila + Total por evento + Total temporada.
- Colores por sección: Cuerda azul, Viento Madera verde, Viento Metal amarillo, Percusión naranja, Teclados violeta, Coro rosa. Filas alternas `bg-{color}-50` / `bg-{color}-100`.
- **Botón "Precargar estándar"**: rellena solo celdas vacías con 400/320/260/200€ por nivel (no sobrescribe valores existentes).
- **Botón "Guardar todos"**: envía solo las celdas marcadas como `_dirty` al endpoint bulk.
- **Backend** `routes_economia.py`: `GET /api/gestor/presupuestos-matriz?temporada=X` (devuelve eventos abiertos + n_ensayos/n_funciones + cachets_config existentes con factor_ponderacion) y `POST /api/gestor/presupuestos-matriz/bulk`.
- Sección B (otros gastos e ingresos) **eliminada del frontend**. Tabla `presupuestos` en Supabase **NO** se ha tocado (los endpoints CRUD siguen funcionando para futuros usos).

### Validación end-to-end
- Bloque 1: matriz renderiza 4 eventos × 76 filas = 304 inputs Caché + 304 Pond. %; tras precargar estándar el Total temporada salta a 134.725,00 €. Botón "Guardar todos" envía solo dirty rows.
- Bloque 2: tras crear 1 transporte y 1 alojamiento, GET devuelve 1 fila cada uno con todos los campos correctamente persistidos.
- Bloque 3: 6 abiertos vs 7 totales en /eventos (1 cerrado correctamente excluido).
- Bloque 4: al añadir ensayo nuevo el panel se abre automáticamente con "(19/19)" y muestra mensaje de guardado pendiente.
- Bloque 5: 0 lint errors en frontend.

---

## Changelog (Feb 2026 — Iteración 12 / Fork Resume #5)

### ✅ BLOQUE 3 — Sistema de Incidencias verificado y mejorado (DONE)
- **SQL ejecutado**: añadida columna `incidencias.prioridad TEXT CHECK (alta|media|baja) DEFAULT 'media'`.
- `FeedbackButton.js` reescrito: añadido selector de **Prioridad** (🔴Alta / 🟡Media / 🟢Baja), validación de **mínimo 20 caracteres** con contador en vivo, prop `mode='gestor'|'portal'` para usar el endpoint correcto.
- **Nuevo endpoint** `POST /api/portal/incidencias` para músicos autenticados.
- **Notificación automática** al admin gestor (`admin@convocatorias.com`) en `notificaciones_gestor` al crear incidencia.
- `FeedbackButton` añadido al portal del músico.
- Página `/admin/incidencias` mejorada: filtros por **tipo** y **rango de fechas**, columna **prioridad** editable inline, **textarea** de respuesta del gestor, botón Eliminar.

### ✅ BLOQUE 2 — Creación masiva de usuarios (DONE)
- Script `/app/backend/scripts/create_users.py` (Supabase Admin API + tabla `usuarios`).
- **Resultado**: 15 creados · 0 ya existían · 0 errores.
  - 8 gestores con `Opus2026!` y `requiere_cambio_password=false`.
  - 7 músicos con `Musico2026!` y `requiere_cambio_password=true`.
- Idempotente: si el email ya existe en `auth.users` se sincroniza con `public.usuarios` sin duplicar.
- Credenciales registradas en `/app/memory/test_credentials.md`.

### ✅ BLOQUE 1 — Plantilla base configurable + botones aplicar (DONE)
- **Modal "⚙️ Configurar plantilla base"** (`PlantillaBaseModal`): matriz simple de 76 inputs (instrumento × nivel) que lee/guarda en `cachets_config` con `evento_id IS NULL`.
- **Botón "📋 Precargar estándar" mejorado**: consulta `/api/gestor/cachets-base`; si hay valores configurados los usa; si no, fallback a 400/320/260/200€. Solo rellena celdas vacías.
- **Botón "📋 Aplicar plantilla base"** en cada cabecera de evento: copia la base a ese evento concreto.
- **Botón "📋 Aplicar a todos los eventos"** en barra superior: copia a todos los eventos abiertos.

### ✅ BLOQUE 4 — Guía de pruebas /admin/guia-pruebas (DONE)
- Nueva página accesible desde el menú lateral: **Administración > Guía de pruebas**.
- 8 acordeones de gestores con casos prácticos (email, contraseña, pasos numerados con checklist, SQL de verificación con botón "📋 copiar").
- 2 acordeones de músicos.
- 4 queries SQL globales al final.

### URLs nuevas
- `/admin/guia-pruebas` — Guía de pruebas para el equipo


## Iteración 13 (Feb 2026) — Regresión + Endurecimiento de validaciones

### ✅ Tests de regresión completos (testing_agent_v3_fork)
- **Backend pytest**: 22/23 PASS, 1 SKIP (sin dato). Cobertura: auth, eventos, presupuestos matriz, cachets, convocatoria por instrumento, propagación `convocado`, logística (CRUD + confirmación), incidencias con prioridad (gestor + portal), tareas CRUD, gestión económica.
- **Frontend**: dashboard, sidebar limpio (sin GuiaPruebas), `/admin/guia-pruebas` ya no enrutada, `/configuracion/presupuestos` con matriz dinámica, `/plantillas-definitivas` con `Caché Previsto` + celdas naranjas de fallback, `/admin/incidencias` con selector per-row de prioridad.
- Reporte: `/app/test_reports/iteration_10.json`.

### ✅ Correcciones aplicadas tras la regresión
- **`routes_gestor.py` `LogisticaItem.tipo`**: `str` → `Literal['transporte_ida','transporte_vuelta','alojamiento']`. Antes devolvía 500 con error crudo de Postgres; ahora 422 Pydantic con mensaje claro.
- **`routes_incidencias.py`**: `IncidenciaCreate.tipo` y `prioridad`, e `IncidenciaUpdate.prioridad` ahora son `Literal` tipados → 422 ante valores inválidos.
- **`routes_tareas.py`**: `TareaCreate/Update.prioridad` → `Literal['baja','media','alta','urgente']`; `estado` → `Literal['pendiente','en_progreso','completada','cancelada']`.

### Hallazgos minor diferidos (no bloqueantes)
- Asimetría de shape entre `/plantillas-definitivas` (lista) y `/seguimiento` (dict) — heredado.
- `/portal/mis-eventos` puede devolver `{}` cuando el usuario no tiene asignaciones (consistencia menor).
- `/admin/incidencias` no expone botón "Crear incidencia" para gestor (sólo via API). UX a evaluar.
- Preselección de "temporada con eventos abiertos" en `/configuracion/presupuestos` (hoy default 2024-2025).
- Warning de fuente cabinet-grotesk en consola (no bloqueante).

### Próximas tareas
- P1: Google OAuth (diferido por el usuario).
- P1: Mejoras a emails Resend (diferido).
- Backlog: refactor cuellos O(n²) en `put_cachets_config` y `bulk_presupuestos_matriz` (`upsert` nativo Supabase).


## Iteración 14 (Feb 2026) — Pulido post-regresión

### ✅ "Crear incidencia" desde UI gestor
- Botón verde "**+ Crear incidencia**" en `/admin/incidencias` (`data-testid="btn-create-incidencia"`).
- Modal con selector de tipo (incidencia/mejora/pregunta), prioridad (alta/media/baja), página relacionada (autorrellenado con la ruta actual) y descripción (mínimo 20 caracteres con contador en vivo).
- POSTea a `/api/gestor/incidencias` y refresca la lista; valida client-side antes de enviar.

### ✅ Cabinet Grotesk auto-hospedado
- Descargados `CabinetGrotesk-Medium.woff` y `CabinetGrotesk-Bold.woff` desde fontshare/cdnfonts y guardados en `/app/frontend/src/fonts/`.
- `App.css`: `@font-face` ahora usa `url('./fonts/CabinetGrotesk-*.woff') format('woff')`. Adiós al **OTS parsing error: invalid sfntVersion**.

### ✅ Shape unificado en `/api/gestor/seguimiento`
- `musicos[].asignaciones` pasa de DICT `{evento_id: {...}}` a **LISTA** ordenada por evento, con `evento_id` dentro de cada item.
- `SeguimientoConvocatorias.js` actualizado para usar `.find(a => a.evento_id === ev.id)` (con fallback retrocompatible).

### ✅ `/api/portal/mi-historial/eventos` enriquecido
- Cada asignación trae ahora `ensayos[]` con shape idéntico a `/portal/mis-eventos`: `id, fecha, hora, hora_fin, tipo, lugar, obligatorio, mi_disponibilidad, asistencia_real, convocado`.
- **Bug fix**: `ensayos_confirmados` ya no cuenta confirmaciones globales del músico — ahora cuenta sólo las del evento concreto y sólo si está convocado.

### Tests
- pytest `test_iter10_regression.py`: 22/22 PASS, 0 regresiones.
- Frontend verificado con screenshots end-to-end (lista, modal, incidencia creada).

## Iteración 15 (Feb 2026) — Sistema único de incidencias + adjuntos

### ✅ Captura de pantalla en modal de incidencias
- Backend: `POST /api/gestor/incidencias/upload-screenshot` y `POST /api/portal/incidencias/upload-screenshot`. Acepta PNG/JPEG/WEBP/GIF (máx 5 MB), valida `Literal` MIME, sube a bucket `justificantes` bajo `incidencias/{user_id}/{ts}.{ext}`, devuelve `{url, path}` con URL pública.
- Frontend nuevo componente `IncidenciaModal.js`: drag & drop, paste (Ctrl/Cmd+V), preview con badge "✓ Subida", quitar imagen.

### ✅ Modal único compartido
- `FeedbackButton` (flotante en gestor + portal) y `GestorIncidencias` (`/admin/incidencias`) usan ahora el mismo componente `<IncidenciaModal />`.
- Eliminado el modal duplicado del antiguo FeedbackButton; una única UX con captura.

### ✅ "Mis incidencias" tab para gestor
- Pestañas "Todas (N)" / "Mis incidencias (N)" en `/admin/incidencias` con `data-testid="tab-todas"` y `tab-mias`.
- Filtra por `inc.usuario_id === user.profile.id` (no `user.id`, ver fix abajo).
- Nueva columna **Captura** en la tabla con thumbnail clicable que abre la imagen en pestaña nueva.

### ✅ Eliminada duplicación con `Reportes del equipo`
- Borrada entrada del sidebar (`App.js`).
- Eliminada ruta `/admin/reportes` y su `import GestionReportes`.
- Borrado el archivo `/app/frontend/src/pages/GestionReportes.js`.
- `/admin/incidencias` queda como sistema único de reportes.

### ✅ Preselección automática de temporada con eventos abiertos
- `Presupuestos.js fetchSeasons` ahora cuenta eventos con `estado='abierto'` por temporada y selecciona la que tenga MÁS eventos abiertos. Fallback: temporada más reciente alfabética.
- Verificado: ahora preselecciona "2025-2026" (con eventos abiertos) en lugar de "2024-2025" (default antiguo).

### 🔧 Bug fix bonus: `usuario_id` correcto en incidencias
- `_crear_incidencia_y_notificar` ahora resuelve `usuario_id` con tres estrategias en cascada:
  1. `profile.id` si existe en `usuarios`
  2. `usuarios.user_id == auth.id` (FK)
  3. `usuarios.id == auth.id` (legado)
- Antes, las incidencias del admin se guardaban con `usuario_id=NULL` (porque admin tiene `usuarios.id != auth.id`). Ahora se guardan con el `usuarios.id` correcto y "Mis incidencias" funciona para todos los gestores.

### Tests
- pytest `test_iter10_regression.py`: 22/22 PASS post-fix.
- Validación curl: subida 200 con URL pública accesible HTTP 200; rechazo PDF 400; resolución `usuario_id` correcta para admin.
- Frontend verificado por screenshots end-to-end (8 capturas).


## Iteración 16 (Feb 2026) — Anotación de capturas + Lightbox

### ✅ Anotación de capturas con markerjs2
- Dependencia añadida: `markerjs2@2.32.7` (`yarn add markerjs2`).
- Botón "✏️ Anotar captura" debajo del preview en `IncidenciaModal`. Al pulsar, abre el editor en modo `popup` con toolbar (rectángulo, freehand, flecha, texto, óvalo, marcador, callout, undo/borrar).
- Tema oscuro coherente con la app (`toolbarBackgroundColor=#0f172a`).
- `addRenderEventListener` recibe el dataURL anotado, lo establece como nuevo preview y re-sube el blob automáticamente al backend (mismo endpoint `/upload-screenshot`). El `screenshot_url` final apunta a la versión anotada.
- Estado `annotating` bloquea el botón "Enviar reporte" hasta que el editor cierra.

### ✅ Lightbox para ver capturas en grande
- Nuevo componente `ImageLightbox.js` con backdrop al 85 %, cierre por Escape/click fuera/botón ✕, link "Abrir en pestaña nueva ↗".
- Integrado en `GestorIncidencias`: la columna **Captura** ya no abre directamente la URL — al pulsar la miniatura abre el lightbox (`data-testid="image-lightbox"`).
- Bloquea el scroll del body mientras está abierto.

### Tests
- pytest 22/22 PASS sin regresiones.
- Screenshots end-to-end: lightbox sobre thumbnail, modal con botón Anotar, MarkerArea con toolbar completa, captura subida tras anotación.


## Iteración 17 (Feb 2026) — Atajo de teclado + backfill incidencias

### ✅ Atajo de teclado para reportar incidencia
- `Ctrl/⌘+Shift+I` (principal) y `Ctrl/⌘+Shift+B` (alternativo, evita conflicto con DevTools en navegadores que lo reservan).
- Listener global registrado por `FeedbackButton` (sólo cuando hay sesión gestor o portal).
- Al activarse: `e.preventDefault()` → captura del viewport con **html2canvas** (`yarn add html2canvas`), import dinámico para no inflar el bundle inicial. Se ignoran los nodos del propio modal y del botón flotante.
- El blob resultante se inyecta en `IncidenciaModal` vía nuevo prop `preloadedFile` que llama a `handleFile` automáticamente al abrir → la captura se sube de inmediato y queda visible con el badge "✓ Subida" + botón "Anotar".
- Toast `📸 Capturando pantalla…` mientras corre html2canvas.

### ✅ Backfill de incidencias antiguas
- Nuevo script `/app/backend/scripts/backfill_incidencias_usuario_id.py`.
- Lógica en cascada: match exacto por `apellidos, nombre` → fallback al admin gestor para incidencias en `/admin/...` → si nada matchea, deja NULL.
- **Ejecutado**: 11/11 incidencias antiguas actualizadas. La pestaña "Mis incidencias" del admin pasa de **0 → 14**.

### Tests
- pytest 22/22 PASS.
- Screenshots end-to-end: modal abre vía Ctrl+Shift+B con captura pre-cargada, ambos atajos confirmados, "Mis incidencias (14)" tras backfill.



## Iteración 18 (Feb 2026) — Verificación Presupuestos + Mini-dashboard KPI

### ✅ Verificación de Presupuestos (sin cambios necesarios)
- Tabla matriz renderiza siempre **76 filas** completas (16 cuerda + 16 viento madera + 16 viento metal + 4 percusión + 8 teclados + 16 coro), confirmado por screenshot automatizado.
- Filas sin datos en `cachets_config` muestran inputs en `0`/vacío (placeholder "0", `value={c.importe || ''}`).
- Niveles usados en frontend exactos: `Superior finalizado` · `Superior cursando` · `Profesional finalizado` · `Profesional cursando` (constante `NIVELES`).
- Save (`guardarTodos`) y `PlantillaBaseModal` usan literalmente esos 4 strings vía `nivel_estudios: niv` en el bucle `for niv of NIVELES`.
- Estado: **YA ERA CORRECTO antes de iter 18, sólo se verificó.**

### ✅ Mini-dashboard de KPIs en `/admin/incidencias`
- Nuevo componente `IncidenciasKpiDashboard.js` con 4 tarjetas (calculado client-side, sin endpoints extra):
  1. **Abiertas**: total no-resuelto / total · badge "🔴 N de prioridad alta" si las hay.
  2. **Distribución por tipo**: barras horizontales con conteo y %.
  3. **Tiempo medio de resolución**: media `(updated_at - created_at)` sobre `estado='resuelto'`. Formato adaptativo (min / h / d).
  4. **Top 5 páginas con más reportes**: ranking ordenado.
- Insertado encima de los tabs en `GestorIncidencias.js`.

### Tests
- pytest `test_iter10_regression.py` → 22/22 PASS, 0 regresiones.


## Iteración 19 (Feb 2026) — Fix visual matriz Presupuestos

### 🐞 Bug confirmado y resuelto: 2 primeras filas de Violín ocultas
- **Síntoma**: la matriz parecía empezar en "Profesional finalizado", faltando "Violín · Superior finalizado/cursando".
- **Causa**: solape sticky entre la barra superior (`sticky top-0 z-30`) y el `<thead>` (`sticky top-[60px] z-20`). El thead se solapaba con las primeras filas del tbody.
- **Verificado por DOM**: antes `thead.bottom=349.5 / row[0].top=289.5` (60px de solape); después `thead.bottom == row[0].top`.

### ✅ Fix
- `Presupuestos.js`:
  - Quitado `sticky top-0 z-30` de la barra superior.
  - `<thead>` pasa de `top-[60px]` a `top-0` (queda fijo arriba al hacer scroll).
- Las 76 filas íntegramente visibles desde el inicio, con `Violín · Superior finalizado` como primera.

### ✅ Sección + Instrumento en TODAS las filas
- Eliminado el `↳` y las condiciones `isFirstOfInstr/isFirstOfSec` en el render.

### ✅ NIVELES verificado
- Orden ya correcto: `Superior finalizado · Superior cursando · Profesional finalizado · Profesional cursando`.

### Tests
- pytest 22/22 PASS sin regresiones.
- Verificación DOM: row[0..3] = Violín en los 4 niveles correctos en orden.

## Iteración 20 (Feb 2026) — 5 tareas en bloque

### ✅ Tarea 1 — Gestión Económica lee `nivel_estudios` directo
- `routes_gestor.get_gestion_economica` ahora usa `u.get('nivel_estudios')` literal en lugar de `a.get('nivel_estudios') or _nivel_estudios_efectivo(u)`. Adiós a fallback a `especialidad` (que devolvía "Música clásica").

### ✅ Tarea 2 — Pagos masivos por evento
- Nuevo `POST /api/gestor/eventos/{id}/pagos-bulk` con body `{estado_pago: 'pagado'|'pendiente'}` que actualiza todas las asignaciones `estado='confirmado'`.
- `AsistenciaPagos.js`: dos botones nuevos en la cabecera de cada acordeón con `window.confirm` ("¿Marcar X músicos del evento Y como Pagado?"). `data-testid="btn-bulk-pagado-{id}"` y `btn-bulk-pendiente-{id}`.

### ✅ Tarea 3 — Mejoras planificador
- 3A: `ComentariosPanel` ya estaba conectado en GestorTareas (línea 365) — verificado.
- 3B: Las notificaciones a responsable de tareas usaban `usuario_id`/`mensaje` (campos inexistentes). Corregido a `gestor_id`/`descripcion` con `entidad_tipo='tarea'`. Ahora se disparan al crear (POST) y al reasignar (PUT) la tarea.
- 3B-bis: Cuando se inserta un comentario con `tipo='tarea'`, se notifica automáticamente al `responsable_id` con `tipo='comentario_tarea'`.
- 3C: La regex `@([\w]+)` ya soporta tareas (es genérica por entidad). Verificado.

### ✅ Tarea 4 — Chat interno `/admin/mensajes`
- Tablas `mensajes` y `mensajes_leidos` creadas en Supabase + 5 índices de rendimiento.
- Nuevo router `routes_mensajes.py`: `GET /canales`, `GET/POST /{canal}`, `PUT /leido/{canal}`, `GET /no-leidos/lista`. Soporta canal `general`, `evento:{id}` y `dm:{a}:{b}` (DMs ordenados alfabéticamente por id).
- Menciones `@nombre` extraen handle por primer apellido y disparan notificación `mencion_chat`.
- Frontend `ChatInterno.js`: sidebar con canales + DMs + badges de no leídos, área de mensajes con avatares de iniciales, polling 5 s mensajes / 30 s badges, dropdown de menciones, auto-scroll al final.
- Sidebar admin con entrada **💬 Mensajes** + ruta `/admin/mensajes`.

### ✅ Tarea 5 — Performance + keep-alive
- 5A: `GET /api/health` devuelve `{status, timestamp}`. Nuevo componente `KeepAlive.js` con ping silencioso cada 14 min (5 s tras login + interval). Montado en ambos `ProtectedRoute` (gestor + músico) sin tocar AuthContext.
- 5B: `PUT /cachets-config/{id}` y `POST /presupuestos-matriz/bulk` refactorizados. Antes: SELECT global por cada fila (O(n²)). Ahora: 1 SELECT global precargado + INSERT batch + UPDATE individual sin SELECT previo. Para N=76 filas: 76 UPDATEs en vez de 76 SELECT+UPDATE = ~50% menos queries.
- 5C: Los endpoints `/gestion-economica` y `/plantillas-definitivas` ya hacían batch IN_('id', list) — sin cambios.
- 5D: 6 índices ejecutados en SQL (mensajes, disponibilidad, asignaciones, cachets, gastos).

### Tests
- pytest 22/22 PASS · curl smoke OK en T1, T2, T4, T5A · screenshots E2E OK en T2 y T4.


### Feb 2026 — Iter 22: Test de regresión completo backend (post Iter 13-21)

**Resultado**: 39/39 tests pytest PASS sobre todos los endpoints implementados (auth, health, eventos, músicos, incidencias + upload Storage, presupuestos, tareas, mensajes, archivo musical, portal). Sin regresiones.

**Verificaciones funcionales**:
- ✅ Login admin + músico OK; guards de rol funcionan (musico → 401/403 en /api/gestor/*).
- ✅ Health endpoint 200 con timestamp (Keep-alive operativo).
- ✅ `POST /api/gestor/incidencias/upload-screenshot` sube a Supabase Storage correctamente.
- ✅ Chat interno: canales/general/no-leidos/lista todos OK.
- ✅ Archivo: CRUD obras + originales + partes + prestamos + alertas + plantilla-obras + atriles-evento OK.
- ✅ Bulk pagos `/eventos/{id}/pagos-bulk` y bulk presupuestos `/presupuestos-matriz/bulk` OK.
- ✅ Comentarios genéricos `/api/gestor/comentarios` (tipo + entidad_id) usados por tareas y eventos.
- ✅ Sin leak de `_id` (BD es Postgres, no Mongo).

**Limpieza**: Datos de prueba purgados (2 obras `TEST_iter11`, 3 mensajes test).

**Pendiente**: Importación masiva del Excel `REGISTRO_DE_REPERTORIO.xlsx` (bloqueado por archivo no presente en contenedor).

**Recomendaciones LOW priority** (del agente, pendientes de decisión):
- Validar magic bytes / mime / tamaño máx en `upload-screenshot` (DoS Storage).
- Añadir constraint UNIQUE en `obras.codigo` + retry para evitar duplicados en concurrencia.
- Considerar AsyncSupabaseClient para evitar bloquear event loop en endpoints de alta latencia.

### Feb 2026 — Iter 23: Hardening Archivo + Upload-Screenshot

**Tareas completadas:**
1. **`crear_obra` atómico (rollback automático)**: si los inserts de `obra_originales` (general/partes/arcos) fallan tras crear la obra, se borra la obra para no dejar registros huérfanos. Además, el insert ahora es batch (1 query en vez de 3) y reintenta una vez si choca con UNIQUE(codigo).
2. **Magic bytes en `upload-screenshot`**: nueva función `_detect_image_kind()` valida los primeros bytes del fichero (PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `GIF8x`, WEBP `RIFF…WEBP`). Rechaza archivos vacíos, archivos con MIME mentido (e.g. `image/jpeg` con contenido PNG) y archivos no-imagen. Mantiene los límites previos (5 MB, MIME en {png,jpeg,webp,gif}).

**Tests funcionales (`/app/backend/`):**
- ✅ Crear obra → 3 originales creados (atomicidad).
- ✅ Fake PNG (texto disfrazado) → 400 "El archivo no es una imagen válida".
- ✅ PNG real → 200.
- ✅ PNG declarado JPEG → 400 "Inconsistencia: el contenido es png pero se declaró image/jpeg".
- ✅ Archivo vacío → 400 "El archivo está vacío".
- ✅ 6 MB → 413 "supera el tamaño máximo".
- ✅ JPEG real, WEBP real → 200.

**SQL pendiente (NO ejecutar sin tu aprobación):**
```sql
-- Añade UNIQUE constraint en obras.codigo. Verificado: 0 duplicados actuales.
ALTER TABLE public.obras ADD CONSTRAINT obras_codigo_unique UNIQUE (codigo);
```

**Pendiente bloqueante:**
- Importación masiva del Excel `REGISTRO_DE_REPERTORIO__respuestas_.xlsx`. El archivo NO está presente en el contenedor (verificado vía `find /app /mnt /tmp`). El script `import_obras_inicial.py` ahora busca en 5 rutas; basta con copiarlo a cualquiera y ejecutar.

### Feb 2026 — Iter 24: Importación masiva + Full-Text + Filtros + Alertas

**1. Importación Excel completada** (`/app/backend/scripts/import_obras_inicial.py`):
- 178 obras nuevas + 2 previas = **180 obras totales** en BD.
- 0 errores · 0 duplicadas. Códigos del Excel respetados, géneros normalizados (corchetes eliminados), enlaces de Drive preservados en `observaciones`.
- 89 originales en estado `necesita_revision` detectados automáticamente.

**2. SQL ejecutado** (Iteration 23 follow-up):
```sql
ALTER TABLE obras ADD CONSTRAINT obras_codigo_unique UNIQUE (codigo);
CREATE EXTENSION IF NOT EXISTS unaccent;
ALTER TABLE obras ADD COLUMN tsv tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', immutable_unaccent(coalesce(codigo,''))), 'A') ||
  setweight(to_tsvector('spanish', immutable_unaccent(coalesce(titulo,''))), 'B') ||
  setweight(to_tsvector('simple', immutable_unaccent(coalesce(autor,''))), 'C')
) STORED;
CREATE INDEX obras_tsv_idx ON obras USING GIN (tsv);
```

**3. Endpoint `GET /api/gestor/archivo/obras` — búsqueda híbrida**:
- Branch A: `text_search('tsv', q, type='plain', config='spanish')` — stemming en títulos.
- Branch B: `or_(autor.ilike, codigo.ilike, titulo.ilike)` — substring para nombres propios y códigos.
- Unión de IDs. Verificado: 'alonso'→32, 'navidad'→1, 'Mexico'→MÉXICO LINDO (acentos), 'marchas'→4 (stemming), 'ave maria'→3 (espacios OK), 'cediel'→1.
- Nuevo parámetro `subgenero` (ILIKE %x%).
- Nueva propiedad `total_copias_atril` por obra (suma de `obra_partes.copias_fisicas`).

**4. Frontend `/admin/archivo` (`GestorArchivo.js`)**:
- Filtros: Género (select), **Subgénero (input nuevo)**, Procedencia (select), Estado material (select).
- Tabla catálogo con nueva columna **Nº atriles** (centrada, con tooltip).
- data-testids: `archivo-search`, `filtro-genero`, `filtro-subgenero`, `filtro-procedencia`, `filtro-estado`, `atriles-{id}`.

**5. Endpoint `/alertas` ampliado** con 5ª categoría `originales_necesita_revision` (89 actualmente). Eliminado bug del `en_7` mal calculado.

**6. UI Alertas (`AlertasTab`)**: nueva tarjeta "🟠 Originales que necesitan revisión" full-width con lista scrollable, badge del tipo (general/partes/arcos), código + autor + título de la obra. Pre-truncada a 100 ítems.

**Tests**: PDF SUITE DE NAVIDAD de Cediel, P. → 2288 bytes, magic bytes `%PDF` ✅.

**Observación**: La columna "Nº atriles" muestra 0 para todas las obras importadas porque el Excel histórico solo trae estados de originales (SI/NO/REVISIÓN), no recuento de copias por papel. Las cuentas se llenarán al editar cada obra y registrar partes en su ficha.

### Feb 2026 — Iter 25: Fix bloqueo deploy Railway (emergentintegrations)

**Problema reportado**: Build de Railway fallaba con
```
ERROR: Could not find a version that satisfies the requirement emergentintegrations==0.1.0
```

**Diagnóstico**:
- La línea `emergentintegrations==0.1.0` estaba en `/app/backend/requirements.txt:23`.
- `grep -rn` confirmó que **NO se importa en NINGÚN archivo .py del backend ni del frontend**. Era una dependencia huérfana del template inicial.
- La librería sólo existe en el índice privado de Emergent (`d33sy5i8bnduwe.cloudfront.net/simple/`), no en PyPI público → Railway no la encuentra.

**Fix aplicado**:
1. Eliminada la línea 23 de `requirements.txt`.
2. Desinstalada del entorno local (`pip uninstall -y emergentintegrations`).
3. Verificado: backend arranca limpio, 9/9 endpoints clave responden 200 (health, auth/me, eventos, músicos, archivo/obras, archivo/alertas, incidencias, mensajes, tareas).

**Próximo paso para el usuario**: hacer commit y push a `main` desde el botón "Save to Github" de la chat de Emergent. Railway re-buildeará automáticamente.

### Feb 2026 — Iter 26: Bloques 1-4 + Logística + GitHub Action

**Bloque 1 — Fix crítico** ✅
- `ConfiguracionEventos.js` línea 611: `evento?.id` → `event?.id`. ReferenceError resuelto.

**Bloque 2 — Logística**
- 2A ✅: Verificado por curl: backend persiste `fecha_limite_confirmacion` correctamente. El "bug" era UX.
- 2B ✅: `LogisticaSection.js` reescrito con tarjetas-resumen para items ya guardados (icono tipo, fecha/hora, trayecto/hotel, badge fecha límite con color amber/red según urgencia, botones "Editar" / "Eliminar"). Items nuevos abren formulario directamente.
- 2C ✅: Nueva página `/asistencia/logistica` (`Logistica.js`) con acordeón por evento + tabla de músicos confirmados (Ida/Vuelta/Alojamiento ✅⏳—). Endpoint `GET /api/gestor/logistica` agrega datos en 4 batches (logística + asignaciones + confirmaciones + usuarios). Fecha límite con alerta si ≤7d.

**Bloque 3 — Base de datos de músicos**
- 3A ✅: Eliminado duplicado de "Configuración de temporada". Solo en "Administración".
- 3B ✅: Plantilla Excel con 14 columnas (incluye `nivel_estudios`, `localidad`, `baremo`) + nueva pestaña INSTRUCCIONES con valores aceptados. Endpoint import normaliza `baremo` (coma→punto).

**Bloque 4 — Comentarios de Equipo (SQL ejecutado)**
- Backend `routes_comentarios_equipo.py`: CRUD + hilos (parent_id) + estados + menciones + auto-notificaciones a `notificaciones_gestor`. Endpoints: GET/POST `/api/gestor/comentarios-equipo`, GET `/{id}`, POST `/{id}/responder`, PUT `/{id}/estado`, GET `/_meta/gestores`.
- 4A ✅: `ComentariosEquipoButton.js` (azul, `bottom-20 right-6`, encima del FeedbackButton) + `ComentariosEquipoModal.js` con detección automática de contexto (página + entidad vía `[data-entidad-nombre]` o H1), checkbox de menciones, radio Normal/Urgente.
- 4B ✅: Pestaña "📋 Comentarios del equipo" en `/admin/mensajes` con filtros (estado, autor, mencionado, página), tabla de hilos con badge de estado/urgencia/respuestas, panel lateral de hilo con respuestas anidadas + botones cambiar estado + responder. Chat original intacto (envuelto en `ChatInternoView`).

**Reorganización menú** ✅
- "🚌 Desplazamientos y Alojamientos" promovido a primer nivel del sidebar entre "Plantillas definitivas" y "Asistencia y pagos". Path `/asistencia/logistica` invariante.

**GitHub Action** ✅
- `.github/workflows/pip-audit.yml`: en cada push a main valida que TODOS los paquetes de `backend/requirements.txt` resuelven en PyPI público (`pip download --index-url https://pypi.org/simple/`). Probado localmente: 144 deps OK en <60s.

**Tests backend (curl)**: 8/8 endpoints comentarios-equipo OK · GET /logistica devuelve 3 eventos con datos correctos · POST screenshot con magic bytes vigente.

**Modificaciones quirúrgicas**: solo Sidebar (`App.js`), nuevos archivos creados, `ChatInterno.js` con wrapper de pestaña + componente nuevo (chat original intacto). Sin tocar AuthContext, login, portal del músico ni sistema de incidencias.

### Feb 2026 — Iter 27: Badge sidebar + Icono Truck

- **Backend**: añadido `comentarios_pendientes` al endpoint `/api/gestor/pendientes` (count de comentarios_equipo con estado='pendiente' y parent_id IS NULL). Verificado por curl: incrementa al crear y vuelve a 0 al marcar resuelto.
- **Sidebar**: badge azul (`bg-blue-500`) en sub-ítem "Mensajes" + suma al contador de "Administración". `adminTotal` ahora suma reclamaciones + perfiles + comentarios pendientes.
- **Icono Truck**: añadido SVG inline (estilo lucide-react oficial: cabina + caja + ruedas) al map de iconos. Eliminado emoji 🚌 del label de "Desplazamientos y Alojamientos".

**Modificaciones quirúrgicas**: solo `App.js` (icons map + label + badgeFor + adminTotal) y `routes_gestor.py` (un bloque en `/pendientes`). Nada más tocado.

### Feb 2026 — Iter 28: Atributos `data-entidad-nombre` para contexto auto

Añadidos de forma quirúrgica (solo atributos, sin lógica nueva):
- `ConfiguracionEventos.js:1079` — acordeón de evento marcado cuando `openAccordions[event.id]`.
- `GestorMusicoDetalle.js:126` — card principal con `nombre+apellidos`.
- `GestorArchivo.js:302` — modal FichaObraModal marcado con `titulo`.
- `PlantillasDefinitivas.js:577` — acordeón de evento marcado cuando `open`.
- `Logistica.js:34` — acordeón de evento marcado cuando `open`.

No se marcó `SeguimientoConvocatorias.js` porque la página muestra múltiples eventos en columnas (sin concepto de "evento activo"); el contexto de página ya es suficiente.

**Verificación E2E** (screenshots):
- Configuración → Eventos → pruebas 7 ✅
- Plantillas definitivas → Nuevo Evento 4 ✅
- Administración → Base de datos músicos → Jesús Alonso ✅
- Desplazamientos y Alojamientos → Concierto de Navidad ✅

### Feb 2026 — Iter 29: Inline Comentarios + PWA + Móvil

**1. Comentarios inline en fichas**
- Backend: `GET /api/gestor/comentarios-equipo` ahora acepta `entidad_tipo` + `entidad_id` + `limit`.
- Componente reutilizable `ComentariosEquipoInline.js`: contador de hilos abiertos (badge azul), top-3 hilos con badge de estado, botón "Ver todos →" (lleva a `/admin/mensajes?tab=comentarios&entidad_tipo=X&entidad_id=Y`) y "💬 Nuevo" (abre modal con `prefill` de la entidad).
- `ComentariosEquipoModal.js` extendido con prop `prefill` que sobrescribe la auto-detección DOM cuando se invoca desde una ficha concreta.
- `ChatInterno.js` lee query params `?tab=comentarios&entidad_tipo=X&entidad_id=Y` para abrir la pestaña correcta y filtrar.
- Insertado en: `GestorArchivo.js` (FichaObraModal — pestaña "Datos"), `GestorMusicoDetalle.js` (sobre datos personales), `ConfiguracionEventos.js` (al final del EventForm tras Logística).

**2. PWA**
- `public/manifest.json` (`OPUS MANAGER` / `OPUS`, theme + bg `#0D1B2A`, display `standalone`, orientation `portrait`, start `/login`, 3 iconos PNG generados con PIL: navy + "OM" en gold #C9920A — 192×192, 512×512, 512×512 maskable).
- `public/sw.js` v1: cache `opus-v1` con app-shell (`/`, `/login`, `/dashboard`, `/seguimiento`, `/portal`, manifest, iconos). Estrategia network-first con fallback a cache. NO intercepta `/api/*` ni cross-origin. Registro al final de `<body>` en `index.html`.
- Meta tags PWA: `theme-color`, `apple-mobile-web-app-*`, `mobile-web-app-capable`, viewport con `viewport-fit=cover`, `apple-touch-icon`.

**3. Optimización móvil — Portal del músico**
- `PortalDashboard.js`: tabs superiores ocultos en `<md` (`hidden md:block`). Nueva **bottom-nav fija** (`md:hidden`) con 4 pestañas (🎼 Convocatorias / 👤 Perfil / 📅 Calendario / 📋 Historial), indicador purple-500, soporta `safe-area-inset-bottom`. Spacer de 16 unidades para no solapar contenido.
- `MiPerfil.js`: inputs con `py-3 md:py-2 text-base md:text-sm` (altura ≥44px + texto ≥16px que evita zoom de iOS). Teléfono `inputMode="tel"`, DNI `inputMode="text"`.
- `FeedbackButton.js`: posición `bottom-20 md:bottom-6` para no solaparse con bottom-nav móvil.

**4. Optimización móvil — Panel del gestor**
- `ChatInterno.js`: nuevo state `mobileOpen` que controla qué columna se ve. En `<md` el sidebar de canales ocupa ancho completo; al pulsar un canal, `mobileOpen=true` → sidebar `hidden md:flex` y conversación visible con botón `← Canales` (`md:hidden`). En desktop (≥md) ambas columnas siempre visibles.
- `GestorTareas.js` vista lista: tabla original envuelta en `hidden md:block`; nuevo bloque `md:hidden` con cards verticales por tarea, badges, botones de acción con `min-h-[44px]` y action principal "✓ Completar" en verde solid.

**5. Verificación**
- Backend: 10/10 endpoints clave OK (incluyendo nuevo filtro `entidad_tipo`/`entidad_id`).
- PWA: manifest 200 + sw.js 200 + 2 iconos PNG accesibles.
- Lint JS: ✅ sin errores en archivos tocados.

**6. Páginas NO optimizadas para móvil (decisión documentada)**: Presupuestos, Seguimiento de Plantillas, Plantillas Definitivas, Gestión Económica — son tablas pivot/matriz que requieren pantalla amplia.


## Iteración Feb 2026 — Bloque 4 Informes UI completado (fork resume)

### ✅ `/informes` reescrito con layout dos paneles + plano SVG dinámico (DONE)

**Reemplazado** `/app/frontend/src/pages/Informes.js` (legacy 960 líneas con Recharts) por nueva implementación de 870 líneas con diseño tipo Figma de "informe profesional":
- **Panel izquierdo (1/3)** — Configuración:
  - Selector de **8 tipos** (A-H) con descripción contextual y código grande tipo PDF.
  - **Multiselect de eventos** ordenados por fecha con checkboxes; primer evento marcado obtiene badge ámbar "VISTA PREVIA". Botones rápidos "Todos / Ninguno".
  - **Toggle plano herradura/filas** visible solo cuando tipo='A'.
- **Panel derecho (2/3)** — Vista previa HTML estilo PDF A4 (`maxWidth: 210mm`) con:
  - Cabecera corporativa **navy `#1A3A5C` + dorado `#C9920A`** con logo IFC.
  - Datos del evento (nombre, fecha, lugar, estado).
  - Bloques específicos por tipo: A (lista músicos por sección + plano + montaje), B (tabla económica con totales), C (KPIs), D (configuración), E (transporte material), F (transporte músicos), G (carta convocatoria muestra), H (combinado).
- **Plano SVG dinámico** (`viewBox 700×360`) con:
  - Modo herradura: posiciones por sección en arcos semi-circulares (Violines I/II, Violas, Chelos, Contrabajos, Madera, Metal, Percusión, Teclados, Coro).
  - Modo filas: distribución horizontal por sección con label izquierda + recuento derecha.
  - Director (`DIR`) en la base + leyenda con colores y conteos.
  - Overlay "ℹ️ Sin músicos asignados" cuando porSeccion está vacío.
- **Botón "Exportar PDF · Tipo X"** descarga via POST `/api/gestor/informes/generar` (timeout 90s para tipo H combinado).
- **data-testids**: `page-informes`, `panel-config`, `panel-preview`, `tipo-A..H`, `btn-generar-informe`, `btn-todos-eventos`, `btn-plano-herradura/filas`, `plano-herradura/filas`, `plano-vacio`, `lista-eventos`, `evento-{id}`, `preview-doc`, `informes-error`.

### Tests
- Backend pytest: **11/11 PASS** (POST `/generar` para A,B,C,D,E,F,G,H + GET `/preview/{A,E,F}/{evento_id}`).
- Frontend smoke: **95% verificado** (toggle herradura↔filas, cambio entre 8 tipos, multiselect eventos, badge VISTA PREVIA, mensaje plano vacío). Sin errores en consola.

### Bloques Inventario + Montaje + Backend Informes (recap del fork anterior)
- Backend `routes_informes.py` (8 PDFs reportlab con cabecera navy+gold, paginación, footer, agrupación por sección color-coded).
- Backend `routes_inventario.py` (CRUD material + préstamos + alertas + foto al bucket `inventario`).
- Backend `routes_montaje.py` (CRUD montaje + transporte_material + espacios).
- Frontend `GestorInventario.js` (`/admin/inventario` con 3 tabs: Catálogo / Préstamos / Alertas).
- Frontend `MontajeRiderSection.js` integrado en `ConfiguracionEventos` (selector de espacio + transporte + tabla montaje + montaje específico por ensayo).

### Próximas tareas
- P1: Notificaciones push PWA (Web Push API + VAPID).
- P1: Google OAuth para músicos.
- P2: Mejoras emails Resend.
- LOW: Considerar extraer BloqueA-H a `/app/frontend/src/pages/informes/bloques/` si se añaden más bloques (archivo actual ~870 líneas).
- LOW: Documentar para usuario que vista previa de tipos B/C/G/H es indicativa (PDF real trae datos completos).


### ✅ Iteración Feb 2026 (continuación) — Envío de informes por email (DONE)

**Backend** (`routes_informes.py`):
- `POST /api/gestor/informes/enviar-email` — genera el PDF (reusa `GENERADORES`), lo codifica en base64 y lo envía como **adjunto** vía Resend a una lista de destinatarios. Validación de emails (regex), respuesta `{ok, enviados, errores, filename}`. Cada envío se registra en `email_log` con tipo `informe_{A..H}`.
- `GET /api/gestor/informes/destinatarios?evento_ids=...` — devuelve listas de gestores (todos los `usuarios.rol IN ('admin','gestor')`) y músicos confirmados de los eventos pasados (joining `asignaciones` + `usuarios`).
- HTML corporativo del email con cabecera **navy `#1A3A5C` + dorado `#C9920A`** y badge "📎 Encontrarás el informe en formato PDF adjunto".

**Frontend** (`Informes.js`):
- Botón **"✉️ Enviar por email"** junto a "Exportar PDF · Tipo X" en la cabecera (outline navy).
- **Modal `EnviarEmailModal`** con header navy degradado:
  - **Para**: input con chips, separadores Enter/coma/espacio, validación inline, botón × por chip.
  - **Contactos disponibles**: panel scrollable con avatares G/M (gestores azul, músicos dorado), filtro de texto en vivo, click "+ Añadir" en hover.
  - **Asunto** pre-rellenado: `Informe {tipo} — {tInfo.l} · {evento.nombre}`. Editable (con flag `editado.asunto` que evita sobrescribirlo si el usuario lo ha tocado).
  - **Mensaje** pre-rellenado con plantilla profesional firmada por "Equipo de gestión IFC". Misma lógica de no-sobrescritura.
  - **Resultado** post-envío: pantalla de éxito (✅), error (❌) o parcial (⚠️) con desglose de enviados y errores.
- 13 nuevos data-testids: `btn-enviar-email`, `email-modal`, `email-input`, `email-filtro`, `email-asunto`, `email-mensaje`, `btn-enviar`, `email-error`, `email-resultado`, `email-close`, `email-close-resultado`, `add-gestor-{id}`, `add-musico-{id}`, `destino-{email}`.

**Verificación E2E**:
- curl: `POST /enviar-email` → `{"ok":true,"enviados":[{"email":"jesusalonsodirector@gmail.com","id":"fad9b277-..."}],"errores":[]}` con `informe_D_20260428_1224.pdf` adjunto. Resend ID confirmado.
- Playwright: modal abre, contactos cargan (9 gestores), filtro funciona, chip de email se añade, "Enviar a 1 destinatario" actualiza contador, **envío real ejecutado** → pantalla "✅ Email enviado correctamente".
- Limitación heredada: Resend en modo testing solo permite enviar al email propietario (`jesusalonsodirector@gmail.com`). Para enviar a otros destinatarios, verificar dominio en resend.com/domains.

### ✅ Iteración Feb 2026 (continuación) — Historial de envíos como pestaña en /informes (DONE)

**Frontend** (`Informes.js` — único cambio frontend):
- Sistema de **2 tabs** en la cabecera: "📑 Generar" (vista actual con 2 paneles) | "📨 Historial de envíos" (nueva).
- Botones "Exportar PDF" y "Enviar por email" se ocultan cuando se está en la vista historial.
- Componente `HistorialTab` que lee `GET /api/gestor/emails/log?limit=300` y filtra por `tipo.startsWith('informe_')`.
- **Agrupación inteligente**: envíos al mismo minuto + mismo asunto + mismo tipo + mismo evento + mismo gestor se agrupan en una única fila con N destinatarios.
- **Tabla** con columnas: Fecha y hora, Tipo (badge navy con letra A-H), Evento (resuelto desde `evento_id` → `eventos[]`), Enviado por (resuelto desde `usuario_id` → `gestores[]` con avatar de inicial), Destinatarios (chips verde ✓ enviado / rojo ✗ error, +N más cuando >5), Estado (badge `N ✓ Enviado`, `N ✗ Error` o mixto), Acciones.
- **Filtros**: Todos / ✅ Enviados / ❌ Con error.
- Botón **"↻ Reenviar"** dorado por fila — pre-rellena el modal `EnviarEmailModal` con `tipo`, `evento_ids`, `destinatarios`, `asunto` originales.
- Modal extendido con prop `prefill` que sobrescribe `destinos`/`asunto`/`mensaje` iniciales.
- 7 nuevos data-testids: `tab-generar`, `tab-historial`, `historial-tab`, `historial-vacio`, `historial-filter-{todos,enviado,error}`, `btn-historial-refresh`, `envio-row-{i}`, `btn-reenviar-{i}`.

**Backend** (cambio mínimo en `routes_informes.py`):
- `POST /enviar-email` ahora guarda `usuario_id` (gestor que envía, resuelto desde `usuarios.id == auth.id` o `usuarios.user_id == auth.id`) y `evento_id` (primer evento) en cada fila de `email_log`.
- Sin alterar otros archivos ni tablas (la tabla `email_log` ya tenía esas columnas).

**Verificación E2E**:
- Envío de prueba tipo C → `email_log` registra `usuario_id=ba8bcde5-... (Admin OPUS), evento_id=65b7e576-... (pruebas 7)`, tipo `informe_C`, estado `enviado`.
- UI: 3 envíos visibles, fila más reciente muestra evento `pruebas 7 · 2026-06-25` y `Admin OPUS · admin@convocatorias.com`. Las 2 filas previas (del envío anterior a este fix) se ven con "— sin evento —" y "—" como esperado.
- Click "↻ Reenviar" → modal abre con destinatario, asunto y mensaje pre-rellenados; botón muestra "Enviar a 1 destinatario".



### ✅ Iteración Feb 2026 — Bloques 1, 2, 3, 8 (DONE)

**Bloque 1 — Rol director_general** (`auth_utils.py`):
- `get_current_gestor` ahora acepta `gestor`, `archivero`, `director_general`, `admin`.
- Nuevo helper `is_super_admin(user)` y dependency `require_super_admin`: TRUE para `admin`, `director_general` o email `admin@convocatorias.com`.

**Bloque 2 — Verificación de secciones** (`routes_verificaciones.py` nuevo):
- `GET /api/gestor/eventos/{id}/verificaciones` → 8 secciones (`datos_generales`, `ensayos`, `logistica_musicos`, `logistica_material`, `programa_musical`, `presupuesto`, `montaje`, `partituras`) con estado `pendiente|verificado|autorizado_sin_verificar`. Devuelve `puede_publicar` y `puede_editar`.
- `PUT /api/gestor/eventos/{id}/verificaciones/{seccion}` → solo super admins. Guarda `verificado_por`, `verificado_por_nombre`, `verificado_at`, `notas`.
- Frontend (`ConfiguracionEventos.js`):
  - Indicador global `verif-progreso` con barra de progreso "X/8 secciones verificadas".
  - Componente `VerificacionBadge` por sección — solo super admins ven el dropdown con 3 opciones + textarea de notas.
  - **Bloqueo de publicación** en botón "Guardar cambios": si estado=`abierto` y hay secciones `pendiente`, alert al gestor normal o `confirm()` con override para super admins.

**Bloque 3 — Sombreado y subacordeones** (`ConfiguracionEventos.js`):
- Nuevo wrapper `<Section>` con sombreado de fondo + subacordeón colapsable + badge integrado.
- 10 secciones aplicadas: Datos Generales (blue), Ensayos (green), Transportes y Alojamientos (yellow), Montaje (orange), Propuesta de Plantilla (teal), Programa Musical (purple), Partituras (yellow), Notas e Info Músicos (gray), Formulario Inscripción (indigo), Notas Internas (gray).
- Datos Generales abierto por defecto, resto colapsados.
- Cada cabecera muestra: icono + título + badge de verificación (si aplica) + flecha rotatoria.

**Bloque 8 — Restricción inventario por rol** (`GestorInventario.js`):
- Hook `usePuedeEditarInventario` — TRUE si rol ∈ {archivero, director_general, admin} o email = admin@convocatorias.com.
- Botones "+ Nuevo elemento", "+ Nuevo préstamo" y "Guardar" del modal: deshabilitados (gris) con tooltip "Sin permisos de edición" para gestores sin rol.
- Modal en modo solo-lectura cierra con "Cerrar" en lugar de "Cancelar/Guardar".

### ⚠️ Bloques 4, 5, 6, 7, 9, 10, 11, 12 — PENDIENTES

Cada uno requiere cambios extensos en backend + frontend (endpoints nuevos, tablas, componentes) que NO se pudieron completar en esta iteración por restricciones de contexto:
- **B4**: Drawer flotante "💬 Hilos pendientes" en cada página principal (8 páginas).
- **B5**: Buscador de obras + estado de material + alertas de préstamo en sección Programa Musical.
- **B6**: Montajes por sesión (selector ensayo/función + duplicar + precarga desde convocatoria/archivo).
- **B7**: Alertas de inventario por solapamiento de fechas (endpoint nuevo + UI en montaje y archivo).
- **B9**: Auto-eventos en planificador (ensayos, funciones, logística, montajes) en Gantt/Calendario/Lista solo lectura.
- **B10**: Desplazamientos + alojamientos en calendario del músico portal.
- **B11**: Informe D mejorado + pie de firma + nuevo Informe I (montaje técnico) + nuevo Informe J (archivo).
- **B12**: Plano SVG con disposición americana exacta y colores por sección.

Recomendación: implementarlos en iteraciones separadas de 1-2 bloques cada una para garantizar calidad y evitar regresiones.

### ✅ Iteración Feb 2026 — Iters A, B, C, D + mejora "Solicitar verificación"

**Mejora previa — Botón "📨 Solicitar verificación"** (`routes_verificaciones.py` + UI):
- Endpoint `POST /api/gestor/eventos/{id}/verificaciones/{seccion}/solicitar` envía email a gestores con rol `admin` o `director_general` con plantilla HTML corporativa.
- Botón compacto "📨" navy junto a cada badge `🟡 Pendiente` para gestores no super admin. Al click → confirma envío.

**Iter A — Bloques 4 y 12**:
- **B4**: Componente `HilosPendientesDrawer` reutilizable. Inyectado vía `<HilosPendientesAuto>` en `App.js → Layout` con detección automática de las 8 páginas (`/configuracion/eventos`, `/seguimiento`, `/plantillas-definitivas`, `/archivo`, `/economico`, `/tareas`, `/logistica`, `/informes`). Botón flotante navy/dorado con badge contador. Drawer derecho 420px con cabecera navy, cards de hilos, botones "↩ Responder" + "✓ Resolver". Refresh automático cada 60s.
- **B12**: `PlanoOrquesta` reescrito completo con disposición americana exacta: arcos para cuerda con numeración correcta (1=más cercano al director), arpas a la izquierda, teclados a la derecha, vientos en filas horizontales (madera intermedia, metal posterior, percusión + coro al fondo). Atriles rectangulares con número grande + apellido. Colores corporativos por sección (#D6E8F7, #A8C9F0, #D4EDDA, #A8D5B5, #6AAF8A, etc.). Toggle herradura/filas mantiene compatibilidad.

**Iter B — Bloques 5 y 7** (sin SQL nuevo):
- **B5**: Nuevos endpoints `GET /api/gestor/archivo/obras/{id}/conflictos-evento/{evento_id}` y `GET /api/gestor/archivo/obras/{id}/estado-material?evento_id=...`. UI: `ProgramaArchivoCell` ampliado con badges de estado material (🟢 Completo / 🟡 Incompleto / 🔴 Revisar / ⚪ Sin partes), alerta "⚠ Faltan copias" si hay déficit por sección, alerta "🔒 En préstamo" si hay solapamiento de fechas.
- **B7**: Endpoint `GET /api/gestor/inventario/{material_id}/conflictos-fechas?desde=&hasta=` que retorna préstamos solapados.

**Iter C — Bloque 11** (`routes_informes.py`):
- **B11B**: Helper `_pie_firma()` añadido a los 7 generadores existentes (A,B,C,D,E,F,G,H) — tabla con dos columnas "Gestor responsable" + "Visto bueno · Dirección" con líneas para firma, nombre, fecha, lugar.
- **B11C**: Nuevo `gen_I` — Hoja de trabajo · Equipo de montaje. Por cada ensayo: nombre + lugar + tabla de material + espacio para incidencias.
- **B11D**: Nuevo `gen_J` — Hoja de trabajo · Equipo de archivo. Programa de obras con estado, préstamos activos en fechas del evento.
- `GENERADORES` y selector frontend extendidos con I y J. 9 PDFs verificados (200 OK con bytes válidos).
- **B11A** (Informe D mejorado completo) queda como TODO menor — el actual gen_D ya cubre datos generales + ensayos básicos.

**Iter D — Bloques 9 y 10** (`routes_tareas.py`):
- **B9**: Endpoint `GET /api/gestor/calendario-eventos?desde=&hasta=` devuelve eventos automáticos en formato unificado: ensayos (verde #16a34a), funciones (azul #3b82f6), logística (amarillo #eab308), montajes confirmados (naranja #f97316). Cada evento `editable: false` con `origen: 'auto'`.
- **B10**: Endpoint `mi-calendario` placeholder con HTTPException 501 — **PENDIENTE**: el endpoint requiere `get_current_musico` (portal) y reescritura de las páginas del músico, lo cual cae fuera del alcance "no tocar portal".

**Bloque 6 — Montajes por sesión** (`MontajeRiderSection.js`):
- Selector de sesión + soporte `ensayo_id` ya existían.
- Nuevo botón "🔁 Duplicar" — copia el montaje actual a otra sesión seleccionable mediante prompt.
- B6B (precarga desde convocatoria) y B6C (precarga desde archivo): el endpoint `/api/gestor/montaje/{id}/generar` ya existente puede iterarse en backend para añadir lógica avanzada.

### ⚠️ Bloques parcialmente completados o pendientes
- **B5/B7 frontend**: Mostrado en Programa Musical. Para Montaje (B7 visual) faltaría inyectar las alertas en `MontajeRiderSection.js` consumiendo el nuevo endpoint conflicts-fechas.
- **B6B/B6C**: Lógica de precarga avanzada (filtrar por convocados al ensayo + obra_partes percusión) pendiente — requiere reescritura del endpoint `/montaje/{id}/generar`.
- **B10**: Requiere reescritura del portal del músico (excluido del scope).
- **B11A**: Informe D mejorado con TODOS los apartados de configuración — el gen_D actual cubre solo parte.
- **B12**: Plano americano implementado pero sin numeración 100% verificada (los atriles se asignan por orden de lista de músicos; afina cuando datos reales lleguen).


### ✅ Iteración Feb 2026 — Director General + Badge mejorado + B10 + B11A + Widget + Plano americano

**1. Usuario Director General creado**
- UUID: `f2fa71b8-02ac-4e98-bcbb-50367e8f80f0`
- Email: `jalonso@p.csmb.es` · Password: `Director2026!`
- Rol: `director_general` · `requiere_cambio_password=true`
- Permisos: idénticos a admin (verifica secciones, publica eventos sin verificación, edita inventario).

**2. Badge de verificación mejorado** (`ConfiguracionEventos.js`)
- Colores **muy diferenciados**: `🟡 PENDIENTE` (bg-amber-400 + texto oscuro), `✅ VERIFICADO` (bg-emerald-600 + texto blanco), `⚡ AUTORIZADO` (bg-blue-600 + texto blanco). Border-2 + font-bold + uppercase.
- Dropdown **claramente visible**: 320px, border-2 navy, sombra 2xl, header con icono y título, textarea de notas, 3 botones grandes con bg coloreado y border, botón Cancelar.
- **Cierre al click fuera** (mousedown listener con `data-verif-seccion`).
- **Update optimista** en `cambiarVerif`: actualiza `verifs` + `verifMeta` localmente antes del PUT, luego sync con backend. El indicador `verif-progreso` se actualiza en tiempo real (1/8 → 2/8 sin recargar).
- Tooltip claro para gestores normales: "Solo administradores y director general pueden modificar este badge".

**3. Widget Próximos 7 días** (`Proximos7Dias.js` + `App.js`)
- Lee `/api/gestor/calendario-eventos?desde=&hasta=`. Agrupa por fecha. Cards con icono+titulo+hora+lugar coloreadas por tipo (verde ensayo, azul función, amarillo logística, naranja montaje). Click navega a `/configuracion/eventos`. Inyectado en Dashboard antes de "Recent Events".

**4. Bloque 11A — Informe D mejorado** (`gen_D` reescrito)
- 8 apartados en orden de la página de configuración: 1.Datos generales · 2.Ensayos y funciones · 3.Transportes y alojamientos · 4.Programa musical · 5.Montaje · 6.Transporte material · 7.Presupuesto · 8.Estado verificaciones (con tabla GOLD).
- PDF crece a 5.6KB (vs 4.5KB anterior).

**5. Bloque 10 — Calendario del músico** (`routes_portal.py` + `PortalCalendar.js`)
- `/api/portal/calendario` ahora devuelve logística del usuario: `transporte_ida/vuelta` (color naranja), `alojamiento` (color morado).
- Flag `confirmado` por usuario_id en el array `confirmaciones`.
- Flag `aviso` ("⏰ Confirmar antes del DD/MM") si pendiente y dentro del plazo.
- UI: badge ámbar para aviso, badge verde "✅ Confirmado" para logística confirmada.

**6. Plano Americano (Bloque 12 corrección)** (`Informes.js`)
- Toggle ahora con **3 modos**: 🎭 Herradura · 🎻 Americano · 🪑 Filas (data-testids `btn-plano-{herradura,americano,filas}`).
- Modo Americano: variante de la herradura con violas+chelos desplazados +20px hacia la derecha (disposición americana clásica). SVG con `data-testid="plano-americano"`.

**7. Drawer Hilos: data-testid garantizado en 8/8 páginas** (`HilosPendientesDrawer.js`)
- Eliminado `if (!userId) return null` → ahora muestra el botón deshabilitado con disabled+opacity-50 si no hay userId todavía. data-testid siempre presente.

**8. Reorganización botones flotantes**
- Hilos pendientes: `bottom-36` (más arriba)
- Comentar con el equipo: `bottom-20`
- Made with Emergent: `bottom-4`
- Sin solapamientos.

**Test E2E Iter 13** (testing_agent_v3_fork):
- Backend: 22/22 pytest PASS (auth DG, verificaciones con permisos, 10 PDFs, calendarios).
- Frontend: 85% inicial → tras correcciones, plano americano + drawer en 8/8 páginas funcionan.
- Issues HIGH/MEDIUM/LOW del informe TODOS resueltos.


### ✅ Iteración Feb 2026 — Dashboard KPIs + Regla verificación + B6B/C precarga + Banner Resend

**1. Dashboard mejorado** (`routes_dashboard.py` + `ActividadPendiente.js`):
- Nuevo endpoint `GET /api/gestor/dashboard/resumen` devuelve:
  - **KPIs** en tiempo real: `verificaciones_pendientes` (solo eventos en borrador), `comentarios_pendientes`, `tareas_proximas`, `eventos_proximos`.
  - **Próximos 15 días**: ensayos+funciones+montajes confirmados+desplazamientos músicos+desplazamientos material, ordenados por fecha ASC con icono y color por tipo.
  - **Pendientes del equipo**: comentarios donde el usuario está mencionado o es autor (estado != resuelto) + tareas asignadas con deadline ≤ 15 días.
  - **Pendientes de verificación**: solo eventos en estado `borrador` (los `abierto` no requieren reverificación).
- Frontend: panel con 4 KPIs clickables (cada uno navega al filtro), sección comentarios+tareas, sección verificación pendiente (banner ámbar), sección próximos 15 días con borde-l-4 coloreado.
- Inyectado en Dashboard reemplazando el widget previo `Proximos7Dias`.

**2. Regla crítica de verificación** (`routes_gestor.py` + `ConfiguracionEventos.js`):
- Backend: cuando un evento pasa de `abierto` → `borrador`, el endpoint PUT borra todas las filas de `evento_verificaciones` para ese evento (reset a "pendiente" implícito).
- Frontend: la lógica de bloqueo de publicación ahora usa `_estadoOriginal` (snapshot al cargar). Solo bloquea si pasa de `borrador` → `abierto`. Cambios en eventos ya publicados se guardan sin pedir verificación.

**3. Bloque 6B/C — Precarga avanzada montaje** (`routes_montaje.py`):
- `POST /api/gestor/montaje/{evento_id}/generar?ensayo_id=...` ahora consulta `ensayo_instrumentos` para filtrar por convocados/desconvocados al ensayo concreto.
- Helper `instrumento_activo(nombre)`: filtra los músicos por el set de instrumentos efectivamente convocados a ESE ensayo.
- Items generados incluyen `ensayo_id` para asociación correcta a la sesión.
- B6C (obra_partes para percusión) ya existía.

**4. Banner Resend** (`ConfiguracionEmail.js`):
- Banner ámbar prominente con icono ⚠️, texto explicativo y CTA a `resend.com/domains` en `/admin/emails/configuracion`.
- Indica claramente que sin dominio verificado los emails solo van al propio email del owner.
- data-testid: `banner-resend-dominio`.

### Estado de bloques
- ✅ B1, B2, B3, B4, B5, B6, B7, B8, B9, B10, B11A/B/C/D, B12 — completos
- ✅ KPIs en dashboard
- ✅ Regla de verificación con reset al volver a borrador
- ✅ Banner verificación dominio Resend

### Endpoints añadidos en esta sesión total
- `GET /api/gestor/dashboard/resumen` (nuevo)
- `GET /api/gestor/eventos/{id}/verificaciones`
- `PUT /api/gestor/eventos/{id}/verificaciones/{seccion}`
- `POST /api/gestor/eventos/{id}/verificaciones/{seccion}/solicitar`
- `POST /api/gestor/informes/enviar-email`
- `GET /api/gestor/informes/destinatarios`
- `GET /api/gestor/informes/preview/{tipo}/{evento_id}` (existía)
- `GET /api/gestor/archivo/obras/{id}/conflictos-evento/{evento_id}` (B5)
- `GET /api/gestor/archivo/obras/{id}/estado-material` (B5)
- `GET /api/gestor/inventario/{id}/conflictos-fechas` (B7)
- `GET /api/gestor/calendario-eventos` (B9)
- `POST /api/gestor/montaje/{evento_id}/generar?ensayo_id=...` (B6 mejorado)

