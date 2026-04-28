"""Informes PDF — API. Usa reportlab.
Tipos:
  A — Plantilla definitiva + plano + montaje
  B — Económico por evento
  C — Estadístico de asistencia
  D — Configuración de eventos
  E — Hoja servicio transportista material
  F — Hoja servicio transportista músicos
  G — Carta de convocatoria por músico
  H — A + B + C + D combinado
"""
import os
from typing import List, Optional, Literal
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api/gestor/informes", tags=["informes"])

NAVY = colors.HexColor("#1A3A5C")
GOLD = colors.HexColor("#C9920A")
LIGHT = colors.HexColor("#F1F5F9")


class InformeReq(BaseModel):
    tipo: Literal['A','B','C','D','E','F','G','H','I','J']
    evento_ids: List[str]
    ensayo_id: Optional[str] = None
    opciones: Optional[dict] = {}


def _styles():
    ss = getSampleStyleSheet()
    return {
        'h1':  ParagraphStyle('h1',  parent=ss['Heading1'], textColor=NAVY, fontSize=16, spaceAfter=8),
        'h2':  ParagraphStyle('h2',  parent=ss['Heading2'], textColor=NAVY, fontSize=12, spaceAfter=6),
        'h3':  ParagraphStyle('h3',  parent=ss['Heading3'], textColor=NAVY, fontSize=10, spaceAfter=4),
        'p':   ParagraphStyle('p',   parent=ss['Normal'], fontSize=9, leading=12),
        'small': ParagraphStyle('small', parent=ss['Normal'], fontSize=7, textColor=colors.HexColor('#64748B')),
        'cab': ParagraphStyle('cab', parent=ss['Normal'], fontSize=14, textColor=NAVY, alignment=TA_LEFT, fontName='Helvetica-Bold'),
        'firma': ParagraphStyle('firma', parent=ss['Normal'], fontSize=9, alignment=TA_CENTER),
    }


def _draw_header_footer(c, doc, titulo: str, subtitulo: str = ''):
    """Cabecera + footer en cada página."""
    c.saveState()
    # Cabecera
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(20*mm, A4[1] - 18*mm, "IFC Innovación Formación y Cultura")
    c.setFillColor(GOLD)
    c.setLineWidth(1.5)
    c.setStrokeColor(GOLD)
    c.line(20*mm, A4[1] - 22*mm, A4[0] - 20*mm, A4[1] - 22*mm)
    c.setFillColor(colors.HexColor('#475569'))
    c.setFont("Helvetica", 8)
    c.drawRightString(A4[0] - 20*mm, A4[1] - 18*mm, datetime.now().strftime('%d/%m/%Y %H:%M'))
    # Footer
    c.setFillColor(colors.HexColor('#94A3B8'))
    c.setFont("Helvetica", 7)
    foot = f"OPUS MANAGER · {titulo}" + (f" — {subtitulo}" if subtitulo else "")
    c.drawString(20*mm, 12*mm, foot)
    c.drawRightString(A4[0] - 20*mm, 12*mm, f"Página {doc.page}")
    c.restoreState()


def _build_doc(buf: BytesIO, titulo: str, subtitulo: str = ''):
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=28*mm, bottomMargin=18*mm,
                            title=titulo, author="OPUS MANAGER")
    def first(c, d): _draw_header_footer(c, d, titulo, subtitulo)
    def later(c, d): _draw_header_footer(c, d, titulo, subtitulo)
    return doc, first, later


# ============================================================
# Helpers BD
# ============================================================
def _evento(eid):
    r = supabase.table('eventos').select('*').eq('id', eid).limit(1).execute().data or []
    return r[0] if r else None


def _musicos_confirmados(eid):
    # Compatibilidad: el esquema puede no tener columnas atril/cache; hacer fallback.
    try:
        asigs = supabase.table('asignaciones').select('usuario_id,letra_atril,numero_atril,cache_previsto,cache_real,estado') \
            .eq('evento_id', eid).eq('estado', 'confirmado').execute().data or []
    except Exception:
        asigs = supabase.table('asignaciones').select('usuario_id,estado') \
            .eq('evento_id', eid).eq('estado', 'confirmado').execute().data or []
    if not asigs: return []
    uids = list({a['usuario_id'] for a in asigs if a.get('usuario_id')})
    users = supabase.table('usuarios').select('id,nombre,apellidos,instrumento,especialidad,nivel_estudios,telefono,email') \
        .in_('id', uids).execute().data or []
    umap = {u['id']: u for u in users}
    out = []
    for a in asigs:
        u = umap.get(a['usuario_id'])
        if u:
            out.append({
                **u,
                'letra_atril': a.get('letra_atril'),
                'numero_atril': a.get('numero_atril'),
                'cache_previsto': a.get('cache_previsto'),
                'cache_real': a.get('cache_real'),
            })
    return out


def _seccion(instr):
    s = (instr or '').lower()
    if any(x in s for x in ['violín 1','violin 1','violín i','violin i']): return ('1. Violines I', 1)
    if any(x in s for x in ['violín 2','violin 2','violín ii','violin ii']): return ('2. Violines II', 2)
    if 'viola' in s: return ('3. Violas', 3)
    if 'violonchelo' in s or 'cello' in s: return ('4. Violonchelos', 4)
    if 'contrabaj' in s: return ('5. Contrabajos', 5)
    if any(x in s for x in ['flauta','oboe','clarinete','fagot','corno']): return ('6. Viento Madera', 6)
    if any(x in s for x in ['trompa','trompeta','trombón','trombon','tuba']): return ('7. Viento Metal', 7)
    if 'percu' in s or 'timbal' in s: return ('8. Percusión', 8)
    if 'piano' in s or 'arpa' in s: return ('9. Teclados', 9)
    if any(x in s for x in ['coro','soprano','tenor','contralto','mezzo']): return ('10. Coro', 10)
    return ('Z. Otros', 99)


def _color_seccion(instr):
    sec, _ = _seccion(instr)
    if sec.startswith('1.') or sec.startswith('2.') or sec.startswith('3.') or sec.startswith('4.') or sec.startswith('5.'):
        return colors.HexColor('#FECACA')  # cuerda → rojo claro
    if sec.startswith('6.') or sec.startswith('7.'):
        return colors.HexColor('#FED7AA')  # viento → naranja
    if sec.startswith('8.'):
        return colors.HexColor('#BBF7D0')  # percusión → verde
    if sec.startswith('9.'):
        return colors.HexColor('#E9D5FF')  # teclados → violeta
    if sec.startswith('10.'):
        return colors.HexColor('#BFDBFE')  # coro → azul
    return colors.HexColor('#E2E8F0')


