"""
OPUS MANAGER - Backend Server
Supabase Auth + PostgreSQL
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Import routers
from routes_auth import router as auth_router
from routes_portal import router as portal_router
from routes_gestor import router as gestor_router
from routes_incidencias import router as incidencias_router
from routes_tareas import router as tareas_router
from routes_economia import router as economia_router
from routes_mensajes import router as mensajes_router
from routes_archivo import router as archivo_router
from routes_comentarios_equipo import router as comentarios_equipo_router
from routes_inventario import router as inventario_router
from routes_montaje import router as montaje_router
from routes_informes import router as informes_router
from routes_verificaciones import router as verificaciones_router
from routes_dashboard import router as dashboard_router
from routes_crm_contactos import router as crm_contactos_router
from routes_invitaciones import router_gestor as invitaciones_gestor_router, router_portal as invitaciones_portal_router
from routes_push import router as push_router
from routes_notif_preferencias import router_gestor as notif_prefs_gestor_router, router_portal as notif_prefs_portal_router
from routes_recordatorios import router as recordatorios_router, init_scheduler, shutdown_scheduler
from routes_comunicaciones_plantillas import router as comunicaciones_plantillas_router
from routes_documentos import router as documentos_router
from routes_configuracion import router as configuracion_router
from routes_fichaje import router as fichaje_router

# ==================== App Configuration ====================

app = FastAPI(
    title="OPUS MANAGER API",
    description="Sistema de Gestión y Control de Plantillas Orquestales",
    version="2.0.0"
)

# CORS Configuration
raw_cors = os.environ.get("CORS_ORIGINS", "").strip()
cors_origins = [o.strip().rstrip("/") for o in raw_cors.split(",") if o.strip()]
cors_origin_regex = os.environ.get("CORS_ORIGIN_REGEX", "").strip() or r"https://.*\.vercel\.app"

# When no explicit origins are set, allow any origin safely (no credentials).
# When origins are set, enable credentials (required by Supabase cookie flows).
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ==================== Register Routers ====================

app.include_router(auth_router)      # /api/auth/*
app.include_router(portal_router)    # /api/portal/*
app.include_router(gestor_router)    # /api/gestor/*
app.include_router(incidencias_router)  # /api/gestor/incidencias/*
app.include_router(tareas_router)    # /api/gestor/tareas/*
app.include_router(economia_router)  # /api/gestor/{cachets-base,cachets-config,presupuestos}/*
app.include_router(mensajes_router)  # /api/gestor/mensajes/*
app.include_router(archivo_router)  # /api/gestor/archivo/*
app.include_router(comentarios_equipo_router)  # /api/gestor/comentarios-equipo/*
app.include_router(inventario_router)  # /api/gestor/inventario/*
app.include_router(montaje_router)  # /api/gestor/montaje/*, /espacios, /transporte-material
app.include_router(informes_router)  # /api/gestor/informes/*
app.include_router(verificaciones_router)  # /api/gestor/eventos/{id}/verificaciones/*
app.include_router(dashboard_router)  # /api/gestor/dashboard/resumen
app.include_router(crm_contactos_router)  # /api/gestor/contactos/*
app.include_router(invitaciones_gestor_router)  # /api/gestor/musicos/{id}/invitar
app.include_router(invitaciones_portal_router)  # /api/portal/activar/*
app.include_router(push_router)  # /api/push/*
app.include_router(notif_prefs_gestor_router)  # /api/auth/me/notif-preferencias
app.include_router(notif_prefs_portal_router)  # /api/portal/perfil/notif-preferencias
app.include_router(recordatorios_router)  # /api/admin/recordatorios/*
app.include_router(comunicaciones_plantillas_router)  # /api/comunicaciones/*
app.include_router(documentos_router)  # /api/gestor/documentos/* + /api/portal/mi-historial/(certificados|recibos)
app.include_router(configuracion_router)  # /api/admin/configuracion + /api/admin/fichaje-reglas
app.include_router(fichaje_router)  # /api/fichaje/* + /api/gestor/registro-asistencia

# ==================== Health Check ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint usado por el frontend cada 14 min para evitar cold start de Railway."""
    from datetime import datetime, timezone
    return {
        "status": "ok",
        "service": "OPUS MANAGER API",
        "version": "2.0.0",
        "database": "Supabase PostgreSQL",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "OPUS MANAGER API",
        "version": "2.0.0",
        "docs": "/docs"
    }

# ==================== Startup Event ====================

@app.on_event("startup")
async def startup_event():
    """Application startup"""
    print("=" * 60)
    print("🎵 OPUS MANAGER API - Starting...")
    print("=" * 60)
    print(f"📡 CORS allow_origins: {cors_origins or '(none — regex only)'}")
    print(f"📡 CORS allow_origin_regex: {cors_origin_regex}")
    print(f"🔐 Supabase URL: {os.environ.get('SUPABASE_URL', 'NOT SET')}")
    print(f"✅ Using Supabase Auth + PostgreSQL")
    # APScheduler — recordatorios diarios @ 09:00 Europe/Madrid
    try:
        init_scheduler()
    except Exception as e:
        print(f"⚠️ Scheduler no iniciado: {e}")
    print("=" * 60)

@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    try:
        shutdown_scheduler()
    except Exception:
        pass
    print("🛑 OPUS MANAGER API - Shutting down...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
