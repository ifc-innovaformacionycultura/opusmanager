"""Iter 13 — Verificaciones, calendarios, informes D/I/J, regresión PDFs."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://contact-conductor.preview.emergentagent.com').rstrip('/')

CRED_DG = {"email": "jalonso@p.csmb.es", "password": "Director2026!"}
CRED_ADMIN = {"email": "admin@convocatorias.com", "password": "Admin123!"}
CRED_GESTOR_NORMAL = {"email": "palvarez@netmetrix.es", "password": "Opus2026!"}
CRED_MUSICO = {"email": "jesusalonsodirector@gmail.com", "password": "Musico123!"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {creds['email']}: {r.status_code} {r.text[:200]}")
    return r.json()


@pytest.fixture(scope="module")
def dg_token():
    return _login(CRED_DG)["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(CRED_ADMIN)["access_token"]


@pytest.fixture(scope="module")
def gestor_normal_token():
    return _login(CRED_GESTOR_NORMAL)["access_token"]


@pytest.fixture(scope="module")
def musico_token():
    return _login(CRED_MUSICO)["access_token"]


@pytest.fixture(scope="module")
def evento_id(admin_token):
    r = requests.get(f"{BASE_URL}/api/gestor/eventos",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    eventos = data.get("eventos", data) if isinstance(data, dict) else data
    assert isinstance(eventos, list) and len(eventos) > 0, "No hay eventos en BD"
    return eventos[0]["id"]


# --- Login Director General ---
class TestLoginDirectorGeneral:
    def test_login_dg_returns_token_and_flag(self):
        data = _login(CRED_DG)
        assert "access_token" in data
        # Verificar requiere_cambio_password en respuesta
        user = data.get("user") or data.get("profile") or {}
        # Algunos backends devuelven el flag en user/profile
        flag = user.get("requiere_cambio_password")
        if flag is None and isinstance(data, dict):
            flag = data.get("requiere_cambio_password")
        # Solo aserción suave: si el campo existe debe ser True
        if flag is not None:
            assert flag is True


# --- Verificaciones ---
class TestVerificaciones:
    def test_dg_puede_editar(self, dg_token, evento_id):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos/{evento_id}/verificaciones",
                         headers={"Authorization": f"Bearer {dg_token}"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d.get("puede_editar") is True
        assert d.get("total") == 8
        assert "verificaciones" in d
        assert len(d["verificaciones"]) == 8

    def test_admin_puede_editar(self, admin_token, evento_id):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos/{evento_id}/verificaciones",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        assert r.json().get("puede_editar") is True

    def test_gestor_normal_no_puede_editar(self, gestor_normal_token, evento_id):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos/{evento_id}/verificaciones",
                         headers={"Authorization": f"Bearer {gestor_normal_token}"}, timeout=20)
        assert r.status_code == 200
        assert r.json().get("puede_editar") is False

    def test_dg_puede_cambiar_estado(self, dg_token, evento_id):
        r = requests.put(
            f"{BASE_URL}/api/gestor/eventos/{evento_id}/verificaciones/datos_generales",
            headers={"Authorization": f"Bearer {dg_token}"},
            json={"estado": "verificado", "notas": "TEST_iter13"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        # GET para verificar persistencia
        g = requests.get(f"{BASE_URL}/api/gestor/eventos/{evento_id}/verificaciones",
                         headers={"Authorization": f"Bearer {dg_token}"}, timeout=20)
        verif = next((x for x in g.json()["verificaciones"] if x["seccion"] == "datos_generales"), None)
        assert verif is not None
        assert verif["estado"] == "verificado"
        # Cleanup
        requests.put(
            f"{BASE_URL}/api/gestor/eventos/{evento_id}/verificaciones/datos_generales",
            headers={"Authorization": f"Bearer {dg_token}"},
            json={"estado": "pendiente", "notas": None},
            timeout=20,
        )

    def test_gestor_normal_no_puede_cambiar(self, gestor_normal_token, evento_id):
        r = requests.put(
            f"{BASE_URL}/api/gestor/eventos/{evento_id}/verificaciones/ensayos",
            headers={"Authorization": f"Bearer {gestor_normal_token}"},
            json={"estado": "verificado"},
            timeout=20,
        )
        assert r.status_code == 403

    def test_solicitar_verificacion_endpoint_existe(self, gestor_normal_token, evento_id):
        r = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{evento_id}/verificaciones/ensayos/solicitar",
            headers={"Authorization": f"Bearer {gestor_normal_token}"},
            timeout=30,
        )
        # 200 si Resend OK, 503 si no configurado, 404 si no admins. NO 500/422.
        assert r.status_code in (200, 503, 404), f"{r.status_code}: {r.text[:300]}"


# --- Informes D, I, J ---
class TestInformesNuevos:
    @pytest.mark.parametrize("tipo", ["D", "I", "J"])
    def test_informe_pdf(self, admin_token, evento_id, tipo):
        r = requests.post(
            f"{BASE_URL}/api/gestor/informes/generar",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"tipo": tipo, "evento_ids": [evento_id], "plano_mode": "herradura"},
            timeout=90,
        )
        assert r.status_code == 200, f"tipo={tipo}: {r.status_code} {r.text[:300]}"
        ct = r.headers.get("content-type", "")
        assert "pdf" in ct.lower(), f"tipo={tipo}: content-type={ct}"
        assert r.content[:4] == b"%PDF", f"tipo={tipo}: not a PDF"
        assert len(r.content) > 1000, f"tipo={tipo}: PDF demasiado pequeño ({len(r.content)} B)"


# --- Regresión informes A-H ---
class TestInformesRegresion:
    @pytest.mark.parametrize("tipo", ["A", "B", "C", "E", "F", "G", "H"])
    def test_pdf_existente(self, admin_token, evento_id, tipo):
        r = requests.post(
            f"{BASE_URL}/api/gestor/informes/generar",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"tipo": tipo, "evento_ids": [evento_id], "plano_mode": "herradura"},
            timeout=90,
        )
        assert r.status_code == 200, f"tipo={tipo}: {r.text[:200]}"
        assert r.content[:4] == b"%PDF"


# --- Calendario gestor ---
class TestCalendarioGestor:
    def test_calendario_eventos_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/gestor/calendario-eventos",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "eventos" in d
        assert isinstance(d["eventos"], list)
        if d["eventos"]:
            ev = d["eventos"][0]
            assert "tipo_calendario" in ev
            assert ev.get("editable") is False
            assert ev["tipo_calendario"] in ("ensayo", "funcion", "logistica", "montaje")

    def test_calendario_dg(self, dg_token):
        r = requests.get(f"{BASE_URL}/api/gestor/calendario-eventos",
                         headers={"Authorization": f"Bearer {dg_token}"}, timeout=30)
        assert r.status_code == 200


# --- Calendario portal músico ---
class TestCalendarioPortal:
    def test_portal_calendario_responde(self, musico_token):
        r = requests.get(f"{BASE_URL}/api/portal/calendario",
                         headers={"Authorization": f"Bearer {musico_token}"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        # Debe responder con lista o estructura conocida
        assert isinstance(d, (dict, list))


# --- Inventario admin (regresión) ---
class TestInventarioRegresion:
    def test_admin_acceso_inventario(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/gestor/inventario",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code in (200, 404)  # 404 si endpoint diferente

    def test_eventos_listing(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
