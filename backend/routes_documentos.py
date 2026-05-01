"""Recibos & Certificados — servicio + endpoints.

Generación automática:
- Certificado: cuando un evento pasa a estado='finalizado' (vía hook en update_evento).
- Recibo: cuando una asignación pasa a estado_pago='pagado' (vía hook en marcar_pago).

Plantillas: si existe en `comunicaciones_plantillas` una con `nombre IN ('certificado_default','recibo_default')`,
se usa su HTML renderizado del Centro de Comunicaciones; si no, se usa una plantilla minimal hardcoded.

Variables disponibles en plantillas:
- Comunes: nombre, apellidos, dni, instrumento, evento, fecha_evento, lugar, temporada,
           director_nombre, director_firma_url, org_nombre, org_cif, org_direccion, fecha_emision
- Certificado: horas_totales, numero_certificado
- Recibo: importe_bruto, irpf_porcentaje, irpf_importe, importe_neto, fecha_pago, iban, concepto, numero_recibo
"""
from __future__ import annotations
import os
import io
import re
import zipfile
from datetime import datetime, date, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor, get_current_musico
import config_app as _cfg

from pdf_renderer import html_to_pdf_bytes, upload_pdf, remove_pdf, merge_pdfs, fetch_pdf_bytes
from routes_comunicaciones_plantillas import render_plantilla, _replace_vars

router = APIRouter(prefix="/api", tags=["documentos"])

# ============================================================================
# Helpers de configuración
# ============================================================================

def _config() -> Dict[str, str]:
    return {
        "director_nombre": _cfg.director_nombre(),
        "director_firma_url": _cfg.director_firma_url(),
        "org_nombre": _cfg.org_nombre(),
        "org_cif": _cfg.org_cif(),
        "org_direccion": _cfg.org_direccion(),
    }

def _irpf_default() -> float:
    return _cfg.irpf_porcentaje()

def _horas_ensayo_default() -> float:
    try:
        return float(os.environ.get("HORAS_ENSAYO_DEFAULT", "3"))
    except Exception:
        return 3.0

def _horas_funcion_default() -> float:
    try:
        return float(os.environ.get("HORAS_FUNCION_DEFAULT", "2"))
    except Exception:
        return 2.0


# ============================================================================
# Cálculo de horas
# ============================================================================

def _hours_diff(hora_ini: Optional[str], hora_fin: Optional[str], default: float) -> float:
    """Devuelve duración en horas (float). Si falta alguna, usa default."""
    if not hora_ini or not hora_fin:
        return default
    try:
        # Strings tipo "19:00:00" o "19:00"
        def _parse(t):
            parts = t.split(":")
            return int(parts[0]) + (int(parts[1]) if len(parts) > 1 else 0) / 60.0
        h_ini = _parse(hora_ini)
        h_fin = _parse(hora_fin)
        diff = h_fin - h_ini
        if diff < 0:  # cruza medianoche
            diff += 24
        return round(diff, 2) if diff > 0 else default
    except Exception:
        return default


