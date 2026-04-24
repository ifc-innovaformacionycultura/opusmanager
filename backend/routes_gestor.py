# Gestor Routes - Admin/Manager endpoints
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from supabase_client import supabase, create_user_profile
from auth_utils import get_current_user, get_current_gestor
from typing import List, Optional
from datetime import datetime
from io import BytesIO, StringIO
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
import csv
import secrets
import string
from email_service import send_musico_credentials_email

router = APIRouter(prefix="/api/gestor", tags=["gestor"])

# ==================== Models ====================

class EventoCreate(BaseModel):
    nombre: str
    temporada: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    tipo: Optional[str] = None
    lugar: Optional[str] = None
    notas: Optional[str] = None
    # Fechas secundarias de función (punto 2)
    fecha_secundaria_1: Optional[str] = None
    hora_secundaria_1: Optional[str] = None
    fecha_secundaria_2: Optional[str] = None
    hora_secundaria_2: Optional[str] = None
    fecha_secundaria_3: Optional[str] = None
    hora_secundaria_3: Optional[str] = None
    fecha_secundaria_4: Optional[str] = None
    hora_secundaria_4: Optional[str] = None
    # Partituras por sección instrumental (punto 3)
    partitura_cuerda: Optional[str] = None
    partitura_viento_madera: Optional[str] = None
    partitura_viento_metal: Optional[str] = None
    partitura_percusion: Optional[str] = None
    partitura_coro: Optional[str] = None
    partitura_teclados: Optional[str] = None
    # Notas y enlaces para músicos (punto 4)
    notas_musicos: Optional[str] = None
    info_adicional_url_1: Optional[str] = None
    info_adicional_url_2: Optional[str] = None
    info_adicional_url_3: Optional[str] = None

class EventoUpdate(BaseModel):
    nombre: Optional[str] = None
    temporada: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    estado: Optional[str] = None
    tipo: Optional[str] = None
    lugar: Optional[str] = None
    notas: Optional[str] = None
    # Fechas secundarias de función (punto 2)
    fecha_secundaria_1: Optional[str] = None
    hora_secundaria_1: Optional[str] = None
    fecha_secundaria_2: Optional[str] = None
    hora_secundaria_2: Optional[str] = None
    fecha_secundaria_3: Optional[str] = None
    hora_secundaria_3: Optional[str] = None
    fecha_secundaria_4: Optional[str] = None
    hora_secundaria_4: Optional[str] = None
    # Partituras por sección instrumental (punto 3)
    partitura_cuerda: Optional[str] = None
    partitura_viento_madera: Optional[str] = None
    partitura_viento_metal: Optional[str] = None
    partitura_percusion: Optional[str] = None
    partitura_coro: Optional[str] = None
    partitura_teclados: Optional[str] = None
    # Notas y enlaces para músicos (punto 4)
    notas_musicos: Optional[str] = None
    info_adicional_url_1: Optional[str] = None
    info_adicional_url_2: Optional[str] = None
    info_adicional_url_3: Optional[str] = None

class AsignacionCreate(BaseModel):
    usuario_id: str
    evento_id: str
    importe: Optional[float] = 0
    comentarios: Optional[str] = None

class EnsayoCreate(BaseModel):
    evento_id: str
    fecha: str  # ISO date string
    hora: str  # HH:MM format
    tipo: str = "ensayo"  # 'ensayo', 'concierto', 'funcion'
    obligatorio: bool = True
    lugar: Optional[str] = None
    notas: Optional[str] = None

class MusicoCreate(BaseModel):
    email: EmailStr
    nombre: str
    apellidos: str
    instrumento: Optional[str] = None
    telefono: Optional[str] = None

# ==================== Eventos ====================

@router.get("/eventos")
async def get_eventos(
    estado: Optional[str] = None,
    temporada: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor)
):
    """Get all eventos (with optional filters)"""
    try:
        query = supabase.table('eventos').select('*')
        
        if estado:
            query = query.eq('estado', estado)
        if temporada:
            query = query.eq('temporada', temporada)
        
        response = query.order('created_at', desc=True).execute()
        
        return {"eventos": response.data or []}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar eventos: {str(e)}"
        )

@router.post("/eventos")
async def create_evento(
    data: EventoCreate,
    current_user: dict = Depends(get_current_gestor)
):
    """Create new evento"""
    try:
        gestor_id = current_user.get("profile", {}).get("id")
        
        evento_data = {
            **data.model_dump(exclude_none=True),
            "gestor_id": gestor_id,
            "estado": "abierto"
        }
        
        response = supabase.table('eventos').insert(evento_data).execute()
        
        return {
            "message": "Evento creado",
            "evento": response.data[0] if response.data else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear evento: {str(e)}"
        )