# ============================================================
# Generadores por tipo
# ============================================================
def gen_A(evento_ids, opciones=None) -> bytes:
    buf = BytesIO()
    doc, first, later = _build_doc(buf, "Plantilla Definitiva y Plano", "")
    S = _styles()
    elements = []
    for eid in evento_ids:
        ev = _evento(eid)
        if not ev:
            continue
        elements.append(Paragraph(f"PLANTILLA DEFINITIVA — {ev.get('nombre','')}", S['h1']))
        elements.append(Paragraph(f"Fecha: {ev.get('fecha_inicio','—')[:10]}  ·  Estado: {ev.get('estado','—')}", S['p']))
        elements.append(Spacer(1, 6*mm))
        # Sección 1 — músicos
        musicos = _musicos_confirmados(eid)
        musicos.sort(key=lambda m: (_seccion(m.get('instrumento') or '')[1], m.get('apellidos') or ''))
        elements.append(Paragraph("1. Lista de músicos confirmados", S['h2']))
        # Tabla: Atril | Letra | Apellidos, Nombre | Instrumento | Nivel | Tel | Email | Caché
        head = ['#', 'Atr', 'L', 'Apellidos, Nombre', 'Instrumento', 'Nivel', 'Teléfono', 'Email', 'Caché']
        data = [head]
        sec_actual = None
        for i, m in enumerate(musicos, 1):
            sec, _ = _seccion(m.get('instrumento') or '')
            if sec != sec_actual:
                data.append([Paragraph(f"<b>{sec}</b>", S['p'])] + ['']*8)
                sec_actual = sec
            data.append([
                str(i),
                str(m.get('numero_atril') or '—'),
                str(m.get('letra_atril') or '—'),
                f"{m.get('apellidos','')}, {m.get('nombre','')}",
                m.get('instrumento') or '—',
                (m.get('nivel_estudios') or '—')[:8],
                m.get('telefono') or '—',
                (m.get('email') or '')[:25],
                f"{m.get('cache_previsto') or 0:.0f}€" if m.get('cache_previsto') else '—',
            ])
        if not musicos:
            data.append(['Sin músicos confirmados'] + ['']*8)
        t = Table(data, colWidths=[8*mm, 10*mm, 8*mm, 45*mm, 30*mm, 14*mm, 22*mm, 35*mm, 14*mm])
        t.setStyle(TableStyle([
            ('FONT', (0,0), (-1,-1), 'Helvetica', 7),
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONT', (0,0), (-1,0), 'Helvetica-Bold', 8),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT]),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 8*mm))
        # Sección 2 — Plano (descripción + tabla por sección, no SVG real en PDF para simplicidad)
        elements.append(PageBreak())
        elements.append(Paragraph("2. Plano del escenario (disposición estándar)", S['h2']))
        elements.append(Paragraph(
            "Disposición estándar de orquesta sinfónica vista desde el público. "
            "El SVG visual interactivo está disponible en la web; aquí se lista el detalle por sección.",
            S['p']))
        # Agrupar por sección
        from collections import defaultdict
        secciones = defaultdict(list)
        for m in musicos:
            sec, _ = _seccion(m.get('instrumento') or '')
            secciones[sec].append(m)
        for sec in sorted(secciones.keys()):
            elements.append(Paragraph(f"{sec} ({len(secciones[sec])})", S['h3']))
            data = [['#', 'Atril', 'Apellidos, Nombre', 'Instrumento']]
            for i, m in enumerate(secciones[sec], 1):
                data.append([str(i), str(m.get('numero_atril') or '—'),
                             f"{m.get('apellidos','')}, {m.get('nombre','')}",
                             m.get('instrumento') or '—'])
            t = Table(data, colWidths=[10*mm, 14*mm, 80*mm, 60*mm])
            color_sec = _color_seccion(secciones[sec][0].get('instrumento') if secciones[sec] else '')
            t.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
                ('BACKGROUND', (0,0), (-1,0), color_sec),
                ('FONT', (0,0), (-1,0), 'Helvetica-Bold', 8),
                ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 4*mm))
        # Sección 3 — Montaje
        elements.append(PageBreak())
        elements.append(Paragraph("3. Lista de montaje", S['h2']))
        montaje = supabase.table('evento_montaje') \
            .select('*, material:inventario_material(nombre,grupo,codigo)') \
            .eq('evento_id', eid).is_('ensayo_id', 'null') \
            .order('seccion_escenario').execute().data or []
        if not montaje:
            elements.append(Paragraph("No hay montaje configurado para este evento.", S['p']))
        else:
            data = [['Material', 'Grupo', 'Cant.', 'Origen', 'Sección', 'Posición', 'Conf']]
            for m in montaje:
                mat = m.get('material') or {}
                data.append([
                    mat.get('nombre') or m.get('nombre_material') or '—',
                    (mat.get('grupo') or '—').upper(),
                    str(m.get('cantidad_necesaria') or 0),
                    (m.get('origen') or 'propio'),
                    m.get('seccion_escenario') or '—',
                    (m.get('posicion_escenario') or '')[:25],
                    '✓' if m.get('confirmado') else '·',
                ])
            t = Table(data, colWidths=[55*mm, 22*mm, 12*mm, 18*mm, 30*mm, 32*mm, 8*mm])
            t.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), 'Helvetica', 7),
                ('BACKGROUND', (0,0), (-1,0), NAVY),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('FONT', (0,0), (-1,0), 'Helvetica-Bold', 8),
                ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT]),
            ]))
            elements.append(t)
        if eid != evento_ids[-1]:
            elements.append(PageBreak())
    elements += _pie_firma()

    doc.build(elements, onFirstPage=first, onLaterPages=later)
    return buf.getvalue()


