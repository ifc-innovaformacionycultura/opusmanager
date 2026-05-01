# Portal Routes - Músicos Dashboard
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from pydantic import BaseModel
from supabase_client import supabase
from auth_utils import get_current_user, get_current_musico
from typing import List, Optional, Any
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/portal", tags=["portal"])


# ==================== Helper: partitura por instrumento ====================
# Mapeo normalizado del instrumento del músico a la columna de partitura del
# evento que debe verse. Si el instrumento no coincide con ninguno, no se
# muestra ninguna partitura.
INSTRUMENTO_A_SECCION = {
    # Cuerda
    'violin': 'cuerda', 'violín': 'cuerda', 'violines': 'cuerda',
    'viola': 'cuerda', 'violas': 'cuerda',
    'cello': 'cuerda', 'chelo': 'cuerda', 'violonchelo': 'cuerda', 'violoncello': 'cuerda',
    'contrabajo': 'cuerda', 'contrabajos': 'cuerda',
    # Viento madera
    'flauta': 'viento_madera', 'flauta travesera': 'viento_madera', 'flautin': 'viento_madera', 'flautín': 'viento_madera',
    'oboe': 'viento_madera', 'corno ingles': 'viento_madera', 'corno inglés': 'viento_madera',
    'clarinete': 'viento_madera', 'clarinete bajo': 'viento_madera',
    'fagot': 'viento_madera', 'contrafagot': 'viento_madera',
    'saxofon': 'viento_madera', 'saxofón': 'viento_madera', 'saxo': 'viento_madera',
    # Viento metal
    'trompa': 'viento_metal', 'corno': 'viento_metal', 'corno frances': 'viento_metal', 'corno francés': 'viento_metal',
    'trompeta': 'viento_metal',
    'trombon': 'viento_metal', 'trombón': 'viento_metal',
    'tuba': 'viento_metal',
    # Percusión
    'percusion': 'percusion', 'percusión': 'percusion',
    'timbales': 'percusion', 'bateria': 'percusion', 'batería': 'percusion',
    # Coro
    'tenor': 'coro', 'soprano': 'coro', 'baritono': 'coro', 'barítono': 'coro',
    'bajo': 'coro', 'mezzo': 'coro', 'mezzosoprano': 'coro', 'contratenor': 'coro',
    'coro': 'coro',
    # Teclados
    'piano': 'teclados', 'organo': 'teclados', 'órgano': 'teclados',
    'clave': 'teclados', 'clavecin': 'teclados', 'clavecín': 'teclados',
    'teclado': 'teclados', 'teclados': 'teclados',
}

def partitura_url_para_instrumento(evento: dict, instrumento: Optional[str]) -> Optional[str]:
    """Devuelve la URL de la partitura del evento correspondiente al instrumento del músico."""
    if not evento or not instrumento:
        return None
    seccion = INSTRUMENTO_A_SECCION.get(str(instrumento).strip().lower())
    if not seccion:
        return None
    return evento.get(f'partitura_{seccion}')

# ==================== Models ====================

class ConfirmarAsistenciaRequest(BaseModel):
    asignacion_id: str
    estado: str  # 'confirmado' or 'rechazado'
    comentarios: Optional[str] = None

class TitulacionItem(BaseModel):
    titulo: str
    institucion: Optional[str] = None
    anio: Optional[int] = None
    descripcion: Optional[str] = None
    archivo_url: Optional[str] = None
    archivo_nombre: Optional[str] = None

class MiPerfilUpdate(BaseModel):
    nombre: Optional[str] = None
    apellidos: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    dni: Optional[str] = None
    fecha_nacimiento: Optional[str] = None  # 'YYYY-MM-DD'
    nacionalidad: Optional[str] = None
    instrumento: Optional[str] = None
    otros_instrumentos: Optional[str] = None
    especialidad: Optional[str] = None
    anos_experiencia: Optional[int] = None
    bio: Optional[str] = None
    iban: Optional[str] = None
    swift: Optional[str] = None
    titulaciones: Optional[List[TitulacionItem]] = None

class NuevaReclamacionRequest(BaseModel):
    evento_id: Optional[str] = None
    tipo: str  # 'pago_incorrecto' | 'pago_no_recibido' | 'error_asistencia' | 'otro'
    descripcion: str

# ==================== Endpoints ====================

@router.post("/cambiar-password-primera-vez")
async def cambiar_password_primera_vez(current_user: dict = Depends(get_current_user)):
    """
    Marca que el usuario ya cambió su contraseña en el primer acceso.
    Solo actualiza el campo requiere_cambio_password a false.
    """
    try:
        user_profile = current_user.get("profile", {})
        usuario_id = user_profile.get("id")
        
        if not usuario_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Perfil de usuario no encontrado"
            )
        
        # Actualizar campo requiere_cambio_password
        supabase.table('usuarios') \
            .update({"requiere_cambio_password": False}) \
            .eq('id', usuario_id) \
            .execute()
        
        return {
            "message": "Password cambiada exitosamente",
            "requiere_cambio_password": False
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar estado: {str(e)}"
        )

