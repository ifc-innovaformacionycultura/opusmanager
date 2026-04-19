# OPUS MANAGER - Estado Actual y Próximos Pasos

## ✅ COMPLETADO (Fase 1 y 2)

### 1. Login Unificado
- ✅ Página `/login` con toggle Gestor/Músico
- ✅ UI profesional verificada
- ✅ Supabase Auth integrado en componente

### 2. Backend Migrado a Supabase
- ✅ `server.py` completamente reescrito
- ✅ Tres routers creados:
  - `routes_auth.py` - Autenticación
  - `routes_portal.py` - Portal músicos
  - `routes_gestor.py` - Panel gestores
- ✅ 20+ endpoints CRUD completos
- ✅ Login con Supabase funciona (probado con curl)
- ✅ Token verification sin JWT Secret
- ✅ Admin migrado a Supabase Auth

### 3. Base de Datos
- ✅ Schema PostgreSQL aplicado (8 tablas)
- ✅ RLS policies documentadas en `/app/supabase_rls_policies.sql`

---

## ⚠️ BLOQUEADORES PENDIENTES

### 1. Frontend Auth Context (P0 - CRÍTICO)
**Problema:** El `App.js` tiene un `AuthContext` que usa el sistema legacy de MongoDB. Esto causa conflicto con el nuevo `LoginUnificado.js` que usa Supabase.

**Impacto:** El login desde `/login` no funciona porque App.js intenta validar con `/api/auth/me` del backend legacy en producción.

**Solución necesaria:**
1. Actualizar `App.js` para eliminar/reemplazar `AuthContext` legacy
2. Crear nuevo contexto que use Supabase Auth del frontend
3. Actualizar `ProtectedRoute` para verificar sesión Supabase
4. Actualizar todos los componentes que usan `useAuth()` hook

**Archivos a modificar:**
- `/app/frontend/src/App.js` (líneas 36-98: AuthContext)
- `/app/frontend/src/pages/LoginUnificado.js` (integrar con nuevo contexto)
- Todos los componentes que usan `const { user } = useAuth()`

---

### 2. Aplicar Políticas RLS (P0 - SEGURIDAD)
**Problema:** RLS está desactivado temporalmente para permitir desarrollo.

**Solución:**
1. Ejecutar el archivo `/app/supabase_rls_policies.sql` en Supabase SQL Editor
2. Verificar que no hay recursión infinita
3. Probar que backend puede consultar con service_role key

**Comando SQL:**
```sql
-- En Supabase Dashboard → SQL Editor, ejecutar:
-- Copiar y pegar todo el contenido de /app/supabase_rls_policies.sql
```

---

## 📋 PRÓXIMOS PASOS (Fase 3)

### Paso 1: Arreglar Frontend Auth (URGENTE)
**Estimación:** 30-45 minutos

**Tareas:**
1. Crear `SupabaseAuthContext` en nuevo archivo
2. Reemplazar `AuthProvider` en `App.js`
3. Actualizar `LoginUnificado.js` para usar el contexto
4. Actualizar `ProtectedRoute` para Supabase
5. Probar login end-to-end

**Testing:**
- Login de gestor → Dashboard
- Magic link de músico → Portal
- Logout y refresh token

---

### Paso 2: Completar Portal de Músicos
**Estimación:** 1-2 horas

**Componentes a crear/actualizar:**
1. `PortalDashboard.js` - Conectar con `/api/portal/mis-eventos`
2. Botones "Confirmar/Rechazar" asistencia
3. Lista de ensayos por evento
4. Lista de materiales descargables
5. Sección de disponibilidad

**Endpoints ya listos:**
- ✅ GET `/api/portal/mis-eventos`
- ✅ PUT `/api/portal/asignacion/{id}/confirmar`
- ✅ GET `/api/portal/evento/{id}/ensayos`
- ✅ GET `/api/portal/evento/{id}/materiales`

---

### Paso 3: Panel de Gestores (Actualizar Páginas Existentes)
**Estimación:** 2-3 horas

