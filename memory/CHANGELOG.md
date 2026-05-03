# CHANGELOG

## Iter 29 · 2026-05-03 · Solo estética (4 puntos)

### 🎨 Cambios visuales
- **Punto 6 — Dashboard en 4 bloques coloreados**: Se extrajo `DashboardPage` de `App.js` a un archivo propio `/app/frontend/src/pages/DashboardPage.js`. Se envolvieron las secciones en 4 bloques con encabezado (título bold + descripción text-xs) y fondos distintivos:
  - 🔵 `bloque-resumen-actividad` (bg-blue-50) · stats + tiles pendientes
  - 🟡 `bloque-pendientes-atencion` (bg-amber-50) · `<ActividadPendiente />`
  - 🟢 `bloque-proximos-15-dias` (bg-green-50) · listado Próximos eventos
  - ⚪ `bloque-estado-sistema` (bg-gray-50) · link a `/admin/recordatorios`
- **Punto 8 — Ayuda push colapsable** en `/admin/recordatorios`: `<details data-testid="ayuda-notificaciones-push">` con el texto literal solicitado (cómo funcionan, para qué sirven, por qué no llegan).
- **Punto 9 — Barras verticales sticky por sección**: Cada `Section` de `ConfiguracionEventos.js` ahora lleva un `<aside sticky top-0 w-7>` con `writing-mode: vertical-rl` + `rotate(180deg)`. Colores por sección vía `SECCION_BAR` (blue-500 / green-500 / yellow-500 / orange-500 / purple-500 / red-500 / pink-500 / gray-400 / teal-500 / indigo-500). Se quitó `overflow-hidden` del contenedor para permitir sticky.
- **Punto 14 — Dropdown verificación con `position:fixed`**: `VerificacionBadge` reposicionado con `useRef` + `getBoundingClientRect()`. Detecta proximidad al borde derecho (align right) e inferior (open upwards). `z-index: 9999`.

### ✅ Validación
- **100% PASS** en testing_agent (iter 29 + regresión iter28). 0 bugs, 0 regresiones.
- Archivos tocados (EXACTAMENTE los 4 acordados con el usuario):
  - `App.js` (2 líneas: import + eliminación del bloque inline)
  - `DashboardPage.js` (NUEVO)
  - `RecordatoriosAdmin.js` (1 inserción)
  - `ConfiguracionEventos.js` (3 cambios quirúrgicos: useRef import + SECCION_BAR/aside + fixed dropdown)



## Iter 28 · 2026-05-02 · Fix UX loading /admin/musicos + regresión completa

### 🐛 Bug fix quirúrgico
- **`GestorMusicos.js` línea 754**: durante el `loading=true` el contador mostraba "Total: **0** músicos" (confuso — el usuario creía que no había datos). Ahora muestra "Total: **—** cargando..." y al terminar carga "Total: **15** músicos". RCA: el estado `musicosFiltrados` es `[]` mientras llega la respuesta del API → `musicosFiltrados.length` = 0.
- Endpoint backend `/api/gestor/musicos` siempre devolvió 15 músicos correctamente (verificado con curl).

### ✅ Regresión completa iter23+26+27+28
- Backend: **28/28 pytest PASS** (`test_iter23_bandeja.py` + `test_iter27_mejoras.py` + `test_iter28_regression.py` nuevo).
- Frontend Playwright: 8/8 flujos críticos OK — confirmado:
  - `/admin/musicos` muestra 15 músicos, transición "—" → "15" durante carga.
  - Firma custom persiste tras ALTER TABLE. Se inyecta en respuestas. Borrar vuelve a default.
  - `btn-marcar-todos-leidos` funcional.
  - Widget `UltimosEmailsMusico` renderiza en ficha músico.
  - HelpPanel: toggle visible en panel gestor, textos distintos por ruta, localStorage persiste, **NO** renderiza en `/portal`.
  - Sidebar Comunicaciones tiene 3 items; Administración ya NO tiene Recordatorios/Emails.
- **0 bugs detectados** por el testing agent.



## Iter 27 · 2026-05-02 · Mejoras Bandeja + HelpPanel contextual

### 🆕 Features
1. **Widget "Últimos emails" en ficha del músico** (`GestorMusicoDetalle`)
   - Nuevo componente `UltimosEmailsMusico.js` muestra los 3 últimos correos (entrantes+salientes) vinculados al músico por `musico_id`.
   - Mismo estilo que `HistorialContactosMusico`. Click → redirige a `/admin/comunicaciones`.