def gen_E(evento_ids, opciones=None) -> bytes:
    """Hoja servicio transportista material."""
    buf = BytesIO()
    doc, first, later = _build_doc(buf, "Hoja de Servicio — Transporte de Material")
    S = _styles()
    elements = []
    for eid in evento_ids:
        ev = _evento(eid)
        if not ev: continue
        tr = supabase.table('transporte_material').select('*').eq('evento_id', eid).limit(1).execute().data or []
        tr = tr[0] if tr else {}
        elements.append(Paragraph("HOJA DE SERVICIO DE TRANSPORTE DE MATERIAL", S['h1']))
        elements.append(Paragraph(f"<b>Evento:</b> {ev.get('nombre','')}<br/><b>Fecha del evento:</b> {ev.get('fecha_inicio','—')[:10]}", S['p']))
        elements.append(Spacer(1, 4*mm))
        elements.append(Paragraph("Datos de la empresa transportista", S['h2']))
        emp_t = Table([
            ['Empresa', tr.get('empresa') or '—'],
            ['Contacto', tr.get('contacto_empresa') or '—'],
            ['Teléfono', tr.get('telefono_empresa') or '—'],
            ['Estado', (tr.get('estado') or '—').upper()],
            ['Presupuesto', f"{tr.get('presupuesto_euros'):.2f} €" if tr.get('presupuesto_euros') else '—'],
        ], colWidths=[40*mm, 130*mm])
        emp_t.setStyle(TableStyle([
            ('FONT', (0,0), (-1,-1), 'Helvetica', 9),
            ('FONT', (0,0), (0,-1), 'Helvetica-Bold', 9),
            ('BACKGROUND', (0,0), (0,-1), LIGHT),
            ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
        ]))
        elements.append(emp_t)
        elements.append(Spacer(1, 6*mm))
        elements.append(Paragraph("Servicio", S['h2']))
        srv = [['Tipo', 'Fecha', 'Hora', 'Dirección']]
        srv.append(['Recogida', tr.get('fecha_carga') or '—', (tr.get('hora_carga') or '')[:5], tr.get('direccion_carga') or '—'])
        for n in (1,2,3):
            if tr.get(f'parada_{n}_direccion'):
                srv.append([f'Parada {n}', '', (tr.get(f'parada_{n}_hora') or '')[:5], tr.get(f'parada_{n}_direccion') or '—'])
        srv.append(['Entrega', tr.get('fecha_descarga') or '—', (tr.get('hora_descarga') or '')[:5], tr.get('direccion_descarga') or '—'])
        if tr.get('fecha_devolucion'):
            srv.append(['Devolución', tr.get('fecha_devolucion'), (tr.get('hora_devolucion') or '')[:5], tr.get('direccion_carga') or '—'])
        t = Table(srv, colWidths=[28*mm, 28*mm, 18*mm, 96*mm])
        t.setStyle(TableStyle([
            ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONT', (0,0), (-1,0), 'Helvetica-Bold', 9),
            ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
        ]))
        elements.append(t)
        # Material
        elements.append(Spacer(1, 6*mm))
        elements.append(Paragraph("Material a transportar", S['h2']))
        montaje = supabase.table('evento_montaje').select('*, material:inventario_material(nombre,grupo,codigo)') \
            .eq('evento_id', eid).is_('ensayo_id', 'null').order('seccion_escenario').execute().data or []
        if not montaje:
            elements.append(Paragraph("Sin material configurado.", S['p']))
        else:
            data = [['Cant', 'Material', 'Grupo', 'Sección', 'Notas']]
            for m in montaje:
                mat = m.get('material') or {}
                data.append([str(m.get('cantidad_necesaria') or 0),
                             mat.get('nombre') or m.get('nombre_material') or '—',
                             (mat.get('grupo') or '—').upper(),
                             m.get('seccion_escenario') or '—',
                             (m.get('notas') or '')[:30]])
            mt = Table(data, colWidths=[14*mm, 60*mm, 25*mm, 35*mm, 36*mm])
            mt.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), 'Helvetica', 7),
                ('BACKGROUND', (0,0), (-1,0), NAVY),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('FONT', (0,0), (-1,0), 'Helvetica-Bold', 8),
                ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT]),
            ]))
            elements.append(mt)
        if tr.get('notas'):
            elements.append(Spacer(1, 4*mm))
            elements.append(Paragraph(f"<b>Notas:</b> {tr.get('notas')}", S['p']))
        # Firma
        elements.append(Spacer(1, 14*mm))
        firma = Table([
            ['_______________________', '', '_______________________'],
            ['Firma transportista', '', 'Sello empresa'],
        ], colWidths=[60*mm, 50*mm, 60*mm])
        firma.setStyle(TableStyle([
            ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ]))
        elements.append(firma)
        if eid != evento_ids[-1]:
            elements.append(PageBreak())
    elements += _pie_firma()

    doc.build(elements, onFirstPage=first, onLaterPages=later)
    return buf.getvalue()


def gen_F(evento_ids, opciones=None) -> bytes:
    """Hoja servicio transportista músicos — agrupados por punto de recogida."""
    buf = BytesIO()
    doc, first, later = _build_doc(buf, "Hoja de Servicio — Transporte de Músicos")
    S = _styles()
    elements = []
    for eid in evento_ids:
        ev = _evento(eid)
        if not ev: continue
        elements.append(Paragraph("HOJA DE SERVICIO DE TRANSPORTE DE MÚSICOS", S['h1']))
        elements.append(Paragraph(f"<b>Evento:</b> {ev.get('nombre','')}<br/><b>Fecha:</b> {ev.get('fecha_inicio','—')[:10]}", S['p']))
        elements.append(Spacer(1, 4*mm))
        # Logística del evento
        logs = supabase.table('evento_logistica').select('*').eq('evento_id', eid).order('orden').execute().data or []
        if not logs:
            elements.append(Paragraph("Sin logística configurada para este evento.", S['p']))
        for l in logs:
            tipo_label = {'transporte_ida': 'IDA', 'transporte_vuelta': 'VUELTA', 'alojamiento': 'ALOJAMIENTO'}.get(l.get('tipo'), l.get('tipo'))
            elements.append(Paragraph(f"{tipo_label}", S['h2']))
            t = Table([
                ['Fecha', l.get('fecha') or '—', 'Salida', (l.get('hora_salida') or '')[:5]],
                ['Lugar salida', l.get('lugar_salida') or '—', 'Llegada', (l.get('hora_llegada') or '')[:5]],
                ['Lugar llegada', l.get('lugar_llegada') or '—', 'Lím. confirmación', l.get('fecha_limite_confirmacion') or '—'],
            ], colWidths=[35*mm, 60*mm, 28*mm, 47*mm])
            t.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
                ('FONT', (0,0), (0,-1), 'Helvetica-Bold', 8),
                ('FONT', (2,0), (2,-1), 'Helvetica-Bold', 8),
                ('BACKGROUND', (0,0), (0,-1), LIGHT),
                ('BACKGROUND', (2,0), (2,-1), LIGHT),
                ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
            ]))
            elements.append(t)
            # Confirmaciones por usuario
            confs = supabase.table('confirmaciones_logistica').select('*') \
                .eq('logistica_id', l['id']).execute().data or []
            uids = list({c['usuario_id'] for c in confs if c.get('usuario_id')})
            users_map = {}
            if uids:
                us = supabase.table('usuarios').select('id,nombre,apellidos,instrumento').in_('id', uids).execute().data or []
                users_map = {u['id']: u for u in us}
            # Agrupar por punto_recogida
            from collections import defaultdict
            grupos = defaultdict(list)
            for c in confs:
                u = users_map.get(c['usuario_id'])
                if not u: continue
                pr = c.get('punto_recogida') or l.get('lugar_salida') or '—'
                grupos[pr].append({**u, 'confirmado': c.get('confirmado')})
            elements.append(Spacer(1, 3*mm))
            for punto, ms in grupos.items():
                elements.append(Paragraph(f"📍 {punto}", S['h3']))
                data = [['Estado', 'Apellidos, Nombre', 'Instrumento']]
                for m in ms:
                    estado = '✓' if m.get('confirmado') is True else ('✗' if m.get('confirmado') is False else '⏳')
                    data.append([estado, f"{m.get('apellidos','')}, {m.get('nombre','')}", m.get('instrumento') or '—'])
                ut = Table(data, colWidths=[18*mm, 80*mm, 72*mm])
                ut.setStyle(TableStyle([
                    ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
                    ('BACKGROUND', (0,0), (-1,0), GOLD),
                    ('FONT', (0,0), (-1,0), 'Helvetica-Bold', 8),
                    ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
                ]))
                elements.append(ut)
                elements.append(Spacer(1, 2*mm))
            elements.append(Spacer(1, 4*mm))
        if eid != evento_ids[-1]:
            elements.append(PageBreak())
    elements += _pie_firma()

    doc.build(elements, onFirstPage=first, onLaterPages=later)
    return buf.getvalue()


