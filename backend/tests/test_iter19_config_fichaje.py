"""Iter 19 - Bloque 1 (Configuracion app) + Bloque 2 (Fichaje QR) + Regresión."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://contact-conductor.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASS = "Admin123!"
DIR_EMAIL = "jalonso@p.csmb.es"
DIR_PASS = "Director2026!"
MUS_EMAIL = "jesusalonsodirector@gmail.com"
MUS_PASS = "Musico123!"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed {email}: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or (data.get("session") or {}).get("access_token") or data.get("token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="module")
def admin_token():
    # admin@convocatorias.com has rol='gestor' (not 'admin'). Use director_general for admin endpoints.
    return _login(DIR_EMAIL, DIR_PASS)


@pytest.fixture(scope="module")
def gestor_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def musico_token():
    try:
        return _login(MUS_EMAIL, MUS_PASS)
    except AssertionError:
        pytest.skip("Musico login failed")


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ============================================================================
# BLOQUE 1 - Configuración
# ============================================================================
class TestBloque1Configuracion:
    def test_get_configuracion(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/configuracion", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "configuracion" in data
        assert "editable" in data
        assert data["editable"] is True

    def test_get_configuracion_musico_no_editable(self, musico_token):
        r = requests.get(f"{BASE_URL}/api/admin/configuracion", headers=_h(musico_token), timeout=15)
        assert r.status_code == 200
        assert r.json().get("editable") is False

    def test_put_configuracion_and_persist(self, admin_token):
        # Read current IRPF
        r0 = requests.get(f"{BASE_URL}/api/admin/configuracion", headers=_h(admin_token), timeout=15)
        original = (r0.json().get("configuracion") or {}).get("irpf_porcentaje") or 15
        new_val = 14.5 if float(original) != 14.5 else 15.5

        # Update
        r = requests.put(f"{BASE_URL}/api/admin/configuracion",
                         headers=_h(admin_token),
                         json={"irpf_porcentaje": new_val, "org_nombre": "IFC OPUS Test"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Verify persisted via new GET (cache invalidated)
        r2 = requests.get(f"{BASE_URL}/api/admin/configuracion", headers=_h(admin_token), timeout=15)
        cfg = r2.json()["configuracion"]
        assert float(cfg["irpf_porcentaje"]) == new_val
        assert cfg["org_nombre"] == "IFC OPUS Test"

        # Restore IRPF
        requests.put(f"{BASE_URL}/api/admin/configuracion",
                     headers=_h(admin_token),
                     json={"irpf_porcentaje": float(original)}, timeout=15)

    def test_put_configuracion_forbidden_musico(self, musico_token):
        r = requests.put(f"{BASE_URL}/api/admin/configuracion",
                         headers=_h(musico_token),
                         json={"irpf_porcentaje": 10}, timeout=15)
        assert r.status_code in (401, 403), r.text


# ============================================================================
# BLOQUE 2 - Fichaje
# ============================================================================
class TestBloque2Fichaje:
    def test_get_fichaje_reglas_globales(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/fichaje-reglas", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reglas" in data
        reglas = data["reglas"]
        assert "minutos_antes_apertura" in reglas

    def test_put_fichaje_reglas_globales(self, admin_token):
        r = requests.put(f"{BASE_URL}/api/admin/fichaje-reglas",
                         headers=_h(admin_token),
                         json={"minutos_antes_apertura": 25, "computa_tiempo_extra": False},
                         timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["reglas"]["minutos_antes_apertura"] == 25
        # restore
        requests.put(f"{BASE_URL}/api/admin/fichaje-reglas",
                     headers=_h(admin_token),
                     json={"minutos_antes_apertura": 30}, timeout=15)

    def test_registro_asistencia(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/gestor/registro-asistencia", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "eventos" in data
        assert isinstance(data["eventos"], list)

    def test_regenerar_qr_and_info(self, admin_token):
        # Get first ensayo from any evento via registro-asistencia
        r = requests.get(f"{BASE_URL}/api/gestor/registro-asistencia", headers=_h(admin_token), timeout=20)
        eventos = r.json().get("eventos", [])
        ensayo_id = None
        for ev in eventos:
            for e in ev.get("ensayos", []):
                ensayo_id = e["id"]
                break
            if ensayo_id:
                break
        if not ensayo_id:
            pytest.skip("No ensayos available for QR test")

        # Regenerate QR
        rr = requests.post(f"{BASE_URL}/api/gestor/ensayo-qr/{ensayo_id}/regenerar", headers=_h(admin_token), timeout=15)
        assert rr.status_code == 200, rr.text
        qr = rr.json().get("qr") or {}
        token = qr.get("token")
        assert token, qr

        # Public fichaje info (no auth)
        info = requests.get(f"{BASE_URL}/api/fichaje/info/{token}", timeout=15)
        assert info.status_code == 200, info.text
        ensayo = info.json().get("ensayo") or {}
        assert ensayo.get("id") == ensayo_id

        # Invalid token
        bad = requests.get(f"{BASE_URL}/api/fichaje/info/invalid-token-xyz", timeout=15)
        assert bad.status_code == 404

    def test_fichaje_entrada_requires_auth(self):
        # No auth header should fail with 401/403
        r = requests.post(f"{BASE_URL}/api/fichaje/entrada/sometoken", json={}, timeout=15)
        assert r.status_code in (401, 403), r.status_code


# ============================================================================
# Regresión
# ============================================================================
class TestRegresion:
    def test_login_admin(self):
        _login(ADMIN_EMAIL, ADMIN_PASS)

    def test_login_director_general(self):
        _login(DIR_EMAIL, DIR_PASS)

    def test_login_musico(self):
        _login(MUS_EMAIL, MUS_PASS)

    def test_gestor_eventos(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200

    def test_portal_mis_eventos(self, musico_token):
        r = requests.get(f"{BASE_URL}/api/portal/mis-eventos", headers=_h(musico_token), timeout=15)
        assert r.status_code == 200

    def test_plantillas_definitivas_not_broken(self, admin_token):
        # Endpoint that powers PlantillasDefinitivas
        r = requests.get(f"{BASE_URL}/api/gestor/eventos", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        eventos = r.json() if isinstance(r.json(), list) else r.json().get("eventos", [])
        if eventos and isinstance(eventos, list) and eventos:
            # Test fichajes-evento endpoint (Bloque 2F read-only for plantillas)
            ev_id = eventos[0]["id"]
            rf = requests.get(f"{BASE_URL}/api/gestor/fichajes-evento/{ev_id}", headers=_h(admin_token), timeout=15)
            assert rf.status_code == 200
            assert "fichajes" in rf.json()