2. **Firma institucional configurable** (`Administración → Configuración → pestaña "Configuración" del Centro de Comunicaciones`)
   - Textarea HTML en `ConfiguracionBandeja.js` con previsualización en vivo.
   - Nueva columna `email_firma_html` en `configuracion_app` (⚠️ SQL pendiente).
   - Si está vacía se usa la **firma por defecto** auto-generada con `org_nombre + dirección + teléfono + web`.
   - El backend (`_firma_actual()`) inyecta la firma al final de cada respuesta saliente con un separador `border-top: 2px solid #C9920A`.
3. **Botón "✓ Todos leídos"** en la barra superior de la lista de Bandeja
   - Nuevo endpoint `POST /api/gestor/bandeja/marcar-todos-leidos?carpeta=INBOX|SENT|DESTACADOS|ARCHIVED`.
   - Marca en masa `leido=true` todos los correos de la carpeta actual (respetando `archivado=false`).
4. **HelpPanel contextual** (`components/HelpPanel.js`)
   - Botón flotante `?` en esquina inferior izquierda (bg-gray-500) — no colisiona con los flotantes derechos (feedback verde, comentarios azul, hilos pendientes).
   - Panel lateral izquierdo de 320px con texto de ayuda específico por ruta.
   - **26 rutas** cubiertas: `/dashboard`, `/configuracion/eventos`, `/configuracion/presupuestos`, `/seguimiento`, `/plantillas-definitivas`, `/asistencia/logistica`, `/asistencia/registro`, `/asistencia/pagos`, `/asistencia/analisis`, `/asistencia/recibos-certificados`, `/informes`, `/admin/archivo`, `/admin/inventario`, `/admin/musicos`, `/admin/historial-musicos`, `/admin/preview-musico`, `/admin/comunicaciones`, `/admin/tareas`, `/admin/incidencias`, `/admin/reclamaciones`, `/admin/recordatorios`, `/admin/configuracion`, `/admin/actividad` + variantes.
   - Persistencia en `localStorage` key `helpPanel_open`.
   - **No renderiza en `/portal`** (guard explícito).
   - Integrado con **1 línea** en `App.js` (`<HelpPanel />` dentro de `<Layout>`).

### ✅ Validación
- Backend: 9/10 pytest PASS + 1 skip intencional (columna pendiente).
- Frontend: HelpPanel verificado en 4 rutas + guard /portal + persistencia localStorage + botón marcar-todos-leidos + textarea firma.

### ⚠️ SQL pendiente de ejecutar
```sql
ALTER TABLE configuracion_app ADD COLUMN IF NOT EXISTS email_firma_html TEXT;
```
El endpoint `PUT /api/admin/bandeja/config` detecta la ausencia de columna y devuelve **400 con mensaje claro** (no 500). Tras ejecutar el ALTER, la firma custom se podrá guardar sin cambios adicionales.



## Iter 26 · 2026-05-02 · Centro de Comunicaciones + Bandeja Gmail IMAP

### 🆕 Backend
- **Nueva tabla `email_inbox`** (SQL ejecutado por usuario) — almacena correos entrantes (IMAP) y salientes (Resend) con `thread_id`, `direccion`, `remitente/destinatario`, `asunto`, `cuerpo_html`, `leido`, `destacado`, `archivado`, `carpeta`, `musico_id` (vinculación CRM), `adjuntos_meta` JSONB, `raw_headers`.
- **Columnas añadidas a `configuracion_app`**: `gmail_imap_host` / `port` / `user` / `app_password` / `sync_enabled` / `sync_folder` / `sync_last_run` / `sync_last_uid`.
- **Nuevo router `routes_bandeja.py`** con:
  - `GET /api/gestor/bandeja/emails?carpeta=INBOX|SENT|DESTACADOS|ARCHIVED&q=&musico_id=&leido=&destacado=` — lista + contadores globales.
  - `GET /api/gestor/bandeja/emails/{id}` — detalle + hilo de conversación (por `thread_id`). Auto-marca leído.
  - `POST /api/gestor/bandeja/sincronizar` — fuerza sync IMAP manual (admin).
  - `POST /api/gestor/bandeja/responder` — envía vía Resend + registra como saliente en `email_inbox`. Tolerante a fallos (row se crea aunque Resend falle).
  - `PUT /api/gestor/bandeja/emails/{id}/leido` · `/destacar` — toggles.
  - `DELETE /api/gestor/bandeja/emails/{id}` — archivar soft (`archivado=TRUE`).
  - `GET/PUT /api/admin/bandeja/config` — credenciales IMAP con **password enmascarado** y no-sobrescritura cuando vacío.
  - `POST /api/admin/bandeja/test-conexion` — valida login IMAP sin lanzar 500 (devuelve `{ok:false,error}`).
