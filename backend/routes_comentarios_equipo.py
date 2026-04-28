"""
Comentarios de equipo — API.
Hilos de comentarios contextualizados por página/entidad para el equipo de gestores.
Soporta menciones (@id), urgencia, threading (parent_id) y estados (pendiente / en_proceso / resuelto).
"""
from typing import List, Optional, Literal
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api/gestor/comentarios-equipo", tags=["comentarios-equipo"])


# ============================================================
# Modelos
# ============================================================
class ComentarioEquipoCreate(BaseModel):
    pagina: str
    seccion: Optional[str] = None
    entidad_tipo: Optional[str] = None
    entidad_id: Optional[str] = None
    entidad_nombre: Optional[str] = None
    contenido: str
    menciones: Optional[List[str]] = []   # lista de usuario_id mencionados
    urgente: Optional[bool] = False


class ComentarioRespuesta(BaseModel):
    contenido: str
    menciones: Optional[List[str]] = []


class ComentarioEstadoUpdate(BaseModel):
    estado: Literal['pendiente', 'en_proceso', 'resuelto']


# ============================================================
# Helpers
# ============================================================
def _autor_info(current_user: dict) -> tuple:
    """Devuelve (autor_id, autor_nombre)."""
    profile = current_user.get('profile') or {}
    autor_id = profile.get('id')
    nombre = (profile.get('nombre') or '').strip()
    apellidos = (profile.get('apellidos') or '').strip()
    autor_nombre = f"{nombre} {apellidos}".strip() or profile.get('email') or 'Gestor'
    return autor_id, autor_nombre


def _notificar_mencionados(
    menciones: List[str], autor_nombre: str, pagina: str,
    entidad_nombre: Optional[str], contenido: str, comentario_id: str
):
    """Inserta notificaciones para cada gestor mencionado.
    Si no se menciona a nadie, notifica a TODOS los gestores activos
    (excluyendo al autor)."""
    contexto = f"{pagina}" + (f" → {entidad_nombre}" if entidad_nombre else "")
    titulo = f"💬 {autor_nombre} comenta en {contexto}"
    descripcion = (contenido or '')[:80]
    try:
        if menciones:
            destinatarios = list({m for m in menciones if m})
        else:
            # Notificar a todos los gestores/archiveros excepto al autor
            res = supabase.table('usuarios').select('id') \
                .in_('rol', ['gestor', 'archivero']).execute().data or []
            destinatarios = [u['id'] for u in res]

        # Push helper (best-effort)
        try:
            from routes_push import notify_push
        except Exception:
            notify_push = None

        for gid in destinatarios:
            try:
                supabase.table('notificaciones_gestor').insert({
                    "gestor_id": gid,
                    "tipo": "comentario_equipo",
                    "titulo": titulo,
                    "descripcion": descripcion,
                    "entidad_tipo": "comentario_equipo",
                    "entidad_id": comentario_id,
                    "leida": False,
                }).execute()
            except Exception:
                pass
            # Push (Bloque PWA)
            if notify_push:
                try:
                    notify_push(gid, titulo, descripcion, pagina or '/', tipo='comentario')
                except Exception:
                    pass
    except Exception:
        pass


# ============================================================
# CREATE / LIST
# ============================================================
@router.post("")
async def crear_comentario(data: ComentarioEquipoCreate, current_user: dict = Depends(get_current_gestor)):
    autor_id, autor_nombre = _autor_info(current_user)
    payload = {
        "pagina": data.pagina,
        "seccion": data.seccion,
        "entidad_tipo": data.entidad_tipo,
        "entidad_id": data.entidad_id,
        "entidad_nombre": data.entidad_nombre,
        "contenido": data.contenido.strip(),
        "menciones": data.menciones or [],
        "autor_id": autor_id,
        "autor_nombre": autor_nombre,
        "urgente": bool(data.urgente),
    }
    if not payload["contenido"] or len(payload["contenido"]) < 5:
        raise HTTPException(status_code=400, detail="El comentario debe tener al menos 5 caracteres.")
    res = supabase.table('comentarios_equipo').insert(payload).execute()
    creado = (res.data or [None])[0]
    if not creado:
        raise HTTPException(status_code=500, detail="No se pudo crear el comentario.")
    # Excluir al autor de los mencionados auto-notificados
    menciones = [m for m in (data.menciones or []) if m and m != autor_id]
    _notificar_mencionados(
        menciones, autor_nombre, data.pagina,
        data.entidad_nombre, data.contenido, creado['id']
    )
    return {"comentario": creado}


