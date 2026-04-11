# ⚠️ IMPORTANTE: Variables de Entorno para Cloudflare Pages

Cuando despliegues en Cloudflare Pages, debes configurar estas variables de entorno en el dashboard de Cloudflare:

## Variables Requeridas:

### REACT_APP_BACKEND_URL
**Valor:** La URL de tu backend desplegado (por ejemplo: `https://tu-backend.com`)
**Descripción:** URL del servidor backend de la aplicación

## Cómo configurar en Cloudflare Pages:

1. Ve a tu proyecto en Cloudflare Pages
2. Click en "Settings" → "Environment variables"
3. Agrega la variable:
   - **Variable name:** `REACT_APP_BACKEND_URL`
   - **Value:** URL de tu backend (sin `/api` al final)
   - **Environment:** Production (y Preview si lo deseas)
4. Click en "Save"
5. Haz un nuevo deploy (re-deploy) para que tome las variables

## Verificación:

Después del deploy, abre la consola del navegador (F12) y busca:
```
🔧 Environment check: { BACKEND_URL: "https://...", ... }
```

Si ves `BACKEND_URL: ""` o `undefined`, las variables no están configuradas correctamente.

## Troubleshooting Página en Blanco:

1. **Verifica las variables de entorno** están configuradas
2. **Abre la consola** del navegador (F12) y busca errores
3. **Verifica el archivo `_redirects`** existe en `/public`
4. **Re-deploy** después de cambiar variables de entorno

## Archivos importantes para Cloudflare:

- `/public/_redirects` → Maneja el routing de React
- `/public/_routes.json` → Configuración adicional de rutas
- Variables de entorno → Configuradas en Cloudflare dashboard
