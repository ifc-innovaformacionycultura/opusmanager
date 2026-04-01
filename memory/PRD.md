# Panel de Gestión de Convocatorias - PRD

## Problema Original
Sistema integral para la gestión de temporadas, eventos y comunicaciones musicales para orquestas/organizaciones musicales. Incluye:
- Dashboard principal con sidebar jerárquico multinivel (navegación tipo árbol)
- 5 secciones principales: Configuración de temporada, Seguimiento de convocatorias, Confirmación de plantillas, Asistencia y pagos, Informes
- Subpáginas de configuración con acordeones para eventos, tablas de instrumentación, mapeo de base de datos, plantillas de comunicación
- Sistema de seguimiento con DataGrid avanzado, códigos de color por disponibilidad
- Sistema de login

## Arquitectura
- **Frontend:** React + TailwindCSS
- **Backend:** FastAPI + MongoDB
- **Autenticación:** JWT con cookies httpOnly
- **Diseño:** Swiss & High-Contrast theme con tipografía Cabinet Grotesk + IBM Plex Sans

## User Personas
1. **Administrador de Orquesta:** Gestiona temporadas, eventos, contactos y comunicaciones
2. **Coordinador Musical:** Revisa disponibilidad de músicos, confirma plantillas

## Core Requirements (Static)
- [x] Sistema de autenticación con login/logout
- [x] Dashboard con estadísticas de temporada
- [x] Sidebar jerárquico multinivel con navegación expandible/colapsable
- [x] Configuración de eventos con acordeones (instrumentación, ensayos, programa)
- [x] Configuración de base de datos (mapeo de columnas de Google Sheets)
- [x] Plantillas de comunicación (email templates + matriz de activación)
- [x] Seguimiento de convocatorias con DataGrid avanzado
- [x] Panel de comunicaciones lateral
- [x] Códigos de color por disponibilidad (rojo 0-30%, naranja 31-60%, amarillo 61-80%, verde 81-100%)

## What's Been Implemented (Jan 2026)

### Fase 1 - MVP Completado
- ✅ Backend FastAPI con autenticación JWT
- ✅ MongoDB con modelos para: users, seasons, events, contacts, email_templates, event_responses, column_mapping, email_matrix
- ✅ Datos de ejemplo pre-cargados (temporada 2024-2025, 2 eventos, 5 contactos)
- ✅ Frontend React con:
  - Login page con imagen de fondo
  - Dashboard con estadísticas
  - Sidebar jerárquico con subniveles
  - Configuración de Eventos (acordeones con formularios completos)
  - Configuración de Base de Datos (mapeo de columnas)
  - Configuración de Plantillas (templates + matriz de activación)
  - Seguimiento de Convocatorias (DataGrid con filtros, porcentajes, panel de comunicaciones)

### Fase 2 - Módulos Económicos (Abr 2026)
- ✅ **Plantillas Definitivas:**
  - Tabla jerárquica multinivel (Eventos > Secciones instrumentales > Contactos)
  - Asignación de atriles (número, letra, comentarios)
  - Asistencia prevista vs real con códigos de color
  - Cálculo automático de cachés (previsto, real, extra)
  - Panel de comunicaciones integrado

- ✅ **Asistencia, Pagos y Bloque Económico:**
  - Todos los campos de Plantillas Definitivas
  - Bloque económico diferenciado (fondo azul): producción, transporte, otros gastos
  - Gestión documental: subida de justificantes (transporte, alojamiento, titulaciones)
  - Renombrado automático de archivos
  - Columna "Total a percibir" destacada (fondo verde)
  - Configuración de carpeta Google Drive

- ✅ **Análisis Económico:**
  - Resumen global de temporada
  - Tarjetas de métricas: previsto, real, extras, total general
  - Gráfico de barras: comparativa presupuestaria
  - Gráfico circular: distribución de gastos
  - Desglose por sección instrumental
  - Tabla detallada de contactos con IBAN
  - Exportación a Excel (CSV)
  - Exportación XML bancario

- ✅ **Generación de Informes:**
  - 5 tipos de informes corporativos:
    - A. Plantilla Definitiva (lista + plano de orquesta visual)
    - B. Informe Económico por Evento
    - C. Informe Estadístico de Asistencia
    - D. Informe de Configuración de Eventos
    - E. Informe Combinado "Todo en Uno"
  - Panel lateral de filtros (evento, secciones, fechas)
  - Previsualización antes de exportar
  - Exportación: PDF, Excel (CSV), XML
  - Envío por correo (simulado)
  - Botón "Generar todos los informes"
  - Cabecera corporativa con fecha/hora
  - Espacio para firmas (Dirección, Producción, Gerencia)

### Fase 3 - Administración (Abr 2026)
- ✅ **Gestión de Usuarios:**
  - CRUD completo de usuarios
  - 4 roles: Administrador, Gestor, Editor, Visor
  - Cambio de contraseña por admin
  - Envío de credenciales por email (simulado)
  - Activar/desactivar usuarios
  - Filtros por nombre, email y rol

- ✅ **Registro de Actividad (Auditoría):**
  - Log automático de todas las acciones del sistema
  - Tarjetas de estadísticas (24h, totales, usuarios activos)
  - Gráficos: acciones por tipo, actividad por usuario
  - Filtros: usuario, acción, entidad, rango de fechas
  - Tabla detallada con fecha/hora, usuario, acción, entidad
  - Modal de detalle completo con JSON de cambios
  - Exportación CSV
  - Paginación

### APIs Implementadas
- POST/GET /api/auth/login, logout, me, refresh
- GET/POST /api/seasons
- GET/POST/PUT/DELETE /api/events
- GET/POST/PUT /api/contacts
- GET/POST/PUT /api/email-templates
- GET/POST /api/event-responses
- GET/POST /api/column-mapping
- GET/POST /api/email-matrix

## Prioritized Backlog

### P0 - Crítico (Próxima iteración)
- [ ] Integración real con Google Sheets API
- [ ] Integración real con Gmail API para envío de emails

### P1 - Importante
- [ ] Persistencia de datos de asistencia real y cachés en MongoDB
- [ ] Subida real de documentos a Google Drive

### P2 - Nice to have
- [ ] Exportación de código a Google Apps Script
- [ ] Modo oscuro
- [ ] Notificaciones push
- [ ] Alertas de desviación presupuestaria

## Next Tasks
1. Usuario confirma si continuar con integraciones Google (Sheets/Gmail)
2. Implementar páginas placeholder restantes
3. Generar código equivalente en Google Apps Script cuando se complete el prototipo
