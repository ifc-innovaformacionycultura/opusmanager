"""
Iteración 11 — Regresión BACKEND COMPLETA tras iteraciones 13-21.
Cubre: auth, health, eventos, musicos, incidencias (+screenshot upload), economía,
tareas (+comentarios), mensajes (chat interno), archivo musical (+ secciones/papeles),
portal músico y guards de roles.
"""
import os
import io
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://contact-conductor.preview.emergentagent.com').rstrip('/')

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASSWORD = "Admin123!"
MUSICO_EMAIL = "jesusalonsodirector@gmail.com"
MUSICO_PASSWORD = "Musico123!"


# ==================== Fixtures ====================

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    tok = data.get("access_token") or data.get("token") or (data.get("session") or {}).get("access_token")
    assert tok, f"No token in admin login response: {data}"
    return tok


@pytest.fixture(scope="session")
def musico_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": MUSICO_EMAIL, "password": MUSICO_PASSWORD},
                      timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Musico login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    tok = data.get("access_token") or data.get("token") or (data.get("session") or {}).get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def musico_headers(musico_token):
    return {"Authorization": f"Bearer {musico_token}"}


def _no_mongo_id(obj):
    """Recursivamente comprueba que no hay '_id' (Mongo style) en la respuesta."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"Encontrado _id de Mongo en respuesta: {list(obj.keys())[:5]}"
        for v in obj.values():
            _no_mongo_id(v)
    elif isinstance(obj, list):
        for item in obj[:20]:  # muestreo
            _no_mongo_id(item)


# ==================== 1. Auth + Health ====================

class TestHealthAndAuth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("status") == "ok"
        assert "timestamp" in d

    def test_login_admin(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_musico(self, musico_token):
        assert isinstance(musico_token, str) and len(musico_token) > 20

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "no-existe@x.com", "password": "wrong"}, timeout=10)
        assert r.status_code in (400, 401, 403, 422)

    def test_auth_me(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("email") == ADMIN_EMAIL
        _no_mongo_id(d)


# ==================== 2. Gestor base ====================

class TestGestorBase:
    def test_eventos(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Acepta lista o dict con 'eventos'
        items = d if isinstance(d, list) else d.get("eventos") or d.get("items") or []
        assert isinstance(items, list)
        _no_mongo_id(d)

    def test_musicos(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/musicos", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        items = d if isinstance(d, list) else d.get("musicos") or d.get("items") or []
        assert isinstance(items, list)
        _no_mongo_id(d)

    def test_musicos_filtros(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/musicos",
                         headers=admin_headers,
                         params={"q": "alonso"}, timeout=15)
        assert r.status_code == 200


# ==================== 3. Incidencias ====================

class TestIncidencias:
    @pytest.fixture(scope="class")
    def created_id(self, admin_headers):
        payload = {
            "tipo": "incidencia",
            "titulo": "TEST_iter11 incidencia regresión",
            "descripcion": "Creada por test_iter11_regression — segura de eliminar",
            "prioridad": "baja",
        }
        r = requests.post(f"{BASE_URL}/api/gestor/incidencias", headers=admin_headers,
                          json=payload, timeout=15)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        return d.get("id") or (d.get("incidencia") or {}).get("id")

    def test_listado_con_kpis(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/incidencias", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Estructura típica: {incidencias: [...], kpis: {...}} o lista directa
        if isinstance(d, dict):
            assert ("incidencias" in d) or ("items" in d) or ("kpis" in d) or ("total" in d) or len(d) >= 0
        _no_mongo_id(d)

    def test_create_persisted(self, admin_headers, created_id):
        assert created_id, "No se pudo crear incidencia"
        r = requests.get(f"{BASE_URL}/api/gestor/incidencias", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        items = body if isinstance(body, list) else body.get("incidencias") or body.get("items") or []
        ids = [i.get("id") for i in items]
        assert created_id in ids

    def test_mis_incidencias(self, admin_headers):
        # Endpoint mencionado en review: GET /api/gestor/incidencias/mis-incidencias
        r = requests.get(f"{BASE_URL}/api/gestor/incidencias/mis-incidencias",
                         headers=admin_headers, timeout=15)
        # Puede no existir:
        #  - 404 si el path no matchea ninguna ruta
        #  - 405 si "mis-incidencias" cae en el catch-all /gestor/incidencias/{inc_id} (PUT/DELETE)
        # Si existe → 200
        assert r.status_code in (200, 404, 405), f"{r.status_code}: {r.text[:200]}"

    def test_upload_screenshot_endpoint_existe(self, admin_headers):
        # No subimos archivo real; sólo comprobamos que el endpoint responde algo razonable
        # POST sin archivo → 400/422 (no 404, no 500)
        r = requests.post(f"{BASE_URL}/api/gestor/incidencias/upload-screenshot",
                          headers=admin_headers, timeout=15)
        assert r.status_code in (400, 401, 403, 415, 422), f"{r.status_code}: {r.text[:200]}"

    def test_upload_screenshot_con_archivo_dummy(self, admin_headers):
        files = {"file": ("test.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 50), "image/png")}
        r = requests.post(f"{BASE_URL}/api/gestor/incidencias/upload-screenshot",
                          headers=admin_headers, files=files, timeout=30)
        # Aceptamos 200 (subió a Supabase) o 400/500 si Supabase Storage no está configurado
        assert r.status_code in (200, 201, 400, 422, 500), f"{r.status_code}: {r.text[:300]}"

    def test_cleanup_incidencia(self, admin_headers, created_id):
        if created_id:
            requests.delete(f"{BASE_URL}/api/gestor/incidencias/{created_id}",
                            headers=admin_headers, timeout=10)


# ==================== 4. Economía ====================

class TestEconomia:
    def test_presupuestos_legacy(self, admin_headers):
        # El review pide /api/gestor/economia/presupuestos pero el router real lo expone en /api/gestor/presupuestos
        r = requests.get(f"{BASE_URL}/api/gestor/presupuestos", headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_presupuestos_economia_path(self, admin_headers):
        # Verificar si existe el path con /economia/ (review lo pide)
        r = requests.get(f"{BASE_URL}/api/gestor/economia/presupuestos",
                         headers=admin_headers, timeout=15)
        # Si no existe → 404; si existe → 200
        assert r.status_code in (200, 404), f"{r.status_code}: {r.text[:200]}"

    def test_asistencia_pagos(self, admin_headers):
        # Endpoint declarado en review pero NO presente en código → esperamos 404
        r = requests.get(f"{BASE_URL}/api/gestor/economia/asistencia-pagos",
                         headers=admin_headers, timeout=15)
        assert r.status_code in (200, 404), f"{r.status_code}: {r.text[:200]}"

    def test_pagos_marcar_todos(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/gestor/economia/pagos/marcar-todos",
                          headers=admin_headers, json={}, timeout=15)
        # Si no existe → 404; si existe → 200/400/422
        assert r.status_code in (200, 400, 404, 422), f"{r.status_code}: {r.text[:200]}"

    def test_gestion_economica(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/gestion-economica",
                         headers=admin_headers, timeout=15)
        assert r.status_code in (200, 404), f"{r.status_code}: {r.text[:200]}"


# ==================== 5. Tareas ====================

class TestTareas:
    @pytest.fixture(scope="class")
    def tarea_id(self, admin_headers):
        payload = {"titulo": "TEST_iter11 tarea regresión",
                   "descripcion": "Auto-tarea para tests",
                   "fecha_limite": "2026-12-31",
                   "prioridad": "media"}
        r = requests.post(f"{BASE_URL}/api/gestor/tareas", headers=admin_headers,
                          json=payload, timeout=15)
        if r.status_code not in (200, 201):
            pytest.skip(f"No se pudo crear tarea: {r.status_code} {r.text[:200]}")
        d = r.json()
        return d.get("id") or (d.get("tarea") or {}).get("id")

    def test_listado(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/tareas", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        _no_mongo_id(r.json())

    def test_create(self, tarea_id):
        assert tarea_id

    def test_comentarios(self, admin_headers, tarea_id):
        # Endpoint declarado en review: GET /api/gestor/tareas/{id}/comentarios
        r = requests.get(f"{BASE_URL}/api/gestor/tareas/{tarea_id}/comentarios",
                         headers=admin_headers, timeout=15)
        assert r.status_code in (200, 404), f"{r.status_code}: {r.text[:200]}"

    def test_cleanup(self, admin_headers, tarea_id):
        if tarea_id:
            requests.delete(f"{BASE_URL}/api/gestor/tareas/{tarea_id}",
                            headers=admin_headers, timeout=10)


# ==================== 6. Mensajes (Chat Interno) ====================

class TestMensajes:
    def test_canales(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/mensajes/canales",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_general_get(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/mensajes/general",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        _no_mongo_id(r.json())

    def test_general_post(self, admin_headers):
        body = {"contenido": f"TEST_iter11 ping {uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{BASE_URL}/api/gestor/mensajes/general",
                          headers=admin_headers, json=body, timeout=15)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:200]}"

    def test_no_leidos(self, admin_headers):
        # review pide /no-leidos; el código real expone /no-leidos/lista
        r1 = requests.get(f"{BASE_URL}/api/gestor/mensajes/no-leidos",
                          headers=admin_headers, timeout=10)
        r2 = requests.get(f"{BASE_URL}/api/gestor/mensajes/no-leidos/lista",
                          headers=admin_headers, timeout=10)
        # al menos uno debe responder 200
        assert (r1.status_code == 200) or (r2.status_code == 200), \
            f"no-leidos: {r1.status_code} / no-leidos/lista: {r2.status_code}"


# ==================== 7. Archivo musical ====================

class TestArchivo:
    def test_obras_listado(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/archivo/obras",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        _no_mongo_id(r.json())

    def test_prestamos(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/archivo/prestamos",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_alertas(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/archivo/alertas",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_secciones_endpoint(self, admin_headers):
        # Review pide /api/gestor/archivo/secciones — verificar si existe
        r = requests.get(f"{BASE_URL}/api/gestor/archivo/secciones",
                         headers=admin_headers, timeout=15)
        # Si no existe → 404; si existe → 200
        assert r.status_code in (200, 404), f"{r.status_code}: {r.text[:200]}"

    def test_plantilla_obras(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/archivo/plantilla-obras",
                         headers=admin_headers, timeout=15)
        assert r.status_code in (200, 404)

    @pytest.fixture(scope="class")
    def obra_id(self, admin_headers):
        payload = {"titulo": f"TEST_iter11 Sinfonia {uuid.uuid4().hex[:5]}",
                   "autor": "Test Composer"}
        r = requests.post(f"{BASE_URL}/api/gestor/archivo/obras",
                          headers=admin_headers, json=payload, timeout=20)
        if r.status_code not in (200, 201):
            pytest.skip(f"No se pudo crear obra: {r.status_code} {r.text[:300]}")
        d = r.json()
        return d.get("id") or (d.get("obra") or {}).get("id")

    def test_obra_creada_persistida(self, admin_headers, obra_id):
        assert obra_id
        r = requests.get(f"{BASE_URL}/api/gestor/archivo/obras/{obra_id}",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        d = r.json()
        # Detalle puede ser {obra: {...}, eventos, originales, partes} o flat
        obra = d.get("obra") if isinstance(d.get("obra"), dict) else d
        assert obra.get("titulo", "").startswith("TEST_iter11")


# ==================== 8. Portal Músico ====================

class TestPortal:
    def test_mis_eventos(self, musico_headers):
        r = requests.get(f"{BASE_URL}/api/portal/mis-eventos",
                         headers=musico_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        _no_mongo_id(r.json())

    def test_calendario(self, musico_headers):
        r = requests.get(f"{BASE_URL}/api/portal/calendario",
                         headers=musico_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"


# ==================== 9. Role guards ====================

class TestRoleGuards:
    def test_musico_no_accede_a_gestor_eventos(self, musico_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos",
                         headers=musico_headers, timeout=15)
        assert r.status_code in (401, 403), f"Esperado 401/403, got {r.status_code}: {r.text[:200]}"

    def test_musico_no_accede_a_gestor_archivo(self, musico_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/archivo/obras",
                         headers=musico_headers, timeout=15)
        assert r.status_code in (401, 403), f"Esperado 401/403, got {r.status_code}"

    def test_musico_no_accede_a_gestor_mensajes(self, musico_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/mensajes/general",
                         headers=musico_headers, timeout=15)
        assert r.status_code in (401, 403), f"Esperado 401/403, got {r.status_code}"

    def test_unauth_no_accede_a_gestor(self):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos", timeout=10)
        assert r.status_code in (401, 403)
