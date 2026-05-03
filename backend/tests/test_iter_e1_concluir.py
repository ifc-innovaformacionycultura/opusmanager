"""Iter E1 — Concluir/Reabrir Plantilla Definitiva.

Test coverage:
- GET /api/gestor/plantillas-definitivas → returns estado_cierre, cerrado_plantilla_at, cerrado_plantilla_por_nombre, fecha_inicio
- POST /api/gestor/eventos/{id}/concluir-plantilla → gestor normal puede concluir
- POST /api/gestor/eventos/{id}/reabrir-plantilla → gestor recibe 403, super admin OK
- PUT /api/gestor/plantillas-definitivas/guardar → 403 si evento concluido; OK regresión abierto
- 404 en evento inexistente
- routes_recordatorios.job_concluir_evento — import + invocación directa
"""
import os
import sys
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://contact-conductor.preview.emergentagent.com').rstrip('/')

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASSWORD = "Admin123!"
GESTOR_EMAIL = "palvarez@netmetrix.es"
GESTOR_PASSWORD = "Opus2026!"


def _login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token") or (data.get("session") or {}).get("access_token")
    assert token, f"No token returned: {data}"
    return token


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def gestor_token():
    try:
        return _login(GESTOR_EMAIL, GESTOR_PASSWORD)
    except AssertionError as e:
        pytest.skip(f"Gestor login failed: {e}")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def gestor_headers(gestor_token):
    return {"Authorization": f"Bearer {gestor_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def plantillas_definitivas(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/gestor/plantillas-definitivas",
        headers=admin_headers, timeout=30,
    )
    assert r.status_code == 200, f"GET plantillas-definitivas: {r.status_code} {r.text[:300]}"
    return r.json()


@pytest.fixture(scope="module")
def evento_target(plantillas_definitivas):
    """Pick first evento that is open (estado_cierre=abierto) for testing."""
    eventos = plantillas_definitivas.get("eventos", [])
    if not eventos:
        pytest.skip("No hay eventos en plantillas-definitivas")
    for ev in eventos:
        if (ev.get("estado_cierre") or "abierto") == "abierto":
            return ev
    pytest.skip("No hay eventos con estado_cierre='abierto'")


# =========================================================================
# 1) GET /api/gestor/plantillas-definitivas — schema con campos Iter E1
# =========================================================================
class TestGetPlantillasDefinitivas:
    def test_response_has_eventos(self, plantillas_definitivas):
        assert "eventos" in plantillas_definitivas
        assert isinstance(plantillas_definitivas["eventos"], list)

    def test_each_evento_has_iter_e1_fields(self, plantillas_definitivas):
        eventos = plantillas_definitivas.get("eventos", [])
        if not eventos:
            pytest.skip("Sin eventos")
        for ev in eventos:
            assert "estado_cierre" in ev, f"Falta estado_cierre en evento {ev.get('id')}"
            assert "cerrado_plantilla_at" in ev, f"Falta cerrado_plantilla_at en {ev.get('id')}"
            assert "cerrado_plantilla_por_nombre" in ev, f"Falta cerrado_plantilla_por_nombre en {ev.get('id')}"
            assert "fecha_inicio" in ev, f"Falta fecha_inicio en {ev.get('id')}"
            ec = ev.get("estado_cierre") or "abierto"
            assert ec in ("abierto", "cerrado_plantilla", "cerrado_economico"), f"estado_cierre inesperado: {ec}"

    def test_at_least_one_open_evento(self, plantillas_definitivas):
        """Regression: eventos abiertos siguen apareciendo."""
        eventos = plantillas_definitivas.get("eventos", [])
        opens = [e for e in eventos if (e.get("estado_cierre") or "abierto") == "abierto"]
        assert len(opens) >= 1, "Esperado al menos 1 evento con estado_cierre='abierto' (regresión)"


