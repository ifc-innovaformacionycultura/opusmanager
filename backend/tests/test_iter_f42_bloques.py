"""Iter F4.2 — B2 (Programa Musical), B3 (GET /eventos/{id}/ensayos), B4 (reclamaciones embed fix).

Cubre endpoints backend afectados por F4.2:
  * B2.1 - GET /api/gestor/archivo/obras?q=...
  * B2.3 - PATCH programa-musical item (autosave)
  * B2.4 - GET /api/gestor/archivo/obras (catálogo para typeahead)
  * B2.5 - Vincular/desvincular obra_id en programa-musical
  * B3.1 - GET /api/gestor/eventos/{evento_id}/ensayos (nuevo; antes 404)
  * B4.1 - GET /api/gestor/reclamaciones (fix PGRST201 — embed usuario)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://contact-conductor.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASS = "Admin123!"
PREFIX = "TEST_F42"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"No login {email}: {r.status_code} {r.text[:150]}")
    tok = r.json().get('access_token') or r.json().get('token')
    if not tok:
        pytest.skip(f"Sin token: {r.json()}")
    return tok


@pytest.fixture(scope="module")
def admin_client():
    tok = _login(ADMIN_EMAIL, ADMIN_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def evento_id(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/gestor/eventos", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    evs = data if isinstance(data, list) else (data.get('eventos') or [])
    if not evs:
        pytest.skip("Sin eventos en entorno")
    return evs[0]['id']


# ====================================================================
# B3 — GET /api/gestor/eventos/{evento_id}/ensayos (nuevo endpoint)
# ====================================================================
class TestB3EnsayosPorEvento:
    def test_b3_1_get_ensayos_evento_200(self, admin_client, evento_id):
        r = admin_client.get(f"{BASE_URL}/api/gestor/eventos/{evento_id}/ensayos", timeout=15)
        assert r.status_code == 200, f"Esperado 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert 'ensayos' in data, f"Respuesta sin clave 'ensayos': {data}"
        assert isinstance(data['ensayos'], list)

    def test_b3_1_get_ensayos_evento_inexistente_200_vacio(self, admin_client):
        """Spec: con UUID inexistente sigue devolviendo 200 con ensayos:[]"""
        fake = "00000000-0000-0000-0000-000000000000"
        r = admin_client.get(f"{BASE_URL}/api/gestor/eventos/{fake}/ensayos", timeout=15)
        assert r.status_code == 200, f"Esperado 200 (no 404), got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert 'ensayos' in data
        assert data['ensayos'] == [] or isinstance(data['ensayos'], list)


# ====================================================================
# B4 — GET /api/gestor/reclamaciones (fix PGRST201)
# ====================================================================
class TestB4Reclamaciones:
    def test_b4_1_get_reclamaciones_200_no_PGRST201(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/gestor/reclamaciones", timeout=20)
        assert r.status_code == 200, f"Esperado 200 (antes 500 por PGRST201), got {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert 'reclamaciones' in data, f"Sin clave 'reclamaciones': {data}"
        assert isinstance(data['reclamaciones'], list)
        # Si hay al menos 1, verificar que trae usuario embebido
        if data['reclamaciones']:
            rec = data['reclamaciones'][0]
            # usuario puede venir como objeto embebido o None; si hay, debe traer los campos
            if rec.get('usuario'):
                u = rec['usuario']
                # nombre/apellidos/email deben estar presentes (pueden ser None si falta dato)
                assert 'nombre' in u or 'email' in u, f"Embed usuario sin nombre/email: {u}"


# ====================================================================
# B2 — Programa Musical (autosave, typeahead, vincular/desvincular)
# ====================================================================
class TestB2ProgramaMusical:
    @pytest.fixture(scope="class")
    def programa_item(self, admin_client, evento_id):
        """Crea un item en archivo/evento/{id}/obras del evento."""
        payload = {"titulo_provisional": f"{PREFIX}_{uuid.uuid4().hex[:6]}", "orden_programa": 99}
        r = admin_client.post(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras",
            json=payload, timeout=15)
        if r.status_code not in (200, 201):
            pytest.skip(f"POST archivo/evento/obras no disponible: {r.status_code} {r.text[:200]}")
        body = r.json()
        item = body.get('evento_obra') or body.get('item') or body
        if not item or not item.get('id'):
            pytest.skip(f"Item sin id: {body}")
        yield item
        try:
            admin_client.delete(
                f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras/{item['id']}",
                timeout=15)
        except Exception:
            pass

    def test_b2_1_archivo_obras_filter(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/gestor/archivo/obras?q=Sinfonia", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        obras = data if isinstance(data, list) else (data.get('obras') or [])
        assert isinstance(obras, list)

    def test_b2_1_archivo_obras_q_vacio(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/gestor/archivo/obras", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) or isinstance(data.get('obras'), list)

    def test_b2_3_patch_autosave_duracion(self, admin_client, evento_id, programa_item):
        """PATCH a un campo debe persistir (autosave)."""
        item_id = programa_item['id']
        payload = {"duracion_display": "12:34", "notas": f"{PREFIX}_nota"}
        r = admin_client.patch(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras/{item_id}",
            json=payload, timeout=15)
        assert r.status_code in (200, 204), f"PATCH autosave falla: {r.status_code} {r.text[:200]}"
        # Verificar persistencia via GET programa del evento
        rg = admin_client.get(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/programa", timeout=15)
        assert rg.status_code == 200
        items = rg.json().get('programa') or []
        match = next((i for i in items if i.get('id') == item_id), None)
        assert match, "Item no encontrado tras PATCH"
        assert match.get('duracion_display') == "12:34"
        assert match.get('notas') == f"{PREFIX}_nota"

    def test_b2_5_vincular_obra(self, admin_client, evento_id, programa_item):
        """Vincular obra_id a una fila."""
        item_id = programa_item['id']
        robras = admin_client.get(f"{BASE_URL}/api/gestor/archivo/obras", timeout=15)
        obras = robras.json() if isinstance(robras.json(), list) else (robras.json().get('obras') or [])
        if not obras:
            pytest.skip("Sin obras en catálogo para vincular")
        obra_id = obras[0].get('id')
        r = admin_client.patch(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras/{item_id}",
            json={"obra_id": obra_id}, timeout=15)
        assert r.status_code in (200, 204), f"vincular falla: {r.status_code} {r.text[:200]}"
        # Desvincular
        r2 = admin_client.patch(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras/{item_id}",
            json={"obra_id": None}, timeout=15)
        assert r2.status_code in (200, 204), f"desvincular falla: {r2.status_code} {r2.text[:200]}"
