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

### Abril 2026 (iteración actual)
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
- [ ] **Verificar dominio en Resend** para poder enviar emails a cualquier destinatario (actualmente limitado al owner). El usuario debe:
  1. Ir a resend.com/domains, añadir su dominio (e.g. opusmanager.es)
  2. Configurar DNS (SPF, DKIM)
  3. Actualizar `SENDER_EMAIL` en `/app/backend/.env` a `noreply@sudominio.com`

### P1
- [ ] **Fase 3: Google OAuth** (Emergent-managed) para ambos roles
- [ ] **Ejecutor de recordatorios**: actualmente solo se configuran (activo/inactivo). Falta un job scheduler (cron) que lea `recordatorios_config` y envíe emails en las fechas correctas. Propuesta: APScheduler dentro de FastAPI + tarea diaria que:
  - Para cada recordatorio activo calcula si hoy corresponde enviarlo
  - Obtiene lista de destinatarios (solo músicos sin responder / confirmados / etc.)
  - Personaliza mensaje con variables
  - Llama a `send_reminder_email` y loggea

### P2
- [ ] Refactor legacy `AsistenciaPagos.js`, `Presupuestos.js` hacia Supabase
- [ ] Optimizar N+1 en mi-historial/eventos
- [ ] Notificaciones push navegador músicos
- [ ] Tab "Pagos" en portal con fecha de pago correcta (ahora usa updated_at genérico)

### P3
- [ ] Google Drive justificantes, Gmail
- [ ] XML bancario y PDF corporativo
