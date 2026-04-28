"""Montaje del Evento + Transporte de Material + Espacios — API."""
import math
from typing import List, Optional, Literal, Dict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api/gestor", tags=["montaje"])


# ============================================================
# Modelos
# ============================================================
class MontajeItem(BaseModel):
    id: Optional[str] = None
    material_id: Optional[str] = None
    nombre_material: Optional[str] = None
    cantidad_necesaria: int = 1
    cantidad_confirmada: Optional[int] = 0
    origen: Literal['propio','alquiler','prestamo','externo'] = 'propio'
    seccion_escenario: Optional[str] = None
    posicion_escenario: Optional[str] = None
    confirmado: bool = False
    notas: Optional[str] = None
    ensayo_id: Optional[str] = None


class MontajePut(BaseModel):
    items: List[MontajeItem] = []
    eliminar_ids: List[str] = []
    ensayo_id: Optional[str] = None  # filtro a actualizar (None = todo el evento)


class TransporteMaterialIn(BaseModel):
    empresa: Optional[str] = None
    contacto_empresa: Optional[str] = None
    telefono_empresa: Optional[str] = None
    fecha_carga: Optional[str] = None
    hora_carga: Optional[str] = None
    direccion_carga: Optional[str] = None
    fecha_descarga: Optional[str] = None
    hora_descarga: Optional[str] = None
    direccion_descarga: Optional[str] = None
    fecha_devolucion: Optional[str] = None
    hora_devolucion: Optional[str] = None
    parada_1_direccion: Optional[str] = None
    parada_1_hora: Optional[str] = None
    parada_2_direccion: Optional[str] = None
    parada_2_hora: Optional[str] = None
    parada_3_direccion: Optional[str] = None
    parada_3_hora: Optional[str] = None
    presupuesto_euros: Optional[float] = None
    estado: Optional[Literal['pendiente','confirmado','cancelado']] = 'pendiente'
    notas: Optional[str] = None


# ============================================================
# Espacios
# ============================================================
@router.get("/espacios")
async def listar_espacios(current_user: dict = Depends(get_current_gestor)):
    res = supabase.table('espacios').select('*').eq('activo', True).order('tipo').order('nombre').execute()
    return {"espacios": res.data or []}


# ============================================================
# Montaje del Evento
# ============================================================
def _instrumento_seccion(instr: str) -> str:
    if not instr: return 'otro'
    s = instr.lower()
    if any(x in s for x in ['violín','violin','viola','violonchelo','cello','contrabajo','contrabaj']):
        return 'cuerda'
    if any(x in s for x in ['flauta','oboe','clarinete','fagot','corno']):
        return 'viento_madera'
    if any(x in s for x in ['trompa','trompeta','trombón','trombon','tuba']):
        return 'viento_metal'
    if 'percu' in s or 'timbal' in s or 'batería' in s or 'bateria' in s:
        return 'percusion'
    if 'piano' in s or 'arpa' in s or 'celesta' in s or 'órgano' in s or 'organo' in s:
        return 'teclado'
    if 'coro' in s or 'soprano' in s or 'tenor' in s or 'bajo' in s or 'contralto' in s or 'mezzo' in s:
        return 'coro'
    return 'otro'


@router.get("/montaje/{evento_id}")
async def get_montaje(evento_id: str, current_user: dict = Depends(get_current_gestor)):
    items = supabase.table('evento_montaje') \
        .select('*, material:inventario_material(id,codigo,nombre,grupo,cantidad_total)') \
        .eq('evento_id', evento_id).is_('ensayo_id', 'null') \
        .order('seccion_escenario').execute().data or []
    return {"items": items}


@router.get("/montaje/{evento_id}/ensayo/{ensayo_id}")
async def get_montaje_ensayo(evento_id: str, ensayo_id: str, current_user: dict = Depends(get_current_gestor)):
    items = supabase.table('evento_montaje') \
        .select('*, material:inventario_material(id,codigo,nombre,grupo,cantidad_total)') \
        .eq('evento_id', evento_id).eq('ensayo_id', ensayo_id) \
        .order('seccion_escenario').execute().data or []
    return {"items": items}


def _buscar_material(grupo: str, nombre_aprox: str) -> Optional[dict]:
    """Busca un item de inventario por aproximación de nombre + grupo."""
    res = supabase.table('inventario_material').select('id,codigo,nombre,cantidad_total') \
        .eq('grupo', grupo).execute().data or []
    nombre_l = nombre_aprox.lower()
    for r in res:
        if (r.get('nombre') or '').lower() == nombre_l: return r
    for r in res:
        if nombre_l in (r.get('nombre') or '').lower(): return r
    return None


