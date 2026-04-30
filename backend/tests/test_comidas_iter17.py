"""
Iter 17 — Servicio de comedor (comidas) backend tests.

Cubre:
- Gestor: GET/PUT /eventos/{id}/comidas, DELETE /comidas/{id},
  GET /comidas/{id}/confirmaciones, GET /comidas (global).
- Portal músico: GET /evento/{id}/comidas, POST /comidas/{id}/confirmar.
- Dashboard: KPI 'comidas_pendientes_confirmar' en /gestor/dashboard/resumen.
- Informes: generador K 'Comidas por evento' devuelve PDF.
- Regresión: /gestor/eventos/{id}/logistica sigue OK.
"""
import os
import pytest
import requests
from datetime import date, timedelta
from pathlib import Path


def _load_backend_url():
    url = os.environ.get('REACT_APP_BACKEND_URL', '').strip()
    if not url:
        env_path = Path('/app/frontend/.env')
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith('REACT_APP_BACKEND_URL='):
                    url = line.split('=', 1)[1].strip()
                    break
    return url.rstrip('/')


BASE_URL = _load_backend_url()

ADMIN_EMAIL = 'admin@convocatorias.com'
ADMIN_PASS = 'Admin123!'
MUSICO_EMAIL = 'jesusalonsodirector@gmail.com'
MUSICO_PASS = 'Musico123!'


# -------- Fixtures --------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    tok = r.json().get("access_token") or r.json().get("session", {}).get("access_token")
    assert tok, f"no access_token in {r.json()}"
    return tok


