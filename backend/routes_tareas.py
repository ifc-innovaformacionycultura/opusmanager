"""
Tareas — Planificador de tareas (CRUD).
Endpoints extraídos de routes_gestor.py durante el refactor de feb 2026.
"""
from typing import Optional, Literal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api/gestor", tags=["tareas"])


class TareaCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    evento_id: Optional[str] = None
    responsable_id: Optional[str] = None
    responsable_nombre: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_limite: str
    prioridad: Optional[Literal['baja', 'media', 'alta', 'urgente']] = 'media'
    estado: Optional[Literal['pendiente', 'en_progreso', 'completada', 'cancelada']] = 'pendiente'
    categoria: Optional[str] = 'otro'
    recordatorio_fecha: Optional[str] = None


class TareaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    evento_id: Optional[str] = None
    responsable_id: Optional[str] = None
    responsable_nombre: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_limite: Optional[str] = None
    prioridad: Optional[Literal['baja', 'media', 'alta', 'urgente']] = None
    estado: Optional[Literal['pendiente', 'en_progreso', 'completada', 'cancelada']] = None
    categoria: Optional[str] = None
    recordatorio_fecha: Optional[str] = None


@router.get("/tareas")
async def list_tareas(current_user: dict = Depends(get_current_gestor)):
    try:
        r = supabase.table('tareas').select('*').order('fecha_limite', desc=False).execute()
        return {"tareas": r.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar tareas: {str(e)}")


@router.post("/tareas")
async def create_tarea(data: TareaCreate, current_user: dict = Depends(get_current_gestor)):
    try:
        payload = data.model_dump(exclude_none=True)
        r = supabase.table('tareas').insert(payload).execute()
        tarea = r.data[0] if r.data else None
        # Notificar al responsable si hay uno y es distinto del autor
        try:
            if tarea and tarea.get('responsable_id') and tarea['responsable_id'] != current_user['id']:
                supabase.table('notificaciones_gestor').insert({
                    "usuario_id": tarea['responsable_id'],
                    "tipo": "tarea_asignada",
                    "titulo": "Nueva tarea asignada",
                    "mensaje": f"Te han asignado la tarea: {tarea.get('titulo')}",
                    "link": f"/admin/tareas?id={tarea['id']}",
                }).execute()
        except Exception:
            pass  # Notificación opcional — no romper el flujo si tabla no existe
        return {"tarea": tarea}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear tarea: {str(e)}")


@router.put("/tareas/{tarea_id}")
async def update_tarea(tarea_id: str, data: TareaUpdate, current_user: dict = Depends(get_current_gestor)):
    try:
        before = supabase.table('tareas').select('*').eq('id', tarea_id).execute().data or []
        prev_estado = (before[0].get('estado') if before else None)
        prev_responsable = (before[0].get('responsable_id') if before else None)

        payload = data.model_dump(exclude_none=True)
        payload['updated_at'] = datetime.now().isoformat()
        r = supabase.table('tareas').update(payload).eq('id', tarea_id).execute()
        tarea = r.data[0] if r.data else None

        # Notificar al nuevo responsable si ha cambiado
        try:
            new_resp = payload.get('responsable_id')
            if tarea and new_resp and new_resp != prev_responsable and new_resp != current_user['id']:
                supabase.table('notificaciones_gestor').insert({
                    "usuario_id": new_resp,
                    "tipo": "tarea_asignada",
                    "titulo": "Tarea reasignada",
                    "mensaje": f"Se te ha asignado la tarea: {tarea.get('titulo')}",
                    "link": f"/admin/tareas?id={tarea['id']}",
                }).execute()
        except Exception:
            pass

        # Registrar en registro_actividad si se completó
        try:
            if tarea and payload.get('estado') == 'completada' and prev_estado != 'completada':
                supabase.table('registro_actividad').insert({
                    "usuario_id": current_user['id'],
                    "accion": "tarea_completada",
                    "descripcion": f"Completó la tarea: {tarea.get('titulo')}",
                    "entidad_tipo": "tarea",
                    "entidad_id": tarea_id,
                }).execute()
        except Exception:
            pass

        return {"tarea": tarea}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar tarea: {str(e)}")


@router.delete("/tareas/{tarea_id}")
async def delete_tarea(tarea_id: str, current_user: dict = Depends(get_current_gestor)):
    try:
        supabase.table('tareas').delete().eq('id', tarea_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar tarea: {str(e)}")
