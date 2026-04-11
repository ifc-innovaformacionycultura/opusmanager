# 🚀 Guía de Despliegue en Cloudflare Pages - OPUS MANAGER

## ⚠️ PROBLEMA: Página en blanco al desplegar

Si después de desplegar en Cloudflare Pages ves un parpadeo y luego la página se queda en blanco, sigue estos pasos:

---

## ✅ SOLUCIÓN PASO A PASO

### 1️⃣ Verificar archivos de routing (YA INCLUIDOS)

Los siguientes archivos **ya están incluidos** en el proyecto y se desplegarán automáticamente:

- ✅ `/frontend/public/_redirects` → Configuración de SPA routing
- ✅ `/frontend/public/_routes.json` → Configuración adicional

**No necesitas hacer nada con estos archivos.**

---

### 2️⃣ Configurar Variables de Entorno en Cloudflare (CRÍTICO)

⚠️ **ESTE ES EL PASO MÁS IMPORTANTE**

1. **Ir a tu proyecto en Cloudflare Pages**
   - Abre [https://dash.cloudflare.com/](https://dash.cloudflare.com/)
   - Click en "Workers & Pages"
   - Selecciona tu proyecto

2. **Ir a Settings → Environment Variables**
   - Click en la pestaña "Settings"
   - Scroll hasta "Environment variables"
   - Click en "Add variable"

3. **Agregar la variable REACT_APP_BACKEND_URL**
   ```
   Variable name:  REACT_APP_BACKEND_URL
   Value:          https://TU-BACKEND-AQUI.com
   Environment:    Production ✓
   ```
   
   **⚠️ IMPORTANTE:**
   - Reemplaza `https://TU-BACKEND-AQUI.com` con la URL real de tu backend
   - **NO** incluyas `/api` al final
   - Ejemplo: `https://contact-conductor.preview.emergentagent.com`

4. **Guardar y Re-Deploy**
   - Click en "Save"
   - Ve a "Deployments"
   - Click en "View details" del último deployment
   - Click en "Retry deployment" o "Redeploy"

---

### 3️⃣ Verificar el Despliegue

Una vez desplegado:

1. **Abre tu sitio en Cloudflare**
2. **Abre la consola del navegador** (F12 → Console)
3. **Busca este mensaje:**
   ```
   🔧 Environment check: { BACKEND_URL: "https://...", API: "https://.../api", hasBackendUrl: true }
   ```

**✅ Si ves `hasBackendUrl: true`** → Todo está correcto

**❌ Si ves `hasBackendUrl: false` o `BACKEND_URL: ""`** → Las variables de entorno NO están configuradas

---

## 🔧 Troubleshooting

### Problema: Sigue apareciendo página en blanco

1. **Verifica que re-deployaste** después de agregar variables
   - Las variables solo se aplican a nuevos deploys
   - Haz "Retry deployment" en Cloudflare

2. **Verifica la consola del navegador** (F12)
   - ¿Aparecen errores en rojo?
   - Copia el error completo

3. **Verifica que el backend esté funcionando**
   - Abre `https://TU-BACKEND.com/api/events` en el navegador
   - ¿Devuelve JSON o un error?

4. **Verifica CORS en el backend**
   - El backend debe permitir requests desde tu dominio de Cloudflare
   - Agregar el dominio a la configuración CORS

---

## 📋 Checklist Final

Antes de marcar como resuelto, verifica:

- [ ] Archivo `_redirects` existe en `/frontend/public/`
- [ ] Variable `REACT_APP_BACKEND_URL` configurada en Cloudflare
- [ ] Re-deployment ejecutado después de agregar variables
- [ ] Consola muestra `hasBackendUrl: true`
- [ ] La página carga sin parpadeos ni blanco

---

## 🆘 Si nada funciona

Comparte en el chat:

1. **URL de tu sitio en Cloudflare**
2. **Screenshot de la consola del navegador** (F12 → Console)
3. **Screenshot de Environment Variables** en Cloudflare Settings
4. **Mensaje del log** `🔧 Environment check: {...}`

---

## 📚 Recursos Adicionales

- [Documentación Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [SPA Routing en Cloudflare](https://developers.cloudflare.com/pages/platform/serving-pages/#single-page-application-spa-rendering)
- [Variables de Entorno](https://developers.cloudflare.com/pages/platform/build-configuration#environment-variables)
