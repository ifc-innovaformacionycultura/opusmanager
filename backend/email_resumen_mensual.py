"""Resumen mensual por email al MÚSICO — día 1 de cada mes @ 08:00 Europe/Madrid.

Para cada músico activo, envía:
- Eventos confirmados este mes
- Pagos pendientes
- Próximas convocatorias del mes siguiente
- Recordatorio si hay disponibilidad por confirmar con fecha límite próxima

Plantilla HTML corporativa IFC navy/gold.
"""
from __future__ import annotations
import os
import logging
from datetime import datetime, date, timedelta, timezone
from typing import Dict, List
from concurrent.futures import ThreadPoolExecutor
import asyncio

from supabase_client import supabase
from email_service import _send_email

logger = logging.getLogger(__name__)


def _ultimo_dia_del_mes(d: date) -> date:
    # Día 1 del mes siguiente menos 1
    y, m = d.year, d.month
    if m == 12:
        nxt = date(y + 1, 1, 1)
    else:
        nxt = date(y, m + 1, 1)
    return nxt - timedelta(days=1)


def _primer_dia_mes_siguiente(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def _run_send_sync(to_email: str, subject: str, html: str, tipo: str, usuario_id: str | None = None):
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
            return ex.submit(_sync).result(timeout=30)
    except RuntimeError:
        return _sync()


def _datos_musico(musico_id: str, mes_inicio: date, mes_fin: date, mes_sig_inicio: date, mes_sig_fin: date) -> Dict:
    # Eventos confirmados del mes
    try:
        asigs = supabase.table('asignaciones') \
            .select('id, estado, evento_id, evento:eventos(id,nombre,fecha_inicio,fecha_fin,lugar,estado)') \
            .eq('usuario_id', musico_id).execute().data or []
    except Exception:
        asigs = []

    def _rango_solapa(ev, desde, hasta):
        fi = ev.get('fecha_inicio') or ''
        ff = ev.get('fecha_fin') or fi
        try:
            d_i = datetime.fromisoformat(str(fi)[:10]).date()
            d_f = datetime.fromisoformat(str(ff)[:10]).date()
        except Exception:
            return False
        return d_f >= desde and d_i <= hasta

    eventos_mes = []
    eventos_prox_mes = []
    for a in asigs:
        ev = a.get('evento') or {}
        if not ev:
            continue
        if _rango_solapa(ev, mes_inicio, mes_fin):
            eventos_mes.append({**ev, "estado_asig": a.get('estado')})
        if _rango_solapa(ev, mes_sig_inicio, mes_sig_fin):
            eventos_prox_mes.append({**ev, "estado_asig": a.get('estado')})

    # Pagos pendientes
    try:
        pagos = supabase.table('pagos').select('id, importe_neto, importe_bruto, estado, fecha_pago, evento:eventos(id,nombre)') \
            .eq('usuario_id', musico_id).eq('estado', 'pendiente').execute().data or []
    except Exception:
        pagos = []

    # Disponibilidad por confirmar con fecha límite próxima (próximos 7 días)
    limite_proximo = []
    try:
        hoy = date.today()
        hasta = hoy + timedelta(days=7)
        asig_ids = [a['id'] for a in asigs if a.get('id')]
        if asig_ids:
            ev_ids = [a.get('evento_id') for a in asigs if a.get('evento_id')]
            evs = supabase.table('eventos').select('id,nombre,fecha_limite_disponibilidad') \
                .in_('id', ev_ids).not_.is_('fecha_limite_disponibilidad', 'null').execute().data or []
            for ev in evs:
                try:
                    lim = datetime.fromisoformat(str(ev['fecha_limite_disponibilidad'])[:10]).date()
                    if hoy <= lim <= hasta:
                        limite_proximo.append(ev)
                except Exception:
                    pass
    except Exception:
        pass

    return {
        "eventos_mes": eventos_mes,
        "eventos_prox_mes": eventos_prox_mes,
        "pagos_pendientes": pagos,
        "disponibilidad_limite": limite_proximo,
    }


def _build_html(nombre: str, mes_label: str, datos: Dict, portal_url: str) -> str:
    eventos_mes = datos["eventos_mes"]
    eventos_prox = datos["eventos_prox_mes"]
    pagos = datos["pagos_pendientes"]
    lim = datos["disponibilidad_limite"]

    def _ev_rows(evs):
        if not evs:
            return '<tr><td colspan="3" style="padding:10px;color:#94a3b8;font-style:italic">—</td></tr>'
        out = []
        for e in evs:
            out.append(f"""<tr>
              <td style="padding:8px 12px;border-top:1px solid #e2e8f0">{e.get('nombre') or '—'}</td>
              <td style="padding:8px 12px;border-top:1px solid #e2e8f0;color:#475569">{(e.get('fecha_inicio') or '')[:10]}</td>
              <td style="padding:8px 12px;border-top:1px solid #e2e8f0;color:#475569">{e.get('lugar') or '—'}</td>
            </tr>""")
        return ''.join(out)

    def _pagos_rows(ps):
        if not ps:
            return '<tr><td colspan="3" style="padding:10px;color:#94a3b8;font-style:italic">Sin pagos pendientes</td></tr>'
        out = []
        for p in ps:
            imp = p.get('importe_neto') or p.get('importe_bruto') or '—'
            out.append(f"""<tr>
              <td style="padding:8px 12px;border-top:1px solid #e2e8f0">{(p.get('evento') or {}).get('nombre') or '—'}</td>
              <td style="padding:8px 12px;border-top:1px solid #e2e8f0;color:#475569">{imp} €</td>
              <td style="padding:8px 12px;border-top:1px solid #e2e8f0"><span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px">Pendiente</span></td>
            </tr>""")
        return ''.join(out)

    aviso_disp = ""
    if lim:
        items = "".join(f"<li style='margin:4px 0'><strong>{e.get('nombre')}</strong> — antes del {e.get('fecha_limite_disponibilidad','')[:10]}</li>" for e in lim)
        aviso_disp = f"""
        <div style="background:#fff7ed;border-left:4px solid #f97316;padding:12px 16px;margin:16px 24px;border-radius:4px">
          <strong style="color:#9a3412">⏰ Recordatorio de disponibilidad</strong>
          <ul style="margin:6px 0 0 18px;color:#7c2d12">{items}</ul>
        </div>
        """

    return f"""<!DOCTYPE html>
<html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f1f5f9;color:#0f172a">
  <div style="max-width:680px;margin:0 auto;background:#ffffff">
    <div style="background:#1A3A5C;padding:22px 24px">
      <div style="color:#C9920A;font-weight:700;font-size:12px;letter-spacing:3px">IFC OPUS MANAGER</div>
      <h1 style="color:#ffffff;margin:6px 0 0 0;font-size:22px">Resumen mensual · {mes_label}</h1>
    </div>
    <div style="padding:20px 24px">
      <p style="font-size:15px">Hola <strong>{nombre}</strong>,</p>
      <p style="color:#475569">Este es tu resumen mensual de actividad. Toda la información está disponible en tu portal.</p>
      {aviso_disp}
      <h2 style="color:#1A3A5C;font-size:16px;margin:22px 0 8px 0">🎼 Tus eventos este mes</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;font-size:13px">
        <thead style="background:#f8fafc"><tr>
          <th style="text-align:left;padding:8px 12px;color:#475569">Evento</th>
          <th style="text-align:left;padding:8px 12px;color:#475569">Fecha</th>
          <th style="text-align:left;padding:8px 12px;color:#475569">Lugar</th>
        </tr></thead>
        <tbody>{_ev_rows(eventos_mes)}</tbody>
      </table>

      <h2 style="color:#1A3A5C;font-size:16px;margin:22px 0 8px 0">💰 Pagos pendientes</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;font-size:13px">
        <thead style="background:#f8fafc"><tr>
          <th style="text-align:left;padding:8px 12px;color:#475569">Evento</th>
          <th style="text-align:left;padding:8px 12px;color:#475569">Importe</th>
          <th style="text-align:left;padding:8px 12px;color:#475569">Estado</th>
        </tr></thead>
        <tbody>{_pagos_rows(pagos)}</tbody>
      </table>

      <h2 style="color:#1A3A5C;font-size:16px;margin:22px 0 8px 0">📅 Próximas convocatorias (mes siguiente)</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;font-size:13px">
        <thead style="background:#f8fafc"><tr>
          <th style="text-align:left;padding:8px 12px;color:#475569">Evento</th>
          <th style="text-align:left;padding:8px 12px;color:#475569">Fecha</th>
          <th style="text-align:left;padding:8px 12px;color:#475569">Lugar</th>
        </tr></thead>
        <tbody>{_ev_rows(eventos_prox)}</tbody>
      </table>

      <div style="text-align:center;margin:24px 0 8px 0">
        <a href="{portal_url}" style="display:inline-block;background:#1A3A5C;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600">Ir al portal del músico</a>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin-top:18px">Mensaje automático · IFC OPUS Manager</p>
    </div>
  </div>
</body></html>"""


def send_monthly_summary_to_musicians() -> Dict:
    """Envía el resumen mensual a todos los músicos activos."""
    hoy = date.today()
    inicio = date(hoy.year, hoy.month, 1)
    fin = _ultimo_dia_del_mes(inicio)
    sig_i = _primer_dia_mes_siguiente(inicio)
    sig_f = _ultimo_dia_del_mes(sig_i)
    mes_label = inicio.strftime("%B %Y")
    portal_url = (os.environ.get("APP_URL") or "https://opusmanager.app").rstrip("/") + "/portal"

    try:
        musicos = supabase.table('usuarios').select('id,email,nombre,apellidos,rol,estado') \
            .eq('rol', 'musico').eq('estado', 'activo').execute().data or []
    except Exception as e:
        logger.error(f"Error cargando músicos: {e}")
        return {"ok": False, "error": str(e)}

    enviados = []
    fallidos = []
    for u in musicos:
        if not u.get('email'):
            continue
        try:
            datos = _datos_musico(u['id'], inicio, fin, sig_i, sig_f)
            # Si el músico no tiene nada, omitimos envío
            if not (datos['eventos_mes'] or datos['eventos_prox_mes'] or datos['pagos_pendientes'] or datos['disponibilidad_limite']):
                continue
            html = _build_html(u.get('nombre') or u.get('email'), mes_label, datos, portal_url)
            asunto = f"[IFC OPUS] Tu resumen mensual · {mes_label}"
            res = _run_send_sync(u['email'], asunto, html, tipo='resumen_mensual_musico', usuario_id=u['id'])
            if res and res.get('sent'):
                enviados.append(u['email'])
            else:
                fallidos.append({'email': u['email'], 'reason': (res or {}).get('reason')})
        except Exception as e:
            fallidos.append({'email': u.get('email'), 'error': str(e)[:160]})

    return {"ok": True, "destinatarios": len(musicos), "enviados": enviados, "fallidos": fallidos, "mes": mes_label}