def calcular_horas_evento(usuario_id: str, evento_id: str) -> float:
    """Suma horas de ensayos y funciones a las que asistió el músico, ponderado por su % asistencia real.

    Para cada ensayo del evento al que el músico está convocado:
       - Si la disponibilidad tiene asistencia_real (NUMERIC %), se computa hours * (asistencia_real/100).
       - Si está confirmado/asiste pero sin asistencia_real, se computa hours * 1 (asume 100%).
       - Si está rechazado/no asiste/no convocado, 0.

    Para las fechas de función (eventos.fecha_inicio + secundarias), se asume asistencia plena
    si el músico está confirmado en el evento (no hay tabla de % asistencia función vs ensayo).
    """
    total = 0.0
    # 1) Ensayos
    try:
        ensayos = supabase.table('ensayos') \
            .select('id,hora_inicio,hora_fin,tipo') \
            .eq('evento_id', evento_id).execute().data or []
    except Exception:
        ensayos = []

    if ensayos:
        ens_ids = [e['id'] for e in ensayos]
        # Disponibilidad del músico
        try:
            disp = supabase.table('disponibilidad') \
                .select('ensayo_id,asiste,asistencia_real') \
                .eq('usuario_id', usuario_id).in_('ensayo_id', ens_ids).execute().data or []
        except Exception:
            disp = []
        disp_map = {d['ensayo_id']: d for d in disp}

        for e in ensayos:
            d = disp_map.get(e['id'])
            if not d:
                continue
            # asiste puede ser True/False/None; asistencia_real numérico %
            ar = d.get('asistencia_real')
            asiste = d.get('asiste')
            if ar is not None:
                pct = float(ar) / 100.0
            elif asiste is True:
                pct = 1.0
            else:
                pct = 0.0
            if pct <= 0:
                continue
            hours = _hours_diff(e.get('hora_inicio'), e.get('hora_fin'), _horas_ensayo_default())
            total += hours * pct

    # 2) Funciones (fecha_inicio + 4 secundarias) — sólo si está confirmado
    try:
        ev = supabase.table('eventos').select(
            'fecha_inicio,hora_inicio,fecha_secundaria_1,hora_secundaria_1,'
            'fecha_secundaria_2,hora_secundaria_2,fecha_secundaria_3,hora_secundaria_3,'
            'fecha_secundaria_4,hora_secundaria_4'
        ).eq('id', evento_id).single().execute().data
        asig = supabase.table('asignaciones').select('estado').eq('usuario_id', usuario_id).eq('evento_id', evento_id).limit(1).execute().data or []
    except Exception:
        ev, asig = None, []
    confirmado = bool(asig and asig[0].get('estado') == 'confirmado')
    if ev and confirmado:
        n_funciones = 1  # principal
        for i in range(1, 5):
            if ev.get(f'fecha_secundaria_{i}'):
                n_funciones += 1
        # Sin hora_fin de función explícita; usamos default
        total += n_funciones * _horas_funcion_default()

    return round(total, 2)


# ============================================================================
# Plantillas seed (fallback si no hay plantilla custom en Centro de Comunicaciones)
# ============================================================================

def _plantilla_default(nombre: str) -> Optional[Dict[str, Any]]:
    """Busca en BD una plantilla del Centro de Comunicaciones cuyo nombre coincida."""
    try:
        r = supabase.table('comunicaciones_plantillas').select('*').eq('nombre', nombre).limit(1).execute().data or []
        return r[0] if r else None
    except Exception:
        return None


