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


def _dias_comidas() -> int:
    try:
        return int(os.environ.get("DIAS_ANTES_COMIDAS", "2"))
    except Exception:
        return 2


def _dias_tareas() -> int:
    try:
        return int(os.environ.get("DIAS_ANTES_TAREAS", "1"))
    except Exception:
        return 1


# Buffer en memoria para los últimos errores de push (suscripciones purgadas, fallos).
# No persiste tras reinicio, pero es suficiente para diagnosticar el día actual.
_PUSH_ERRORS = []  # [{when, kind, message, usuario_id}]
_PUSH_ERRORS_MAX = 50


def push_log_error(kind: str, message: str, usuario_id: Optional[str] = None):
    """Llamado por routes_push cuando una suscripción falla (404/410 u otra)."""
    try:
        from datetime import datetime as _dt, timezone as _tz
        _PUSH_ERRORS.insert(0, {
            "when": _dt.now(_tz.utc).isoformat(),
            "kind": kind,
            "message": (message or "")[:240],
            "usuario_id": usuario_id,
        })
        if len(_PUSH_ERRORS) > _PUSH_ERRORS_MAX:
            del _PUSH_ERRORS[_PUSH_ERRORS_MAX:]
    except Exception:
        pass


def get_recent_errors() -> List[Dict]:
    return list(_PUSH_ERRORS)


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

def job_disponibilidad(force_dias_antes: Optional[int] = None) -> Dict:
    """Recordatorio: a X días del deadline de disponibilidad para músicos sin disponibilidad confirmada.

    Si `force_dias_antes` se pasa (p.ej. 0 para "última llamada"), se usa ese valor
    en vez de la variable de entorno.
    """
    dias = force_dias_antes if force_dias_antes is not None else _dias_disponibilidad()
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

def job_logistica(force_dias_antes: Optional[int] = None) -> Dict:
    """Recordatorio: a X días del fecha_limite_confirmacion de cada item de logística."""
    dias = force_dias_antes if force_dias_antes is not None else _dias_logistica()
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
    rc = job_comidas()
    rt = job_tareas()
    return {
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "results": [rj, rl, rc, rt],
        "total_enviados": rj.get('enviados', 0) + rl.get('enviados', 0) + rc.get('enviados', 0) + rt.get('enviados', 0),
    }


# ============ Job: servicio de comedor (Iter 19) ============

def job_comidas(force_dias_antes: Optional[int] = None) -> Dict:
    """Recordatorio: a X días del fecha_limite_confirmacion de cada servicio de comedor."""
    dias = force_dias_antes if force_dias_antes is not None else _dias_comidas()
    today = date.today()
    target_iso = (today + timedelta(days=dias)).isoformat()
    enviados = 0
    revisados = 0
    try:
        items = supabase.table('evento_comidas').select(
            'id,evento_id,fecha,fecha_limite_confirmacion'
        ).eq('fecha_limite_confirmacion', target_iso).execute().data or []
        for it in items:
            ev_id = it.get('evento_id')
            ev_row = None
            try:
                er = supabase.table('eventos').select('nombre').eq('id', ev_id).limit(1).execute().data or []
                ev_row = er[0] if er else None
            except Exception:
                pass
            ev_nombre = (ev_row or {}).get('nombre', 'evento')
            # Solo músicos asignados Y publicados que aún no han respondido este servicio
            asigs = supabase.table('asignaciones').select(
                'usuario_id,publicado_musico'
            ).eq('evento_id', ev_id).eq('publicado_musico', True).execute().data or []
            existing_confs = supabase.table('confirmaciones_comida').select('usuario_id,confirmado') \
                .eq('comida_id', it['id']).execute().data or []
            ya_respondidos = {c['usuario_id'] for c in existing_confs if c.get('confirmado') is not None}
            for a in asigs:
                revisados += 1
                uid = a.get('usuario_id')
                if not uid or uid in ya_respondidos:
                    continue
                if _ya_enviado(uid, 'comida', it['id'], dias):
                    continue
                titulo = f"🍽️ Confirma servicio de comedor: {ev_nombre}"
                body = f"Quedan {dias} día{'s' if dias != 1 else ''} para confirmar si asistirás a la comida en {ev_nombre}."
                _push(uid, titulo, body, url='/portal')
                _marcar_enviado(uid, 'comida', it['id'], dias, target_iso)
                enviados += 1
    except Exception as e:
        logger.error(f"Job comidas error: {e}")
    return {"job": "comidas", "enviados": enviados, "revisados": revisados, "dias_antes": dias}


