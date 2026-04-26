"""
Chat interno entre gestores — TAREA 4.
Canales: 'general', 'evento:{id}', 'dm:{uid_a}:{uid_b}' (ordenados alfabéticamente).
"""
import re
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api/gestor/mensajes", tags=["mensajes"])

MENCION_RE = re.compile(r"@([\w\.\-áéíóúñÁÉÍÓÚÑüÜ]+)")


class MensajeCreate(BaseModel):
    contenido: str
    menciones: Optional[List[str]] = None  # lista de usuario_id


def _resolve_uid(current_user: dict) -> Optional[str]:
    """Devuelve el id de la fila en `usuarios` para el gestor logueado."""
    p = (current_user or {}).get('profile') or {}
    if p.get('id'):
        return p['id']
    auth_id = current_user.get('id')
    if auth_id:
        ex = supabase.table('usuarios').select('id').eq('user_id', auth_id).limit(1).execute()
        if ex.data:
            return ex.data[0]['id']
        ex = supabase.table('usuarios').select('id').eq('id', auth_id).limit(1).execute()
        if ex.data:
            return auth_id
    return None


def _nombre_full(user_row: dict) -> str:
    if not user_row:
        return 'Usuario'
    apell = (user_row.get('apellidos') or '').strip()
    nombre = (user_row.get('nombre') or '').strip()
    if apell and nombre:
        return f"{apell}, {nombre}"
    return apell or nombre or (user_row.get('email') or 'Usuario')


def _validar_canal(canal: str, uid: str) -> str:
    """Devuelve el canal canónico (DMs ordenados alfabéticamente)."""
    if canal == 'general':
        return canal
    if canal.startswith('evento:'):
        return canal
    if canal.startswith('dm:'):
        parts = canal.split(':')
        if len(parts) == 3:
            a, b = sorted([parts[1], parts[2]])
            if uid not in (a, b):
                raise HTTPException(status_code=403, detail="No formas parte de este DM")
            return f"dm:{a}:{b}"
    raise HTTPException(status_code=400, detail="Canal inválido")


@router.get("/canales")
async def listar_canales(current_user: dict = Depends(get_current_gestor)):
    """Devuelve los canales disponibles (general + eventos abiertos + lista de gestores para DM)."""
    uid = _resolve_uid(current_user)
    eventos = supabase.table('eventos').select('id,nombre,fecha_inicio') \
        .eq('estado', 'abierto').order('fecha_inicio').execute().data or []
    gestores = supabase.table('usuarios') \
        .select('id,nombre,apellidos,email,rol').eq('rol', 'gestor').execute().data or []
    return {
        "general": {"id": "general", "nombre": "General"},
        "eventos": [{"id": f"evento:{e['id']}", "nombre": e['nombre'], "evento_id": e['id']} for e in eventos],
        "gestores": [
            {
                "id": g['id'],
                "nombre": _nombre_full(g),
                "email": g.get('email'),
                "canal": f"dm:{min(uid or '', g['id'])}:{max(uid or '', g['id'])}" if uid else None,
            } for g in gestores if g['id'] != uid
        ],
        "mi_id": uid,
    }


@router.get("/{canal}")
async def listar_mensajes(canal: str, current_user: dict = Depends(get_current_gestor)):
    """Últimos 50 mensajes del canal (orden ASC)."""
    uid = _resolve_uid(current_user)
    canal_ok = _validar_canal(canal, uid or '')
    res = supabase.table('mensajes').select('id,canal,gestor_id,gestor_nombre,contenido,menciones,created_at') \
        .eq('canal', canal_ok).order('created_at', desc=True).limit(50).execute()
    msgs = list(reversed(res.data or []))
    return {"mensajes": msgs, "mi_id": uid}


