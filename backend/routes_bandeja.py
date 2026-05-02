"""Bandeja de Entrada — Integración Gmail (IMAP + SMTP via Resend).

Endpoints principales:
  GET    /api/gestor/bandeja/emails            — Listar emails (filtros: carpeta, leido, destacado, musico_id, q)
  GET    /api/gestor/bandeja/emails/{id}       — Detalle de un email
  POST   /api/gestor/bandeja/sincronizar       — Forzar sync IMAP manual
  POST   /api/gestor/bandeja/responder         — Responder / enviar vía Resend (registra en email_inbox)
  PUT    /api/gestor/bandeja/emails/{id}/leido — Marcar leído/no-leído
  PUT    /api/gestor/bandeja/emails/{id}/destacar — Marcar destacado
  DELETE /api/gestor/bandeja/emails/{id}       — Archivar (soft)

  GET    /api/admin/bandeja/config             — Obtener credenciales IMAP/SMTP
  PUT    /api/admin/bandeja/config             — Actualizar credenciales IMAP (admin)
  POST   /api/admin/bandeja/test-conexion      — Validar IMAP login

Scheduler:
  sync_gmail_inbox_job() — ejecutado cada 15 min por APScheduler.
"""
from __future__ import annotations

import asyncio
import email
import email.utils
import imaplib
import logging
import re
from datetime import datetime, timezone
from email.header import decode_header, make_header
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field

from auth_utils import get_current_gestor, is_super_admin
from config_app import get_config, invalidate_config
from email_service import _send_email  # reutiliza Resend
from supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["bandeja"])


# ============================================================================
# Helpers
# ============================================================================
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_admin(user: Dict):
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden modificar la configuración de la bandeja")


