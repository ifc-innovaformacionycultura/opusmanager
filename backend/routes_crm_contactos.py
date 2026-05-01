"""CRM de Contactos en Seguimiento de Plantillas — Bloque 1.

Registra intentos de contacto (email, llamada, whatsapp, otro) realizados por el
gestor a un músico para un evento concreto, con su estado de respuesta.
"""
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api/gestor/contactos", tags=["crm_contactos"])

VALID_TIPOS = {'email', 'llamada', 'whatsapp', 'otro'}
VALID_ESTADOS = {
    'sin_respuesta', 'respuesta_positiva', 'respuesta_negativa',
    'no_contactado', 'buzon', 'no_contesta',
}


class ContactoCreate(BaseModel):
    usuario_id: str
    evento_id: Optional[str] = None  # NULL = contacto neutro (sin evento asociado)
    tipo: str
    estado_respuesta: Optional[str] = 'sin_respuesta'
    notas: Optional[str] = None
    fecha_contacto: Optional[str] = None  # ISO datetime; default: NOW()


def log_contacto_auto(
    usuario_id: str,
    tipo: str,
    *,
    evento_id: Optional[str] = None,
    estado_respuesta: str = 'sin_respuesta',
    notas: Optional[str] = None,
    gestor_id: Optional[str] = None,
    gestor_nombre: Optional[str] = None,
) -> Optional[dict]:
    """Helper público para que otros módulos (emails, WhatsApp) registren contacto automático en CRM."""
    if tipo not in VALID_TIPOS:
        return None
    payload = {
        "usuario_id": usuario_id,
        "evento_id": evento_id,
        "tipo": tipo,
        "estado_respuesta": estado_respuesta,
        "notas": notas,
        "gestor_id": gestor_id,
        "gestor_nombre": gestor_nombre or "Sistema",
    }
    try:
        r = supabase.table('contactos_musico').insert(payload).execute()
        return (r.data or [None])[0]
    except Exception:
        return None


class ContactoOut(BaseModel):
    id: str
    usuario_id: str
    evento_id: str
    tipo: str
    estado_respuesta: str
    notas: Optional[str] = None
    fecha_contacto: str
    gestor_id: Optional[str] = None
    gestor_nombre: Optional[str] = None
    created_at: Optional[str] = None


def _gestor_info(current_user: dict):
    profile = current_user.get('profile') or {}
    nombre_full = f"{profile.get('nombre', '')} {profile.get('apellidos', '')}".strip()
    return profile.get('id'), nombre_full or profile.get('email') or 'Gestor'


@router.get("/musico/{usuario_id}")
async def list_contactos_musico_full(
    usuario_id: str,
    current_user: dict = Depends(get_current_gestor),
):
    """Bloque 2A — Historial COMPLETO de contactos del músico (neutros + por evento)."""
    try:
        rows = supabase.table('contactos_musico').select('*, evento:eventos(id,nombre)') \
            .eq('usuario_id', usuario_id) \
            .order('fecha_contacto', desc=True) \
            .execute().data or []
        return {"contactos": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/registrar-whatsapp/{usuario_id}")
async def registrar_whatsapp(
    usuario_id: str,
    evento_id: Optional[str] = None,
    notas: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    """Bloque 2C — Registra que el gestor compartió un enlace por WhatsApp."""
    g_id, g_name = _gestor_info(current_user)
    contacto = log_contacto_auto(
        usuario_id=usuario_id, tipo='whatsapp', evento_id=evento_id,
        estado_respuesta='sin_respuesta',
        notas=notas or "Enlace compartido por WhatsApp",
        gestor_id=g_id, gestor_nombre=g_name,
    )
    return {"contacto": contacto}


@router.get("/{usuario_id}/{evento_id}")
async def list_contactos(
    usuario_id: str,
    evento_id: str,
    current_user: dict = Depends(get_current_gestor),
):
    """Historial de contactos de un músico en un evento, ordenado por fecha DESC."""
    try:
        r = supabase.table('contactos_musico').select('*') \
            .eq('usuario_id', usuario_id) \
            .eq('evento_id', evento_id) \
            .order('fecha_contacto', desc=True) \
            .execute()
        return {"contactos": r.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al cargar contactos: {str(e)}")


@router.post("")
async def create_contacto(
    data: ContactoCreate,
    current_user: dict = Depends(get_current_gestor),
):
    """Registra un nuevo intento de contacto."""
    if data.tipo not in VALID_TIPOS:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Usa: {sorted(VALID_TIPOS)}")
    estado = data.estado_respuesta or 'sin_respuesta'
    if estado not in VALID_ESTADOS:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Usa: {sorted(VALID_ESTADOS)}")

    gestor_id, gestor_nombre = _gestor_info(current_user)
    payload = {
        "usuario_id": data.usuario_id,
        "evento_id": data.evento_id,
        "tipo": data.tipo,
        "estado_respuesta": estado,
        "notas": (data.notas or None),
        "gestor_id": gestor_id,
        "gestor_nombre": gestor_nombre,
    }
    if data.fecha_contacto:
        payload["fecha_contacto"] = data.fecha_contacto
    try:
        r = supabase.table('contactos_musico').insert(payload).execute()
        return {"contacto": r.data[0] if r.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear contacto: {str(e)}")


@router.get("/resumen")
async def resumen_contactos(
    evento_id: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    """Resumen agregado por (musico, evento) — usado por /seguimiento.

    Devuelve un mapping `(usuario_id, evento_id) -> {total, ultimo_tipo, ultimo_estado, ultima_fecha}`.
    Si se pasa `evento_id`, filtra por ese evento.
    """
    try:
        q = supabase.table('contactos_musico') \
            .select('usuario_id,evento_id,tipo,estado_respuesta,fecha_contacto') \
            .order('fecha_contacto', desc=True)
        if evento_id:
            q = q.eq('evento_id', evento_id)
        rows = q.execute().data or []

        agg = {}
        for r in rows:
            key = f"{r['usuario_id']}|{r['evento_id']}"
            if key not in agg:
                agg[key] = {
                    "usuario_id": r['usuario_id'],
                    "evento_id": r['evento_id'],
                    "total_contactos": 0,
                    "ultimo_tipo": r.get('tipo'),
                    "ultimo_estado": r.get('estado_respuesta'),
                    "ultima_fecha": r.get('fecha_contacto'),
                }
            agg[key]["total_contactos"] += 1
        return {"resumen": list(agg.values())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en resumen: {str(e)}")
