"""Inventario de Material — API."""
import os
from typing import Optional, Literal
from datetime import datetime, timezone, date
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from supabase import create_client

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api/gestor/inventario", tags=["inventario"])

INV_BUCKET = "inventario"
INV_MAX_BYTES = 5 * 1024 * 1024
ALLOWED_MIME = {"image/png", "image/jpeg", "image/webp", "image/gif"}


def _detect_image(buf: bytes) -> Optional[str]:
    if len(buf) < 12: return None
    if buf[:8] == b"\x89PNG\r\n\x1a\n": return "png"
    if buf[:3] == b"\xff\xd8\xff": return "jpeg"
    if buf[:6] in (b"GIF87a", b"GIF89a"): return "gif"
    if buf[:4] == b"RIFF" and buf[8:12] == b"WEBP": return "webp"
    return None


# ============================================================
# Modelos
# ============================================================
class MaterialIn(BaseModel):
    codigo: Optional[str] = None
    grupo: Literal['percusion','mobiliario','iluminacion','audio','transporte','tarimas','otros']
    subgrupo: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    cantidad_total: int = 1
    estado: Literal['bueno','necesita_revision','fuera_servicio'] = 'bueno'
    fecha_entrada: Optional[str] = None
    precio_compra: Optional[float] = None
    notas: Optional[str] = None


class PrestamoIn(BaseModel):
    material_id: str
    tipo: Literal['interno','externo']
    evento_id: Optional[str] = None
    entidad_externa: Optional[str] = None
    contacto: Optional[str] = None
    cantidad: int = 1
    fecha_salida: str
    fecha_prevista_devolucion: Optional[str] = None
    notas: Optional[str] = None


class PrestamoUpdate(BaseModel):
    fecha_devolucion_real: Optional[str] = None
    estado: Optional[Literal['activo','devuelto','parcial']] = None
    notas: Optional[str] = None
    cantidad: Optional[int] = None


# ============================================================
# Helpers
# ============================================================
def _disponibilidad_mapa() -> dict:
    """Devuelve {material_id: cantidad_prestada_activa}."""
    out = {}
    res = supabase.table('inventario_prestamos').select('material_id,cantidad') \
        .eq('estado', 'activo').execute().data or []
    for p in res:
        mid = p.get('material_id')
        out[mid] = out.get(mid, 0) + (p.get('cantidad') or 0)
    return out


