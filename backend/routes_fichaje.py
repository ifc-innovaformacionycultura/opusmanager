"""Sistema de fichaje QR (Bloque 2).

Endpoints:
- GET  /api/gestor/registro-asistencia
- POST /api/gestor/ensayo-qr/{ensayo_id}/regenerar
- GET  /api/gestor/ensayo-qr/{ensayo_id}/png         (PNG del QR)
- GET  /api/gestor/fichaje-config/{ensayo_id}
- PUT  /api/gestor/fichaje-config/{ensayo_id}
- POST /api/fichaje/entrada/{token}                  (público con token)
- POST /api/fichaje/salida/{token}                   (público con token)
- POST /api/fichaje/salida-manual/{ensayo_id}        (autenticado, sin QR)
- GET  /api/fichaje/info/{token}                     (info pública para /fichar/:token)
- GET  /api/fichaje/estado/{ensayo_id}/{usuario_id}  (estado del fichaje del músico)
"""
from __future__ import annotations
import io
import secrets
from datetime import datetime, date, time, timedelta, timezone
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, HTTPException, Depends, Response, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import qrcode

from supabase_client import supabase
from auth_utils import get_current_gestor, get_current_user
from config_app import get_fichaje_global

router = APIRouter(prefix="/api", tags=["fichaje"])


# ============================================================================
# Helpers
# ============================================================================

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_qr_token(ensayo_id: str) -> Dict[str, Any]:
    """Devuelve el token QR activo del ensayo, creándolo si no existe."""
    rows = supabase.table("ensayo_qr").select("*").eq("ensayo_id", ensayo_id).eq("activo", True).order("created_at", desc=True).limit(1).execute().data or []
    if rows:
        return rows[0]
    token = secrets.token_urlsafe(20)
    r = supabase.table("ensayo_qr").insert({"ensayo_id": ensayo_id, "token": token, "activo": True}).execute()
    return (r.data or [None])[0] or {"ensayo_id": ensayo_id, "token": token, "activo": True}


def _config_for_ensayo(ensayo_id: str) -> Dict[str, Any]:
    rows = supabase.table("fichaje_config").select("*").eq("ensayo_id", ensayo_id).limit(1).execute().data or []
    if rows:
        return rows[0]
    return get_fichaje_global()


def _parse_dt(d: Optional[str], t: Optional[str]) -> Optional[datetime]:
    """Combina fecha (YYYY-MM-DD) + hora (HH:MM[:SS]) → datetime UTC-aware (asume hora local Madrid → UTC para simplicidad)."""
    if not d:
        return None
    try:
        date_str = d[:10]
        time_str = (t or "00:00:00")[:8]
        if len(time_str) == 5:
            time_str += ":00"
        dt = datetime.fromisoformat(f"{date_str}T{time_str}")
        # Asumimos hora local; convertimos a UTC suponiendo offset CET/CEST (+1/+2). Para simplicidad usamos UTC directo ya que los timestamps de fichaje también vendrán en local convertidos por el cliente.
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _ensayo_full(ensayo_id: str) -> Optional[Dict[str, Any]]:
    rows = supabase.table("ensayos").select("*, evento:eventos(id,nombre,temporada,lugar)").eq("id", ensayo_id).limit(1).execute().data or []
    return rows[0] if rows else None


# ============================================================================
# GESTOR — Registro de asistencia
# ============================================================================

@router.get("/gestor/fichajes-evento/{evento_id}")
async def fichajes_por_evento(evento_id: str, current_user: dict = Depends(get_current_gestor)):
    """Devuelve {usuario_id: {ensayo_id: fichaje_min}} para usar en PlantillasDefinitivas (Bloque 2F, solo lectura)."""
    ensayos = supabase.table("ensayos").select("id").eq("evento_id", evento_id).execute().data or []
    ens_ids = [e["id"] for e in ensayos]
    if not ens_ids:
        return {"fichajes": {}}
    rows = supabase.table("fichajes").select(
        "usuario_id,ensayo_id,hora_entrada_computada,hora_salida_computada,minutos_totales,porcentaje_asistencia,alerta_retraso,alerta_no_asistencia,alerta_salida_pendiente"
    ).in_("ensayo_id", ens_ids).execute().data or []
    out: Dict[str, Dict[str, Any]] = {}
    for f in rows:
        out.setdefault(f["usuario_id"], {})[f["ensayo_id"]] = f
    return {"fichajes": out}