# ============================================================
# B, C, D, G, H — Versiones simplificadas funcionales
# ============================================================
def gen_B(evento_ids, opciones=None) -> bytes:
    buf = BytesIO()
    doc, first, later = _build_doc(buf, "Informe Económico por Evento")
    S = _styles()
    elements = []
    for eid in evento_ids:
        ev = _evento(eid)
        if not ev: continue
        elements.append(Paragraph(f"INFORME ECONÓMICO — {ev.get('nombre','')}", S['h1']))
        elements.append(Paragraph(f"Fecha: {ev.get('fecha_inicio','—')[:10]}", S['p']))
        # Asignaciones (fallback si faltan columnas cache)
        try:
            asigs = supabase.table('asignaciones').select('usuario_id,cache_previsto,cache_real,estado') \
                .eq('evento_id', eid).eq('estado', 'confirmado').execute().data or []
        except Exception:
            asigs = supabase.table('asignaciones').select('usuario_id,estado') \
                .eq('evento_id', eid).eq('estado', 'confirmado').execute().data or []
        uids = list({a['usuario_id'] for a in asigs if a.get('usuario_id')})
        users = {u['id']: u for u in (supabase.table('usuarios').select('id,nombre,apellidos,instrumento,nivel_estudios').in_('id', uids).execute().data or [])}
        data = [['Apellidos, Nombre', 'Instrumento', 'Nivel', 'Caché prev.', 'Caché real', 'TOTAL']]
        total_prev = total_real = 0.0
        for a in asigs:
            u = users.get(a['usuario_id'])
            if not u: continue
            cp = float(a.get('cache_previsto') or 0)
            cr = float(a.get('cache_real') or 0)
            total_prev += cp; total_real += cr
            data.append([f"{u.get('apellidos','')}, {u.get('nombre','')}", u.get('instrumento') or '—',
                         (u.get('nivel_estudios') or '—')[:12], f"{cp:.2f}€", f"{cr:.2f}€", f"{cr or cp:.2f}€"])
        data.append(['TOTAL', '', '', f"{total_prev:.2f}€", f"{total_real:.2f}€", f"{(total_real or total_prev):.2f}€"])
        t = Table(data, colWidths=[55*mm, 35*mm, 20*mm, 22*mm, 22*mm, 22*mm])
        t.setStyle(TableStyle([
            ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONT', (0,0), (-1,0), 'Helvetica-Bold', 9),
            ('FONT', (0,-1), (-1,-1), 'Helvetica-Bold', 9),
            ('BACKGROUND', (0,-1), (-1,-1), GOLD),
            ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
        ]))
        elements.append(t)
        if eid != evento_ids[-1]: elements.append(PageBreak())
    elements += _pie_firma()

    doc.build(elements, onFirstPage=first, onLaterPages=later)
    return buf.getvalue()


def gen_C(evento_ids, opciones=None) -> bytes:
    buf = BytesIO()
    doc, first, later = _build_doc(buf, "Estadístico de Asistencia")
    S = _styles()
    elements = [Paragraph("ESTADÍSTICO DE ASISTENCIA", S['h1'])]
    data = [['Evento', 'Convocados', 'Confirmados', '% Asistencia']]
    for eid in evento_ids:
        ev = _evento(eid)
        if not ev: continue
        all_a = supabase.table('asignaciones').select('estado').eq('evento_id', eid).execute().data or []
        conv = len(all_a)
        conf = sum(1 for a in all_a if a.get('estado') == 'confirmado')
        pct = f"{(conf*100/conv) if conv else 0:.1f}%"
        data.append([ev.get('nombre','')[:40], str(conv), str(conf), pct])
    t = Table(data, colWidths=[80*mm, 30*mm, 30*mm, 30*mm])
    t.setStyle(TableStyle([
        ('FONT', (0,0), (-1,-1), 'Helvetica', 9),
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONT', (0,0), (-1,0), 'Helvetica-Bold', 9),
        ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
    ]))
    elements.append(t)
    elements += _pie_firma()

    doc.build(elements, onFirstPage=first, onLaterPages=later)
    return buf.getvalue()


