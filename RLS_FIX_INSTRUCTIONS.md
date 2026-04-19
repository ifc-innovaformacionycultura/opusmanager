# Políticas RLS sin Recursión - OPUS MANAGER

## Problema Resuelto
Las políticas RLS anteriores causaban recursión infinita porque la función `is_gestor()` consultaba la tabla `usuarios` para verificar el rol, pero esa misma consulta activaba las políticas RLS que a su vez llamaban a `is_gestor()`.

## Solución
Almacenar el rol en `app_metadata` del usuario de Supabase Auth y leer directamente desde el JWT usando `auth.jwt()`. Esto elimina completamente la necesidad de consultar la tabla `usuarios` para verificar roles.

## Instrucciones de Aplicación

### PASO 1: Ejecutar SQL en Supabase
Ve a Supabase Dashboard → SQL Editor → New Query

Copia y pega TODO el contenido del archivo:
`/app/supabase_rls_policies_fixed.sql`

Click en "Run" o presiona Ctrl+Enter

### PASO 2: Verificar Resultado
Deberías ver:
```
Success. No rows returned
```

Y al final del script, deberías ver una tabla con todas las políticas activas.

### PASO 3: Verificar que el admin tiene rol en app_metadata
Ejecuta este query de verificación:
```sql
SELECT id, email, raw_app_meta_data->>'rol' as rol
FROM auth.users
WHERE email = 'admin@convocatorias.com';
```

Deberías ver:
```
| id | email | rol |
|----|-------|-----|
| 88c9beb9... | admin@convocatorias.com | gestor |
```

## Cómo Funciona

### Antes (CON recursión ❌):
```
Usuario hace login
  ↓
Backend consulta: SELECT * FROM usuarios WHERE user_id = ...
  ↓
RLS policy se activa: is_gestor()
  ↓
is_gestor() consulta: SELECT rol FROM usuarios WHERE user_id = auth.uid()
  ↓
RLS policy se activa de nuevo: is_gestor()
  ↓
♾️ RECURSIÓN INFINITA
```

### Ahora (SIN recursión ✅):
```
Usuario hace login
  ↓
Supabase genera JWT con app_metadata: {rol: "gestor"}
  ↓
Backend consulta: SELECT * FROM usuarios WHERE user_id = ...
  ↓
RLS policy se activa: is_gestor()
  ↓
is_gestor() lee: auth.jwt() -> app_metadata -> rol
  ↓
✅ Retorna TRUE/FALSE sin consultar base de datos
```

## Cambios en el Backend

### 1. create_user_profile() actualizado
Ahora cuando se crea un usuario, se actualiza automáticamente `app_metadata`:
```python
supabase.auth.admin.update_user_by_id(
    user_id,
    {"app_metadata": {"rol": rol}}
)
```

### 2. signup() actualizado
Al registrar un nuevo gestor, el rol se guarda en `app_metadata` inmediatamente.

### 3. Usuario admin actualizado
El SQL incluye un UPDATE para agregar `{rol: "gestor"}` al admin existente.

## Beneficios

1. ✅ **Sin recursión**: Políticas RLS leen desde JWT, no desde tabla
2. ✅ **Más rápido**: No hay queries adicionales a la BD
3. ✅ **Más seguro**: El rol viene firmado en el JWT por Supabase
4. ✅ **Escalable**: Funciona con millones de usuarios sin problemas

## Testing

Después de aplicar el SQL, probar:

```bash
# 1. Login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@convocatorias.com","password":"Admin123!"}'

# 2. Get profile (debe funcionar sin error RLS)
curl -X GET http://localhost:8001/api/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

Deberías recibir el perfil completo sin errores de recursión.

## Próximos Pasos

Una vez aplicado el SQL y verificado:
1. Probar login desde frontend
2. Verificar redirect al dashboard
3. Completar Portal de Músicos
4. Probar Magic Link

## Troubleshooting

**Error: "function auth.jwt() does not exist"**
- Asegúrate de estar ejecutando el SQL en el proyecto correcto de Supabase
- Verifica que tienes permisos de administrador

**Error: "column raw_app_meta_data does not exist"**
- El nombre correcto de la columna puede variar. Prueba con `raw_app_metadata` (sin guión bajo)

**Admin sigue sin tener rol:**
- Verifica el UUID del admin en el SQL (línea del UPDATE)
- Asegúrate de que coincide con el usuario en auth.users