def _decode_header(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value or ""


def _parse_addr(value: Optional[str]) -> Tuple[str, str]:
    """Devuelve (nombre, email)."""
    if not value:
        return ("", "")
    try:
        name, addr = email.utils.parseaddr(_decode_header(value))
        return (name or "", (addr or "").lower())
    except Exception:
        return ("", (value or "").lower())


def _extract_bodies(msg: email.message.Message) -> Tuple[str, str]:
    """Devuelve (texto, html)."""
    text_body = ""
    html_body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = str(part.get("Content-Disposition") or "")
            if "attachment" in disp.lower():
                continue
            try:
                payload = part.get_payload(decode=True)
                if payload is None:
                    continue
                charset = part.get_content_charset() or "utf-8"
                decoded = payload.decode(charset, errors="replace")
            except Exception:
                continue
            if ctype == "text/plain" and not text_body:
                text_body = decoded
            elif ctype == "text/html" and not html_body:
                html_body = decoded
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload is not None:
                charset = msg.get_content_charset() or "utf-8"
                decoded = payload.decode(charset, errors="replace")
                if msg.get_content_type() == "text/html":
                    html_body = decoded
                else:
                    text_body = decoded
        except Exception:
            pass
    return (text_body, html_body)


def _extract_attachments_meta(msg: email.message.Message) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    if not msg.is_multipart():
        return items
    for part in msg.walk():
        disp = str(part.get("Content-Disposition") or "")
        if "attachment" not in disp.lower() and not part.get_filename():
            continue
        filename = _decode_header(part.get_filename() or "adjunto")
        ctype = part.get_content_type() or "application/octet-stream"
        try:
            payload = part.get_payload(decode=True)
            size = len(payload) if payload else 0
        except Exception:
            size = 0
        items.append({"nombre": filename, "tipo": ctype, "tamano": size})
    return items


def _match_musico_by_email(addr: str) -> Optional[str]:
    """Devuelve musico_id si hay un usuario con ese email."""
    if not addr:
        return None
    try:
        rows = supabase.table("usuarios").select("id,rol").eq("email", addr.lower()).limit(1).execute().data or []
        if rows and rows[0].get("rol") == "musico":
            return rows[0]["id"]
    except Exception as e:
        logger.warning(f"_match_musico_by_email: {e}")
    return None


# ============================================================================
# IMAP Sync
# ============================================================================
def _get_imap_creds() -> Dict[str, Any]:
    cfg = get_config(force=False) or {}
    return {
        "host": (cfg.get("gmail_imap_host") or "imap.gmail.com").strip(),
        "port": int(cfg.get("gmail_imap_port") or 993),
        "user": (cfg.get("gmail_imap_user") or "").strip(),
        "password": (cfg.get("gmail_imap_app_password") or "").strip(),
        "enabled": bool(cfg.get("gmail_sync_enabled")),
        "folder": (cfg.get("gmail_sync_folder") or "INBOX").strip(),
        "last_uid": (cfg.get("gmail_sync_last_uid") or "").strip(),
    }


def _sync_imap_inbox(force_all: bool = False) -> Dict[str, Any]:
    """Conecta a IMAP, descarga mensajes nuevos y los inserta en email_inbox.
    Devuelve dict con métricas. No lanza excepciones — devuelve error en dict.
    """
    creds = _get_imap_creds()
    if not creds["user"] or not creds["password"]:
        return {"ok": False, "error": "Credenciales IMAP no configuradas", "nuevos": 0}
    if not creds["enabled"]:
        return {"ok": False, "error": "Sincronización IMAP deshabilitada (actívala desde Configuración)", "nuevos": 0}

    nuevos = 0
    errores: List[str] = []
    max_uid_seen = creds["last_uid"]
    try:
        M = imaplib.IMAP4_SSL(creds["host"], creds["port"])
        try:
            M.login(creds["user"], creds["password"])
        except imaplib.IMAP4.error as le:
            return {"ok": False, "error": f"Login IMAP falló: {le}", "nuevos": 0}

        M.select(creds["folder"], readonly=True)

        # Rango UID: desde (last_uid + 1) o todo si force_all
        search_criteria = "ALL"
        if creds["last_uid"] and not force_all:
            try:
                next_uid = int(creds["last_uid"]) + 1
                search_criteria = f"UID {next_uid}:*"
            except ValueError:
                pass

        typ, data = M.uid("search", None, search_criteria)
        if typ != "OK" or not data or not data[0]:
            M.logout()
            return {"ok": True, "nuevos": 0, "mensaje": "No hay correos nuevos"}

        uids = data[0].split()
        # Limitar a últimos 100 para evitar sobrecargar en primer sync
        if force_all and len(uids) > 100:
            uids = uids[-100:]

        for uid_bytes in uids:
            uid = uid_bytes.decode() if isinstance(uid_bytes, bytes) else str(uid_bytes)
            # Salta si ya existe
            try:
                existing = supabase.table("email_inbox").select("id").eq("raw_headers->>uid", uid).limit(1).execute().data or []
                if existing:
                    max_uid_seen = uid
                    continue
            except Exception:
                pass

            try:
                typ, msg_data = M.uid("fetch", uid_bytes, "(RFC822)")
                if typ != "OK" or not msg_data or not msg_data[0]:
                    continue
                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)

                msg_id = (msg.get("Message-ID") or "").strip() or f"<uid-{uid}@local>"
                # De-dupe por message_id
                try:
                    dup = supabase.table("email_inbox").select("id").eq("message_id", msg_id).limit(1).execute().data or []
                    if dup:
                        max_uid_seen = uid
                        continue
                except Exception:
                    pass

                asunto = _decode_header(msg.get("Subject"))
                from_name, from_email = _parse_addr(msg.get("From"))
                to_name, to_email = _parse_addr(msg.get("To"))
                cc_name, cc_email = _parse_addr(msg.get("Cc"))

                date_raw = msg.get("Date")
                fecha = None
                if date_raw:
                    try:
                        dt = email.utils.parsedate_to_datetime(date_raw)
                        if dt.tzinfo is None:
                            dt = dt.replace(tzinfo=timezone.utc)
                        fecha = dt.astimezone(timezone.utc).isoformat()
                    except Exception:
                        fecha = _now_iso()
                else:
                    fecha = _now_iso()

                texto, html = _extract_bodies(msg)
                adjuntos = _extract_attachments_meta(msg)

                payload = {
                    "message_id": msg_id[:500],
                    "thread_id": (msg.get("Thread-Index") or msg.get("References") or msg_id)[:500] if msg.get("Thread-Index") or msg.get("References") else msg_id[:500],
                    "direccion": "entrante",
                    "remitente_nombre": from_name[:255],
                    "remitente_email": from_email[:255],
                    "destinatario": (to_email or creds["user"])[:255],
                    "cc": cc_email[:255] if cc_email else None,
                    "asunto": (asunto or "(sin asunto)")[:500],
                    "cuerpo_texto": texto,
                    "cuerpo_html": html or None,
                    "fecha_envio": fecha,
                    "leido": False,
                    "destacado": False,
                    "archivado": False,
                    "carpeta": "INBOX",
                    "tiene_adjuntos": bool(adjuntos),
                    "adjuntos_meta": adjuntos,
                    "musico_id": _match_musico_by_email(from_email),
                    "raw_headers": {"uid": uid, "folder": creds["folder"]},
                }

                supabase.table("email_inbox").insert(payload).execute()
                nuevos += 1
                max_uid_seen = uid

                # Auto-log en CRM si hay músico
                if payload["musico_id"]:
                    try:
                        from routes_crm_contactos import log_contacto_auto
                        log_contacto_auto(
                            usuario_id=payload["musico_id"],
                            tipo="email",
                            estado_respuesta="recibido",
                            notas=f"[Entrante] {payload['asunto']}",
                        )
                    except Exception as ce:
                        logger.warning(f"CRM auto-log bandeja: {ce}")

            except Exception as inner:
                errores.append(f"UID {uid}: {inner}")
                logger.warning(f"Error procesando UID {uid}: {inner}")

        try:
            M.logout()
        except Exception:
            pass

        # Actualizar last_uid en configuracion_app
        try:
            cfg = get_config(force=True)
            if cfg and cfg.get("id"):
                supabase.table("configuracion_app").update({
                    "gmail_sync_last_uid": str(max_uid_seen),
                    "gmail_sync_last_run": _now_iso(),
                }).eq("id", cfg["id"]).execute()
                invalidate_config()
        except Exception as e:
            logger.warning(f"No se pudo actualizar gmail_sync_last_uid: {e}")

        return {"ok": True, "nuevos": nuevos, "errores": errores, "last_uid": max_uid_seen}

    except Exception as e:
        logger.error(f"Sync IMAP falló: {e}")
        return {"ok": False, "error": str(e), "nuevos": nuevos}


