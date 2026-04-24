"""
Incidencias / Feedback — API.
Acepta reportes desde gestor y portal del músico.
"""
from typing import Optional, Literal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor, get_current_user

router = APIRouter(prefix="/api", tags=["incidencias"])


class IncidenciaCreate(BaseModel):
    tipo: Literal['incidencia', 'mejora', 'pregunta']
    descripcion: str
    pagina: Optional[str] = None
    screenshot_url: Optional[str] = None
    prioridad: Optional[Literal['alta', 'media', 'baja']] = 'media'


class IncidenciaUpdate(BaseModel):
    estado: Optional[str] = None
    respuesta: Optional[str] = None
    prioridad: Optional[Literal['alta', 'media', 'baja']] = None


def _crear_incidencia_y_notificar(payload: dict, current_user: dict) -> dict:
    """Inserta la incidencia + notifica al admin gestor (si es distinto del autor)."""
    uid = current_user.get('id')
    usuario_id_valido = None
    if uid:
        exists = supabase.table('usuarios').select('id').eq('id', uid).limit(1).execute()
        if exists.data:
            usuario_id_valido = uid
    payload['usuario_id'] = usuario_id_valido
    nombre_full = f"{current_user.get('apellidos','') or ''}, {current_user.get('nombre','') or ''}".strip(', ')
    if not nombre_full:
        nombre_full = current_user.get('email') or 'Usuario desconocido'
    payload['usuario_nombre'] = nombre_full
    if not payload.get('prioridad'):
        payload['prioridad'] = 'media'

    r = supabase.table('incidencias').insert(payload).execute()
    incidencia = r.data[0] if r.data else None

    # Notificar al admin gestor
    try:
        admin_q = supabase.table('usuarios').select('id') \
            .eq('email', 'admin@convocatorias.com') \
            .eq('rol', 'gestor').limit(1).execute()
        admin = admin_q.data[0] if admin_q.data else None
        if admin and admin['id'] != usuario_id_valido and incidencia:
            supabase.table('notificaciones_gestor').insert({
                "usuario_id": admin['id'],
                "tipo": "incidencia_nueva",
                "titulo": f"Nueva {payload.get('tipo','incidencia')}",
                "mensaje": f"{nombre_full}: {(payload.get('descripcion') or '')[:90]}",
                "link": f"/admin/incidencias?id={incidencia.get('id')}",
            }).execute()
    except Exception:
        pass  # Si falla la notificación, no rompemos el flujo

    return incidencia


@router.post("/gestor/incidencias")
async def create_incidencia_gestor(data: IncidenciaCreate, current_user: dict = Depends(get_current_gestor)):
    try:
        incidencia = _crear_incidencia_y_notificar(data.model_dump(exclude_none=True), current_user)
        return {"incidencia": incidencia}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear incidencia: {str(e)}")


@router.post("/portal/incidencias")
async def create_incidencia_portal(data: IncidenciaCreate, current_user: dict = Depends(get_current_user)):
    """Mismo flujo que el gestor pero accesible desde el portal del músico."""
    try:
        merged = {
            'id': current_user.get('id') or (current_user.get('profile') or {}).get('id'),
            'email': current_user.get('email'),
            'nombre': (current_user.get('profile') or {}).get('nombre') or current_user.get('nombre'),
            'apellidos': (current_user.get('profile') or {}).get('apellidos') or current_user.get('apellidos'),
        }
        incidencia = _crear_incidencia_y_notificar(data.model_dump(exclude_none=True), merged)
        return {"incidencia": incidencia}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear incidencia: {str(e)}")


@router.get("/gestor/incidencias")
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


@router.put("/gestor/incidencias/{inc_id}")
async def update_incidencia(inc_id: str, data: IncidenciaUpdate, current_user: dict = Depends(get_current_gestor)):
    try:
        payload = data.model_dump(exclude_none=True)
        payload['updated_at'] = datetime.now().isoformat()
        r = supabase.table('incidencias').update(payload).eq('id', inc_id).execute()
        return {"incidencia": r.data[0] if r.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar incidencia: {str(e)}")


@router.delete("/gestor/incidencias/{inc_id}")
async def delete_incidencia(inc_id: str, current_user: dict = Depends(get_current_gestor)):
    try:
        supabase.table('incidencias').delete().eq('id', inc_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar incidencia: {str(e)}")