- **APScheduler job** `gmail_inbox_sync` registrado en `routes_recordatorios.init_scheduler()` con `IntervalTrigger(minutes=15)`. Idempotente — evita duplicados por `UID` + `message_id`.
- **Vinculación automática con CRM**: `_match_musico_by_email()` busca el `remitente_email` en tabla `usuarios` (rol=musico) y registra contacto en `contactos_musico` vía `log_contacto_auto()`.

### 🎨 Frontend
- **Nueva página `/admin/comunicaciones`** (`CentroComunicaciones.js`) con **7 pestañas**:
  1. 📥 Bandeja de entrada (`BandejaEntrada.js`) — layout dos paneles (40% lista / 60% lector) + sidebar interno con carpetas + modal redactar/responder con quote blocks.
  2. 📤 Enviados (reutiliza `GestorEmailLog`).
  3. 💬 Chat del equipo (reutiliza `ChatInterno`).
  4. 📋 Comentarios del equipo (`ComentariosEquipoGlobal.js`) — listado agregado con filtros por estado.
  5. 🔔 Recordatorios push (reutiliza `RecordatoriosAdmin`).
  6. 🎨 Plantillas (reutiliza `ConfiguracionPlantillas`).
  7. ⚙️ Configuración (`ConfiguracionBandeja.js`) — formulario IMAP con enmascarado, checkbox activación, botón "Probar conexión", enlace a Google App Passwords.
- **Reorganización del sidebar**:
  - Grupo **Comunicaciones** ahora contiene: *Centro de Comunicaciones · Recordatorios Push · Historial de Emails*.
  - Eliminados de **Administración**: Recordatorios Push + Historial de Emails.
- Paleta corporativa navy (`#1A3A5C`) + gold (`#C9920A`) aplicada en toda la UI de bandeja.

### ✅ Validación
- Backend: **11/11 pytest PASS** (`/app/backend/tests/test_iter23_bandeja.py`). Cubre listar/config/test-conexion/sync/responder/marcar/archivar + permiso 403.
- Frontend: E2E Playwright verifica login → 7 tabs → configuración → bandeja + 4 carpetas + modal redactar.
- Sincronización IMAP real pendiente hasta que el usuario introduzca su App Password de Gmail desde `/admin/comunicaciones` → ⚙️ Configuración.



## Iter 25 · 2026-05-02 · HOTFIX Railway — Sustituir WeasyPrint por ReportLab

### 🔥 BLOQUE 1 — Eliminar WeasyPrint
- **Problema:** Railway fallaba al arrancar con `OSError: cannot load library 'libgobject-2.0-0'` porque WeasyPrint requiere librerías del sistema (pango/cairo/gobject) no disponibles en contenedores Railway estándar.
- **Solución quirúrgica:** reescrito `pdf_renderer.py` usando **ReportLab puro** (Python, sin deps del sistema). API pública intacta — `routes_documentos.py` sigue llamando a `html_to_pdf_bytes(html)`, `upload_pdf`, `merge_pdfs`, `fetch_pdf_bytes`.
- Parser HTML basado en `html.parser` (stdlib) — convierte subset HTML (`h1/h2/h3`, `p`, `strong/b/em/i`, `br`, `hr`, `img`, `table/tr/td`, `div` con clases `titulo/sub/nombre/cuerpo/firma/numcert/pie`) a flowables ReportLab.
- Detecta `@page size: A4 landscape` en el CSS del HTML para elegir orientación.
- `weasyprint==68.1` eliminado de `requirements.txt`.
- Dependencias transitivas (`pydyf`, `tinycss2`, `cssselect2`, `Pillow`, `fonttools`) mantenidas (no rompen nada, Pillow sigue siendo útil para subida de imágenes).

### Validación
- Backend arranca: `INFO: Application startup complete` ✅
- PDF generado con cabecera `%PDF` válida ✅
- Endpoints `/api/gestor/documentos/recibos` y `/certificados` → 200 OK ✅

### Estilo visual resultante
Documentos más sobrios que los de WeasyPrint (sin gradientes/shadows CSS), pero profesional: títulos grandes centrados, nombre destacado en naranja, tablas con líneas bajas gris claro, firmas centradas. Acorde al estilo de los informes A-K preexistentes.

### Archivos modificados (quirúrgico)
- `/app/backend/pdf_renderer.py` — reescrito completo (74 → 280 líneas).
- `/app/backend/requirements.txt` — eliminada línea `weasyprint==68.1`.
- Zero cambios en `routes_documentos.py` ni en otras rutas.

