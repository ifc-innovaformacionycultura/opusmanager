"""Dashboard resumen — KPIs y listas para el panel de actividad."""
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api/gestor/dashboard", tags=["dashboard"])


def _user_uuid(current_user: dict):
    """Resuelve el UUID en tabla `usuarios` (puede venir como user_id o id)."""
    profile = current_user.get('profile') or {}
    return profile.get('id') or current_user.get('id')


@router.get("/resumen")
async def dashboard_resumen(current_user: dict = Depends(get_current_gestor)):
    """Devuelve KPIs + listas para el panel de actividad pendiente del gestor."""
    user_id = _user_uuid(current_user)
    hoy = datetime.now(timezone.utc).date()
    en15 = hoy + timedelta(days=15)
    desde_s, hasta_s = hoy.isoformat(), en15.isoformat()

    # ============ PRÓXIMOS 15 DÍAS ============
    proximos = []

    # Ensayos y funciones
    try:
        evs = supabase.table('eventos').select('id,nombre,estado').execute().data or []
        ev_map = {e['id']: e for e in evs}
        rows = supabase.table('rehearsals').select('id,event_id,fecha,hora_inicio,tipo,lugar') \
            .gte('fecha', desde_s).lte('fecha', hasta_s).execute().data or []
        for r in rows:
            ev = ev_map.get(r['event_id']) or {}
            tipo = (r.get('tipo') or 'ensayo').lower()
            es_funcion = tipo in ('funcion', 'función', 'concierto')
            proximos.append({
                'id': f"ensayo-{r['id']}",
                'tipo': 'funcion' if es_funcion else 'ensayo',
                'titulo': f"{ev.get('nombre', '—')} · {tipo}",
                'fecha': r.get('fecha'),
                'hora': (r.get('hora_inicio') or '')[:5],
                'lugar': r.get('lugar'),
                'color': '#3b82f6' if es_funcion else '#16a34a',
                'icon': '🎻' if es_funcion else '🎼',
                'evento_id': r['event_id'],
            })
    except Exception:
        pass

    # Montajes confirmados
    try:
        mont = supabase.table('evento_montaje').select('id,evento_id,ensayo_id,nombre_material,confirmado') \
            .eq('confirmado', True).execute().data or []
        for m in mont:
            f, h = None, None
            if m.get('ensayo_id'):
                ens = supabase.table('rehearsals').select('fecha,hora_inicio').eq('id', m['ensayo_id']).limit(1).execute().data
                if ens: f, h = ens[0].get('fecha'), ens[0].get('hora_inicio')
            else:
                ev = supabase.table('eventos').select('fecha_inicio').eq('id', m['evento_id']).limit(1).execute().data
                if ev: f = (ev[0].get('fecha_inicio') or '')[:10]
            if not f or f < desde_s or f > hasta_s: continue
            ev_n = (ev_map.get(m['evento_id']) or {}).get('nombre', '—')
            proximos.append({
                'id': f"montaje-{m['id']}", 'tipo': 'montaje',
                'titulo': f"Montaje {m.get('nombre_material','—')} · {ev_n}",
                'fecha': f, 'hora': (h or '')[:5],
                'color': '#f97316', 'icon': '🛠️',
                'evento_id': m['evento_id'],
            })
    except Exception:
        pass

    # Desplazamientos músicos
    try:
        logs = supabase.table('evento_logistica').select('id,evento_id,tipo,fecha,hora_salida,lugar_salida') \
            .gte('fecha', desde_s).lte('fecha', hasta_s).execute().data or []
        for l in logs:
            ev_n = (ev_map.get(l['evento_id']) or {}).get('nombre', '—')
            tipo_lab = {
                'transporte_ida': '🚌 Ida músicos',
                'transporte_vuelta': '🚌 Vuelta músicos',
                'alojamiento': '🏨 Alojamiento'
            }.get(l.get('tipo'), l.get('tipo'))
            proximos.append({
                'id': f"logmus-{l['id']}", 'tipo': 'logistica_musicos',
                'titulo': f"{tipo_lab} · {ev_n}",
                'fecha': l.get('fecha'), 'hora': (l.get('hora_salida') or '')[:5],
                'lugar': l.get('lugar_salida'),
                'color': '#eab308', 'icon': '🚌',
                'evento_id': l['evento_id'],
            })
    except Exception:
        pass

    # Desplazamientos material
    try:
        tm = supabase.table('transporte_material').select('id,evento_id,fecha_carga,hora_carga,fecha_descarga,empresa') \
            .or_(f"fecha_carga.gte.{desde_s},fecha_descarga.gte.{desde_s}").execute().data or []
        for t in tm:
            for f, etiqueta in [(t.get('fecha_carga'), 'carga'), (t.get('fecha_descarga'), 'descarga')]:
                if not f or f < desde_s or f > hasta_s: continue
                ev_n = (ev_map.get(t['evento_id']) or {}).get('nombre', '—')
                proximos.append({
                    'id': f"trmat-{t['id']}-{etiqueta}", 'tipo': 'logistica_material',
                    'titulo': f"🚚 Transporte material ({etiqueta}) · {ev_n}",
                    'fecha': f, 'hora': (t.get('hora_carga') or '')[:5],
                    'lugar': t.get('empresa'),
                    'color': '#dc2626', 'icon': '🚚',
                    'evento_id': t['evento_id'],
                })
    except Exception:
        pass

    proximos.sort(key=lambda x: (x.get('fecha') or '', x.get('hora') or ''))

    # ============ PENDIENTES DEL EQUIPO ============
    pendientes_equipo = []

    # Comentarios sin resolver donde estoy mencionado o soy el autor
    try:
        coms = supabase.table('comentarios_equipo').select('*') \
            .neq('estado', 'resuelto').limit(200).execute().data or []
        for c in coms:
            menciones = c.get('menciones') or []
            if isinstance(menciones, str):
                import json as _json
                try: menciones = _json.loads(menciones)
                except Exception: menciones = []
            mencionado = False
            if isinstance(menciones, list):
                mencionado = any((m if isinstance(m, str) else m.get('id')) == user_id for m in menciones)
            if mencionado or c.get('autor_id') == user_id:
                pendientes_equipo.append({
                    'id': f"coment-{c['id']}", 'tipo': 'comentario',
                    'titulo': (c.get('contenido') or '—')[:80],
                    'pagina': c.get('pagina'),
                    'entidad': f"{c.get('entidad_tipo','')}{(' · ' + c.get('entidad_nombre','')) if c.get('entidad_nombre') else ''}",
                    'autor': c.get('autor_nombre'),
                    'fecha': (c.get('created_at') or '')[:10],
                })
    except Exception:
        pass

    # Tareas asignadas al usuario con deadline próximo
    try:
        tareas = supabase.table('tareas').select('*') \
            .eq('responsable_id', user_id) \
            .neq('estado', 'completada') \
            .lte('fecha_limite', hasta_s).execute().data or []
        for t in tareas:
            pendientes_equipo.append({
                'id': f"tarea-{t['id']}", 'tipo': 'tarea',
                'titulo': t.get('titulo') or '—',
                'fecha': t.get('fecha_limite'),
                'estado': t.get('estado'),
                'prioridad': t.get('prioridad'),
            })
    except Exception:
        pass

    # ============ PENDIENTES DE VERIFICACIÓN ============
    # Solo eventos en estado 'borrador'
    pendientes_verif = []
    try:
        eventos_borr = [e for e in evs if (e.get('estado') or '') == 'borrador']
        if eventos_borr:
            ids_borr = [e['id'] for e in eventos_borr]
            verifs = supabase.table('evento_verificaciones').select('*').in_('evento_id', ids_borr).execute().data or []
            verif_map = {}  # evento_id -> set(secciones verificadas)
            for v in verifs:
                if v.get('estado') in ('verificado', 'autorizado_sin_verificar'):
                    verif_map.setdefault(v['evento_id'], set()).add(v['seccion'])
            SECCIONES = ['datos_generales', 'ensayos', 'logistica_musicos', 'logistica_material',
                         'programa_musical', 'presupuesto', 'montaje', 'partituras']
            for ev in eventos_borr:
                vs = verif_map.get(ev['id'], set())
                pendientes_secs = [s for s in SECCIONES if s not in vs]
                if pendientes_secs:
                    pendientes_verif.append({
                        'evento_id': ev['id'],
                        'evento_nombre': ev.get('nombre'),
                        'pendientes': len(pendientes_secs),
                        'total': len(SECCIONES),
                        'secciones_pendientes': pendientes_secs,
                    })
    except Exception:
        pass

    # ============ KPIs ============
    kpis = {
        'verificaciones_pendientes': sum(p['pendientes'] for p in pendientes_verif),
        'comentarios_pendientes': len([p for p in pendientes_equipo if p['tipo'] == 'comentario']),
        'tareas_proximas': len([p for p in pendientes_equipo if p['tipo'] == 'tarea']),
        'eventos_proximos': len(proximos),
    }

    return {
        'kpis': kpis,
        'proximos_15_dias': proximos[:50],
        'pendientes_equipo': pendientes_equipo[:30],
        'pendientes_verificacion': pendientes_verif,
        'rango': {'desde': desde_s, 'hasta': hasta_s},
    }