def run_last_call_jobs() -> Dict:
    """Segundo recordatorio @ 12:00: SOLO el día del deadline (dias_antes=0).

    Aviso "última llamada" para músicos que aún no han confirmado disponibilidad
    o logística cuyo deadline cae HOY.
    """
    started_at = datetime.now(timezone.utc).isoformat()
    rj = job_disponibilidad(force_dias_antes=0)
    rl = job_logistica(force_dias_antes=0)
    rc = job_comidas(force_dias_antes=0)
    return {
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "results": [rj, rl, rc],
        "total_enviados": rj.get('enviados', 0) + rl.get('enviados', 0) + rc.get('enviados', 0),
        "tipo": "ultima_llamada",
    }


# ============ Job: tareas ============

def job_tareas() -> Dict:
    """Recordatorio: tareas cuyo `fecha_limite` está a `DIAS_ANTES_TAREAS` días y NO están completadas."""
    dias = _dias_tareas()
    today = date.today()
    target_iso = (today + timedelta(days=dias)).isoformat()
    enviados = 0
    revisados = 0
    try:
        # Tareas con deadline el día target. Excluimos completadas/canceladas.
        rows = supabase.table('tareas').select('id,titulo,fecha_limite,responsable_id,estado').execute().data or []
        for t in rows:
            limite = t.get('fecha_limite')
            if not limite:
                continue
            limite_d = str(limite)[:10]
            if limite_d != target_iso:
                continue
            estado = (t.get('estado') or '').lower()
            if estado in ('completada', 'completado', 'cancelada', 'cancelado', 'hecha', 'finalizada'):
                continue
            uid = t.get('responsable_id')
            if not uid:
                continue
            revisados += 1
            if _ya_enviado(uid, 'tarea', t['id'], dias):
                continue
            titulo_n = f"📋 Recordatorio tarea: {t.get('titulo') or 'tarea'}"
            body = f"Tu tarea vence en {dias} día{'s' if dias != 1 else ''} ({limite_d})."
            _push(uid, titulo_n, body, url='/admin/tareas')
            _marcar_enviado(uid, 'tarea', t['id'], dias, target_iso)
            enviados += 1
    except Exception as e:
        logger.error(f"Job tareas error: {e}")
    return {"job": "tareas", "enviados": enviados, "revisados": revisados, "dias_antes": dias}


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
        # Segundo recordatorio: "última llamada" el mismo día del deadline @ 12:00
        sched.add_job(
            run_last_call_jobs, CronTrigger(hour=12, minute=0, timezone=tz),
            id="recordatorios_ultima_llamada", replace_existing=True, max_instances=1,
        )
        # Email resumen semanal: lunes @ 08:00 Europe/Madrid
        try:
            from email_resumen_semanal import send_weekly_summary as _weekly
            sched.add_job(
                _weekly, CronTrigger(day_of_week='mon', hour=8, minute=0, timezone=tz),
                id="resumen_semanal", replace_existing=True, max_instances=1,
            )
        except Exception as e:
            logger.warning(f"No se pudo registrar resumen_semanal: {e}")
        sched.start()
        _scheduler = sched
        logger.info("APScheduler iniciado: recordatorios diarios @ 09:00 + última llamada @ 12:00 + resumen semanal lunes @ 08:00 (Europe/Madrid)")
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
    info["dias_antes_tareas"] = _dias_tareas()
    return info


