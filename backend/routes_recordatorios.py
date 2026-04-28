"""Recordatorios automáticos vía APScheduler.

- Cron diario @ 09:00 Europe/Madrid.
- Disponibilidad: a `DIAS_ANTES_DISPONIBILIDAD` días del deadline (env, default 3).
- Logística (transporte/alojamiento): a `DIAS_ANTES_LOGISTICA` días (env, default 2).
- Idempotencia con tabla `recordatorios_enviados` (UNIQUE(usuario_id, tipo, entidad_id, dias_antes)).
- Push respeta el toggle `recordatorios` del usuario.

Endpoint manual: POST /api/admin/recordatorios/run-now (admin/director_general).
"""
import os
import logging
from datetime import datetime, date, timedelta, timezone
from typing import List, Dict, Optional

from fastapi import APIRouter, HTTPException, Depends

from supabase_client import supabase
from auth_utils import get_current_gestor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/recordatorios", tags=["recordatorios"])


# ============ Config ============

def _dias_disponibilidad() -> int:
    try:
        return int(os.environ.get("DIAS_ANTES_DISPONIBILIDAD", "3"))
    except Exception:
        return 3


def _dias_logistica() -> int:
    try:
        return int(os.environ.get("DIAS_ANTES_LOGISTICA", "2"))
    except Exception:
        return 2


# ============ Idempotencia ============

def _ya_enviado(usuario_id: str, tipo: str, entidad_id: str, dias_antes: int) -> bool:
    """Comprueba si ya enviamos este recordatorio (UNIQUE constraint en BD)."""
    try:
        r = supabase.table('recordatorios_enviados').select('id') \
            .eq('usuario_id', usuario_id) \
            .eq('tipo', tipo) \
            .eq('entidad_id', entidad_id) \
            .eq('dias_antes', dias_antes) \
            .limit(1).execute()
        return bool(r.data)
    except Exception:
        return False


def _marcar_enviado(usuario_id: str, tipo: str, entidad_id: str, dias_antes: int, fecha_objetivo: str):
    try:
        supabase.table('recordatorios_enviados').insert({
            "usuario_id": usuario_id,
            "tipo": tipo,
            "entidad_id": entidad_id,
            "dias_antes": dias_antes,
            "fecha_objetivo": fecha_objetivo,
        }).execute()
    except Exception as e:
        logger.warning(f"Error marcando recordatorio enviado: {e}")


# ============ Helpers ============

def _evento_deadline_disp(ev: dict) -> Optional[date]:
    """Devuelve la fecha límite efectiva de disponibilidad de un evento.

    Prioridad:
    1. eventos.fecha_limite_disponibilidad (si existe).
    2. eventos.fecha_inicio_preparacion (inicio de ensayos).
    3. eventos.fecha_inicio - 7 días.
    """
    raw = ev.get('fecha_limite_disponibilidad')
    if raw:
        try:
            return datetime.fromisoformat(str(raw).replace('Z', '+00:00')).date()
        except Exception:
            pass
    prep = ev.get('fecha_inicio_preparacion')
    if prep:
        try:
            return datetime.fromisoformat(str(prep).replace('Z', '+00:00')).date()
        except Exception:
            pass
    fi = ev.get('fecha_inicio')
    if fi:
        try:
            d = datetime.fromisoformat(str(fi).replace('Z', '+00:00')).date()
            return d - timedelta(days=7)
        except Exception:
            pass
    return None


def _push(usuario_id: str, titulo: str, body: str, url: str = "/portal"):
    try:
        from routes_push import notify_push
        return notify_push(usuario_id, titulo, body, url, tipo='recordatorio')
    except Exception as e:
        logger.warning(f"Error push: {e}")
        return 0


# ============ Job: disponibilidad ============

def job_disponibilidad() -> Dict:
    """Recordatorio: a X días del deadline de disponibilidad para músicos sin disponibilidad confirmada."""
    dias = _dias_disponibilidad()
    today = date.today()
    target = today + timedelta(days=dias)
    enviados = 0
    revisados = 0
    try:
        # Eventos abiertos / publicados
        evs = supabase.table('eventos').select(
            'id,nombre,fecha_inicio,fecha_inicio_preparacion,fecha_limite_disponibilidad,estado'
        ).in_('estado', ['abierto', 'publicado', 'borrador']).execute().data or []

        for ev in evs:
            deadline = _evento_deadline_disp(ev)
            if not deadline:
                continue
            if deadline != target:
                continue
            # Asignaciones publicadas a músicos para ese evento
            asigs = supabase.table('asignaciones').select(
                'id,usuario_id,publicado_musico,estado,fecha_respuesta'
            ).eq('evento_id', ev['id']).eq('publicado_musico', True).execute().data or []
            for a in asigs:
                revisados += 1
                # "Confirmada" = músico ya ha respondido (fecha_respuesta no nula
                # o estado distinto de 'pendiente').
                if a.get('fecha_respuesta') or (a.get('estado') and a['estado'] != 'pendiente'):
                    continue
                uid = a.get('usuario_id')
                if not uid:
                    continue
                if _ya_enviado(uid, 'disponibilidad', ev['id'], dias):
                    continue
                titulo = f"⏰ Confirma tu disponibilidad: {ev.get('nombre', 'evento')}"
                body = f"Quedan {dias} día{'s' if dias != 1 else ''} para confirmar tu disponibilidad."
                _push(uid, titulo, body, url='/portal')
                _marcar_enviado(uid, 'disponibilidad', ev['id'], dias, deadline.isoformat())
                enviados += 1
    except Exception as e:
        logger.error(f"Job disponibilidad error: {e}")
    return {"job": "disponibilidad", "enviados": enviados, "revisados": revisados, "dias_antes": dias}


