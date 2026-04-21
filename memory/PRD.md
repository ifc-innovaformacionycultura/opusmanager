# OPUS MANAGER - PRD

## Problema Original
Sistema integral para gestión de convocatorias, temporadas, eventos y plantillas musicales para orquestas. Migración completa de MongoDB → Supabase (PostgreSQL + Auth). Autenticación Dual (Gestores con JWT propio via AuthContext, Músicos via SupabaseAuthContext SDK). Login unificado con Email/Password (Magic Link eliminado).

## Arquitectura
- **Frontend:** React + TailwindCSS + axios (Gestores) + Supabase SDK (Músicos)
- **Backend:** FastAPI + Supabase (PostgreSQL + Auth)
- **Email:** Resend (pendiente API key del usuario)
- **Autenticación:** Email/Password para todos los roles. Google OAuth (pendiente).
- **Dual Auth:** Gestores → AuthContext (axios + backend), Músicos → SupabaseAuthContext (SDK directo)

## User Personas
1. **Gestor de Orquesta** — administra temporadas, eventos, asignaciones y músicos.
2. **Músico** — consulta sus eventos asignados, confirma asistencia y ve calendario.

## Core Requirements
- [x] Fase 1+2: Login email/password unificado para Gestor y Músico
- [x] Fase 3: Google OAuth **(PENDIENTE)**
- [x] Fase 4: Creación de músicos por Gestor + email credenciales temporales via Resend **(UI y backend listos, falta API key del usuario)**
- [x] Fase 5: Cambio de contraseña obligatorio en primer acceso (sin bucle infinito)
- [x] Fase 6: Recuperación de contraseña ("¿Olvidaste tu contraseña?")
- [x] Diseño split-screen con imagen del auditorio en login
- [x] Indicador "X compañeros confirmados / Y" en tarjetas del portal del músico (sin revelar nombres)
- [x] Vista de calendario mensual del músico con código de colores (azul ensayos, verde conciertos/funciones, naranja fechas límite)
- [x] Base de datos de músicos en panel gestor con buscador y filtros (instrumento, estado activo/inactivo, búsqueda por nombre/email)
- [x] Exportación a Excel (.xlsx con 3 hojas: Usuarios, Eventos, Asignaciones)

## What's Been Implemented

### Abril 2026 - Estabilización y nuevas features
- ✅ **Fase 5 (bucle infinito resuelto)**: Se reordenó el flujo de `CambiarPasswordPrimeraVez` — primero se actualiza el flag en BD con el token existente, LUEGO se llama `supabase.auth.updateUser`. Además, `SupabaseAuthContext` ahora salta el reload de perfil en eventos `USER_UPDATED`/`TOKEN_REFRESHED` para evitar deadlock de sesión.
- ✅ **Compañeros confirmados por evento**: `GET /api/portal/mis-eventos` devuelve `companeros_confirmados` y `companeros_total` por asignación (sin revelar nombres, excluyendo al propio músico).
- ✅ **Calendario mensual (Portal músico)**: Nueva pestaña "Calendario" en `PortalDashboard.js` con grid, navegación mes anterior/siguiente/hoy, leyenda de colores, detalle de día. Datos via `GET /api/portal/calendario`.
- ✅ **Panel Gestor — Base de datos de músicos**: Nueva página `/admin/musicos` con buscador (debounce 300ms), filtros por instrumento y estado, tabla responsive, total dinámico. Backend: `GET /api/gestor/musicos?q=&instrumento=&estado=` + `GET /api/gestor/instrumentos`.
- ✅ **Exportación Excel**: `GET /api/gestor/export/xlsx` genera .xlsx con 3 hojas (Usuarios, Eventos, Asignaciones) usando openpyxl. Botón "Exportar a Excel" en la página de músicos.
- ✅ **Crear músico (Fase 4 — UI y backend listos)**: Endpoint `POST /api/gestor/musicos/crear` genera contraseña temporal, crea usuario en Supabase Auth con `requiere_cambio_password=true`, y envía email via Resend si está configurado. Si la API key no está configurada, devuelve la contraseña en la respuesta para que el gestor la comparta manualmente. Modal UI integrado en la página de músicos con botones "Copiar" para email y password.
- ✅ **CRITICAL FIX — Bug de sesión compartida Supabase**: Identificado por testing agent: el cliente global `supabase` (service_role) era contaminado por `auth.sign_in_with_password`, lo que provocaba 404s intermitentes en endpoints del gestor. Fix: (a) `routes_auth.py` crea un cliente efímero por cada login/signup/refresh. (b) `verify_supabase_token` en `supabase_client.py` crea un cliente efímero por cada verificación. (c) `logout` es ahora un noop server-side (el cliente descarta su token). Reproducible al 100% antes del fix; resuelto.

### Estado anterior (histórico)
- Migración completa MongoDB → Supabase
- Login unificado (split-screen), eliminación de Magic Link
- Fase 5 (cambio password primer acceso) y Fase 6 (recuperación password) codificadas
- RLS de Supabase configurado (no desactivado)
- `sync-profile` endpoint para sincronizar usuarios nuevos

## Prioritized Backlog

### P0 - Crítico (Próxima iteración)
- [ ] **Fase 3: Google OAuth** (Emergent-managed) para Gestores y Músicos — requires integration playbook + config

### P1 - Importante
- [ ] **Resend API key** del usuario — una vez configurada en `/app/backend/.env` como `RESEND_API_KEY`, el flujo de creación de músicos enviará emails automáticamente (la UI ya muestra feedback apropiado si está o no configurada)

### P2 - Nice to have
- [ ] Refactor componentes legacy del Gestor (`AsistenciaPagos.js`, `Presupuestos.js`) que aún puedan apuntar a rutas MongoDB
- [ ] Notificaciones Push en el navegador para músicos
- [ ] Optimizar `get_mis_eventos` (N+1 de count queries)

### P3 - Backlog
- [ ] Google Drive API para justificantes
- [ ] Gmail API (si el usuario decide añadirlo además de Resend)
- [ ] Exportación XML bancario y PDF corporativo (ya estaba en el PRD anterior)
- [ ] Reemplazar fuente `fonts.cdnfonts.com` (OTS parsing error en consola, no bloqueante)

## Archivos clave
- `/app/backend/routes_auth.py` — ephemeral clients per login/signup/refresh
- `/app/backend/routes_portal.py` — compañeros_confirmados + calendario
- `/app/backend/routes_gestor.py` — crear/filtrar músicos + export xlsx
- `/app/backend/email_service.py` — Resend integration
- `/app/backend/supabase_client.py` — verify_supabase_token con cliente efímero
- `/app/frontend/src/pages/GestorMusicos.js` — UI panel gestor (listado + modal crear)
- `/app/frontend/src/pages/portal/PortalCalendar.js` — calendario mensual
- `/app/frontend/src/pages/portal/PortalDashboard.js` — tabs + indicador compañeros
- `/app/frontend/src/pages/portal/CambiarPasswordPrimeraVez.js` — Fase 5 corregido
- `/app/frontend/src/contexts/SupabaseAuthContext.js` — skip reload en USER_UPDATED

## Base de datos
Tablas Supabase: `usuarios`, `eventos`, `ensayos`, `asignaciones`, `disponibilidad`, `materiales`, `recordatorios`, `tareas`.
Campo clave: `usuarios.requiere_cambio_password BOOLEAN` (fuerza cambio en primer acceso).
