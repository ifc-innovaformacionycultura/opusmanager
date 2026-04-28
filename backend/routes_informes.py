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
    tipo: Literal['A','B','C','D','E','F','G','H']
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
    doc.build(elements, onFirstPage=first, onLaterPages=later)
    return buf.getvalue()


def gen_D(evento_ids, opciones=None) -> bytes:
    buf = BytesIO()
    doc, first, later = _build_doc(buf, "Configuración de Eventos")
    S = _styles()
    elements = []
    for eid in evento_ids:
        ev = _evento(eid)
        if not ev: continue
        elements.append(Paragraph(f"CONFIGURACIÓN — {ev.get('nombre','')}", S['h1']))
        elements.append(Paragraph(
            f"<b>Fecha:</b> {(ev.get('fecha_inicio') or '—')[:10]} → {(ev.get('fecha_fin') or '—')[:10]}<br/>"
            f"<b>Estado:</b> {ev.get('estado','—')}  ·  <b>Lugar:</b> {ev.get('lugar') or '—'}<br/>"
            f"<b>Descripción:</b> {ev.get('descripcion') or '—'}", S['p']))
        # Ensayos
        ensayos = supabase.table('ensayos').select('*').eq('evento_id', eid).order('fecha').execute().data or []
        elements.append(Paragraph("Ensayos / Funciones", S['h2']))
        if ensayos:
            data = [['Tipo', 'Fecha', 'Hora', 'Lugar']]
            for e in ensayos:
                data.append([e.get('tipo') or '—', e.get('fecha') or '—', (e.get('hora_inicio') or '')[:5], e.get('lugar') or '—'])
            t = Table(data, colWidths=[30*mm, 30*mm, 20*mm, 90*mm])
            t.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), 'Helvetica', 8),
                ('BACKGROUND', (0,0), (-1,0), NAVY),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#CBD5E1')),
            ]))
            elements.append(t)
        else:
            elements.append(Paragraph("Sin ensayos.", S['p']))
        if eid != evento_ids[-1]: elements.append(PageBreak())
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
    doc.build(elements, onFirstPage=first, onLaterPages=later)
    # NOTA: la versión combinada real requiere pypdf para mergear; aquí
    # se entrega placeholder + recomendación de descargar individuales.
    return buf.getvalue()


# ============================================================
# Endpoint
# ============================================================
GENERADORES = {'A': gen_A, 'B': gen_B, 'C': gen_C, 'D': gen_D, 'E': gen_E, 'F': gen_F, 'G': gen_G, 'H': gen_H}


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