@router.post("/montaje/{evento_id}/generar")
async def generar_montaje(evento_id: str, ensayo_id: Optional[str] = None,
                          current_user: dict = Depends(get_current_gestor)):
    """Genera el montaje automático en función de los músicos confirmados
    del evento + repertorio programado.
    Si se pasa ensayo_id, filtra por instrumentos efectivamente convocados a ESE ensayo
    (lee ensayo_instrumentos / instrumentos_desconvocados).
    """
    # 0. Si hay ensayo_id, identificar instrumentos convocados/desconvocados
    instrumentos_convocados = None  # None = todos; set = solo estos
    instrumentos_desconvocados = set()
    if ensayo_id:
        try:
            ei = supabase.table('ensayo_instrumentos').select('*').eq('ensayo_id', ensayo_id).execute().data or []
            for r in ei:
                inst = (r.get('instrumento') or '').lower().strip()
                if not inst: continue
                if r.get('convocado') is False or (r.get('estado') or '').lower() in ('desconvocado', 'no_convocado'):
                    instrumentos_desconvocados.add(inst)
                else:
                    if instrumentos_convocados is None:
                        instrumentos_convocados = set()
                    instrumentos_convocados.add(inst)
        except Exception:
            pass

    def instrumento_activo(nombre):
        nl = (nombre or '').lower().strip()
        if not nl: return True
        if nl in instrumentos_desconvocados: return False
        if instrumentos_convocados is not None:
            return any(c in nl or nl in c for c in instrumentos_convocados)
        return True

    # 1. Asignaciones confirmadas + usuario.instrumento
    asigs = supabase.table('asignaciones').select('usuario_id,estado') \
        .eq('evento_id', evento_id).eq('estado', 'confirmado').execute().data or []
    user_ids = list({a['usuario_id'] for a in asigs if a.get('usuario_id')})
    sec_count: Dict[str, int] = {}
    n_contrabajos = 0
    if user_ids:
        users = supabase.table('usuarios').select('id,instrumento').in_('id', user_ids).execute().data or []
        for u in users:
            inst_n = u.get('instrumento') or ''
            # Bloque 6B — filtro por ensayo
            if not instrumento_activo(inst_n):
                continue
            sec = _instrumento_seccion(inst_n)
            sec_count[sec] = sec_count.get(sec, 0) + 1
            if 'contrabaj' in inst_n.lower():
                n_contrabajos += 1

    # 2. Calcular sillas + atriles
    sillas = sum(sec_count.values())
    atriles = 0
    sec_atriles_detalle = {}
    cuerda_total = sec_count.get('cuerda', 0)
    cuerda_no_cb = max(0, cuerda_total - n_contrabajos)
    a_cuerda = math.ceil(cuerda_no_cb / 2) + n_contrabajos
    sec_atriles_detalle['Cuerda'] = a_cuerda
    atriles += a_cuerda
    for s_label, s_key in (('Viento madera','viento_madera'), ('Viento metal','viento_metal'),
                            ('Percusión','percusion'), ('Teclado','teclado'), ('Coro','coro')):
        n = sec_count.get(s_key, 0)
        if n:
            sec_atriles_detalle[s_label] = n
            atriles += n

    # 3. Repertorio: papeles de percusión
    obras_prog = supabase.table('evento_obras').select('obra_id') \
        .eq('evento_id', evento_id).execute().data or []
    obra_ids = [o['obra_id'] for o in obras_prog if o.get('obra_id')]
    papeles_perc = set()
    if obra_ids:
        partes = supabase.table('obra_partes').select('obra_id,seccion,papel,instrumento') \
            .in_('obra_id', obra_ids).execute().data or []
        for p in partes:
            sec = (p.get('seccion') or '').lower()
            papel = (p.get('papel') or '').lower()
            if 'percu' in sec or 'timbal' in papel or 'percu' in papel:
                papeles_perc.add(papel.strip())

    # 4. Construir lista de items
    items: List[dict] = []
    def add(grupo, nombre, qty, seccion=None, notas=None):
        m = _buscar_material(grupo, nombre)
        items.append({
            "evento_id": evento_id,
            "ensayo_id": ensayo_id,
            "material_id": m['id'] if m else None,
            "nombre_material": nombre if not m else None,
            "cantidad_necesaria": qty,
            "origen": "propio",
            "seccion_escenario": seccion,
            "notas": notas,
        })

    # Sillas / atriles / lámparas
    if sillas: add('mobiliario', 'Silla de orquesta', sillas, 'Orquesta')
    if a_cuerda: add('mobiliario', 'Atril de orquesta', a_cuerda, 'Cuerda')
    a_resto = sum(sec_atriles_detalle.get(x, 0) for x in ('Viento madera','Viento metal','Percusión','Teclado'))
    if a_resto: add('mobiliario', 'Atril de orquesta', a_resto, 'Viento/Percusión/Teclado')
    a_coro = sec_atriles_detalle.get('Coro', 0)
    if a_coro: add('mobiliario', 'Atril de coro', a_coro, 'Coro')
    if atriles: add('iluminacion', 'Lámpara de atril LED', atriles + 1, 'Orquesta + Director')
    # Director
    add('mobiliario', 'Podio director', 1, 'Director')
    add('mobiliario', 'Atril director', 1, 'Director')
    # Contrabajos: taburete
    if n_contrabajos: add('mobiliario', 'Taburete contrabajista', n_contrabajos, 'Contrabajos')
    # Tarima director
    add('tarimas', 'Tarima director', 1, 'Director')
    # Percusión: añadir según papeles
    if 'timbales' in papeles_perc or any('timbal' in p for p in papeles_perc):
        add('percusion', 'Timbal 1', 1, 'Percusión')
        add('percusion', 'Timbal 2', 1, 'Percusión')
        add('percusion', 'Timbal 3', 1, 'Percusión')
        add('percusion', 'Timbal 4', 1, 'Percusión')
        add('tarimas', 'Tarima timbales', 1, 'Percusión')
    if any('bombo' in p for p in papeles_perc):
        add('percusion', 'Bombo con soporte', 1, 'Percusión')
    if any('caja' in p for p in papeles_perc):
        add('percusion', 'Caja con soporte', 1, 'Percusión')
    if any('platill' in p for p in papeles_perc):
        add('percusion', 'Platillos con soporte', 1, 'Percusión')
    if any('xilof' in p or 'xil' in p for p in papeles_perc):
        add('percusion', 'Xilófono', 1, 'Percusión')
    if any('marimba' in p for p in papeles_perc):
        add('percusion', 'Marimba', 1, 'Percusión')
    if any('vibraf' in p or 'vibr' in p for p in papeles_perc):
        add('percusion', 'Vibráfono', 1, 'Percusión')
    if any('triang' in p for p in papeles_perc):
        add('percusion', 'Triángulo', 1, 'Percusión')

    # 5. Borrar montaje previo del evento (a nivel evento, no ensayos)
    supabase.table('evento_montaje').delete() \
        .eq('evento_id', evento_id).is_('ensayo_id', 'null').execute()

    # 6. Insertar batch
    if items:
        supabase.table('evento_montaje').insert(items).execute()

    return {"generados": len(items), "stats": {"sillas": sillas, "atriles": atriles, "secciones": sec_count, "papeles_percusion": list(papeles_perc)}}