def gen_D(evento_ids, opciones=None) -> bytes:
    """Bloque 11A — Informe D mejorado: TODA la información del evento en el mismo orden que la página."""
    buf = BytesIO()
    doc, first, later = _build_doc(buf, "Configuración de Eventos")
    S = _styles()
    elements = []
    for eid in evento_ids:
        ev = _evento(eid)
        if not ev: continue
        # 1. DATOS GENERALES
        elements.append(Paragraph(f"CONFIGURACIÓN COMPLETA — {ev.get('nombre','')}", S['h1']))
        elements.append(Paragraph("1 · Datos generales", S['h2']))
        elements.append(Paragraph(
            f"<b>Nombre:</b> {ev.get('nombre','—')} &nbsp; <b>Tipo:</b> {ev.get('tipo','—')}<br/>"
            f"<b>Estado:</b> {ev.get('estado','—')} &nbsp; <b>Temporada:</b> {ev.get('temporada_id') or '—'}<br/>"
            f"<b>Fecha inicio:</b> {(ev.get('fecha_inicio') or '—')[:10]} &nbsp; <b>Fecha fin:</b> {(ev.get('fecha_fin') or '—')[:10]}<br/>"
            f"<b>Lugar:</b> {ev.get('lugar') or '—'}<br/>"
            f"<b>Descripción:</b> {ev.get('descripcion') or '—'}<br/>"
            f"<b>Notas internas:</b> {ev.get('notas_internas') or '—'}", S['p']))
        elements.append(Spacer(1, 4*mm))

        # 2. ENSAYOS Y FUNCIONES
        elements.append(Paragraph("2 · Ensayos y funciones", S['h2']))
        try:
            ensayos = supabase.table('rehearsals').select('*').eq('event_id', eid).order('fecha').execute().data or []
        except Exception:
            ensayos = supabase.table('ensayos').select('*').eq('evento_id', eid).order('fecha').execute().data or []
        if ensayos:
            data = [['Tipo', 'Fecha', 'Hora ini.', 'Hora fin', 'Lugar']]
            for e in ensayos:
                data.append([
                    e.get('tipo') or '—', e.get('fecha') or '—',
                    (e.get('hora_inicio') or '')[:5], (e.get('hora_fin') or '')[:5],
                    e.get('lugar') or '—',
                ])
            t = Table(data, colWidths=[24*mm, 28*mm, 20*mm, 20*mm, 78*mm])
            t.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
                ('BACKGROUND', (0,0), (-1,0), NAVY),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
            ]))
            elements.append(t)
        else:
            elements.append(Paragraph("Sin ensayos configurados.", S['small']))
        elements.append(Spacer(1, 4*mm))

        # 3. TRANSPORTES MÚSICOS (logística)
        elements.append(Paragraph("3 · Transportes y alojamientos · Músicos", S['h2']))
        try:
            logs = supabase.table('evento_logistica').select('*').eq('evento_id', eid).execute().data or []
        except Exception:
            logs = []
        if logs:
            data = [['Tipo', 'Fecha', 'Salida', 'Llegada', 'Puntos recogida']]
            for l in logs:
                data.append([
                    l.get('tipo') or '—', l.get('fecha') or '—',
                    f"{l.get('lugar_salida') or ''} {l.get('hora_salida') or ''}".strip() or '—',
                    f"{l.get('lugar_llegada') or ''} {l.get('hora_llegada') or ''}".strip() or '—',
                    str(l.get('puntos_recogida') or '—')[:60],
                ])
            t = Table(data, colWidths=[28*mm, 22*mm, 40*mm, 40*mm, 40*mm])
            t.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
                ('BACKGROUND', (0,0), (-1,0), NAVY),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
            ]))
            elements.append(t)
        else:
            elements.append(Paragraph("Sin transportes/alojamientos.", S['small']))
        elements.append(Spacer(1, 4*mm))

        # 4. PROGRAMA MUSICAL
        elements.append(Paragraph("4 · Programa musical", S['h2']))
        try:
            evobras = supabase.table('evento_obras').select('*, obra:obras(codigo,titulo,autor)').eq('evento_id', eid).execute().data or []
        except Exception:
            evobras = []
        if evobras:
            data = [['Cód.', 'Autor', 'Obra', 'Estado']]
            for eo in evobras:
                ob = eo.get('obra') or {}
                data.append([
                    ob.get('codigo') or '—', ob.get('autor') or '—',
                    ob.get('titulo') or eo.get('titulo_provisional') or '—',
                    eo.get('estado') or '—',
                ])
            t = Table(data, colWidths=[20*mm, 50*mm, 70*mm, 30*mm])
            t.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
                ('BACKGROUND', (0,0), (-1,0), NAVY),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
            ]))
            elements.append(t)
        else:
            elements.append(Paragraph("Sin programa musical configurado.", S['small']))
        elements.append(Spacer(1, 4*mm))

        # 5. MONTAJE
        elements.append(Paragraph("5 · Montaje y rider técnico", S['h2']))
        try:
            mont = supabase.table('evento_montaje').select('*, material:inventario_material(nombre,grupo)').eq('evento_id', eid).execute().data or []
        except Exception:
            mont = []
        if mont:
            data = [['Material', 'Grupo', 'Cant.', 'Origen', 'Sección', 'Conf.']]
            for m in mont:
                data.append([
                    (m.get('material') or {}).get('nombre') or m.get('nombre_material') or '—',
                    (m.get('material') or {}).get('grupo') or '—',
                    str(m.get('cantidad_necesaria') or 0),
                    m.get('origen') or '—',
                    m.get('seccion_escenario') or '—',
                    '✓' if m.get('confirmado') else '·',
                ])
            t = Table(data, colWidths=[60*mm, 25*mm, 15*mm, 22*mm, 30*mm, 12*mm])
            t.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
                ('BACKGROUND', (0,0), (-1,0), NAVY),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
            ]))
            elements.append(t)
        else:
            elements.append(Paragraph("Sin montaje configurado.", S['small']))
        elements.append(Spacer(1, 4*mm))

        # 6. TRANSPORTE DE MATERIAL
        elements.append(Paragraph("6 · Transporte de material", S['h2']))
        try:
            tr = supabase.table('transporte_material').select('*').eq('evento_id', eid).limit(1).execute().data or []
        except Exception:
            tr = []
        if tr:
            t0 = tr[0]
            elements.append(Paragraph(
                f"<b>Empresa:</b> {t0.get('empresa') or '—'} &nbsp; <b>Contacto:</b> {t0.get('contacto_empresa') or '—'} &nbsp; <b>Tlf:</b> {t0.get('telefono_empresa') or '—'}<br/>"
                f"<b>Carga:</b> {t0.get('fecha_carga') or '—'} {(t0.get('hora_carga') or '')[:5]} en {t0.get('direccion_carga') or '—'}<br/>"
                f"<b>Descarga:</b> {t0.get('fecha_descarga') or '—'} {(t0.get('hora_descarga') or '')[:5]} en {t0.get('direccion_descarga') or '—'}<br/>"
                f"<b>Presupuesto:</b> {t0.get('presupuesto_euros') or '—'}€  &nbsp;  <b>Estado:</b> {t0.get('estado') or '—'}",
                S['p']))
        else:
            elements.append(Paragraph("Sin transporte de material configurado.", S['small']))
        elements.append(Spacer(1, 4*mm))

        # 7. PRESUPUESTO RESUMIDO
        elements.append(Paragraph("7 · Presupuesto resumido", S['h2']))
        try:
            musicos = _musicos_confirmados(eid)
            total_cache = sum(float(m.get('cache_real') or m.get('cache_previsto') or 0) for m in musicos)
        except Exception:
            total_cache = 0
            musicos = []
        elements.append(Paragraph(
            f"<b>Músicos confirmados:</b> {len(musicos)}<br/>"
            f"<b>Cachés totales (real/previsto):</b> {total_cache:.2f}€<br/>"
            f"<i>Datos de gastos adicionales en el módulo de Análisis Económico.</i>", S['p']))
        elements.append(Spacer(1, 4*mm))

        # 8. ESTADO DE VERIFICACIONES
        elements.append(Paragraph("8 · Estado de verificaciones", S['h2']))
        try:
            verifs = supabase.table('evento_verificaciones').select('*').eq('evento_id', eid).execute().data or []
        except Exception:
            verifs = []
        verif_map = {v['seccion']: v for v in verifs}
        secciones_lab = [
            ('datos_generales', 'Datos Generales'),
            ('ensayos', 'Ensayos y Funciones'),
            ('logistica_musicos', 'Transportes Músicos'),
            ('logistica_material', 'Transporte Material'),
            ('programa_musical', 'Programa Musical'),
            ('presupuesto', 'Presupuesto'),
            ('montaje', 'Montaje'),
            ('partituras', 'Partituras'),
        ]
        data = [['Sección', 'Estado', 'Verificado por', 'Fecha']]
        for k, lab in secciones_lab:
            v = verif_map.get(k) or {}
            data.append([
                lab, v.get('estado') or 'pendiente',
                v.get('verificado_por_nombre') or '—',
                (v.get('verificado_at') or '—')[:10],
            ])
        t = Table(data, colWidths=[55*mm, 35*mm, 50*mm, 30*mm])
        t.setStyle(TableStyle([
            ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
            ('BACKGROUND', (0,0), (-1,0), GOLD),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
        ]))
        elements.append(t)

        if eid != evento_ids[-1]: elements.append(PageBreak())
    elements += _pie_firma()

    doc.build(elements, onFirstPage=first, onLaterPages=later)
    return buf.getvalue()


