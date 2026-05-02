"""PDF rendering helper basado en ReportLab (puro Python).

Reemplaza la antigua dependencia de WeasyPrint para evitar requerir librerías
del sistema (pango/cairo/gobject) en entornos como Railway.

La API pública se mantiene intacta para que ``routes_documentos.py`` no cambie:
    - html_to_pdf_bytes(html)  → bytes PDF
    - upload_pdf(path, bytes)  → url pública
    - remove_pdf(path)
    - merge_pdfs([bytes, ...]) → bytes PDF combinado
    - fetch_pdf_bytes(url|path) → bytes

El convertidor interno es intencionadamente simple: parsea el subset de HTML
que usan las plantillas de certificados/recibos (encabezados, párrafos,
tablas, imágenes) y genera un PDF A4 con ReportLab. No soporta CSS avanzado
— el diseño resultante es sobrio y profesional, suficiente para documentos
internos de la orquesta.
"""
from __future__ import annotations
import io
import re
from html.parser import HTMLParser
from typing import List, Optional, Tuple, Any

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

from supabase_client import supabase

BUCKET = "documentos-musicos"


# ---------------------------------------------------------------------------
# Parser HTML mínimo → flowables de ReportLab
# ---------------------------------------------------------------------------
_INLINE_MAP = {
    "strong": ("b", "b"),
    "b": ("b", "b"),
    "em": ("i", "i"),
    "i": ("i", "i"),
    "u": ("u", "u"),
    "br": (None, None),  # se trata aparte
}


def _page_size_from_html(html: str):
    """Detecta `@page size: A4 landscape` vs portrait."""
    m = re.search(r"@page[^{]*{[^}]*size:\s*([^;}]+)", html, re.IGNORECASE)
    if m and "landscape" in m.group(1).lower():
        return landscape(A4)
    return A4


def _make_styles():
    base = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontSize=24, alignment=TA_CENTER,
                             textColor=colors.HexColor("#1e293b"), spaceAfter=12, fontName="Helvetica-Bold"),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontSize=16, alignment=TA_CENTER,
                             textColor=colors.HexColor("#475569"), spaceAfter=10),
        "h3": ParagraphStyle("h3", parent=base["Heading3"], fontSize=12, alignment=TA_LEFT,
                             textColor=colors.HexColor("#64748b"), spaceAfter=4),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontSize=11, leading=15,
                               textColor=colors.HexColor("#1e293b"), spaceAfter=6),
        "body_center": ParagraphStyle("body_c", parent=base["BodyText"], fontSize=11, leading=15,
                                      alignment=TA_CENTER, textColor=colors.HexColor("#1e293b"), spaceAfter=6),
        "firma_nombre": ParagraphStyle("firma", parent=base["BodyText"], fontSize=11, alignment=TA_CENTER,
                                       textColor=colors.HexColor("#1e293b"), spaceBefore=30, spaceAfter=2),
        "nombre_grande": ParagraphStyle("nombre", parent=base["BodyText"], fontSize=18, alignment=TA_CENTER,
                                        textColor=colors.HexColor("#b45309"), fontName="Helvetica-Bold",
                                        spaceBefore=8, spaceAfter=8),
        "small_right": ParagraphStyle("small_r", parent=base["BodyText"], fontSize=9, alignment=TA_RIGHT,
                                      textColor=colors.HexColor("#64748b"), spaceAfter=2),
        "small": ParagraphStyle("small", parent=base["BodyText"], fontSize=9,
                                textColor=colors.HexColor("#64748b"), spaceAfter=2),
    }