@router.get("/gestor/registro-asistencia")
async def registro_asistencia(temporada: Optional[str] = None, current_user: dict = Depends(get_current_gestor)):
    """Devuelve eventos con sus ensayos, QR tokens y fichajes (para acordeones)."""
    try:
        eq = supabase.table("eventos").select("id,nombre,temporada,fecha_inicio,fecha_fin,lugar,estado").order("fecha_inicio", desc=True)
        if temporada:
            eq = eq.eq("temporada", temporada)
        eventos = eq.execute().data or []
        if not eventos:
            return {"eventos": []}

        ev_ids = [e["id"] for e in eventos]
        ensayos = supabase.table("ensayos").select("*").in_("evento_id", ev_ids).order("fecha", desc=False).execute().data or []
        ens_ids = [e["id"] for e in ensayos]

        qrs: Dict[str, Dict] = {}
        if ens_ids:
            qr_rows = supabase.table("ensayo_qr").select("*").in_("ensayo_id", ens_ids).eq("activo", True).execute().data or []
            qrs = {q["ensayo_id"]: q for q in qr_rows}

        fichajes_by_ens: Dict[str, List[Dict]] = {}
        if ens_ids:
            fr = supabase.table("fichajes").select("*, usuario:usuarios(id,nombre,apellidos,instrumento)").in_("ensayo_id", ens_ids).execute().data or []
            for f in fr:
                fichajes_by_ens.setdefault(f["ensayo_id"], []).append(f)

        cfgs: Dict[str, Dict] = {}
        if ens_ids:
            cr = supabase.table("fichaje_config").select("*").in_("ensayo_id", ens_ids).execute().data or []
            cfgs = {c["ensayo_id"]: c for c in cr}

        out = []
        for ev in eventos:
            ev_ensayos = [e for e in ensayos if e["evento_id"] == ev["id"]]
            for e in ev_ensayos:
                e["qr"] = qrs.get(e["id"])
                e["fichajes"] = fichajes_by_ens.get(e["id"], [])
                e["config_fichaje"] = cfgs.get(e["id"]) or get_fichaje_global()
            out.append({**ev, "ensayos": ev_ensayos})
        return {"eventos": out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gestor/ensayo-qr/{ensayo_id}/regenerar")
async def regenerar_qr(ensayo_id: str, current_user: dict = Depends(get_current_gestor)):
    # Desactivar anteriores
    supabase.table("ensayo_qr").update({"activo": False}).eq("ensayo_id", ensayo_id).execute()
    token = secrets.token_urlsafe(20)
    r = supabase.table("ensayo_qr").insert({"ensayo_id": ensayo_id, "token": token, "activo": True}).execute()
    return {"ok": True, "qr": (r.data or [None])[0]}


@router.get("/gestor/ensayo-qr/{ensayo_id}/png")
async def qr_png(ensayo_id: str, request: "Request" = None, current_user: dict = Depends(get_current_gestor)):
    """Devuelve PNG con el QR. La URL contenida apunta a /fichar/{token}.
    El host se toma del header X-Public-Url, query ?host=, o del Origin del request.
    """
    qr = _ensure_qr_token(ensayo_id)
    import os
    host = ""
    if request is not None:
        host = (request.query_params.get("host") or request.headers.get("x-public-url") or request.headers.get("origin") or "").rstrip("/")
    if not host:
        host = os.environ.get("PUBLIC_APP_URL", "").rstrip("/")
    url = f"{host}/fichar/{qr['token']}"
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png",
                             headers={"Content-Disposition": f'attachment; filename="qr_ensayo_{ensayo_id[:8]}.png"',
                                      "X-Fichar-URL": url})


class FichajeConfigUpdate(BaseModel):
    minutos_antes_apertura: Optional[int] = None
    minutos_despues_cierre: Optional[int] = None
    minutos_retraso_aviso: Optional[int] = None
    computa_tiempo_extra: Optional[bool] = None
    computa_mas_alla_fin: Optional[bool] = None


@router.put("/gestor/fichaje-config/{ensayo_id}")
async def upsert_config_ensayo(ensayo_id: str, data: FichajeConfigUpdate, current_user: dict = Depends(get_current_gestor)):
    payload = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    existing = supabase.table("fichaje_config").select("id").eq("ensayo_id", ensayo_id).limit(1).execute().data or []
    if existing:
        supabase.table("fichaje_config").update(payload).eq("id", existing[0]["id"]).execute()
    else:
        ev = supabase.table("ensayos").select("evento_id").eq("id", ensayo_id).limit(1).execute().data or []
        payload.update({"ensayo_id": ensayo_id, "es_configuracion_global": False, "evento_id": (ev[0] if ev else {}).get("evento_id")})
        supabase.table("fichaje_config").insert(payload).execute()
    return {"ok": True, "config": _config_for_ensayo(ensayo_id)}


