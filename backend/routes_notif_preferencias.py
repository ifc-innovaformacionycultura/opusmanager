"""Preferencias de notificaciones push por usuario.

Endpoints:
- GET  /api/auth/me/notif-preferencias    (gestores: JWT backend)
- PUT  /api/auth/me/notif-preferencias    (gestores)
- GET  /api/portal/perfil/notif-preferencias (músicos: Supabase JWT)
- PUT  /api/portal/perfil/notif-preferencias (músicos)

Helper público `should_send_push(usuario_id, tipo)` consultado por `notify_push`.
"""
from typing import Optional, Dict
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_user, get_current_musico

router_gestor = APIRouter(prefix="/api/auth/me", tags=["notif_preferencias"])
router_portal = APIRouter(prefix="/api/portal/perfil", tags=["notif_preferencias_portal"])

# Defaults — todos los tipos activados
DEFAULT_PREFS = {
    "convocatorias": True,
    "tareas": True,
    "comentarios": True,
    "recordatorios": True,
    "reclamaciones": True,
    "verificaciones": True,
}

# Mapeo tipo (notify_push) → clave de preferencia. Tipos que NO mapean
# (incidencia, general) se consideran críticos y siempre se envían.
TIPO_TO_PREF = {
    "convocatoria": "convocatorias",
    "tarea": "tareas",
    "comentario": "comentarios",
    "recordatorio": "recordatorios",
    "reclamacion": "reclamaciones",
    "verificacion": "verificaciones",
}


class PrefsUpdate(BaseModel):
    convocatorias: Optional[bool] = None
    tareas: Optional[bool] = None
    comentarios: Optional[bool] = None
    recordatorios: Optional[bool] = None
    reclamaciones: Optional[bool] = None
    verificaciones: Optional[bool] = None


def _normalize(raw) -> Dict[str, bool]:
    """Mezcla raw con DEFAULT_PREFS — garantiza todas las claves presentes."""
    if not isinstance(raw, dict):
        raw = {}
    out = dict(DEFAULT_PREFS)
    for k, v in raw.items():
        if k in DEFAULT_PREFS:
            out[k] = bool(v)
    return out


def _get_prefs_db(usuario_id: str) -> Dict[str, bool]:
    try:
        r = supabase.table('usuarios').select('notif_preferencias') \
            .eq('id', usuario_id).single().execute()
        return _normalize(r.data.get('notif_preferencias') if r.data else None)
    except Exception:
        return dict(DEFAULT_PREFS)


def _put_prefs_db(usuario_id: str, partial: Dict[str, bool]) -> Dict[str, bool]:
    current = _get_prefs_db(usuario_id)
    merged = dict(current)
    for k, v in partial.items():
        if k in DEFAULT_PREFS and v is not None:
            merged[k] = bool(v)
    try:
        supabase.table('usuarios').update({"notif_preferencias": merged}) \
            .eq('id', usuario_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar preferencias: {str(e)}")
    return merged


# ============ Endpoints Gestor ============

@router_gestor.get("/notif-preferencias")
async def get_prefs_gestor(current_user: dict = Depends(get_current_user)):
    profile = current_user.get('profile') or {}
    return {"preferencias": _get_prefs_db(profile.get('id'))}


@router_gestor.put("/notif-preferencias")
async def put_prefs_gestor(data: PrefsUpdate, current_user: dict = Depends(get_current_user)):
    profile = current_user.get('profile') or {}
    return {"preferencias": _put_prefs_db(profile.get('id'), data.model_dump(exclude_none=True))}


# ============ Endpoints Músico (portal) ============

@router_portal.get("/notif-preferencias")
async def get_prefs_musico(current_user: dict = Depends(get_current_musico)):
    profile = current_user.get('profile') or {}
    return {"preferencias": _get_prefs_db(profile.get('id'))}


@router_portal.put("/notif-preferencias")
async def put_prefs_musico(data: PrefsUpdate, current_user: dict = Depends(get_current_musico)):
    profile = current_user.get('profile') or {}
    return {"preferencias": _put_prefs_db(profile.get('id'), data.model_dump(exclude_none=True))}


# ============ Helper público ============

def should_send_push(usuario_id: str, tipo: Optional[str]) -> bool:
    """True si el usuario debe recibir un push de este tipo según sus preferencias.

    Tipos críticos (incidencia, general) siempre devuelven True.
    """
    if not usuario_id:
        return False
    if not tipo:
        return True
    pref_key = TIPO_TO_PREF.get(tipo)
    if not pref_key:
        return True  # Tipo crítico → siempre se envía
    prefs = _get_prefs_db(usuario_id)
    return bool(prefs.get(pref_key, True))
