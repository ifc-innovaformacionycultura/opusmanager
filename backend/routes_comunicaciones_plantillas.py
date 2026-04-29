"""Centro de Comunicaciones — Plantillas block-based + render HTML + assets.

Endpoints:
- GET    /api/comunicaciones/plantillas       — listar
- POST   /api/comunicaciones/plantillas       — crear (opcional preset)
- GET    /api/comunicaciones/plantillas/{id}  — leer
- PUT    /api/comunicaciones/plantillas/{id}  — actualizar
- DELETE /api/comunicaciones/plantillas/{id}  — eliminar
- POST   /api/comunicaciones/plantillas/{id}/preview  — render HTML con variables de prueba
- GET    /api/comunicaciones/presets          — listar presets disponibles
- POST   /api/comunicaciones/assets/upload    — subir imagen/logo/font (multipart)
- POST   /api/comunicaciones/assets/external  — registrar URL externa
- GET    /api/comunicaciones/assets           — listar assets
"""
import os
import uuid as _uuid
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api/comunicaciones", tags=["comunicaciones"])

BUCKET = "comunicaciones"

ALLOWED_IMG_MIMES = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"}
ALLOWED_FONT_MIMES = {"font/woff", "font/woff2", "font/ttf", "font/otf",
                      "application/font-woff", "application/font-woff2",
                      "application/octet-stream"}  # algunos navegadores no setean mime de font


# ============ Presets ============

def _preset_ifc_corporate() -> Dict[str, Any]:
    return {
        "ajustes_globales": {
            "logo_url": "",
            "font_family": "Georgia, 'Times New Roman', serif",
            "font_url": "",
            "color_primario": "#1e293b",
            "color_secundario": "#d4af37",
            "color_fondo": "#f1f5f9",
            "color_texto": "#0f172a",
            "ancho_max": 600,
            "padding": 32,
        },
        "bloques": [
            {"id": "b-h", "tipo": "cabecera", "props": {
                "titulo": "IFC · OPUS MANAGER",
                "subtitulo": "Comunicación oficial",
                "alineacion": "left",
                "estilo": "navy_gold",
            }},
            {"id": "b-t1", "tipo": "texto", "props": {
                "html": "<p>Estimado/a <strong>{nombre_destinatario}</strong>,</p><p>Le escribimos desde la dirección de la orquesta para informarle sobre <strong>{evento}</strong>.</p>"
            }},
            {"id": "b-cta", "tipo": "boton", "props": {
                "label": "Acceder al portal", "url": "{portal_url}",
                "color": "#1e293b", "texto_color": "#ffffff",
            }},
            {"id": "b-p", "tipo": "pie", "props": {
                "texto": "IFC OPUS MANAGER · Sistema de gestión orquestal",
                "estilo": "navy_gold",
            }},
        ],
    }


def _preset_editorial_minimal() -> Dict[str, Any]:
    return {
        "ajustes_globales": {
            "logo_url": "",
            "font_family": "'Helvetica Neue', Helvetica, Arial, sans-serif",
            "font_url": "",
            "color_primario": "#0f172a",
            "color_secundario": "#475569",
            "color_fondo": "#ffffff",
            "color_texto": "#1e293b",
            "ancho_max": 580,
            "padding": 40,
        },
        "bloques": [
            {"id": "b-h", "tipo": "cabecera", "props": {
                "titulo": "BOLETÍN", "subtitulo": "Edición {fecha_proxima}",
                "alineacion": "left", "estilo": "minimal",
            }},
            {"id": "b-sep", "tipo": "separador", "props": {"color": "#0f172a", "grosor": 2}},
            {"id": "b-t1", "tipo": "texto", "props": {
                "html": "<h2 style=\"margin:0 0 12px;font-size:22px\">Hola {nombre_destinatario}</h2><p>Este es nuestro último boletín con las novedades de la temporada.</p>"
            }},
            {"id": "b-img", "tipo": "imagen", "props": {"url": "", "alt": "Imagen destacada", "ancho": 580}},
            {"id": "b-t2", "tipo": "texto", "props": {
                "html": "<p>Próximo concierto: <strong>{evento}</strong> el {fecha_proxima} en {lugar}.</p>"
            }},
            {"id": "b-p", "tipo": "pie", "props": {
                "texto": "Para darte de baja responde a este correo.",
                "estilo": "minimal",
            }},
        ],
    }