# ============================================================================
# Scheduler job
# ============================================================================
def sync_gmail_inbox_job():
    """Job APScheduler cada 15 min."""
    try:
        result = _sync_imap_inbox(force_all=False)
        if result.get("ok"):
            logger.info(f"[GMAIL SYNC] {result.get('nuevos', 0)} correos nuevos")
        else:
            logger.warning(f"[GMAIL SYNC] {result.get('error')}")
    except Exception as e:
        logger.error(f"[GMAIL SYNC] Excepción no controlada: {e}")


# ============================================================================
# Schemas
# ============================================================================
class ResponderPayload(BaseModel):
    destinatario: EmailStr
    asunto: str = Field(..., min_length=1, max_length=500)
    cuerpo_html: str
    cc: Optional[EmailStr] = None
    en_respuesta_a: Optional[str] = None  # email_inbox.id
    musico_id: Optional[str] = None


class MarcarLeidoPayload(BaseModel):
    leido: bool = True


class MarcarDestacadoPayload(BaseModel):
    destacado: bool = True


class ConfigBandejaPayload(BaseModel):
    gmail_imap_host: Optional[str] = None
    gmail_imap_port: Optional[int] = None
    gmail_imap_user: Optional[EmailStr] = None
    gmail_imap_app_password: Optional[str] = None
    gmail_sync_enabled: Optional[bool] = None
    gmail_sync_folder: Optional[str] = None
    email_firma_html: Optional[str] = None