@router.get("/eventos/{evento_id}")
async def get_evento(
    evento_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Get evento by ID with related data"""
    try:
        # Get evento with asignaciones and ensayos
        evento = supabase.table('eventos').select('*').eq('id', evento_id).single().execute()
        
        if not evento.data:
            raise HTTPException(status_code=404, detail="Evento no encontrado")
        
        # Get asignaciones
        asignaciones = supabase.table('asignaciones') \
            .select('*, usuario:usuarios(*)') \
            .eq('evento_id', evento_id) \
            .execute()
        
        # Get ensayos
        ensayos = supabase.table('ensayos') \
            .select('*') \
            .eq('evento_id', evento_id) \
            .order('fecha', desc=False) \
            .execute()
        
        return {
            "evento": evento.data,
            "asignaciones": asignaciones.data or [],
            "ensayos": ensayos.data or []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar evento: {str(e)}"
        )

@router.put("/eventos/{evento_id}")
async def update_evento(
    evento_id: str,
    data: EventoUpdate,
    current_user: dict = Depends(get_current_gestor)
):
    """Update evento"""
    try:
        # exclude_unset: permite borrar un campo enviándolo explícitamente como null.
        # Normalizamos strings vacíos a None para los campos de fecha/hora/url,
        # ya que PostgreSQL rechazaría "" en TIMESTAMPTZ/TIME.
        raw = data.model_dump(exclude_unset=True)
        null_on_empty = {
            'fecha_inicio', 'fecha_fin',
            'fecha_secundaria_1', 'fecha_secundaria_2', 'fecha_secundaria_3', 'fecha_secundaria_4',
            'hora_secundaria_1', 'hora_secundaria_2', 'hora_secundaria_3', 'hora_secundaria_4',
            'partitura_cuerda', 'partitura_viento_madera', 'partitura_viento_metal',
            'partitura_percusion', 'partitura_coro', 'partitura_teclados',
            'info_adicional_url_1', 'info_adicional_url_2', 'info_adicional_url_3',
        }
        for key in null_on_empty:
            if key in raw and raw[key] == '':
                raw[key] = None

        update_data = {
            **raw,
            "updated_at": datetime.now().isoformat()
        }
        
        response = supabase.table('eventos') \
            .update(update_data) \
            .eq('id', evento_id) \
            .execute()
        
        return {
            "message": "Evento actualizado",
            "evento": response.data[0] if response.data else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar evento: {str(e)}"
        )

# ==================== Seguimiento de Plantillas (Bloque D) ====================

from instrumentos import (
    SECCIONES_ORDER,
    seccion_de_instrumento,
    instrumento_sort_key,
)

def _funciones_del_evento(ev: dict) -> List[dict]:
    """Devuelve la lista de 'funciones' (fecha principal + secundarias) de un evento."""
    funciones = []
    if ev.get('fecha_inicio'):
        funciones.append({"fecha": ev['fecha_inicio'], "hora": None, "label": "Principal"})
    for i in range(1, 5):
        f = ev.get(f'fecha_secundaria_{i}')
        h = ev.get(f'hora_secundaria_{i}')
        if f:
            funciones.append({"fecha": f, "hora": h, "label": f"Función {i + 1}"})
    return funciones


def _nivel_estudios_efectivo(u: dict) -> Optional[str]:
    """Fallback: si no hay nivel_estudios, usa especialidad."""
    return u.get('nivel_estudios') or u.get('especialidad') or None


def _localidad_efectiva(u: dict) -> Optional[str]:
    """Fallback: si no hay localidad, extrae de direccion (última coma)."""
    if u.get('localidad'):
        return u['localidad']
    direccion = (u.get('direccion') or '').strip()
    if ',' in direccion:
        return direccion.rsplit(',', 1)[-1].strip() or None
    return None


@router.get("/seguimiento")
async def get_seguimiento(current_user: dict = Depends(get_current_gestor)):
    """
    Seguimiento de Plantillas — Estructura pivot Músicos × Eventos.

    Respuesta:
      {
        eventos: [{id, nombre, estado ('borrador'|'abierto'), fechas[], ensayos:[{id,tipo,fecha,hora,obligatorio}]}],
        musicos: [{
          id, nombre, apellidos, email, instrumento, especialidad,
          nivel_estudios (efectivo), baremo, localidad (efectiva), anos_experiencia,
          asignaciones: {
            evento_id: {
              asignacion_id, estado, publicado_musico,
              disponibilidad: { ensayo_id: {asiste, asistencia_real} },
              porcentaje_disponibilidad, porcentaje_asistencia_real
            }
          }
        }]
      }
    """
    try:
        # 1) Eventos abiertos o borrador
        eventos_res = supabase.table('eventos') \
            .select('*') \
            .in_('estado', ['borrador', 'abierto']) \
            .order('fecha_inicio', desc=False) \
            .execute()
        eventos_raw = eventos_res.data or []
        evento_ids = [e['id'] for e in eventos_raw]

        # 2) Ensayos de esos eventos
        ensayos_map = {}  # evento_id -> [ensayos]
        if evento_ids:
            ens_res = supabase.table('ensayos') \
                .select('id,evento_id,tipo,fecha,hora,obligatorio,lugar') \
                .in_('evento_id', evento_ids) \
                .order('fecha', desc=False) \
                .execute()
            for e in (ens_res.data or []):
                ensayos_map.setdefault(e['evento_id'], []).append(e)

        eventos_out = []
        for ev in eventos_raw:
            eventos_out.append({
                "id": ev['id'],
                "nombre": ev.get('nombre'),
                "estado": ev.get('estado'),
                "tipo": ev.get('tipo'),
                "lugar": ev.get('lugar'),
                "temporada": ev.get('temporada'),
                "fecha_inicio": ev.get('fecha_inicio'),
                "fecha_fin": ev.get('fecha_fin'),
                "fechas": _funciones_del_evento(ev),
                "ensayos": ensayos_map.get(ev['id'], []),
            })

        # 3) Músicos activos
        musicos_res = supabase.table('usuarios') \
            .select('id,nombre,apellidos,email,instrumento,especialidad,nivel_estudios,baremo,localidad,direccion,anos_experiencia,estado') \
            .eq('rol', 'musico') \
            .eq('estado', 'activo') \
            .order('apellidos', desc=False) \
            .execute()
        musicos_raw = musicos_res.data or []

        # 4) Asignaciones
        asigs_list = []
        if evento_ids:
            a_res = supabase.table('asignaciones') \
                .select('id,usuario_id,evento_id,estado,publicado_musico,cache_presupuestado,importe') \
                .in_('evento_id', evento_ids) \
                .execute()
            asigs_list = a_res.data or []

        # 5) Disponibilidades de esos usuarios (solo para los ensayos conocidos)
        ensayo_ids = [e['id'] for evlist in ensayos_map.values() for e in evlist]
        disp_map = {}  # (usuario_id, ensayo_id) -> disponibilidad
        if ensayo_ids:
            d_res = supabase.table('disponibilidad') \
                .select('id,usuario_id,ensayo_id,asiste,asistencia_real') \
                .in_('ensayo_id', ensayo_ids) \
                .execute()
            for d in (d_res.data or []):
                disp_map[(d['usuario_id'], d['ensayo_id'])] = d

        # Index asignaciones por (usuario_id, evento_id)
        asig_index = {(a['usuario_id'], a['evento_id']): a for a in asigs_list}

        # Total ensayos por evento
        total_ensayos_por_evento = {eid: len(evs) for eid, evs in ensayos_map.items()}

        musicos_out = []
        for u in musicos_raw:
            m = {
                "id": u['id'],
                "nombre": u.get('nombre') or '',
                "apellidos": u.get('apellidos') or '',
                "email": u.get('email') or '',
                "instrumento": u.get('instrumento'),
                "especialidad": u.get('especialidad'),
                "nivel_estudios": _nivel_estudios_efectivo(u),
                "baremo": u.get('baremo'),
                "localidad": _localidad_efectiva(u),
                "anos_experiencia": u.get('anos_experiencia'),
                "asignaciones": {}
            }
            for ev in eventos_raw:
                asig = asig_index.get((u['id'], ev['id']))
                ensayos = ensayos_map.get(ev['id'], [])
                disp_by_ensayo = {}
                si_disp = 0
                si_real = 0
                for e in ensayos:
                    d = disp_map.get((u['id'], e['id']))
                    if d:
                        disp_by_ensayo[e['id']] = {
                            "asiste": d.get('asiste'),
                            "asistencia_real": d.get('asistencia_real'),
                            "disponibilidad_id": d.get('id'),
                        }
                        if d.get('asiste') is True:
                            si_disp += 1
                        if d.get('asistencia_real') is True:
                            si_real += 1
                total_e = total_ensayos_por_evento.get(ev['id'], 0) or 0
                pct_disp = round((si_disp / total_e) * 100) if total_e else 0
                pct_real = round((si_real / total_e) * 100) if total_e else 0

                m["asignaciones"][ev['id']] = {
                    "asignacion_id": asig['id'] if asig else None,
                    "estado": asig['estado'] if asig else None,
                    "publicado_musico": bool(asig.get('publicado_musico')) if asig else False,
                    "disponibilidad": disp_by_ensayo,
                    "porcentaje_disponibilidad": pct_disp,
                    "porcentaje_asistencia_real": pct_real,
                }
            musicos_out.append(m)

        return {"eventos": eventos_out, "musicos": musicos_out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en seguimiento: {str(e)}")


class PublicarRequest(BaseModel):
    usuario_ids: List[str]
    evento_id: str
    publicar: bool


@router.post("/seguimiento/publicar")
async def seguimiento_publicar(
    data: PublicarRequest,
    current_user: dict = Depends(get_current_gestor)
):
    """
    Crea o actualiza asignaciones para publicar/despublicar un evento a un conjunto de músicos.
    - publicar=True:  crea asignación con estado='pendiente', publicado_musico=True, fecha_publicacion=NOW.
                     Si ya existe, sólo actualiza publicado_musico=True + fecha_publicacion.
    - publicar=False: si existe, publicado_musico=False. Si no existe, no hace nada.
    """
    if not data.usuario_ids:
        return {"publicados": 0, "despublicados": 0, "creados": 0}

    try:
        existing_res = supabase.table('asignaciones') \
            .select('id,usuario_id,publicado_musico') \
            .eq('evento_id', data.evento_id) \
            .in_('usuario_id', data.usuario_ids) \
            .execute()
        existing_by_user = {a['usuario_id']: a for a in (existing_res.data or [])}

        publicados = 0
        despublicados = 0
        creados = 0
        now = datetime.now().isoformat()

        for uid in data.usuario_ids:
            existing = existing_by_user.get(uid)
            if data.publicar:
                if existing:
                    supabase.table('asignaciones').update({
                        "publicado_musico": True,
                        "fecha_publicacion": now,
                        "updated_at": now,
                    }).eq('id', existing['id']).execute()
                    publicados += 1
                else:
                    supabase.table('asignaciones').insert({
                        "usuario_id": uid,
                        "evento_id": data.evento_id,
                        "estado": "pendiente",
                        "publicado_musico": True,
                        "fecha_publicacion": now,
                    }).execute()
                    creados += 1
            else:
                if existing:
                    supabase.table('asignaciones').update({
                        "publicado_musico": False,
                        "updated_at": now,
                    }).eq('id', existing['id']).execute()
                    despublicados += 1

        return {"publicados": publicados, "despublicados": despublicados, "creados": creados}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al publicar: {str(e)}")


class BulkAccionRequest(BaseModel):
    usuario_ids: List[str]
    evento_id: str
    accion: str  # 'pendiente' | 'confirmado' | 'no_disponible' | 'excluido' | 'rechazado'


@router.post("/seguimiento/bulk-accion")
async def seguimiento_bulk_accion(
    data: BulkAccionRequest,
    current_user: dict = Depends(get_current_gestor)
):
    """Aplica un cambio de estado a varios músicos para un evento (UPSERT)."""
    valid = {'pendiente', 'confirmado', 'rechazado', 'no_disponible', 'excluido'}
    if data.accion not in valid:
        raise HTTPException(status_code=400, detail=f"Acción inválida. Usa: {sorted(valid)}")
    if not data.usuario_ids:
        return {"actualizados": 0, "creados": 0}

    try:
        existing_res = supabase.table('asignaciones') \
            .select('id,usuario_id') \
            .eq('evento_id', data.evento_id) \
            .in_('usuario_id', data.usuario_ids) \
            .execute()
        existing_by_user = {a['usuario_id']: a['id'] for a in (existing_res.data or [])}

        actualizados = 0
        creados = 0
        now = datetime.now().isoformat()
        for uid in data.usuario_ids:
            if uid in existing_by_user:
                supabase.table('asignaciones') \
                    .update({"estado": data.accion, "updated_at": now}) \
                    .eq('id', existing_by_user[uid]) \
                    .execute()
                actualizados += 1
            else:
                supabase.table('asignaciones').insert({
                    "usuario_id": uid,
                    "evento_id": data.evento_id,
                    "estado": data.accion,
                }).execute()
                creados += 1

        return {"actualizados": actualizados, "creados": creados}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en acción masiva: {str(e)}")


# ==================== Plantillas Definitivas (Bloque D) ====================

def _cachet_lookup(cachets_rows: List[dict], instrumento: Optional[str], nivel: Optional[str]) -> Optional[float]:
    """Busca en cachets_config el importe para (instrumento, nivel). Case-insensitive."""
    if not instrumento:
        return None
    i = str(instrumento).strip().lower()
    n = str(nivel or '').strip().lower()
    # Match exacto instrumento+nivel
    for r in cachets_rows:
        if (r.get('instrumento') or '').strip().lower() == i and \
           (r.get('nivel_estudios') or '').strip().lower() == n:
            return float(r['importe']) if r.get('importe') is not None else None
    # Fallback: solo instrumento (nivel NULL/vacío en config)
    for r in cachets_rows:
        if (r.get('instrumento') or '').strip().lower() == i and \
           not (r.get('nivel_estudios') or '').strip():
            return float(r['importe']) if r.get('importe') is not None else None
    return None


@router.get("/plantillas-definitivas")
async def get_plantillas_definitivas(current_user: dict = Depends(get_current_gestor)):
    """
    Devuelve eventos que tienen al menos un músico confirmado,
    agrupados por sección instrumental, con todos los cálculos
    necesarios para la pantalla (disponibilidad, asistencia real,
    cachet previsto/real, gastos adicionales).
    """
    try:
        # Asignaciones confirmadas
        a_res = supabase.table('asignaciones') \
            .select('id,usuario_id,evento_id,estado,cache_presupuestado,importe,numero_atril,letra,comentarios,nivel_estudios,porcentaje_asistencia') \
            .eq('estado', 'confirmado') \
            .execute()
        confirmadas = a_res.data or []
        if not confirmadas:
            return {"eventos": []}

        evento_ids = list({a['evento_id'] for a in confirmadas})
        usuario_ids = list({a['usuario_id'] for a in confirmadas})

        eventos_res = supabase.table('eventos') \
            .select('*') \
            .in_('id', evento_ids) \
            .order('fecha_inicio', desc=False) \
            .execute()
        eventos_raw = eventos_res.data or []

        ens_res = supabase.table('ensayos') \
            .select('id,evento_id,tipo,fecha,hora,obligatorio,lugar') \
            .in_('evento_id', evento_ids) \
            .order('fecha', desc=False) \
            .execute()
        ensayos_by_evento = {}
        for e in (ens_res.data or []):
            ensayos_by_evento.setdefault(e['evento_id'], []).append(e)

        usuarios_res = supabase.table('usuarios') \
            .select('id,nombre,apellidos,email,instrumento,especialidad,nivel_estudios,baremo,localidad,direccion,anos_experiencia') \
            .in_('id', usuario_ids) \
            .execute()
        usuarios_by_id = {u['id']: u for u in (usuarios_res.data or [])}

        ensayo_ids = [e['id'] for evs in ensayos_by_evento.values() for e in evs]
        disp_by_pair = {}  # (usuario_id, ensayo_id) -> row
        if ensayo_ids:
            d_res = supabase.table('disponibilidad') \
                .select('id,usuario_id,ensayo_id,asiste,asistencia_real') \
                .in_('ensayo_id', ensayo_ids) \
                .in_('usuario_id', usuario_ids) \
                .execute()
            for d in (d_res.data or []):
                disp_by_pair[(d['usuario_id'], d['ensayo_id'])] = d

        gastos_res = supabase.table('gastos_adicionales') \
            .select('*') \
            .in_('evento_id', evento_ids) \
            .in_('usuario_id', usuario_ids) \
            .execute()
        gastos_by_pair = {(g['usuario_id'], g['evento_id']): g for g in (gastos_res.data or [])}

        cachets_res = supabase.table('cachets_config') \
            .select('id,evento_id,instrumento,nivel_estudios,importe') \
            .in_('evento_id', evento_ids) \
            .execute()
        cachets_by_evento = {}
        for c in (cachets_res.data or []):
            cachets_by_evento.setdefault(c['evento_id'], []).append(c)

        eventos_out = []
        for ev in eventos_raw:
            ensayos = ensayos_by_evento.get(ev['id'], [])
            total_e = len(ensayos)
            asigs_ev = [a for a in confirmadas if a['evento_id'] == ev['id']]

            # Construir músicos agrupados por sección
            secciones_map = {key: [] for key, _label in SECCIONES_ORDER}
            sin_seccion = []
            total_ev = {
                "cache_previsto": 0.0, "cache_real": 0.0, "extras": 0.0,
                "transporte": 0.0, "alojamiento": 0.0, "otros": 0.0, "total": 0.0,
            }
            for a in asigs_ev:
                u = usuarios_by_id.get(a['usuario_id'])
                if not u:
                    continue
                disp_list = []
                asist_list = []
                for e in ensayos:
                    d = disp_by_pair.get((u['id'], e['id']))
                    disp_list.append({
                        "ensayo_id": e['id'],
                        "asiste": d.get('asiste') if d else None,
                        "disponibilidad_id": d.get('id') if d else None,
                    })
                    asist_list.append({
                        "ensayo_id": e['id'],
                        "asistencia_real": d.get('asistencia_real') if d else None,
                    })
                si_disp = sum(1 for x in disp_list if x["asiste"] is True)
                si_real = sum(1 for x in asist_list if x["asistencia_real"] is True)
                pct_disp = round((si_disp / total_e) * 100) if total_e else 0
                pct_real = round((si_real / total_e) * 100) if total_e else 0

                # Caché previsto: cachets_config → fallback asignaciones.cache_presupuestado → asignaciones.importe
                nivel_efectivo = a.get('nivel_estudios') or _nivel_estudios_efectivo(u)
                cache_prev = _cachet_lookup(cachets_by_evento.get(ev['id'], []), u.get('instrumento'), nivel_efectivo)
                if cache_prev is None:
                    cache_prev = float(a.get('cache_presupuestado') or a.get('importe') or 0)

                cache_real = round(cache_prev * (pct_real / 100.0), 2)

                g = gastos_by_pair.get((u['id'], ev['id'])) or {}
                extras = float(g.get('cache_extra') or 0)
                transp = float(g.get('transporte_importe') or 0)
                aloj = float(g.get('alojamiento_importe') or 0)
                otros = float(g.get('otros_importe') or 0)
                total = round(cache_real + extras + transp + aloj + otros, 2)

                total_ev["cache_previsto"] += cache_prev
                total_ev["cache_real"]     += cache_real
                total_ev["extras"]         += extras
                total_ev["transporte"]     += transp
                total_ev["alojamiento"]    += aloj
                total_ev["otros"]          += otros
                total_ev["total"]          += total

                musico_row = {
                    "asignacion_id": a['id'],
                    "usuario_id": u['id'],
                    "nombre": u.get('nombre') or '',
                    "apellidos": u.get('apellidos') or '',
                    "email": u.get('email') or '',
                    "instrumento": u.get('instrumento'),
                    "especialidad": u.get('especialidad'),
                    "nivel_estudios": nivel_efectivo,
                    "numero_atril": a.get('numero_atril'),
                    "letra": a.get('letra'),
                    "comentario": a.get('comentarios') or '',
                    "disponibilidad": disp_list,
                    "asistencia": asist_list,
                    "porcentaje_disponibilidad": pct_disp,
                    "porcentaje_asistencia_real": pct_real,
                    "cache_previsto": round(cache_prev, 2),
                    "cache_real": cache_real,
                    "gastos_adicional_id": g.get('id'),
                    "cache_extra": extras,
                    "motivo_extra": g.get('notas') or '',
                    "transporte_importe": transp,
                    "transporte_justificante_url": g.get('transporte_justificante_url'),
                    "alojamiento_importe": aloj,
                    "alojamiento_justificante_url": g.get('alojamiento_justificante_url'),
                    "otros_importe": otros,
                    "otros_justificante_url": g.get('otros_justificante_url'),
                    "total": total,
                }
                sec_key = seccion_de_instrumento(u.get('instrumento'))
                if sec_key:
                    secciones_map[sec_key].append(musico_row)
                else:
                    sin_seccion.append(musico_row)

            # Ordenar dentro de cada sección por instrumento → apellidos
            for key in secciones_map:
                secciones_map[key].sort(key=lambda m: (instrumento_sort_key(m.get('instrumento')),
                                                       (m.get('apellidos') or '').lower()))
            sin_seccion.sort(key=lambda m: (m.get('apellidos') or '').lower())

            secciones_out = []
            for key, label in SECCIONES_ORDER:
                musicos_sec = secciones_map[key]
                if not musicos_sec:
                    continue
                sec_totals = {k: 0.0 for k in ("cache_previsto","cache_real","extras","transporte","alojamiento","otros","total")}
                for m in musicos_sec:
                    sec_totals["cache_previsto"] += m["cache_previsto"]
                    sec_totals["cache_real"]     += m["cache_real"]
                    sec_totals["extras"]         += m["cache_extra"]
                    sec_totals["transporte"]     += m["transporte_importe"]
                    sec_totals["alojamiento"]    += m["alojamiento_importe"]
                    sec_totals["otros"]          += m["otros_importe"]
                    sec_totals["total"]          += m["total"]
                secciones_out.append({
                    "key": key, "label": label,
                    "count": len(musicos_sec),
                    "musicos": musicos_sec,
                    "totales": {k: round(v, 2) for k, v in sec_totals.items()},
                })
            if sin_seccion:
                sec_totals = {k: 0.0 for k in ("cache_previsto","cache_real","extras","transporte","alojamiento","otros","total")}
                for m in sin_seccion:
                    sec_totals["cache_previsto"] += m["cache_previsto"]
                    sec_totals["cache_real"]     += m["cache_real"]
                    sec_totals["extras"]         += m["cache_extra"]
                    sec_totals["transporte"]     += m["transporte_importe"]
                    sec_totals["alojamiento"]    += m["alojamiento_importe"]
                    sec_totals["otros"]          += m["otros_importe"]
                    sec_totals["total"]          += m["total"]
                secciones_out.append({
                    "key": "otros", "label": "Sin sección",
                    "count": len(sin_seccion),
                    "musicos": sin_seccion,
                    "totales": {k: round(v, 2) for k, v in sec_totals.items()},
                })

            eventos_out.append({
                "id": ev['id'],
                "nombre": ev.get('nombre'),
                "estado": ev.get('estado'),
                "fechas": _funciones_del_evento(ev),
                "lugar": ev.get('lugar'),
                "ensayos": ensayos,
                "total_musicos": len(asigs_ev),
                "totales": {k: round(v, 2) for k, v in total_ev.items()},
                "secciones": secciones_out,
            })

        return {"eventos": eventos_out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en plantillas definitivas: {str(e)}")


class AsistenciaItem(BaseModel):
    disponibilidad_id: Optional[str] = None
    usuario_id: Optional[str] = None
    ensayo_id: Optional[str] = None
    asistencia_real: Optional[bool] = None


class GastoItem(BaseModel):
    usuario_id: str
    evento_id: str
    transporte_importe: Optional[float] = None
    transporte_justificante_url: Optional[str] = None
    alojamiento_importe: Optional[float] = None
    alojamiento_justificante_url: Optional[str] = None
    otros_importe: Optional[float] = None
    otros_justificante_url: Optional[str] = None
    cache_extra: Optional[float] = None
    notas: Optional[str] = None


class AnotacionItem(BaseModel):
    asignacion_id: str
    numero_atril: Optional[int] = None
    letra: Optional[str] = None
    comentario: Optional[str] = None


class GuardarPlantillasRequest(BaseModel):
    asistencias: List[AsistenciaItem] = []
    gastos: List[GastoItem] = []
    anotaciones: List[AnotacionItem] = []


@router.put("/plantillas-definitivas/guardar")
async def guardar_plantillas_definitivas(
    data: GuardarPlantillasRequest,
    current_user: dict = Depends(get_current_gestor)
):
    """
    Persiste cambios de Plantillas Definitivas en una sola llamada:
      - asistencias: UPDATE/UPSERT disponibilidad.asistencia_real
      - gastos: UPSERT gastos_adicionales (usuario_id + evento_id UNIQUE)
      - anotaciones: UPDATE asignaciones.numero_atril / letra / comentarios
      - Actualiza asignaciones.porcentaje_asistencia por cada asignación tocada
    """
    now = datetime.now().isoformat()
    resumen = {"asistencias": 0, "gastos": 0, "anotaciones": 0}
    try:
        # 1) Asistencias
        for a in data.asistencias:
            if a.disponibilidad_id:
                supabase.table('disponibilidad').update({
                    "asistencia_real": a.asistencia_real,
                    "updated_at": now,
                }).eq('id', a.disponibilidad_id).execute()
                resumen["asistencias"] += 1
            elif a.usuario_id and a.ensayo_id:
                # UPSERT por (usuario_id, ensayo_id) — la tabla tiene UNIQUE sobre estos dos campos
                ex = supabase.table('disponibilidad') \
                    .select('id') \
                    .eq('usuario_id', a.usuario_id).eq('ensayo_id', a.ensayo_id).limit(1).execute()
                if ex.data:
                    supabase.table('disponibilidad').update({
                        "asistencia_real": a.asistencia_real,
                        "updated_at": now,
                    }).eq('id', ex.data[0]['id']).execute()
                else:
                    supabase.table('disponibilidad').insert({
                        "usuario_id": a.usuario_id,
                        "ensayo_id": a.ensayo_id,
                        "asistencia_real": a.asistencia_real,
                    }).execute()
                resumen["asistencias"] += 1

        # 2) Gastos — UPSERT por (usuario_id, evento_id)
        for g in data.gastos:
            payload = {k: v for k, v in g.model_dump(exclude_unset=True).items() if k not in ('usuario_id', 'evento_id')}
            if not payload:
                payload = {}
            payload["updated_at"] = now
            ex = supabase.table('gastos_adicionales') \
                .select('id') \
                .eq('usuario_id', g.usuario_id).eq('evento_id', g.evento_id).limit(1).execute()
            if ex.data:
                supabase.table('gastos_adicionales').update(payload).eq('id', ex.data[0]['id']).execute()
            else:
                insert_payload = {"usuario_id": g.usuario_id, "evento_id": g.evento_id, **payload}
                supabase.table('gastos_adicionales').insert(insert_payload).execute()
            resumen["gastos"] += 1

        # 3) Anotaciones
        asigs_ids_tocadas = set()
        for n in data.anotaciones:
            payload = {k: v for k, v in {
                "numero_atril": n.numero_atril,
                "letra": n.letra,
                "comentarios": n.comentario,
                "updated_at": now,
            }.items() if v is not None or k == "updated_at"}
            supabase.table('asignaciones').update(payload).eq('id', n.asignacion_id).execute()
            resumen["anotaciones"] += 1
            asigs_ids_tocadas.add(n.asignacion_id)

        # 4) Recalcular porcentaje_asistencia para las asignaciones tocadas por asistencias
        #    (buscamos las asignaciones de esos usuario+evento)
        pares = {(a.usuario_id, a.ensayo_id) for a in data.asistencias if a.usuario_id and a.ensayo_id}
        if pares:
            usuario_ids = list({u for (u, _) in pares})
            ensayo_ids = list({e for (_, e) in pares})
            # evento_id de esos ensayos
            e_res = supabase.table('ensayos').select('id,evento_id').in_('id', ensayo_ids).execute()
            eventos_de_ens = {e['id']: e['evento_id'] for e in (e_res.data or [])}
            evento_ids = list({eventos_de_ens[eid] for eid in ensayo_ids if eid in eventos_de_ens})
            # Para cada (usuario, evento) recalcular
            for uid in usuario_ids:
                for evid in evento_ids:
                    # contar ensayos + asistencias reales
                    all_e = supabase.table('ensayos').select('id').eq('evento_id', evid).execute().data or []
                    total = len(all_e)
                    if not total:
                        continue
                    all_ids = [x['id'] for x in all_e]
                    d = supabase.table('disponibilidad').select('asistencia_real') \
                        .eq('usuario_id', uid).in_('ensayo_id', all_ids).execute().data or []
                    si = sum(1 for x in d if x.get('asistencia_real') is True)
                    pct = round((si / total) * 100, 2)
                    supabase.table('asignaciones').update({
                        "porcentaje_asistencia": pct, "updated_at": now
                    }).eq('usuario_id', uid).eq('evento_id', evid).execute()

        return {"ok": True, "resumen": resumen}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")


# ==================== Cachets Config & Upload justificantes ====================

class CachetRow(BaseModel):
    instrumento: str
    nivel_estudios: Optional[str] = None
    importe: float


@router.post("/plantillas-definitivas/justificante")
async def upload_justificante(
    archivo: UploadFile = File(...),
    usuario_id: str = "",
    evento_id: str = "",
    tipo: str = "otros",  # 'transporte' | 'alojamiento' | 'otros'
    current_user: dict = Depends(get_current_gestor)
):
    """Sube un justificante al bucket `justificantes` y devuelve la URL pública."""
    import os
    from supabase import create_client
    if tipo not in ("transporte", "alojamiento", "otros"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    if not usuario_id or not evento_id:
        raise HTTPException(status_code=400, detail="usuario_id y evento_id son obligatorios")

    content = await archivo.read()
    ext = (archivo.filename or "").rsplit(".", 1)[-1].lower() or "bin"
    ts = int(datetime.now().timestamp())
    path = f"{evento_id}/{usuario_id}/{tipo}_{ts}.{ext}"

    admin_client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    try:
        admin_client.storage.from_('justificantes').upload(
            path, content,
            {"content-type": archivo.content_type or "application/octet-stream", "upsert": "true"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error subiendo archivo: {str(e)}")

    public_url = admin_client.storage.from_('justificantes').get_public_url(path)
    return {"url": public_url, "path": path}


@router.get("/cachets-config/{evento_id}")
async def get_cachets_config(
    evento_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Devuelve las tarifas configuradas para un evento (instrumento + nivel + importe)."""
    try:
        r = supabase.table('cachets_config') \
            .select('id,instrumento,nivel_estudios,importe') \
            .eq('evento_id', evento_id) \
            .order('instrumento', desc=False) \
            .execute()
        return {"cachets": r.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.put("/cachets-config/{evento_id}")
async def put_cachets_config(
    evento_id: str,
    rows: List[CachetRow],
    current_user: dict = Depends(get_current_gestor)
):
    """
    Sustituye (UPSERT) las tarifas de un evento.
    Todas las filas se guardan con evento_id fijo. Las (instrumento, nivel_estudios)
    duplicadas se actualizan (hay UNIQUE INDEX ux_cachets_evento_instr_nivel).
    """
    try:
        now = datetime.now().isoformat()
        written = 0
        for row in rows:
            payload = {
                "evento_id": evento_id,
                "instrumento": row.instrumento.strip(),
                "nivel_estudios": (row.nivel_estudios or '').strip() or None,
                "importe": row.importe,
                "updated_at": now,
            }
            ex = supabase.table('cachets_config').select('id') \
                .eq('evento_id', evento_id) \
                .eq('instrumento', payload['instrumento']) \
                .execute()
            # Emular UPSERT por (evento, instrumento, nivel)
            target = None
            for r in (ex.data or []):
                # no traemos nivel en select previo -> hacemos otro match
                pass
            # Mejor: trae todas las filas del evento y filtra en Python para evitar NULL matcheo raro
            all_rows = supabase.table('cachets_config').select('id,nivel_estudios,instrumento') \
                .eq('evento_id', evento_id).execute().data or []
            for r in all_rows:
                if (r.get('instrumento') or '').strip().lower() == payload['instrumento'].lower() and \
                   ((r.get('nivel_estudios') or '') == (payload['nivel_estudios'] or '')):
                    target = r['id']
                    break
            if target:
                supabase.table('cachets_config').update(payload).eq('id', target).execute()
            else:
                supabase.table('cachets_config').insert(payload).execute()
            written += 1
        return {"ok": True, "escritas": written}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar cachets: {str(e)}")


@router.delete("/eventos/{evento_id}")
async def delete_evento(
    evento_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Delete evento (CASCADE deletes asignaciones and ensayos)"""
    try:
        response = supabase.table('eventos').delete().eq('id', evento_id).execute()
        
        return {"message": "Evento eliminado"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar evento: {str(e)}"
        )

# ==================== Asignaciones ====================

@router.post("/asignaciones")
async def create_asignacion(
    data: AsignacionCreate,
    current_user: dict = Depends(get_current_gestor)
):
    """Assign musician to evento"""
    try:
        asignacion_data = {
            **data.model_dump(),
            "estado": "pendiente",
            "estado_pago": "pendiente"
        }
        
        response = supabase.table('asignaciones').insert(asignacion_data).execute()
        
        return {
            "message": "Músico asignado al evento",
            "asignacion": response.data[0] if response.data else None
        }
        
    except Exception as e:
        error_msg = str(e)
        if "duplicate" in error_msg or "unique" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este músico ya está asignado a este evento"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear asignación: {error_msg}"
        )

@router.get("/asignaciones/evento/{evento_id}")
async def get_asignaciones_evento(
    evento_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Get all asignaciones for an evento"""
    try:
        response = supabase.table('asignaciones') \
            .select('*, usuario:usuarios(*)') \
            .eq('evento_id', evento_id) \
            .execute()
        
        return {"asignaciones": response.data or []}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar asignaciones: {str(e)}"
        )

@router.delete("/asignaciones/{asignacion_id}")
async def delete_asignacion(
    asignacion_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Remove musician from evento"""
    try:
        response = supabase.table('asignaciones').delete().eq('id', asignacion_id).execute()
        
        return {"message": "Asignación eliminada"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar asignación: {str(e)}"
        )

# ==================== Ensayos ====================

@router.post("/ensayos")
async def create_ensayo(
    data: EnsayoCreate,
    current_user: dict = Depends(get_current_gestor)
):
    """Create rehearsal/performance for evento"""
    try:
        response = supabase.table('ensayos').insert(data.model_dump()).execute()
        
        return {
            "message": "Ensayo creado",
            "ensayo": response.data[0] if response.data else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear ensayo: {str(e)}"
        )

@router.delete("/ensayos/{ensayo_id}")
async def delete_ensayo(
    ensayo_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Delete ensayo"""
    try:
        response = supabase.table('ensayos').delete().eq('id', ensayo_id).execute()
        
        return {"message": "Ensayo eliminado"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar ensayo: {str(e)}"
        )

# ==================== Músicos ====================

@router.get("/musicos")
async def get_musicos(
    q: Optional[str] = None,
    instrumento: Optional[str] = None,
    estado: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor)
):
    """Get all musicians with optional filters.
    
    Query params:
    - q: search by nombre, apellidos or email (ilike)
    - instrumento: filter by instrumento
    - estado: 'activo' | 'inactivo'
    """
    try:
        query = supabase.table('usuarios').select('*').eq('rol', 'musico')
        
        if instrumento:
            query = query.eq('instrumento', instrumento)
        
        if estado:
            query = query.eq('estado', estado)
        
        if q:
            # Supabase OR filter: search on nombre, apellidos, email
            safe = q.replace(',', ' ').strip()
            query = query.or_(f"nombre.ilike.%{safe}%,apellidos.ilike.%{safe}%,email.ilike.%{safe}%")
        
        response = query.order('apellidos', desc=False).execute()
        
        return {"musicos": response.data or []}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar músicos: {str(e)}"
        )


@router.get("/musicos/{musico_id}")
async def get_musico_detalle(
    musico_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Ficha completa de un músico: perfil + historial de eventos + pagos + reclamaciones."""
    try:
        # Perfil
        u_res = supabase.table('usuarios').select('*').eq('id', musico_id).eq('rol', 'musico').single().execute()
        musico = u_res.data
        if not musico:
            raise HTTPException(status_code=404, detail="Músico no encontrado")
        
        # Historial eventos
        asigs_res = supabase.table('asignaciones') \
            .select('*, evento:eventos(id,nombre,temporada,fecha_inicio,fecha_fin,estado)') \
            .eq('usuario_id', musico_id) \
            .order('created_at', desc=True) \
            .execute()
        asignaciones = asigs_res.data or []
        
        # Totales de pago
        total_cobrado = 0.0
        total_pendiente = 0.0
        for a in asignaciones:
            try: imp = float(a.get('importe') or 0)
            except: imp = 0
            if a.get('estado_pago') == 'pagado': total_cobrado += imp
            else: total_pendiente += imp
        
        # Reclamaciones
        recl_res = supabase.table('reclamaciones') \
            .select('*, evento:eventos(nombre,temporada)') \
            .eq('usuario_id', musico_id) \
            .order('fecha_creacion', desc=True) \
            .execute()
        
        return {
            "musico": musico,
            "asignaciones": asignaciones,
            "total_cobrado": round(total_cobrado, 2),
            "total_pendiente": round(total_pendiente, 2),
            "reclamaciones": recl_res.data or []
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.delete("/musicos/{musico_id}")
async def delete_musico(
    musico_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """
    Elimina un músico:
    - Bloquea si tiene asignaciones confirmadas en eventos activos (estado='abierto'/'en_curso').
    - Si no, elimina el perfil de `usuarios` y el usuario de Supabase Auth.
    - Registra la acción en `registro_actividad`.
    """
    import os
    from supabase import create_client
    admin_client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])

    # 1) Cargar perfil
    try:
        u_res = admin_client.table('usuarios').select('id,user_id,email,nombre,apellidos,rol') \
            .eq('id', musico_id).single().execute()
        musico = u_res.data
    except Exception:
        musico = None
    if not musico:
        raise HTTPException(status_code=404, detail="Músico no encontrado")
    if musico.get('rol') != 'musico':
        raise HTTPException(status_code=400, detail="El usuario no es un músico")

    # 2) Comprobar asignaciones confirmadas en eventos activos
    try:
        confirmadas_res = admin_client.table('asignaciones') \
            .select('id, evento:eventos(id,nombre,estado)') \
            .eq('usuario_id', musico_id) \
            .eq('estado', 'confirmado') \
            .execute()
        activas = [
            a for a in (confirmadas_res.data or [])
            if (a.get('evento') or {}).get('estado') in ('abierto', 'en_curso')
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error comprobando asignaciones: {str(e)}")

    if activas:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar un músico con convocatorias confirmadas activas"
        )

    # 3) Eliminar perfil (CASCADE se lleva asignaciones, reclamaciones, etc.)
    try:
        admin_client.table('usuarios').delete().eq('id', musico_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar perfil: {str(e)}")

    # 4) Eliminar usuario en Supabase Auth (best-effort)
    auth_deleted = False
    auth_error = None
    if musico.get('user_id'):
        try:
            admin_client.auth.admin.delete_user(musico['user_id'])
            auth_deleted = True
        except Exception as e:
            auth_error = str(e)[:200]

    # 5) Registro de actividad
    try:
        gp = current_user.get('profile') or {}
        gname = f"{gp.get('nombre','')} {gp.get('apellidos','')}".strip()
        mname = f"{musico.get('nombre','')} {musico.get('apellidos','')}".strip()
        supabase.table('registro_actividad').insert({
            'tipo': 'musico_eliminado',
            'descripcion': f"{gname} eliminó al músico {mname} ({musico.get('email')})",
            'usuario_id': gp.get('id'),
            'usuario_nombre': gname,
            'entidad_tipo': 'musico',
            'entidad_id': musico_id,
            'metadata': {
                'email': musico.get('email'),
                'auth_deleted': auth_deleted,
                'auth_error': auth_error,
            }
        }).execute()
    except Exception:
        pass

    return {
        "message": "Músico eliminado correctamente",
        "auth_deleted": auth_deleted,
        "auth_error": auth_error,
    }


@router.get("/pendientes")
async def get_pendientes(current_user: dict = Depends(get_current_gestor)):
    """Contadores de pendientes para el sidebar y el dashboard del gestor."""
    try:
        # Reclamaciones pendientes
        r_res = supabase.table('reclamaciones').select('id', count='exact') \
            .in_('estado', ['pendiente', 'en_gestion']).execute()
        reclamaciones_pendientes = r_res.count or 0
        
        # Perfiles actualizados en últimas 24h (si la migración está aplicada)
        perfiles_actualizados = 0
        try:
            from datetime import timezone, timedelta
            cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
            p_res = supabase.table('usuarios').select('id', count='exact') \
                .eq('rol', 'musico') \
                .gte('ultima_actualizacion_perfil', cutoff_24h) \
                .execute()
            perfiles_actualizados = p_res.count or 0
        except Exception:
            perfiles_actualizados = 0
        
        # Respuestas nuevas desde el último acceso del gestor
        from datetime import timezone, timedelta
        gestor_profile = current_user.get('profile') or {}
        ultimo_acceso = gestor_profile.get('ultimo_acceso_gestor') or (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        a_res = supabase.table('asignaciones').select('id', count='exact') \
            .in_('estado', ['confirmado', 'rechazado']) \
            .gte('fecha_respuesta', ultimo_acceso) \
            .execute()
        respuestas_nuevas = a_res.count or 0
        
        # Tareas próximas (24h) - si existe la tabla tareas
        tareas_proximas = 0
        try:
            cutoff_24h_fw = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            t_res = supabase.table('tareas').select('id', count='exact') \
                .lte('fecha_limite', cutoff_24h_fw) \
                .neq('estado', 'completada') \
                .execute()
            tareas_proximas = t_res.count or 0
        except Exception:
            tareas_proximas = 0
        
        return {
            "reclamaciones_pendientes": reclamaciones_pendientes,
            "perfiles_actualizados": perfiles_actualizados,
            "respuestas_nuevas": respuestas_nuevas,
            "tareas_proximas": tareas_proximas,
            "ultimo_acceso_gestor": ultimo_acceso
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/marcar-acceso")
async def marcar_acceso_gestor(current_user: dict = Depends(get_current_gestor)):
    """Marca el acceso actual del gestor (para tracking de 'respuestas desde último acceso')."""
    try:
        gestor_id = (current_user.get('profile') or {}).get('id')
        if not gestor_id:
            raise HTTPException(status_code=400, detail="Perfil no encontrado")
        now = datetime.now().isoformat()
        supabase.table('usuarios').update({'ultimo_acceso_gestor': now}).eq('id', gestor_id).execute()
        return {"ultimo_acceso": now}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/instrumentos")
async def get_instrumentos_disponibles(current_user: dict = Depends(get_current_gestor)):
    """Return distinct list of instrumentos for filter dropdown"""
    try:
        response = supabase.table('usuarios') \
            .select('instrumento') \
            .eq('rol', 'musico') \
            .execute()
        
        instrumentos = sorted({u.get('instrumento') for u in (response.data or []) if u.get('instrumento')})
        return {"instrumentos": instrumentos}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar instrumentos: {str(e)}"
        )

def _generate_temp_password(length: int = 12) -> str:
    """Generate a secure temp password: letters + digits (meets 8+ upper + digit rule)."""
    alphabet = string.ascii_letters + string.digits
    while True:
        pwd = ''.join(secrets.choice(alphabet) for _ in range(length))
        if any(c.isupper() for c in pwd) and any(c.isdigit() for c in pwd) and any(c.islower() for c in pwd):
            return pwd


# ==================== Importación masiva de músicos ====================

# Columnas aceptadas en la plantilla (orden visible en el Excel).
IMPORT_MUSICOS_HEADERS = [
    "nombre", "apellidos", "email", "telefono", "instrumento",
    "especialidad", "dni", "direccion", "fecha_nacimiento",
    "nacionalidad", "bio"
]


@router.get("/musicos-import/plantilla")
async def descargar_plantilla_musicos(current_user: dict = Depends(get_current_gestor)):
    """Genera y descarga un Excel con sólo las cabeceras de importación."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Músicos"
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")
    for idx, name in enumerate(IMPORT_MUSICOS_HEADERS, start=1):
        cell = ws.cell(row=1, column=idx, value=name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        ws.column_dimensions[cell.column_letter].width = max(14, len(name) + 4)
    # Fila de ejemplo (comentada con color) para guiar al usuario
    ejemplo = ["Ana", "García", "ana@ejemplo.com", "+34600111222", "Violín",
               "Música clásica", "12345678A", "Calle Mayor 1, Madrid",
               "1990-05-12", "Española", "Breve biografía opcional"]
    for idx, value in enumerate(ejemplo, start=1):
        c = ws.cell(row=2, column=idx, value=value)
        c.font = Font(color="94A3B8", italic=True)
    ws.row_dimensions[2].height = 18

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="plantilla_musicos.xlsx"'}
    )


def _parse_musicos_file(raw: bytes, filename: str) -> List[dict]:
    """Lee un fichero xlsx o csv y devuelve una lista de dicts normalizados."""
    name = (filename or "").lower()
    rows: List[dict] = []
    if name.endswith(".csv"):
        text = raw.decode("utf-8-sig", errors="replace")
        # Detectar delimitador (coma o punto y coma)
        sample = text[:4096]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except Exception:
            dialect = csv.excel
        reader = csv.DictReader(StringIO(text), dialect=dialect)
        for r in reader:
            rows.append({(k or "").strip().lower(): (v.strip() if isinstance(v, str) else v)
                         for k, v in r.items() if k})
    else:
        wb = load_workbook(BytesIO(raw), read_only=True, data_only=True)
        ws = wb.active
        headers: List[str] = []
        for row_idx, row in enumerate(ws.iter_rows(values_only=True)):
            if row_idx == 0:
                headers = [str(c).strip().lower() if c is not None else "" for c in row]
                continue
            if not any(cell not in (None, "") for cell in row):
                continue
            d = {}
            for h, v in zip(headers, row):
                if not h:
                    continue
                if isinstance(v, datetime):
                    v = v.date().isoformat()
                d[h] = (str(v).strip() if v is not None else "")
            rows.append(d)
    # Quitar filas completamente vacías o sin email
    return [r for r in rows if any(v for v in r.values())]


@router.post("/musicos-import/preview")
async def importar_musicos_preview(
    archivo: UploadFile = File(...),
    current_user: dict = Depends(get_current_gestor)
):
    """Preview: devuelve los primeros 5 registros + total + errores de validación."""
    content = await archivo.read()
    try:
        rows = _parse_musicos_file(content, archivo.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo: {str(e)}")

    missing_headers = [h for h in ("nombre", "apellidos", "email") if h not in (rows[0].keys() if rows else [])]
    return {
        "total_filas": len(rows),
        "preview": rows[:5],
        "missing_required_headers": missing_headers,
        "columnas_plantilla": IMPORT_MUSICOS_HEADERS,
    }


@router.post("/musicos-import")
async def importar_musicos(
    archivo: UploadFile = File(...),
    current_user: dict = Depends(get_current_gestor)
):
    """
    Importa masivamente músicos desde Excel/CSV.
    Para cada fila:
      - Crea usuario en Supabase Auth con password temporal aleatorio (8 chars).
      - Crea el perfil en tabla `usuarios` con requiere_cambio_password=True.
      - Si el email ya existe, lo marca como "ya_existente" y continúa.
      - Cualquier otro error se reporta en el informe final.
    """
    import os
    from supabase import create_client

    content = await archivo.read()
    try:
        rows = _parse_musicos_file(content, archivo.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo: {str(e)}")

    admin_client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])

    creados: List[dict] = []
    existentes: List[dict] = []
    errores: List[dict] = []

    for idx, row in enumerate(rows, start=2):  # start=2 porque fila 1 es header
        email = (row.get("email") or "").strip().lower()
        nombre = (row.get("nombre") or "").strip()
        apellidos = (row.get("apellidos") or "").strip()
        if not email or not nombre or not apellidos:
            errores.append({"fila": idx, "email": email, "motivo": "Faltan campos obligatorios (nombre, apellidos, email)"})
            continue

        # Saltar si ya existe en tabla usuarios
        try:
            existente = admin_client.table('usuarios').select('id,email').eq('email', email).limit(1).execute()
            if existente.data:
                existentes.append({"fila": idx, "email": email})
                continue
        except Exception:
            pass

        # Crear en Auth
        temp_password = _generate_temp_password(8)
        created_user_id = None
        try:
            auth_resp = admin_client.auth.admin.create_user({
                "email": email,
                "password": temp_password,
                "email_confirm": True,
                "app_metadata": {"rol": "musico"}
            })
            created_user = auth_resp.user if hasattr(auth_resp, 'user') else None
            if not created_user:
                errores.append({"fila": idx, "email": email, "motivo": "No se pudo crear el usuario en Auth"})
                continue
            created_user_id = created_user.id
        except Exception as e:
            msg = str(e).lower()
            if "already" in msg or "exists" in msg or "duplicate" in msg or "registered" in msg:
                existentes.append({"fila": idx, "email": email})
            else:
                errores.append({"fila": idx, "email": email, "motivo": f"Auth: {str(e)[:150]}"})
            continue

        # Perfil en usuarios
        profile_payload = {
            "user_id": created_user_id,
            "email": email,
            "nombre": nombre,
            "apellidos": apellidos,
            "telefono": row.get("telefono") or None,
            "instrumento": row.get("instrumento") or None,
            "especialidad": row.get("especialidad") or None,
            "dni": row.get("dni") or None,
            "direccion": row.get("direccion") or None,
            "fecha_nacimiento": row.get("fecha_nacimiento") or None,
            "nacionalidad": row.get("nacionalidad") or None,
            "bio": row.get("bio") or None,
            "rol": "musico",
            "estado": "activo",
            "requiere_cambio_password": True,
        }
        profile_payload = {k: v for k, v in profile_payload.items() if v not in (None, "")}
        try:
            ins = admin_client.table('usuarios').insert(profile_payload).execute()
            profile = ins.data[0] if ins.data else None
        except Exception as e:
            try:
                admin_client.auth.admin.delete_user(created_user_id)
            except Exception:
                pass
            errores.append({"fila": idx, "email": email, "motivo": f"Perfil: {str(e)[:150]}"})
            continue

        creados.append({"fila": idx, "email": email, "id": profile.get("id") if profile else None})

    # Registro de actividad
    try:
        gp = current_user.get('profile') or {}
        gname = f"{gp.get('nombre','')} {gp.get('apellidos','')}".strip()
        supabase.table('registro_actividad').insert({
            'tipo': 'importacion_musicos',
            'descripcion': f"{gname} importó {len(creados)} músicos (existentes: {len(existentes)}, errores: {len(errores)})",
            'usuario_id': gp.get('id'),
            'usuario_nombre': gname,
            'entidad_tipo': 'musico',
            'metadata': {'creados': len(creados), 'existentes': len(existentes), 'errores': len(errores)}
        }).execute()
    except Exception:
        pass

    return {
        "creados": creados,
        "existentes": existentes,
        "errores": errores,
        "resumen": {
            "total_procesadas": len(rows),
            "creados": len(creados),
            "ya_existentes": len(existentes),
            "errores": len(errores),
        }
    }


@router.post("/musicos/crear")
async def crear_musico(
    data: MusicoCreate,
    current_user: dict = Depends(get_current_gestor)
):
    """
    Crea un nuevo músico:
    - Genera contraseña temporal
    - Crea usuario en Supabase Auth (email + password, confirmado)
    - Asigna rol 'musico' en app_metadata
    - Crea perfil en tabla usuarios con requiere_cambio_password=True
    - Envía email con credenciales vía Resend (si está configurado)
    """
    import os
    from supabase import create_client
    # Fresh admin client to avoid any session interference from auth verification flow
    admin_client = create_client(
        os.environ['SUPABASE_URL'],
        os.environ['SUPABASE_KEY']  # service role
    )

    temp_password = _generate_temp_password(12)
    email_str = data.email
    created_user_id = None

    try:
        # 1. Crear usuario en Supabase Auth (email confirmed)
        try:
            auth_resp = admin_client.auth.admin.create_user({
                "email": email_str,
                "password": temp_password,
                "email_confirm": True,
                "app_metadata": {"rol": "musico"}
            })
            created_user = auth_resp.user if hasattr(auth_resp, 'user') else None
            if not created_user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo crear el usuario en Supabase Auth"
                )
            created_user_id = created_user.id
        except HTTPException:
            raise
        except Exception as e:
            msg = str(e).lower()
            if "already" in msg or "exists" in msg or "duplicate" in msg or "registered" in msg:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Este email ya está registrado"
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear usuario: {str(e)}"
            )

        # 2. Crear perfil en tabla usuarios
        profile_payload = {
            "user_id": created_user_id,
            "email": email_str,
            "nombre": data.nombre,
            "apellidos": data.apellidos,
            "instrumento": data.instrumento,
            "telefono": data.telefono,
            "rol": "musico",
            "estado": "activo",
            "requiere_cambio_password": True
        }
        profile_payload = {k: v for k, v in profile_payload.items() if v is not None}

        try:
            insert_res = admin_client.table('usuarios').insert(profile_payload).execute()
            profile = insert_res.data[0] if insert_res.data else None
        except Exception as e:
            try:
                admin_client.auth.admin.delete_user(created_user_id)
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear perfil: {str(e)}"
            )

        # 3. Enviar email con credenciales (no bloqueante de errores)
        email_result = await send_musico_credentials_email(
            to_email=email_str,
            nombre=data.nombre,
            password_temporal=temp_password,
            usuario_id=created_user_id
        )

        # Registro de actividad
        try:
            gp = current_user.get('profile') or {}
            gname = f"{gp.get('nombre','')} {gp.get('apellidos','')}".strip()
            supabase.table('registro_actividad').insert({
                'tipo': 'musico_creado',
                'descripcion': f"{gname} creó al músico {data.nombre} {data.apellidos}",
                'usuario_id': gp.get('id'),
                'usuario_nombre': gname,
                'entidad_tipo': 'musico',
                'entidad_id': profile['id'] if profile else None
            }).execute()
        except Exception:
            pass

        return {
            "message": "Músico creado correctamente" + (
                " y email de credenciales enviado" if email_result.get("sent") else ". Email NO enviado (configurar RESEND_API_KEY)"
            ),
            "musico": profile,
            "password_temporal": temp_password,
            "email_enviado": email_result.get("sent", False),
            "email_error": email_result.get("reason") if not email_result.get("sent") else None
        }

    except HTTPException:
        raise
    except Exception as e:
        if created_user_id:
            try:
                admin_client.auth.admin.delete_user(created_user_id)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear músico: {str(e)}"
        )


