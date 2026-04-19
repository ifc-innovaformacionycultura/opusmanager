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

# ==================== App Configuration ====================

app = FastAPI(
    title="OPUS MANAGER API",
    description="Sistema de Gestión y Control de Plantillas Orquestales",
    version="2.0.0"
)

# CORS Configuration
cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Register Routers ====================

app.include_router(auth_router)      # /api/auth/*
app.include_router(portal_router)    # /api/portal/*
app.include_router(gestor_router)    # /api/gestor/*

# ==================== Health Check ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "OPUS MANAGER API",
        "version": "2.0.0",
        "database": "Supabase PostgreSQL"
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
    print(f"📡 CORS Origins: {cors_origins}")
    print(f"🔐 Supabase URL: {os.environ.get('SUPABASE_URL', 'NOT SET')}")
    print(f"✅ Using Supabase Auth + PostgreSQL")
    print("=" * 60)

@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    print("🛑 OPUS MANAGER API - Shutting down...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