@router.get("/mis-eventos")
async def get_mis_eventos(current_user: dict = Depends(get_current_user)):
    """
    Get all eventos assigned to current musician.
    Returns asignaciones with evento details and companeros_confirmados count.
    """
    try:
        user_profile = current_user.get("profile", {})
        usuario_id = user_profile.get("id")
        
        if not usuario_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Perfil de usuario no encontrado"
            )
        
        # Query asignaciones with evento details
        response = supabase.table('asignaciones') \
            .select('*, evento:eventos(*)') \
            .eq('usuario_id', usuario_id) \
            .order('created_at', desc=True) \
            .execute()
        
        asignaciones = response.data or []
        
        # Filtrar por publicado_musico=TRUE y estado != 'excluido'.
        # Los eventos ya no son visibles por "estado del evento", sino porque
        # el gestor ha publicado explícitamente la convocatoria a este músico
        # desde Seguimiento de Plantillas.
        asignaciones = [
            a for a in asignaciones
            if bool(a.get('publicado_musico')) and a.get('estado') != 'excluido'
        ]

        # Instrumento principal del músico para filtrar la partitura adecuada
        instrumento_musico = user_profile.get('instrumento')

        # Enriquecer/sanitizar el evento anidado: quitar notas internas del equipo
        # y añadir únicamente la partitura que corresponde al instrumento del músico.
        partitura_keys = (
            'partitura_cuerda', 'partitura_viento_madera', 'partitura_viento_metal',
            'partitura_percusion', 'partitura_coro', 'partitura_teclados'
        )
        for asig in asignaciones:
            evento = asig.get('evento') or {}
            # Ocultar campos internos
            evento.pop('notas', None)
            evento.pop('gestor_id', None)
            # Partitura específica por instrumento (no exponer todas)
            asig['partitura_url'] = partitura_url_para_instrumento(evento, instrumento_musico)
            for k in partitura_keys:
                evento.pop(k, None)
            asig['evento'] = evento

        # Ensayos del evento + mi_disponibilidad (bool o None)
        evento_ids = list({a.get('evento_id') for a in asignaciones if a.get('evento_id')})
        ensayos_by_evento = {}
        disp_map = {}  # ensayo_id -> mi_disponibilidad
        ei_conv_map = {}  # ensayo_id -> convocado (bool)
        if evento_ids:
            ens_res = supabase.table('ensayos') \
                .select('id,evento_id,tipo,fecha,hora,hora_fin,obligatorio,lugar') \
                .in_('evento_id', evento_ids) \
                .order('fecha', desc=False) \
                .execute()
            for e in (ens_res.data or []):
                ensayos_by_evento.setdefault(e['evento_id'], []).append(e)
            # Orden: ensayos (fecha ASC) → conciertos/funciones (fecha ASC)
            for evid, lst in ensayos_by_evento.items():
                lst.sort(key=lambda x: (0 if (x.get('tipo') or 'ensayo') == 'ensayo' else 1,
                                         x.get('fecha') or '', x.get('hora') or ''))
            ensayo_ids = [e['id'] for evs in ensayos_by_evento.values() for e in evs]
            if ensayo_ids:
                d_res = supabase.table('disponibilidad') \
                    .select('ensayo_id,asiste') \
                    .eq('usuario_id', usuario_id) \
                    .in_('ensayo_id', ensayo_ids) \
                    .execute()
                for d in (d_res.data or []):
                    disp_map[d['ensayo_id']] = d.get('asiste')
                # Convocatoria para el instrumento del músico actual
                if instrumento_musico:
                    ei_res = supabase.table('ensayo_instrumentos') \
                        .select('ensayo_id,convocado') \
                        .in_('ensayo_id', ensayo_ids) \
                        .eq('instrumento', instrumento_musico) \
                        .execute()
                    for row in (ei_res.data or []):
                        ei_conv_map[row['ensayo_id']] = bool(row.get('convocado', True))

        for asig in asignaciones:
            ensayos = ensayos_by_evento.get(asig.get('evento_id'), [])
            ensayos_enriched = []
            for e in ensayos:
                ensayos_enriched.append({
                    "id": e['id'],
                    "fecha": e.get('fecha'),
                    "hora": e.get('hora'),
                    "hora_fin": e.get('hora_fin'),
                    "tipo": e.get('tipo'),
                    "lugar": e.get('lugar'),
                    "obligatorio": e.get('obligatorio'),
                    "mi_disponibilidad": disp_map.get(e['id']),
                    "convocado": ei_conv_map.get(e['id'], True),
                })
            asig['ensayos'] = ensayos_enriched
        
        # Enriquecer cada asignación con conteo de compañeros confirmados
        # (sin revelar nombres) para cada evento
        for asig in asignaciones:
            evento_id = asig.get('evento_id')
            if not evento_id:
                asig['companeros_confirmados'] = 0
                asig['companeros_total'] = 0
                continue
            
            # Total de asignaciones para el evento (excluyendo al músico actual)
            total_res = supabase.table('asignaciones') \
                .select('id', count='exact') \
                .eq('evento_id', evento_id) \
                .neq('usuario_id', usuario_id) \
                .execute()
            total = total_res.count or 0
            
            # Confirmados para el evento (excluyendo al músico actual)
            conf_res = supabase.table('asignaciones') \
                .select('id', count='exact') \
                .eq('evento_id', evento_id) \
                .eq('estado', 'confirmado') \
                .neq('usuario_id', usuario_id) \
                .execute()
            confirmados = conf_res.count or 0
            
            asig['companeros_confirmados'] = confirmados
            asig['companeros_total'] = total
        
        return {
            "asignaciones": asignaciones
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar eventos: {str(e)}"
        )

