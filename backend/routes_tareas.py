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
        # TAREA 3B — Notificar al responsable si hay uno y es distinto del autor
        try:
            if tarea and tarea.get('responsable_id') and tarea['responsable_id'] != current_user['id']:
                supabase.table('notificaciones_gestor').insert({
                    "gestor_id": tarea['responsable_id'],
                    "tipo": "tarea_asignada",
                    "titulo": f"Nueva tarea asignada: {tarea.get('titulo')}",
                    "descripcion": f"Te han asignado la tarea \"{tarea.get('titulo')}\" con deadline {tarea.get('fecha_limite') or 'sin fecha'}",
                    "entidad_tipo": "tarea",
                    "entidad_id": tarea['id'],
                    "leida": False,
                }).execute()
                # Push (Bloque PWA)
                try:
                    from routes_push import notify_push
                    notify_push(
                        tarea['responsable_id'],
                        f"📋 Nueva tarea: {tarea.get('titulo')}",
                        f"Deadline: {tarea.get('fecha_limite') or 'sin fecha'}",
                        '/admin/tareas',
                        tipo='tarea',
                    )
                except Exception:
                    pass
        except Exception:
            pass
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

        # TAREA 3B — Notificar al nuevo responsable si ha cambiado
        try:
            new_resp = payload.get('responsable_id')
            if tarea and new_resp and new_resp != prev_responsable and new_resp != current_user['id']:
                supabase.table('notificaciones_gestor').insert({
                    "gestor_id": new_resp,
                    "tipo": "tarea_asignada",
                    "titulo": f"Tarea reasignada: {tarea.get('titulo')}",
                    "descripcion": f"Te han asignado la tarea \"{tarea.get('titulo')}\" con deadline {tarea.get('fecha_limite') or 'sin fecha'}",
                    "entidad_tipo": "tarea",
                    "entidad_id": tarea_id,
                    "leida": False,
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



# ============================================================
# Bloque 9 — Calendario unificado de eventos automáticos
# ============================================================
@router.get("/calendario-eventos")
async def calendario_eventos(desde: Optional[str] = None, hasta: Optional[str] = None,
                              current_user: dict = Depends(get_current_gestor)):
    """Devuelve eventos automáticos de solo lectura para el planificador:
    - ensayos (verde) · funciones (azul) · logística músicos (amarillo) · montajes confirmados (naranja)
    Formato compatible con vistas Gantt/Calendario/Lista del planificador.
    """
    eventos_calendario = []

    # 1) Ensayos y funciones
    try:
        evs = supabase.table('eventos').select('id,nombre,fecha_inicio,fecha_fin').execute().data or []
        ev_map = {e['id']: e for e in evs}
        rows = supabase.table('rehearsals').select('id,event_id,fecha,hora_inicio,hora_fin,tipo,lugar').execute().data or []
        for r in rows:
            d = (r.get('fecha') or '')[:10]
            if not d: continue
            if desde and d < desde: continue
            if hasta and d > hasta: continue
            ev = ev_map.get(r['event_id']) or {}
            tipo = (r.get('tipo') or 'ensayo').lower()
            es_funcion = tipo in ('funcion', 'función', 'concierto')
            eventos_calendario.append({
                'id': f"ensayo-{r['id']}",
                'tipo_calendario': 'funcion' if es_funcion else 'ensayo',
                'titulo': f"{'🎻' if es_funcion else '🎼'} {ev.get('nombre', '—')} · {tipo}",
                'fecha': d,
                'hora_inicio': r.get('hora_inicio'),
                'hora_fin': r.get('hora_fin'),
                'lugar': r.get('lugar'),
                'color': '#3b82f6' if es_funcion else '#16a34a',
                'evento_id': r['event_id'],
                'origen': 'auto',
                'editable': False,
            })
    except Exception:
        pass

    # 2) Logística músicos (transporte_ida/vuelta + alojamiento)
    try:
        logs = supabase.table('evento_logistica').select('id,evento_id,tipo,fecha,hora_salida,lugar_salida,lugar_llegada').execute().data or []
        for l in logs:
            d = (l.get('fecha') or '')[:10]
            if not d: continue
            if desde and d < desde: continue
            if hasta and d > hasta: continue
            ev = (supabase.table('eventos').select('nombre').eq('id', l['evento_id']).limit(1).execute().data or [{}])[0]
            tipo_lab = {
                'transporte_ida': '🚌 Ida',
                'transporte_vuelta': '🚌 Vuelta',
                'alojamiento': '🏨 Alojamiento',
            }.get(l.get('tipo'), l.get('tipo'))
            eventos_calendario.append({
                'id': f"logistica-{l['id']}",
                'tipo_calendario': 'logistica',
                'titulo': f"{tipo_lab} — {ev.get('nombre', '—')}",
                'fecha': d,
                'hora_inicio': l.get('hora_salida'),
                'lugar': l.get('lugar_salida') or l.get('lugar_llegada'),
                'color': '#eab308',
                'evento_id': l['evento_id'],
                'origen': 'auto',
                'editable': False,
            })
    except Exception:
        pass

    # 3) Montajes confirmados (asociados a fechas de ensayos del evento)
    try:
        mont = supabase.table('evento_montaje').select('id,evento_id,ensayo_id,confirmado,nombre_material').eq('confirmado', True).execute().data or []
        for m in mont:
            # Si tiene ensayo_id, usa fecha del ensayo
            if m.get('ensayo_id'):
                ens = supabase.table('rehearsals').select('fecha,hora_inicio').eq('id', m['ensayo_id']).limit(1).execute().data or []
                if not ens: continue
                d = (ens[0].get('fecha') or '')[:10]
                hora = ens[0].get('hora_inicio')
            else:
                ev = supabase.table('eventos').select('fecha_inicio').eq('id', m['evento_id']).limit(1).execute().data or []
                d = (ev[0].get('fecha_inicio') if ev else '')[:10]
                hora = None
            if not d: continue
            if desde and d < desde: continue
            if hasta and d > hasta: continue
            eventos_calendario.append({
                'id': f"montaje-{m['id']}",
                'tipo_calendario': 'montaje',
                'titulo': f"🛠️ Montaje · {m.get('nombre_material', '—')}",
                'fecha': d,
                'hora_inicio': hora,
                'color': '#f97316',
                'evento_id': m['evento_id'],
                'origen': 'auto',
                'editable': False,
            })
    except Exception:
        pass

    return {'eventos': eventos_calendario, 'total': len(eventos_calendario)}


# ============================================================
# Bloque 10 — Mi calendario (portal del músico)
# ============================================================
@router.get("/portal-mi-calendario")
async def mi_calendario_musico(current_user: dict = Depends(get_current_gestor)):
    """Endpoint para portal del músico: incluye logística confirmada y pendiente.
    NOTE: En portal real se usa get_current_musico, pero el dependency lo gestiona el mismo router.
    """
    # Para portal, este endpoint debería usar get_current_musico. Como B10 requiere portal-only,
    # se documenta aquí para futura iteración con get_current_musico.
    raise HTTPException(status_code=501, detail="Endpoint portal pendiente: se moverá a routes_portal con get_current_musico.")