def _firma_por_defecto() -> str:
    """Firma por defecto construida con datos de la organización."""
    cfg = get_config() or {}
    org = (cfg.get("org_nombre") or "").strip()
    dir_ = (cfg.get("org_direccion") or "").strip()
    tel = (cfg.get("org_telefono") or "").strip()
    web = (cfg.get("org_web") or "").strip()
    email = (cfg.get("org_email") or "").strip()
    lineas = [f"<strong>{org}</strong>" if org else ""]
    if dir_:
        lineas.append(dir_)
    tel_email = " · ".join([x for x in [tel, email] if x])
    if tel_email:
        lineas.append(tel_email)
    if web:
        lineas.append(f'<a href="{web}" style="color:#1A3A5C">{web}</a>')
    body = "<br/>".join([ln for ln in lineas if ln])
    if not body:
        return ""
    return (
        '<br/><br/>'
        '<div style="border-top:2px solid #C9920A;padding-top:12px;margin-top:16px;color:#1A3A5C;font-size:13px;font-family:Arial,sans-serif">'
        f'{body}'
        '</div>'
    )


def _firma_actual() -> str:
    """Devuelve la firma configurada o la por defecto."""
    cfg = get_config() or {}
    custom = (cfg.get("email_firma_html") or "").strip()
    if custom:
        return f"<br/><br/>{custom}"
    return _firma_por_defecto()


# ============================================================================
# Endpoints — Bandeja
# ============================================================================
@router.get("/gestor/bandeja/emails")
async def listar_emails(
    carpeta: str = Query("INBOX"),
    leido: Optional[bool] = None,
    destacado: Optional[bool] = None,
    musico_id: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: Dict = Depends(get_current_gestor),
):
    try:
        query = supabase.table("email_inbox").select(
            "id,message_id,thread_id,direccion,remitente_nombre,remitente_email,"
            "destinatario,cc,asunto,fecha_envio,leido,destacado,archivado,carpeta,"
            "tiene_adjuntos,musico_id,respondido,en_respuesta_a,created_at"
        )
        if carpeta == "DESTACADOS":
            query = query.eq("destacado", True).eq("archivado", False)
        elif carpeta == "SENT":
            query = query.eq("direccion", "saliente").eq("archivado", False)
        elif carpeta == "INBOX":
            query = query.eq("direccion", "entrante").eq("archivado", False)
        elif carpeta == "ARCHIVED":
            query = query.eq("archivado", True)
        else:
            query = query.eq("carpeta", carpeta).eq("archivado", False)

        if leido is not None:
            query = query.eq("leido", leido)
        if destacado is not None:
            query = query.eq("destacado", destacado)
        if musico_id:
            query = query.eq("musico_id", musico_id)
        if q:
            safe = q.replace("%", "").replace(",", " ")
            query = query.or_(f"asunto.ilike.%{safe}%,remitente_email.ilike.%{safe}%,remitente_nombre.ilike.%{safe}%")

        r = query.order("fecha_envio", desc=True).range(offset, offset + limit - 1).execute()
        emails = r.data or []

        # Contadores globales
        no_leidos = supabase.table("email_inbox").select("id", count="exact").eq("direccion", "entrante").eq("leido", False).eq("archivado", False).execute()
        total_inbox = supabase.table("email_inbox").select("id", count="exact").eq("direccion", "entrante").eq("archivado", False).execute()
        total_destacados = supabase.table("email_inbox").select("id", count="exact").eq("destacado", True).eq("archivado", False).execute()
        total_enviados = supabase.table("email_inbox").select("id", count="exact").eq("direccion", "saliente").eq("archivado", False).execute()

        return {
            "emails": emails,
            "contadores": {
                "no_leidos": getattr(no_leidos, "count", 0) or 0,
                "inbox": getattr(total_inbox, "count", 0) or 0,
                "destacados": getattr(total_destacados, "count", 0) or 0,
                "enviados": getattr(total_enviados, "count", 0) or 0,
            },
        }
    except Exception as e:
        logger.error(f"listar_emails: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gestor/bandeja/emails/{email_id}")
