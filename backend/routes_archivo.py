"""
Router del módulo Archivo Musical.
Endpoints: catálogo de obras, partes, originales, préstamos, programas de eventos,
verificación de atriles, importación masiva y generación de etiquetas PDF.
"""
import io
import re
import math
import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor
from papeles_archivo import PAPELES_ARCHIVO, PAPELES_POR_SECCION
from instrumentos import INSTRUMENTO_A_SECCION

router = APIRouter(prefix="/api/gestor/archivo", tags=["archivo"])

GENERO_VALIDOS = ['SINF.', 'SINF.COR.', 'ESC.', 'COR.']
PROCEDENCIAS_VALIDAS = ['PROPIO', 'COMPRADO', 'ALQUILER', 'INTERNET', 'INTERNET-LIBRE', 'CESIÓN']


# ============================================================
# Pydantic models
# ============================================================
class ObraIn(BaseModel):
    autor: str
    arreglista: Optional[str] = None
    co_autor: Optional[str] = None
    titulo: str
    movimiento: Optional[str] = None
    genero: Optional[str] = None
    subgenero: Optional[str] = None
    procedencia: Optional[str] = None
    fecha_registro: Optional[str] = None
    observaciones: Optional[str] = None
    estado: Optional[str] = 'activo'
    obra_provisional: Optional[bool] = False
    codigo: Optional[str] = None


class PartePayload(BaseModel):
    papel: str
    copias_fisicas: Optional[int] = 0
    copia_digital: Optional[bool] = False
    enlace_drive: Optional[str] = None
    estado: Optional[str] = 'pendiente'
    notas: Optional[str] = None


class OriginalPayload(BaseModel):
    tipo: str  # general | partes | arcos
    estado: str  # si | no | necesita_revision
    notas: Optional[str] = None


class PrestamoIn(BaseModel):
    obra_id: str
    tipo: str  # interno | externo
    evento_id: Optional[str] = None
    entidad_externa: Optional[str] = None
    contacto_externo: Optional[str] = None
    partes_prestadas: Optional[List[str]] = []
    fecha_salida: str
    fecha_prevista_devolucion: Optional[str] = None
    notas: Optional[str] = None


class PrestamoUpdate(BaseModel):
    estado: Optional[str] = None
    fecha_devolucion_real: Optional[str] = None
    notas: Optional[str] = None
    fecha_prevista_devolucion: Optional[str] = None


class EventoObraIn(BaseModel):
    obra_id: Optional[str] = None
    titulo_provisional: Optional[str] = None
    estado: Optional[str] = 'provisional'
    orden_programa: Optional[int] = 1
    notas: Optional[str] = None


class EtiquetasReq(BaseModel):
    incluye_general: bool = False
    incluye_partes: bool = False
    incluye_arcos: bool = False
    incluye_documentacion: bool = False
    incluye_atriles: bool = True
    incluye_atril_coro: bool = False
    incluye_atril_cuerda: bool = False
    incluye_atril_viento: bool = False
    incluye_atril_percusion: bool = False