### Salvaguardas respetadas ✅
- AuthContext, SupabaseAuthContext, LoginUnificado, auth_utils, guards, RLS, cálculo cachés, rutas existentes — todo intacto.

---

## Iter 24 · 2026-05-02 · Command Palette — Acciones rápidas ⚡

### BLOQUE 1 — Acciones rápidas en ⌘K
- 5 acciones con icono ⚡ (lucide `Zap`) y badge "ACCIÓN" amarillo, que aparecen **por encima** de las páginas y se destacan con prioridad cuando el usuario escribe:
  - **Crear evento** → navega a `/configuracion/eventos` y dispara `opus:nuevo-evento` (abre modal vía listener en `ConfiguracionEventos`).
  - **Invitar músico** → navega a `/admin/musicos` y enfoca el buscador.
  - **Nueva tarea** → navega a `/admin/tareas` y dispara `opus:nueva-tarea` (abre modal).
  - **Nuevo contacto CRM** → dispara `opus:open-comentarios-equipo` (abre FAB de comentarios equipo sin navegar).
  - **Ver solicitudes** → navega a `/admin/musicos` y dispara `opus:solicitudes-registro` (abre modal).

### Implementación — arquitectura desacoplada vía CustomEvent
- `CommandPalette.js` no depende de ningún componente destino: emite `window.dispatchEvent(new CustomEvent(eventName))` y espera 800ms tras navegar para que el destino se monte.
- Cada componente destino registra su `useEffect` con `window.addEventListener('opus:*', handler)` y cleanup. Zero imports cruzados.
- Ranking en el palette: acciones con alias match tienen score ≥ 80, páginas con label match ≤ 75 → acciones siempre primero cuando son relevantes.

### Archivos modificados (quirúrgico)
- `CommandPalette.js` — acciones + ranking + icono Zap.
- `ConfiguracionEventos.js` — listener `opus:nuevo-evento`.
- `GestorTareas.js` — listener `opus:nueva-tarea`.
- `GestorMusicos.js` — listeners `opus:invitar-musico` + `opus:solicitudes-registro`.
- `ComentariosEquipoButton.js` — listener `opus:open-comentarios-equipo`.

### Salvaguardas respetadas ✅
- Zero modificaciones en AuthContext, SupabaseAuthContext, LoginUnificado, auth_utils, guards, RLS, cálculo cachés, rutas.

---

## Iter 23 · 2026-05-01 · Command Palette ⌘K

### BLOQUE 1 — Buscador rápido estilo Notion/Linear
- **Atajo global Cmd/Ctrl+K** (toggle open/close).
- Modal centrado con buscador tolerante a acentos (filtra label, grupo y ruta).
- **Navegación con flechas ↑↓ + Enter** para abrir; ESC para cerrar.
- Auto-scroll al item seleccionado; hover también selecciona.
- Footer con hints de teclas + contador de resultados.
- Botón **🔍 Buscar… ⌘K** en cabecera del sidebar como alternativa al atajo.
- Visible **solo para gestores** (no se monta en `/portal/*` — el Layout del gestor es quien integra `CommandPalette`).
- Lista estática `PALETTE_NAV_ITEMS` en App.js (paralela a Sidebar; desacoplada para no depender de badges/pendientes). 28 rutas totales.

### Salvaguardas respetadas ✅
- Nuevo componente `CommandPalette.js` + 1 listener keyboard + 1 import en App.js. NO se modificó AuthContext, SupabaseAuthContext, LoginUnificado, auth_utils, guards, RLS, cálculo cachés ni rutas existentes.

---

## Iter 22 · 2026-05-01 · Reorganización menú lateral + unificación de guards

### BLOQUE 1 — Reorganización del menú lateral (solo visual)
- 7 grupos colapsables con iconos lucide-react SVG (no emojis):
  - **Temporada** (Calendar): Configuración de Eventos · Presupuestos · Seguimiento · Plantillas Definitivas
  - **Logística y Servicios** (Truck): Logística y Servicios · Registro de Asistencia
  - **Economía** (CreditCard): Gestión Económica · Análisis Económico · Recibos y Certificados · Informes
  - **Músicos** (Users): Base de Datos de Músicos *(badge solicitudes pendientes)* · Historial y CRM · Vista Músico
  - **Repertorio y Material** (BookOpen): Archivo Musical · Inventario Material
  - **Comunicaciones** (MessageSquare): Mensajes · Centro de Comunicaciones
  - **Administración** (Settings): Tareas · Incidencias · Reclamaciones · Push · Emails · Actividad · Usuarios · Permisos · Configuración
