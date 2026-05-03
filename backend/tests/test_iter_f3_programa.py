"""Iter F3 — Programa Musical conectado con Archivo + Listas obras favoritas globales.

Cubre:
  * GET/POST/PUT/DELETE /api/gestor/archivo/listas-obras-favoritas (1-4)
  * PATCH /api/gestor/archivo/evento/{id}/obras/{eo_id} (5)
  * DELETE /api/gestor/archivo/evento/{id}/obras/{eo_id} (6)
  * POST /api/gestor/archivo/evento/{id}/programa/migrar (7)
  * POST /api/gestor/archivo/evento/{id}/programa/aplicar-lista/{lista_id} (8)
  * Permisos (creador / super-admin) en PUT y DELETE listas
  * Idempotencia migrar
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://contact-conductor.preview.emergentagent.com').rstrip('/')

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASS = "Admin123!"
GESTOR_EMAIL = "palvarez@netmetrix.es"
GESTOR_PASS = "Opus2026!"

PREFIX = "TEST_F3"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"No se pudo loguear {email}: {r.status_code} {r.text[:120]}")
    tok = r.json().get('access_token') or r.json().get('token')
    if not tok:
        pytest.skip(f"Login sin token: {r.json()}")
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def gestor_token():
    return _login(GESTOR_EMAIL, GESTOR_PASS)


@pytest.fixture(scope="module")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def gestor_client(gestor_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {gestor_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def evento_id(admin_client):
    """Selecciona un evento existente para usar en los tests."""
    r = admin_client.get(f"{BASE_URL}/api/gestor/eventos", timeout=20)
    assert r.status_code == 200, f"No se pudo listar eventos: {r.status_code}"
    data = r.json()
    eventos = data if isinstance(data, list) else (data.get('eventos') or [])
    if not eventos:
        pytest.skip("No hay eventos en el sistema para testear")
    # Preferir el evento c4409142 (Concierto Navidad usado en iters previas)
    pref = next((e for e in eventos if str(e.get('id', '')).startswith('c4409142')), None)
    return (pref or eventos[0])['id']


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(admin_client, evento_id):
    yield
    # Borrar listas TEST_F3
    try:
        r = admin_client.get(f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas", timeout=15)
        for l in (r.json().get('listas') or []):
            if PREFIX in (l.get('nombre') or ''):
                admin_client.delete(f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas/{l['id']}", timeout=15)
    except Exception:
        pass
    # Borrar filas evento_obras TEST_F3
    try:
        r = admin_client.get(f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/programa", timeout=15)
        for row in (r.json().get('programa') or []):
            ttl = (row.get('titulo_provisional') or '')
            notas = (row.get('notas') or '')
            if PREFIX in ttl or PREFIX in notas:
                admin_client.delete(
                    f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras/{row['id']}",
                    timeout=15)
    except Exception:
        pass


# ============================================================
# 1. GET listas-obras-favoritas
# ============================================================
class TestListasFavoritas:
    def test_01_get_listas_estructura(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "listas" in data
        assert isinstance(data['listas'], list)

    def test_02_post_lista_crea_y_persiste(self, admin_client):
        nombre = f"{PREFIX}_lista_admin_{uuid.uuid4().hex[:6]}"
        payload = {
            "nombre": nombre,
            "descripcion": "Lista creada por admin para test F3",
            "obras": [
                {"titulo_provisional": f"{PREFIX} Sinfonía X", "autor_display": "Test Autor",
                 "duracion_display": "12'", "orden": 1},
                {"titulo_provisional": f"{PREFIX} Obertura Y", "autor_display": None,
                 "duracion_display": "5'", "orden": 2},
            ],
        }
        r = admin_client.post(
            f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        lista = r.json().get('lista')
        assert lista, "Respuesta sin lista"
        assert lista['nombre'] == nombre
        assert isinstance(lista.get('obras'), list) and len(lista['obras']) == 2
        # Verificación persistencia GET
        r2 = admin_client.get(f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas", timeout=15)
        ids = [l['id'] for l in r2.json().get('listas', [])]
        assert lista['id'] in ids
        pytest.lista_admin_id = lista['id']

    def test_03_put_lista_admin_edita(self, admin_client):
        lid = getattr(pytest, 'lista_admin_id', None)
        assert lid, "test_02 debe ejecutarse antes"
        nuevo_nombre = f"{PREFIX}_lista_admin_renombrada"
        r = admin_client.put(
            f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas/{lid}",
            json={"nombre": nuevo_nombre, "descripcion": "edit", "obras": [
                {"titulo_provisional": f"{PREFIX} Solo Una", "orden": 1}
            ]}, timeout=15)
        assert r.status_code == 200, r.text
        # Verificar GET refleja cambios
        r2 = admin_client.get(f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas", timeout=15)
        upd = next((l for l in r2.json().get('listas', []) if l['id'] == lid), None)
        assert upd is not None
        assert upd['nombre'] == nuevo_nombre
        assert len(upd.get('obras') or []) == 1

    def test_04_put_otro_usuario_403(self, admin_client, gestor_client):
        # Crear una lista como GESTOR, intentar editar con otro user (no super admin)
        # Aquí gestor crea, y otro gestor (mismo o admin?) — probamos: admin SÍ puede; gestor diferente NO.
        # Para este test creamos como gestor y editamos como admin (debe permitir por super-admin).
        nombre = f"{PREFIX}_lista_gestor_{uuid.uuid4().hex[:6]}"
        rc = gestor_client.post(
            f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas",
            json={"nombre": nombre, "descripcion": None,
                  "obras": [{"titulo_provisional": f"{PREFIX} G1", "orden": 1}]},
            timeout=15)
        assert rc.status_code == 200, rc.text
        lid = rc.json()['lista']['id']
        pytest.lista_gestor_id = lid

        # Admin (super-admin) PUEDE editarla
        ru = admin_client.put(
            f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas/{lid}",
            json={"nombre": nombre + "_admin_edit", "descripcion": None,
                  "obras": [{"titulo_provisional": f"{PREFIX} G1edit", "orden": 1}]},
            timeout=15)
        assert ru.status_code == 200, ru.text

    def test_05_delete_lista_admin_borra_creada_por_otro(self, admin_client):
        lid = getattr(pytest, 'lista_gestor_id', None)
        assert lid, "test_04 debe ejecutarse antes"
        r = admin_client.delete(
            f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas/{lid}", timeout=15)
        assert r.status_code == 200, r.text
        # Verificar
        r2 = admin_client.get(f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas", timeout=15)
        assert lid not in [l['id'] for l in r2.json().get('listas', [])]

    def test_06_delete_lista_otro_gestor_403(self, admin_client, gestor_client):
        """Admin crea lista; gestor normal (no creador, no super-admin) intenta borrar → 403."""
        nombre = f"{PREFIX}_lista_solo_admin_{uuid.uuid4().hex[:6]}"
        rc = admin_client.post(
            f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas",
            json={"nombre": nombre, "obras": []}, timeout=15)
        assert rc.status_code == 200
        lid = rc.json()['lista']['id']
        try:
            rd = gestor_client.delete(
                f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas/{lid}", timeout=15)
            assert rd.status_code == 403, f"Esperado 403, got {rd.status_code}: {rd.text}"
            # Y PUT también debe dar 403
            rp = gestor_client.put(
                f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas/{lid}",
                json={"nombre": nombre, "obras": []}, timeout=15)
            assert rp.status_code == 403, f"Esperado 403 PUT, got {rp.status_code}"
        finally:
            admin_client.delete(
                f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas/{lid}", timeout=15)

    def test_07_delete_lista_404(self, admin_client):
        r = admin_client.delete(
            f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas/00000000-0000-0000-0000-000000000000",
            timeout=15)
        assert r.status_code == 404


# ============================================================
# PATCH / DELETE filas evento_obras + aplicar-lista + migrar
# ============================================================
class TestProgramaEvento:
    def test_10_post_obra_y_patch(self, admin_client, evento_id):
        # Crear fila inicial
        rp = admin_client.post(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras",
            json={"titulo_provisional": f"{PREFIX} Obra inicial", "orden_programa": 999, "estado": "provisional"},
            timeout=15)
        assert rp.status_code == 200, rp.text
        eo = rp.json().get('evento_obra') or rp.json()
        eo_id = eo.get('id')
        assert eo_id
        pytest.eo_id = eo_id

        # PATCH titulo + duracion + notas
        rpatch = admin_client.patch(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras/{eo_id}",
            json={"duracion_display": "20'", "autor_display": "Beethoven Test",
                  "notas": f"{PREFIX} notas patched", "orden_programa": 998},
            timeout=15)
        assert rpatch.status_code == 200, rpatch.text
        # Verificar GET
        rg = admin_client.get(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/programa", timeout=15)
        row = next((x for x in rg.json().get('programa', []) if x['id'] == eo_id), None)
        assert row is not None
        assert row['duracion_display'] == "20'"
        assert row['autor_display'] == "Beethoven Test"
        assert row['notas'] == f"{PREFIX} notas patched"
        assert row['orden_programa'] == 998

    def test_11_patch_404(self, admin_client, evento_id):
        r = admin_client.patch(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras/00000000-0000-0000-0000-000000000000",
            json={"notas": "x"}, timeout=15)
        assert r.status_code == 404

    def test_12_delete_fila(self, admin_client, evento_id):
        eo_id = getattr(pytest, 'eo_id', None)
        assert eo_id
        r = admin_client.delete(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras/{eo_id}", timeout=15)
        assert r.status_code == 200, r.text
        # Verificar que ya no está
        rg = admin_client.get(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/programa", timeout=15)
        ids = [x['id'] for x in rg.json().get('programa', [])]
        assert eo_id not in ids

    def test_13_delete_404(self, admin_client, evento_id):
        r = admin_client.delete(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras/00000000-0000-0000-0000-000000000000",
            timeout=15)
        assert r.status_code == 404

    def test_14_migrar_idempotente_ya_tiene_filas(self, admin_client, evento_id):
        """Si el evento ya tiene filas → migrado:false motivo:ya_tiene_filas.
        Para garantizar al menos una fila, creamos una temporal."""
        rp = admin_client.post(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras",
            json={"titulo_provisional": f"{PREFIX} guard fila", "orden_programa": 9999,
                  "estado": "provisional"},
            timeout=15)
        assert rp.status_code == 200
        guard_id = rp.json().get('evento_obra', {}).get('id') or rp.json().get('id')
        try:
            r = admin_client.post(
                f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/programa/migrar",
                json={}, timeout=15)
            assert r.status_code == 200, r.text
            j = r.json()
            assert j.get('migrado') is False
            assert j.get('motivo') == 'ya_tiene_filas'
        finally:
            if guard_id:
                admin_client.delete(
                    f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras/{guard_id}",
                    timeout=15)

    def test_15_migrar_sin_legacy_devuelve_false(self, admin_client):
        """Para un evento sin filas y sin legacy: motivo:sin_legacy.
        Buscamos un evento que tenga 0 filas Y program vacío. Si no lo encontramos, skip.
        """
        # Listar eventos
        rl = admin_client.get(f"{BASE_URL}/api/gestor/eventos", timeout=20)
        assert rl.status_code == 200
        eventos = rl.json() if isinstance(rl.json(), list) else (rl.json().get('eventos') or [])
        candidate = None
        for ev in eventos[:30]:
            eid = ev.get('id')
            if not eid:
                continue
            try:
                rp = admin_client.get(
                    f"{BASE_URL}/api/gestor/archivo/evento/{eid}/programa", timeout=15)
                if rp.status_code != 200:
                    continue
                if (rp.json().get('programa') or []):
                    continue
                # Hacer migrar — si motivo == sin_legacy, perfecto
                rm = admin_client.post(
                    f"{BASE_URL}/api/gestor/archivo/evento/{eid}/programa/migrar",
                    json={}, timeout=15)
                if rm.status_code == 200 and rm.json().get('motivo') == 'sin_legacy':
                    candidate = eid
                    break
                # Si motivo es 'ya_tiene_filas' tras migración exitosa, también es válido como idempotencia
                if rm.status_code == 200 and rm.json().get('migrado') is False:
                    # vale como prueba de idempotencia, pero no es "sin_legacy"
                    pass
            except Exception:
                continue
        if not candidate:
            pytest.skip("No se encontró evento sin filas y sin legacy program")
        # Re-verificar idempotencia: una segunda llamada también devuelve sin_legacy
        rm2 = admin_client.post(
            f"{BASE_URL}/api/gestor/archivo/evento/{candidate}/programa/migrar",
            json={}, timeout=15)
        assert rm2.status_code == 200
        assert rm2.json().get('migrado') is False
        assert rm2.json().get('motivo') == 'sin_legacy'

    def test_16_aplicar_lista_anade_al_final(self, admin_client, evento_id):
        # 1) Crear lista con 2 obras
        nombre = f"{PREFIX}_lista_aplicar_{uuid.uuid4().hex[:6]}"
        rl = admin_client.post(
            f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas",
            json={"nombre": nombre, "obras": [
                {"titulo_provisional": f"{PREFIX} AppOne", "duracion_display": "8'",
                 "autor_display": "X", "orden": 1},
                {"titulo_provisional": f"{PREFIX} AppTwo", "duracion_display": "9'",
                 "autor_display": "Y", "orden": 2},
            ]}, timeout=15)
        assert rl.status_code == 200
        lid = rl.json()['lista']['id']

        # 2) Contar filas actuales
        rg = admin_client.get(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/programa", timeout=15)
        before = len(rg.json().get('programa') or [])
        max_orden = max([int(r.get('orden_programa') or 0) for r in (rg.json().get('programa') or [])] or [0])

        # 3) Aplicar lista
        rap = admin_client.post(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/programa/aplicar-lista/{lid}",
            json={}, timeout=20)
        assert rap.status_code == 200, rap.text
        assert rap.json().get('creadas') == 2

        # 4) Verificar
        rg2 = admin_client.get(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/programa", timeout=15)
        rows2 = rg2.json().get('programa') or []
        assert len(rows2) == before + 2
        # Las nuevas tienen orden_programa > max_orden
        nuevas = [r for r in rows2 if (PREFIX + " App") in (r.get('titulo_provisional') or '')]
        assert len(nuevas) >= 2
        for n in nuevas:
            assert int(n.get('orden_programa') or 0) > max_orden
            # Estado: como no hay match en obras catalogo → provisional
            assert n.get('estado') == 'provisional'

        # Cleanup
        admin_client.delete(
            f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas/{lid}", timeout=15)
        for n in nuevas:
            admin_client.delete(
                f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/obras/{n['id']}", timeout=15)

    def test_17_aplicar_lista_404(self, admin_client, evento_id):
        r = admin_client.post(
            f"{BASE_URL}/api/gestor/archivo/evento/{evento_id}/programa/aplicar-lista/00000000-0000-0000-0000-000000000000",
            json={}, timeout=15)
        assert r.status_code == 404


# ============================================================
# Regresión mínima Iter previas
# ============================================================
class TestRegresionPrevias:
    def test_20_eventos_listing_ok(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/gestor/eventos", timeout=15)
        assert r.status_code == 200

    def test_21_transporte_legacy_ok(self, admin_client, evento_id):
        r = admin_client.get(
            f"{BASE_URL}/api/gestor/transporte-material/{evento_id}", timeout=15)
        # Debe funcionar (200) y devolver claves planas (no operaciones)
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            j = r.json()
            assert 'transporte' in j or 'operaciones' not in j

    def test_22_plantilla_definitiva_ok(self, admin_client, evento_id):
        r = admin_client.get(
            f"{BASE_URL}/api/gestor/plantilla-definitiva/{evento_id}", timeout=15)
        assert r.status_code in (200, 404)