# ============ Job: logística (transporte / alojamiento) ============

def job_logistica() -> Dict:
    """Recordatorio: a X días del fecha_limite_confirmacion de cada item de logística."""
    dias = _dias_logistica()
    today = date.today()
    target_iso = (today + timedelta(days=dias)).isoformat()
    enviados = 0
    revisados = 0
    try:
        # Items de logística cuyo deadline cae exactamente a `dias` días.
        items = supabase.table('evento_logistica').select(
            'id,evento_id,tipo,fecha_limite_confirmacion'
        ).eq('fecha_limite_confirmacion', target_iso).execute().data or []

        for it in items:
            tipo_logi = it.get('tipo') or ''
            tipo_label = 'transporte' if 'transporte' in tipo_logi else ('alojamiento' if tipo_logi == 'alojamiento' else 'logística')
            tipo_key = 'transporte' if 'transporte' in tipo_logi else ('alojamiento' if tipo_logi == 'alojamiento' else 'logistica')
            ev_id = it.get('evento_id')
            ev_row = None
            try:
                er = supabase.table('eventos').select('nombre').eq('id', ev_id).limit(1).execute().data or []
                ev_row = er[0] if er else None
            except Exception:
                pass
            ev_nombre = (ev_row or {}).get('nombre', 'evento')

            asigs = supabase.table('asignaciones').select(
                'usuario_id,publicado_musico'
            ).eq('evento_id', ev_id).eq('publicado_musico', True).execute().data or []
            for a in asigs:
                revisados += 1
                uid = a.get('usuario_id')
                if not uid:
                    continue
                if _ya_enviado(uid, tipo_key, it['id'], dias):
                    continue
                titulo = f"🚐 Confirma {tipo_label}: {ev_nombre}"
                body = f"Quedan {dias} día{'s' if dias != 1 else ''} para confirmar tu {tipo_label} para {ev_nombre}."
                _push(uid, titulo, body, url='/portal')
                _marcar_enviado(uid, tipo_key, it['id'], dias, target_iso)
                enviados += 1
    except Exception as e:
        logger.error(f"Job logística error: {e}")
    return {"job": "logistica", "enviados": enviados, "revisados": revisados, "dias_antes": dias}


def run_all_jobs() -> Dict:
    """Ejecuta todos los jobs de recordatorio uno detrás de otro y devuelve resumen."""
    started_at = datetime.now(timezone.utc).isoformat()
    rj = job_disponibilidad()
    rl = job_logistica()
    return {
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "results": [rj, rl],
        "total_enviados": rj.get('enviados', 0) + rl.get('enviados', 0),
    }


# ============ APScheduler bootstrap ============

_scheduler = None


def init_scheduler():
    """Llamado desde server.py @startup. Idempotente."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        import pytz
        tz = pytz.timezone("Europe/Madrid")
        sched = BackgroundScheduler(timezone=tz)
        sched.add_job(
            run_all_jobs, CronTrigger(hour=9, minute=0, timezone=tz),
            id="recordatorios_diarios", replace_existing=True, max_instances=1,
        )
        sched.start()
        _scheduler = sched
        logger.info("APScheduler iniciado: recordatorios diarios @ 09:00 Europe/Madrid")
    except Exception as e:
        logger.error(f"No se pudo iniciar APScheduler: {e}")
    return _scheduler


def shutdown_scheduler():
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass
        _scheduler = None


# ============ Endpoint manual ============

@router.post("/run-now")
async def run_now(current_user: dict = Depends(get_current_gestor)):
    """Ejecuta los jobs de recordatorio inmediatamente. Solo admin/director_general."""
    profile = current_user.get('profile') or {}
    rol = profile.get('rol') or current_user.get('rol') or ''
    if rol not in ('admin', 'director_general'):
        raise HTTPException(status_code=403, detail="Solo admin o director_general pueden ejecutar manualmente.")
    return run_all_jobs()


@router.get("/status")
async def status(current_user: dict = Depends(get_current_gestor)):
    """Devuelve estado del scheduler y próximos disparos."""
    info = {"running": False, "next_run": None, "jobs": []}
    try:
        if _scheduler is not None:
            info["running"] = bool(_scheduler.running)
            for j in _scheduler.get_jobs():
                info["jobs"].append({
                    "id": j.id,
                    "next_run_time": str(j.next_run_time) if j.next_run_time else None,
                })
    except Exception as e:
        info["error"] = str(e)
    info["dias_antes_disponibilidad"] = _dias_disponibilidad()
    info["dias_antes_logistica"] = _dias_logistica()
    return info
