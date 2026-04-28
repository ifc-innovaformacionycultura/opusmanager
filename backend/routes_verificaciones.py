"""Verificación de secciones en eventos.
Solo super admins (admin / director_general / admin@convocatorias.com) pueden cambiar el estado.
Estados: pendiente | verificado | autorizado_sin_verificar
Secciones: datos_generales, ensayos, logistica_musicos, logistica_material,
           programa_musical, presupuesto, montaje, partituras
"""
from typing import Optional, Literal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor, is_super_admin

router = APIRouter(prefix="/api/gestor/eventos", tags=["verificaciones"])

SECCIONES_VALIDAS = {
    'datos_generales', 'ensayos', 'logistica_musicos', 'logistica_material',
    'programa_musical', 'presupuesto', 'montaje', 'partituras'
}


class VerificacionUpdate(BaseModel):
    estado: Literal['pendiente', 'verificado', 'autorizado_sin_verificar']
    notas: Optional[str] = None


@router.get("/{evento_id}/verificaciones")
async def get_verificaciones(evento_id: str, current_user: dict = Depends(get_current_gestor)):
    """Devuelve el estado de las 8 secciones (rellena con 'pendiente' las que no existan)."""
    rows = supabase.table('evento_verificaciones').select('*').eq('evento_id', evento_id).execute().data or []
    by_seccion = {r['seccion']: r for r in rows}
    out = []
    for s in SECCIONES_VALIDAS:
        r = by_seccion.get(s) or {'seccion': s, 'estado': 'pendiente'}
        out.append({
            'seccion': s,
            'estado': r.get('estado') or 'pendiente',
            'notas': r.get('notas'),
            'verificado_por_nombre': r.get('verificado_por_nombre'),
            'verificado_at': r.get('verificado_at'),
        })
    # Stats
    verif_count = sum(1 for x in out if x['estado'] in ('verificado', 'autorizado_sin_verificar'))
    return {
        'verificaciones': out,
        'verificadas': verif_count,
        'total': len(SECCIONES_VALIDAS),
        'puede_publicar': verif_count == len(SECCIONES_VALIDAS),
        'puede_editar': is_super_admin(current_user),
    }


@router.put("/{evento_id}/verificaciones/{seccion}")
async def put_verificacion(evento_id: str, seccion: str, payload: VerificacionUpdate,
                            current_user: dict = Depends(get_current_gestor)):
    """Cambia el estado de una sección. Solo super admins."""
    if not is_super_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo administradores y director general pueden verificar secciones.")
    if seccion not in SECCIONES_VALIDAS:
        raise HTTPException(status_code=400, detail=f"Sección inválida: {seccion}")

    profile = current_user.get('profile') or {}
    nombre = f"{profile.get('nombre','')} {profile.get('apellidos','')}".strip() or current_user.get('email', '—')
    user_id_resolved = profile.get('id') or current_user.get('id')

    record = {
        'evento_id': evento_id,
        'seccion': seccion,
        'estado': payload.estado,
        'notas': payload.notas,
        'verificado_por_nombre': nombre,
        'verificado_at': datetime.now(timezone.utc).isoformat(),
    }
    # FK: verificado_por debe existir en usuarios. Si no, dejar NULL.
    try:
        ur = supabase.table('usuarios').select('id').eq('id', user_id_resolved).limit(1).execute().data or []
        if ur:
            record['verificado_por'] = user_id_resolved
    except Exception:
        pass

    # Buscar existente
    exist = supabase.table('evento_verificaciones').select('id') \
        .eq('evento_id', evento_id).eq('seccion', seccion).limit(1).execute().data or []
    if exist:
        supabase.table('evento_verificaciones').update(record).eq('id', exist[0]['id']).execute()
    else:
        supabase.table('evento_verificaciones').insert(record).execute()
    return {'ok': True, 'seccion': seccion, 'estado': payload.estado}