@router.get("/calendario")
async def get_calendario(current_user: dict = Depends(get_current_user)):
    """
    Get calendar events for the musician:
    - Ensayos (blue)
    - Conciertos/funciones (green)
    - Fechas límite de eventos (orange)
    """
    try:
        user_profile = current_user.get("profile", {})
        usuario_id = user_profile.get("id")
        
        if not usuario_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Perfil de usuario no encontrado"
            )
        
        # Get asignaciones del músico para conocer los eventos asignados.
        # Filtramos para mostrar sólo los eventos con estado='abierto' en el calendario del músico.
        asigs = supabase.table('asignaciones') \
            .select('evento_id, evento:eventos(*)') \
            .eq('usuario_id', usuario_id) \
            .execute()
        
        asigs_visibles = [
            a for a in (asigs.data or [])
            if a.get('evento_id') and (a.get('evento') or {}).get('estado') == 'abierto'
        ]
        evento_ids = [a['evento_id'] for a in asigs_visibles]
        eventos_map = {a['evento_id']: a.get('evento') for a in asigs_visibles}
        
        calendar_events = []
        
        if evento_ids:
            # Ensayos y conciertos
            ensayos_res = supabase.table('ensayos') \
                .select('*') \
                .in_('evento_id', evento_ids) \
                .execute()
            
            for ens in (ensayos_res.data or []):
                tipo = (ens.get('tipo') or 'ensayo').lower()
                if tipo in ('concierto', 'funcion', 'función'):
                    color = 'green'
                    categoria = 'concierto'
                else:
                    color = 'blue'
                    categoria = 'ensayo'
                
                evento = eventos_map.get(ens.get('evento_id'), {}) or {}
                calendar_events.append({
                    "id": f"ensayo-{ens.get('id')}",
                    "tipo": categoria,
                    "titulo": f"{evento.get('nombre', 'Evento')} - {tipo.title()}",
                    "fecha": ens.get('fecha'),
                    "hora": ens.get('hora'),
                    "lugar": ens.get('lugar'),
                    "obligatorio": ens.get('obligatorio', False),
                    "color": color,
                    "evento_id": ens.get('evento_id'),
                    "evento_nombre": evento.get('nombre')
                })
            
            # Fechas límite (fecha_fin de eventos)
            for eid, ev in eventos_map.items():
                if ev and ev.get('fecha_fin'):
                    calendar_events.append({
                        "id": f"limite-{eid}",
                        "tipo": "fecha_limite",
                        "titulo": f"Fecha límite: {ev.get('nombre', '')}",
                        "fecha": ev.get('fecha_fin'),
                        "hora": None,
                        "lugar": None,
                        "obligatorio": False,
                        "color": "orange",
                        "evento_id": eid,
                        "evento_nombre": ev.get('nombre')
                    })

            # Fechas secundarias de función (punto 2) — se muestran en el calendario
            for eid, ev in eventos_map.items():
                if not ev:
                    continue
                for i in range(1, 5):
                    fecha_sec = ev.get(f'fecha_secundaria_{i}')
                    hora_sec = ev.get(f'hora_secundaria_{i}')
                    if fecha_sec:
                        calendar_events.append({
                            "id": f"funcion-{eid}-{i}",
                            "tipo": "concierto",
                            "titulo": f"{ev.get('nombre', 'Evento')} - Función {i + 1}",
                            "fecha": fecha_sec,
                            "hora": hora_sec,
                            "lugar": ev.get('lugar'),
                            "obligatorio": True,
                            "color": "green",
                            "evento_id": eid,
                            "evento_nombre": ev.get('nombre')
                        })

            # Bloque 10 — Desplazamientos y alojamientos del músico
            try:
                logs = supabase.table('evento_logistica').select('*') \
                    .in_('evento_id', evento_ids).execute().data or []
                for l in logs:
                    # Determinar si el músico ha confirmado
                    confirmaciones = l.get('confirmaciones') or []
                    if isinstance(confirmaciones, str):
                        import json as _json
                        try: confirmaciones = _json.loads(confirmaciones)
                        except Exception: confirmaciones = []
                    confirmado = False
                    if isinstance(confirmaciones, list):
                        confirmado = any(c.get('usuario_id') == usuario_id and c.get('confirmado') for c in confirmaciones)
                    elif isinstance(confirmaciones, dict):
                        confirmado = bool(confirmaciones.get(str(usuario_id)))

                    tipo = (l.get('tipo') or '').lower()
                    if tipo in ('transporte_ida', 'transporte_vuelta'):
                        color = 'orange'  # Desplazamiento
                        cat = 'transporte'
                        titulo = ('🚌 Ida' if tipo == 'transporte_ida' else '🚌 Vuelta') + f" — {eventos_map.get(l['evento_id'], {}).get('nombre', '—')}"
                    elif tipo == 'alojamiento':
                        color = 'purple'
                        cat = 'alojamiento'
                        titulo = f"🏨 Alojamiento — {eventos_map.get(l['evento_id'], {}).get('nombre', '—')}"
                    else:
                        continue

                    # Recordatorio si pendiente y dentro del plazo
                    aviso = None
                    fecha_lim = (l.get('fecha_limite_confirmacion') or '')[:10]
                    if not confirmado and fecha_lim:
                        try:
                            from datetime import datetime as _dt
                            dl = _dt.strptime(fecha_lim, '%Y-%m-%d').date()
                            if dl >= _dt.now().date():
                                aviso = f"⏰ Confirmar antes del {fecha_lim}"
                        except Exception:
                            pass

                    calendar_events.append({
                        "id": f"logistica-{l['id']}",
                        "tipo": cat,
                        "titulo": titulo,
                        "fecha": l.get('fecha'),
                        "hora": l.get('hora_salida'),
                        "lugar": l.get('lugar_salida') or l.get('lugar_llegada'),
                        "obligatorio": False,
                        "color": color,
                        "confirmado": confirmado,
                        "aviso": aviso,
                        "fecha_limite_confirmacion": fecha_lim or None,
                        "evento_id": l.get('evento_id'),
                        "evento_nombre": eventos_map.get(l.get('evento_id'), {}).get('nombre')
                    })
            except Exception:
                pass

        return {"eventos": calendar_events}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar calendario: {str(e)}"
        )