# ============================================================
# Material — CRUD
# ============================================================
@router.get("")
async def listar_material(
    grupo: Optional[str] = None,
    estado: Optional[str] = None,
    q: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    sel = supabase.table('inventario_material').select('*').order('grupo').order('nombre').limit(2000)
    if grupo: sel = sel.eq('grupo', grupo)
    if estado: sel = sel.eq('estado', estado)
    rows = sel.execute().data or []
    if q:
        ql = q.lower()
        rows = [r for r in rows
                if ql in (r.get('nombre') or '').lower()
                or ql in (r.get('codigo') or '').lower()
                or ql in (r.get('modelo') or '').lower()]
    prest = _disponibilidad_mapa()
    for r in rows:
        r['prestados_activos'] = prest.get(r['id'], 0)
        r['disponibles'] = max(0, (r.get('cantidad_total') or 0) - prest.get(r['id'], 0))
    return {"material": rows, "total": len(rows)}


@router.post("")
async def crear_material(data: MaterialIn, current_user: dict = Depends(get_current_gestor)):
    payload = data.model_dump(exclude_none=True)
    res = supabase.table('inventario_material').insert(payload).execute()
    return {"material": (res.data or [None])[0]}


@router.get("/alertas")
async def alertas_inventario(current_user: dict = Depends(get_current_gestor)):
    today = date.today()
    revisar = supabase.table('inventario_material').select('*') \
        .eq('estado', 'necesita_revision').execute().data or []
    fos = supabase.table('inventario_material').select('*') \
        .eq('estado', 'fuera_servicio').execute().data or []
    prest = supabase.table('inventario_prestamos') \
        .select('*, material:inventario_material(id,codigo,nombre,grupo)') \
        .eq('estado', 'activo').execute().data or []
    vencidos, proximos = [], []
    for p in prest:
        fp = p.get('fecha_prevista_devolucion')
        if not fp: continue
        try: d = date.fromisoformat(fp)
        except Exception: continue
        if d < today: vencidos.append(p)
        elif (d - today).days <= 7: proximos.append(p)
    # Material con disponible=0
    mats = supabase.table('inventario_material').select('id,codigo,nombre,grupo,cantidad_total').execute().data or []
    pmap = _disponibilidad_mapa()
    sin_disp = [{**m, 'disponibles': 0} for m in mats
                if (m.get('cantidad_total') or 0) > 0 and pmap.get(m['id'], 0) >= (m.get('cantidad_total') or 0)]
    return {
        "necesita_revision": revisar,
        "fuera_servicio": fos,
        "prestamos_vencidos": vencidos,
        "prestamos_proximos": proximos,
        "sin_disponibilidad": sin_disp,
    }


@router.get("/prestamos")
async def listar_prestamos(
    estado: Optional[str] = None,
    tipo: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    sel = supabase.table('inventario_prestamos') \
        .select('*, material:inventario_material(id,codigo,nombre,grupo), evento:eventos(id,nombre,fecha_inicio)') \
        .order('fecha_prevista_devolucion').limit(2000)
    if estado: sel = sel.eq('estado', estado)
    if tipo: sel = sel.eq('tipo', tipo)
    return {"prestamos": sel.execute().data or []}


@router.post("/prestamos")
async def crear_prestamo(data: PrestamoIn, current_user: dict = Depends(get_current_gestor)):
    payload = data.model_dump(exclude_none=True)
    profile = current_user.get('profile') or {}
    if profile.get('id'):
        payload['gestor_id'] = profile['id']
    res = supabase.table('inventario_prestamos').insert(payload).execute()
    return {"prestamo": (res.data or [None])[0]}


@router.put("/prestamos/{prestamo_id}")
async def actualizar_prestamo(prestamo_id: str, data: PrestamoUpdate, current_user: dict = Depends(get_current_gestor)):
    payload = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    payload['updated_at'] = datetime.now(timezone.utc).isoformat()
    if data.fecha_devolucion_real and not data.estado:
        payload['estado'] = 'devuelto'
    res = supabase.table('inventario_prestamos').update(payload).eq('id', prestamo_id).execute()
    return {"prestamo": (res.data or [None])[0]}


@router.get("/{material_id}")
async def obtener_material(material_id: str, current_user: dict = Depends(get_current_gestor)):
    r = supabase.table('inventario_material').select('*').eq('id', material_id).limit(1).execute().data or []
    if not r: raise HTTPException(status_code=404, detail="No encontrado")
    m = r[0]
    pmap = _disponibilidad_mapa()
    m['prestados_activos'] = pmap.get(material_id, 0)
    m['disponibles'] = max(0, (m.get('cantidad_total') or 0) - pmap.get(material_id, 0))
    historial = supabase.table('inventario_prestamos') \
        .select('*, evento:eventos(id,nombre,fecha_inicio)') \
        .eq('material_id', material_id) \
        .order('fecha_salida', desc=True).limit(50).execute().data or []
    return {"material": m, "historial": historial}


@router.put("/{material_id}")
async def actualizar_material(material_id: str, data: MaterialIn, current_user: dict = Depends(get_current_gestor)):
    payload = data.model_dump(exclude_none=True)
    payload['updated_at'] = datetime.now(timezone.utc).isoformat()
    res = supabase.table('inventario_material').update(payload).eq('id', material_id).execute()
    return {"material": (res.data or [None])[0]}


@router.post("/{material_id}/foto")
async def subir_foto(material_id: str, archivo: UploadFile = File(...), current_user: dict = Depends(get_current_gestor)):
    if archivo.content_type not in ALLOWED_MIME:
        raise HTTPException(400, "Tipo no permitido")
    content = await archivo.read()
    if not content: raise HTTPException(400, "Archivo vacío")
    if len(content) > INV_MAX_BYTES: raise HTTPException(413, "Imagen >5MB")
    kind = _detect_image(content)
    if not kind: raise HTTPException(400, "No es imagen válida")
    ext = "jpg" if kind == "jpeg" else kind
    ts = int(datetime.now().timestamp() * 1000)
    path = f"material/{material_id}/{ts}.{ext}"
    admin = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    try:
        admin.storage.from_(INV_BUCKET).upload(path, content, {"content-type": f"image/{kind}", "upsert": "true"})
    except Exception as e:
        raise HTTPException(500, f"Upload error: {e}")
    public_url = admin.storage.from_(INV_BUCKET).get_public_url(path)
    supabase.table('inventario_material').update({"foto_url": public_url, "updated_at": datetime.now(timezone.utc).isoformat()}).eq('id', material_id).execute()
    return {"url": public_url}
