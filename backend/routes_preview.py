"""Bloque B — Visualizador portal músico.

Endpoints:
  POST /api/gestor/preview/generar-token  (auth: admin/director_general)
  GET  /api/preview/{token}                (sin auth)

La vista preview es **solo lectura** y no reutiliza get_current_musico() ni las
rutas reales del portal: obtiene los datos directamente de Supabase con la
service-key para que el iframe pueda cargar la vista sin que el músico haya
iniciado sesión.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
import secrets
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from supabase_client import supabase
from auth_utils import get_current_gestor

router = APIRouter(prefix="/api", tags=["preview-musico"])

TOKEN_TTL_MIN = 30


def _is_admin(user: dict) -> bool:
    rol = (user or {}).get("rol") or ((user or {}).get("profile") or {}).get("rol")
    if rol in ("admin", "director_general"):
        return True
    email = ((user or {}).get("email") or ((user or {}).get("profile") or {}).get("email") or "").lower()
    return email == "admin@convocatorias.com"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _mask_iban(iban: Optional[str]) -> str:
    if not iban:
        return ""
    s = "".join(c for c in str(iban) if c.isalnum())
    if len(s) <= 4:
        return "****"
    return "**** **** **** " + s[-4:]


# =============================================================================
# POST /api/gestor/preview/generar-token
# =============================================================================
class GenerarTokenBody(BaseModel):
    musico_id: str


@router.post("/gestor/preview/generar-token")
async def generar_token_preview(body: GenerarTokenBody, current_user: dict = Depends(get_current_gestor)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo administradores y director general")

    gestor_id = (current_user.get("profile") or {}).get("id") or current_user.get("id")
    if not gestor_id:
        raise HTTPException(status_code=400, detail="Gestor sin id")
    # Verificar que gestor_id existe en tabla usuarios (por el FK)
    gcheck = supabase.table("usuarios").select("id").eq("id", gestor_id).limit(1).execute().data or []
    if not gcheck:
        # fallback por email
        email = (current_user.get("email") or (current_user.get("profile") or {}).get("email") or "").lower()
        if email:
            u = supabase.table("usuarios").select("id").eq("email", email).limit(1).execute().data or []
            if u:
                gestor_id = u[0]["id"]
        gcheck = supabase.table("usuarios").select("id").eq("id", gestor_id).limit(1).execute().data or []
        if not gcheck:
            raise HTTPException(status_code=400, detail="Gestor no resuelto en tabla usuarios")

    mus = supabase.table("usuarios") \
        .select("id,nombre,apellidos,instrumento,rol") \
        .eq("id", body.musico_id).limit(1).execute().data or []
    if not mus:
        raise HTTPException(status_code=404, detail="Músico no encontrado")
    if mus[0].get("rol") != "musico":
        raise HTTPException(status_code=400, detail="El usuario no tiene rol de músico")

    # Desactivar tokens anteriores del mismo gestor hacia ese músico
    try:
        supabase.table("impersonacion_tokens").update({"activo": False}) \
            .eq("gestor_id", gestor_id).eq("musico_id", body.musico_id).eq("activo", True).execute()
    except Exception:
        pass

    token = secrets.token_urlsafe(24)
    expira = _now_utc() + timedelta(minutes=TOKEN_TTL_MIN)
    r = supabase.table("impersonacion_tokens").insert({
        "token": token,
        "musico_id": body.musico_id,
        "gestor_id": gestor_id,
        "expira_at": expira.isoformat(),
        "activo": True,
    }).execute()
    fila = (r.data or [None])[0] or {}
    m = mus[0]
    return {
        "token": fila.get("token", token),
        "expira_at": fila.get("expira_at") or expira.isoformat(),
        "musico_nombre": f"{m.get('nombre','')} {m.get('apellidos','')}".strip(),
        "musico_instrumento": m.get("instrumento"),
        "musico_id": m.get("id"),
    }


# =============================================================================
# GET /api/preview/{token}  (sin auth)
# =============================================================================
@router.get("/preview/{token}")
async def obtener_preview(token: str):
    rows = supabase.table("impersonacion_tokens").select("*").eq("token", token).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Token no encontrado")
    t = rows[0]
    if not t.get("activo"):
        raise HTTPException(status_code=410, detail="Token desactivado")
    try:
        exp = datetime.fromisoformat(str(t.get("expira_at")).replace("Z", "+00:00"))
    except Exception:
        exp = _now_utc() - timedelta(minutes=1)
    if exp <= _now_utc():
        raise HTTPException(status_code=410, detail="Token expirado")

    musico_id = t["musico_id"]
    # Marcar usado
    try:
        supabase.table("impersonacion_tokens").update({"usado_at": _now_utc().isoformat()}).eq("id", t["id"]).execute()
    except Exception:
        pass

    # ---- Perfil del músico ----
    u = supabase.table("usuarios").select(
        "id,nombre,apellidos,email,telefono,instrumento,nivel_estudios,localidad,iban,foto_url,cv_url,rol,especialidad,anos_experiencia,titulaciones,otros_instrumentos"
    ).eq("id", musico_id).limit(1).execute().data or []
    if not u:
        raise HTTPException(status_code=404, detail="Músico no encontrado")
    perfil = u[0]
    perfil_safe = {**perfil, "iban_masked": _mask_iban(perfil.pop("iban", None))}

    # Titulaciones — puede venir ya en el campo titulaciones (jsonb) del usuario; también admitimos tabla auxiliar.
    titulaciones = perfil.get("titulaciones") or []
    try:
        titu_rows = supabase.table("usuarios_titulaciones").select("*").eq("usuario_id", musico_id).execute().data or []
        if titu_rows:
            titulaciones = titu_rows
    except Exception:
        pass

    # ---- Eventos asignados y publicados ----
    try:
        asigs = supabase.table("asignaciones").select("*, evento:eventos(*)") \
            .eq("usuario_id", musico_id).order("created_at", desc=True).execute().data or []
    except Exception:
        asigs = []
    asigs = [a for a in asigs if bool(a.get("publicado_musico")) and a.get("estado") != "excluido"]
    # Limpiar datos sensibles
    for a in asigs:
        ev = a.get("evento") or {}
        ev.pop("notas", None)
        ev.pop("gestor_id", None)
        a["evento"] = ev

    evento_ids = list({a.get("evento_id") for a in asigs if a.get("evento_id")})

    # Ensayos + disponibilidad del músico
    ensayos_by_ev: Dict[str, List[Dict]] = {}
    disp_map: Dict[str, Any] = {}
    if evento_ids:
        try:
            ens = supabase.table("ensayos").select("*").in_("evento_id", evento_ids) \
                .order("fecha", desc=False).execute().data or []
        except Exception:
            ens = []
        for e in ens:
            ensayos_by_ev.setdefault(e["evento_id"], []).append(e)
        try:
            ens_ids = [e["id"] for e in ens]
            if ens_ids:
                ds = supabase.table("disponibilidad").select("ensayo_id,disponible") \
                    .eq("usuario_id", musico_id).in_("ensayo_id", ens_ids).execute().data or []
                disp_map = {d["ensayo_id"]: d.get("disponible") for d in ds}
        except Exception:
            disp_map = {}

    eventos_out = []
    for a in asigs:
        ev = a.get("evento") or {}
        ev_id = ev.get("id")
        ens_lista = ensayos_by_ev.get(ev_id, [])
        for e in ens_lista:
            e["mi_disponibilidad"] = disp_map.get(e["id"])
        eventos_out.append({
            "asignacion_id": a.get("id"),
            "estado_asignacion": a.get("estado"),
            "evento": ev,
            "ensayos": ens_lista,
        })

    # ---- Calendario ----
    calendario: List[Dict] = []
    if evento_ids:
        try:
            ens_abiertos = supabase.table("ensayos").select("*, evento:eventos(id,nombre,estado)") \
                .in_("evento_id", evento_ids).execute().data or []
        except Exception:
            ens_abiertos = []
        for e in ens_abiertos:
            tipo = (e.get("tipo") or "ensayo").lower()
            color = "green" if tipo in ("concierto", "funcion", "función") else "blue"
            calendario.append({
                "id": e["id"], "tipo": tipo, "color": color,
                "fecha": e.get("fecha"), "hora": e.get("hora") or e.get("hora_inicio"),
                "hora_fin": e.get("hora_fin"),
                "lugar": e.get("lugar"),
                "evento_nombre": (e.get("evento") or {}).get("nombre"),
            })
        # Transportes (logistica)
        try:
            log_res = supabase.table("logistica").select("*, evento:eventos(id,nombre)") \
                .eq("usuario_id", musico_id).in_("evento_id", evento_ids).execute().data or []
        except Exception:
            log_res = []
        for lg in log_res:
            if lg.get("fecha_ida"):
                calendario.append({"id": f"log-ida-{lg['id']}", "tipo": "transporte", "color": "orange",
                                   "fecha": lg["fecha_ida"], "hora": lg.get("hora_ida"),
                                   "evento_nombre": (lg.get("evento") or {}).get("nombre")})
            if lg.get("fecha_vuelta"):
                calendario.append({"id": f"log-vuelta-{lg['id']}", "tipo": "transporte", "color": "orange",
                                   "fecha": lg["fecha_vuelta"], "hora": lg.get("hora_vuelta"),
                                   "evento_nombre": (lg.get("evento") or {}).get("nombre")})
            if lg.get("hotel_checkin") or lg.get("hotel_checkout"):
                calendario.append({"id": f"log-aloj-{lg['id']}", "tipo": "alojamiento", "color": "purple",
                                   "fecha": lg.get("hotel_checkin") or lg.get("fecha_ida"),
                                   "evento_nombre": (lg.get("evento") or {}).get("nombre"),
                                   "hotel": lg.get("hotel_nombre")})

    # ---- Pagos ----
    try:
        pagos = supabase.table("pagos").select("*, evento:eventos(id,nombre)") \
            .eq("usuario_id", musico_id).order("fecha_pago", desc=True).execute().data or []
    except Exception:
        pagos = []

    # ---- Certificados ----
    try:
        certs = supabase.table("certificados").select("*, evento:eventos(id,nombre,temporada)") \
            .eq("usuario_id", musico_id).order("created_at", desc=True).execute().data or []
    except Exception:
        certs = []

    # ---- Reclamaciones ----
    try:
        recl = supabase.table("reclamaciones").select("*").eq("usuario_id", musico_id).order("created_at", desc=True).execute().data or []
    except Exception:
        recl = []

    # ---- Comidas ----
    comidas: List[Dict] = []
    try:
        if evento_ids:
            comidas = supabase.table("confirmaciones_comida").select("*, comida:evento_comidas(*)") \
                .eq("usuario_id", musico_id).execute().data or []
    except Exception:
        comidas = []

    # ---- Recibos ----
    try:
        asig_ids = [a.get("asignacion_id") for a in [{"asignacion_id": x.get("id")} for x in asigs] if a.get("asignacion_id")]
        recibos = []
        if asig_ids:
            recibos = supabase.table("recibos").select("*").in_("asignacion_id", asig_ids).execute().data or []
    except Exception:
        recibos = []

    return {
        "preview": True,
        "expira_at": t.get("expira_at"),
        "musico": {**perfil_safe, "titulaciones": titulaciones},
        "eventos": eventos_out,
        "calendario": calendario,
        "pagos": pagos,
        "recibos": recibos,
        "certificados": certs,
        "reclamaciones": recl,
        "comidas": comidas,
    }
