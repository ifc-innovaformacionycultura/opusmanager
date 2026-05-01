"""Bloque 1 — Auto-registro de músicos.

Endpoints:
  GET  /api/registro-publico/info/{token}        — público (info de la página)
  POST /api/registro-publico/{token}             — público (crea solicitud)
  GET  /api/gestor/solicitudes-registro          — gestor (listar)
  POST /api/gestor/solicitudes-registro/{id}/aprobar  — gestor
  POST /api/gestor/solicitudes-registro/{id}/rechazar — gestor
  GET  /api/admin/registro-publico/config        — admin
  PUT  /api/admin/registro-publico/config        — admin
"""
from __future__ import annotations
import re
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr

from supabase_client import supabase
from auth_utils import get_current_gestor
from config_app import org_nombre

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["registro-publico"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_admin(user: dict) -> bool:
    rol = (user or {}).get("rol") or ((user or {}).get("profile") or {}).get("rol")
    if rol in ("admin", "director_general"):
        return True
    email = ((user or {}).get("email") or ((user or {}).get("profile") or {}).get("email") or "").lower()
    return email == "admin@convocatorias.com"


def _email_valido(email: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email or ""))


# ============================================================================
# PÚBLICO — Auto-registro
# ============================================================================
@router.get("/registro-publico/info/{token}")
async def info_registro(token: str):
    rows = supabase.table("registro_publico_config").select("*").eq("token", token).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Enlace no válido")
    cfg = rows[0]
    if not cfg.get("activo"):
        raise HTTPException(status_code=410, detail="Registro público desactivado")
    return {
        "ok": True,
        "mensaje_bienvenida": cfg.get("mensaje_bienvenida"),
        "campos_requeridos": cfg.get("campos_requeridos") or ["nombre", "apellidos", "email", "instrumento", "password"],
        "org_nombre": org_nombre(),
    }


class SolicitudRegistroBody(BaseModel):
    nombre: str
    apellidos: str
    email: EmailStr
    instrumento: str
    telefono: Optional[str] = None
    password: str
    mensaje: Optional[str] = None


@router.post("/registro-publico/{token}")
async def crear_solicitud_publica(token: str, body: SolicitudRegistroBody):
    rows = supabase.table("registro_publico_config").select("*").eq("token", token).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Enlace no válido")
    if not rows[0].get("activo"):
        raise HTTPException(status_code=410, detail="Registro público desactivado")

    if not body.nombre.strip() or not body.apellidos.strip():
        raise HTTPException(status_code=400, detail="Nombre y apellidos son obligatorios")
    if not _email_valido(body.email):
        raise HTTPException(status_code=400, detail="Email no válido")
    if len(body.password or "") < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")

    email = body.email.lower().strip()
    # Comprobar duplicados
    existing_user = supabase.table("usuarios").select("id").eq("email", email).limit(1).execute().data or []
    if existing_user:
        raise HTTPException(status_code=409, detail="Este email ya está registrado")
    existing_req = supabase.table("solicitudes_registro").select("id,estado").eq("email", email).in_("estado", ["pendiente", "aprobado"]).limit(1).execute().data or []
    if existing_req:
        raise HTTPException(status_code=409, detail="Ya existe una solicitud con este email")

    fila = {
        "nombre": body.nombre.strip(),
        "apellidos": body.apellidos.strip(),
        "email": email,
        "instrumento": body.instrumento.strip(),
        "telefono": (body.telefono or "").strip() or None,
        "password_hash": body.password,  # texto plano temporal hasta aprobación
        "mensaje": (body.mensaje or "").strip() or None,
        "estado": "pendiente",
    }
    try:
        supabase.table("solicitudes_registro").insert(fila).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Notificar a gestores y admins via push (best-effort, no bloquea respuesta)
    try:
        from routes_push import _broadcast_to_role  # type: ignore
        _broadcast_to_role(  # type: ignore
            roles=["admin", "director_general", "gestor"],
            tipo="general",
            titulo="Nueva solicitud de registro",
            body=f"{fila['nombre']} {fila['apellidos']} solicita acceso como {fila['instrumento']}",
            url="/admin/musicos?tab=solicitudes",
        )
    except Exception as e:
        logger.warning(f"Push broadcast solicitud: {e}")

    return {"ok": True, "mensaje": "Tu solicitud ha sido recibida. El equipo de IFC la revisará y recibirás un email cuando sea aprobada."}