@router.get("/evento/{evento_id}/ensayos")
async def get_ensayos_evento(
    evento_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all ensayos for a specific evento.
    Añade `convocado` al instrumento del músico (current_user). Default True.
    """
    try:
        response = supabase.table('ensayos') \
            .select('*') \
            .eq('evento_id', evento_id) \
            .order('fecha', desc=False) \
            .order('hora', desc=False) \
            .execute()
        ensayos = response.data or []

        # Instrumento del músico actual
        user_profile = current_user.get("profile", {}) or {}
        instrumento = user_profile.get('instrumento')
        ensayo_ids = [e['id'] for e in ensayos]
        ei_map = {}
        if ensayo_ids and instrumento:
            ei_res = supabase.table('ensayo_instrumentos') \
                .select('ensayo_id,instrumento,convocado') \
                .in_('ensayo_id', ensayo_ids) \
                .eq('instrumento', instrumento) \
                .execute()
            for row in (ei_res.data or []):
                ei_map[row['ensayo_id']] = bool(row.get('convocado', True))
        for e in ensayos:
            e['convocado'] = ei_map.get(e['id'], True)  # default True si no hay override
        return {"ensayos": ensayos}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar ensayos: {str(e)}"
        )


# ==================================================================
# LOGÍSTICA del evento — vista del músico + confirmación
# ==================================================================

@router.get("/evento/{evento_id}/logistica")
async def get_logistica_musico(
    evento_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Devuelve la logística del evento + estado de confirmación del músico actual."""
    try:
        usuario_id = current_user.get("id") or (current_user.get("profile") or {}).get("id")
        log_res = supabase.table('evento_logistica').select('*') \
            .eq('evento_id', evento_id) \
            .order('tipo', desc=False) \
            .order('orden', desc=False) \
            .execute()
        items = log_res.data or []
        if not items:
            return {"logistica": []}

        ids = [it['id'] for it in items]
        confs = supabase.table('confirmaciones_logistica').select('*') \
            .eq('usuario_id', usuario_id) \
            .in_('logistica_id', ids).execute().data or []
        conf_by_lid = {c['logistica_id']: c for c in confs}

        for it in items:
            c = conf_by_lid.get(it['id'])
            it['mi_confirmacion'] = c.get('confirmado') if c else None
            it['mi_confirmacion_at'] = c.get('updated_at') if c else None
        return {"logistica": items}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar logística: {str(e)}"
        )


class ConfirmacionLogisticaPayload(BaseModel):
    confirmado: Optional[bool] = None  # True | False | None (resetear)


@router.post("/logistica/{logistica_id}/confirmar")
async def confirmar_logistica(
    logistica_id: str,
    payload: ConfirmacionLogisticaPayload,
    current_user: dict = Depends(get_current_user)
):
    """El músico confirma o rechaza una pieza de logística."""
    try:
        usuario_id = current_user.get("id") or (current_user.get("profile") or {}).get("id")
        if not usuario_id:
            raise HTTPException(status_code=400, detail="Usuario no identificado")
        # UPSERT manual
        existing = supabase.table('confirmaciones_logistica').select('id') \
            .eq('logistica_id', logistica_id) \
            .eq('usuario_id', usuario_id).limit(1).execute().data or []
        body = {
            "logistica_id": logistica_id,
            "usuario_id": usuario_id,
            "confirmado": payload.confirmado,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if existing:
            r = supabase.table('confirmaciones_logistica').update(body).eq('id', existing[0]['id']).execute()
        else:
            r = supabase.table('confirmaciones_logistica').insert(body).execute()
        return {"confirmacion": r.data[0] if r.data else None}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al confirmar: {str(e)}"
        )


