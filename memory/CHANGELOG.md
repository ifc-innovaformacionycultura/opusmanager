# CHANGELOG

## Iter 20 · 2026-05-01 · Sprint masivo (Config + Fichaje QR + Preview + Mejoras)

### BLOQUE 1 — Configuración de la Organización (DONE)
- Panel `/admin/configuracion` centraliza variables globales en BD `configuracion_app` (CIF, logo, firma director, IRPF%, color primario/secundario, etc).
- Caché 5 min en `config_app.py::get_config()`. Backend lee de BD (no de `os.environ`).
- Fix iter19: `_is_admin_or_director` acepta email `admin@convocatorias.com` aunque BD diga `rol='gestor'`.

### BLOQUE 2 — Sistema de Fichaje QR (DONE)
- Reglas globales y por ensayo (`fichaje_config`), QR token por ensayo (`ensayo_qr`), fichajes (`fichajes`).
- Página pública `/fichar/:token` detecta sesión del músico (AuthContext / SupabaseAuthContext).
- Panel en portal del músico con botones entrada/salida según ventana horaria.
- Toggle "Ver datos QR" en `/plantillas-definitivas` — **solo informativo, no altera cálculo de cachés**.
- Fix iter19: `regenerar_qr` y `_ensure_qr_token` usan UPDATE sobre fila existente (tabla tiene UNIQUE(ensayo_id), sin columna `updated_at`).

### BLOQUE B — Visualizador Portal Músico (NUEVO)
- `/admin/preview-musico` panel admin con lista de músicos (buscador tolerante a acentos) + panel derecho con iPhone frame.
- `POST /api/gestor/preview/generar-token` crea token temporal (30 min TTL) en `impersonacion_tokens`. Desactiva tokens anteriores del mismo gestor para el mismo músico.
- `GET /api/preview/{token}` sin auth devuelve perfil músico + eventos + calendario + pagos + certificados + reclamaciones + comidas. IBAN enmascarado. 410 si expirado.
- `/portal-preview/{token}` iframe-ready, **no usa AuthContext ni SupabaseAuthContext**, banner amarillo "VISTA PREVIA — Solo lectura", 4 pestañas (Convocatorias / Perfil / Calendario / Historial).
- Restringido a admin/director_general.

### D1 — Opciones de menú en comedor (DONE · requiere SQL ejecutado por usuario)
- SQL: `ALTER TABLE evento_comidas ADD COLUMN opciones_menu JSONB`; `ALTER TABLE confirmaciones_comida ADD COLUMN opcion_menu_seleccionada TEXT`.
- Editor en `ComidasSection` (gestor) hasta 4 opciones.
- Radio buttons en `ComidasMusicoPanel` cuando hay opciones definidas.
- Informe confirmaciones incluye `desglose_por_opcion`.

### D2 — Resumen mensual al músico (DONE)
- `email_resumen_mensual.py` nuevo módulo con HTML corporativo IFC navy/gold.
- Cron APScheduler día 1 @ 08:00 Europe/Madrid.
- `POST /api/admin/recordatorios/send-monthly-summary-musicians` para disparo manual.
- Fix: `_es_admin` acepta email `admin@convocatorias.com`.

### D3 — Catálogo de plantillas email (DONE)
- `GET /api/comunicaciones/catalogo` devuelve 4 plantillas predefinidas.
- `POST /api/comunicaciones/catalogo/{key}/crear` clona con tema IFC Corporate.
- Botón "✨ Del catálogo" en `/configuracion/plantillas` con modal selector.

### D4 — Widget próximos 7 días (VERIFICADO)
- `/api/gestor/calendario-eventos` devuelve ensayos (verde) / funciones (azul) / logística (amarillo) / montajes (naranja).
- Componente `Proximos7Dias.js` consume el endpoint correctamente.

### Testing
- iter19.json: 14/15 backend OK · frontend 40% (falsos positivos URL).
- iter20.json: 16/17 backend OK · frontend 100% · 1 bug menor corregido.

### Variables Railway ELIMINABLES
Las siguientes ya **NO** se usan (todo viene de `configuracion_app` vía `config_app.py`):
- `DIRECTOR_NOMBRE`
- `DIRECTOR_FIRMA_URL`
- `DIRECTOR_CARGO`
- `IRPF_PORCENTAJE`
- `ORG_NOMBRE`
- `ORG_CIF`
- `ORG_DIRECCION`

**MANTENER** (siguen en uso):
- `SUPABASE_URL`, `SUPABASE_KEY`, `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY`
- `RESEND_API_KEY`, `SENDER_EMAIL`, `APP_URL`, `PUBLIC_APP_URL`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL`
- `CORS_ORIGINS`, `CORS_ORIGIN_REGEX`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `HORAS_ENSAYO_DEFAULT`, `HORAS_FUNCION_DEFAULT` (opcionales)
- `DIAS_ANTES_DISPONIBILIDAD`, `DIAS_ANTES_LOGISTICA`, `DIAS_ANTES_COMIDAS`, `DIAS_ANTES_TAREAS` (opcionales)

---

## Iter 19 · 2026-04 · Bloque 1 + Bloque 2 inicial
- Sistema Recibos y Certificados (WeasyPrint)
- Servicio de Comedor (backend + portal músico)
- Configuración organización (panel admin)
- Fichaje QR (reglas, tokens, páginas pública y portal)