def _escape_xml(text: str) -> str:
    if not text:
        return ""
    return (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;"))


class _HTML2Flowables(HTMLParser):
    """Parser simple que convierte HTML → lista de flowables ReportLab.

    Reconoce: h1, h2, h3, p, strong/b, em/i, br, img, table/tr/td, div(class).
    """

    def __init__(self, styles):
        super().__init__(convert_charrefs=True)
        self.styles = styles
        self.flow: List[Any] = []
        self._buf: List[str] = []              # texto del párrafo actual
        self._stack: List[str] = []            # stack de etiquetas activas
        self._current_para_style = styles["body"]
        self._in_table = False
        self._table_rows: List[List[str]] = []
        self._current_row: List[str] = []
        self._current_cell_buf: List[str] = []
        self._in_cell = False
        self._cell_classes: List[str] = []
        self._in_style_or_script = False
        self._pending_images: List[str] = []
        self._class_context: List[str] = []    # stack de clases de div actuales
        self._last_div_class: Optional[str] = None

    # ---------------- Helpers ----------------
    def _flush_paragraph(self):
        txt = "".join(self._buf).strip()
        self._buf = []
        if not txt:
            return
        self.flow.append(Paragraph(txt, self._current_para_style))

    def _append_inline(self, text: str):
        if self._in_cell:
            self._current_cell_buf.append(_escape_xml(text))
            return
        # Aplica etiquetas inline activas
        formatted = _escape_xml(text)
        for tag in self._stack:
            open_tag, close_tag = _INLINE_MAP.get(tag, (None, None))
            if open_tag and open_tag != "br":
                formatted = f"<{open_tag}>{formatted}</{close_tag}>"
        self._buf.append(formatted)

    # ---------------- handle_* ----------------
    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in ("style", "script", "head", "meta", "title", "link"):
            self._in_style_or_script = True
            return
        attrs_d = dict(attrs)
        if tag in ("h1", "h2", "h3"):
            self._flush_paragraph()
            self._current_para_style = self.styles.get(tag, self.styles["h1"])
        elif tag == "p":
            self._flush_paragraph()
            # Estilo por clase del padre
            cls = (self._class_context[-1] if self._class_context else "")
            if cls in ("cuerpo", "center"):
                self._current_para_style = self.styles["body_center"]
            else:
                self._current_para_style = self.styles["body"]
        elif tag == "div":
            cls = attrs_d.get("class", "")
            self._class_context.append(cls)
            self._last_div_class = cls
            # Algunos divs se comportan como párrafos de estilos específicos
            if cls == "titulo":
                self._flush_paragraph()
                self._current_para_style = self.styles["h1"]
            elif cls == "sub":
                self._flush_paragraph()
                self._current_para_style = self.styles["h2"]
            elif cls == "nombre":
                self._flush_paragraph()
                self._current_para_style = self.styles["nombre_grande"]
            elif cls == "numcert":
                self._flush_paragraph()
                self._current_para_style = self.styles["small_right"]
            elif cls == "cuerpo" or cls == "center":
                self._flush_paragraph()
                self._current_para_style = self.styles["body_center"]
            elif cls == "firma":
                self._flush_paragraph()
                self._current_para_style = self.styles["firma_nombre"]
            elif cls == "pie":
                self._flush_paragraph()
                self._current_para_style = self.styles["firma_nombre"]
        elif tag == "br":
            if self._in_cell:
                self._current_cell_buf.append("<br/>")
            else:
                self._buf.append("<br/>")
        elif tag == "hr":
            self._flush_paragraph()
            self.flow.append(Spacer(1, 8))
        elif tag == "table":
            self._flush_paragraph()
            self._in_table = True
            self._table_rows = []
        elif tag == "tr" and self._in_table:
            self._current_row = []
            self._cell_classes = []
        elif tag == "td" and self._in_table:
            self._in_cell = True
            self._current_cell_buf = []
            self._cell_classes.append(attrs_d.get("class", ""))
        elif tag == "img":
            src = attrs_d.get("src")
            if src and src.startswith(("http://", "https://")):
                self._flush_paragraph()
                try:
                    import urllib.request
                    with urllib.request.urlopen(src, timeout=10) as r:
                        img_bytes = r.read()
                    img = Image(io.BytesIO(img_bytes), width=4 * cm, height=2 * cm, kind="bound")
                    img.hAlign = "CENTER"
                    self.flow.append(img)
                except Exception:
                    pass
        elif tag in _INLINE_MAP:
            self._stack.append(tag)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ("style", "script", "head", "meta", "title", "link"):
            self._in_style_or_script = False
            return
        if tag in ("h1", "h2", "h3", "p"):
            self._flush_paragraph()
            self._current_para_style = self.styles["body"]
        elif tag == "div":
            self._flush_paragraph()
            if self._class_context:
                self._class_context.pop()
            self._current_para_style = self.styles["body"]
        elif tag == "table" and self._in_table:
            self._in_table = False
            if self._table_rows:
                # Ancho columna: dividir ancho disponible entre nº columnas
                max_cols = max(len(r) for r in self._table_rows)
                t = Table(self._table_rows, hAlign="CENTER")
                style_cmds = [
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#1e293b")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ]
                # Si la primera columna contiene etiquetas, alinéala a la derecha y gris
                if max_cols >= 2:
                    style_cmds.append(("ALIGN", (0, 0), (0, -1), "RIGHT"))
                    style_cmds.append(("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#64748b")))
                    style_cmds.append(("FONTSIZE", (0, 0), (0, -1), 9))
                    style_cmds.append(("ALIGN", (1, 0), (-1, -1), "LEFT"))
                    style_cmds.append(("FONTNAME", (1, 0), (-1, -1), "Helvetica-Bold"))
                t.setStyle(TableStyle(style_cmds))
                self.flow.append(Spacer(1, 8))
                self.flow.append(t)
                self.flow.append(Spacer(1, 8))
            self._table_rows = []
        elif tag == "tr" and not self._in_cell:
            if self._current_row:
                self._table_rows.append(self._current_row)
            self._current_row = []
        elif tag == "td" and self._in_cell:
            self._in_cell = False
            txt = "".join(self._current_cell_buf).strip()
            self._current_row.append(Paragraph(txt or "—", self.styles["body"]))
            self._current_cell_buf = []
        elif tag in _INLINE_MAP and self._stack and self._stack[-1] == tag:
            self._stack.pop()

    def handle_data(self, data):
        if self._in_style_or_script:
            return
        if not data:
            return
        # Normaliza espacios múltiples/saltos
        text = re.sub(r"\s+", " ", data)
        if self._in_cell:
            self._current_cell_buf.append(_escape_xml(text))
        else:
            self._append_inline(text)

    def result(self) -> List[Any]:
        self._flush_paragraph()
        return self.flow


def html_to_pdf_bytes(html: str, base_url: Optional[str] = None) -> bytes:
    """Renderiza HTML (subset) a PDF usando ReportLab. API compatible con el antiguo WeasyPrint."""
    page_size = _page_size_from_html(html)
    styles = _make_styles()
    parser = _HTML2Flowables(styles)
    try:
        parser.feed(html)
    except Exception:
        # Si falla parseo, caemos a texto plano
        plain = re.sub(r"<[^>]+>", " ", html)
        plain = re.sub(r"\s+", " ", plain).strip()
        parser.flow = [Paragraph(_escape_xml(plain), styles["body"])]

    flowables = parser.result() or [Paragraph("Documento vacío", styles["body"])]

    out = io.BytesIO()
    doc = SimpleDocTemplate(
        out, pagesize=page_size,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
        title="Documento",
    )
    doc.build(flowables)
    return out.getvalue()


# ---------------------------------------------------------------------------
# Upload / download helpers (sin cambios respecto al motor anterior)
# ---------------------------------------------------------------------------
def upload_pdf(path: str, content: bytes) -> str:
    try:
        supabase.storage.from_(BUCKET).upload(
            path, content, file_options={"content-type": "application/pdf", "upsert": "true"},
        )
    except Exception:
        try:
            supabase.storage.from_(BUCKET).remove([path])
        except Exception:
            pass
        supabase.storage.from_(BUCKET).upload(
            path, content, file_options={"content-type": "application/pdf"},
        )
    url = supabase.storage.from_(BUCKET).get_public_url(path)
    return url.split('?')[0] if isinstance(url, str) else url


def remove_pdf(path: str) -> None:
    try:
        supabase.storage.from_(BUCKET).remove([path])
    except Exception:
        pass


def merge_pdfs(pdf_bytes_list: List[bytes]) -> bytes:
    from pypdf import PdfWriter, PdfReader
    writer = PdfWriter()
    for pdf in pdf_bytes_list:
        if not pdf:
            continue
        reader = PdfReader(io.BytesIO(pdf))
        for p in reader.pages:
            writer.add_page(p)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def fetch_pdf_bytes(url_or_path: str) -> bytes:
    import urllib.request
    if url_or_path.startswith("http"):
        with urllib.request.urlopen(url_or_path) as r:
            return r.read()
    return supabase.storage.from_(BUCKET).download(url_or_path)
