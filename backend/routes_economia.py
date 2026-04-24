"""
Economía — Cachets y Presupuestos (CRUD + bulk).
Extraído de routes_gestor.py durante el refactor de feb 2026.

NOTA: Los endpoints de Gestión Económica (lectura agregada de pagos),
Análisis Económico y SEPA/Excel exports se mantienen en routes_gestor.py
porque comparten la lógica de agregación de /plantillas-definitivas.
"""
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api/gestor", tags=["economia"])


# ==================================================================
# Pydantic models
# ==================================================================

class CachetRow(BaseModel):
    instrumento: str
    nivel_estudios: Optional[str] = None
    importe: float


class CachetBaseItem(BaseModel):
    instrumento: str
    nivel_estudios: str
    importe: Optional[float] = 0


class PresupuestoItem(BaseModel):
    evento_id: str
    concepto: str
    categoria: Optional[str] = None
    tipo: Optional[str] = 'gasto'  # 'ingreso' | 'gasto'
    importe_previsto: Optional[float] = 0
    importe_real: Optional[float] = 0
    estado: Optional[str] = None
    notas: Optional[str] = None
    fecha_prevista: Optional[str] = None
    fecha_pago: Optional[str] = None


class PresupuestoBulkItem(BaseModel):
    id: Optional[str] = None  # si viene, UPDATE; si no, INSERT
    evento_id: str
    concepto: str
    categoria: Optional[str] = None
    tipo: Optional[str] = 'gasto'
    importe_previsto: Optional[float] = 0
    importe_real: Optional[float] = 0
    estado: Optional[str] = None
    notas: Optional[str] = None
    fecha_prevista: Optional[str] = None
    fecha_pago: Optional[str] = None


class PresupuestosBulkRequest(BaseModel):
    partidas: List[PresupuestoBulkItem]
    eliminar_ids: List[str] = []


# ==================================================================
# CACHETS por evento (tabla `cachets_config`)
# ==================================================================

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
    """Sustituye (UPSERT) las tarifas de un evento, por (instrumento, nivel_estudios)."""
    try:
        now = datetime.now().isoformat()
        written = 0
        for row in rows:
            payload = {
                "evento_id": evento_id,
                "instrumento": row.instrumento.strip(),
                "nivel_estudios": (row.nivel_estudios or '').strip() or 'General',
                "importe": row.importe,
                "updated_at": now,
            }
            # Match por (evento, instrumento, nivel) en Python para evitar issues con NULL
            all_rows = supabase.table('cachets_config').select('id,nivel_estudios,instrumento') \
                .eq('evento_id', evento_id).execute().data or []
            target = None
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


# ==================================================================
# CACHETS BASE (evento_id IS NULL) — plantilla global instrumento+nivel
# ==================================================================