@router.post("/{evento_id}/verificaciones/{seccion}/solicitar")
async def solicitar_verificacion(evento_id: str, seccion: str,
                                  current_user: dict = Depends(get_current_gestor)):
    """Envía email a todos los super admins (admin + director_general) pidiendo verificar una sección."""
    import os
    import resend as _resend
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Servicio de email no configurado")
    if seccion not in SECCIONES_VALIDAS:
        raise HTTPException(status_code=400, detail=f"Sección inválida: {seccion}")
    # Destinatarios: admin + director_general
    admins = supabase.table('usuarios').select('email,nombre,apellidos,rol') \
        .in_('rol', ['admin', 'director_general']).execute().data or []
    emails = [a['email'] for a in admins if a.get('email')]
    if not emails:
        raise HTTPException(status_code=404, detail="No hay administradores ni director general con email")
    # Datos del evento
    ev_r = supabase.table('eventos').select('nombre,fecha_inicio').eq('id', evento_id).limit(1).execute().data or []
    ev = ev_r[0] if ev_r else {}
    profile = current_user.get('profile') or {}
    solicitante = f"{profile.get('nombre','')} {profile.get('apellidos','')}".strip() or current_user.get('email', 'un gestor')
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev").strip()
    label_seccion = ICONOS_SECCION_LABELS.get(seccion, seccion)
    asunto = f"Solicitud de verificación: {label_seccion} — {ev.get('nombre','evento')}"
    html = f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial;color:#0f172a">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0">
<tr><td align="center"><table width="600" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0">
<tr><td style="background:#1A3A5C;padding:24px;color:#fff;border-bottom:3px solid #C9920A">
<h1 style="margin:0;font-size:18px">IFC · OPUS MANAGER</h1>
<p style="margin:6px 0 0;font-size:13px;color:#C9920A">Solicitud de verificación</p>
</td></tr>
<tr><td style="padding:24px">
<p style="font-size:14px;line-height:1.6">Hola,</p>
<p style="font-size:14px;line-height:1.6"><b>{solicitante}</b> solicita la verificación de la sección <b>{label_seccion}</b> del evento:</p>
<div style="background:#F1F5F9;border-left:3px solid #C9920A;padding:14px;border-radius:4px;margin:12px 0">
<div style="font-size:15px;font-weight:600;color:#1A3A5C">{ev.get('nombre','—')}</div>
<div style="font-size:12px;color:#475569;margin-top:4px">{(ev.get('fecha_inicio') or '')[:10]}</div>
</div>
<p style="font-size:13px;color:#475569">Accede al sistema y revisa la sección correspondiente para marcarla como verificada o autorizada sin verificar.</p>
</td></tr></table></td></tr></table></body></html>"""
    _resend.api_key = api_key
    enviados = []
    for to in emails:
        try:
            r = _resend.Emails.send({"from": sender, "to": [to], "subject": asunto, "html": html})
            enviados.append(to)
            try:
                supabase.table('email_log').insert({
                    'destinatario': to, 'asunto': asunto,
                    'tipo': f'solicitud_verificacion_{seccion}', 'estado': 'enviado',
                    'resend_id': (r.get('id') if isinstance(r, dict) else None),
                    'evento_id': evento_id,
                }).execute()
            except Exception:
                pass
        except Exception:
            pass
    return {'ok': True, 'enviados': enviados, 'total_admins': len(emails)}


# Etiquetas legibles
ICONOS_SECCION_LABELS = {
    'datos_generales': 'Datos Generales',
    'ensayos': 'Ensayos y Funciones',
    'logistica_musicos': 'Transportes y Alojamientos · Músicos',
    'logistica_material': 'Transporte de Material',
    'programa_musical': 'Programa Musical',
    'presupuesto': 'Presupuesto',
    'montaje': 'Montaje y Rider Técnico',
    'partituras': 'Partituras y Materiales',
}
