"""PDF rendering helper basado en WeasyPrint.

Convierte HTML+CSS a PDF y lo sube al bucket de Supabase. Se aísla en un módulo
propio para permitir cambiar de motor (Playwright, xhtml2pdf, ReportLab) sin
tocar la lógica de negocio en routes_documentos.py.
"""
from __future__ import annotations
import io
from typing import Optional
from weasyprint import HTML, CSS

from supabase_client import supabase

BUCKET = "documentos-musicos"


def html_to_pdf_bytes(html: str, base_url: Optional[str] = None) -> bytes:
    """Renderiza HTML completo (con <html><body>) a bytes PDF."""
    return HTML(string=html, base_url=base_url or "").write_pdf()


def upload_pdf(path: str, content: bytes) -> str:
    """Sube el PDF al bucket. Si ya existe en path, lo sobreescribe.
    Devuelve la URL pública.
    """
    try:
        # upsert para permitir re-generar
        supabase.storage.from_(BUCKET).upload(
            path, content, file_options={"content-type": "application/pdf", "upsert": "true"},
        )
    except Exception:
        # Si falla por existencia, intenta remove + upload
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


def merge_pdfs(pdf_bytes_list: list[bytes]) -> bytes:
    """Combina varios PDFs en uno solo."""
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
    """Descarga un PDF desde su URL pública o storage_path."""
    import urllib.request
    if url_or_path.startswith("http"):
        with urllib.request.urlopen(url_or_path) as r:
            return r.read()
    # asumir path
    return supabase.storage.from_(BUCKET).download(url_or_path)