def _seed_certificado_html(vars_: Dict[str, str]) -> str:
    """HTML hardcoded del certificado (fallback)."""
    cfg = _config()
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@page {{ size: A4 landscape; margin: 2.5cm; }}
body {{ font-family: Georgia, serif; color: #1e293b; }}
.borde {{ border: 6px double #d4af37; padding: 40px; height: 100%; }}
.titulo {{ font-size: 36px; text-align: center; color: #1e293b; letter-spacing: 4px; font-weight: bold; }}
.sub   {{ text-align: center; color: #64748b; margin-top: 8px; letter-spacing: 2px; }}
.linea-oro {{ border: none; border-top: 2px solid #d4af37; margin: 24px 60px; }}
.cuerpo {{ font-size: 16px; line-height: 1.8; text-align: center; margin: 30px 40px; }}
.nombre {{ font-size: 28px; font-weight: bold; color: #b45309; margin: 18px 0; }}
.tabla {{ margin: 30px auto; border-collapse: collapse; }}
.tabla td {{ padding: 8px 16px; border-bottom: 1px solid #e2e8f0; }}
.tabla td.l {{ text-align: right; color: #64748b; font-size: 13px; }}
.tabla td.v {{ text-align: left; font-weight: 600; }}
.firma {{ margin-top: 40px; text-align: center; }}
.firma img {{ max-height: 60px; }}
.firma .pie {{ border-top: 1px solid #94a3b8; display:inline-block; padding-top:6px; min-width:240px; }}
.numcert {{ text-align: right; color: #64748b; font-size: 11px; margin-bottom: 10px; }}
</style></head>
<body>
  <div class="borde">
    <div class="numcert">Nº {vars_.get('numero_certificado', '—')}</div>
    <div class="titulo">CERTIFICADO</div>
    <div class="sub">DE PARTICIPACIÓN ARTÍSTICA</div>
    <hr class="linea-oro"/>
    <div class="cuerpo">
      <p>{cfg['org_nombre']} certifica que</p>
      <div class="nombre">{vars_.get('nombre','')} {vars_.get('apellidos','')}</div>
      <p>con DNI <strong>{vars_.get('dni','—')}</strong>, ha participado como <strong>{vars_.get('instrumento','músico')}</strong></p>
      <p>en el evento <strong>«{vars_.get('evento','')}»</strong></p>
      <table class="tabla">
        <tr><td class="l">Temporada</td><td class="v">{vars_.get('temporada','—')}</td></tr>
        <tr><td class="l">Lugar</td><td class="v">{vars_.get('lugar','—')}</td></tr>
        <tr><td class="l">Fecha del evento</td><td class="v">{vars_.get('fecha_evento','—')}</td></tr>
        <tr><td class="l">Horas certificadas</td><td class="v">{vars_.get('horas_totales','0')} h</td></tr>
      </table>
      <p>Y para que conste a los efectos oportunos, se expide el presente certificado en
      <strong>{vars_.get('fecha_emision','')}</strong>.</p>
    </div>
    <div class="firma">
      {f'<img src="{vars_.get("director_firma_url")}" alt="firma"/>' if vars_.get('director_firma_url') else ''}
      <div class="pie">{cfg['director_nombre']}<br/><span style="font-size:11px;color:#94a3b8">Dirección Artística</span></div>
    </div>
  </div>
</body></html>"""


def _seed_recibo_html(vars_: Dict[str, str]) -> str:
    cfg = _config()
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 2cm; }}
body {{ font-family: 'Helvetica', Arial, sans-serif; color: #0f172a; font-size: 12px; }}
h1 {{ font-size: 22px; color: #1e293b; margin: 0; letter-spacing: 1px; }}
.cab {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e293b; padding-bottom: 12px; margin-bottom: 24px; }}
.cab .right {{ text-align: right; font-size: 11px; color: #475569; }}
.bloque {{ margin: 14px 0; }}
.bloque h3 {{ font-size: 11px; color: #64748b; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 4px; }}
.box {{ border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px 14px; }}
.tabla {{ width: 100%; border-collapse: collapse; margin: 16px 0; }}
.tabla th, .tabla td {{ padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }}
.tabla th {{ background: #f1f5f9; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #475569; }}
.tabla td.r, .tabla th.r {{ text-align: right; }}
.total {{ background: #1e293b; color: #fff; padding: 12px 14px; border-radius: 4px; display:flex; justify-content: space-between; margin-top: 12px; font-size: 16px; font-weight: bold; }}
.firma {{ margin-top: 50px; padding-top: 30px; border-top: 1px solid #94a3b8; text-align: center; font-size: 11px; color: #64748b; }}
.firma img {{ max-height: 50px; display: block; margin: 0 auto 8px; }}
</style></head>
<body>
  <div class="cab">
    <div>
      <h1>RECIBO DE PAGO</h1>
      <div style="font-size:11px;color:#64748b">Nº {vars_.get('numero_recibo','—')}</div>
    </div>
    <div class="right">
      <strong>{cfg['org_nombre']}</strong><br/>
      {f"CIF: {cfg['org_cif']}<br/>" if cfg['org_cif'] else ''}
      {cfg['org_direccion'] or ''}
    </div>
  </div>

  <div class="bloque">
    <h3>Pagado a</h3>
    <div class="box">
      <strong>{vars_.get('nombre','')} {vars_.get('apellidos','')}</strong><br/>
      DNI: {vars_.get('dni','—')}<br/>
      {vars_.get('direccion','')}<br/>
      IBAN: {vars_.get('iban','—')}
    </div>
  </div>

  <div class="bloque">
    <h3>Concepto</h3>
    <div class="box">{vars_.get('concepto','—')}</div>
  </div>

  <table class="tabla">
    <thead><tr><th>Detalle</th><th class="r">Importe</th></tr></thead>
    <tbody>
      <tr><td>Importe bruto</td><td class="r">{vars_.get('importe_bruto','0,00')} €</td></tr>
      <tr><td>Retención IRPF ({vars_.get('irpf_porcentaje','0')} %)</td><td class="r">– {vars_.get('irpf_importe','0,00')} €</td></tr>
    </tbody>
  </table>

  <div class="total">
    <span>Total neto recibido</span>
    <span>{vars_.get('importe_neto','0,00')} €</span>
  </div>

  <div class="bloque" style="margin-top:24px">
    <h3>Detalles de pago</h3>
    <div class="box">
      Fecha de pago: <strong>{vars_.get('fecha_pago','—')}</strong><br/>
      Evento asociado: {vars_.get('evento','—')} ({vars_.get('temporada','—')})
    </div>
  </div>

  <div class="firma">
    {f'<img src="{vars_.get("director_firma_url")}" alt="firma"/>' if vars_.get('director_firma_url') else ''}
    <strong>{cfg['director_nombre']}</strong><br/>
    Dirección Artística — Emitido el {vars_.get('fecha_emision','')}
  </div>
</body></html>"""


def _render_html(tipo: str, vars_: Dict[str, str]) -> str:
    """Renderiza HTML del documento. Si existe plantilla en Centro de Comunicaciones, la usa.
    Si no, fallback a plantilla seed.
    """
    plantilla_nombre = "certificado_default" if tipo == "certificado" else "recibo_default"
    p = _plantilla_default(plantilla_nombre)
    if p:
        try:
            return render_plantilla(p, vars_)
        except Exception:
            pass
    return _seed_certificado_html(vars_) if tipo == "certificado" else _seed_recibo_html(vars_)


# ============================================================================
# Variables comunes
# ============================================================================

def _build_common_vars(usuario: Dict, evento: Dict, temporada: Optional[str]) -> Dict[str, str]:
    cfg = _config()
    fecha_evento = evento.get('fecha_inicio') or ''
    return {
        "nombre": usuario.get('nombre') or '',
        "apellidos": usuario.get('apellidos') or '',
        "dni": usuario.get('dni') or '—',
        "direccion": usuario.get('direccion') or '',
        "instrumento": usuario.get('instrumento') or 'músico',
        "evento": evento.get('nombre') or '',
        "fecha_evento": str(fecha_evento) if fecha_evento else '',
        "lugar": evento.get('lugar') or '',
        "temporada": temporada or '',
        "fecha_emision": date.today().strftime("%d/%m/%Y"),
        "director_nombre": cfg['director_nombre'],
        "director_firma_url": cfg['director_firma_url'],
        "org_nombre": cfg['org_nombre'],
        "org_cif": cfg['org_cif'],
        "org_direccion": cfg['org_direccion'],
    }


def _next_numero(tipo: str) -> str:
    """Genera número correlativo CERT-AAAA-NNNN o RBO-AAAA-NNNN."""
    year = datetime.now().year
    table = "certificados" if tipo == "certificado" else "recibos"
    prefix = "CERT" if tipo == "certificado" else "RBO"
    try:
        rows = supabase.table(table).select('numero').like('numero', f'{prefix}-{year}-%').execute().data or []
        max_n = 0
        for r in rows:
            num = r.get('numero') or ''
            try:
                n = int(num.split('-')[-1])
                if n > max_n: max_n = n
            except Exception: pass
        return f"{prefix}-{year}-{(max_n + 1):04d}"
    except Exception:
        return f"{prefix}-{year}-0001"


# ============================================================================
# Generación de certificados
# ============================================================================

def generar_certificado(usuario_id: str, evento_id: str, force: bool = False) -> Optional[Dict]:
    """Genera (o regenera) el certificado de un músico para un evento."""
    # Idempotencia
    existing = supabase.table('certificados').select('*').eq('usuario_id', usuario_id).eq('evento_id', evento_id).limit(1).execute().data or []
    if existing and not force:
        return existing[0]
    # Si se modificó manualmente, no sobreescribir salvo force explícito
    if existing and existing[0].get('modificado_manual') and not force:
        return existing[0]

    usuario = supabase.table('usuarios').select('id,nombre,apellidos,email,dni,direccion,instrumento').eq('id', usuario_id).single().execute().data
    evento = supabase.table('eventos').select(
        'id,nombre,fecha_inicio,lugar,temporada'
    ).eq('id', evento_id).single().execute().data
    if not usuario or not evento:
        return None

    horas = calcular_horas_evento(usuario_id, evento_id)
    if horas <= 0 and not force:
        return None  # nada que certificar

    numero = (existing[0].get('numero') if existing else None) or _next_numero("certificado")

    vars_ = _build_common_vars(usuario, evento, evento.get('temporada'))
    vars_.update({
        "horas_totales": f"{horas:.2f}".rstrip("0").rstrip("."),
        "numero_certificado": numero,
    })

    html = _render_html("certificado", vars_)
    pdf = html_to_pdf_bytes(html)

    # path: certificados/{evento_id}/{usuario_id}.pdf
    path = f"certificados/{evento_id}/{usuario_id}.pdf"
    url = upload_pdf(path, pdf)

    payload = {
        "usuario_id": usuario_id,
        "evento_id": evento_id,
        "temporada": evento.get('temporada'),
        "numero": numero,
        "horas_totales": horas,
        "pdf_url": url,
        "pdf_path": path,
        "variables": vars_,
        "publicado": True,
        "actualizado_at": datetime.now(timezone.utc).isoformat(),
    }
    if existing:
        supabase.table('certificados').update(payload).eq('id', existing[0]['id']).execute()
        return supabase.table('certificados').select('*').eq('id', existing[0]['id']).single().execute().data
    payload["creado_at"] = payload["actualizado_at"]
    r = supabase.table('certificados').insert(payload).execute()
    return r.data[0] if r.data else None


def generar_certificados_evento(evento_id: str) -> Dict[str, int]:
    """Genera certificados para todos los músicos confirmados del evento."""
    asigs = supabase.table('asignaciones').select('usuario_id,estado').eq('evento_id', evento_id).eq('estado', 'confirmado').execute().data or []
    creados, errores, omitidos = 0, 0, 0
    for a in asigs:
        try:
            r = generar_certificado(a['usuario_id'], evento_id, force=False)
            if r:
                creados += 1
            else:
                omitidos += 1
        except Exception:
            errores += 1
    return {"creados": creados, "omitidos": omitidos, "errores": errores, "total": len(asigs)}


# ============================================================================
# Generación de recibos
# ============================================================================

def _format_money(x) -> str:
    try:
        return f"{float(x):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "0,00"


def generar_recibo(asignacion_id: str, fecha_pago: Optional[str] = None, force: bool = False) -> Optional[Dict]:
    """Genera (o regenera) el recibo asociado a una asignación pagada."""
    existing = supabase.table('recibos').select('*').eq('asignacion_id', asignacion_id).limit(1).execute().data or []
    if existing and not force:
        return existing[0]
    if existing and existing[0].get('modificado_manual') and not force:
        return existing[0]

    asig = supabase.table('asignaciones').select(
        'id,usuario_id,evento_id,cache_presupuestado,importe,estado_pago,porcentaje_asistencia'
    ).eq('id', asignacion_id).single().execute().data
    if not asig:
        return None
    if asig.get('estado_pago') != 'pagado' and not force:
        return None

    usuario = supabase.table('usuarios').select(
        'id,nombre,apellidos,email,dni,direccion,instrumento,iban'
    ).eq('id', asig['usuario_id']).single().execute().data
    evento = supabase.table('eventos').select(
        'id,nombre,fecha_inicio,lugar,temporada'
    ).eq('id', asig['evento_id']).single().execute().data
    if not usuario or not evento:
        return None

    # Importe bruto: importe real (= cache_presupuestado * pct_real / 100) o importe directo
    pct = asig.get('porcentaje_asistencia')
    cache_prev = asig.get('cache_presupuestado') or 0
    if pct is not None and cache_prev:
        bruto = float(cache_prev) * float(pct) / 100.0
    else:
        bruto = float(asig.get('importe') or cache_prev or 0)
    irpf_pct = _irpf_default()
    irpf_imp = round(bruto * irpf_pct / 100.0, 2)
    neto = round(bruto - irpf_imp, 2)

    # fecha_pago: si no se pasa, la de hoy
    if not fecha_pago:
        fecha_pago = date.today().isoformat()

    numero = (existing[0].get('numero') if existing else None) or _next_numero("recibo")

    vars_ = _build_common_vars(usuario, evento, evento.get('temporada'))
    vars_.update({
        "numero_recibo": numero,
        "concepto": f"Servicios musicales prestados como {usuario.get('instrumento','músico')} en «{evento.get('nombre','')}»",
        "fecha_pago": _fmt_date(fecha_pago),
        "importe_bruto": _format_money(bruto),
        "irpf_porcentaje": str(irpf_pct).rstrip("0").rstrip("."),
        "irpf_importe": _format_money(irpf_imp),
        "importe_neto": _format_money(neto),
        "iban": usuario.get('iban') or '—',
    })

    html = _render_html("recibo", vars_)
    pdf = html_to_pdf_bytes(html)
    path = f"recibos/{evento['id']}/{usuario['id']}_{asignacion_id[:8]}.pdf"
    url = upload_pdf(path, pdf)

    payload = {
        "asignacion_id": asignacion_id,
        "usuario_id": usuario['id'],
        "evento_id": evento['id'],
        "temporada": evento.get('temporada'),
        "numero": numero,
        "fecha_pago": fecha_pago,
        "importe_bruto": round(bruto, 2),
        "irpf_porcentaje": irpf_pct,
        "irpf_importe": irpf_imp,
        "importe_neto": neto,
        "iban_destino": usuario.get('iban'),
        "concepto": vars_["concepto"],
        "pdf_url": url,
        "pdf_path": path,
        "variables": vars_,
        "publicado": True,
        "actualizado_at": datetime.now(timezone.utc).isoformat(),
    }
    if existing:
        supabase.table('recibos').update(payload).eq('id', existing[0]['id']).execute()
        return supabase.table('recibos').select('*').eq('id', existing[0]['id']).single().execute().data
    payload["creado_at"] = payload["actualizado_at"]
    r = supabase.table('recibos').insert(payload).execute()
    return r.data[0] if r.data else None


def _fmt_date(s: Optional[str]) -> str:
    if not s: return '—'
    try:
        if isinstance(s, str) and len(s) >= 10:
            y, m, d = s[:10].split('-')
            return f"{d}/{m}/{y}"
    except Exception: pass
    return str(s)


# ============================================================================
# ENDPOINTS — Gestor
# ============================================================================

class EditarVariablesBody(BaseModel):
    variables: Dict[str, Any]


@router.get("/gestor/documentos/certificados")
async def listar_certificados_gestor(
    temporada: Optional[str] = None,
    evento_id: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    try:
        q = supabase.table('certificados').select(
            '*, usuario:usuarios(id,nombre,apellidos,email,instrumento,dni), '
            'evento:eventos(id,nombre,fecha_inicio,lugar,temporada,estado)'
        ).order('creado_at', desc=True)
        if temporada:
            q = q.eq('temporada', temporada)
        if evento_id:
            q = q.eq('evento_id', evento_id)
        return {"certificados": q.execute().data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gestor/documentos/recibos")
async def listar_recibos_gestor(
    temporada: Optional[str] = None,
    evento_id: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor),
):
    try:
        q = supabase.table('recibos').select(
            '*, usuario:usuarios(id,nombre,apellidos,email,instrumento,dni,iban), '
            'evento:eventos(id,nombre,fecha_inicio,temporada,estado)'
        ).order('creado_at', desc=True)
        if temporada:
            q = q.eq('temporada', temporada)
        if evento_id:
            q = q.eq('evento_id', evento_id)
        return {"recibos": q.execute().data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gestor/documentos/certificados/regenerar/{cert_id}")
async def regenerar_certificado(cert_id: str, current_user: dict = Depends(get_current_gestor)):
    try:
        c = supabase.table('certificados').select('usuario_id,evento_id').eq('id', cert_id).single().execute().data
        if not c:
            raise HTTPException(status_code=404, detail="No encontrado")
        out = generar_certificado(c['usuario_id'], c['evento_id'], force=True)
        return {"ok": True, "certificado": out}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gestor/documentos/recibos/regenerar/{recibo_id}")
async def regenerar_recibo(recibo_id: str, current_user: dict = Depends(get_current_gestor)):
    try:
        r = supabase.table('recibos').select('asignacion_id,fecha_pago').eq('id', recibo_id).single().execute().data
        if not r:
            raise HTTPException(status_code=404, detail="No encontrado")
        out = generar_recibo(r['asignacion_id'], fecha_pago=r.get('fecha_pago'), force=True)
        return {"ok": True, "recibo": out}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/gestor/documentos/certificados/{cert_id}")
async def editar_certificado(cert_id: str, body: EditarVariablesBody, current_user: dict = Depends(get_current_gestor)):
    """Modifica variables manualmente y re-renderiza el PDF."""
    try:
        c = supabase.table('certificados').select('*').eq('id', cert_id).single().execute().data
        if not c: raise HTTPException(status_code=404, detail="No encontrado")
        new_vars = {**(c.get('variables') or {}), **body.variables}
        # re-render
        html = _render_html("certificado", new_vars)
        pdf = html_to_pdf_bytes(html)
        url = upload_pdf(c['pdf_path'], pdf)
        supabase.table('certificados').update({
            "variables": new_vars,
            "horas_totales": float(new_vars.get('horas_totales') or c.get('horas_totales') or 0),
            "modificado_manual": True,
            "pdf_url": url,
            "actualizado_at": datetime.now(timezone.utc).isoformat(),
        }).eq('id', cert_id).execute()
        return {"ok": True, "pdf_url": url}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/gestor/documentos/recibos/{recibo_id}")
async def editar_recibo(recibo_id: str, body: EditarVariablesBody, current_user: dict = Depends(get_current_gestor)):
    try:
        c = supabase.table('recibos').select('*').eq('id', recibo_id).single().execute().data
        if not c: raise HTTPException(status_code=404, detail="No encontrado")
        new_vars = {**(c.get('variables') or {}), **body.variables}
        html = _render_html("recibo", new_vars)
        pdf = html_to_pdf_bytes(html)
        url = upload_pdf(c['pdf_path'], pdf)
        # actualizar también campos derivados si vienen
        upd: Dict[str, Any] = {
            "variables": new_vars,
            "modificado_manual": True,
            "pdf_url": url,
            "actualizado_at": datetime.now(timezone.utc).isoformat(),
        }
        for k_var, k_col in [
            ("importe_bruto","importe_bruto"), ("irpf_porcentaje","irpf_porcentaje"),
            ("irpf_importe","irpf_importe"), ("importe_neto","importe_neto"),
            ("iban","iban_destino"), ("concepto","concepto"),
        ]:
            if k_var in body.variables:
                v = body.variables[k_var]
                if isinstance(v, str) and k_col != "iban_destino" and k_col != "concepto":
                    v = float(str(v).replace(',', '.').replace('.', '', max(0, str(v).count('.')-1)))
                upd[k_col] = v
        if "fecha_pago" in body.variables:
            upd["fecha_pago"] = body.variables["fecha_pago"]
        supabase.table('recibos').update(upd).eq('id', recibo_id).execute()
        return {"ok": True, "pdf_url": url}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/gestor/documentos/certificados/{cert_id}/publicar")
async def togglepublicar_certificado(cert_id: str, body: dict, current_user: dict = Depends(get_current_gestor)):
    pub = bool(body.get('publicado', True))
    supabase.table('certificados').update({"publicado": pub, "actualizado_at": datetime.now(timezone.utc).isoformat()}).eq('id', cert_id).execute()
    return {"ok": True, "publicado": pub}


@router.put("/gestor/documentos/recibos/{recibo_id}/publicar")
async def togglepublicar_recibo(recibo_id: str, body: dict, current_user: dict = Depends(get_current_gestor)):
    pub = bool(body.get('publicado', True))
    supabase.table('recibos').update({"publicado": pub, "actualizado_at": datetime.now(timezone.utc).isoformat()}).eq('id', recibo_id).execute()
    return {"ok": True, "publicado": pub}


@router.post("/gestor/documentos/certificados/generar-evento/{evento_id}")
async def trigger_generar_certificados_evento(evento_id: str, current_user: dict = Depends(get_current_gestor)):
    return generar_certificados_evento(evento_id)


# ---- Descargas masivas (gestor) -------------------------------------------

class BulkDownloadBody(BaseModel):
    ids: List[str]
    formato: str = "zip"  # 'zip' | 'pdf'


def _safe_filename(s: str) -> str:
    return re.sub(r'[^A-Za-z0-9._-]+', '_', s or 'doc')[:120]


@router.post("/gestor/documentos/{tipo}/descargar")
async def descargar_bulk(tipo: str, body: BulkDownloadBody, current_user: dict = Depends(get_current_gestor)):
    if tipo not in ("certificados", "recibos"):
        raise HTTPException(status_code=400, detail="tipo inválido")
    if not body.ids:
        raise HTTPException(status_code=400, detail="ids vacíos")
    rows = supabase.table(tipo).select(
        '*, usuario:usuarios(nombre,apellidos), evento:eventos(nombre)'
    ).in_('id', body.ids).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="No se encontraron documentos")

    # descargar bytes en paralelo lógico (sin asyncio aquí — el SDK supabase es sync)
    items: List[tuple[str, bytes]] = []
    for r in rows:
        try:
            data = fetch_pdf_bytes(r.get('pdf_path') or r.get('pdf_url'))
        except Exception:
            continue
        u = r.get('usuario') or {}
        ev = r.get('evento') or {}
        fname = _safe_filename(f"{r.get('numero','doc')}_{u.get('apellidos','')}_{u.get('nombre','')}_{ev.get('nombre','')}") + ".pdf"
        items.append((fname, data))

    if not items:
        raise HTTPException(status_code=500, detail="No se pudo descargar ningún PDF")

    if body.formato == "pdf":
        merged = merge_pdfs([d for _, d in items])
        return StreamingResponse(io.BytesIO(merged), media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{tipo}_{date.today().isoformat()}.pdf"'})

    # ZIP
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname, data in items:
            zf.writestr(fname, data)
    zbuf.seek(0)
    return StreamingResponse(zbuf, media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{tipo}_{date.today().isoformat()}.zip"'})


# ============================================================================
# ENDPOINTS — Portal del músico
# ============================================================================

@router.get("/portal/mi-historial/certificados")
async def listar_certificados_musico(
    temporada: Optional[str] = None,
    current_user: dict = Depends(get_current_musico),
):
    try:
        usuario_id = (current_user.get('profile') or {}).get('id') or current_user.get('id')
        if not usuario_id:
            return {"certificados": []}
        q = supabase.table('certificados').select(
            'id,numero,horas_totales,pdf_url,creado_at,actualizado_at,temporada,publicado,'
            'evento:eventos(id,nombre,fecha_inicio,lugar,temporada,estado)'
        ).eq('usuario_id', usuario_id).eq('publicado', True).order('creado_at', desc=True)
        if temporada:
            q = q.eq('temporada', temporada)
        return {"certificados": q.execute().data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/portal/mi-historial/recibos")
async def listar_recibos_musico(
    temporada: Optional[str] = None,
    current_user: dict = Depends(get_current_musico),
):
    try:
        usuario_id = (current_user.get('profile') or {}).get('id') or current_user.get('id')
        if not usuario_id:
            return {"recibos": []}
        q = supabase.table('recibos').select(
            'id,numero,fecha_pago,importe_bruto,irpf_porcentaje,irpf_importe,importe_neto,'
            'pdf_url,creado_at,temporada,publicado,'
            'evento:eventos(id,nombre,fecha_inicio,temporada)'
        ).eq('usuario_id', usuario_id).eq('publicado', True).order('creado_at', desc=True)
        if temporada:
            q = q.eq('temporada', temporada)
        return {"recibos": q.execute().data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Background helpers para los hooks (usados por routes_gestor.py)
# ============================================================================

def hook_evento_finalizado(evento_id: str):
    """Llamado en background cuando un evento pasa a 'finalizado'."""
    try:
        return generar_certificados_evento(evento_id)
    except Exception:
        return {"creados": 0, "errores": 1}


def hook_pago_marcado(asignacion_id: str):
    """Llamado en background cuando se marca un pago como 'pagado'."""
    try:
        generar_recibo(asignacion_id, force=False)
    except Exception:
        pass


def hook_pagos_bulk(evento_id: str):
    """Cuando se marca pagos-bulk para un evento, generar recibos para todas las asignaciones."""
    try:
        asigs = supabase.table('asignaciones').select('id,estado_pago').eq('evento_id', evento_id).eq('estado', 'confirmado').eq('estado_pago', 'pagado').execute().data or []
        for a in asigs:
            try:
                generar_recibo(a['id'], force=False)
            except Exception:
                pass
    except Exception:
        pass
