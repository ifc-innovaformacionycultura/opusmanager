# 🔄 Endpoint de Sincronización de Perfiles

## Descripción

El endpoint `/api/auth/sync-profile` sincroniza automáticamente usuarios de Supabase Auth con la tabla `usuarios` de PostgreSQL.

## Problema que Resuelve

Cuando un usuario existe en `auth.users` (Supabase Auth) pero NO tiene un registro correspondiente en la tabla `usuarios`, el endpoint `/api/auth/me` devuelve 404 y el usuario no puede acceder a la aplicación.

## Solución Automática

El contexto `SupabaseAuthContext` ahora detecta automáticamente este problema y llama a `/sync-profile` para crear el perfil faltante.

## Uso Manual

### Desde el Frontend (si es necesario)

```javascript
const syncProfile = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${API_URL}/auth/sync-profile`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });
  
  const result = await response.json();
  console.log(result);
  // { message: "Perfil creado exitosamente", profile: {...}, synced: true }
};
```

### Desde Backend (curl)

```bash
# 1. Login para obtener token
TOKEN=$(curl -s -X POST "https://your-url.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' | \
  jq -r '.access_token')

# 2. Sincronizar perfil
curl -X POST "https://your-url.com/api/auth/sync-profile" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Respuestas

### Perfil creado exitosamente
```json
{
  "message": "Perfil creado exitosamente",
  "profile": {
    "id": "uuid",
    "user_id": "uuid",
    "email": "user@example.com",
    "nombre": "Nombre",
    "apellidos": "Apellidos",
    "rol": "musico",
    "estado": "activo"
  },
  "synced": true
}
```

### Perfil ya existe
```json
{
  "message": "Perfil ya existe",
  "profile": { ... },
  "synced": false
}
```

## Flujo Automático

1. Usuario hace login con Supabase Auth ✅
2. `SupabaseAuthContext` llama a `/api/auth/me` 
3. Si recibe 404 (perfil no existe):
   - Automáticamente llama a `/api/auth/sync-profile` 🔄
   - Crea el perfil en la tabla `usuarios`
   - Vuelve a intentar `/api/auth/me`
   - Usuario puede acceder normalmente ✅

## SQL Manual (Alternativa)

Si prefieres crear el perfil manualmente en Supabase:

```sql
INSERT INTO usuarios (user_id, email, nombre, apellidos, rol, estado, fecha_alta)
SELECT id, email, 'Nombre', 'Apellidos', 'musico', 'activo', NOW()
FROM auth.users 
WHERE email = 'usuario@ejemplo.com'
ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id;
```

## Notas Importantes

- El endpoint requiere autenticación (Bearer token)
- El rol se obtiene de `app_metadata.rol` o por defecto es `'musico'`
- Si el usuario ya tiene perfil, no se duplica
- Los datos se obtienen de `user_metadata` de Supabase Auth
