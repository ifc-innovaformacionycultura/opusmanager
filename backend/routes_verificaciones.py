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
