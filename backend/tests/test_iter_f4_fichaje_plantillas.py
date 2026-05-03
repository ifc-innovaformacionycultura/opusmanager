"""Iter F4 — Reglas de fichaje por ensayo + plantillas globales.

Cubre:
  * GET  /api/gestor/fichaje-config/{ensayo_id}
  * PUT  /api/gestor/fichaje-config/{ensayo_id} (13 campos + retro-compat 5 campos)
  * GET  /api/gestor/fichaje-plantillas
  * POST /api/gestor/fichaje-plantillas (columnas planas, no JSONB)
  * PUT/DELETE plantilla + permisos (creador / super-admin / 403 / 404)
  * POST /api/gestor/fichaje-config/{ensayo_id}/aplicar-plantilla/{plantilla_id}
  * POST /api/gestor/eventos/{evento_id}/fichaje/aplicar-plantilla/{plantilla_id}
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

PREFIX = "TEST_F4"

_THIRTEEN_FIELDS = [
    "minutos_antes_apertura", "minutos_despues_cierre", "minutos_retraso_aviso",
    "computa_tiempo_extra", "computa_mas_alla_fin",
    "notif_musico_push", "notif_musico_email", "notif_musico_whatsapp",
    "notif_gestor_push", "notif_gestor_email", "notif_gestor_dashboard",
    "mensaje_aviso_musico", "mensaje_aviso_gestor",
]


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"No login {email}: {r.status_code} {r.text[:120]}")
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
def gestor_client():
    tok = _login(GESTOR_EMAIL, GESTOR_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def ensayo_evento(admin_client):
    """Localiza (ensayo_id, evento_id) donde ensayo tipo='ensayo'."""
    r = admin_client.get(f"{BASE_URL}/api/gestor/registro-asistencia", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    eventos = data.get('eventos') or data if isinstance(data, list) else data.get('eventos') or []
    # Iterar eventos para localizar un ensayo tipo=ensayo
    for ev in eventos:
        for en in (ev.get('ensayos') or []):
            if (en.get('tipo') or 'ensayo') == 'ensayo' and en.get('id'):
                return en['id'], ev.get('id') or ev.get('evento_id') or en.get('evento_id')
    # Fallback via /api/gestor/eventos + /api/gestor/ensayos-evento
    r2 = admin_client.get(f"{BASE_URL}/api/gestor/eventos", timeout=15)
    ev_list = r2.json() if isinstance(r2.json(), list) else (r2.json().get('eventos') or [])
    for ev in ev_list:
        eid = ev.get('id')
        if not eid:
            continue
        r3 = admin_client.get(f"{BASE_URL}/api/gestor/ensayos-evento/{eid}", timeout=15)
        if r3.status_code != 200:
            continue
        ensayos = r3.json().get('ensayos') or []
        for en in ensayos:
            if (en.get('tipo') or 'ensayo') == 'ensayo' and en.get('id'):
                return en['id'], eid
    pytest.skip("No se encontró ensayo tipo='ensayo' en el entorno")


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_client):
    yield
    try:
        r = admin_client.get(f"{BASE_URL}/api/gestor/fichaje-plantillas", timeout=15)
        for p in (r.json().get('plantillas') or []):
            if PREFIX in (p.get('nombre') or ''):
                admin_client.delete(f"{BASE_URL}/api/gestor/fichaje-plantillas/{p['id']}", timeout=15)
    except Exception:
        pass


# ====================================================================
# BACKEND — GET/PUT fichaje-config
# ====================================================================
class TestFichajeConfig:
    def test_01_get_config_devuelve_13_campos(self, admin_client, ensayo_evento):
        ensayo_id, _ = ensayo_evento
        r = admin_client.get(f"{BASE_URL}/api/gestor/fichaje-config/{ensayo_id}", timeout=15)
        assert r.status_code == 200, r.text
        assert 'config' in r.json()
        cfg = r.json()['config']
        # Los 13 campos deben estar presentes (valores pueden ser None / boolean / int / str)
        for f in _THIRTEEN_FIELDS:
            assert f in cfg, f"Falta campo {f} en config"

    def test_02_put_config_con_5_campos_originales(self, admin_client, ensayo_evento):
        """Regresión: PUT con solo los 5 campos antiguos no rompe."""
        ensayo_id, _ = ensayo_evento
        payload = {
            "minutos_antes_apertura": 10,
            "minutos_despues_cierre": 15,
            "minutos_retraso_aviso": 5,
            "computa_tiempo_extra": True,
            "computa_mas_alla_fin": False,
        }
        r = admin_client.put(f"{BASE_URL}/api/gestor/fichaje-config/{ensayo_id}", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        # Verificación
        rg = admin_client.get(f"{BASE_URL}/api/gestor/fichaje-config/{ensayo_id}", timeout=15)
        cfg = rg.json()['config']
        assert cfg['minutos_antes_apertura'] == 10
        assert cfg['minutos_despues_cierre'] == 15
        assert cfg['minutos_retraso_aviso'] == 5

    def test_03_put_config_con_8_campos_notificaciones(self, admin_client, ensayo_evento):
        ensayo_id, _ = ensayo_evento
        payload = {
            "notif_musico_push": True,
            "notif_musico_email": False,
            "notif_musico_whatsapp": True,
            "notif_gestor_push": False,
            "notif_gestor_email": True,
            "notif_gestor_dashboard": True,
            "mensaje_aviso_musico": f"{PREFIX} mensaje musico",
            "mensaje_aviso_gestor": f"{PREFIX} mensaje gestor",
        }
        r = admin_client.put(f"{BASE_URL}/api/gestor/fichaje-config/{ensayo_id}", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        # Verificación
        rg = admin_client.get(f"{BASE_URL}/api/gestor/fichaje-config/{ensayo_id}", timeout=15)
        cfg = rg.json()['config']
        assert cfg['notif_musico_push'] is True
        assert cfg['notif_musico_email'] is False
        assert cfg['notif_musico_whatsapp'] is True
        assert cfg['notif_gestor_email'] is True
        assert cfg['mensaje_aviso_musico'] == f"{PREFIX} mensaje musico"
        assert cfg['mensaje_aviso_gestor'] == f"{PREFIX} mensaje gestor"


# ====================================================================
# BACKEND — CRUD plantillas
# ====================================================================
class TestPlantillasFichaje:
    def test_10_get_plantillas_estructura(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/gestor/fichaje-plantillas", timeout=15)
        assert r.status_code == 200, r.text
        assert "plantillas" in r.json()
        assert isinstance(r.json()['plantillas'], list)

    def test_11_post_plantilla_columnas_planas(self, admin_client):
        nombre = f"{PREFIX}_admin_{uuid.uuid4().hex[:6]}"
        payload = {
            "nombre": nombre,
            "descripcion": "Plantilla test F4 admin",
            "minutos_antes_apertura": 20,
            "minutos_despues_cierre": 25,
            "minutos_retraso_aviso": 7,
            "computa_tiempo_extra": True,
            "computa_mas_alla_fin": True,
            "notif_musico_push": True,
            "notif_musico_email": True,
            "notif_musico_whatsapp": False,
            "notif_gestor_push": True,
            "notif_gestor_email": False,
            "notif_gestor_dashboard": True,
            "mensaje_aviso_musico": f"{PREFIX} aviso mus",
            "mensaje_aviso_gestor": f"{PREFIX} aviso ges",
        }
        r = admin_client.post(f"{BASE_URL}/api/gestor/fichaje-plantillas", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        pl = r.json().get('plantilla')
        assert pl and pl.get('id')
        pytest.plantilla_admin_id = pl['id']
        # Persistencia via GET
        rg = admin_client.get(f"{BASE_URL}/api/gestor/fichaje-plantillas", timeout=15)
        encontrada = next((p for p in rg.json()['plantillas'] if p['id'] == pl['id']), None)
        assert encontrada is not None, "Plantilla no persistida"
        # Columnas planas presentes en la fila (no dentro de 'reglas')
        for f in _THIRTEEN_FIELDS:
            assert f in encontrada, f"Campo plano {f} ausente — ¿JSONB residual?"
        assert encontrada['nombre'] == nombre
        assert encontrada['minutos_antes_apertura'] == 20
        assert encontrada['computa_tiempo_extra'] is True
        assert encontrada['mensaje_aviso_musico'] == f"{PREFIX} aviso mus"

    def test_12_put_plantilla_admin_edita(self, admin_client):
        pid = getattr(pytest, 'plantilla_admin_id', None)
        assert pid
        payload = {
            "nombre": f"{PREFIX}_admin_editada",
            "descripcion": "editada",
            "minutos_antes_apertura": 30,
        }
        r = admin_client.put(f"{BASE_URL}/api/gestor/fichaje-plantillas/{pid}", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        # Verificar
        rg = admin_client.get(f"{BASE_URL}/api/gestor/fichaje-plantillas", timeout=15)
        upd = next((p for p in rg.json()['plantillas'] if p['id'] == pid), None)
        assert upd['nombre'] == f"{PREFIX}_admin_editada"
        assert upd['minutos_antes_apertura'] == 30

    def test_13_gestor_normal_403_put_plantilla_de_admin(self, gestor_client):
        pid = getattr(pytest, 'plantilla_admin_id', None)
        assert pid
        r = gestor_client.put(f"{BASE_URL}/api/gestor/fichaje-plantillas/{pid}",
                              json={"nombre": "x"}, timeout=15)
        assert r.status_code == 403, f"Esperado 403, got {r.status_code}: {r.text[:120]}"

    def test_14_gestor_normal_403_delete_plantilla_de_admin(self, gestor_client):
        pid = getattr(pytest, 'plantilla_admin_id', None)
        assert pid
        r = gestor_client.delete(f"{BASE_URL}/api/gestor/fichaje-plantillas/{pid}", timeout=15)
        assert r.status_code == 403, f"Esperado 403, got {r.status_code}"

    def test_15_delete_plantilla_404(self, admin_client):
        r = admin_client.delete(
            f"{BASE_URL}/api/gestor/fichaje-plantillas/00000000-0000-0000-0000-000000000000",
            timeout=15)
        assert r.status_code == 404

    def test_16_put_plantilla_404(self, admin_client):
        r = admin_client.put(
            f"{BASE_URL}/api/gestor/fichaje-plantillas/00000000-0000-0000-0000-000000000000",
            json={"nombre": "x"}, timeout=15)
        assert r.status_code == 404


# ====================================================================
# BACKEND — aplicar plantilla (por ensayo y por evento)
# ====================================================================
class TestAplicarPlantilla:
    @pytest.fixture(scope="class")
    def plantilla_aplicar(self, admin_client):
        nombre = f"{PREFIX}_aplicar_{uuid.uuid4().hex[:6]}"
        payload = {
            "nombre": nombre,
            "minutos_antes_apertura": 45,
            "minutos_despues_cierre": 55,
            "minutos_retraso_aviso": 9,
            "computa_tiempo_extra": False,
            "computa_mas_alla_fin": True,
            "notif_musico_push": False,
            "notif_musico_email": True,
            "notif_musico_whatsapp": False,
            "notif_gestor_push": True,
            "notif_gestor_email": True,
            "notif_gestor_dashboard": False,
            "mensaje_aviso_musico": f"{PREFIX} msg_mus",
            "mensaje_aviso_gestor": f"{PREFIX} msg_ges",
        }
        r = admin_client.post(f"{BASE_URL}/api/gestor/fichaje-plantillas", json=payload, timeout=15)
        assert r.status_code == 200
        return r.json()['plantilla']['id']

    def test_20_aplicar_plantilla_a_ensayo(self, admin_client, ensayo_evento, plantilla_aplicar):
        ensayo_id, _ = ensayo_evento
        r = admin_client.post(
            f"{BASE_URL}/api/gestor/fichaje-config/{ensayo_id}/aplicar-plantilla/{plantilla_aplicar}",
            timeout=15)
        assert r.status_code == 200, r.text
        # Verificar config refleja los 13 campos de la plantilla
        rg = admin_client.get(f"{BASE_URL}/api/gestor/fichaje-config/{ensayo_id}", timeout=15)
        cfg = rg.json()['config']
        assert cfg['minutos_antes_apertura'] == 45
        assert cfg['minutos_despues_cierre'] == 55
        assert cfg['minutos_retraso_aviso'] == 9
        assert cfg['computa_tiempo_extra'] is False
        assert cfg['computa_mas_alla_fin'] is True
        assert cfg['notif_musico_email'] is True
        assert cfg['notif_gestor_push'] is True
        assert cfg['mensaje_aviso_musico'] == f"{PREFIX} msg_mus"
        assert cfg['mensaje_aviso_gestor'] == f"{PREFIX} msg_ges"

    def test_21_aplicar_plantilla_ensayo_404_plantilla(self, admin_client, ensayo_evento):
        ensayo_id, _ = ensayo_evento
        r = admin_client.post(
            f"{BASE_URL}/api/gestor/fichaje-config/{ensayo_id}/aplicar-plantilla/00000000-0000-0000-0000-000000000000",
            timeout=15)
        assert r.status_code == 404

    def test_22_aplicar_plantilla_ensayo_404_ensayo(self, admin_client, plantilla_aplicar):
        r = admin_client.post(
            f"{BASE_URL}/api/gestor/fichaje-config/00000000-0000-0000-0000-000000000000/aplicar-plantilla/{plantilla_aplicar}",
            timeout=15)
        assert r.status_code == 404

    def test_23_aplicar_plantilla_a_evento(self, admin_client, ensayo_evento, plantilla_aplicar):
        _, evento_id = ensayo_evento
        if not evento_id:
            pytest.skip("evento_id no resuelto en fixture")
        r = admin_client.post(
            f"{BASE_URL}/api/gestor/eventos/{evento_id}/fichaje/aplicar-plantilla/{plantilla_aplicar}",
            timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get('ok') is True
        assert 'aplicados' in j and 'total_ensayos' in j
        assert j['aplicados'] <= j['total_ensayos']

    def test_24_aplicar_plantilla_evento_404(self, admin_client, ensayo_evento):
        _, evento_id = ensayo_evento
        if not evento_id:
            pytest.skip("evento_id no resuelto")
        r = admin_client.post(
            f"{BASE_URL}/api/gestor/eventos/{evento_id}/fichaje/aplicar-plantilla/00000000-0000-0000-0000-000000000000",
            timeout=15)
        assert r.status_code == 404


# ====================================================================
# REGRESIÓN F1+F2+F3
# ====================================================================
class TestRegresion:
    def test_30_listas_obras_favoritas_ok(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/gestor/archivo/listas-obras-favoritas", timeout=15)
        assert r.status_code == 200

    def test_31_eventos_ok(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/gestor/eventos", timeout=15)
        assert r.status_code == 200