@router.post("/musicos/invite")
async def invite_musico(
    data: MusicoCreate,
    current_user: dict = Depends(get_current_gestor)
):
    """
    (Legacy) Invite musician - sends magic link for first login.
    Creates profile without auth account (created on first magic link login).
    """
    try:
        # Send magic link invitation
        supabase.auth.sign_in_with_otp({
            "email": data.email,
            "options": {
                "email_redirect_to": f"/portal"
            }
        })
        
        # Create profile (user_id will be null until they log in)
        profile_data = {
            **data.model_dump(),
            "rol": "musico",
            "estado": "activo",
            "user_id": None  # Will be linked on first login
        }
        
        response = supabase.table('usuarios').insert(profile_data).execute()
        
        return {
            "message": f"Invitación enviada a {data.email}",
            "musico": response.data[0] if response.data else None
        }
        
    except Exception as e:
        error_msg = str(e)
        if "duplicate" in error_msg or "unique" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este email ya está registrado"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al invitar músico: {error_msg}"
        )


# ==================== Export Excel ====================

@router.get("/export/xlsx")
async def export_excel(current_user: dict = Depends(get_current_gestor)):
    """
    Export Usuarios, Eventos y Asignaciones en un fichero .xlsx con 3 hojas.
    """
    try:
        usuarios_res = supabase.table('usuarios').select('*').order('apellidos', desc=False).execute()
        eventos_res = supabase.table('eventos').select('*').order('created_at', desc=True).execute()
        asignaciones_res = supabase.table('asignaciones') \
            .select('*, usuario:usuarios(nombre,apellidos,email,instrumento), evento:eventos(nombre,temporada)') \
            .execute()

        wb = Workbook()

        header_font = Font(bold=True, color="FFFFFF", size=11)
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_align = Alignment(horizontal="center", vertical="center")

        def write_sheet(ws, headers, rows):
            for col_idx, h in enumerate(headers, start=1):
                cell = ws.cell(row=1, column=col_idx, value=h)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = header_align
            for r_idx, row in enumerate(rows, start=2):
                for c_idx, value in enumerate(row, start=1):
                    ws.cell(row=r_idx, column=c_idx, value=value)
            # Auto width (aprox)
            for col_idx, h in enumerate(headers, start=1):
                max_len = len(str(h))
                for row in rows:
                    val = row[col_idx - 1] if col_idx - 1 < len(row) else ""
                    max_len = max(max_len, len(str(val)) if val is not None else 0)
                ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = min(max_len + 2, 40)

        # Hoja 1: Usuarios
        ws_u = wb.active
        ws_u.title = "Usuarios"
        u_headers = ["Nombre", "Apellidos", "Email", "Rol", "Instrumento", "Teléfono", "Estado", "Fecha Alta"]
        u_rows = []
        for u in (usuarios_res.data or []):
            u_rows.append([
                u.get('nombre', ''),
                u.get('apellidos', ''),
                u.get('email', ''),
                u.get('rol', ''),
                u.get('instrumento', '') or '',
                u.get('telefono', '') or '',
                u.get('estado', ''),
                u.get('fecha_alta', '') or u.get('created_at', '') or ''
            ])
        write_sheet(ws_u, u_headers, u_rows)

        # Hoja 2: Eventos
        ws_e = wb.create_sheet("Eventos")
        e_headers = ["Nombre", "Temporada", "Tipo", "Estado", "Fecha Inicio", "Fecha Fin", "Lugar", "Descripción"]
        e_rows = []
        for e in (eventos_res.data or []):
            e_rows.append([
                e.get('nombre', ''),
                e.get('temporada', '') or '',
                e.get('tipo', '') or '',
                e.get('estado', '') or '',
                e.get('fecha_inicio', '') or '',
                e.get('fecha_fin', '') or '',
                e.get('lugar', '') or '',
                e.get('descripcion', '') or ''
            ])
        write_sheet(ws_e, e_headers, e_rows)

        # Hoja 3: Asignaciones
        ws_a = wb.create_sheet("Asignaciones")
        a_headers = ["Evento", "Temporada", "Músico", "Email", "Instrumento", "Estado", "Estado Pago", "Importe"]
        a_rows = []
        for a in (asignaciones_res.data or []):
            ev = a.get('evento') or {}
            us = a.get('usuario') or {}
            nombre_completo = f"{us.get('nombre', '')} {us.get('apellidos', '')}".strip()
            a_rows.append([
                ev.get('nombre', ''),
                ev.get('temporada', '') or '',
                nombre_completo,
                us.get('email', '') or '',
                us.get('instrumento', '') or '',
                a.get('estado', '') or '',
                a.get('estado_pago', '') or '',
                a.get('importe', 0) or 0
            ])
        write_sheet(ws_a, a_headers, a_rows)

        # Guardar en memoria
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)

        filename = f"opus_manager_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al exportar Excel: {str(e)}"
        )


