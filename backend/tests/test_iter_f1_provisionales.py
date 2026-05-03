"""Iter F1 — Importes provisionales (cache_extra y transporte) en PlantillasDefinitivas.

Reglas:
 - Gestor normal introduce cache_extra/transporte → fila gastos_adicionales con *_provisional=TRUE,
   NO computa en TOTAL, push+notif a admins+director_general.
 - Super admin (admin/director_general) introduce → *_provisional=FALSE inmediato,
   computa, validado_por=admin_id, validado_at=NOW.
 - POST /api/gestor/gastos/{id}/validar — solo super admins; campos cache_extra | transporte.
 - GET /api/gestor/pendientes — importes_pendientes_validacion solo super admins (gestores → 0).
 - GET /api/gestor/gestion-economica — mismo cálculo TOTAL que plantillas-definitivas.

Cleanup obligatorio: poner cache_extra=0 y transporte_importe=0 en gastos modificados.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # Cargar desde frontend/.env si no está en env
    try:
        with open('/app/frontend/.env') as _f:
            for _line in _f:
                if _line.startswith('REACT_APP_BACKEND_URL='):
                    BASE_URL = _line.split('=', 1)[1].strip().rstrip('/')
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL no definido"

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASSWORD = "Admin123!"
GESTOR_EMAIL = "palvarez@netmetrix.es"
GESTOR_PASSWORD = "Opus2026!"

EVENTO_ID = "c4409142-8ca9-4a98-8c59-e9bd88b5d529"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login {email}: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token") or (data.get("session") or {}).get("access_token")
    assert token
    return token


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN_EMAIL, ADMIN_PASSWORD)}",
            "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def gestor_headers():
    try:
        t = _login(GESTOR_EMAIL, GESTOR_PASSWORD)
    except AssertionError as e:
        pytest.skip(f"Gestor login: {e}")
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def _get_plantilla(headers, evento_id=EVENTO_ID):
    r = requests.get(f"{BASE_URL}/api/gestor/plantillas-definitivas",
                     headers=headers, params={"evento_id": evento_id}, timeout=30)
    assert r.status_code == 200, f"plantillas-definitivas: {r.status_code} {r.text[:200]}"
    return r.json()


def _ensure_evento_abierto(admin_headers):
    requests.post(f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/reabrir-economico",
                  headers=admin_headers, timeout=20)
    requests.post(f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/reabrir-plantilla",
                  headers=admin_headers, timeout=20)


def _put_guardar(headers, evento_id, usuario_id, cache_extra=None, transporte_importe=None):
    """PUT /plantillas-definitivas/guardar con shape {gastos:[GastoItem]}."""
    item = {"usuario_id": usuario_id, "evento_id": evento_id}
    if cache_extra is not None:
        item["cache_extra"] = cache_extra
    if transporte_importe is not None:
        item["transporte_importe"] = transporte_importe
    body = {"asistencias": [], "gastos": [item], "anotaciones": []}
    r = requests.put(f"{BASE_URL}/api/gestor/plantillas-definitivas/guardar",
                     json=body, headers=headers, timeout=30)
    return r


# Encuentra un usuario de la plantilla del EVENTO_ID y captura gasto_id (tras escribir).
@pytest.fixture(scope="module")
def target_musico(admin_headers):
    _ensure_evento_abierto(admin_headers)
    data = _get_plantilla(admin_headers)
    evs = data.get("eventos", [])
    ev = next((e for e in evs if e.get("id") == EVENTO_ID), None)
    assert ev is not None, f"Evento {EVENTO_ID} no encontrado en plantillas-definitivas"
    musicos = []
    for sec in ev.get("secciones", []):
        for m in sec.get("musicos", []):
            musicos.append(m)
    assert musicos, "No hay músicos en plantilla del evento"
    m = musicos[0]
    return {"usuario_id": m.get("usuario_id"), "evento_id": EVENTO_ID, "raw": m}


def _find_musico_in_plantilla(data, usuario_id, evento_id=EVENTO_ID):
    evs = data.get("eventos", []) if isinstance(data, dict) else []
    ev = next((e for e in evs if e.get("id") == evento_id), None)
    if not ev:
        return None
    for sec in ev.get("secciones", []):
        for m in sec.get("musicos", []):
            if m.get("usuario_id") == usuario_id:
                return m
    return None


# ============================================================
# 1) Schema GET plantillas-definitivas
# ============================================================
class TestSchemaPlantillas:
    def test_campos_provisional_presentes(self, admin_headers, target_musico):
        data = _get_plantilla(admin_headers)
        m = _find_musico_in_plantilla(data, target_musico["usuario_id"])
        assert m is not None, "Músico no encontrado en plantilla"
        for f in ("gasto_id", "cache_extra_provisional",
                  "cache_extra_validado_por_nombre", "cache_extra_validado_at",
                  "transporte_provisional",
                  "transporte_validado_por_nombre", "transporte_validado_at"):
            assert f in m, f"Falta campo '{f}' en músico ({list(m.keys())[:15]})"


# ============================================================
# 2) Gestor normal introduce → provisional=TRUE, NO computa
# ============================================================
class TestGestorProvisional:
    def test_gestor_introduce_cache_extra_es_provisional(self, gestor_headers, admin_headers, target_musico):
        _ensure_evento_abierto(admin_headers)
        # Reset a 0 vía admin (queda no provisional)
        _put_guardar(admin_headers, EVENTO_ID, target_musico["usuario_id"],
                     cache_extra=0, transporte_importe=0)

        # Gestor introduce 50
        r = _put_guardar(gestor_headers, EVENTO_ID, target_musico["usuario_id"],
                         cache_extra=50)
        assert r.status_code < 400, f"PUT gestor falló: {r.status_code} {r.text[:200]}"

        data = _get_plantilla(admin_headers)
        m = _find_musico_in_plantilla(data, target_musico["usuario_id"])
        assert m is not None
        assert m.get("cache_extra_provisional") is True, \
            f"Esperaba cache_extra_provisional=True, got {m.get('cache_extra_provisional')}"
        assert (m.get("cache_extra") or 0) == 50

        # TOTAL NO incluye 50 — debe ser igual a (cache_real + otros validados − comedor)
        total = float(m.get("total") or 0)
        cache_real = float(m.get("cache_real") or 0)
        # Sin más campos ahora, total ≈ cache_real (no debe sumar 50)
        assert abs(total - cache_real) < 0.01 or total < (cache_real + 50), \
            f"TOTAL={total} no debería incluir el provisional 50 (cache_real={cache_real})"

    def test_admin_valida_y_total_incluye(self, admin_headers, target_musico):
        # Recoger gasto_id
        data = _get_plantilla(admin_headers)
        m = _find_musico_in_plantilla(data, target_musico["usuario_id"])
        gasto_id = m.get("gasto_id")
        assert gasto_id, "No hay gasto_id"

        # Validar
        r = requests.post(f"{BASE_URL}/api/gestor/gastos/{gasto_id}/validar",
                          json={"campo": "cache_extra"}, headers=admin_headers, timeout=20)
        assert r.status_code == 200, f"Validar: {r.status_code} {r.text[:200]}"
        body = r.json()
        for k in ("gasto_id", "campo", "validado_por_nombre", "validado_at"):
            assert k in body, f"Falta '{k}' en respuesta validar"

        # Tras validar
        data2 = _get_plantilla(admin_headers)
        m2 = _find_musico_in_plantilla(data2, target_musico["usuario_id"])
        assert m2.get("cache_extra_provisional") is False
        assert m2.get("cache_extra_validado_at")
        assert m2.get("cache_extra_validado_por_nombre")
        total2 = float(m2.get("total") or 0)
        cache_real = float(m2.get("cache_real") or 0)
        assert abs(total2 - (cache_real + 50)) < 0.01, \
            f"TOTAL tras validar debería ser cache_real+50 ({cache_real+50}), got {total2}"

    def test_validar_ya_validado_400(self, admin_headers, target_musico):
        data = _get_plantilla(admin_headers)
        m = _find_musico_in_plantilla(data, target_musico["usuario_id"])
        gasto_id = m.get("gasto_id")
        r = requests.post(f"{BASE_URL}/api/gestor/gastos/{gasto_id}/validar",
                          json={"campo": "cache_extra"}, headers=admin_headers, timeout=20)
        assert r.status_code == 400
        assert "validado" in (r.json().get("detail") or "").lower()


# ============================================================
# 3) Admin introduce directamente → provisional=FALSE
# ============================================================
class TestAdminDirecto:
    def test_admin_introduce_transporte_no_provisional(self, admin_headers, target_musico):
        _ensure_evento_abierto(admin_headers)
        # Reset
        _put_guardar(admin_headers, EVENTO_ID, target_musico["usuario_id"],
                     transporte_importe=0)

        r = _put_guardar(admin_headers, EVENTO_ID, target_musico["usuario_id"],
                         transporte_importe=30)
        assert r.status_code < 400

        data = _get_plantilla(admin_headers)
        m = _find_musico_in_plantilla(data, target_musico["usuario_id"])
        assert m.get("transporte_provisional") is False, \
            f"Admin directo: provisional debe ser False, got {m.get('transporte_provisional')}"
        assert m.get("transporte_validado_at")
        assert m.get("transporte_validado_por_nombre")


# ============================================================
# 4) Validar — errores
# ============================================================
class TestValidarErrores:
    def test_gestor_normal_403(self, gestor_headers):
        fake = "00000000-0000-0000-0000-000000000000"
        r = requests.post(f"{BASE_URL}/api/gestor/gastos/{fake}/validar",
                          json={"campo": "cache_extra"}, headers=gestor_headers, timeout=20)
        assert r.status_code == 403
        det = (r.json().get("detail") or "").lower()
        assert "director general" in det or "administradores" in det

    def test_campo_invalido_400(self, admin_headers):
        fake = "00000000-0000-0000-0000-000000000000"
        r = requests.post(f"{BASE_URL}/api/gestor/gastos/{fake}/validar",
                          json={"campo": "otros"}, headers=admin_headers, timeout=20)
        assert r.status_code == 400

    def test_gasto_inexistente_404(self, admin_headers):
        fake = "00000000-0000-0000-0000-000000000000"
        r = requests.post(f"{BASE_URL}/api/gestor/gastos/{fake}/validar",
                          json={"campo": "cache_extra"}, headers=admin_headers, timeout=20)
        assert r.status_code == 404


# ============================================================
# 5) GET pendientes — importes_pendientes_validacion
# ============================================================
class TestPendientes:
    def test_admin_recibe_contador(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/pendientes",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "importes_pendientes_validacion" in d
        assert isinstance(d["importes_pendientes_validacion"], int)
        assert d["importes_pendientes_validacion"] >= 0

    def test_gestor_normal_recibe_cero(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/pendientes",
                         headers=gestor_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d.get("importes_pendientes_validacion", 0) == 0


# ============================================================
# 6) GET gestion-economica — mismo comportamiento
# ============================================================
class TestGestionEconomica:
    def test_provisional_excluido_de_total(self, admin_headers, gestor_headers, target_musico):
        _ensure_evento_abierto(admin_headers)
        # Reset
        _put_guardar(admin_headers, EVENTO_ID, target_musico["usuario_id"],
                     cache_extra=0, transporte_importe=0)
        # Gestor introduce 25 — provisional
        _put_guardar(gestor_headers, EVENTO_ID, target_musico["usuario_id"],
                     cache_extra=25)

        r = requests.get(f"{BASE_URL}/api/gestor/gestion-economica",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        evs = r.json().get("eventos", [])
        ev = next((e for e in evs if e["id"] == EVENTO_ID), None)
        assert ev is not None
        # Buscar el músico target
        def walk(o):
            if isinstance(o, dict):
                if o.get("usuario_id") == target_musico["usuario_id"] and ("total" in o or "cache_real" in o):
                    return o
                for v in o.values():
                    r2 = walk(v)
                    if r2 is not None:
                        return r2
            elif isinstance(o, list):
                for x in o:
                    r2 = walk(x)
                    if r2 is not None:
                        return r2
            return None
        m = walk(ev)
        if m is None:
            pytest.skip("Músico no encontrado en gestion-economica")
        assert m.get("cache_extra_provisional") is True, \
            f"gestion-economica debería tener cache_extra_provisional=True, got {m.get('cache_extra_provisional')}"
        total = float(m.get("total") or 0)
        cache_real = float(m.get("cache_real") or 0)
        assert abs(total - cache_real) < 0.01 or total < cache_real + 25, \
            f"TOTAL en gestion-economica no debería incluir provisional 25"


# ============================================================
# 99) Cleanup final — admin pone todo a 0 (no provisional)
# ============================================================
@pytest.fixture(scope="module", autouse=True)
def cleanup_around(admin_headers, target_musico):
    yield
    try:
        _put_guardar(admin_headers, EVENTO_ID, target_musico["usuario_id"],
                     cache_extra=0, transporte_importe=0)
    except Exception:
        pass
