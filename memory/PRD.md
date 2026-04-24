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
