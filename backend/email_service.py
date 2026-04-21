"""Email service - send transactional emails via Resend"""
import os
import asyncio
import logging

logger = logging.getLogger(__name__)


def _get_api_key():
    return os.environ.get("RESEND_API_KEY", "").strip()


def _get_sender():
    return os.environ.get("SENDER_EMAIL", "onboarding@resend.dev").strip()


def _get_app_url():
    return os.environ.get("APP_URL", "").strip() or "https://contact-conductor.preview.emergentagent.com"


def build_credentials_email_html(nombre: str, email: str, password_temporal: str) -> str:
    """Build HTML email body for musician welcome email with temporary credentials."""
    app_url = _get_app_url()
    login_url = f"{app_url}/login"
    safe_nombre = nombre or "músico"
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
          <tr>
            <td style="background:linear-gradient(90deg,#1e293b,#334155);padding:24px 32px;color:#ffffff">
              <h1 style="margin:0;font-size:22px;letter-spacing:0.5px">OPUS MANAGER</h1>
              <p style="margin:4px 0 0;font-size:13px;opacity:0.85">Sistema de gestión de plantillas orquestales</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a">¡Bienvenido/a, {safe_nombre}!</h2>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#334155">
                Se ha creado una cuenta para ti en OPUS MANAGER.
                A continuación te enviamos tus credenciales temporales para acceder al portal de músicos.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0">
                <tr><td style="padding:16px 20px">
                  <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Usuario</p>
                  <p style="margin:0 0 16px;font-size:15px;color:#0f172a;font-weight:bold">{email}</p>
                  <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Contraseña temporal</p>
                  <p style="margin:0;font-family:Consolas,Monaco,monospace;font-size:16px;color:#0f172a;background:#ffffff;border:1px dashed #94a3b8;padding:10px 12px;border-radius:6px">{password_temporal}</p>
                </td></tr>
              </table>

              <p style="margin:16px 0;font-size:14px;line-height:1.55;color:#334155">
                <strong>Importante:</strong> en tu primer acceso se te solicitará establecer una nueva contraseña personal.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin:20px 0 8px">
                <tr><td style="background:#1e293b;border-radius:8px">
                  <a href="{login_url}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px">
                    Acceder al portal
                  </a>
                </td></tr>
              </table>

              <p style="margin:16px 0 0;font-size:12px;color:#64748b">
                Si no puedes pulsar el botón, copia y pega esta URL en tu navegador:<br/>
                <span style="color:#334155">{login_url}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">
              Este es un correo automático. Si crees que lo has recibido por error, ignóralo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
""".strip()


async def send_musico_credentials_email(to_email: str, nombre: str, password_temporal: str, usuario_id: str = None) -> dict:
    """
    Send welcome email with temporary credentials. Returns dict:
      - sent: bool
      - email_id: str (when sent)
      - reason: str (when not sent)
    Does NOT raise — the musician creation should succeed even if the email fails.
    """
    return await _send_email(
        to_email=to_email,
        subject="Bienvenido/a a OPUS MANAGER — credenciales de acceso",
        html=build_credentials_email_html(nombre, to_email, password_temporal),
        tipo="bienvenida",
        usuario_id=usuario_id
    )


async def _send_email(
    to_email: str,
    subject: str,
    html: str,
    tipo: str = "generico",
    usuario_id: str = None,
    evento_id: str = None,
) -> dict:
    """Generic email send via Resend with email_log entry."""
    api_key = _get_api_key()
    log_entry = {
        "destinatario": to_email,
        "asunto": subject,
        "tipo": tipo,
        "usuario_id": usuario_id,
        "evento_id": evento_id,
    }

    if not api_key:
        logger.warning("RESEND_API_KEY not configured — skipping email send")
        _log_email({**log_entry, "estado": "error", "error_mensaje": "RESEND_API_KEY not configured"})
        return {"sent": False, "reason": "RESEND_API_KEY not configured"}

    try:
        import resend
        resend.api_key = api_key
        params = {
            "from": _get_sender(),
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        email_id = result.get("id") if isinstance(result, dict) else None
        _log_email({**log_entry, "estado": "enviado", "resend_id": email_id})
        return {"sent": True, "email_id": email_id}
    except Exception as e:
        logger.error(f"Resend email failed: {e}")
        _log_email({**log_entry, "estado": "error", "error_mensaje": str(e)[:500]})
        return {"sent": False, "reason": str(e)}


def _log_email(payload: dict):
    """Persist email attempt to email_log table (best-effort)."""
    try:
        from supabase_client import supabase
        clean = {k: v for k, v in payload.items() if v is not None}
        supabase.table('email_log').insert(clean).execute()
    except Exception as e:
        logger.error(f"Failed to log email: {e}")


async def send_reminder_email(to_email: str, subject: str, html: str, tipo: str, usuario_id: str = None, evento_id: str = None) -> dict:
    """Send a reminder-style email (used by recordatorios)."""
    return await _send_email(to_email=to_email, subject=subject, html=html, tipo=tipo, usuario_id=usuario_id, evento_id=evento_id)
