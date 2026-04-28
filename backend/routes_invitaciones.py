"""Sistema de invitación de músicos — Bloque 2.

Flujo:
- POST /api/gestor/musicos/{id}/invitar  → genera token, marca 'invitado', envía email.
- GET  /api/portal/activar/{token}       → datos del músico para la página de bienvenida.
- POST /api/portal/activar/{token}       → fija contraseña, marca 'activado'.
"""
import os
import uuid
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field

from supabase_client import supabase
from auth_utils import get_current_gestor
from email_service import _send_email, _get_app_url

router_gestor = APIRouter(prefix="/api/gestor", tags=["invitaciones"])
router_portal = APIRouter(prefix="/api/portal", tags=["invitaciones_portal"])


# ============ Modelos ============

class InvitarRequest(BaseModel):
    enviar_email: bool = True


class ActivarRequest(BaseModel):
    password: str = Field(min_length=8, max_length=72)


# ============ Email HTML ============

def build_invitacion_email_html(nombre: str, url_activacion: str) -> str:
    safe = nombre or "músico"
    return f"""
<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td style="background:linear-gradient(90deg,#1e293b,#334155);padding:24px 32px;color:#ffffff">
          <h1 style="margin:0;font-size:22px;letter-spacing:0.5px">IFC · OPUS MANAGER</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:0.85">Portal de músicos</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a">¡Hola {safe}!</h2>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155">
            Te invitamos a unirte al <strong>portal de músicos de IFC</strong>.<br/>
            Desde aquí podrás consultar tus convocatorias, confirmar disponibilidad,
            descargar partituras y seguir tus pagos en tiempo real.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin:24px 0">
            <tr><td style="background:#1e293b;border-radius:10px">
              <a href="{url_activacion}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px">
                🎼  Acceder a mi portal
              </a>
            </td></tr>
          </table>

          <p style="margin:16px 0;font-size:13px;line-height:1.55;color:#334155">
            Al hacer clic en el botón podrás <strong>configurar tu contraseña</strong>
            y acceder a tus convocatorias.
          </p>

          <p style="margin:24px 0 0;font-size:12px;color:#64748b">
            Si no puedes pulsar el botón, copia y pega esta URL en tu navegador:<br/>
            <span style="color:#334155;word-break:break-all">{url_activacion}</span>
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">
          Esta invitación es personal e intransferible. Si crees que la has recibido por error, ignora este correo.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
""".strip()


# ============ Endpoints Gestor ============

@router_gestor.post("/musicos/{musico_id}/invitar")
async def invitar_musico(
    musico_id: str,
    data: InvitarRequest,
    current_user: dict = Depends(get_current_gestor),
):
    """Genera token de invitación, marca al músico como 'invitado' y opcionalmente envía email."""
    # 1) Cargar músico
    try:
        r = supabase.table('usuarios').select('id,email,nombre,apellidos,rol,estado_invitacion,token_invitacion') \
            .eq('id', musico_id).single().execute()
        musico = r.data
    except Exception:
        musico = None
    if not musico:
        raise HTTPException(status_code=404, detail="Músico no encontrado")
    if musico.get('rol') != 'musico':
        raise HTTPException(status_code=400, detail="El usuario no es un músico")

    # 2) Generar token UUID nuevo y guardar
    token = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        supabase.table('usuarios').update({
            "token_invitacion": token,
            "estado_invitacion": "invitado",
            "fecha_invitacion": now_iso,
        }).eq('id', musico_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar token: {str(e)}")

    # 3) URL pública de activación
    app_url = _get_app_url().rstrip('/')
    url_activacion = f"{app_url}/activar/{token}"

    # 4) Enviar email (best-effort)
    email_result = {"sent": False, "reason": "skipped"}
    if data.enviar_email and musico.get('email'):
        nombre = musico.get('nombre') or musico.get('email')
        html = build_invitacion_email_html(nombre, url_activacion)
        email_result = await _send_email(
            to_email=musico['email'],
            subject="Te invitamos al portal de músicos de IFC",
            html=html,
            tipo="invitacion",
            usuario_id=musico_id,
        )

    return {
        "ok": True,
        "url_activacion": url_activacion,
        "token": token,
        "email": email_result,
        "musico": {
            "id": musico_id,
            "email": musico.get('email'),
            "nombre": musico.get('nombre'),
            "apellidos": musico.get('apellidos'),
        }
    }


# ============ Endpoints públicos (Portal) ============

@router_portal.get("/activar/{token}")
async def get_activacion_info(token: str):
    """Verifica el token y devuelve datos del músico para la página de bienvenida.
    Pública (sin login)."""
    try:
        r = supabase.table('usuarios').select(
            'id,user_id,email,nombre,apellidos,estado_invitacion,fecha_invitacion'
        ).eq('token_invitacion', token).limit(1).execute()
        rows = r.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al verificar token: {str(e)}")

    if not rows:
        raise HTTPException(status_code=404, detail="Token inválido o ya utilizado")
    musico = rows[0]
    if musico.get('estado_invitacion') == 'activado':
        raise HTTPException(status_code=410, detail="Esta invitación ya ha sido utilizada")
    return {
        "id": musico['id'],
        "email": musico.get('email'),
        "nombre": musico.get('nombre'),
        "apellidos": musico.get('apellidos'),
        "estado_invitacion": musico.get('estado_invitacion'),
    }


@router_portal.post("/activar/{token}")
async def activar_cuenta(token: str, data: ActivarRequest):
    """Establece la contraseña, marca la cuenta como activada y devuelve el email
    para que el frontend haga login automático."""
    if not data.password or len(data.password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")

    # 1) Buscar al músico por token
    try:
        r = supabase.table('usuarios').select(
            'id,user_id,email,estado_invitacion'
        ).eq('token_invitacion', token).limit(1).execute()
        rows = r.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al verificar token: {str(e)}")
    if not rows:
        raise HTTPException(status_code=404, detail="Token inválido o ya utilizado")
    musico = rows[0]
    if musico.get('estado_invitacion') == 'activado':
        raise HTTPException(status_code=410, detail="Esta invitación ya ha sido utilizada")

    # 2) Actualizar contraseña en Supabase Auth
    from supabase import create_client
    admin_client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    auth_user_id = musico.get('user_id')
    if not auth_user_id:
        raise HTTPException(status_code=500, detail="El músico no tiene cuenta de autenticación. Contacta con el equipo.")
    try:
        admin_client.auth.admin.update_user_by_id(auth_user_id, {"password": data.password})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al fijar contraseña: {str(e)[:200]}")

    # 3) Marcar como activado y limpiar token (one-shot)
    try:
        supabase.table('usuarios').update({
            "estado_invitacion": "activado",
            "fecha_activacion": datetime.now(timezone.utc).isoformat(),
            "token_invitacion": None,
        }).eq('id', musico['id']).execute()
    except Exception:
        pass

    return {
        "ok": True,
        "email": musico.get('email'),
        "message": "Cuenta activada correctamente"
    }