# ==================== RECORDATORIOS (Bloque 3) ====================

# Catálogo de los 10 recordatorios predefinidos
RECORDATORIOS_PREDEFINIDOS = [
    {"tipo": "nueva_asignacion", "nombre": "Nueva asignación", "descripcion": "Email al músico al ser asignado a un evento", "destinatario_default": "musico", "dias_default": None},
    {"tipo": "respuesta_7d", "nombre": "Recordatorio respuesta 7 días antes del límite", "descripcion": "Solo a músicos sin responder", "destinatario_default": "musico", "dias_default": 7},
    {"tipo": "respuesta_3d", "nombre": "Recordatorio respuesta 3 días antes", "descripcion": "Solo a músicos sin responder", "destinatario_default": "musico", "dias_default": 3},
    {"tipo": "respuesta_24h", "nombre": "Último aviso 24h", "descripcion": "Solo a músicos sin responder", "destinatario_default": "musico", "dias_default": 1},
    {"tipo": "aviso_ensayo_24h", "nombre": "Aviso ensayo 24h antes", "descripcion": "Solo a músicos confirmados", "destinatario_default": "musico", "dias_default": 1},
    {"tipo": "aviso_funcion_48h", "nombre": "Aviso función 48h antes", "descripcion": "Solo a músicos confirmados", "destinatario_default": "musico", "dias_default": 2},
    {"tipo": "alerta_baja_respuesta", "nombre": "Alerta baja respuesta <50% a 5 días", "descripcion": "Aviso al gestor si menos del 50% ha respondido", "destinatario_default": "gestor", "dias_default": 5},
    {"tipo": "pago_pendiente_3d", "nombre": "Recordatorio pago pendiente 3 días antes", "descripcion": "Aviso al gestor para pagos pendientes", "destinatario_default": "gestor", "dias_default": 3},
    {"tipo": "confirmacion_cobro", "nombre": "Confirmación de cobro al pagar", "descripcion": "Email al músico al marcarse como pagado", "destinatario_default": "musico", "dias_default": None},
    {"tipo": "resumen_diario", "nombre": "Resumen diario 8:00 con eventos activos", "descripcion": "Resumen diario para el gestor", "destinatario_default": "gestor", "dias_default": None},
]