# ============================================================================
# Endpoints públicos / del músico
# ============================================================================

@router.get("/fichaje/info/{token}")
async def fichaje_info(token: str):
    qr = supabase.table("ensayo_qr").select("ensayo_id,activo").eq("token", token).limit(1).execute().data or []
    if not qr or not qr[0].get("activo"):
        raise HTTPException(status_code=404, detail="QR no válido o expirado")
    ens = _ensayo_full(qr[0]["ensayo_id"])
    if not ens:
        raise HTTPException(status_code=404, detail="Ensayo no encontrado")
    return {"ensayo": {
        "id": ens["id"], "fecha": ens.get("fecha"), "hora_inicio": ens.get("hora_inicio"),
        "hora_fin": ens.get("hora_fin"), "tipo": ens.get("tipo"), "lugar": ens.get("lugar"),
        "evento_nombre": (ens.get("evento") or {}).get("nombre"),
    }}


def _calcular_entrada(ensayo: Dict, cfg: Dict, ahora: datetime) -> Dict[str, Any]:
    """Determina hora_entrada_computada y alertas dado el momento real de entrada."""
    inicio = _parse_dt(ensayo.get("fecha"), ensayo.get("hora_inicio"))
    if not inicio:
        return {"computada": ahora, "alerta_retraso": False, "min_diff": 0}
    diff_min = int((ahora - inicio).total_seconds() // 60)
    if diff_min < 0:
        # Llega antes
        if cfg.get("computa_tiempo_extra"):
            return {"computada": ahora, "alerta_retraso": False, "min_diff": diff_min}
        return {"computada": inicio, "alerta_retraso": False, "min_diff": diff_min}
    # Llega tarde
    alerta = diff_min > int(cfg.get("minutos_retraso_aviso") or 5)
    return {"computada": ahora, "alerta_retraso": alerta, "min_diff": diff_min}


def _calcular_salida(ensayo: Dict, cfg: Dict, ahora: datetime) -> datetime:
    fin = _parse_dt(ensayo.get("fecha"), ensayo.get("hora_fin"))
    if not fin:
        return ahora
    if ahora <= fin:
        return ahora
    return ahora if cfg.get("computa_mas_alla_fin") else fin


class FichajePayload(BaseModel):
    usuario_id: Optional[str] = None
    timestamp: Optional[str] = None  # ISO; si no, server time


def _resolve_user(payload: FichajePayload, current: Optional[dict] = None) -> Optional[str]:
    if payload.usuario_id:
        return payload.usuario_id
    if not current:
        return None
    return current.get("id") or (current.get("profile") or {}).get("id")


def _now_or_payload(payload: FichajePayload) -> datetime:
    if payload.timestamp:
        try:
            return datetime.fromisoformat(payload.timestamp.replace("Z", "+00:00"))
        except Exception:
            pass
    return _now_utc()


def _ensayo_window_ok(ensayo: Dict, cfg: Dict, ahora: datetime) -> bool:
    inicio = _parse_dt(ensayo.get("fecha"), ensayo.get("hora_inicio"))
    fin = _parse_dt(ensayo.get("fecha"), ensayo.get("hora_fin"))
    if not inicio:
        return False
    apertura = inicio - timedelta(minutes=int(cfg.get("minutos_antes_apertura") or 30))
    cierre = (fin or inicio) + timedelta(minutes=int(cfg.get("minutos_despues_cierre") or 30))
    return apertura <= ahora <= cierre


@router.post("/fichaje/entrada/{token}")
async def fichaje_entrada(token: str, payload: FichajePayload, current_user: dict = Depends(get_current_user)):
    qr = supabase.table("ensayo_qr").select("ensayo_id,activo").eq("token", token).limit(1).execute().data or []
    if not qr or not qr[0].get("activo"):
        raise HTTPException(status_code=400, detail="QR no válido o expirado")
    ensayo_id = qr[0]["ensayo_id"]
    ensayo = _ensayo_full(ensayo_id)
    if not ensayo:
        raise HTTPException(status_code=404, detail="Ensayo no encontrado")
    cfg = _config_for_ensayo(ensayo_id)
    ahora = _now_or_payload(payload)
    if not _ensayo_window_ok(ensayo, cfg, ahora):
        raise HTTPException(status_code=400, detail="Fuera de la ventana permitida para fichar")
    user_id = _resolve_user(payload, current_user)
    if not user_id:
        raise HTTPException(status_code=400, detail="usuario_id requerido")

    calc = _calcular_entrada(ensayo, cfg, ahora)
    body = {
        "ensayo_id": ensayo_id,
        "usuario_id": user_id,
        "hora_entrada_real": ahora.isoformat(),
        "hora_entrada_computada": calc["computada"].isoformat(),
        "via_entrada": "qr",
        "alerta_retraso": calc["alerta_retraso"],
        "alerta_no_asistencia": False,
        "alerta_salida_pendiente": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    existing = supabase.table("fichajes").select("id").eq("ensayo_id", ensayo_id).eq("usuario_id", user_id).limit(1).execute().data or []
    if existing:
        supabase.table("fichajes").update(body).eq("id", existing[0]["id"]).execute()
    else:
        supabase.table("fichajes").insert(body).execute()
    return {"ok": True, "mensaje": "Entrada registrada", "hora_computada": calc["computada"].isoformat(),
            "alerta_retraso": calc["alerta_retraso"], "ensayo": {"id": ensayo_id, "evento": (ensayo.get("evento") or {}).get("nombre")}}


@router.post("/fichaje/salida/{token}")
async def fichaje_salida(token: str, payload: FichajePayload, current_user: dict = Depends(get_current_user)):
    qr = supabase.table("ensayo_qr").select("ensayo_id,activo").eq("token", token).limit(1).execute().data or []
    if not qr or not qr[0].get("activo"):
        raise HTTPException(status_code=400, detail="QR no válido o expirado")
    ensayo_id = qr[0]["ensayo_id"]
    return await _registrar_salida(ensayo_id, payload, current_user, via="qr")


@router.post("/fichaje/salida-manual/{ensayo_id}")
async def fichaje_salida_manual(ensayo_id: str, payload: FichajePayload, current_user: dict = Depends(get_current_user)):
    return await _registrar_salida(ensayo_id, payload, current_user, via="manual")


async def _registrar_salida(ensayo_id: str, payload: FichajePayload, current_user: dict, via: str):
    ensayo = _ensayo_full(ensayo_id)
    if not ensayo:
        raise HTTPException(status_code=404, detail="Ensayo no encontrado")
    cfg = _config_for_ensayo(ensayo_id)
    ahora = _now_or_payload(payload)
    user_id = _resolve_user(payload, current_user)
    if not user_id:
        raise HTTPException(status_code=400, detail="usuario_id requerido")

    rows = supabase.table("fichajes").select("*").eq("ensayo_id", ensayo_id).eq("usuario_id", user_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=400, detail="No hay entrada registrada para este ensayo")
    row = rows[0]

    salida_comp = _calcular_salida(ensayo, cfg, ahora)
    entrada_comp = datetime.fromisoformat(row["hora_entrada_computada"].replace("Z", "+00:00"))
    minutos_totales = max(0, int((salida_comp - entrada_comp).total_seconds() // 60))

    inicio = _parse_dt(ensayo.get("fecha"), ensayo.get("hora_inicio"))
    fin = _parse_dt(ensayo.get("fecha"), ensayo.get("hora_fin"))
    duracion_prevista = max(1, int(((fin or inicio) - inicio).total_seconds() // 60)) if (inicio and fin) else max(1, minutos_totales)
    pct = round(min(100.0, (minutos_totales / duracion_prevista) * 100), 2)

    upd = {
        "hora_salida_real": ahora.isoformat(),
        "hora_salida_computada": salida_comp.isoformat(),
        "via_salida": via,
        "minutos_totales": minutos_totales,
        "porcentaje_asistencia": pct,
        "alerta_salida_pendiente": False,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("fichajes").update(upd).eq("id", row["id"]).execute()
    return {"ok": True, "mensaje": "Salida registrada", "hora_computada": salida_comp.isoformat(),
            "minutos_totales": minutos_totales, "porcentaje_asistencia": pct,
            "ensayo": {"id": ensayo_id}}


@router.get("/fichaje/estado/{ensayo_id}/{usuario_id}")
async def fichaje_estado(ensayo_id: str, usuario_id: str, current_user: dict = Depends(get_current_user)):
    rows = supabase.table("fichajes").select("*").eq("ensayo_id", ensayo_id).eq("usuario_id", usuario_id).limit(1).execute().data or []
    if not rows:
        return {"estado": "sin_fichar"}
    f = rows[0]
    if not f.get("hora_salida_real"):
        return {"estado": "entrada_registrada", "fichaje": f}
    return {"estado": "completo", "fichaje": f}