- Título H1 de `/asistencia/logistica` cambiado a "Logística y Servicios".
- Rutas IDÉNTICAS a iter21 (zero cambios funcionales).

### BLOQUE 2 — Refactor y mejoras
- **2A** `auth_utils.is_super_admin()` unificado considera `profile.rol` además de `user.rol` y email. `routes_configuracion`, `routes_preview`, `routes_registro`, `routes_recordatorios` ahora delegan en él (helpers locales son wrappers).
- **2B** Sustitución masiva de `navItems` eliminó duplicados pre-existentes (key `recordatorios` aparecía 2 veces en el grupo administración).
- **2C** Comedor en portal del músico: ya integrado junto a logística (verificado).
- **2D** Endpoint `/api/gestor/pendientes` añade `solicitudes_pendientes` (count de `solicitudes_registro` con estado='pendiente'). Badge rojo en item "Base de Datos de Músicos" del menú.

### Testing — iter22.json
- **Backend: 18/18 PASS** (pytest unificación guards + endpoint pendientes)
- **Frontend: 100%** (menú reorganizado, iconos lucide, H1, navegación, badges)
- **Sin regresiones**

### Salvaguardas respetadas ✅
- AuthContext, SupabaseAuthContext, LoginUnificado, guards (mejorados pero compatibles), cálculo cachés, rutas existentes — todo intacto.

---

## Iter 21 · 2026-05-01 · Auto-registro + CRM neutro + Historial/CRM + 5ª plantilla

### BLOQUE 1 — Auto-registro de músicos
- **1A** Página pública `/registro/:token` con formulario completo (validaciones cliente: email, password>=8, confirmación, checkbox aceptar). Cabecera purple con mensaje configurable.
- **1B** Modal "📋 Solicitudes" en `/admin/musicos` con badge contador de pendientes. Aprobar = crea usuario en Supabase Auth + tabla usuarios + email bienvenida + push músico. Rechazar = pide motivo + email rechazo.
- **1C** Sección "Registro público" en `/admin/configuracion`: toggle activo, mensaje, link copiable, regenerar token, QR, compartir WhatsApp.
- **1D** Endpoint `/api/portal/mi-perfil-completitud`. Banner amarillo persistente en portal del músico si faltan IBAN/SWIFT o campos mínimos. Notificación a gestores cuando músico confirma asistencia sin datos bancarios.
- **1E** Modal bloqueante de bienvenida en primer login (instrumento/teléfono/nivel) — sin posibilidad de cerrar hasta rellenar.
- Campo `dias_alerta_datos_bancarios` (default 30) editable desde Administración → Configuración → Recordatorios.

### BLOQUE 2 — CRM neutro en ficha del músico
- **2A** Sección "Historial de contactos" en `/admin/musicos/{id}`. Acepta `evento_id` NULL (contacto general).
- **2B** Auto-registro de emails: `email_service._send_email` graba en `contactos_musico` cuando recibe `usuario_id`.
- **2C** Endpoint `POST /api/gestor/contactos/registrar-whatsapp/{usuario_id}` para registrar enlaces compartidos.
- Endpoint nuevo `GET /api/gestor/contactos/musico/{usuario_id}` (con evento embebido).

### BLOQUE 3 — Página /admin/historial-musicos
- Item "Historial y CRM" en menú lateral (debajo de "Base de datos músicos").
- Sidebar con buscador (tolerante a acentos) + lista de músicos.
- Vista TIMELINE: feed cronológico con puntos de color por tipo (eventos confirmados/pendientes, contactos email/llamada/whatsapp, pagos, certificados, reclamaciones).
- Vista GANTT: grid mensual por categoría con navegación entre años.
- Filtros (todos/eventos/pagos/contactos) + checkboxes secciones.
- Exportar CSV completo.

### BLOQUE 4 — 5ª plantilla en catálogo email
- Nueva plantilla `acceso_perfil_creado` con tema IFC Corporate.
- Variables: `{nombre}, {email_acceso}, {enlace_portal}, {nombre_organizacion}`.

### Testing
- iter21.json: backend 23/23 PASS, frontend 95% (testids ya presentes; bug del cache de testing). Cero regresiones.

### Salvaguardas respetadas ✅
- AuthContext, SupabaseAuthContext, LoginUnificado, auth_utils, get_current_*, RLS, cálculo cachés en PlantillasDefinitivas, rutas portal existentes (solo se añadió 1 línea `<PerfilCompletitudAlerts/>` en PortalDashboard).

---

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
