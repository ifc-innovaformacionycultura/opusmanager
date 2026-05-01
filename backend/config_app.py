"""Configuración global de la app (configuracion_app + fichaje_config global).
Reemplaza el uso de variables de entorno DIRECTOR_NOMBRE / IRPF_PORCENTAJE / ORG_*.
Cachea resultados 5 minutos.
"""
from __future__ import annotations
import time
from typing import Dict, Any, Optional
from supabase_client import supabase

_CACHE: Dict[str, Any] = {"data": None, "ts": 0.0}
_CACHE_FICHAJE: Dict[str, Any] = {"data": None, "ts": 0.0}
_TTL = 300  # 5 min


def get_config(force: bool = False) -> Dict[str, Any]:
    """Devuelve la fila única de configuracion_app (con caché)."""
    if not force and _CACHE["data"] and time.time() - _CACHE["ts"] < _TTL:
        return _CACHE["data"]
    try:
        r = supabase.table("configuracion_app").select("*").limit(1).execute()
        data = (r.data or [{}])[0] if r.data else {}
    except Exception:
        data = {}
    _CACHE["data"] = data
    _CACHE["ts"] = time.time()
    return data


def invalidate_config():
    _CACHE["data"] = None
    _CACHE["ts"] = 0.0


def get_fichaje_global(force: bool = False) -> Dict[str, Any]:
    """Devuelve la fila global de fichaje_config (es_configuracion_global=TRUE)."""
    if not force and _CACHE_FICHAJE["data"] and time.time() - _CACHE_FICHAJE["ts"] < _TTL:
        return _CACHE_FICHAJE["data"]
    try:
        r = supabase.table("fichaje_config").select("*") \
            .eq("es_configuracion_global", True).limit(1).execute()
        data = (r.data or [{
            "minutos_antes_apertura": 30,
            "minutos_despues_cierre": 30,
            "minutos_retraso_aviso": 5,
            "computa_tiempo_extra": False,
            "computa_mas_alla_fin": False,
        }])[0]
    except Exception:
        data = {
            "minutos_antes_apertura": 30,
            "minutos_despues_cierre": 30,
            "minutos_retraso_aviso": 5,
            "computa_tiempo_extra": False,
            "computa_mas_alla_fin": False,
        }
    _CACHE_FICHAJE["data"] = data
    _CACHE_FICHAJE["ts"] = time.time()
    return data


def invalidate_fichaje_global():
    _CACHE_FICHAJE["data"] = None
    _CACHE_FICHAJE["ts"] = 0.0


# Helpers que sustituyen a os.environ.get() ----------------------------------

def director_nombre() -> str:
    return (get_config().get("director_nombre") or "Director/a de la orquesta").strip()

def director_cargo() -> str:
    return (get_config().get("director_cargo") or "Director General").strip()

def director_firma_url() -> str:
    return (get_config().get("director_firma_url") or "").strip()

def irpf_porcentaje() -> float:
    try:
        return float(get_config().get("irpf_porcentaje") or 15)
    except Exception:
        return 15.0

def org_nombre() -> str:
    return (get_config().get("org_nombre") or "IFC OPUS Manager").strip()

def org_cif() -> str:
    return (get_config().get("org_cif") or "").strip()

def org_direccion() -> str:
    return (get_config().get("org_direccion") or "").strip()
