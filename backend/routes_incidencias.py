"""
Incidencias / Feedback — API.
Acepta reportes desde gestor y portal del músico.
"""
import os
from typing import Optional, Literal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from supabase import create_client
from supabase_client import supabase
from auth_utils import get_current_gestor, get_current_user

router = APIRouter(prefix="/api", tags=["incidencias"])

# Bucket reusado para adjuntos (ya existe en Supabase Storage para justificantes).
# Las capturas de incidencias se guardan bajo el subpath `incidencias/`.
SCREENSHOT_BUCKET = "justificantes"
SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
SCREENSHOT_ALLOWED_MIME = {"image/png", "image/jpeg", "image/webp", "image/gif"}

# Magic bytes (signatures) por tipo. Se valida que el contenido real
# corresponda a un formato de imagen permitido, no sólo el header `Content-Type`
# enviado por el cliente (que es trivial de falsificar).
def _detect_image_kind(buf: bytes) -> Optional[str]:
    """Devuelve 'png' | 'jpeg' | 'webp' | 'gif' según los magic bytes, o None."""
    if len(buf) < 12:
        return None
    if buf[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if buf[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if buf[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if buf[:4] == b"RIFF" and buf[8:12] == b"WEBP":
        return "webp"
    return None


_MIME_FOR_KIND = {
    "png": "image/png",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
}


class IncidenciaCreate(BaseModel):
    tipo: Literal['incidencia', 'mejora', 'pregunta']
    descripcion: str
    pagina: Optional[str] = None
    screenshot_url: Optional[str] = None
    prioridad: Optional[Literal['alta', 'media', 'baja']] = 'media'


class IncidenciaUpdate(BaseModel):
    estado: Optional[str] = None
    respuesta: Optional[str] = None
    prioridad: Optional[Literal['alta', 'media', 'baja']] = None


def _crear_incidencia_y_notificar(payload: dict, current_user: dict) -> dict:
    """Inserta la incidencia + notifica al admin gestor (si es distinto del autor).

    Resuelve el `usuario_id` correcto buscando en `public.usuarios` por:
      1) profile.id (UUID de la fila en usuarios) → ya viene resuelto desde get_current_*
      2) usuarios.user_id == current_user.id (FK al auth.users)
      3) usuarios.id == current_user.id (cuando ambos UUIDs coinciden)
    Así soportamos tanto cuentas con `usuarios.id == auth.id` (legado) como
    cuentas creadas por la admin API donde son UUIDs distintos.
    """
    profile = current_user.get('profile') or {}
    auth_uid = current_user.get('id')
    usuario_id_valido = None

    # 1) profile.id si existe (camino feliz cuando viene de get_current_*)
    pid = profile.get('id')
    if pid:
        ex = supabase.table('usuarios').select('id').eq('id', pid).limit(1).execute()
        if ex.data:
            usuario_id_valido = pid

    # 2) Buscar por user_id (FK auth.users)
    if not usuario_id_valido and auth_uid:
        ex = supabase.table('usuarios').select('id').eq('user_id', auth_uid).limit(1).execute()
        if ex.data:
            usuario_id_valido = ex.data[0]['id']

    # 3) Caso legado: usuarios.id == auth.id
    if not usuario_id_valido and auth_uid:
        ex = supabase.table('usuarios').select('id').eq('id', auth_uid).limit(1).execute()
        if ex.data:
            usuario_id_valido = auth_uid

    payload['usuario_id'] = usuario_id_valido
    nombre_full = f"{current_user.get('apellidos','') or ''}, {current_user.get('nombre','') or ''}".strip(', ')
    if not nombre_full:
        nombre_full = current_user.get('email') or 'Usuario desconocido'
    payload['usuario_nombre'] = nombre_full
    if not payload.get('prioridad'):
        payload['prioridad'] = 'media'

    r = supabase.table('incidencias').insert(payload).execute()
    incidencia = r.data[0] if r.data else None

    # Notificar al admin gestor
    try:
        admin_q = supabase.table('usuarios').select('id') \
            .eq('email', 'admin@convocatorias.com') \
            .eq('rol', 'gestor').limit(1).execute()
        admin = admin_q.data[0] if admin_q.data else None
        if admin and admin['id'] != usuario_id_valido and incidencia:
            supabase.table('notificaciones_gestor').insert({
                "usuario_id": admin['id'],
                "tipo": "incidencia_nueva",
                "titulo": f"Nueva {payload.get('tipo','incidencia')}",
                "mensaje": f"{nombre_full}: {(payload.get('descripcion') or '')[:90]}",
                "link": f"/admin/incidencias?id={incidencia.get('id')}",
            }).execute()
    except Exception:
        pass  # Si falla la notificación, no rompemos el flujo

    return incidencia


@router.post("/gestor/incidencias")
async def create_incidencia_gestor(data: IncidenciaCreate, current_user: dict = Depends(get_current_gestor)):
    try:
        incidencia = _crear_incidencia_y_notificar(data.model_dump(exclude_none=True), current_user)
        return {"incidencia": incidencia}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear incidencia: {str(e)}")


@router.post("/portal/incidencias")
async def create_incidencia_portal(data: IncidenciaCreate, current_user: dict = Depends(get_current_user)):
    """Mismo flujo que el gestor pero accesible desde el portal del músico."""
    try:
        merged = {
            'id': current_user.get('id') or (current_user.get('profile') or {}).get('id'),
            'email': current_user.get('email'),
            'nombre': (current_user.get('profile') or {}).get('nombre') or current_user.get('nombre'),
            'apellidos': (current_user.get('profile') or {}).get('apellidos') or current_user.get('apellidos'),
        }
        incidencia = _crear_incidencia_y_notificar(data.model_dump(exclude_none=True), merged)
        return {"incidencia": incidencia}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear incidencia: {str(e)}")


@router.get("/gestor/incidencias")
async def list_incidencias(
    estado: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    try:
        q = supabase.table('incidencias').select('*')
        if estado:
            q = q.eq('estado', estado)
        r = q.order('created_at', desc=True).execute()
        return {"incidencias": r.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar incidencias: {str(e)}")


@router.put("/gestor/incidencias/{inc_id}")
async def update_incidencia(inc_id: str, data: IncidenciaUpdate, current_user: dict = Depends(get_current_gestor)):
    try:
        payload = data.model_dump(exclude_none=True)
        payload['updated_at'] = datetime.now().isoformat()
        r = supabase.table('incidencias').update(payload).eq('id', inc_id).execute()
        return {"incidencia": r.data[0] if r.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar incidencia: {str(e)}")


@router.delete("/gestor/incidencias/{inc_id}")
async def delete_incidencia(inc_id: str, current_user: dict = Depends(get_current_gestor)):
    try:
        supabase.table('incidencias').delete().eq('id', inc_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar incidencia: {str(e)}")



# ==================================================================
# Upload de screenshot adjunto a incidencias
# Accesible para gestores y músicos (mismo handler).
# ==================================================================
async def _upload_screenshot(archivo: UploadFile, current_user: dict) -> dict:
    if archivo.content_type not in SCREENSHOT_ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail="Tipo de archivo no permitido. Usa PNG, JPEG, WEBP o GIF.",
        )
    content = await archivo.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    if len(content) > SCREENSHOT_MAX_BYTES:
        raise HTTPException(status_code=413, detail="La imagen supera el tamaño máximo de 5 MB.")

    # Validación de magic bytes — el Content-Type del cliente es falsificable.
    kind = _detect_image_kind(content)
    if kind is None:
        raise HTTPException(
            status_code=400,
            detail="El archivo no es una imagen válida (PNG/JPEG/WEBP/GIF).",
        )
    # Coherencia entre extensión declarada y magic bytes
    expected_mime = _MIME_FOR_KIND[kind]
    if archivo.content_type != expected_mime:
        # Si el cliente declaró otro mime permitido pero el contenido es distinto, rechazar.
        raise HTTPException(
            status_code=400,
            detail=f"Inconsistencia: el contenido es {kind} pero se declaró {archivo.content_type}.",
        )

    uid = (
        current_user.get('id')
        or (current_user.get('profile') or {}).get('id')
        or 'anonymous'
    )
    ext = "jpg" if kind == "jpeg" else kind
    ts = int(datetime.now().timestamp() * 1000)
    path = f"incidencias/{uid}/{ts}.{ext}"

    admin_client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    try:
        admin_client.storage.from_(SCREENSHOT_BUCKET).upload(
            path,
            content,
            {
                "content-type": expected_mime,
                "upsert": "true",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir imagen: {str(e)}")

    public_url = admin_client.storage.from_(SCREENSHOT_BUCKET).get_public_url(path)
    return {"url": public_url, "path": path}


@router.post("/gestor/incidencias/upload-screenshot")
async def upload_screenshot_gestor(
    archivo: UploadFile = File(...),
    current_user: dict = Depends(get_current_gestor),
):
    return await _upload_screenshot(archivo, current_user)


@router.post("/portal/incidencias/upload-screenshot")
async def upload_screenshot_portal(
    archivo: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    return await _upload_screenshot(archivo, current_user)