async def obtener_email(email_id: str, user: Dict = Depends(get_current_gestor)):
    rows = supabase.table("email_inbox").select("*").eq("id", email_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Email no encontrado")
    em = rows[0]
    # Marcar leído automáticamente al abrir (solo entrantes)
    if em.get("direccion") == "entrante" and not em.get("leido"):
        try:
            supabase.table("email_inbox").update({"leido": True}).eq("id", email_id).execute()
            em["leido"] = True
        except Exception:
            pass

    # Hilo / conversación por thread_id o en_respuesta_a
    hilo = []
    thread = em.get("thread_id")
    if thread:
        try:
            hilo_rows = supabase.table("email_inbox").select(
                "id,asunto,remitente_email,direccion,fecha_envio"
            ).eq("thread_id", thread).neq("id", email_id).order("fecha_envio", desc=False).execute().data or []
            hilo = hilo_rows
        except Exception:
            pass

    return {"email": em, "hilo": hilo}


@router.post("/gestor/bandeja/sincronizar")
async def sincronizar_ahora(user: Dict = Depends(get_current_gestor)):
    _require_admin(user)
    result = await asyncio.to_thread(_sync_imap_inbox, False)
    return result


@router.post("/gestor/bandeja/responder")
async def responder_email(payload: ResponderPayload, user: Dict = Depends(get_current_gestor)):
    # Añadir firma institucional al cuerpo
    firma = _firma_actual()
    cuerpo_final = (payload.cuerpo_html or "") + firma

    # Enviar vía Resend (reutiliza pipeline existente)
    send_res = await _send_email(
        to_email=payload.destinatario,
        subject=payload.asunto,
        html=cuerpo_final,
        tipo="bandeja_respuesta",
        usuario_id=payload.musico_id,
    )

    # Registrar en email_inbox como saliente
    parent_thread = None
    if payload.en_respuesta_a:
        try:
            p = supabase.table("email_inbox").select("thread_id,musico_id").eq("id", payload.en_respuesta_a).limit(1).execute().data or []
            if p:
                parent_thread = p[0].get("thread_id")
        except Exception:
            pass

    try:
        row = {
            "message_id": f"<resend-{send_res.get('email_id') or _now_iso()}@opus-manager>",
            "thread_id": parent_thread,
            "direccion": "saliente",
            "remitente_nombre": (user.get("profile") or {}).get("nombre") or "",
            "remitente_email": ((user.get("profile") or {}).get("email") or user.get("email") or "").lower(),
            "destinatario": payload.destinatario,
            "cc": payload.cc,
            "asunto": payload.asunto[:500],
            "cuerpo_html": cuerpo_final,
            "fecha_envio": _now_iso(),
            "leido": True,
            "carpeta": "SENT",
            "musico_id": payload.musico_id,
            "en_respuesta_a": payload.en_respuesta_a,
            "raw_headers": {"resend_id": send_res.get("email_id"), "via": "resend"},
        }
        supabase.table("email_inbox").insert(row).execute()
    except Exception as e:
        logger.warning(f"No se pudo registrar saliente en email_inbox: {e}")

    # Marcar el original como respondido
    if payload.en_respuesta_a:
        try:
            supabase.table("email_inbox").update({"respondido": True}).eq("id", payload.en_respuesta_a).execute()
        except Exception:
            pass

    return {"ok": send_res.get("sent", False), "detalle": send_res}


@router.put("/gestor/bandeja/emails/{email_id}/leido")
async def marcar_leido(email_id: str, payload: MarcarLeidoPayload, user: Dict = Depends(get_current_gestor)):
    supabase.table("email_inbox").update({"leido": payload.leido}).eq("id", email_id).execute()
    return {"ok": True}


@router.put("/gestor/bandeja/emails/{email_id}/destacar")
async def marcar_destacado(email_id: str, payload: MarcarDestacadoPayload, user: Dict = Depends(get_current_gestor)):
    supabase.table("email_inbox").update({"destacado": payload.destacado}).eq("id", email_id).execute()
    return {"ok": True}


@router.delete("/gestor/bandeja/emails/{email_id}")
async def archivar_email(email_id: str, user: Dict = Depends(get_current_gestor)):
    supabase.table("email_inbox").update({"archivado": True}).eq("id", email_id).execute()
    return {"ok": True}


@router.post("/gestor/bandeja/marcar-todos-leidos")
async def marcar_todos_leidos(
    carpeta: str = Query("INBOX"),
    user: Dict = Depends(get_current_gestor),
):
    """Marca todos los emails no leídos de la carpeta indicada como leídos."""
    try:
        q = supabase.table("email_inbox").update({"leido": True}).eq("leido", False).eq("archivado", False)
        if carpeta == "DESTACADOS":
            q = q.eq("destacado", True)
        elif carpeta == "SENT":
            q = q.eq("direccion", "saliente")
        elif carpeta == "INBOX":
            q = q.eq("direccion", "entrante")
        elif carpeta == "ARCHIVED":
            # reabrir leído solo sobre archivados no es lo habitual, pero se soporta
            q = supabase.table("email_inbox").update({"leido": True}).eq("leido", False).eq("archivado", True)
        r = q.execute()
        n = len(r.data or [])
        return {"ok": True, "actualizados": n}
    except Exception as e:
        logger.error(f"marcar_todos_leidos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Endpoints — Configuración Admin
# ============================================================================
@router.get("/admin/bandeja/config")
async def obtener_config_bandeja(user: Dict = Depends(get_current_gestor)):
    _require_admin(user)
    cfg = get_config(force=True) or {}
    # Enmascarar la app_password
    app_pwd = cfg.get("gmail_imap_app_password") or ""
    masked = ("•" * max(0, len(app_pwd) - 4) + app_pwd[-4:]) if app_pwd else ""
    return {
        "gmail_imap_host": cfg.get("gmail_imap_host") or "imap.gmail.com",
        "gmail_imap_port": cfg.get("gmail_imap_port") or 993,
        "gmail_imap_user": cfg.get("gmail_imap_user") or "",
        "gmail_imap_app_password_masked": masked,
        "gmail_imap_app_password_configurada": bool(app_pwd),
        "gmail_sync_enabled": bool(cfg.get("gmail_sync_enabled")),
        "gmail_sync_folder": cfg.get("gmail_sync_folder") or "INBOX",
        "gmail_sync_last_run": cfg.get("gmail_sync_last_run"),
        "gmail_sync_last_uid": cfg.get("gmail_sync_last_uid"),
        "email_firma_html": cfg.get("email_firma_html") or "",
        "email_firma_preview_default": _firma_por_defecto(),
    }


@router.put("/admin/bandeja/config")
async def actualizar_config_bandeja(data: ConfigBandejaPayload, user: Dict = Depends(get_current_gestor)):
    _require_admin(user)
    cfg = get_config(force=True)
    if not cfg or not cfg.get("id"):
        raise HTTPException(status_code=500, detail="No existe fila inicial en configuracion_app")

    payload = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    # Si la contraseña vino vacía, no la sobrescribas
    if "gmail_imap_app_password" in payload and not str(payload["gmail_imap_app_password"]).strip():
        payload.pop("gmail_imap_app_password")

    if payload:
        payload["updated_at"] = _now_iso()
        try:
            supabase.table("configuracion_app").update(payload).eq("id", cfg["id"]).execute()
        except Exception as e:
            # Fallback: si falla por columna inexistente (p.ej. email_firma_html aún no migrada)
            msg = str(e).lower()
            if "email_firma_html" in payload and ("column" in msg or "does not exist" in msg or "schema" in msg):
                logger.warning("email_firma_html no existe todavía en configuracion_app — reintentando sin firma")
                payload.pop("email_firma_html", None)
                if len(payload) > 1:  # más que solo updated_at
                    supabase.table("configuracion_app").update(payload).eq("id", cfg["id"]).execute()
                raise HTTPException(status_code=400, detail="La columna 'email_firma_html' no existe aún en configuracion_app. Ejecuta la SQL de migración y vuelve a intentarlo.")
            raise
        invalidate_config()
    return {"ok": True}


@router.post("/admin/bandeja/test-conexion")
async def test_conexion(user: Dict = Depends(get_current_gestor)):
    _require_admin(user)
    creds = _get_imap_creds()
    if not creds["user"] or not creds["password"]:
        raise HTTPException(status_code=400, detail="Faltan credenciales IMAP (usuario/contraseña de aplicación)")
    try:
        def _connect():
            M = imaplib.IMAP4_SSL(creds["host"], creds["port"])
            M.login(creds["user"], creds["password"])
            M.select(creds["folder"], readonly=True)
            typ, data = M.status(creds["folder"], "(MESSAGES UNSEEN)")
            M.logout()
            return {"ok": True, "status": data[0].decode() if data and data[0] else ""}
        result = await asyncio.to_thread(_connect)
        return result
    except imaplib.IMAP4.error as le:
        return {"ok": False, "error": f"Login IMAP falló: {le}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
