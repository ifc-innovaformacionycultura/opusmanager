"""Iter D · Comedor descontable en Plantilla Definitiva.

Tests backend de GET /api/gestor/plantillas-definitivas:
- Cada músico devuelve campo `comida_importe` (float, 0.0 si no hay confirmaciones).
- Cada evento devuelve `totales.comida` (suma).
- Coherencia matemática: cache_real + extras + transp + aloj + otros - comida == total.
- Regresión: PUT /api/gestor/plantillas-definitivas/guardar sigue funcionando.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://contact-conductor.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASS = "Admin123!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Login admin fail: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token") or data.get("session", {}).get("access_token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def plantillas_data(admin_headers):
    r = requests.get(f"{BASE_URL}/api/gestor/plantillas-definitivas",
                     headers=admin_headers, timeout=60)
    assert r.status_code == 200, f"Plantillas fail: {r.status_code} {r.text[:300]}"
    return r.json()


# ---- Schema tests ----
class TestComidaSchema:
    def test_response_has_eventos(self, plantillas_data):
        assert "eventos" in plantillas_data
        assert isinstance(plantillas_data["eventos"], list)

    def test_each_evento_has_totales_comida(self, plantillas_data):
        eventos = plantillas_data["eventos"]
        if not eventos:
            pytest.skip("No hay eventos con confirmados → no se puede validar")
        for ev in eventos:
            assert "totales" in ev
            assert "comida" in ev["totales"], f"Falta totales.comida en evento {ev.get('id')}"
            assert isinstance(ev["totales"]["comida"], (int, float))
            assert ev["totales"]["comida"] >= 0.0

    def test_each_musico_has_comida_importe(self, plantillas_data):
        eventos = plantillas_data["eventos"]
        if not eventos:
            pytest.skip("No hay eventos")
        found_musico = False
        for ev in eventos:
            for sec in ev.get("secciones", []):
                for m in sec.get("musicos", []):
                    found_musico = True
                    assert "comida_importe" in m, f"Falta comida_importe en músico {m.get('usuario_id')}"
                    assert isinstance(m["comida_importe"], (int, float))
                    assert m["comida_importe"] >= 0.0
        if not found_musico:
            pytest.skip("Eventos sin músicos")


# ---- Math coherence tests ----
class TestComidaMath:
    def test_total_per_musico_consistent_with_comida(self, plantillas_data):
        """total = cache_real + extras + transp + aloj + otros - comida (rounded 2)."""
        eventos = plantillas_data["eventos"]
        if not eventos:
            pytest.skip("No data")
        checked = 0
        for ev in eventos:
            for sec in ev.get("secciones", []):
                for m in sec.get("musicos", []):
                    expected = round(
                        float(m["cache_real"])
                        + float(m["cache_extra"])
                        + float(m["transporte_importe"])
                        + float(m["alojamiento_importe"])
                        + float(m["otros_importe"])
                        - float(m["comida_importe"]),
                        2,
                    )
                    actual = round(float(m["total"]), 2)
                    assert abs(expected - actual) < 0.02, (
                        f"musico={m['usuario_id']} ev={ev['id']} "
                        f"expected={expected} actual={actual} comida={m['comida_importe']}"
                    )
                    checked += 1
        if checked == 0:
            pytest.skip("Sin músicos para validar fórmula")

    def test_totales_evento_comida_es_suma_musicos(self, plantillas_data):
        eventos = plantillas_data["eventos"]
        if not eventos:
            pytest.skip("No data")
        for ev in eventos:
            suma = 0.0
            for sec in ev.get("secciones", []):
                for m in sec.get("musicos", []):
                    suma += float(m["comida_importe"])
            actual = float(ev["totales"]["comida"])
            assert abs(round(suma, 2) - round(actual, 2)) < 0.02, (
                f"evento={ev['id']} suma_musicos={suma} totales.comida={actual}"
            )


# ---- Regression: guardar still works ----
class TestGuardarRegression:
    def test_guardar_empty_payload_returns_ok(self, admin_headers):
        r = requests.put(
            f"{BASE_URL}/api/gestor/plantillas-definitivas/guardar",
            headers=admin_headers,
            json={"asistencias": [], "gastos": [], "anotaciones": []},
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("ok") is True
        assert "resumen" in body
        assert body["resumen"] == {"asistencias": 0, "gastos": 0, "anotaciones": 0}
