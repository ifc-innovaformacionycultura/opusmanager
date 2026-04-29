"""Resumen semanal por email — Lunes @ 08:00 Europe/Madrid.

Destinatarios: usuarios con rol 'admin' o 'director_general'.
Contenido: stats de la semana (lunes 00:00 → ahora) + tareas vencidas + incidencias abiertas + errores push.

Plantilla HTML corporativa IFC navy/gold (consistente con email_service e invitaciones).
"""
import os
import logging
from datetime import datetime, date, timedelta, timezone
from typing import Dict, List

import asyncio

from supabase_client import supabase
from email_service import _send_email

logger = logging.getLogger(__name__)


def _semana_actual_iso() -> tuple:
    """Devuelve (lunes_00:00 ISO, ahora ISO) de la semana en curso."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    desde_iso = f"{monday.isoformat()}T00:00:00+00:00"
    hasta_iso = datetime.now(timezone.utc).isoformat()
    return desde_iso, hasta_iso, monday


def _count(table: str, **filtros) -> int:
    """Helper: count(*) con filtros eq/gte/lte aplicados a un table de Supabase."""
    try:
        q = supabase.table(table).select('id', count='exact')
        for k, v in filtros.items():
            if v is None:
                continue
            if k.endswith('__gte'):
                q = q.gte(k.replace('__gte', ''), v)
            elif k.endswith('__lte'):
                q = q.lte(k.replace('__lte', ''), v)
            elif k.endswith('__in'):
                q = q.in_(k.replace('__in', ''), v)
            elif k.endswith('__neq'):
                q = q.neq(k.replace('__neq', ''), v)
            elif k.endswith('__not_null'):
                q = q.not_.is_(k.replace('__not_null', ''), 'null')
            elif k.endswith('__lt'):
                q = q.lt(k.replace('__lt', ''), v)
            else:
                q = q.eq(k, v)
        r = q.execute()
        return r.count or 0
    except Exception as e:
        logger.warning(f"_count {table} error: {e}")
        return 0


def compute_stats() -> Dict:
    """Calcula los KPIs semanales."""
    desde_iso, hasta_iso, monday = _semana_actual_iso()
    hoy_iso = date.today().isoformat()

    # Recordatorios push enviados esta semana
    push_semana = _count('recordatorios_enviados', enviado_at__gte=desde_iso, enviado_at__lte=hasta_iso)

    # Contactos CRM nuevos esta semana
    contactos_semana = _count('contactos_musico', created_at__gte=desde_iso)

    # Invitaciones enviadas esta semana
    invit_enviadas = _count('usuarios', fecha_invitacion__gte=desde_iso)
    # Activaciones esta semana
    invit_activadas = _count('usuarios', fecha_activacion__gte=desde_iso)

    # Incidencias abiertas (sin resolver)
    incidencias_abiertas = _count('incidencias', estado__in=['abierta', 'pendiente', 'en_progreso'])

    # Tareas vencidas sin completar (deadline < hoy y no completada)
    tareas_vencidas = _count('tareas', fecha_limite__lt=hoy_iso, estado__neq='completada')

    # Errores push (buffer en memoria)
    try:
        from routes_recordatorios import get_recent_errors
        errores_push = len(get_recent_errors())
    except Exception:
        errores_push = 0

    return {
        'desde': desde_iso,
        'hasta': hasta_iso,
        'monday': monday.isoformat(),
        'push_semana': push_semana,
        'contactos_semana': contactos_semana,
        'invit_enviadas': invit_enviadas,
        'invit_activadas': invit_activadas,
        'incidencias_abiertas': incidencias_abiertas,
        'tareas_vencidas': tareas_vencidas,
        'errores_push': errores_push,
    }


def _kpi_row(icon: str, label: str, value, color: str = "#0f172a", alert: bool = False) -> str:
    bg = "#fee2e2" if alert else "#f8fafc"
    border = "#fecaca" if alert else "#e2e8f0"
    return f"""
    <tr><td style="padding:0 32px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:{bg};border:1px solid {border};border-radius:8px;margin:8px 0">
        <tr>
          <td style="padding:12px 14px;font-size:22px;width:36px">{icon}</td>
          <td style="padding:12px 0;font-size:13px;color:#475569">{label}</td>
          <td align="right" style="padding:12px 14px;font-size:22px;font-weight:bold;color:{color}">{value}</td>
        </tr>
      </table>
    </td></tr>
    """


def build_html(stats: Dict, dest_nombre: str) -> str:
    monday_dt = date.fromisoformat(stats['monday'])
    semana_label = f"Semana del {monday_dt.strftime('%d/%m/%Y')}"
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <!-- Cabecera navy/gold -->
        <tr><td style="background:linear-gradient(90deg,#1e293b,#334155);padding:24px 32px;color:#ffffff;border-bottom:3px solid #d4af37">
          <h1 style="margin:0;font-size:22px;letter-spacing:0.5px">IFC · OPUS MANAGER</h1>
          <p style="margin:6px 0 0;font-size:13px;opacity:0.85">Resumen semanal · {semana_label}</p>
        </td></tr>

        <!-- Saludo -->
        <tr><td style="padding:24px 32px 8px">
          <h2 style="margin:0 0 6px;font-size:18px;color:#0f172a">Hola {dest_nombre} 👋</h2>
          <p style="margin:0;font-size:14px;line-height:1.55;color:#475569">
            Aquí tienes la actividad de OPUS MANAGER de esta semana.
          </p>
        </td></tr>

        <!-- KPIs Semana -->
        <tr><td style="padding:8px 32px 4px">
          <p style="margin:14px 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:bold">📈 Esta semana</p>
        </td></tr>
        {_kpi_row("🔔", "Recordatorios push enviados", stats['push_semana'])}
        {_kpi_row("📞", "Nuevos contactos CRM registrados", stats['contactos_semana'])}
        {_kpi_row("📨", "Invitaciones enviadas a músicos", stats['invit_enviadas'])}
        {_kpi_row("✅", "Cuentas activadas", stats['invit_activadas'], color="#15803d")}

        <!-- Pendientes -->
        <tr><td style="padding:14px 32px 4px">
          <p style="margin:14px 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:bold">🚨 Pendientes de atender</p>
        </td></tr>
        {_kpi_row("📩", "Incidencias abiertas sin resolver", stats['incidencias_abiertas'], alert=stats['incidencias_abiertas'] > 0)}
        {_kpi_row("⏰", "Tareas vencidas sin completar", stats['tareas_vencidas'], alert=stats['tareas_vencidas'] > 0)}
        {_kpi_row("⚠️", "Errores de envío push (buffer)", stats['errores_push'], alert=stats['errores_push'] > 0)}

        <!-- CTA -->
        <tr><td align="center" style="padding:24px 32px 8px">
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#1e293b;border-radius:10px">
              <a href="{(os.environ.get('APP_URL') or 'https://opusmanager.app').rstrip('/')}/admin/recordatorios" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px">
                Ver dashboard completo
              </a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 32px 24px">
          <p style="margin:18px 0 0;font-size:11px;color:#94a3b8;line-height:1.5">
            Este correo se envía automáticamente cada lunes a las 08:00 (Europe/Madrid) a los administradores y al director general.
            Para dejar de recibirlo, contacta con el administrador del sistema.
          </p>
        </td></tr>

        <!-- Pie -->
        <tr><td style="background:#0f172a;padding:14px 32px;color:#94a3b8;font-size:11px">
          <strong style="color:#d4af37">IFC OPUS MANAGER</strong> — Sistema de gestión y control de plantillas orquestales.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
""".strip()


