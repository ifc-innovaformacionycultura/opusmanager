"""Endpoints de configuración global (Bloque 1) + reglas de fichaje globales (Bloque 2A)."""
from __future__ import annotations
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import os

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor, get_current_user
from config_app import get_config, invalidate_config, get_fichaje_global, invalidate_fichaje_global

router = APIRouter(prefix="/api", tags=["configuracion"])

BUCKET = "configuracion"


def _is_admin_or_director(user: dict) -> bool:
    rol = (user or {}).get("rol") or ((user or {}).get("profile") or {}).get("rol")
    if rol in ("admin", "director_general"):
        return True
    # El admin histórico de la plataforma se identifica por email (rol real = 'gestor' en BD).
    email = ((user or {}).get("email") or ((user or {}).get("profile") or {}).get("email") or "").lower()
    return email == "admin@convocatorias.com"


# =============================================================================
# Configuracion organizacion
# =============================================================================
class ConfigUpdate(BaseModel):
    org_nombre: Optional[str] = None
    org_cif: Optional[str] = None
    org_direccion: Optional[str] = None
    org_telefono: Optional[str] = None
    org_email: Optional[str] = None
    org_web: Optional[str] = None
    director_nombre: Optional[str] = None
    director_cargo: Optional[str] = None
    director_firma_url: Optional[str] = None
    irpf_porcentaje: Optional[float] = None
    logo_url: Optional[str] = None
    logo_secundario_url: Optional[str] = None
    color_primario: Optional[str] = None
    color_secundario: Optional[str] = None


@router.get("/admin/configuracion")
async def obtener_configuracion(current_user: dict = Depends(get_current_user)):
    """Lectura abierta a cualquier user autenticado (para que el frontend conozca colores/logo).
    El frontend decidirá si muestra modo solo-lectura o editable.
    """
    cfg = get_config(force=True)
    return {"configuracion": cfg, "editable": _is_admin_or_director(current_user)}


@router.put("/admin/configuracion")
async def actualizar_configuracion(data: ConfigUpdate, current_user: dict = Depends(get_current_gestor)):
    if not _is_admin_or_director(current_user):
        raise HTTPException(status_code=403, detail="Solo admin o director general pueden modificar la configuración")
    cfg = get_config(force=True)
    if not cfg or not cfg.get("id"):
        raise HTTPException(status_code=500, detail="No existe fila inicial en configuracion_app")
    payload = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None or k in {"director_firma_url", "logo_url", "logo_secundario_url"}}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = supabase.table("configuracion_app").update(payload).eq("id", cfg["id"]).execute()
    invalidate_config()
    return {"ok": True, "configuracion": (r.data or [None])[0]}


# ----- Subidas a Storage -----------------------------------------------------
async def _upload_imagen(file: UploadFile, prefix: str) -> str:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagen demasiado grande (máx 10 MB)")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() or "png"
    if ext not in {"png", "jpg", "jpeg", "webp", "svg"}:
        ext = "png"
    path = f"{prefix}-{int(datetime.now().timestamp())}.{ext}"
    try:
        supabase.storage.from_(BUCKET).upload(path, data, file_options={"content-type": file.content_type, "upsert": "true"})
    except Exception:
        try:
            supabase.storage.from_(BUCKET).remove([path])
        except Exception:
            pass
        supabase.storage.from_(BUCKET).upload(path, data, file_options={"content-type": file.content_type})
    url = supabase.storage.from_(BUCKET).get_public_url(path)
    if isinstance(url, str):
        return url.split("?")[0]
    return url


def _persist(field: str, url: str):
    cfg = get_config(force=True)
    supabase.table("configuracion_app").update({field: url, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", cfg["id"]).execute()
    invalidate_config()


@router.post("/admin/configuracion/logo")
async def subir_logo(file: UploadFile = File(...), secundario: bool = False, current_user: dict = Depends(get_current_gestor)):
    if not _is_admin_or_director(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")
    url = await _upload_imagen(file, "logo-secundario" if secundario else "logo-principal")
    _persist("logo_secundario_url" if secundario else "logo_url", url)
    return {"ok": True, "url": url, "secundario": secundario}


@router.post("/admin/configuracion/firma")
async def subir_firma(file: UploadFile = File(...), current_user: dict = Depends(get_current_gestor)):
    if not _is_admin_or_director(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")
    url = await _upload_imagen(file, "firma-director")
    _persist("director_firma_url", url)
    return {"ok": True, "url": url}


# =============================================================================
# Reglas de fichaje globales (Bloque 2A)
# =============================================================================
class FichajeReglasUpdate(BaseModel):
    minutos_antes_apertura: Optional[int] = None
    minutos_despues_cierre: Optional[int] = None
    minutos_retraso_aviso: Optional[int] = None
    computa_tiempo_extra: Optional[bool] = None
    computa_mas_alla_fin: Optional[bool] = None


@router.get("/admin/fichaje-reglas")
async def obtener_reglas_fichaje(current_user: dict = Depends(get_current_user)):
    return {"reglas": get_fichaje_global(force=True)}


@router.put("/admin/fichaje-reglas")
async def actualizar_reglas_fichaje(data: FichajeReglasUpdate, current_user: dict = Depends(get_current_gestor)):
    if not _is_admin_or_director(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")
    payload = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()

    existing = supabase.table("fichaje_config").select("id").eq("es_configuracion_global", True).limit(1).execute().data or []
    if existing:
        supabase.table("fichaje_config").update(payload).eq("id", existing[0]["id"]).execute()
    else:
        payload["es_configuracion_global"] = True
        supabase.table("fichaje_config").insert(payload).execute()
    invalidate_fichaje_global()
    return {"ok": True, "reglas": get_fichaje_global(force=True)}


@router.post("/admin/fichaje-reglas/precargar")
async def precargar_reglas(current_user: dict = Depends(get_current_gestor)):
    """Copia las reglas globales a una fila por ensayo (sólo si no existe ya)."""
    if not _is_admin_or_director(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")
    g = get_fichaje_global(force=True)
    base = {
        "minutos_antes_apertura": g.get("minutos_antes_apertura", 30),
        "minutos_despues_cierre": g.get("minutos_despues_cierre", 30),
        "minutos_retraso_aviso": g.get("minutos_retraso_aviso", 5),
        "computa_tiempo_extra": bool(g.get("computa_tiempo_extra", False)),
        "computa_mas_alla_fin": bool(g.get("computa_mas_alla_fin", False)),
        "es_configuracion_global": False,
    }
    ensayos = supabase.table("ensayos").select("id,evento_id").execute().data or []
    existing = supabase.table("fichaje_config").select("ensayo_id").not_.is_("ensayo_id", "null").execute().data or []
    ya_tienen = {e["ensayo_id"] for e in existing}
    creados = 0
    for e in ensayos:
        if e["id"] in ya_tienen:
            continue
        try:
            supabase.table("fichaje_config").insert({**base, "ensayo_id": e["id"], "evento_id": e.get("evento_id")}).execute()
            creados += 1
        except Exception:
            pass
    return {"ok": True, "creados": creados, "total_ensayos": len(ensayos)}