# ============================================================================
# GESTOR — Listar / aprobar / rechazar solicitudes
# ============================================================================
@router.get("/gestor/solicitudes-registro")
async def listar_solicitudes(estado: Optional[str] = None, current_user: dict = Depends(get_current_gestor)):
    q = supabase.table("solicitudes_registro").select("id,nombre,apellidos,email,instrumento,telefono,mensaje,estado,usuario_id,gestor_aprobador_id,motivo_rechazo,respondido_at,created_at,updated_at").order("created_at", desc=True)
    if estado:
        q = q.eq("estado", estado)
    try:
        rows = q.execute().data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    pendientes = sum(1 for r in rows if (r.get("estado") or "").lower() == "pendiente")
    return {"solicitudes": rows, "pendientes": pendientes}


def _send_email_sync(to_email: str, subject: str, html: str, tipo: str, usuario_id: Optional[str] = None):
    """Bridge sync para llamar al async _send_email desde código async existente."""
    from email_service import _send_email

    async def _runner():
        return await _send_email(to_email, subject, html, tipo=tipo, usuario_id=usuario_id)

    def _sync():
        try:
            return asyncio.run(_runner())
        except Exception as e:
            return {"sent": False, "reason": str(e)[:160]}

    try:
        asyncio.get_running_loop()
        with ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(_sync).result(timeout=20)
    except RuntimeError:
        return _sync()