@router.post("/{canal}")
async def crear_mensaje(canal: str, payload: MensajeCreate, current_user: dict = Depends(get_current_gestor)):
    """Inserta un mensaje + dispara notificaciones a los mencionados."""
    uid = _resolve_uid(current_user)
    if not uid:
        raise HTTPException(status_code=403, detail="No tienes registro en usuarios")
    canal_ok = _validar_canal(canal, uid)
    contenido = (payload.contenido or '').strip()
    if not contenido:
        raise HTTPException(status_code=400, detail="Mensaje vacío")
    if len(contenido) > 4000:
        raise HTTPException(status_code=400, detail="Mensaje demasiado largo (máx 4000)")

    me_row = supabase.table('usuarios').select('id,nombre,apellidos,email').eq('id', uid).limit(1).execute().data
    nombre_full = _nombre_full(me_row[0] if me_row else {})

    insert_row = {
        "canal": canal_ok,
        "gestor_id": uid,
        "gestor_nombre": nombre_full,
        "contenido": contenido,
        "menciones": payload.menciones or [],
    }
    inserted = supabase.table('mensajes').insert(insert_row).execute().data or []
    msg = inserted[0] if inserted else None

    # Notificar a los mencionados (si la tabla notificaciones_gestor existe)
    if payload.menciones and msg:
        for mention_uid in set(payload.menciones):
            if mention_uid == uid:
                continue
            try:
                supabase.table('notificaciones_gestor').insert({
                    "gestor_id": mention_uid,
                    "tipo": "mencion_chat",
                    "titulo": f"{nombre_full} te mencionó en chat",
                    "descripcion": contenido[:160],
                    "entidad_tipo": "mensaje",
                    "entidad_id": msg['id'],
                    "leida": False,
                }).execute()
            except Exception:
                pass

    return {"ok": True, "mensaje": msg}


@router.put("/leido/{canal}")
async def marcar_canal_leido(canal: str, current_user: dict = Depends(get_current_gestor)):
    """Marca el canal como leído ahora para el gestor actual."""
    uid = _resolve_uid(current_user)
    if not uid:
        raise HTTPException(status_code=403, detail="No tienes registro en usuarios")
    canal_ok = _validar_canal(canal, uid)
    now = datetime.now(timezone.utc).isoformat()

    existing = supabase.table('mensajes_leidos').select('canal') \
        .eq('gestor_id', uid).eq('canal', canal_ok).limit(1).execute().data or []
    if existing:
        supabase.table('mensajes_leidos').update({"ultimo_leido_at": now}) \
            .eq('gestor_id', uid).eq('canal', canal_ok).execute()
    else:
        supabase.table('mensajes_leidos').insert({
            "gestor_id": uid,
            "canal": canal_ok,
            "ultimo_leido_at": now,
        }).execute()
    return {"ok": True, "ultimo_leido_at": now}


@router.get("/no-leidos/lista")
async def conteo_no_leidos(current_user: dict = Depends(get_current_gestor)):
    """Conteo de mensajes no leídos por canal (excluye los enviados por el propio gestor)."""
    uid = _resolve_uid(current_user)
    if not uid:
        return {"counts": {}}

    # 1) Cargar timestamps de "último leído" del gestor
    leidos = supabase.table('mensajes_leidos').select('canal,ultimo_leido_at') \
        .eq('gestor_id', uid).execute().data or []
    leidos_map = {row['canal']: row['ultimo_leido_at'] for row in leidos}

    # 2) Cargar últimos 500 mensajes de los canales relevantes (general + eventos abiertos + DMs propios)
    eventos = supabase.table('eventos').select('id').eq('estado', 'abierto').execute().data or []
    canales_pub = ['general'] + [f"evento:{e['id']}" for e in eventos]
    msgs = supabase.table('mensajes').select('canal,gestor_id,created_at') \
        .in_('canal', canales_pub).order('created_at', desc=True).limit(500).execute().data or []
    # DMs del gestor: cargamos los mensajes donde el canal contenga su uid
    dms = supabase.table('mensajes').select('canal,gestor_id,created_at') \
        .like('canal', f"dm:%{uid}%").order('created_at', desc=True).limit(500).execute().data or []

    counts = {}
    for m in msgs + dms:
        if m.get('gestor_id') == uid:
            continue
        c = m['canal']
        last_read = leidos_map.get(c)
        if last_read is None or m['created_at'] > last_read:
            counts[c] = counts.get(c, 0) + 1
    return {"counts": counts}