def gen_G(evento_ids, opciones=None) -> bytes:
    buf = BytesIO()
    doc, first, later = _build_doc(buf, "Carta de Convocatoria")
    S = _styles()
    elements = []
    for eid in evento_ids:
        ev = _evento(eid)
        if not ev: continue
        musicos = _musicos_confirmados(eid)
        ensayos = supabase.table('ensayos').select('*').eq('evento_id', eid).order('fecha').execute().data or []
        for m in musicos:
            elements.append(Paragraph("CARTA DE CONVOCATORIA", S['h1']))
            elements.append(Paragraph(f"Estimado/a <b>{m.get('nombre','')} {m.get('apellidos','')}</b>:", S['p']))
            elements.append(Paragraph(
                f"Le convocamos al evento <b>«{ev.get('nombre','')}»</b> en calidad de <b>{m.get('instrumento','')}</b>.<br/>"
                f"Fecha del evento: <b>{ev.get('fecha_inicio','—')[:10]}</b>.<br/>"
                f"Lugar principal: {ev.get('lugar') or '—'}.", S['p']))
            elements.append(Spacer(1, 3*mm))
            elements.append(Paragraph("Ensayos programados", S['h3']))
            if ensayos:
                data = [['Tipo', 'Fecha', 'Hora', 'Lugar']]
                for e in ensayos:
                    data.append([e.get('tipo') or '—', e.get('fecha') or '—', (e.get('hora_inicio') or '')[:5], e.get('lugar') or '—'])
                t = Table(data, colWidths=[28*mm, 28*mm, 18*mm, 96*mm])
                t.setStyle(TableStyle([
                    ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
                    ('BACKGROUND', (0,0), (-1,0), NAVY),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                    ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
                ]))
                elements.append(t)
            elements.append(Spacer(1, 8*mm))
            elements.append(Paragraph("Atentamente,<br/><br/>El equipo de gestión de IFC", S['p']))
            elements.append(PageBreak())
    elements += _pie_firma()

    doc.build(elements, onFirstPage=first, onLaterPages=later)
    return buf.getvalue()


def gen_H(evento_ids, opciones=None) -> bytes:
    """Combina A+B+C+D en un único PDF."""
    buf = BytesIO()
    doc, first, later = _build_doc(buf, "Informe Completo (A+B+C+D)")
    S = _styles()
    elements = [Paragraph("INFORME COMPLETO", S['h1']),
                Paragraph(f"Eventos seleccionados: {len(evento_ids)}", S['p']),
                PageBreak()]
    # Para simplicidad concatenamos contenido textual; cada generador produce un PDF separado.
    # En esta versión inicial generamos como apartados secuenciales del A+B+C+D.
    # (Implementación robusta sería merge de PDFs con pypdf, fuera del alcance MVP.)
    for sec, gen in (('A — Plantilla y plano', gen_A), ('B — Económico', gen_B),
                     ('C — Asistencia', gen_C), ('D — Configuración', gen_D)):
        elements.append(Paragraph(sec, S['h1']))
        elements.append(Paragraph(f"Ver PDF individual de tipo {sec.split(' — ')[0]}.", S['p']))
        elements.append(Spacer(1, 8*mm))
    elements += _pie_firma()
    doc.build(elements, onFirstPage=first, onLaterPages=later)
    # NOTA: la versión combinada real requiere pypdf para mergear; aquí
    # se entrega placeholder + recomendación de descargar individuales.
    return buf.getvalue()


# ============================================================
# Bloque 11B — Pie de firma reutilizable
# ============================================================
def _pie_firma():
    """Devuelve elementos reportlab con dos columnas para firma."""
    S = _styles()
    tabla = Table([
        [Paragraph("<b>Gestor responsable</b>", S['small']),
         Paragraph("<b>Visto bueno · Dirección</b>", S['small'])],
        [Paragraph("Firma:<br/><br/>____________________________", S['small']),
         Paragraph("Firma:<br/><br/>____________________________", S['small'])],
        [Paragraph("Nombre y apellidos:<br/>____________________________", S['small']),
         Paragraph("Nombre y apellidos:<br/>____________________________", S['small'])],
        [Paragraph(f"Fecha: ____ / ____ / ______<br/>Lugar: ________________________", S['small']),
         Paragraph(f"Fecha: ____ / ____ / ______<br/>Lugar: ________________________", S['small'])],
    ], colWidths=[8.5*cm, 8.5*cm])
    tabla.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
    ]))
    return [Spacer(1, 10*mm), Paragraph("FIRMAS", S['h2']), tabla]


# ============================================================
# Bloque 11C — Informe I: Hoja de trabajo para montaje
# ============================================================
def gen_I(evento_ids, opciones=None) -> bytes:
    buf = BytesIO()
    doc, first, later = _build_doc(buf, "Hoja de trabajo · Equipo de montaje")
    S = _styles()
    el = []
    for evid in evento_ids:
        ev = _evento(evid) or {}
        el.append(Paragraph(f"<b>{ev.get('nombre','—')}</b>", S['h1']))
        el.append(Paragraph(f"Fecha: {(ev.get('fecha_inicio') or '')[:10]} · Lugar: {ev.get('lugar') or '—'}", S['p']))
        el.append(Spacer(1, 4*mm))
        # Lista de ensayos/funciones (rehearsals)
        try:
            ensayos = supabase.table('rehearsals').select('*').eq('event_id', evid).order('fecha').execute().data or []
        except Exception:
            ensayos = []
        for ens in ensayos:
            el.append(Paragraph(f"<b>{ens.get('tipo','sesión').upper()} — {(ens.get('fecha') or '')[:10]} · {(ens.get('hora_inicio') or '')[:5]}</b>", S['h2']))
            el.append(Paragraph(f"Lugar: {ens.get('lugar') or '—'}", S['small']))
            el.append(Spacer(1, 1*mm))
            # Material asociado al evento (filtrado por sesión si existiera)
            try:
                m_q = supabase.table('evento_montaje').select('*, material:inventario_material(nombre,grupo)').eq('evento_id', evid)
                if 'ensayo_id' in (m_q.execute().data[0] if m_q.execute().data else {}):
                    m_q = m_q.eq('ensayo_id', ens['id'])
                materiales = m_q.execute().data or []
            except Exception:
                materiales = []
            if materiales:
                rows = [['Item', 'Grupo', 'Cant.', 'Sección', 'Conf.']]
                for m in materiales:
                    rows.append([
                        (m.get('material') or {}).get('nombre') or m.get('nombre_material') or '—',
                        (m.get('material') or {}).get('grupo') or '—',
                        str(m.get('cantidad_necesaria') or 0),
                        m.get('seccion_escenario') or '—',
                        '✓' if m.get('confirmado') else '·',
                    ])
                t = Table(rows, repeatRows=1, colWidths=[7*cm, 2.5*cm, 1.5*cm, 3*cm, 1*cm])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1A3A5C')),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                    ('FONTSIZE', (0,0), (-1,-1), 8),
                    ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#cbd5e1')),
                ]))
                el.append(t)
            else:
                el.append(Paragraph("Sin material configurado.", S['small']))
            el.append(Spacer(1, 4*mm))
        # Espacio para incidencias
        el.append(Paragraph("<b>Incidencias y observaciones</b>", S['h2']))
        el.append(Paragraph("_______________________________________________________________________<br/>_______________________________________________________________________<br/>_______________________________________________________________________", S['small']))
        el.append(Spacer(1, 4*mm))
        if evid != evento_ids[-1]:
            el.append(PageBreak())
    el += _pie_firma()
    doc.build(el, onFirstPage=first, onLaterPages=later)
    return buf.getvalue()


