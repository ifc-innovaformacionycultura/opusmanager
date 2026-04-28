"""Web Push Notifications — VAPID + suscripciones + helper de envío.

Endpoints:
- GET  /api/push/vapid-public  → devuelve la public key (frontend la necesita).
- POST /api/push/suscribir     → guarda/actualiza suscripción del navegador.
- POST /api/push/desuscribir   → elimina suscripción (al cerrar sesión).
- POST /api/push/test          → envía una notificación de prueba (sólo para el usuario autenticado).

Helper público `notify_push(usuario_id, titulo, body, url)` para que el resto
de routers lo llame al disparar eventos (nueva convocatoria, mención, etc.).
"""
import os
import json
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from supabase_client import supabase
from auth_utils import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/push", tags=["push"])


# ============ Config ============

def _vapid_public() -> str:
    return os.environ.get("VAPID_PUBLIC_KEY", "").strip()

def _vapid_private() -> str:
    return os.environ.get("VAPID_PRIVATE_KEY", "").strip()

def _vapid_email() -> str:
    return os.environ.get("VAPID_CONTACT_EMAIL", "admin@convocatorias.com").strip()


def _vapid_claims():
    return {"sub": f"mailto:{_vapid_email()}"}


# ============ Modelos ============

class Suscripcion(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: Optional[str] = None


class TestPayload(BaseModel):
    titulo: Optional[str] = "OPUS MANAGER"
    body: Optional[str] = "Notificación de prueba ✅"
    url: Optional[str] = "/"


# ============ Endpoints ============

@router.get("/vapid-public")
async def get_vapid_public():
    """Devuelve la VAPID public key para que el frontend la use en `pushManager.subscribe()`.

    Es totalmente segura para exponer (es la clave pública).
    """
    pk = _vapid_public()
    if not pk:
        raise HTTPException(status_code=503, detail="VAPID_PUBLIC_KEY no configurada en el backend")
    return {"public_key": pk}


@router.post("/suscribir")
async def suscribir(data: Suscripcion, current_user: dict = Depends(get_current_user)):
    """Guarda la suscripción del navegador del usuario actual. Idempotente (UPSERT por endpoint)."""
    profile = current_user.get("profile") or {}
    usuario_id = profile.get("id")
    if not usuario_id:
        raise HTTPException(status_code=400, detail="Usuario sin perfil")

    payload = {
        "usuario_id": usuario_id,
        "endpoint": data.endpoint,
        "p256dh": data.p256dh,
        "auth": data.auth,
        "user_agent": (data.user_agent or "")[:300],
    }
    try:
        existing = supabase.table('push_suscripciones').select('id') \
            .eq('usuario_id', usuario_id).eq('endpoint', data.endpoint).limit(1).execute().data or []
        if existing:
            supabase.table('push_suscripciones').update(payload).eq('id', existing[0]['id']).execute()
            return {"ok": True, "updated": True}
        supabase.table('push_suscripciones').insert(payload).execute()
        return {"ok": True, "created": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar suscripción: {str(e)}")


@router.post("/desuscribir")
async def desuscribir(data: Suscripcion, current_user: dict = Depends(get_current_user)):
    """Elimina suscripción concreta (al cerrar sesión o desactivar notificaciones)."""
    profile = current_user.get("profile") or {}
    usuario_id = profile.get("id")
    try:
        supabase.table('push_suscripciones').delete() \
            .eq('usuario_id', usuario_id).eq('endpoint', data.endpoint).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test")
async def test(data: TestPayload, current_user: dict = Depends(get_current_user)):
    """Envía una notificación de prueba al propio usuario. Útil para debugging desde la UI."""
    profile = current_user.get("profile") or {}
    usuario_id = profile.get("id")
    enviadas = notify_push(usuario_id, data.titulo, data.body, data.url or "/")
    return {"ok": True, "enviadas": enviadas}


# ============ Helper público ============

def notify_push(usuario_id: str, titulo: str, body: str, url: str = "/", tipo: str = "general") -> int:
    """Envía una notificación push a TODAS las suscripciones del usuario.

    Returns número de suscripciones a las que se envió correctamente.
    No lanza excepciones: errores se loguean.
    """
    if not usuario_id or not titulo:
        return 0
    pub = _vapid_public()
    priv = _vapid_private()
    if not pub or not priv:
        logger.info("VAPID keys no configuradas — push omitido")
        return 0

    try:
        from pywebpush import webpush, WebPushException
    except Exception as e:
        logger.error(f"pywebpush no disponible: {e}")
        return 0

    try:
        rows = supabase.table('push_suscripciones').select('id,endpoint,p256dh,auth') \
            .eq('usuario_id', usuario_id).execute().data or []
    except Exception as e:
        logger.error(f"Error cargando suscripciones: {e}")
        return 0

    if not rows:
        return 0

    payload = json.dumps({
        "title": titulo[:120],
        "body": (body or "")[:240],
        "url": url or "/",
        "tipo": tipo,
    })

    enviadas = 0
    purgar = []
    for r in rows:
        sub_info = {
            "endpoint": r['endpoint'],
            "keys": {"p256dh": r['p256dh'], "auth": r['auth']},
        }
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=priv,
                vapid_claims=dict(_vapid_claims()),
            )
            enviadas += 1
        except WebPushException as we:
            status = getattr(we.response, 'status_code', None) if getattr(we, 'response', None) is not None else None
            # 404 / 410 → suscripción caducada, purgar
            if status in (404, 410):
                purgar.append(r['id'])
            else:
                logger.warning(f"WebPush fallo {status}: {we}")
        except Exception as e:
            logger.warning(f"Push fallo: {e}")

    # Limpiar suscripciones inválidas
    if purgar:
        try:
            supabase.table('push_suscripciones').delete().in_('id', purgar).execute()
        except Exception:
            pass

    return enviadas