@router.put("/montaje/{evento_id}")
async def guardar_montaje(evento_id: str, data: MontajePut, current_user: dict = Depends(get_current_gestor)):
    """Upsert masivo de items. ensayo_id en el body filtra el contexto."""
    creados = actualizados = borrados = 0
    if data.eliminar_ids:
        supabase.table('evento_montaje').delete().in_('id', data.eliminar_ids).execute()
        borrados = len(data.eliminar_ids)
    for it in data.items:
        d = it.model_dump(exclude_none=True)
        d['evento_id'] = evento_id
        if data.ensayo_id and 'ensayo_id' not in d:
            d['ensayo_id'] = data.ensayo_id
        if d.get('id'):
            iid = d.pop('id')
            supabase.table('evento_montaje').update(d).eq('id', iid).execute()
            actualizados += 1
        else:
            d.pop('id', None)
            supabase.table('evento_montaje').insert(d).execute()
            creados += 1
    return {"creados": creados, "actualizados": actualizados, "borrados": borrados}


# ============================================================
# Transporte de Material
# ============================================================
@router.get("/transporte-material/{evento_id}")
async def get_transporte_material(evento_id: str, current_user: dict = Depends(get_current_gestor)):
    r = supabase.table('transporte_material').select('*').eq('evento_id', evento_id).limit(1).execute().data or []
    return {"transporte": r[0] if r else None}


@router.put("/transporte-material/{evento_id}")
async def upsert_transporte_material(evento_id: str, data: TransporteMaterialIn, current_user: dict = Depends(get_current_gestor)):
    payload = data.model_dump(exclude_none=True)
    payload['evento_id'] = evento_id
    payload['updated_at'] = datetime.now(timezone.utc).isoformat()
    existing = supabase.table('transporte_material').select('id').eq('evento_id', evento_id).limit(1).execute().data or []
    if existing:
        supabase.table('transporte_material').update(payload).eq('id', existing[0]['id']).execute()
        return {"transporte": payload, "action": "updated"}
    res = supabase.table('transporte_material').insert(payload).execute()
    return {"transporte": (res.data or [None])[0], "action": "created"}