@router.get("")
async def listar_comentarios(
    estado: Optional[str] = None,
    autor_id: Optional[str] = None,
    pagina: Optional[str] = None,
    mencionado_id: Optional[str] = None,
    entidad_tipo: Optional[str] = None,
    entidad_id: Optional[str] = None,
    incluye_resueltos: bool = True,
    limit: int = 500,
    current_user: dict = Depends(get_current_gestor),
):
    """Lista hilos raíz (parent_id IS NULL) con filtros opcionales."""
    sel = supabase.table('comentarios_equipo').select('*') \
        .is_('parent_id', 'null') \
        .order('created_at', desc=True).limit(limit)
    if estado:
        sel = sel.eq('estado', estado)
    if autor_id:
        sel = sel.eq('autor_id', autor_id)
    if pagina:
        sel = sel.ilike('pagina', f'%{pagina}%')
    if entidad_tipo:
        sel = sel.eq('entidad_tipo', entidad_tipo)
    if entidad_id:
        sel = sel.eq('entidad_id', entidad_id)
    if not incluye_resueltos:
        sel = sel.neq('estado', 'resuelto')
    rows = sel.execute().data or []
    # Filtro por mencionado: hace match contra JSONB array
    if mencionado_id:
        rows = [r for r in rows if mencionado_id in (r.get('menciones') or [])]
    # Contar respuestas por hilo
    if rows:
        ids = [r['id'] for r in rows]
        counts: dict = {}
        for i in range(0, len(ids), 200):
            chunk = ids[i:i + 200]
            res = supabase.table('comentarios_equipo').select('parent_id') \
                .in_('parent_id', chunk).execute().data or []
            for x in res:
                pid = x.get('parent_id')
                counts[pid] = counts.get(pid, 0) + 1
        for r in rows:
            r['respuestas_count'] = counts.get(r['id'], 0)
    return {"comentarios": rows, "total": len(rows)}


# ============================================================
# DETALLE / HILO
# ============================================================
@router.get("/{comentario_id}")
async def obtener_hilo(comentario_id: str, current_user: dict = Depends(get_current_gestor)):
    raiz = supabase.table('comentarios_equipo').select('*').eq('id', comentario_id) \
        .limit(1).execute().data or []
    if not raiz:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    respuestas = supabase.table('comentarios_equipo').select('*') \
        .eq('parent_id', comentario_id) \
        .order('created_at', desc=False).execute().data or []
    return {"comentario": raiz[0], "respuestas": respuestas}


@router.post("/{comentario_id}/responder")
async def responder_comentario(
    comentario_id: str, data: ComentarioRespuesta,
    current_user: dict = Depends(get_current_gestor),
):
    raiz = supabase.table('comentarios_equipo').select('*').eq('id', comentario_id) \
        .limit(1).execute().data or []
    if not raiz:
        raise HTTPException(status_code=404, detail="Comentario raíz no encontrado")
    raiz = raiz[0]
    autor_id, autor_nombre = _autor_info(current_user)
    if not data.contenido or len(data.contenido.strip()) < 3:
        raise HTTPException(status_code=400, detail="La respuesta debe tener al menos 3 caracteres.")
    payload = {
        "parent_id": comentario_id,
        "pagina": raiz.get('pagina'),
        "seccion": raiz.get('seccion'),
        "entidad_tipo": raiz.get('entidad_tipo'),
        "entidad_id": raiz.get('entidad_id'),
        "entidad_nombre": raiz.get('entidad_nombre'),
        "contenido": data.contenido.strip(),
        "menciones": data.menciones or [],
        "autor_id": autor_id,
        "autor_nombre": autor_nombre,
    }
    res = supabase.table('comentarios_equipo').insert(payload).execute()
    creada = (res.data or [None])[0]
    # Notificar al autor del hilo + mencionados
    destinatarios = set(data.menciones or [])
    if raiz.get('autor_id') and raiz['autor_id'] != autor_id:
        destinatarios.add(raiz['autor_id'])
    if destinatarios:
        _notificar_mencionados(
            list(destinatarios), autor_nombre, raiz.get('pagina') or '',
            raiz.get('entidad_nombre'), data.contenido, comentario_id
        )
    return {"respuesta": creada}


@router.put("/{comentario_id}/estado")
async def actualizar_estado(
    comentario_id: str, data: ComentarioEstadoUpdate,
    current_user: dict = Depends(get_current_gestor),
):
    _, autor_nombre = _autor_info(current_user)
    payload = {
        "estado": data.estado,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if data.estado == 'resuelto':
        payload["resuelto_por"] = autor_nombre
        payload["resuelto_at"] = datetime.now(timezone.utc).isoformat()
    else:
        payload["resuelto_por"] = None
        payload["resuelto_at"] = None
    supabase.table('comentarios_equipo').update(payload).eq('id', comentario_id).execute()
    return {"ok": True, "estado": data.estado}


# ============================================================
# Lista de gestores para autocompletar @menciones
# ============================================================
@router.get("/_meta/gestores")
async def listar_gestores_para_mencion(current_user: dict = Depends(get_current_gestor)):
    """Lista gestores y archiveros activos para el multi-select de menciones."""
    res = supabase.table('usuarios') \
        .select('id,nombre,apellidos,email,rol') \
        .in_('rol', ['gestor', 'archivero']) \
        .eq('estado', 'activo') \
        .order('apellidos').execute().data or []
    return {"gestores": res}
