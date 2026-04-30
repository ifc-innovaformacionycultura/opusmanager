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

    # Servicios de comedor (Iter 19)
    try:
        coms = supabase.table('evento_comidas').select('id,evento_id,fecha,hora_inicio,lugar') \
            .gte('fecha', desde_s).lte('fecha', hasta_s).execute().data or []
        for c in coms:
            ev_n = (ev_map.get(c['evento_id']) or {}).get('nombre', '—')
            proximos.append({
                'id': f"comida-{c['id']}", 'tipo': 'comida',
                'titulo': f"🍽️ Servicio de comedor · {ev_n}",
                'fecha': c.get('fecha'), 'hora': (c.get('hora_inicio') or '')[:5],
                'lugar': c.get('lugar'),
                'color': '#f97316', 'icon': '🍽️',
                'evento_id': c['evento_id'],
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

    # ============ COMIDAS PENDIENTES DE CONFIRMAR POR MÚSICOS (Iter 19) ============
    comidas_pendientes = []
    try:
        # Comidas activas: con fecha_limite >= hoy o sin fecha_limite, evento no finalizado
        com_rows = supabase.table('evento_comidas').select(
            'id,evento_id,fecha,hora_inicio,lugar,fecha_limite_confirmacion,precio_menu,incluye_cafe'
        ).gte('fecha', desde_s).execute().data or []
        if com_rows:
            com_ids = [c['id'] for c in com_rows]
            ev_ids_com = list({c['evento_id'] for c in com_rows})
            # Asignaciones publicadas por evento
            asigs_all = supabase.table('asignaciones').select('evento_id,usuario_id,publicado_musico') \
                .in_('evento_id', ev_ids_com).eq('publicado_musico', True).execute().data or []
            asigs_by_ev: Dict[str, set] = {}
            for a in asigs_all:
                asigs_by_ev.setdefault(a['evento_id'], set()).add(a['usuario_id'])
            # Confirmaciones existentes
            confs = supabase.table('confirmaciones_comida').select('comida_id,usuario_id,confirmado') \
                .in_('comida_id', com_ids).execute().data or []
            confs_by_cid: Dict[str, set] = {}
            for cf in confs:
                if cf.get('confirmado') is not None:
                    confs_by_cid.setdefault(cf['comida_id'], set()).add(cf['usuario_id'])
            for c in com_rows:
                ev_n = (ev_map.get(c['evento_id']) or {}).get('nombre', '—')
                asignados_ids = asigs_by_ev.get(c['evento_id'], set())
                respondieron = confs_by_cid.get(c['id'], set())
                pendientes = asignados_ids - respondieron
                if pendientes:
                    comidas_pendientes.append({
                        'id': c['id'],
                        'evento_id': c['evento_id'],
                        'evento_nombre': ev_n,
                        'fecha': c.get('fecha'),
                        'hora': (c.get('hora_inicio') or '')[:5],
                        'lugar': c.get('lugar'),
                        'fecha_limite_confirmacion': c.get('fecha_limite_confirmacion'),
                        'pendientes': len(pendientes),
                        'total': len(asignados_ids),
                    })
        comidas_pendientes.sort(key=lambda x: x.get('fecha_limite_confirmacion') or x.get('fecha') or '9999')
    except Exception:
        pass

    # ============ KPIs ============
    # Bloque 2: contar músicos con cuenta sin activar
    musicos_sin_activar = 0
    try:
        ms_res = supabase.table('usuarios').select('id', count='exact') \
            .eq('rol', 'musico') \
            .eq('estado', 'activo') \
            .in_('estado_invitacion', ['pendiente', 'invitado']) \
            .execute()
        musicos_sin_activar = ms_res.count or 0
    except Exception:
        pass

    # Recordatorios push enviados hoy + errores recientes
    recordatorios_enviados_hoy = 0
    errores_recientes = 0
    try:
        from datetime import date as _date
        today_iso = _date.today().isoformat()
        rh = supabase.table('recordatorios_enviados').select('id', count='exact') \
            .gte('enviado_at', f"{today_iso}T00:00:00+00:00") \
            .lte('enviado_at', f"{today_iso}T23:59:59+00:00") \
            .execute()
        recordatorios_enviados_hoy = rh.count or 0
    except Exception:
        pass
    try:
        from routes_recordatorios import get_recent_errors
        errores_recientes = len(get_recent_errors())
    except Exception:
        pass

    kpis = {
        'verificaciones_pendientes': sum(p['pendientes'] for p in pendientes_verif),
        'comentarios_pendientes': len([p for p in pendientes_equipo if p['tipo'] == 'comentario']),
        'tareas_proximas': len([p for p in pendientes_equipo if p['tipo'] == 'tarea']),
        'eventos_proximos': len(proximos),
        'musicos_sin_activar': musicos_sin_activar,
        'recordatorios_enviados_hoy': recordatorios_enviados_hoy,
        'errores_recientes': errores_recientes,
        'comidas_pendientes_confirmar': sum(c['pendientes'] for c in comidas_pendientes),
    }

    return {
        'kpis': kpis,
        'proximos_15_dias': proximos[:50],
        'pendientes_equipo': pendientes_equipo[:30],
        'pendientes_verificacion': pendientes_verif,
        'comidas_pendientes': comidas_pendientes[:20],
        'rango': {'desde': desde_s, 'hasta': hasta_s},
    }