# ============================================================
# Helpers
# ============================================================
def _strip_accents(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFKD', s or '') if not unicodedata.combining(c))


def _iniciales_autor(autor: str) -> str:
    """De 'Mozart, Wolfgang Amadeus' → 'MW'. De 'John Williams' → 'JW'."""
    autor = (autor or '').strip()
    if not autor:
        return 'XX'
    if ',' in autor:
        ap, nom = autor.split(',', 1)
        a = _strip_accents(ap.strip())[:1].upper() or 'X'
        n = _strip_accents(nom.strip())[:1].upper() or 'X'
        return a + n
    parts = [p for p in re.split(r'\s+', _strip_accents(autor)) if p]
    if len(parts) == 1:
        return (parts[0][:2] or 'XX').upper()
    return ((parts[0][:1] + parts[-1][:1]) or 'XX').upper()


def _generar_codigo(autor: str) -> str:
    iniciales = _iniciales_autor(autor)
    res = supabase.table('obras').select('codigo').like('codigo', f'{iniciales}/N%').execute().data or []
    nums = []
    for r in res:
        m = re.search(r'/Nº?(\d+)', r.get('codigo') or '')
        if m:
            nums.append(int(m.group(1)))
    nxt = (max(nums) + 1) if nums else 1
    return f"{iniciales}/Nº{nxt:03d}"


def _validar_obra(p: dict) -> dict:
    if p.get('genero') and p['genero'] not in GENERO_VALIDOS:
        raise HTTPException(status_code=400, detail=f"genero inválido. Usa uno de {GENERO_VALIDOS}")
    if p.get('procedencia') and p['procedencia'] not in PROCEDENCIAS_VALIDAS:
        raise HTTPException(status_code=400, detail=f"procedencia inválida. Usa uno de {PROCEDENCIAS_VALIDAS}")
    return p


# ============================================================
# CATÁLOGO
# ============================================================
@router.get("/obras")
async def listar_obras(
    q: Optional[str] = None,
    genero: Optional[str] = None,
    procedencia: Optional[str] = None,
    estado: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    """Lista obras del catálogo con filtros opcionales."""
    sel = supabase.table('obras').select('*').order('autor').limit(2000)
    if genero:
        sel = sel.eq('genero', genero)
    if procedencia:
        sel = sel.eq('procedencia', procedencia)
    if estado:
        sel = sel.eq('estado', estado)
    obras = sel.execute().data or []
    if q:
        ql = q.lower()
        obras = [
            o for o in obras
            if ql in (o.get('titulo') or '').lower()
            or ql in (o.get('autor') or '').lower()
            or ql in (o.get('codigo') or '').lower()
        ]
    return {"obras": obras, "total": len(obras)}


@router.post("/obras")
async def crear_obra(data: ObraIn, current_user: dict = Depends(get_current_gestor)):
    payload = data.model_dump(exclude_none=True)
    # Normalizar strings vacías a None para no violar CHECK constraints
    for k in ('genero', 'procedencia', 'arreglista', 'co_autor', 'movimiento',
              'subgenero', 'fecha_registro', 'observaciones'):
        if k in payload and (payload[k] is None or str(payload[k]).strip() == ''):
            payload.pop(k, None)
    payload = _validar_obra(payload)
    if not payload.get('codigo'):
        payload['codigo'] = _generar_codigo(payload['autor'])
    res = supabase.table('obras').insert(payload).execute()
    obra = (res.data or [None])[0]
    # Crear filas de obra_originales por defecto
    if obra:
        for tipo in ('general', 'partes', 'arcos'):
            try:
                supabase.table('obra_originales').insert({"obra_id": obra['id'], "tipo": tipo, "estado": 'no'}).execute()
            except Exception:
                pass
    return {"obra": obra}


@router.get("/obras/{obra_id}")
async def detalle_obra(obra_id: str, current_user: dict = Depends(get_current_gestor)):
    o = supabase.table('obras').select('*').eq('id', obra_id).limit(1).execute().data or []
    if not o:
        raise HTTPException(status_code=404, detail="Obra no encontrada")
    originales = supabase.table('obra_originales').select('*').eq('obra_id', obra_id).execute().data or []
    partes = supabase.table('obra_partes').select('*').eq('obra_id', obra_id).execute().data or []
    prestamos = supabase.table('obra_prestamos').select('*').eq('obra_id', obra_id) \
        .order('fecha_salida', desc=True).execute().data or []
    eventos = supabase.table('evento_obras').select('*, evento:eventos(id,nombre,fecha_inicio,estado)') \
        .eq('obra_id', obra_id).execute().data or []
    return {"obra": o[0], "originales": originales, "partes": partes, "prestamos": prestamos, "eventos": eventos}


@router.put("/obras/{obra_id}")
async def actualizar_obra(obra_id: str, data: ObraIn, current_user: dict = Depends(get_current_gestor)):
    payload = _validar_obra(data.model_dump(exclude_none=True))
    payload['updated_at'] = datetime.now().isoformat()
    supabase.table('obras').update(payload).eq('id', obra_id).execute()
    # Actualizar originales si vienen
    return {"ok": True}


@router.put("/obras/{obra_id}/originales")
async def actualizar_originales(obra_id: str, data: List[OriginalPayload], current_user: dict = Depends(get_current_gestor)):
    for o in data:
        existing = supabase.table('obra_originales').select('id').eq('obra_id', obra_id).eq('tipo', o.tipo).limit(1).execute().data or []
        payload = {"obra_id": obra_id, "tipo": o.tipo, "estado": o.estado, "notas": o.notas}
        if existing:
            supabase.table('obra_originales').update(payload).eq('id', existing[0]['id']).execute()
        else:
            supabase.table('obra_originales').insert(payload).execute()
    return {"ok": True}


@router.put("/obras/{obra_id}/partes")
async def actualizar_partes(obra_id: str, data: List[PartePayload], current_user: dict = Depends(get_current_gestor)):
    """Reemplaza todas las partes de una obra. Insert/update por papel."""
    existentes = supabase.table('obra_partes').select('id,papel').eq('obra_id', obra_id).execute().data or []
    by_papel = {r['papel']: r['id'] for r in existentes}
    for p in data:
        meta = PAPELES_ARCHIVO.get(p.papel)
        if not meta:
            continue
        payload = {
            "obra_id": obra_id,
            "papel": p.papel,
            "instrumento": meta['instrumento'],
            "seccion": meta['seccion'],
            "copias_fisicas": p.copias_fisicas or 0,
            "copia_digital": bool(p.copia_digital),
            "enlace_drive": p.enlace_drive,
            "estado": p.estado or 'pendiente',
            "notas": p.notas,
        }
        if p.papel in by_papel:
            supabase.table('obra_partes').update(payload).eq('id', by_papel[p.papel]).execute()
        else:
            supabase.table('obra_partes').insert(payload).execute()
    return {"ok": True, "total": len(data)}


# ============================================================
# Bloque 3 — Cálculo de atriles
# ============================================================
def _instrumento_canon(s: str) -> str:
    if not s:
        return ''
    return INSTRUMENTO_A_SECCION.__class__  # placeholder


def calcular_atriles_necesarios(obra_id: str, evento_id: str) -> Dict[str, Any]:
    """Calcula cuántos atriles físicos se necesitan por papel y compara con copias_fisicas.
    Devuelve {atriles: {papel: necesarios}, alertas: [{papel, necesarios, copias, deficit}]}.
    """
    # 1. Músicos confirmados del evento
    asigs = supabase.table('asignaciones').select('usuario_id,estado') \
        .eq('evento_id', evento_id).eq('estado', 'confirmado').execute().data or []
    user_ids = list({a['usuario_id'] for a in asigs if a.get('usuario_id')})
    cnt_por_instrumento: Dict[str, int] = {}
    if user_ids:
        users = supabase.table('usuarios').select('id,instrumento').in_('id', user_ids).execute().data or []
        for u in users:
            instr = (u.get('instrumento') or '').strip().lower()
            instr = INSTRUMENTO_A_SECCION_KEY_NORM(instr)
            if instr:
                cnt_por_instrumento[instr] = cnt_por_instrumento.get(instr, 0) + 1

    atriles: Dict[str, int] = {}

    # 2. Reglas de cuerda (excepto contrabajo): ceil(N/2)
    cuerda_pares = {'violin_1': 'violin', 'violin_2': 'violin', 'viola': 'viola', 'violonchelo': 'violonchelo'}
    for papel, instr_key in cuerda_pares.items():
        if papel in ('violin_1', 'violin_2'):
            # Violín se reparte: half a violin_1, half a violin_2
            n = cnt_por_instrumento.get('violin', 0)
            half = math.ceil(n / 2) if n > 0 else 0
            # Para 1ª y 2ª: cada una asume mitad y atriles = ceil(mitad/2)
            atriles[papel] = max(1, math.ceil((n / 2) / 2)) if n > 0 else 0
        else:
            n = cnt_por_instrumento.get(instr_key, 0)
            atriles[papel] = math.ceil(n / 2) if n > 0 else 0

    # Contrabajo: 1 atril si hay >= 1
    atriles['contrabajo'] = 1 if cnt_por_instrumento.get('contrabajo', 0) > 0 else 0

    # 3. Trompa: regla especial 1_3 / 2_4
    n_trompa = cnt_por_instrumento.get('trompa', 0)
    atriles['trompa_1_3'] = 1 if n_trompa >= 1 else 0
    atriles['trompa_2_4'] = 1 if n_trompa >= 2 else 0

    # 4. Viento madera: 1ª y 2ª
    for instr_key in ('flauta', 'oboe', 'clarinete', 'fagot'):
        n = cnt_por_instrumento.get(instr_key, 0)
        atriles[f'{instr_key}_1'] = 1 if n >= 1 else 0
        atriles[f'{instr_key}_2'] = 1 if n >= 2 else 0

    # Trompeta y Trombón: 4 papeles
    for instr_key, base in (('trompeta', 'trompeta'), ('trombon', 'trombón')):
        n = cnt_por_instrumento.get(instr_key, 0)
        for i in range(1, 5):
            atriles[f'{base}_{i}'] = 1 if n >= i else 0

    # Tuba
    atriles['tuba'] = 1 if cnt_por_instrumento.get('tuba', 0) > 0 else 0

    # Percusión y coro: 1 por papel si hay al menos 1 músico de la sección/instrumento
    n_perc = cnt_por_instrumento.get('percusion', 0) + cnt_por_instrumento.get('timbales', 0)
    atriles['timbales'] = 1 if cnt_por_instrumento.get('timbales', 0) > 0 else 0
    atriles['bombo'] = 1 if n_perc > 0 else 0
    atriles['caja'] = 1 if n_perc >= 1 else 0
    for i in range(1, 4):
        atriles[f'percusion_{i}'] = 1 if n_perc >= i else 0
    atriles['laminas'] = 1 if n_perc >= 1 else 0

    for voz in ('soprano', 'alto', 'tenor', 'baritono'):
        atriles[voz] = 1 if cnt_por_instrumento.get(voz, 0) > 0 else 0

    for tecla in ('piano', 'organo', 'clave'):
        atriles[tecla] = 1 if cnt_por_instrumento.get(tecla, 0) > 0 else 0

    # 5. Comparar con copias_fisicas
    partes_obra = supabase.table('obra_partes').select('papel,copias_fisicas').eq('obra_id', obra_id).execute().data or []
    by_papel = {p['papel']: int(p.get('copias_fisicas') or 0) for p in partes_obra}
    alertas = []
    for papel, necesarios in atriles.items():
        if necesarios <= 0:
            continue
        copias = by_papel.get(papel, 0)
        if copias < necesarios:
            alertas.append({
                "papel": papel,
                "label": (PAPELES_ARCHIVO.get(papel) or {}).get('label') or papel,
                "necesarios": necesarios,
                "copias": copias,
                "deficit": necesarios - copias,
            })

    return {
        "atriles": atriles,
        "alertas": alertas,
        "musicos_por_instrumento": cnt_por_instrumento,
    }


def INSTRUMENTO_A_SECCION_KEY_NORM(s: str) -> str:
    """Normaliza un instrumento de 'usuarios.instrumento' a la clave usada en PAPELES_ARCHIVO."""
    s = (s or '').strip().lower()
    # Quitar acentos para matching tolerante
    s_na = _strip_accents(s)
    table = {
        'violin': 'violin', 'violines': 'violin',
        'viola': 'viola', 'violas': 'viola',
        'cello': 'violonchelo', 'chelo': 'violonchelo', 'violonchelo': 'violonchelo', 'violoncello': 'violonchelo',
        'contrabajo': 'contrabajo', 'contrabajos': 'contrabajo',
        'flauta': 'flauta', 'flauta travesera': 'flauta', 'flautin': 'flauta',
        'oboe': 'oboe', 'corno ingles': 'oboe',
        'clarinete': 'clarinete', 'clarinete bajo': 'clarinete',
        'fagot': 'fagot', 'contrafagot': 'fagot',
        'trompa': 'trompa', 'corno': 'trompa',
        'trompeta': 'trompeta',
        'trombon': 'trombon',
        'tuba': 'tuba',
        'percusion': 'percusion', 'timbales': 'timbales',
        'piano': 'piano', 'organo': 'organo', 'clave': 'clave',
        'soprano': 'soprano', 'alto': 'alto', 'tenor': 'tenor',
        'baritono': 'baritono',
    }
    return table.get(s_na, s_na)


@router.get("/obras/{obra_id}/atriles-evento/{evento_id}")
async def atriles_evento(obra_id: str, evento_id: str, current_user: dict = Depends(get_current_gestor)):
    return calcular_atriles_necesarios(obra_id, evento_id)


# ============================================================
# Bloque 5 — Importación masiva + plantilla
# ============================================================
@router.get("/plantilla-obras")
async def descargar_plantilla(current_user: dict = Depends(get_current_gestor)):
    """Genera y devuelve un Excel plantilla para importar obras."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl no instalado")
    wb = Workbook()
    ws = wb.active
    ws.title = "Obras"
    headers = [
        'autor', 'arreglista', 'co_autor', 'titulo', 'movimiento', 'genero', 'subgenero',
        'procedencia', 'fecha_registro', 'original_general', 'original_partes', 'original_arcos',
        'enlace_digital', 'observaciones',
    ]
    ws.append(headers)
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor='1F2937')
        c.alignment = Alignment(horizontal='center')
    for col in range(1, len(headers) + 1):
        ws.column_dimensions[ws.cell(row=1, column=col).column_letter].width = 18
    # Hoja instrucciones
    inst = wb.create_sheet('INSTRUCCIONES')
    inst['A1'] = 'INSTRUCCIONES DE IMPORTACIÓN'
    inst['A1'].font = Font(bold=True, size=14)
    rows = [
        ('autor (obligatorio)', 'Texto. Ej: "Mozart, Wolfgang Amadeus"'),
        ('titulo (obligatorio)', 'Texto. Ej: "Sinfonía nº 40"'),
        ('genero', f"Uno de: {', '.join(GENERO_VALIDOS)}"),
        ('procedencia', f"Uno de: {', '.join(PROCEDENCIAS_VALIDAS)}"),
        ('fecha_registro', 'Formato YYYY-MM-DD. Opcional'),
        ('original_general/partes/arcos', "Uno de: si, no, necesita_revision"),
        ('enlace_digital', 'URL del archivo en Google Drive (opcional)'),
        ('código', 'Se genera automáticamente con formato XX/Nº001'),
    ]
    for i, (k, v) in enumerate(rows, start=3):
        inst.cell(row=i, column=1, value=k).font = Font(bold=True)
        inst.cell(row=i, column=2, value=v)
    inst.column_dimensions['A'].width = 30
    inst.column_dimensions['B'].width = 80

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=plantilla_obras.xlsx'},
    )


def _norm_estado_original(v: Any) -> str:
    s = (str(v or '').strip().lower())
    if s in ('si', 'sí', 'yes', 'true', '1'):
        return 'si'
    if s in ('necesita revision', 'necesita_revision', 'needs review', 'revisar', 'revision'):
        return 'necesita_revision'
    return 'no'


@router.post("/obras/importar")
async def importar_obras(
    archivo: UploadFile = File(...),
    confirmar: bool = False,
    current_user: dict = Depends(get_current_gestor),
):
    """Importa obras desde Excel. Si confirmar=False, devuelve solo preview + validación."""
    try:
        from openpyxl import load_workbook
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl no instalado")
    raw = await archivo.read()
    try:
        wb = load_workbook(io.BytesIO(raw), data_only=True)
        ws = wb.active
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Excel inválido: {e}")
    headers = [str(c.value or '').strip() for c in ws[1]]
    rows: List[dict] = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not any(row):
            continue
        rows.append(dict(zip(headers, row)))

    obras_existentes = supabase.table('obras').select('autor,titulo').execute().data or []
    existentes_set = {(o.get('autor', '').strip().lower(), o.get('titulo', '').strip().lower()) for o in obras_existentes}

    preview, errors, ya_existen = [], [], 0
    for idx, r in enumerate(rows, start=2):
        autor = (r.get('autor') or '').strip()
        titulo = (r.get('titulo') or '').strip()
        if not autor or not titulo:
            errors.append({"fila": idx, "error": "Falta autor o titulo"})
            continue
        if (autor.lower(), titulo.lower()) in existentes_set:
            ya_existen += 1
            continue
        genero = (r.get('genero') or '').strip() or None
        if genero and genero not in GENERO_VALIDOS:
            errors.append({"fila": idx, "error": f"genero inválido '{genero}'"})
            continue
        procedencia = (r.get('procedencia') or '').strip() or None
        if procedencia and procedencia not in PROCEDENCIAS_VALIDAS:
            errors.append({"fila": idx, "error": f"procedencia inválida '{procedencia}'"})
            continue
        fecha_reg = r.get('fecha_registro')
        if fecha_reg and hasattr(fecha_reg, 'strftime'):
            fecha_reg = fecha_reg.strftime('%Y-%m-%d')
        elif fecha_reg:
            fecha_reg = str(fecha_reg)
        preview.append({
            "fila": idx,
            "autor": autor,
            "arreglista": (r.get('arreglista') or '').strip() or None,
            "co_autor": (r.get('co_autor') or '').strip() or None,
            "titulo": titulo,
            "movimiento": (r.get('movimiento') or '').strip() or None,
            "genero": genero,
            "subgenero": (r.get('subgenero') or '').strip() or None,
            "procedencia": procedencia,
            "fecha_registro": fecha_reg,
            "observaciones": (r.get('observaciones') or '').strip() or None,
            "_originales": {
                'general': _norm_estado_original(r.get('original_general')),
                'partes':  _norm_estado_original(r.get('original_partes')),
                'arcos':   _norm_estado_original(r.get('original_arcos')),
            },
            "_enlace_digital": (r.get('enlace_digital') or '').strip() or None,
        })

    if not confirmar:
        return {
            "preview": preview[:5],
            "total": len(preview),
            "errores": errors,
            "ya_existentes": ya_existen,
        }

    # Insertar
    insertadas = 0
    for p in preview:
        originales_data = p.pop('_originales', {})
        enlace = p.pop('_enlace_digital', None)
        p.pop('fila', None)
        p['codigo'] = _generar_codigo(p['autor'])
        try:
            res = supabase.table('obras').insert(p).execute()
            obra_id = res.data[0]['id'] if res.data else None
            if obra_id:
                for tipo, est in originales_data.items():
                    supabase.table('obra_originales').insert({
                        "obra_id": obra_id, "tipo": tipo, "estado": est,
                    }).execute()
                if enlace:
                    supabase.table('obras').update({"observaciones": (p.get('observaciones') or '') + f" | Drive: {enlace}"}).eq('id', obra_id).execute()
            insertadas += 1
        except Exception as e:
            errors.append({"autor": p['autor'], "titulo": p['titulo'], "error": str(e)})
    return {"importadas": insertadas, "errores": errors, "ya_existentes": ya_existen}


# ============================================================
# Bloque 6 — Etiquetas PDF
# ============================================================
@router.post("/obras/{obra_id}/etiquetas")
async def generar_etiquetas(obra_id: str, req: EtiquetasReq, current_user: dict = Depends(get_current_gestor)):
    """Genera un PDF con etiquetas según los tipos seleccionados."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import mm
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab no instalado")

    obra = supabase.table('obras').select('*').eq('id', obra_id).limit(1).execute().data or []
    if not obra:
        raise HTTPException(status_code=404, detail="Obra no encontrada")
    obra = obra[0]
    partes = supabase.table('obra_partes').select('*').eq('obra_id', obra_id).execute().data or []

    etiquetas: List[str] = []
    if req.incluye_general:       etiquetas.append('Copia ORIGINAL — General')
    if req.incluye_partes:        etiquetas.extend(['Copia ORIGINAL — Partes'] * len(partes) or ['Copia ORIGINAL — Partes'])
    if req.incluye_arcos:         etiquetas.append('Copia ORIGINAL — Arcos de cuerda')
    if req.incluye_documentacion: etiquetas.append('Documentación de registro')
    if req.incluye_atriles:
        for p in partes:
            n = int(p.get('copias_fisicas') or 0)
            if n > 0:
                label = (PAPELES_ARCHIVO.get(p['papel']) or {}).get('label') or p['papel']
                etiquetas.extend([f'ATRIL — {label}'] * n)
    if req.incluye_atril_coro:      etiquetas.append('ATRIL — Coro')
    if req.incluye_atril_cuerda:    etiquetas.append('ATRIL — Cuerda')
    if req.incluye_atril_viento:    etiquetas.append('ATRIL — Viento')
    if req.incluye_atril_percusion: etiquetas.append('ATRIL — Percusión')

    if not etiquetas:
        raise HTTPException(status_code=400, detail="Selecciona al menos un tipo de etiqueta")

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    margin = 12 * mm
    cols, lbl_w, lbl_h = 2, (width - 2 * margin - 6 * mm) / 2, 50 * mm
    rows_per_page = int((height - 2 * margin) // lbl_h)

    for idx, txt in enumerate(etiquetas):
        i = idx % (cols * rows_per_page)
        if idx > 0 and i == 0:
            c.showPage()
        col = i % cols
        row = i // cols
        x = margin + col * (lbl_w + 6 * mm)
        y = height - margin - (row + 1) * lbl_h
        # Borde
        c.rect(x, y, lbl_w, lbl_h)
        # Contenido
        c.setFont('Helvetica', 9)
        c.drawString(x + 4 * mm, y + lbl_h - 8 * mm, f"AUTOR: {obra.get('autor', '')[:40]}")
        c.setFont('Helvetica-Bold', 11)
        c.drawString(x + 4 * mm, y + lbl_h - 16 * mm, f"TÍTULO: {obra.get('titulo', '')[:36]}")
        c.setFont('Helvetica', 7)
        c.line(x + 4 * mm, y + lbl_h - 20 * mm, x + lbl_w - 4 * mm, y + lbl_h - 20 * mm)
        c.drawString(x + 4 * mm, y + lbl_h - 25 * mm, f"CÓDIGO: {obra.get('codigo', '')}")
        c.drawString(x + lbl_w / 2, y + lbl_h - 25 * mm, f"GÉNERO: {obra.get('genero') or '—'}")
        c.setFont('Helvetica-Bold', 10)
        c.drawCentredString(x + lbl_w / 2, y + 6 * mm, txt)
    c.save()
    buf.seek(0)
    fn = f"etiquetas_{(obra.get('codigo') or 'obra').replace('/', '_')}.pdf"
    return StreamingResponse(buf, media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename={fn}'})


# ============================================================
# PRÉSTAMOS
# ============================================================
@router.get("/prestamos")
async def listar_prestamos(estado: Optional[str] = None, tipo: Optional[str] = None,
                            current_user: dict = Depends(get_current_gestor)):
    sel = supabase.table('obra_prestamos') \
        .select('*, obra:obras(id,codigo,titulo,autor), evento:eventos(id,nombre,fecha_inicio)') \
        .order('fecha_prevista_devolucion', desc=False)
    if estado:
        sel = sel.eq('estado', estado)
    if tipo:
        sel = sel.eq('tipo', tipo)
    data = sel.execute().data or []
    return {"prestamos": data}


@router.post("/prestamos")
async def crear_prestamo(data: PrestamoIn, current_user: dict = Depends(get_current_gestor)):
    payload = data.model_dump(exclude_none=True)
    payload['gestor_id'] = (current_user.get('profile') or {}).get('id')
    res = supabase.table('obra_prestamos').insert(payload).execute()
    return {"prestamo": (res.data or [None])[0]}


@router.put("/prestamos/{prestamo_id}")
async def actualizar_prestamo(prestamo_id: str, data: PrestamoUpdate,
                                current_user: dict = Depends(get_current_gestor)):
    payload = data.model_dump(exclude_none=True)
    payload['updated_at'] = datetime.now().isoformat()
    supabase.table('obra_prestamos').update(payload).eq('id', prestamo_id).execute()
    return {"ok": True}


# ============================================================
# Bloque 4 — Alertas dashboard
# ============================================================
@router.get("/alertas")
async def alertas_archivo(current_user: dict = Depends(get_current_gestor)):
    hoy = datetime.now().date().isoformat()
    en_7 = (datetime.now().date() + (datetime.now().date().resolution * 0)).isoformat()  # Always now
    # Pendientes de registrar
    obras_provisionales = supabase.table('evento_obras') \
        .select('*, evento:eventos(id,nombre,fecha_inicio)') \
        .eq('estado', 'provisional').execute().data or []
    # Préstamos vencidos / próximos
    prestamos_act = supabase.table('obra_prestamos') \
        .select('*, obra:obras(id,codigo,titulo,autor)') \
        .eq('estado', 'activo').execute().data or []
    vencidos, proximos = [], []
    from datetime import date, timedelta
    today = date.today()
    for p in prestamos_act:
        fp = p.get('fecha_prevista_devolucion')
        if not fp:
            continue
        try:
            d = date.fromisoformat(fp)
        except Exception:
            continue
        if d < today:
            vencidos.append(p)
        elif (d - today).days <= 7:
            proximos.append(p)
    # Material incompleto: partes con estado='incompleto'
    incompletas = supabase.table('obra_partes') \
        .select('obra_id,papel,copias_fisicas,estado') \
        .eq('estado', 'incompleto').execute().data or []
    return {
        "obras_pendientes_registro": obras_provisionales,
        "prestamos_vencidos": vencidos,
        "prestamos_proximos": proximos,
        "partes_incompletas": incompletas,
    }


# ============================================================
# Bloque 7 — Programa del evento (vinculación con catálogo)
# ============================================================
@router.get("/evento/{evento_id}/programa")
async def programa_evento(evento_id: str, current_user: dict = Depends(get_current_gestor)):
    rows = supabase.table('evento_obras') \
        .select('*, obra:obras(id,codigo,titulo,autor,genero)') \
        .eq('evento_id', evento_id).order('orden_programa').execute().data or []
    return {"programa": rows}


@router.post("/evento/{evento_id}/obras")
async def agregar_obra_evento(evento_id: str, data: EventoObraIn, current_user: dict = Depends(get_current_gestor)):
    """Vincula una obra al programa de un evento.
    Si se pasa solo `titulo_provisional`, se busca match en obras y, si no existe,
    se crea como provisional + notificación a archiveros.
    """
    payload = data.model_dump(exclude_none=True)
    payload['evento_id'] = evento_id
    if not payload.get('obra_id') and payload.get('titulo_provisional'):
        # Match por título exacto
        candidato = supabase.table('obras').select('id,titulo,autor') \
            .ilike('titulo', payload['titulo_provisional'].strip()).limit(1).execute().data or []
        if candidato:
            payload['obra_id'] = candidato[0]['id']
            payload['estado'] = 'confirmada'
            payload.pop('titulo_provisional', None)
        else:
            payload['estado'] = 'provisional'
    res = supabase.table('evento_obras').insert(payload).execute()
    eo = (res.data or [None])[0]

    # Notificar a archiveros si la obra es provisional
    if eo and eo.get('estado') == 'provisional':
        try:
            evt = supabase.table('eventos').select('nombre').eq('id', evento_id).limit(1).execute().data or []
            evt_nombre = evt[0]['nombre'] if evt else 'Evento'
            archiveros = supabase.table('usuarios').select('id').eq('rol', 'archivero').execute().data or []
            for a in archiveros:
                supabase.table('notificaciones_gestor').insert({
                    "gestor_id": a['id'],
                    "tipo": "obra_pendiente_registro",
                    "titulo": f"Nueva obra pendiente: {eo.get('titulo_provisional')}",
                    "descripcion": f"Solicitada para evento: {evt_nombre}",
                    "entidad_tipo": "evento_obra",
                    "entidad_id": eo['id'],
                    "leida": False,
                }).execute()
        except Exception:
            pass
    return {"evento_obra": eo}