def _preset_festival_warm() -> Dict[str, Any]:
    return {
        "ajustes_globales": {
            "logo_url": "",
            "font_family": "'Trebuchet MS', 'Lucida Sans Unicode', sans-serif",
            "font_url": "",
            "color_primario": "#b45309",
            "color_secundario": "#fbbf24",
            "color_fondo": "#fef3c7",
            "color_texto": "#1c1917",
            "ancho_max": 620,
            "padding": 28,
        },
        "bloques": [
            {"id": "b-h", "tipo": "cabecera", "props": {
                "titulo": "🎶  Festival OPUS  🎶",
                "subtitulo": "¡Te queremos en escena!",
                "alineacion": "center",
                "estilo": "festival",
            }},
            {"id": "b-cita", "tipo": "cita", "props": {
                "texto": "La música es el lenguaje universal de la humanidad.",
                "autor": "Henry Wadsworth Longfellow",
            }},
            {"id": "b-t1", "tipo": "texto", "props": {
                "html": "<p>Querido/a <strong>{nombre_destinatario}</strong>, estamos preparando algo grande para ti. Tu instrumento <em>{instrumento}</em> es clave en {evento}.</p>"
            }},
            {"id": "b-cta", "tipo": "boton", "props": {
                "label": "Confirmar mi participación", "url": "{portal_url}",
                "color": "#b45309", "texto_color": "#ffffff",
            }},
            {"id": "b-rs", "tipo": "redes_sociales", "props": {
                "instagram": "", "facebook": "", "twitter": "", "youtube": "",
            }},
            {"id": "b-p", "tipo": "pie", "props": {
                "texto": "¡Nos vemos en el escenario!", "estilo": "festival",
            }},
        ],
    }


PRESETS = {
    "ifc_corporate": {"nombre": "🏛️ IFC Corporate", "data": _preset_ifc_corporate},
    "editorial_minimal": {"nombre": "📰 Editorial Minimal", "data": _preset_editorial_minimal},
    "festival_warm": {"nombre": "🎉 Festival Warm", "data": _preset_festival_warm},
}


@router.get("/presets")
async def listar_presets(current_user: dict = Depends(get_current_gestor)):
    return {"presets": [{"key": k, "nombre": v["nombre"]} for k, v in PRESETS.items()]}


# ============ Modelos ============

class PlantillaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    asunto_default: Optional[str] = ""
    tema_preset: Optional[str] = "ifc_corporate"
    desde_preset: bool = True  # si True, copia bloques+ajustes del preset
    ajustes_globales: Optional[Dict[str, Any]] = None
    bloques: Optional[List[Dict[str, Any]]] = None
    estado: Optional[str] = "borrador"


class PlantillaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    asunto_default: Optional[str] = None
    tema_preset: Optional[str] = None
    ajustes_globales: Optional[Dict[str, Any]] = None
    bloques: Optional[List[Dict[str, Any]]] = None
    estado: Optional[str] = None


class PreviewBody(BaseModel):
    variables: Optional[Dict[str, str]] = None


class AssetExterno(BaseModel):
    url: str
    tipo: str  # imagen|logo|font
    filename: Optional[str] = None


# ============ CRUD ============

def _gestor_nombre(current_user) -> tuple:
    profile = current_user.get('profile') or {}
    nombre = f"{profile.get('nombre','') or ''} {profile.get('apellidos','') or ''}".strip() or profile.get('email') or 'Gestor'
    return profile.get('id'), nombre