@router.post("/gestor/solicitudes-registro/{solicitud_id}/aprobar")
async def aprobar_solicitud(solicitud_id: str, current_user: dict = Depends(get_current_gestor)):
    rows = supabase.table("solicitudes_registro").select("*").eq("id", solicitud_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    s = rows[0]
    if s.get("estado") != "pendiente":
        raise HTTPException(status_code=400, detail=f"La solicitud ya está {s.get('estado')}")
    if not s.get("password_hash"):
        raise HTTPException(status_code=400, detail="La solicitud no tiene contraseña almacenada")

    # Crear usuario en Supabase Auth con su contraseña
    try:
        auth_res = supabase.auth.admin.create_user({
            "email": s["email"],
            "password": s["password_hash"],
            "email_confirm": True,
        })
        auth_user = auth_res.user if hasattr(auth_res, "user") else (auth_res.get("user") if isinstance(auth_res, dict) else None)
        if not auth_user or not getattr(auth_user, "id", None):
            raise Exception("No se pudo crear usuario en Auth")
        auth_uid = auth_user.id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando usuario en Auth: {str(e)[:200]}")

    # INSERT en tabla usuarios
    new_user_id = str(uuid.uuid4())
    try:
        supabase.table("usuarios").insert({
            "id": new_user_id,
            "user_id": auth_uid,
            "nombre": s["nombre"],
            "apellidos": s["apellidos"],
            "email": s["email"],
            "instrumento": s["instrumento"],
            "telefono": s.get("telefono"),
            "rol": "musico",
            "estado": "activo",
            "estado_invitacion": "activado",
            "fecha_activacion": _now(),
            "requiere_cambio_password": False,
        }).execute()
    except Exception as e:
        # Rollback Auth
        try:
            supabase.auth.admin.delete_user(auth_uid)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Error creando usuario: {str(e)[:200]}")

    gestor_id = (current_user.get("profile") or {}).get("id") or current_user.get("id")
    # Actualizar solicitud y borrar password_hash (sensible)
    supabase.table("solicitudes_registro").update({
        "estado": "aprobado",
        "usuario_id": new_user_id,
        "gestor_aprobador_id": gestor_id,
        "respondido_at": _now(),
        "password_hash": None,
        "updated_at": _now(),
    }).eq("id", solicitud_id).execute()

    # Email de bienvenida
    portal_url = "https://opusmanager.app/portal"
    try:
        import os
        portal_url = (os.environ.get("APP_URL") or portal_url).rstrip("/") + "/portal"
    except Exception:
        pass
    try:
        from email_service import _send_email  # type: ignore
        html = f"""<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f1f5f9;padding:24px">
        <div style="max-width:560px;margin:auto;background:#fff;border-radius:8px;overflow:hidden">
          <div style="background:#1A3A5C;padding:18px 24px"><div style="color:#C9920A;font-size:12px;letter-spacing:3px;font-weight:700">{org_nombre()}</div>
            <h1 style="color:#fff;margin:6px 0 0;font-size:20px">¡Bienvenido/a a la plataforma!</h1></div>
          <div style="padding:22px 24px">
            <p>Hola <strong>{s["nombre"]}</strong>,</p>
            <p>Tu solicitud de registro ha sido aprobada. Ya puedes acceder al portal con tu email <strong>{s["email"]}</strong> y la contraseña que elegiste durante el registro.</p>
            <p style="text-align:center;margin:24px 0"><a href="{portal_url}" style="background:#1A3A5C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px">Ir al portal del músico</a></p>
            <p style="color:#94a3b8;font-size:12px">Mensaje automático · {org_nombre()}</p>
          </div>
        </div></body></html>"""
        _send_email_sync(s["email"], f"[{org_nombre()}] Acceso aprobado", html, tipo="bienvenida_aprobacion", usuario_id=new_user_id)
    except Exception as e:
        logger.warning(f"Email bienvenida: {e}")

    # Push al músico (best-effort)
    try:
        from routes_push import _send_push_to_user  # type: ignore
        _send_push_to_user(new_user_id, "convocatoria", "¡Bienvenido/a!", "Tu acceso al portal ha sido aprobado.", "/portal")  # type: ignore
    except Exception:
        pass

    return {"ok": True, "usuario_id": new_user_id}


class RechazarBody(BaseModel):
    motivo: str


@router.post("/gestor/solicitudes-registro/{solicitud_id}/rechazar")
async def rechazar_solicitud(solicitud_id: str, body: RechazarBody, current_user: dict = Depends(get_current_gestor)):
    rows = supabase.table("solicitudes_registro").select("*").eq("id", solicitud_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    s = rows[0]
    if s.get("estado") != "pendiente":
        raise HTTPException(status_code=400, detail=f"La solicitud ya está {s.get('estado')}")
    motivo = (body.motivo or "").strip()
    if not motivo:
        raise HTTPException(status_code=400, detail="Indica un motivo de rechazo")

    gestor_id = (current_user.get("profile") or {}).get("id") or current_user.get("id")
    supabase.table("solicitudes_registro").update({
        "estado": "rechazado",
        "motivo_rechazo": motivo,
        "gestor_aprobador_id": gestor_id,
        "respondido_at": _now(),
        "password_hash": None,
        "updated_at": _now(),
    }).eq("id", solicitud_id).execute()

    # Email al músico
    try:
        from email_service import _send_email  # type: ignore
        html = f"""<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f1f5f9;padding:24px">
        <div style="max-width:560px;margin:auto;background:#fff;border-radius:8px;overflow:hidden">
          <div style="background:#1A3A5C;padding:18px 24px"><div style="color:#C9920A;font-size:12px;letter-spacing:3px;font-weight:700">{org_nombre()}</div>
            <h1 style="color:#fff;margin:6px 0 0;font-size:20px">Solicitud no aprobada</h1></div>
          <div style="padding:22px 24px">
            <p>Hola <strong>{s["nombre"]}</strong>,</p>
            <p>Tu solicitud de acceso a la plataforma no ha podido ser aprobada por el siguiente motivo:</p>
            <blockquote style="background:#f1f5f9;border-left:4px solid #1A3A5C;padding:12px 16px;margin:16px 0;color:#0f172a">{motivo}</blockquote>
            <p>Si crees que se trata de un error, puedes contactar con el equipo gestor.</p>
            <p style="color:#94a3b8;font-size:12px">Mensaje automático · {org_nombre()}</p>
          </div>
        </div></body></html>"""
        _send_email_sync(s["email"], f"[{org_nombre()}] Solicitud no aprobada", html, tipo="rechazo_registro")
    except Exception as e:
        logger.warning(f"Email rechazo: {e}")

    return {"ok": True}


# ============================================================================
# ADMIN — Configuración del enlace
# ============================================================================
@router.get("/admin/registro-publico/config")
async def get_config_publica(current_user: dict = Depends(get_current_gestor)):
    """Lectura abierta a cualquier gestor (necesaria para mostrar enlace en otros panels)."""
    rows = supabase.table("registro_publico_config").select("*").order("created_at", desc=False).limit(1).execute().data or []
    if not rows:
        # Crear fila singleton si no existe
        new_token = str(uuid.uuid4())
        r = supabase.table("registro_publico_config").insert({"activo": True, "token": new_token}).execute()
        rows = r.data or []
    return {"config": (rows or [{}])[0], "editable": _is_admin(current_user)}


class ConfigUpdate(BaseModel):
    activo: Optional[bool] = None
    mensaje_bienvenida: Optional[str] = None
    regenerar_token: Optional[bool] = False


@router.put("/admin/registro-publico/config")
async def actualizar_config_publica(data: ConfigUpdate, current_user: dict = Depends(get_current_gestor)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo admin o director general")
    rows = supabase.table("registro_publico_config").select("id").order("created_at", desc=False).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Configuración no inicializada")
    payload: Dict[str, Any] = {"updated_at": _now()}
    if data.activo is not None:
        payload["activo"] = data.activo
    if data.mensaje_bienvenida is not None:
        payload["mensaje_bienvenida"] = data.mensaje_bienvenida
    if data.regenerar_token:
        payload["token"] = str(uuid.uuid4())
    supabase.table("registro_publico_config").update(payload).eq("id", rows[0]["id"]).execute()
    out = supabase.table("registro_publico_config").select("*").eq("id", rows[0]["id"]).limit(1).execute().data or []
    return {"ok": True, "config": (out or [{}])[0]}