def _run_send_email_sync(**kwargs) -> dict:
    """Ejecuta `_send_email` async desde un contexto sync con su propio loop.

    Crea un loop nuevo en el thread actual. Si ya hay uno corriendo (caso
    FastAPI endpoint), envuelve la llamada en otro thread vía ThreadPoolExecutor.
    """
    from concurrent.futures import ThreadPoolExecutor

    def _runner():
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_send_email(**kwargs))
        finally:
            loop.close()

    try:
        # Si NO hay loop running, ejecutamos directo
        asyncio.get_running_loop()
        # Hay loop running → ejecutamos en otro thread
        with ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(_runner).result(timeout=30)
    except RuntimeError:
        return _runner()


def send_weekly_summary() -> Dict:
    """Envía el email semanal a todos los admin/director_general activos."""
    stats = compute_stats()
    enviados = []
    fallidos = []
    try:
        admins = supabase.table('usuarios').select('id,email,nombre,apellidos,rol') \
            .in_('rol', ['admin', 'director_general']) \
            .eq('estado', 'activo').execute().data or []
    except Exception as e:
        logger.error(f"Error cargando admins: {e}")
        return {"ok": False, "error": str(e), "stats": stats}

    if not admins:
        logger.info("No hay admins/director_general activos. Email semanal omitido.")
        return {"ok": True, "destinatarios": 0, "stats": stats}

    asunto = f"[OPUS MANAGER] Resumen semanal · {stats['monday']}"
    for u in admins:
        if not u.get('email'):
            continue
        nombre = u.get('nombre') or u.get('email')
        html = build_html(stats, nombre)
        try:
            res = _run_send_email_sync(
                to_email=u['email'], subject=asunto, html=html,
                tipo="resumen_semanal", usuario_id=u.get('id'),
            )
            if res and res.get('sent'):
                enviados.append(u['email'])
            else:
                fallidos.append({'email': u['email'], 'reason': (res or {}).get('reason')})
        except Exception as e:
            fallidos.append({'email': u['email'], 'error': str(e)[:160]})
            logger.error(f"Error enviando resumen a {u['email']}: {e}")

    return {
        "ok": True,
        "destinatarios": len(admins),
        "enviados": enviados,
        "fallidos": fallidos,
        "stats": stats,
    }