class RecordatorioConfigPayload(BaseModel):
    tipo: str
    activo: Optional[bool] = None
    dias_antes: Optional[int] = None
    mensaje_personalizado: Optional[str] = None
    destinatario: Optional[str] = None


@router.get("/eventos/{evento_id}/recordatorios")
async def get_recordatorios(evento_id: str, current_user: dict = Depends(get_current_gestor)):
    """Devuelve la lista de 10 recordatorios con su config actual (o defaults)."""
    try:
        cfgs_res = supabase.table('recordatorios_config') \
            .select('*') \
            .eq('evento_id', evento_id) \
            .execute()
        cfgs_by_tipo = {c['tipo']: c for c in (cfgs_res.data or [])}

        resultado = []
        for predef in RECORDATORIOS_PREDEFINIDOS:
            cfg = cfgs_by_tipo.get(predef['tipo'], {})
            resultado.append({
                **predef,
                "activo": cfg.get('activo', False),
                "dias_antes": cfg.get('dias_antes', predef['dias_default']),
                "mensaje_personalizado": cfg.get('mensaje_personalizado', ''),
                "destinatario": cfg.get('destinatario', predef['destinatario_default']),
                "config_id": cfg.get('id')
            })
        return {"recordatorios": resultado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.put("/eventos/{evento_id}/recordatorios")
async def upsert_recordatorio(
    evento_id: str,
    payload: RecordatorioConfigPayload,
    current_user: dict = Depends(get_current_gestor)
):
    """Activa/desactiva/edita un recordatorio (upsert por tipo+evento)."""
    try:
        data = payload.model_dump(exclude_none=True)
        data['evento_id'] = evento_id
        data['updated_at'] = datetime.utcnow().isoformat()

        # Upsert: intento update, si no existe inserto
        existing = supabase.table('recordatorios_config') \
            .select('id') \
            .eq('evento_id', evento_id) \
            .eq('tipo', payload.tipo) \
            .execute()
        if existing.data:
            supabase.table('recordatorios_config') \
                .update(data) \
                .eq('id', existing.data[0]['id']) \
                .execute()
        else:
            supabase.table('recordatorios_config').insert(data).execute()
        return {"message": "Recordatorio actualizado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ==================== EMAIL LOG ====================

@router.get("/emails/log")
async def get_email_log(
    limit: int = 200,
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    evento_id: Optional[str] = None,
    desde: Optional[str] = None,  # 'YYYY-MM-DD'
    hasta: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor)
):
    """Historial de emails enviados con filtros y contadores."""
    try:
        query = supabase.table('email_log').select('*')
        if tipo:
            query = query.eq('tipo', tipo)
        if estado:
            query = query.eq('estado', estado)
        if evento_id:
            query = query.eq('evento_id', evento_id)
        if desde:
            query = query.gte('created_at', f"{desde}T00:00:00")
        if hasta:
            query = query.lte('created_at', f"{hasta}T23:59:59")
        res = query.order('created_at', desc=True).limit(min(limit, 500)).execute()
        emails = res.data or []

        # Enrichment: get destinatario nombre de tabla usuarios
        dest_emails = list({e['destinatario'] for e in emails if e.get('destinatario')})
        dest_info = {}
        if dest_emails:
            try:
                u_res = supabase.table('usuarios').select('email,nombre,apellidos') \
                    .in_('email', dest_emails).execute()
                dest_info = {u['email']: f"{u.get('nombre','')} {u.get('apellidos','')}".strip() for u in (u_res.data or [])}
            except Exception:
                dest_info = {}
        for e in emails:
            e['destinatario_nombre'] = dest_info.get(e.get('destinatario'), '')

        # Contadores del día actual
        from datetime import timezone, timedelta
        now = datetime.now(timezone.utc)
        hoy_inicio = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        mes_inicio = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        total_hoy = supabase.table('email_log').select('id', count='exact') \
            .gte('created_at', hoy_inicio).eq('estado', 'enviado').execute().count or 0
        total_error_hoy = supabase.table('email_log').select('id', count='exact') \
            .gte('created_at', hoy_inicio).eq('estado', 'error').execute().count or 0
        total_mes = supabase.table('email_log').select('id', count='exact') \
            .gte('created_at', mes_inicio).eq('estado', 'enviado').execute().count or 0

        return {
            "emails": emails,
            "contadores": {
                "enviados_hoy": total_hoy,
                "errores_hoy": total_error_hoy,
                "enviados_mes": total_mes
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/emails/status")
async def get_resend_status(current_user: dict = Depends(get_current_gestor)):
    """Estado de conexión con Resend."""
    from email_service import _get_api_key, _get_sender
    api_key = _get_api_key()
    if not api_key:
        return {
            "conectado": False,
            "sender": _get_sender(),
            "mensaje": "RESEND_API_KEY no configurada",
            "enviados_mes": 0
        }
    try:
        # Validamos la key intentando listar domains. Si Resend responde
        # con un error de "restricted" significa que la key es válida pero
        # sólo permite enviar emails (sending key). Ese caso lo consideramos OK.
        import resend
        resend.api_key = api_key
        import asyncio
        try:
            await asyncio.to_thread(resend.Domains.list)
        except Exception as inner:
            msg = str(inner).lower()
            if 'restricted' not in msg and 'insufficient' not in msg:
                raise
        
        # Contar emails del mes
        from datetime import timezone
        now = datetime.now(timezone.utc)
        mes_inicio = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        c = supabase.table('email_log').select('id', count='exact') \
            .gte('created_at', mes_inicio).eq('estado', 'enviado').execute().count or 0
        
        return {
            "conectado": True,
            "sender": _get_sender(),
            "mensaje": "Conexión establecida con Resend",
            "enviados_mes": c
        }
    except Exception as e:
        return {
            "conectado": False,
            "sender": _get_sender(),
            "mensaje": f"Error: {str(e)[:200]}",
            "enviados_mes": 0
        }


class EmailTestRequest(BaseModel):
    destinatario: EmailStr
    tipo: str = "prueba"  # 'prueba' | 'nueva_convocatoria' | 'recordatorio' | ...
    asunto: Optional[str] = None
    html: Optional[str] = None


EMAIL_TEST_TEMPLATES = {
    "prueba": {
        "asunto": "OPUS MANAGER — Email de prueba",
        "html": "<h2>✅ Email de prueba</h2><p>Si recibes este correo, Resend está correctamente configurado.</p><p>— OPUS MANAGER</p>"
    },
    "nueva_convocatoria": {
        "asunto": "[Prueba] Nueva convocatoria",
        "html": "<h2>🎼 Nueva convocatoria</h2><p>Has sido asignado a un nuevo evento. Accede al portal para confirmar tu asistencia.</p><p>— OPUS MANAGER</p>"
    },
    "recordatorio": {
        "asunto": "[Prueba] Recordatorio de respuesta",
        "html": "<h2>⏰ Recordatorio</h2><p>Aún no has respondido a la convocatoria. Por favor, confirma tu asistencia lo antes posible.</p>"
    },
    "aviso_ensayo": {
        "asunto": "[Prueba] Aviso de ensayo",
        "html": "<h2>🎵 Recordatorio de ensayo</h2><p>Tu próximo ensayo es mañana. Consulta hora y lugar en el portal.</p>"
    },
    "confirmacion_cobro": {
        "asunto": "[Prueba] Confirmación de pago",
        "html": "<h2>💰 Pago procesado</h2><p>Hemos procesado tu pago correctamente. Consulta el detalle en tu historial.</p>"
    }
}


@router.get("/emails/preview")
async def email_preview(tipo: str = "prueba", current_user: dict = Depends(get_current_gestor)):
    """Devuelve la previsualización del email según tipo."""
    tmpl = EMAIL_TEST_TEMPLATES.get(tipo, EMAIL_TEST_TEMPLATES["prueba"])
    return {"asunto": tmpl["asunto"], "html": tmpl["html"]}


@router.post("/emails/test")
async def email_test_send(
    payload: EmailTestRequest,
    current_user: dict = Depends(get_current_gestor)
):
    """Envía un email de prueba."""
    from email_service import _send_email
    tmpl = EMAIL_TEST_TEMPLATES.get(payload.tipo, EMAIL_TEST_TEMPLATES["prueba"])
    asunto = payload.asunto or tmpl["asunto"]
    html = payload.html or tmpl["html"]
    gestor_profile = current_user.get('profile') or {}
    r = await _send_email(
        to_email=payload.destinatario,
        subject=asunto,
        html=html,
        tipo=f"test_{payload.tipo}",
        usuario_id=gestor_profile.get('id')
    )
    return r


class ReenviarEmailRequest(BaseModel):
    email_log_id: str


@router.post("/emails/reenviar")
async def reenviar_email(
    payload: ReenviarEmailRequest,
    current_user: dict = Depends(get_current_gestor)
):
    """Reenvía un email a partir de un log entry."""
    from email_service import _send_email
    try:
        res = supabase.table('email_log').select('*').eq('id', payload.email_log_id).single().execute()
        item = res.data
        if not item:
            raise HTTPException(status_code=404, detail="Email no encontrado")
        # Cuerpo simple si no tenemos el HTML original
        html = f"<p>Reenvío del email: {item.get('asunto')}</p>"
        r = await _send_email(
            to_email=item['destinatario'],
            subject=f"[Reenvío] {item.get('asunto','')}",
            html=html,
            tipo=f"reenvio_{item.get('tipo','')}",
            usuario_id=item.get('usuario_id'),
            evento_id=item.get('evento_id')
        )
        return r
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ==================== RECLAMACIONES (Gestor) ====================

@router.get("/reclamaciones")
async def get_reclamaciones_gestor(current_user: dict = Depends(get_current_gestor)):
    """Todas las reclamaciones para el panel del gestor."""
    try:
        res = supabase.table('reclamaciones') \
            .select('*, usuario:usuarios(nombre,apellidos,email), evento:eventos(nombre,temporada)') \
            .order('fecha_creacion', desc=True) \
            .execute()
        return {"reclamaciones": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


class ReclamacionUpdatePayload(BaseModel):
    estado: Optional[str] = None
    respuesta_gestor: Optional[str] = None


@router.put("/reclamaciones/{reclamacion_id}")
async def update_reclamacion(
    reclamacion_id: str,
    payload: ReclamacionUpdatePayload,
    current_user: dict = Depends(get_current_gestor)
):
    """El gestor actualiza el estado/respuesta de una reclamación."""
    try:
        gestor_profile = current_user.get('profile') or {}
        data = payload.model_dump(exclude_none=True)
        # Trazabilidad: quién gestiona la reclamación
        data['gestor_id'] = gestor_profile.get('id')
        data['gestor_nombre'] = f"{gestor_profile.get('nombre','')} {gestor_profile.get('apellidos','')}".strip()
        if data.get('estado') in ('resuelta', 'rechazada'):
            data['fecha_resolucion'] = datetime.utcnow().isoformat()
        res = supabase.table('reclamaciones').update(data).eq('id', reclamacion_id).execute()
        
        # Registro de actividad
        try:
            supabase.table('registro_actividad').insert({
                'tipo': f"reclamacion_{data.get('estado','actualizada')}",
                'descripcion': f"Reclamación {data.get('estado') or 'actualizada'} por {data['gestor_nombre']}",
                'usuario_id': gestor_profile.get('id'),
                'usuario_nombre': data['gestor_nombre'],
                'entidad_tipo': 'reclamacion',
                'entidad_id': reclamacion_id
            }).execute()
        except Exception:
            pass
        
        return {"message": "Reclamación actualizada", "reclamacion": res.data[0] if res.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ==================== COMENTARIOS INTERNOS ====================

class ComentarioPayload(BaseModel):
    tipo: str  # 'reclamacion' | 'evento'
    entidad_id: str
    contenido: str


@router.get("/comentarios")
async def get_comentarios(
    tipo: str,
    entidad_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Lista comentarios internos de una entidad."""
    try:
        res = supabase.table('comentarios_internos') \
            .select('*') \
            .eq('tipo', tipo) \
            .eq('entidad_id', entidad_id) \
            .order('created_at', desc=True) \
            .execute()
        return {"comentarios": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/comentarios")
async def crear_comentario(
    payload: ComentarioPayload,
    current_user: dict = Depends(get_current_gestor)
):
    """Crea un comentario interno entre gestores."""
    try:
        gestor_profile = current_user.get('profile') or {}
        nombre = f"{gestor_profile.get('nombre','')} {gestor_profile.get('apellidos','')}".strip() or gestor_profile.get('email')
        data = {
            "tipo": payload.tipo,
            "entidad_id": payload.entidad_id,
            "gestor_id": gestor_profile.get('id'),
            "gestor_nombre": nombre,
            "contenido": payload.contenido
        }
        res = supabase.table('comentarios_internos').insert(data).execute()
        
        # Notificar a otros gestores si hay menciones @
        import re
        menciones = re.findall(r'@([\w]+)', payload.contenido)
        if menciones:
            try:
                gs = supabase.table('usuarios').select('id,nombre,apellidos') \
                    .eq('rol', 'gestor').execute().data or []
                for g in gs:
                    if g['id'] == gestor_profile.get('id'):
                        continue
                    full = f"{g.get('nombre','')}{g.get('apellidos','')}".lower()
                    if any(m.lower() in full for m in menciones):
                        supabase.table('notificaciones_gestor').insert({
                            "gestor_id": g['id'],
                            "tipo": "mencion_comentario",
                            "titulo": f"{nombre} te ha mencionado",
                            "descripcion": payload.contenido[:200],
                            "entidad_tipo": "comentario",
                            "entidad_id": res.data[0]['id']
                        }).execute()
            except Exception:
                pass
        
        return {"comentario": res.data[0] if res.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ==================== NOTIFICACIONES ====================

@router.get("/notificaciones")
async def get_notificaciones(
    limit: int = 50,
    current_user: dict = Depends(get_current_gestor)
):
    """Lista notificaciones del gestor actual."""
    try:
        gestor_profile = current_user.get('profile') or {}
        gestor_id = gestor_profile.get('id')
        res = supabase.table('notificaciones_gestor') \
            .select('*') \
            .eq('gestor_id', gestor_id) \
            .order('created_at', desc=True) \
            .limit(min(limit, 100)) \
            .execute()
        items = res.data or []
        no_leidas = supabase.table('notificaciones_gestor').select('id', count='exact') \
            .eq('gestor_id', gestor_id).eq('leida', False).execute().count or 0
        return {"notificaciones": items, "no_leidas": no_leidas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.put("/notificaciones/{notif_id}/leer")
async def marcar_leida(notif_id: str, current_user: dict = Depends(get_current_gestor)):
    gestor_id = (current_user.get('profile') or {}).get('id')
    supabase.table('notificaciones_gestor').update({"leida": True}) \
        .eq('id', notif_id).eq('gestor_id', gestor_id).execute()
    return {"message": "Leída"}


@router.post("/notificaciones/leer-todas")
async def marcar_todas_leidas(current_user: dict = Depends(get_current_gestor)):
    gestor_id = (current_user.get('profile') or {}).get('id')
    supabase.table('notificaciones_gestor').update({"leida": True}) \
        .eq('gestor_id', gestor_id).eq('leida', False).execute()
    return {"message": "Todas marcadas como leídas"}


# ==================== REGISTRO DE ACTIVIDAD ====================

@router.get("/actividad")
async def get_actividad(
    limit: int = 100,
    current_user: dict = Depends(get_current_gestor)
):
    """Registro de actividad global."""
    try:
        res = supabase.table('registro_actividad') \
            .select('*') \
            .order('created_at', desc=True) \
            .limit(min(limit, 500)) \
            .execute()
        return {"actividad": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
