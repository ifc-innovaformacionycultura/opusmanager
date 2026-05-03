"""Preferencias de UI por usuario — almacenadas en usuarios.prefs_ui (JSONB).

Endpoints:
  GET /api/gestor/prefs-ui           → devuelve el objeto prefs_ui completo del usuario actual.
  PUT /api/gestor/prefs-ui           → merge parcial de claves (no pisa claves no enviadas).

Reutilizable por gestor y músico (requiere autenticación mediante get_current_user).
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth_utils import get_current_user
from supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gestor/prefs-ui", tags=["prefs-ui"])


class PrefsUIUpdate(BaseModel):
    prefs: Dict[str, Any]


def _get_user_id(current_user: dict) -> str:
    profile = current_user.get("profile") or {}
    uid = profile.get("id")
    if not uid:
        raise HTTPException(status_code=400, detail="Usuario no identificado")
    return uid


@router.get("")
async def get_prefs_ui(current_user: dict = Depends(get_current_user)):
    uid = _get_user_id(current_user)
    try:
        r = supabase.table("usuarios").select("prefs_ui").eq("id", uid).limit(1).execute()
        rows = r.data or []
        prefs = (rows[0].get("prefs_ui") if rows else None) or {}
        return {"prefs": prefs}
    except Exception as e:
        logger.error(f"get_prefs_ui: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("")
async def update_prefs_ui(
    payload: PrefsUIUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Merge parcial: las claves enviadas en payload.prefs se actualizan;
    las no enviadas se mantienen intactas. Para borrar una clave, envíala con null.
    """
    uid = _get_user_id(current_user)
    try:
        # Lee-merge-escribe (un solo roundtrip extra; seguro ante concurrencia moderada)
        r = supabase.table("usuarios").select("prefs_ui").eq("id", uid).limit(1).execute()
        rows = r.data or []
        current = (rows[0].get("prefs_ui") if rows else None) or {}
        if not isinstance(current, dict):
            current = {}
        # Merge a nivel superior (1 nivel). Para borrar: cliente envía value=null.
        merged = {**current}
        for k, v in (payload.prefs or {}).items():
            if v is None:
                merged.pop(k, None)
            else:
                merged[k] = v
        supabase.table("usuarios").update({"prefs_ui": merged}).eq("id", uid).execute()
        return {"ok": True, "prefs": merged}
    except Exception as e:
        logger.error(f"update_prefs_ui: {e}")
        raise HTTPException(status_code=500, detail=str(e))