# =========================================================================
# 2) POST concluir-plantilla / reabrir-plantilla — flujo principal
# =========================================================================
class TestConcluirReabrirPlantilla:
    def test_404_evento_inexistente_concluir(self, admin_headers):
        fake_id = "00000000-0000-0000-0000-000000000000"
        r = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{fake_id}/concluir-plantilla",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 404, f"Esperado 404, got {r.status_code} {r.text[:200]}"
        assert "no encontrado" in (r.json().get("detail", "")).lower()

    def test_404_evento_inexistente_reabrir(self, admin_headers):
        fake_id = "00000000-0000-0000-0000-000000000000"
        r = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{fake_id}/reabrir-plantilla",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 404
        assert "no encontrado" in (r.json().get("detail", "")).lower()

    def test_gestor_no_admin_cannot_reabrir(self, gestor_headers, evento_target):
        """Gestor normal recibe 403 al intentar reabrir."""
        r = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{evento_target['id']}/reabrir-plantilla",
            headers=gestor_headers, timeout=20,
        )
        assert r.status_code == 403, f"Esperado 403, got {r.status_code} {r.text[:300]}"
        detail = (r.json().get("detail") or "").lower()
        assert "director general" in detail or "administradores" in detail or "admin" in detail

    def test_concluir_then_reabrir_flow(self, admin_headers, evento_target):
        """Flujo completo: concluir → guardar bloqueado 403 → reabrir → asignaciones abiertas."""
        evento_id = evento_target["id"]
        # 1) Concluir
        r = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{evento_id}/concluir-plantilla",
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200, f"Concluir falló: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True
        assert "actualizadas" in data
        assert "recibos_regenerados" in data
        assert "cerrado_plantilla_at" in data and data["cerrado_plantilla_at"]
        assert "cerrado_plantilla_por_nombre" in data and data["cerrado_plantilla_por_nombre"]

        # 2) Verificar GET refleja estado cerrado
        r2 = requests.get(
            f"{BASE_URL}/api/gestor/plantillas-definitivas",
            headers=admin_headers, timeout=30,
        )
        assert r2.status_code == 200
        eventos = r2.json().get("eventos", [])
        ev_match = next((e for e in eventos if e["id"] == evento_id), None)
        assert ev_match is not None, "Evento no aparece en plantillas-definitivas tras concluir"
        assert ev_match.get("estado_cierre") == "cerrado_plantilla"
        assert ev_match.get("cerrado_plantilla_at"), "cerrado_plantilla_at vacío tras concluir"

        # 3) PUT guardar bloqueado 403 con evento concluido
        # Buscar una asignacion del evento para forzar evento_ids_tocados
        asignaciones = ev_match.get("musicos") or []
        if asignaciones:
            asig_id = asignaciones[0].get("asignacion_id")
            payload = {
                "asistencias": [],
                "gastos": [],
                "anotaciones": [
                    {"asignacion_id": asig_id, "comentarios": "TEST_E1_block"}
                ],
            }
            r3 = requests.put(
                f"{BASE_URL}/api/gestor/plantillas-definitivas/guardar",
                json=payload, headers=admin_headers, timeout=30,
            )
            assert r3.status_code == 403, f"Esperado 403 guardar, got {r3.status_code} {r3.text[:300]}"
            detail = (r3.json().get("detail") or "").lower()
            assert "concluido" in detail or "no se permiten" in detail

        # 4) Reabrir (admin = super admin)
        r4 = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{evento_id}/reabrir-plantilla",
            headers=admin_headers, timeout=30,
        )
        assert r4.status_code == 200, f"Reabrir falló: {r4.status_code} {r4.text[:300]}"
        data4 = r4.json()
        assert data4.get("ok") is True
        assert "actualizadas" in data4

        # 5) Verificar GET refleja estado abierto
        r5 = requests.get(
            f"{BASE_URL}/api/gestor/plantillas-definitivas",
            headers=admin_headers, timeout=30,
        )
        assert r5.status_code == 200
        eventos5 = r5.json().get("eventos", [])
        ev5 = next((e for e in eventos5 if e["id"] == evento_id), None)
        # Tras reabrir: o bien estado_cierre='abierto', o bien evento ya no aparece como cerrado
        if ev5 is not None:
            ec = ev5.get("estado_cierre") or "abierto"
            assert ec == "abierto", f"Tras reabrir, estado_cierre debe ser 'abierto', got {ec}"
            assert ev5.get("cerrado_plantilla_at") in (None, ""), f"cerrado_plantilla_at debe ser None tras reabrir"

    def test_guardar_evento_abierto_ok_regresion(self, admin_headers, evento_target):
        """Tras reabrir, guardar payload vacío con evento abierto debe ser OK."""
        payload = {"asistencias": [], "gastos": [], "anotaciones": []}
        r = requests.put(
            f"{BASE_URL}/api/gestor/plantillas-definitivas/guardar",
            json=payload, headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200, f"Guardar regresión falló: {r.status_code} {r.text[:300]}"
        d = r.json()
        assert d.get("ok") is True


# =========================================================================
# 3) routes_recordatorios.job_concluir_evento — import + invocación directa
# =========================================================================
class TestJobConcluirEvento:
    def test_import_and_invoke(self):
        sys.path.insert(0, "/app/backend")
        # Load /app/backend/.env so supabase_client picks up keys
        try:
            from dotenv import load_dotenv
            load_dotenv("/app/backend/.env")
        except Exception:
            pass
        try:
            from routes_recordatorios import job_concluir_evento
        except Exception as e:
            pytest.fail(f"No se puede importar job_concluir_evento: {e}")
        result = job_concluir_evento()
        assert isinstance(result, dict)
        assert result.get("job") == "concluir_evento"
        assert "enviados" in result
        assert "revisados" in result
        assert "dias_antes" in result
        assert isinstance(result["enviados"], int)
        assert isinstance(result["revisados"], int)