@pytest.fixture(scope="module")
def musico_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": MUSICO_EMAIL, "password": MUSICO_PASS}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Musico login failed: {r.status_code} {r.text[:200]}")
    tok = r.json().get("access_token") or r.json().get("session", {}).get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def musico_headers(musico_token):
    return {"Authorization": f"Bearer {musico_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def evento_id(admin_headers):
    """Get any existing evento id for tests."""
    r = requests.get(f"{BASE_URL}/api/gestor/eventos", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    eventos = data.get("eventos") if isinstance(data, dict) else data
    if not eventos:
        pytest.skip("No eventos en BD para testear comidas")
    return eventos[0]["id"]


# -------- Gestor: CRUD de comidas --------
class TestComidasGestorCRUD:
    def test_get_comidas_empty_ok(self, admin_headers, evento_id):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos/{evento_id}/comidas",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "comidas" in body
        assert isinstance(body["comidas"], list)

    def test_create_comida_via_put(self, admin_headers, evento_id, request):
        fecha = (date.today() + timedelta(days=30)).isoformat()
        flim = (date.today() + timedelta(days=28)).isoformat()
        payload = {
            "items": [{
                "fecha": fecha,
                "hora_inicio": "13:00",
                "hora_fin": "14:30",
                "lugar": "TEST_Restaurante Iter17",
                "menu": "TEST_Ensalada · Filete · Postre",
                "precio_menu": 15.0,
                "incluye_cafe": True,
                "precio_cafe": 2.0,
                "fecha_limite_confirmacion": flim,
                "notas": "TEST_iter17"
            }],
            "eliminar_ids": []
        }
        r = requests.put(f"{BASE_URL}/api/gestor/eventos/{evento_id}/comidas",
                         headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("creados") == 1
        assert body.get("actualizados") == 0

        # Fetch the newly-created comida id
        r2 = requests.get(f"{BASE_URL}/api/gestor/eventos/{evento_id}/comidas",
                          headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        comidas = r2.json()["comidas"]
        created = [c for c in comidas if c.get("lugar") == "TEST_Restaurante Iter17"]
        assert created, f"No TEST_ comida found in {comidas}"
        request.config.cache.set("comida_id_iter17", created[0]["id"])
        assert created[0]["precio_menu"] == 15 or float(created[0]["precio_menu"]) == 15.0
        assert created[0]["incluye_cafe"] is True
        assert created[0]["menu"] == "TEST_Ensalada · Filete · Postre"

    def test_update_comida_via_put(self, admin_headers, evento_id, request):
        cid = request.config.cache.get("comida_id_iter17", None)
        if not cid:
            pytest.skip("No comida id from previous test")
        payload = {
            "items": [{
                "id": cid,
                "lugar": "TEST_Restaurante Iter17 MOD",
                "precio_menu": 20.0,
                "incluye_cafe": True,
                "precio_cafe": 2.5,
            }],
            "eliminar_ids": []
        }
        r = requests.put(f"{BASE_URL}/api/gestor/eventos/{evento_id}/comidas",
                         headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("creados") == 0
        assert body.get("actualizados") == 1
        # verify
        r2 = requests.get(f"{BASE_URL}/api/gestor/eventos/{evento_id}/comidas",
                          headers=admin_headers, timeout=30)
        comida = next(c for c in r2.json()["comidas"] if c["id"] == cid)
        assert comida["lugar"] == "TEST_Restaurante Iter17 MOD"
        assert float(comida["precio_menu"]) == 20.0

    def test_confirmaciones_comida(self, admin_headers, request):
        cid = request.config.cache.get("comida_id_iter17", None)
        if not cid:
            pytest.skip("No comida id")
        r = requests.get(f"{BASE_URL}/api/gestor/comidas/{cid}/confirmaciones",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for key in ("confirmados", "rechazados", "sin_respuesta", "total_recaudado"):
            assert key in body, f"missing {key} in {body}"
        assert isinstance(body["confirmados"], list)
        assert isinstance(body["total_recaudado"], (int, float))

    def test_global_comidas_view(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/comidas", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "eventos" in body
        assert isinstance(body["eventos"], list)
        if body["eventos"]:
            ev = body["eventos"][0]
            assert "totales" in ev
            assert "comidas" in ev
            for k in ("confirmados", "rechazados", "n_servicios"):
                assert k in ev["totales"]


# -------- Portal músico --------
class TestComidasPortal:
    def test_get_comidas_musico(self, musico_headers, evento_id):
        r = requests.get(f"{BASE_URL}/api/portal/evento/{evento_id}/comidas",
                         headers=musico_headers, timeout=30)
        # Puede ser 200 con lista vacía si el músico no está asignado a ese evento,
        # pero el endpoint debe al menos responder 200.
        assert r.status_code == 200, r.text
        body = r.json()
        assert "comidas" in body
        for c in body["comidas"]:
            # Claves de contexto del músico
            assert "mi_confirmacion" in c
            assert "mi_toma_cafe" in c

    def test_confirmar_comida_si(self, musico_headers, request):
        cid = request.config.cache.get("comida_id_iter17", None)
        if not cid:
            pytest.skip("No comida id")
        r = requests.post(f"{BASE_URL}/api/portal/comidas/{cid}/confirmar",
                          headers=musico_headers,
                          json={"confirmado": True, "toma_cafe": True}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "confirmacion" in body
        c = body["confirmacion"]
        assert c is not None
        assert c.get("confirmado") is True
        assert c.get("toma_cafe") is True

    def test_confirmar_comida_rechazo(self, musico_headers, request):
        cid = request.config.cache.get("comida_id_iter17", None)
        if not cid:
            pytest.skip("No comida id")
        r = requests.post(f"{BASE_URL}/api/portal/comidas/{cid}/confirmar",
                          headers=musico_headers,
                          json={"confirmado": False, "toma_cafe": None}, timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()["confirmacion"]
        assert c.get("confirmado") is False

    def test_total_recaudado_con_cafe(self, admin_headers, musico_headers, request):
        """Tras un sí + café, total_recaudado debe ser precio_menu+precio_cafe (si músico estaba asignado)."""
        cid = request.config.cache.get("comida_id_iter17", None)
        if not cid:
            pytest.skip("No comida id")
        # Volver a confirmar como 'sí con café'
        r0 = requests.post(f"{BASE_URL}/api/portal/comidas/{cid}/confirmar",
                           headers=musico_headers,
                           json={"confirmado": True, "toma_cafe": True}, timeout=30)
        assert r0.status_code == 200
        r = requests.get(f"{BASE_URL}/api/gestor/comidas/{cid}/confirmaciones",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        # Solo asertamos si el músico aparece como confirmado (solo si está asignado al evento)
        if len(body["confirmados"]) >= 1:
            # total debe incluir precio_menu(20)+precio_cafe(2.5) al menos para 1 confirmado
            assert body["total_recaudado"] >= 22.5 - 0.01, body


# -------- Cleanup al final --------
class TestComidasCleanup:
    def test_delete_comida(self, admin_headers, request):
        cid = request.config.cache.get("comida_id_iter17", None)
        if not cid:
            pytest.skip("No comida id")
        r = requests.delete(f"{BASE_URL}/api/gestor/comidas/{cid}",
                            headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True


# -------- Dashboard & Informes & Regresión --------
class TestDashboardInformesRegresion:
    def test_dashboard_kpi_comidas(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/dashboard/resumen",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        # KPI puede estar en raíz o dentro de 'kpis'
        kpis = body.get("kpis") if isinstance(body.get("kpis"), dict) else body
        assert "comidas_pendientes_confirmar" in kpis, f"missing KPI in kpis keys: {list(kpis.keys())}"
        assert isinstance(kpis["comidas_pendientes_confirmar"], int)
        assert "comidas_pendientes" in body
        assert isinstance(body["comidas_pendientes"], list)

    def test_informe_K_pdf(self, admin_headers, evento_id):
        payload = {"tipo": "K", "evento_ids": [evento_id], "opciones": {}}
        # Probar endpoint principal de generación
        r = requests.post(f"{BASE_URL}/api/gestor/informes/generar",
                          headers=admin_headers, json=payload, timeout=60)
        if r.status_code == 404:
            # fallback endpoint naming
            r = requests.post(f"{BASE_URL}/api/informes/generar",
                              headers=admin_headers, json=payload, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        ct = r.headers.get("Content-Type", "")
        assert "application/pdf" in ct or r.content[:4] == b"%PDF", f"not a pdf: ct={ct}"

    def test_logistica_regresion(self, admin_headers, evento_id):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos/{evento_id}/logistica",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        # Acepta cualquier de las formas usuales
        assert isinstance(body, dict)