@router.get("/plantillas")
async def listar_plantillas(current_user: dict = Depends(get_current_gestor)):
    try:
        rows = supabase.table('comunicaciones_plantillas').select(
            'id,nombre,descripcion,tema_preset,asunto_default,estado,creado_por_nombre,updated_at,created_at'
        ).order('updated_at', desc=True).execute().data or []
        return {"plantillas": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/plantillas")
async def crear_plantilla(data: PlantillaCreate, current_user: dict = Depends(get_current_gestor)):
    if not data.nombre or not data.nombre.strip():
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    preset_key = data.tema_preset or 'ifc_corporate'
    preset = PRESETS.get(preset_key)
    base = preset["data"]() if (preset and data.desde_preset) else {"ajustes_globales": {}, "bloques": []}
    payload = {
        "nombre": data.nombre.strip(),
        "descripcion": data.descripcion or "",
        "asunto_default": data.asunto_default or "",
        "tema_preset": preset_key,
        "ajustes_globales": data.ajustes_globales or base.get("ajustes_globales", {}),
        "bloques": data.bloques if data.bloques is not None else base.get("bloques", []),
        "estado": data.estado or "borrador",
    }
    gid, gname = _gestor_nombre(current_user)
    payload["creado_por"] = gid
    payload["creado_por_nombre"] = gname
    try:
        r = supabase.table('comunicaciones_plantillas').insert(payload).execute()
        return {"plantilla": r.data[0] if r.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/plantillas/{plantilla_id}")
async def obtener_plantilla(plantilla_id: str, current_user: dict = Depends(get_current_gestor)):
    try:
        r = supabase.table('comunicaciones_plantillas').select('*') \
            .eq('id', plantilla_id).single().execute()
        return {"plantilla": r.data}
    except Exception:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")


@router.put("/plantillas/{plantilla_id}")
async def actualizar_plantilla(plantilla_id: str, data: PlantillaUpdate, current_user: dict = Depends(get_current_gestor)):
    payload = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        r = supabase.table('comunicaciones_plantillas').update(payload).eq('id', plantilla_id).execute()
        return {"plantilla": r.data[0] if r.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/plantillas/{plantilla_id}")
async def eliminar_plantilla(plantilla_id: str, current_user: dict = Depends(get_current_gestor)):
    try:
        supabase.table('comunicaciones_plantillas').delete().eq('id', plantilla_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Render HTML server-side ============

def _esc(s: Any) -> str:
    if s is None:
        return ""
    return (str(s)
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def _replace_vars(text: str, vars_: Dict[str, str]) -> str:
    if not text:
        return ""
    def repl(m):
        k = m.group(1)
        return str(vars_.get(k, m.group(0)))
    return re.sub(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}", repl, text)


def render_block(b: Dict, g: Dict, v: Dict) -> str:
    tipo = b.get("tipo")
    p = b.get("props") or {}
    color_primario = g.get("color_primario", "#1e293b")
    color_secundario = g.get("color_secundario", "#d4af37")
    color_texto = g.get("color_texto", "#0f172a")
    font = g.get("font_family", "Arial, sans-serif")
    pad = g.get("padding", 32)

    if tipo == "cabecera":
        estilo = p.get("estilo") or "navy_gold"
        ali = p.get("alineacion") or "left"
        titulo = _replace_vars(p.get("titulo") or "", v)
        subtitulo = _replace_vars(p.get("subtitulo") or "", v)
        logo = g.get("logo_url") or ""
        if estilo == "festival":
            bg = f"linear-gradient(135deg,{color_primario},{color_secundario})"
            text_color = "#ffffff"
            border = ""
        elif estilo == "minimal":
            bg = "#ffffff"
            text_color = color_texto
            border = f"border-bottom:2px solid {color_primario};"
        else:  # navy_gold
            bg = f"linear-gradient(90deg,{color_primario},{_lighten(color_primario)})"
            text_color = "#ffffff"
            border = f"border-bottom:3px solid {color_secundario};"
        logo_html = f'<img src="{_esc(logo)}" alt="logo" style="height:32px;display:block;margin-bottom:8px"/>' if logo else ""
        return f"""
<tr><td style="padding:{pad}px;background:{bg};{border}color:{text_color};text-align:{ali};font-family:{_esc(font)}">
  {logo_html}
  <h1 style="margin:0;font-size:24px;font-weight:bold;letter-spacing:0.5px">{_esc(titulo)}</h1>
  {f'<p style="margin:6px 0 0;font-size:13px;opacity:0.85">{_esc(subtitulo)}</p>' if subtitulo else ''}
</td></tr>"""

    if tipo == "texto":
        # `html` se pasa tal cual (admite tags básicos del editor)
        html = _replace_vars(p.get("html") or "", v)
        return f"""<tr><td style="padding:{pad//2}px {pad}px;color:{color_texto};font-family:{_esc(font)};font-size:14px;line-height:1.6">{html}</td></tr>"""

    if tipo == "imagen":
        url = _replace_vars(p.get("url") or "", v)
        alt = _esc(p.get("alt") or "")
        if not url:
            return ""
        return f"""<tr><td align="center" style="padding:{pad//2}px {pad}px"><img src="{_esc(url)}" alt="{alt}" style="max-width:100%;height:auto;border-radius:6px;display:block"/></td></tr>"""

    if tipo == "imagen_texto_2col":
        url = _replace_vars(p.get("url") or "", v)
        html = _replace_vars(p.get("html") or "", v)
        invertir = bool(p.get("invertir"))
        col_img = f'<td valign="top" width="45%" style="padding:0 16px"><img src="{_esc(url)}" alt="" style="width:100%;border-radius:6px;display:block"/></td>'
        col_txt = f'<td valign="top" width="55%" style="padding:0 16px;color:{color_texto};font-family:{_esc(font)};font-size:14px;line-height:1.6">{html}</td>'
        cells = (col_txt + col_img) if invertir else (col_img + col_txt)
        return f"""<tr><td style="padding:{pad//2}px {pad//2}px"><table width="100%" cellpadding="0" cellspacing="0"><tr>{cells}</tr></table></td></tr>"""

    if tipo == "boton":
        label = _replace_vars(p.get("label") or "Botón", v)
        url = _replace_vars(p.get("url") or "#", v)
        color = p.get("color") or color_primario
        tcolor = p.get("texto_color") or "#ffffff"
        return f"""
<tr><td align="center" style="padding:{pad//2}px {pad}px">
  <table cellpadding="0" cellspacing="0"><tr><td style="background:{_esc(color)};border-radius:8px">
    <a href="{_esc(url)}" style="display:inline-block;padding:12px 28px;color:{_esc(tcolor)};text-decoration:none;font-weight:bold;font-size:14px;font-family:{_esc(font)}">{_esc(label)}</a>
  </td></tr></table>
</td></tr>"""

    if tipo == "cita":
        texto = _replace_vars(p.get("texto") or "", v)
        autor = _esc(p.get("autor") or "")
        return f"""
<tr><td style="padding:{pad//2}px {pad}px">
  <blockquote style="margin:0;padding:14px 18px;border-left:4px solid {color_secundario};background:#f8fafc;font-family:{_esc(font)};font-style:italic;color:{color_texto}">
    "{_esc(texto)}"
    {f'<div style="font-style:normal;font-size:12px;color:#64748b;margin-top:6px">— {autor}</div>' if autor else ''}
  </blockquote>
</td></tr>"""

    if tipo == "lista":
        items = p.get("items") or []
        ordenada = bool(p.get("ordenada"))
        tag = "ol" if ordenada else "ul"
        lis = "".join(f"<li>{_esc(_replace_vars(it, v))}</li>" for it in items)
        return f"""<tr><td style="padding:{pad//2}px {pad}px;color:{color_texto};font-family:{_esc(font)};font-size:14px"><{tag}>{lis}</{tag}></td></tr>"""

    if tipo == "galeria":
        urls = (p.get("urls") or [])[:6]
        if not urls:
            return ""
        cells = "".join(
            f'<td width="33%" style="padding:4px"><img src="{_esc(u)}" style="width:100%;border-radius:4px;display:block"/></td>'
            for u in urls[:3]
        )
        row1 = f"<tr>{cells}</tr>"
        rest = urls[3:6]
        row2 = ""
        if rest:
            row2 = "<tr>" + "".join(
                f'<td width="33%" style="padding:4px"><img src="{_esc(u)}" style="width:100%;border-radius:4px;display:block"/></td>' for u in rest
            ) + "</tr>"
        return f"""<tr><td style="padding:{pad//2}px {pad//2}px"><table width="100%" cellpadding="0" cellspacing="0">{row1}{row2}</table></td></tr>"""

    if tipo == "video":
        url = _replace_vars(p.get("url") or "", v)
        thumb = _replace_vars(p.get("thumbnail") or "", v)
        if not url:
            return ""
        thumb_img = f'<img src="{_esc(thumb)}" alt="" style="width:100%;border-radius:6px;display:block"/>' if thumb else ""
        return f"""
<tr><td align="center" style="padding:{pad//2}px {pad}px">
  <a href="{_esc(url)}" style="text-decoration:none;color:{color_primario};font-weight:bold;font-family:{_esc(font)}">
    {thumb_img}
    <div style="margin-top:8px;font-size:13px">▶ Ver vídeo</div>
  </a>
</td></tr>"""

    if tipo == "redes_sociales":
        nets = []
        for k, label in [("instagram", "Instagram"), ("facebook", "Facebook"),
                         ("twitter", "Twitter / X"), ("youtube", "YouTube"),
                         ("linkedin", "LinkedIn"), ("web", "Web")]:
            href = (p.get(k) or "").strip()
            if href:
                nets.append(f'<a href="{_esc(href)}" style="margin:0 8px;color:{color_primario};text-decoration:none;font-size:12px">{label}</a>')
        if not nets:
            return ""
        return f"""<tr><td align="center" style="padding:{pad//2}px {pad}px;font-family:{_esc(font)}">{''.join(nets)}</td></tr>"""

    if tipo == "separador":
        color = p.get("color") or "#e2e8f0"
        grosor = p.get("grosor") or 1
        return f"""<tr><td style="padding:{pad//2}px {pad}px"><hr style="border:none;border-top:{grosor}px solid {_esc(color)};margin:0"/></td></tr>"""

    if tipo == "pie":
        texto = _replace_vars(p.get("texto") or "", v)
        estilo = p.get("estilo") or "navy_gold"
        if estilo == "festival":
            return f"""<tr><td style="background:{color_primario};color:#fff;padding:18px {pad}px;text-align:center;font-family:{_esc(font)};font-size:12px">{_esc(texto)}</td></tr>"""
        if estilo == "minimal":
            return f"""<tr><td style="border-top:1px solid #e2e8f0;padding:18px {pad}px;color:#64748b;font-family:{_esc(font)};font-size:11px;text-align:center">{_esc(texto)}</td></tr>"""
        return f"""<tr><td style="background:#0f172a;color:#94a3b8;padding:14px {pad}px;font-family:{_esc(font)};font-size:11px;text-align:left"><strong style="color:{color_secundario}">{_esc(texto.split('·')[0])}</strong>{('·'+texto.split('·',1)[1]) if '·' in texto else ''}</td></tr>"""

    return ""


def _lighten(hex_color: str) -> str:
    try:
        h = hex_color.lstrip('#')
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        r = min(255, r + 40); g = min(255, g + 40); b = min(255, b + 40)
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        return hex_color


def render_plantilla(plantilla: Dict, variables: Dict[str, str]) -> str:
    g = plantilla.get("ajustes_globales") or {}
    bloques = plantilla.get("bloques") or []
    ancho = g.get("ancho_max", 600)
    fondo = g.get("color_fondo", "#f1f5f9")
    font_url = g.get("font_url") or ""
    font_family = g.get("font_family", "Arial, sans-serif")
    font_face = ""
    if font_url:
        # @font-face básico — algunos clientes lo ignoran (Outlook), tendrán fallback
        font_face = f'<style>@font-face{{font-family:"CustomFont";src:url("{_esc(font_url)}");}}</style>'
    rows = "".join(render_block(b, g, variables) for b in bloques)
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>{font_face}</head>
<body style="margin:0;padding:0;background:{_esc(fondo)};font-family:{_esc(font_family)}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:{_esc(fondo)};padding:24px 0">
    <tr><td align="center">
      <table width="{int(ancho)}" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        {rows}
      </table>
    </td></tr>
  </table>
</body></html>"""


@router.post("/plantillas/{plantilla_id}/preview")
async def preview_plantilla(plantilla_id: str, body: PreviewBody, current_user: dict = Depends(get_current_gestor)):
    try:
        r = supabase.table('comunicaciones_plantillas').select('*').eq('id', plantilla_id).single().execute()
        plantilla = r.data
    except Exception:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    vars_ = body.variables or {}
    # Variables por defecto si el usuario no envía
    defaults = {
        "nombre_destinatario": "María García",
        "evento": "Concierto de Inauguración",
        "fecha_proxima": "15 mayo 2026",
        "lugar": "Auditorio Nacional",
        "instrumento": "Violín",
        "portal_url": (os.environ.get("APP_URL") or "https://opusmanager.app") + "/portal",
    }
    for k, val in defaults.items():
        vars_.setdefault(k, val)
    html = render_plantilla(plantilla, vars_)
    return {"html": html, "variables_usadas": vars_, "asunto": _replace_vars(plantilla.get("asunto_default") or "", vars_)}


# ============ Assets ============

@router.post("/assets/upload")
async def upload_asset(
    file: UploadFile = File(...),
    tipo: str = Form("imagen"),
    current_user: dict = Depends(get_current_gestor),
):
    if tipo not in ("imagen", "logo", "font"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Archivo demasiado grande (>5MB)")

    mime = file.content_type or "application/octet-stream"
    if tipo in ("imagen", "logo") and mime not in ALLOWED_IMG_MIMES:
        raise HTTPException(status_code=400, detail=f"Tipo MIME no permitido para imagen: {mime}")
    if tipo == "font" and mime not in ALLOWED_FONT_MIMES:
        raise HTTPException(status_code=400, detail=f"Tipo MIME no permitido para fuente: {mime}")

    safe_name = re.sub(r'[^A-Za-z0-9._-]', '_', file.filename or "archivo")
    fname = f"{tipo}/{_uuid.uuid4().hex}_{safe_name}"

    try:
        # Subir a Supabase Storage
        supabase.storage.from_(BUCKET).upload(
            fname, content, file_options={"content-type": mime, "upsert": "false"},
        )
        public_url = supabase.storage.from_(BUCKET).get_public_url(fname)
        # Algunos SDKs devuelven con `?` extra al final
        public_url = public_url.split('?')[0] if isinstance(public_url, str) else public_url
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error de Storage: {str(e)[:200]}")

    # Registrar metadata
    profile = current_user.get('profile') or {}
    try:
        rec = supabase.table('comunicaciones_assets').insert({
            "url": public_url,
            "storage_path": fname,
            "tipo": tipo,
            "filename": file.filename,
            "mime": mime,
            "bytes": len(content),
            "subido_por": profile.get('id'),
        }).execute()
        return {"asset": rec.data[0] if rec.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error registro asset: {str(e)[:200]}")


@router.post("/assets/external")
async def registrar_asset_externo(data: AssetExterno, current_user: dict = Depends(get_current_gestor)):
    if data.tipo not in ("imagen", "logo", "font"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    if not data.url or not data.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL inválida")
    profile = current_user.get('profile') or {}
    try:
        rec = supabase.table('comunicaciones_assets').insert({
            "url": data.url,
            "storage_path": None,
            "tipo": data.tipo,
            "filename": data.filename,
            "mime": None,
            "bytes": None,
            "subido_por": profile.get('id'),
        }).execute()
        return {"asset": rec.data[0] if rec.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assets")
async def listar_assets(
    tipo: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_gestor),
):
    try:
        q = supabase.table('comunicaciones_assets').select('*').order('created_at', desc=True).limit(min(max(limit, 1), 500))
        if tipo:
            q = q.eq('tipo', tipo)
        return {"assets": q.execute().data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/assets/{asset_id}")
async def eliminar_asset(asset_id: str, current_user: dict = Depends(get_current_gestor)):
    try:
        a = supabase.table('comunicaciones_assets').select('storage_path').eq('id', asset_id).single().execute().data
        if a and a.get('storage_path'):
            try:
                supabase.storage.from_(BUCKET).remove([a['storage_path']])
            except Exception:
                pass
        supabase.table('comunicaciones_assets').delete().eq('id', asset_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