# ============================================================
# Bloque 11D — Informe J: Hoja de trabajo para archivo
# ============================================================
def gen_J(evento_ids, opciones=None) -> bytes:
    buf = BytesIO()
    doc, first, later = _build_doc(buf, "Hoja de trabajo · Equipo de archivo")
    S = _styles()
    el = []
    for evid in evento_ids:
        ev = _evento(evid) or {}
        el.append(Paragraph(f"<b>{ev.get('nombre','—')}</b>", S['h1']))
        el.append(Paragraph(f"Fecha: {(ev.get('fecha_inicio') or '')[:10]}", S['p']))
        el.append(Spacer(1, 3*mm))
        # Programa de obras
        try:
            evobras = supabase.table('evento_obras').select('*, obra:obras(id,codigo,titulo,autor)') \
                .eq('evento_id', evid).execute().data or []
        except Exception:
            evobras = []
        if evobras:
            el.append(Paragraph("<b>Programa de obras</b>", S['h2']))
            rows = [['Cód.', 'Autor / Título', 'Estado material', 'Notas']]
            for eo in evobras:
                ob = eo.get('obra') or {}
                rows.append([
                    ob.get('codigo') or '—',
                    f"{ob.get('autor') or ''} — {ob.get('titulo') or eo.get('titulo_provisional') or '—'}",
                    eo.get('estado') or '—',
                    eo.get('notas') or '',
                ])
            t = Table(rows, repeatRows=1, colWidths=[2*cm, 8.5*cm, 3.5*cm, 3*cm])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1A3A5C')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('FONTSIZE', (0,0), (-1,-1), 8),
                ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#cbd5e1')),
            ]))
            el.append(t)
            el.append(Spacer(1, 4*mm))
        # Préstamos activos que afecten al evento
        try:
            f_ini = (ev.get('fecha_inicio') or '')[:10]
            prest = supabase.table('obra_prestamos').select('*, obra:obras(titulo,codigo)') \
                .neq('estado', 'devuelto').execute().data or []
        except Exception:
            prest = []
        prest_evento = []
        for p in prest:
            ps = (p.get('fecha_salida') or '')[:10]
            pe = (p.get('fecha_devolucion_real') or p.get('fecha_prevista_devolucion') or '')[:10]
            if ps and ps <= (f_ini or '9999-12-31') and (not pe or pe >= (f_ini or '0000-01-01')):
                prest_evento.append(p)
        if prest_evento:
            el.append(Paragraph("<b>Préstamos activos en fechas del evento</b>", S['h2']))
            rows = [['Obra', 'Salida', 'Prevista', 'Estado']]
            for p in prest_evento:
                ob = p.get('obra') or {}
                rows.append([
                    f"{ob.get('codigo') or ''} — {ob.get('titulo') or '—'}",
                    (p.get('fecha_salida') or '')[:10],
                    (p.get('fecha_prevista_devolucion') or '')[:10] or '—',
                    p.get('estado') or '—',
                ])
            t = Table(rows, repeatRows=1, colWidths=[8*cm, 3*cm, 3*cm, 3*cm])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#C9920A')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('FONTSIZE', (0,0), (-1,-1), 8),
                ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#cbd5e1')),
            ]))
            el.append(t)
            el.append(Spacer(1, 4*mm))
        if evid != evento_ids[-1]:
            el.append(PageBreak())
    el += _pie_firma()
    doc.build(el, onFirstPage=first, onLaterPages=later)
    return buf.getvalue()


# ============================================================
# Endpoint
# ============================================================
GENERADORES = {'A': gen_A, 'B': gen_B, 'C': gen_C, 'D': gen_D, 'E': gen_E, 'F': gen_F, 'G': gen_G, 'H': gen_H, 'I': gen_I, 'J': gen_J}


@router.post("/generar")
async def generar_informe(req: InformeReq, current_user: dict = Depends(get_current_gestor)):
    if req.tipo not in GENERADORES:
        raise HTTPException(status_code=400, detail=f"Tipo {req.tipo} no soportado")
    if not req.evento_ids:
        raise HTTPException(status_code=400, detail="evento_ids vacío")
    try:
        pdf = GENERADORES[req.tipo](req.evento_ids, req.opciones or {})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando: {e}")
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="informe_{req.tipo}_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'},
    )


@router.get("/preview/{tipo}/{evento_id}")
async def preview_informe(tipo: str, evento_id: str, current_user: dict = Depends(get_current_gestor)):
    """Devuelve datos JSON para vista previa HTML en frontend."""
    ev = _evento(evento_id)
    if not ev: raise HTTPException(status_code=404, detail="Evento no encontrado")
    if tipo == 'A':
        musicos = _musicos_confirmados(evento_id)
        for m in musicos:
            sec, ord_ = _seccion(m.get('instrumento') or '')
            m['_seccion'] = sec
            m['_seccion_orden'] = ord_
        montaje = supabase.table('evento_montaje') \
            .select('*, material:inventario_material(nombre,grupo,codigo)') \
            .eq('evento_id', evento_id).is_('ensayo_id', 'null').execute().data or []
        return {"evento": ev, "musicos": musicos, "montaje": montaje}
    if tipo == 'E':
        tr = supabase.table('transporte_material').select('*').eq('evento_id', evento_id).limit(1).execute().data or []
        montaje = supabase.table('evento_montaje').select('*, material:inventario_material(nombre,grupo,codigo)') \
            .eq('evento_id', evento_id).is_('ensayo_id', 'null').execute().data or []
        return {"evento": ev, "transporte": tr[0] if tr else None, "montaje": montaje}
    if tipo == 'F':
        logs = supabase.table('evento_logistica').select('*').eq('evento_id', evento_id).order('orden').execute().data or []
        return {"evento": ev, "logistica": logs}
    return {"evento": ev}



