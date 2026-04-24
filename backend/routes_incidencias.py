"""
Incidencias / Feedback — API de gestor.
Endpoints extraídos de routes_gestor.py durante el refactor de feb 2026.
"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api/gestor", tags=["incidencias"])


class IncidenciaCreate(BaseModel):
    tipo: str  # 'incidencia' | 'mejora' | 'pregunta'
    descripcion: str
    pagina: Optional[str] = None
    screenshot_url: Optional[str] = None


class IncidenciaUpdate(BaseModel):
    estado: Optional[str] = None
    respuesta: Optional[str] = None


@router.post("/incidencias")
async def create_incidencia(data: IncidenciaCreate, current_user: dict = Depends(get_current_gestor)):
    try:
        payload = data.model_dump(exclude_none=True)
        uid = current_user.get('id')
        # Comprobar que el usuario existe en public.usuarios; si no, guardamos NULL
        # (la FK es ON DELETE SET NULL y usuario_nombre preserva la identidad).
        usuario_id_valido = None
        if uid:
            exists = supabase.table('usuarios').select('id').eq('id', uid).limit(1).execute()
            if exists.data:
                usuario_id_valido = uid
        payload['usuario_id'] = usuario_id_valido
        nombre_full = f"{current_user.get('apellidos','')}, {current_user.get('nombre','')}".strip(', ')
        if not nombre_full:
            nombre_full = current_user.get('email') or 'Usuario desconocido'
        payload['usuario_nombre'] = nombre_full
        r = supabase.table('incidencias').insert(payload).execute()
        return {"incidencia": r.data[0] if r.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear incidencia: {str(e)}")


@router.get("/incidencias")
async def list_incidencias(
    estado: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    try:
        q = supabase.table('incidencias').select('*')
        if estado:
            q = q.eq('estado', estado)
        r = q.order('created_at', desc=True).execute()
        return {"incidencias": r.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar incidencias: {str(e)}")


@router.put("/incidencias/{inc_id}")
async def update_incidencia(inc_id: str, data: IncidenciaUpdate, current_user: dict = Depends(get_current_gestor)):
    try:
        payload = data.model_dump(exclude_none=True)
        payload['updated_at'] = datetime.now().isoformat()
        r = supabase.table('incidencias').update(payload).eq('id', inc_id).execute()
        return {"incidencia": r.data[0] if r.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar incidencia: {str(e)}")


@router.delete("/incidencias/{inc_id}")
async def delete_incidencia(inc_id: str, current_user: dict = Depends(get_current_gestor)):
    try:
        supabase.table('incidencias').delete().eq('id', inc_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar incidencia: {str(e)}")