**Páginas a actualizar para usar Supabase:**
1. `ConfiguracionEventos.js` → Usar `/api/gestor/eventos`
2. `PlantillasDefinitivas.js` → Usar `/api/gestor/asignaciones`
3. `AsistenciaPagos.js` → Consultar Supabase directamente
4. Crear nueva página "Gestión de Músicos" → Usar `/api/gestor/musicos`

**Páginas que se pueden eliminar/deprecar:**
- `ConfiguracionBaseDatos.js` (ya no aplica con Supabase)
- `ConfiguracionPlantillas.js` (obsoleto)
- `SeguimientoConvocatorias.js` (reemplazar con gestión de eventos)

---

### Paso 4: Integraciones (Fase 4)
**Estimación:** 3-4 horas

#### 4.1 Gmail / Resend para Emails
**Uso:** Enviar credenciales a músicos invitados

**Decisión:** Usar **Resend** (más simple que Gmail API)
- Llamar `integration_playbook_expert_v2` con "Resend"
- Crear endpoint `/api/gestor/musicos/send-credentials`
- Templates de emails

#### 4.2 Google Drive API
**Uso:** Subir justificantes de músicos

**Tareas:**
- Llamar `integration_playbook_expert_v2` con "Google Drive"
- Crear endpoint `/api/portal/upload-justificante`
- Componente de subida de archivos en Portal

#### 4.3 Push Notifications
**Uso:** Notificar a músicos sobre nuevas asignaciones

**Opciones:**
- Web Push API (nativo)
- Firebase Cloud Messaging

**Decisión:** Web Push API (sin dependencias externas)

---

## 🔧 REFACTORIZACIÓN (Opcional - Fase 5)

### Backend
- Separar routers en `/app/backend/routes/`
- Crear modelos Pydantic en `/app/backend/models/`
- Crear servicios en `/app/backend/services/`
- Tests unitarios en `/app/backend/tests/`

### Frontend
- Separar contextos en `/app/frontend/src/contexts/`
- Crear hooks personalizados en `/app/frontend/src/hooks/`
- Componentes reutilizables en `/app/frontend/src/components/`

---

## 📝 NOTAS IMPORTANTES

### Credenciales de Prueba
Ver `/app/memory/test_credentials.md`

### Archivos Legacy (Backups)
- `/app/backend/server_mongodb_backup.py` - Backend original
- `/app/backend/server_legacy.py` - Copia de seguridad

### Archivos de Configuración
- `/app/backend/.env` - Variables de entorno backend
- `/app/frontend/.env` - Variables de entorno frontend
- `/app/supabase_schema.sql` - Schema original
- `/app/supabase_rls_policies.sql` - Políticas RLS seguras

---

## 🧪 TESTING CHECKLIST

### Backend (✅ Completado)
- ✅ POST `/api/auth/login` (gestor)
- ✅ GET `/api/auth/me` (con RLS desactivado)
- ⏳ Todos los endpoints con RLS activado

### Frontend (❌ Pendiente)
- ❌ Login desde `/login` → Dashboard
- ❌ Magic link → Portal
- ❌ Navegación entre páginas
- ❌ Logout

### End-to-End (❌ Pendiente)
- ❌ Crear evento → Asignar músico → Músico confirma → Ver en dashboard gestor
- ❌ Gestor invita músico → Músico recibe magic link → Accede al portal
- ❌ Músico sube justificante → Gestor lo ve

---

## 🚀 RECOMENDACIÓN DE CONTINUACIÓN

**Prioridad absoluta:**
1. Aplicar RLS policies (`supabase_rls_policies.sql`)
2. Arreglar Frontend Auth Context
3. Probar login end-to-end
4. Completar Portal de Músicos

**Tiempo estimado para MVP funcional:** 4-6 horas adicionales

**Alternativa rápida:** 
Si el tiempo es limitado, mantener RLS desactivado SOLO para desarrollo y activarlo antes de producción.