@router.get("/cachets-base")
async def get_cachets_base(current_user: dict = Depends(get_current_gestor)):
    """Lista los cachets base (evento_id IS NULL)."""
    try:
        r = supabase.table('cachets_config').select('*').is_('evento_id', 'null').execute()
        return {"cachets": r.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar cachets base: {str(e)}")


@router.put("/cachets-base")
async def put_cachets_base(data: List[CachetBaseItem], current_user: dict = Depends(get_current_gestor)):
    """UPSERT de cachets base por (instrumento, nivel_estudios) con evento_id=NULL."""
    try:
        now = datetime.now().isoformat()
        existing = supabase.table('cachets_config').select('*').is_('evento_id', 'null').execute().data or []
        idx = {(r.get('instrumento'), r.get('nivel_estudios')): r['id'] for r in existing}
        creados = 0
        actualizados = 0
        for row in data:
            payload = {
                "evento_id": None,
                "instrumento": row.instrumento,
                "nivel_estudios": (row.nivel_estudios or '').strip() or 'General',
                "importe": float(row.importe or 0),
                "updated_at": now,
            }
            key = (row.instrumento, payload["nivel_estudios"])
            if key in idx:
                supabase.table('cachets_config').update(payload).eq('id', idx[key]).execute()
                actualizados += 1
            else:
                supabase.table('cachets_config').insert(payload).execute()
                creados += 1
        return {"ok": True, "creados": creados, "actualizados": actualizados}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar cachets base: {str(e)}")


@router.post("/cachets-config/{evento_id}/copy-from-base")
async def copy_cachets_base_to_evento(
    evento_id: str,
    current_user: dict = Depends(get_current_gestor),
):
    """Copia los cachets base (evento_id IS NULL) como cachets específicos del evento dado.
    Sobrescribe cualquier cachet del evento con la misma clave (instrumento, nivel_estudios)."""
    try:
        base = supabase.table('cachets_config').select('instrumento,nivel_estudios,importe') \
            .is_('evento_id', 'null').execute().data or []
        if not base:
            return {"ok": True, "copiados": 0, "mensaje": "No hay plantilla base configurada"}

        existentes = supabase.table('cachets_config').select('id,instrumento,nivel_estudios') \
            .eq('evento_id', evento_id).execute().data or []
        idx = {((r.get('instrumento') or '').strip().lower(), (r.get('nivel_estudios') or '').strip()): r['id'] for r in existentes}

        now = datetime.now().isoformat()
        copiados = 0
        actualizados = 0
        for b in base:
            payload = {
                "evento_id": evento_id,
                "instrumento": b.get('instrumento'),
                "nivel_estudios": (b.get('nivel_estudios') or '').strip() or 'General',
                "importe": float(b.get('importe') or 0),
                "updated_at": now,
            }
            key = ((payload['instrumento'] or '').strip().lower(), payload['nivel_estudios'])
            if key in idx:
                supabase.table('cachets_config').update(payload).eq('id', idx[key]).execute()
                actualizados += 1
            else:
                supabase.table('cachets_config').insert(payload).execute()
                copiados += 1
        return {"ok": True, "copiados": copiados, "actualizados": actualizados}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al copiar plantilla base: {str(e)}")


# ==================================================================
# PRESUPUESTOS (partidas por evento)
# ==================================================================

@router.get("/presupuestos")
async def get_presupuestos_all(
    evento_id: Optional[str] = None,
    temporada: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    """Lista partidas de presupuesto. Filtra por evento o por temporada."""
    try:
        if evento_id:
            r = supabase.table('presupuestos').select('*').eq('evento_id', evento_id).order('concepto', desc=False).execute()
            return {"partidas": r.data or []}
        ev_ids = None
        if temporada:
            ev_res = supabase.table('eventos').select('id').eq('temporada', temporada).execute()
            ev_ids = [e['id'] for e in (ev_res.data or [])]
            if not ev_ids:
                return {"partidas": []}
        q = supabase.table('presupuestos').select('*')
        if ev_ids is not None:
            q = q.in_('evento_id', ev_ids)
        r = q.order('concepto', desc=False).execute()
        return {"partidas": r.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar presupuestos: {str(e)}")


@router.post("/presupuestos")
async def create_presupuesto(data: PresupuestoItem, current_user: dict = Depends(get_current_gestor)):
    try:
        r = supabase.table('presupuestos').insert(data.model_dump(exclude_none=True)).execute()
        return {"partida": r.data[0] if r.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear partida: {str(e)}")


@router.put("/presupuestos/{partida_id}")
async def update_presupuesto(partida_id: str, data: PresupuestoItem, current_user: dict = Depends(get_current_gestor)):
    try:
        payload = data.model_dump(exclude_none=True)
        payload['updated_at'] = datetime.now().isoformat()
        r = supabase.table('presupuestos').update(payload).eq('id', partida_id).execute()
        return {"partida": r.data[0] if r.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar partida: {str(e)}")


@router.delete("/presupuestos/{partida_id}")
async def delete_presupuesto(partida_id: str, current_user: dict = Depends(get_current_gestor)):
    try:
        supabase.table('presupuestos').delete().eq('id', partida_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar partida: {str(e)}")


@router.post("/presupuestos/bulk")
async def bulk_presupuestos(data: PresupuestosBulkRequest, current_user: dict = Depends(get_current_gestor)):
    """Guardado masivo: crea / actualiza / borra partidas en una sola llamada."""
    try:
        now = datetime.now().isoformat()
        creados = 0
        actualizados = 0
        for p in data.partidas:
            base = p.model_dump(exclude_none=True)
            base.pop('id', None)
            base['updated_at'] = now
            if p.id:
                supabase.table('presupuestos').update(base).eq('id', p.id).execute()
                actualizados += 1
            else:
                supabase.table('presupuestos').insert(base).execute()
                creados += 1
        borrados = 0
        for pid in (data.eliminar_ids or []):
            supabase.table('presupuestos').delete().eq('id', pid).execute()
            borrados += 1
        return {"ok": True, "creados": creados, "actualizados": actualizados, "borrados": borrados}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar presupuestos: {str(e)}")


# ==================================================================
# PRESUPUESTOS — Matriz completa (cachets + factor_ponderacion por evento)
# ==================================================================

class CachetMatrizRow(BaseModel):
    id: Optional[str] = None
    evento_id: str
    instrumento: str
    nivel_estudios: str
    importe: Optional[float] = 0
    factor_ponderacion: Optional[float] = 100


class CachetMatrizBulk(BaseModel):
    rows: List[CachetMatrizRow]


@router.get("/presupuestos-matriz")
async def get_presupuestos_matriz(
    temporada: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    """Devuelve la matriz para la pantalla Presupuestos:
    - eventos abiertos (estado='abierto') de la temporada (con nombre, fechas, n_ensayos, n_funciones)
    - cachets_config para cada (evento, instrumento, nivel) con importe + factor_ponderacion
    """
    try:
        # 1) Eventos abiertos
        q = supabase.table('eventos').select('id,nombre,fecha_inicio,fecha_fin,temporada,estado') \
            .eq('estado', 'abierto')
        if temporada:
            q = q.eq('temporada', temporada)
        ev_res = q.order('fecha_inicio', desc=False).execute()
        eventos = ev_res.data or []
        if not eventos:
            return {"eventos": [], "cachets": []}
        evento_ids = [e['id'] for e in eventos]

        # 2) Conteo de ensayos y funciones por evento
        ens_res = supabase.table('ensayos').select('evento_id,tipo') \
            .in_('evento_id', evento_ids).execute()
        n_ens = {eid: 0 for eid in evento_ids}
        n_func = {eid: 0 for eid in evento_ids}
        for row in (ens_res.data or []):
            t = (row.get('tipo') or 'ensayo').lower()
            if t == 'ensayo':
                n_ens[row['evento_id']] = n_ens.get(row['evento_id'], 0) + 1
            else:
                n_func[row['evento_id']] = n_func.get(row['evento_id'], 0) + 1
        for ev in eventos:
            ev['n_ensayos'] = n_ens.get(ev['id'], 0)
            ev['n_funciones'] = n_func.get(ev['id'], 0)

        # 3) Cachets de esos eventos
        ca_res = supabase.table('cachets_config') \
            .select('id,evento_id,instrumento,nivel_estudios,importe,factor_ponderacion') \
            .in_('evento_id', evento_ids).execute()
        return {"eventos": eventos, "cachets": ca_res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/presupuestos-matriz/bulk")
async def bulk_presupuestos_matriz(data: CachetMatrizBulk, current_user: dict = Depends(get_current_gestor)):
    """UPSERT de cachets_config con importe + factor_ponderacion."""
    try:
        now = datetime.now().isoformat()
        creados = 0
        actualizados = 0
        for row in data.rows:
            payload = {
                "evento_id": row.evento_id,
                "instrumento": row.instrumento,
                "nivel_estudios": (row.nivel_estudios or '').strip() or 'General',
                "importe": float(row.importe or 0),
                "factor_ponderacion": float(row.factor_ponderacion or 100),
                "updated_at": now,
            }
            target_id = row.id
            if not target_id:
                # Buscar por (evento, instrumento, nivel)
                existing = supabase.table('cachets_config').select('id') \
                    .eq('evento_id', row.evento_id) \
                    .eq('instrumento', payload['instrumento']) \
                    .eq('nivel_estudios', payload['nivel_estudios']) \
                    .limit(1).execute().data or []
                if existing:
                    target_id = existing[0]['id']
            if target_id:
                supabase.table('cachets_config').update(payload).eq('id', target_id).execute()
                actualizados += 1
            else:
                supabase.table('cachets_config').insert(payload).execute()
                creados += 1
        return {"ok": True, "creados": creados, "actualizados": actualizados, "total": creados + actualizados}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar matriz: {str(e)}")