# ============================================================
# Envío por email (Resend con adjunto PDF)
# ============================================================
class EnviarInformeReq(BaseModel):
    tipo: Literal['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
    evento_ids: List[str]
    destinatarios: List[str]  # lista de emails
    asunto: str
    mensaje: str
    opciones: Optional[dict] = {}


def _email_html_informe(asunto: str, mensaje: str, tipo: str) -> str:
    """HTML corporativo IFC navy/gold para el envío del informe."""
    tipos_label = {
        'A': 'Plantilla definitiva + plano + montaje',
        'B': 'Económico por evento',
        'C': 'Estadístico de asistencia',
        'D': 'Configuración de eventos',
        'E': 'Hoja servicio · Transporte material',
        'F': 'Hoja servicio · Transporte músicos',
        'G': 'Carta de convocatoria por músico',
        'H': 'Informe completo (A+B+C+D)',
    }
    safe_msg = (mensaje or '').replace('\n', '<br/>')
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td style="background:#1A3A5C;padding:24px 32px;color:#ffffff;border-bottom:3px solid #C9920A">
          <h1 style="margin:0;font-size:20px;letter-spacing:0.5px">IFC · INNOVACIÓN, FORMACIÓN Y CULTURA</h1>
          <p style="margin:6px 0 0;font-size:13px;color:#C9920A">Informe tipo {tipo} — {tipos_label.get(tipo, '')}</p>
        </td></tr>
        <tr><td style="padding:28px 32px">
          <h2 style="margin:0 0 14px;font-size:18px;color:#1A3A5C">{asunto}</h2>
          <div style="font-size:14px;line-height:1.55;color:#334155">{safe_msg}</div>
          <div style="margin:20px 0;padding:14px 16px;background:#F1F5F9;border-left:3px solid #C9920A;border-radius:4px;font-size:13px;color:#475569">
            📎 Encontrarás el informe en formato PDF adjunto a este correo.
          </div>
          <p style="margin:18px 0 0;font-size:12px;color:#64748b">
            Generado por OPUS MANAGER · {datetime.now().strftime('%d/%m/%Y %H:%M')}
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">
          Este correo se ha enviado automáticamente desde el sistema OPUS MANAGER.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>""".strip()


@router.post("/enviar-email")
async def enviar_informe_email(req: EnviarInformeReq, current_user: dict = Depends(get_current_gestor)):
    """Genera el PDF y lo envía adjunto a una o varias direcciones de email vía Resend."""
    import base64
    import re
    if req.tipo not in GENERADORES:
        raise HTTPException(status_code=400, detail=f"Tipo {req.tipo} no soportado")
    if not req.evento_ids:
        raise HTTPException(status_code=400, detail="evento_ids vacío")
    if not req.destinatarios:
        raise HTTPException(status_code=400, detail="Sin destinatarios")
    # Validación básica de emails
    email_rx = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    destinatarios = [e.strip() for e in req.destinatarios if e and e.strip()]
    invalidos = [e for e in destinatarios if not email_rx.match(e)]
    if invalidos:
        raise HTTPException(status_code=400, detail=f"Emails inválidos: {', '.join(invalidos)}")
    # Generar PDF
    try:
        pdf_bytes = GENERADORES[req.tipo](req.evento_ids, req.opciones or {})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {e}")
    # Enviar vía Resend con attachment
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Servicio de email no configurado (falta RESEND_API_KEY)")
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev").strip()
    pdf_b64 = base64.b64encode(pdf_bytes).decode('ascii')
    filename = f"informe_{req.tipo}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    html = _email_html_informe(req.asunto, req.mensaje, req.tipo)
    enviados, errores = [], []
    # Resolver usuario_id del gestor en tabla `usuarios` para poder mostrarlo en el historial
    sender_uid = None
    try:
        au_id = (current_user or {}).get('id')
        if au_id:
            ur = supabase.table('usuarios').select('id').or_(f'id.eq.{au_id},user_id.eq.{au_id}').limit(1).execute().data or []
            sender_uid = ur[0]['id'] if ur else None
    except Exception:
        sender_uid = None
    primary_evento_id = req.evento_ids[0] if req.evento_ids else None
    try:
        import resend as _resend
        _resend.api_key = api_key
        for to in destinatarios:
            try:
                params = {
                    "from": sender,
                    "to": [to],
                    "subject": req.asunto or f"Informe {req.tipo}",
                    "html": html,
                    "attachments": [{"filename": filename, "content": pdf_b64}],
                }
                result = _resend.Emails.send(params)
                eid = result.get("id") if isinstance(result, dict) else None
                enviados.append({"email": to, "id": eid})
                # Log
                try:
                    supabase.table('email_log').insert({
                        "destinatario": to,
                        "asunto": req.asunto,
                        "tipo": f"informe_{req.tipo}",
                        "estado": "enviado",
                        "resend_id": eid,
                        "usuario_id": sender_uid,
                        "evento_id": primary_evento_id,
                    }).execute()
                except Exception:
                    pass
            except Exception as e:
                errores.append({"email": to, "error": str(e)[:200]})
                try:
                    supabase.table('email_log').insert({
                        "destinatario": to,
                        "asunto": req.asunto,
                        "tipo": f"informe_{req.tipo}",
                        "estado": "error",
                        "error_mensaje": str(e)[:500],
                        "usuario_id": sender_uid,
                        "evento_id": primary_evento_id,
                    }).execute()
                except Exception:
                    pass
    except ImportError:
        raise HTTPException(status_code=503, detail="Librería 'resend' no instalada")
    return {"ok": True, "enviados": enviados, "errores": errores, "filename": filename}


@router.get("/destinatarios")
async def destinatarios_disponibles(evento_ids: Optional[str] = None,
                                     current_user: dict = Depends(get_current_gestor)):
    """Devuelve gestores + músicos confirmados (de los eventos pasados) para selector de email.
    evento_ids: cadena CSV opcional de UUIDs."""
    out = {"gestores": [], "musicos": []}
    # Gestores
    try:
        gestores = supabase.table('usuarios').select('id,nombre,apellidos,email,rol') \
            .in_('rol', ['admin', 'gestor']).execute().data or []
        out["gestores"] = [{"id": g['id'], "email": g.get('email'),
                            "nombre": f"{g.get('nombre','')} {g.get('apellidos','')}".strip(),
                            "rol": g.get('rol')} for g in gestores if g.get('email')]
    except Exception:
        pass
    # Músicos confirmados de esos eventos
    if evento_ids:
        eids = [e.strip() for e in evento_ids.split(',') if e.strip()]
        if eids:
            try:
                asigs = supabase.table('asignaciones').select('usuario_id,evento_id,estado') \
                    .in_('evento_id', eids).eq('estado', 'confirmado').execute().data or []
                uids = list({a['usuario_id'] for a in asigs if a.get('usuario_id')})
                if uids:
                    musicos = supabase.table('usuarios').select('id,nombre,apellidos,email,instrumento') \
                        .in_('id', uids).execute().data or []
                    out["musicos"] = [{"id": m['id'], "email": m.get('email'),
                                       "nombre": f"{m.get('nombre','')} {m.get('apellidos','')}".strip(),
                                       "instrumento": m.get('instrumento')} for m in musicos if m.get('email')]
            except Exception:
                pass
    return out