@router.get("/evento/{evento_id}/comidas")
async def get_comidas_musico(
    evento_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Devuelve las comidas configuradas para el evento + estado de confirmación del músico."""
    try:
        usuario_id = current_user.get("id") or (current_user.get("profile") or {}).get("id")
        com_res = supabase.table('evento_comidas').select('*') \
            .eq('evento_id', evento_id) \
            .order('fecha', desc=False).order('orden', desc=False).execute()
        items = com_res.data or []
        if not items:
            return {"comidas": []}

        ids = [it['id'] for it in items]
        confs = supabase.table('confirmaciones_comida').select('*') \
            .eq('usuario_id', usuario_id) \
            .in_('comida_id', ids).execute().data or []
        conf_by_cid = {c['comida_id']: c for c in confs}

        for it in items:
            c = conf_by_cid.get(it['id'])
            it['mi_confirmacion'] = c.get('confirmado') if c else None
            it['mi_toma_cafe'] = c.get('toma_cafe') if c else None
            it['mi_confirmacion_at'] = c.get('updated_at') if c else None
            it['mi_opcion_menu'] = c.get('opcion_menu_seleccionada') if c else None
        return {"comidas": items}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar comidas: {str(e)}"
        )


class ConfirmacionComidaPayload(BaseModel):
    confirmado: Optional[bool] = None
    toma_cafe: Optional[bool] = None
    opcion_menu_seleccionada: Optional[str] = None


@router.post("/comidas/{comida_id}/confirmar")
async def confirmar_comida(
    comida_id: str,
    payload: ConfirmacionComidaPayload,
    current_user: dict = Depends(get_current_user)
):
    """El músico confirma o rechaza un servicio de comedor (y opcionalmente si tomará café / opción de menú)."""
    try:
        usuario_id = current_user.get("id") or (current_user.get("profile") or {}).get("id")
        if not usuario_id:
            raise HTTPException(status_code=400, detail="Usuario no identificado")
        existing = supabase.table('confirmaciones_comida').select('id') \
            .eq('comida_id', comida_id) \
            .eq('usuario_id', usuario_id).limit(1).execute().data or []
        body = {
            "comida_id": comida_id,
            "usuario_id": usuario_id,
            "confirmado": payload.confirmado,
            "toma_cafe": payload.toma_cafe,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if payload.opcion_menu_seleccionada is not None:
            body["opcion_menu_seleccionada"] = payload.opcion_menu_seleccionada
        if existing:
            r = supabase.table('confirmaciones_comida').update(body).eq('id', existing[0]['id']).execute()
        else:
            r = supabase.table('confirmaciones_comida').insert(body).execute()
        return {"confirmacion": r.data[0] if r.data else None}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al confirmar comida: {str(e)}"
        )


@router.get("/evento/{evento_id}/materiales")
async def get_materiales_evento(
    evento_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all materiales (partituras, etc.) for a specific evento.
    """
    try:
        response = supabase.table('materiales') \
            .select('*') \
            .eq('evento_id', evento_id) \
            .order('created_at', desc=True) \
            .execute()
        
        return {
            "materiales": response.data or []
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar materiales: {str(e)}"
        )

@router.put("/asignacion/{asignacion_id}/confirmar")
async def confirmar_asistencia(
    asignacion_id: str,
    data: ConfirmarAsistenciaRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Confirm or reject attendance to an evento.
    Updates asignacion estado.
    """
    try:
        user_profile = current_user.get("profile", {})
        usuario_id = user_profile.get("id")
        
        # Verify this asignacion belongs to current user
        asignacion = supabase.table('asignaciones') \
            .select('*') \
            .eq('id', asignacion_id) \
            .eq('usuario_id', usuario_id) \
            .single() \
            .execute()
        
        if not asignacion.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Asignación no encontrada"
            )
        
        # Update estado
        update_data = {
            "estado": data.estado,
            "fecha_respuesta": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        if data.comentarios:
            update_data["comentarios"] = data.comentarios
        
        response = supabase.table('asignaciones') \
            .update(update_data) \
            .eq('id', asignacion_id) \
            .execute()
        
        # Registro + notificaciones a gestores
        try:
            nombre = f"{user_profile.get('nombre','')} {user_profile.get('apellidos','')}".strip()
            evento_id = asignacion.data.get('evento_id')
            supabase.table('registro_actividad').insert({
                'tipo': 'convocatoria_respondida',
                'descripcion': f"{nombre} {data.estado} una convocatoria",
                'usuario_id': usuario_id,
                'usuario_nombre': nombre,
                'entidad_tipo': 'evento',
                'entidad_id': evento_id,
                'metadata': {"estado": data.estado}
            }).execute()
            gs = supabase.table('usuarios').select('id').eq('rol', 'gestor').execute().data or []
            titulo = f"{nombre} ha {data.estado} una convocatoria"
            for g in gs:
                supabase.table('notificaciones_gestor').insert({
                    'gestor_id': g['id'],
                    'tipo': 'convocatoria_respondida',
                    'titulo': titulo,
                    'entidad_tipo': 'evento',
                    'entidad_id': evento_id
                }).execute()
        except Exception:
            pass
        
        return {
            "message": f"Asistencia {'confirmada' if data.estado == 'confirmado' else 'rechazada'}",
            "asignacion": response.data[0] if response.data else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar asistencia: {str(e)}"
        )

@router.get("/mi-disponibilidad")
async def get_mi_disponibilidad(current_user: dict = Depends(get_current_user)):
    """
    Get availability records for current musician.
    """
    try:
        user_profile = current_user.get("profile", {})
        usuario_id = user_profile.get("id")
        
        response = supabase.table('disponibilidad') \
            .select('*, ensayo:ensayos(*)') \
            .eq('usuario_id', usuario_id) \
            .execute()
        
        return {
            "disponibilidad": response.data or []
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar disponibilidad: {str(e)}"
        )

@router.put("/disponibilidad/{ensayo_id}")
async def marcar_disponibilidad(
    ensayo_id: str,
    asiste: bool,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark availability for a specific ensayo.
    """
    try:
        user_profile = current_user.get("profile", {})
        usuario_id = user_profile.get("id")
        
        # Check if record exists
        existing = supabase.table('disponibilidad') \
            .select('*') \
            .eq('usuario_id', usuario_id) \
            .eq('ensayo_id', ensayo_id) \
            .execute()
        
        if existing.data and len(existing.data) > 0:
            # Update existing
            response = supabase.table('disponibilidad') \
                .update({"asiste": asiste, "updated_at": datetime.now().isoformat()}) \
                .eq('usuario_id', usuario_id) \
                .eq('ensayo_id', ensayo_id) \
                .execute()
        else:
            # Insert new
            response = supabase.table('disponibilidad') \
                .insert({
                    "usuario_id": usuario_id,
                    "ensayo_id": ensayo_id,
                    "asiste": asiste
                }) \
                .execute()
        
        return {
            "message": "Disponibilidad actualizada",
            "asiste": asiste
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar disponibilidad: {str(e)}"
        )


class DispEntry(BaseModel):
    ensayo_id: str
    asiste: Optional[bool] = None


class GuardarDisponibilidadRequest(BaseModel):
    entries: List[DispEntry]


@router.post("/disponibilidad/bulk")
async def guardar_disponibilidad_bulk(
    data: GuardarDisponibilidadRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    UPSERT de disponibilidad para varios ensayos del músico autenticado.
    Si `asiste=null` elimina el registro (vuelve a sin respuesta).
    """
    try:
        user_profile = current_user.get("profile", {})
        usuario_id = user_profile.get("id")
        if not usuario_id:
            raise HTTPException(status_code=400, detail="Perfil no encontrado")

        now = datetime.now().isoformat()
        actualizados = 0
        creados = 0
        borrados = 0
        for entry in data.entries:
            existing = supabase.table('disponibilidad') \
                .select('id') \
                .eq('usuario_id', usuario_id) \
                .eq('ensayo_id', entry.ensayo_id) \
                .execute()
            if entry.asiste is None:
                if existing.data:
                    supabase.table('disponibilidad') \
                        .delete() \
                        .eq('id', existing.data[0]['id']) \
                        .execute()
                    borrados += 1
                continue
            if existing.data:
                supabase.table('disponibilidad') \
                    .update({"asiste": entry.asiste, "updated_at": now}) \
                    .eq('id', existing.data[0]['id']) \
                    .execute()
                actualizados += 1
            else:
                supabase.table('disponibilidad') \
                    .insert({
                        "usuario_id": usuario_id,
                        "ensayo_id": entry.ensayo_id,
                        "asiste": entry.asiste,
                    }) \
                    .execute()
                creados += 1

        return {
            "ok": True,
            "actualizados": actualizados,
            "creados": creados,
            "borrados": borrados,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ==================== MI PERFIL (Bloque 1) ====================

@router.get("/mi-perfil")
async def get_mi_perfil(current_user: dict = Depends(get_current_user)):
    """Return full profile of current musician."""
    profile = current_user.get("profile") or {}
    return {"profile": profile}


@router.put("/mi-perfil")
async def update_mi_perfil(
    data: MiPerfilUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update profile fields of the current musician (no file uploads)."""
    user_profile = current_user.get("profile") or {}
    usuario_id = user_profile.get("id")
    if not usuario_id:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")

    payload = data.model_dump(exclude_none=True)
    # Convert titulaciones to list of dicts for JSONB
    if "titulaciones" in payload:
        payload["titulaciones"] = [t.model_dump() if hasattr(t, "model_dump") else t for t in payload["titulaciones"]]
    now_iso = datetime.utcnow().isoformat()
    payload["updated_at"] = now_iso
    payload["ultima_actualizacion_perfil"] = now_iso

    try:
        res = supabase.table('usuarios').update(payload).eq('id', usuario_id).execute()
        # Trazabilidad + notificaciones a gestores
        try:
            nombre = f"{user_profile.get('nombre','')} {user_profile.get('apellidos','')}".strip()
            supabase.table('registro_actividad').insert({
                'tipo': 'perfil_actualizado',
                'descripcion': f"{nombre} actualizó su perfil",
                'usuario_id': usuario_id,
                'usuario_nombre': nombre,
                'entidad_tipo': 'musico',
                'entidad_id': usuario_id
            }).execute()
            # Notificar a todos los gestores
            gs = supabase.table('usuarios').select('id').eq('rol', 'gestor').execute().data or []
            for g in gs:
                supabase.table('notificaciones_gestor').insert({
                    'gestor_id': g['id'],
                    'tipo': 'perfil_actualizado',
                    'titulo': f"{nombre} ha actualizado su perfil",
                    'descripcion': 'Revisa los cambios en la ficha del músico',
                    'entidad_tipo': 'musico',
                    'entidad_id': usuario_id
                }).execute()
        except Exception:
            pass
        return {"message": "Perfil actualizado", "profile": res.data[0] if res.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar perfil: {str(e)}")


@router.post("/mi-perfil/titulacion-archivo")
async def upload_titulacion_archivo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a PDF file for a titulación. Returns the public URL to be assigned in the titulación item."""
    user_profile = current_user.get("profile") or {}
    user_id = user_profile.get("user_id") or user_profile.get("id")

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Solo se admiten archivos PDF")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo no puede exceder 5MB")

    path = f"{user_id}/titulaciones/{uuid.uuid4().hex}.pdf"
    try:
        supabase.storage.from_('cv-files').upload(
            path=path,
            file=contents,
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
        public_url = supabase.storage.from_('cv-files').get_public_url(path)
        return {"archivo_url": public_url, "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir archivo: {str(e)}")


@router.post("/mi-perfil/foto")
async def upload_foto(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload profile photo (JPG/PNG, max 2MB) to Supabase Storage."""
    user_profile = current_user.get("profile") or {}
    usuario_id = user_profile.get("id")
    user_id = user_profile.get("user_id") or usuario_id

    if file.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
        raise HTTPException(status_code=400, detail="Solo se admiten imágenes JPG, PNG o WebP")
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La foto no puede exceder 2MB")

    ext = (file.filename or "photo.jpg").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    path = f"{user_id}/{uuid.uuid4().hex}.{ext}"

    try:
        supabase.storage.from_('profile-photos').upload(
            path=path,
            file=contents,
            file_options={"content-type": file.content_type, "upsert": "true"}
        )
        public_url = supabase.storage.from_('profile-photos').get_public_url(path)
        supabase.table('usuarios').update({"foto_url": public_url, "updated_at": datetime.utcnow().isoformat()}).eq('id', usuario_id).execute()
        return {"message": "Foto subida correctamente", "foto_url": public_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir foto: {str(e)}")


@router.post("/mi-perfil/cv")
async def upload_cv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload CV (PDF, max 5MB) to Supabase Storage."""
    user_profile = current_user.get("profile") or {}
    usuario_id = user_profile.get("id")
    user_id = user_profile.get("user_id") or usuario_id

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Solo se admiten archivos PDF")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El CV no puede exceder 5MB")

    path = f"{user_id}/{uuid.uuid4().hex}.pdf"
    try:
        supabase.storage.from_('cv-files').upload(
            path=path,
            file=contents,
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
        public_url = supabase.storage.from_('cv-files').get_public_url(path)
        supabase.table('usuarios').update({"cv_url": public_url, "updated_at": datetime.utcnow().isoformat()}).eq('id', usuario_id).execute()
        return {"message": "CV subido correctamente", "cv_url": public_url, "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir CV: {str(e)}")


@router.delete("/mi-perfil/cv")
async def delete_cv(current_user: dict = Depends(get_current_user)):
    """Remove CV URL from profile."""
    usuario_id = (current_user.get("profile") or {}).get("id")
    if not usuario_id:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")
    supabase.table('usuarios').update({"cv_url": None, "updated_at": datetime.utcnow().isoformat()}).eq('id', usuario_id).execute()
    return {"message": "CV eliminado"}


# ==================== MI HISTORIAL (Bloque 2) ====================

@router.get("/mi-historial/eventos")
async def get_historial_eventos(current_user: dict = Depends(get_current_user)):
    """Historial de eventos: lista todas las asignaciones del músico con info de ensayos.

    Cada asignación incluye:
      - ensayos[]: lista de ensayos del evento con `mi_disponibilidad` y `convocado`
        (mismo shape que /portal/mis-eventos para que el frontend pueda compartir lógica)
      - ensayos_total: nº de ensayos del evento
      - ensayos_confirmados: nº de ensayos del evento donde el músico marcó asiste=True
    """
    profile = current_user.get("profile") or {}
    usuario_id = profile.get("id")
    if not usuario_id:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")
    instrumento_musico = profile.get('instrumento')

    asigs_res = supabase.table('asignaciones') \
        .select('*, evento:eventos(*)') \
        .eq('usuario_id', usuario_id) \
        .order('created_at', desc=True) \
        .execute()
    asignaciones = asigs_res.data or []

    evento_ids = list({a.get('evento_id') for a in asignaciones if a.get('evento_id')})
    ensayos_by_evento = {}
    disp_map = {}
    ei_conv_map = {}
    if evento_ids:
        ens_res = supabase.table('ensayos') \
            .select('id,evento_id,tipo,fecha,hora,hora_fin,obligatorio,lugar') \
            .in_('evento_id', evento_ids) \
            .order('fecha', desc=False) \
            .execute()
        for e in (ens_res.data or []):
            ensayos_by_evento.setdefault(e['evento_id'], []).append(e)
        for evid, lst in ensayos_by_evento.items():
            lst.sort(key=lambda x: (0 if (x.get('tipo') or 'ensayo') == 'ensayo' else 1,
                                     x.get('fecha') or '', x.get('hora') or ''))
        ensayo_ids = [e['id'] for evs in ensayos_by_evento.values() for e in evs]
        if ensayo_ids:
            d_res = supabase.table('disponibilidad') \
                .select('ensayo_id,asiste,asistencia_real') \
                .eq('usuario_id', usuario_id) \
                .in_('ensayo_id', ensayo_ids) \
                .execute()
            for d in (d_res.data or []):
                disp_map[d['ensayo_id']] = d
            if instrumento_musico:
                ei_res = supabase.table('ensayo_instrumentos') \
                    .select('ensayo_id,convocado') \
                    .in_('ensayo_id', ensayo_ids) \
                    .eq('instrumento', instrumento_musico) \
                    .execute()
                for row in (ei_res.data or []):
                    ei_conv_map[row['ensayo_id']] = bool(row.get('convocado', True))

    for a in asignaciones:
        eid = a.get('evento_id')
        ensayos = ensayos_by_evento.get(eid, [])
        ensayos_enriched = []
        confirmados = 0
        for e in ensayos:
            d = disp_map.get(e['id']) or {}
            convocado = ei_conv_map.get(e['id'], True)
            ensayos_enriched.append({
                "id": e['id'],
                "fecha": e.get('fecha'),
                "hora": e.get('hora'),
                "hora_fin": e.get('hora_fin'),
                "tipo": e.get('tipo'),
                "lugar": e.get('lugar'),
                "obligatorio": e.get('obligatorio'),
                "mi_disponibilidad": d.get('asiste'),
                "asistencia_real": d.get('asistencia_real'),
                "convocado": convocado,
            })
            if convocado and d.get('asiste') is True:
                confirmados += 1
        a['ensayos'] = ensayos_enriched
        a['ensayos_total'] = len(ensayos)
        a['ensayos_confirmados'] = confirmados

    return {"asignaciones": asignaciones}


@router.get("/mi-historial/pagos")
async def get_historial_pagos(current_user: dict = Depends(get_current_user)):
    """Historial de pagos del músico derivado del campo estado_pago + importe de asignaciones."""
    usuario_id = (current_user.get("profile") or {}).get("id")
    if not usuario_id:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")

    res = supabase.table('asignaciones') \
        .select('id, evento_id, importe, estado, estado_pago, updated_at, evento:eventos(nombre, temporada)') \
        .eq('usuario_id', usuario_id) \
        .order('created_at', desc=True) \
        .execute()
    pagos = res.data or []

    total_cobrado = 0.0
    total_pendiente = 0.0
    for p in pagos:
        try:
            imp = float(p.get('importe') or 0)
        except Exception:
            imp = 0
        if p.get('estado_pago') == 'pagado':
            total_cobrado += imp
        else:
            total_pendiente += imp

    return {
        "pagos": pagos,
        "total_cobrado": round(total_cobrado, 2),
        "total_pendiente": round(total_pendiente, 2),
    }


@router.get("/mi-historial/reclamaciones")
async def get_reclamaciones(current_user: dict = Depends(get_current_user)):
    """Lista de reclamaciones del músico."""
    usuario_id = (current_user.get("profile") or {}).get("id")
    if not usuario_id:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")
    res = supabase.table('reclamaciones') \
        .select('*, evento:eventos(nombre, temporada)') \
        .eq('usuario_id', usuario_id) \
        .order('fecha_creacion', desc=True) \
        .execute()
    return {"reclamaciones": res.data or []}


@router.post("/mi-historial/reclamaciones")
async def crear_reclamacion(
    data: NuevaReclamacionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Crea una reclamación desde el portal del músico."""
    usuario_id = (current_user.get("profile") or {}).get("id")
    if not usuario_id:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")

    payload = {
        "usuario_id": usuario_id,
        "evento_id": data.evento_id,
        "tipo": data.tipo,
        "descripcion": data.descripcion,
        "estado": "pendiente"
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    try:
        res = supabase.table('reclamaciones').insert(payload).execute()
        # Registro de actividad + notificar gestores
        try:
            nombre = f"{(current_user.get('profile') or {}).get('nombre','')} {(current_user.get('profile') or {}).get('apellidos','')}".strip()
            r_id = res.data[0]['id'] if res.data else None
            supabase.table('registro_actividad').insert({
                'tipo': 'reclamacion_enviada',
                'descripcion': f"{nombre} envió una reclamación ({data.tipo})",
                'usuario_id': usuario_id,
                'usuario_nombre': nombre,
                'entidad_tipo': 'reclamacion',
                'entidad_id': r_id
            }).execute()
            gs = supabase.table('usuarios').select('id').eq('rol', 'gestor').execute().data or []
            for g in gs:
                supabase.table('notificaciones_gestor').insert({
                    'gestor_id': g['id'],
                    'tipo': 'reclamacion_nueva',
                    'titulo': f"Nueva reclamación de {nombre}",
                    'descripcion': data.descripcion[:200],
                    'entidad_tipo': 'reclamacion',
                    'entidad_id': r_id
                }).execute()
        except Exception:
            pass
        return {"message": "Reclamación enviada", "reclamacion": res.data[0] if res.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar reclamación: {str(e)}")