# ============ Endpoints admin: historial, suscripciones, errores ============

def _es_admin(current_user: dict) -> bool:
    profile = current_user.get('profile') or {}
    rol = profile.get('rol') or current_user.get('rol') or ''
    return rol in ('admin', 'director_general')


@router.post("/run-last-call")
async def run_last_call(current_user: dict = Depends(get_current_gestor)):
    """Ejecuta sólo el job 'última llamada' (mismo día del deadline). Admin/Director."""
    if not _es_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo admin o director_general.")
    return run_last_call_jobs()


@router.get("/historial")
async def historial(
    limit: int = 50,
    tipo: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    """Histórico de recordatorios enviados, ordenado por fecha DESC."""
    if not _es_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo admin o director_general.")
    try:
        q = supabase.table('recordatorios_enviados') \
            .select('id,usuario_id,tipo,entidad_id,dias_antes,fecha_objetivo,enviado_at') \
            .order('enviado_at', desc=True).limit(min(max(limit, 1), 500))
        if tipo:
            q = q.eq('tipo', tipo)
        rows = q.execute().data or []
        # Enriquecer con nombre del músico
        uids = list({r['usuario_id'] for r in rows if r.get('usuario_id')})
        users = {}
        if uids:
            ur = supabase.table('usuarios').select('id,nombre,apellidos,email') \
                .in_('id', uids).execute().data or []
            users = {u['id']: u for u in ur}
        out = []
        for r in rows:
            u = users.get(r.get('usuario_id'), {}) or {}
            r['usuario_nombre'] = (f"{u.get('apellidos','') or ''}, {u.get('nombre','') or ''}").strip(', ').strip() or u.get('email') or '—'
            out.append(r)
        return {"historial": out, "total": len(out)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suscriptores")
async def suscriptores(current_user: dict = Depends(get_current_gestor)):
    """Listado de suscripciones push activas con nombre del usuario y user_agent (truncado)."""
    if not _es_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo admin o director_general.")
    try:
        rows = supabase.table('push_suscripciones') \
            .select('id,usuario_id,user_agent,created_at') \
            .order('created_at', desc=True).execute().data or []
        uids = list({r['usuario_id'] for r in rows if r.get('usuario_id')})
        users = {}
        if uids:
            ur = supabase.table('usuarios').select('id,nombre,apellidos,email,rol') \
                .in_('id', uids).execute().data or []
            users = {u['id']: u for u in ur}
        out = []
        for r in rows:
            u = users.get(r.get('usuario_id'), {}) or {}
            out.append({
                "id": r['id'],
                "usuario_id": r['usuario_id'],
                "usuario_nombre": (f"{u.get('apellidos','') or ''}, {u.get('nombre','') or ''}").strip(', ').strip() or u.get('email') or '—',
                "rol": u.get('rol'),
                "user_agent": (r.get('user_agent') or '')[:120],
                "created_at": r.get('created_at'),
            })
        return {"suscriptores": out, "total": len(out)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/errores")
async def errores(current_user: dict = Depends(get_current_gestor)):
    """Devuelve el buffer en memoria con los últimos errores de envío push."""
    if not _es_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo admin o director_general.")
    return {"errores": get_recent_errors(), "total": len(get_recent_errors())}


@router.post("/send-weekly-summary")
async def send_weekly_summary_now(current_user: dict = Depends(get_current_gestor)):
    """Dispara manualmente el envío del resumen semanal a todos los admin/director_general."""
    if not _es_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo admin o director_general.")
    try:
        from email_resumen_semanal import send_weekly_summary
        return send_weekly_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weekly-stats")
async def weekly_stats(current_user: dict = Depends(get_current_gestor)):
    """Devuelve los stats que iría en el email semanal (para preview en UI)."""
    if not _es_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo admin o director_general.")
    try:
        from email_resumen_semanal import compute_stats
        return {"stats": compute_stats()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
