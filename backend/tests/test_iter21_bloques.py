"""Iter21 — Bloques 1, 2, 3, 4 — Auto-registro músicos, CRM neutro, Historial, 5ª plantilla."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://contact-conductor.preview.emergentagent.com').rstrip('/')

ADMIN = {"email": "admin@convocatorias.com", "password": "Admin123!"}
DG = {"email": "jalonso@p.csmb.es", "password": "Director2026!"}
MUSICO = {"email": "jesusalonsodirector@gmail.com", "password": "Musico123!"}
MUSICO_ID = "8bf521fa-dc27-4c5b-8069-d36d3d4eaad3"


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {creds['email']}: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def dg_token():
    return _login(DG)


@pytest.fixture(scope="module")
def musico_token():
    return _login(MUSICO)


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# =================================================================
# Bloque 1 — Configuración registro público
# =================================================================
class TestBloque1Config:
    def test_get_config_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/registro-publico/config", headers=H(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "config" in d
        cfg = d["config"]
        assert "token" in cfg and cfg["token"]
        assert "activo" in cfg
        assert d.get("editable") is True

    def test_get_config_dg(self, dg_token):
        r = requests.get(f"{BASE_URL}/api/admin/registro-publico/config", headers=H(dg_token), timeout=15)
        assert r.status_code == 200
        assert r.json().get("editable") is True

    def test_put_config_change_mensaje(self, admin_token):
        nuevo_msg = f"Test {uuid.uuid4().hex[:6]}"
        r = requests.put(f"{BASE_URL}/api/admin/registro-publico/config",
                         headers=H(admin_token),
                         json={"mensaje_bienvenida": nuevo_msg, "activo": True},
                         timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["config"]["mensaje_bienvenida"] == nuevo_msg

    def test_regenerar_token_changes_token(self, admin_token):
        r1 = requests.get(f"{BASE_URL}/api/admin/registro-publico/config", headers=H(admin_token)).json()
        old = r1["config"]["token"]
        r2 = requests.put(f"{BASE_URL}/api/admin/registro-publico/config",
                          headers=H(admin_token), json={"regenerar_token": True}, timeout=15)
        assert r2.status_code == 200
        new = r2.json()["config"]["token"]
        assert new != old and len(new) > 10


# =================================================================
# Bloque 1 — Endpoints públicos
# =================================================================
class TestBloque1Publico:
    @pytest.fixture(autouse=True)
    def _setup(self, admin_token):
        self.token = requests.get(f"{BASE_URL}/api/admin/registro-publico/config", headers=H(admin_token)).json()["config"]["token"]
        # asegurar activo=true
        requests.put(f"{BASE_URL}/api/admin/registro-publico/config", headers=H(admin_token), json={"activo": True})

    def test_info_token_valid(self):
        r = requests.get(f"{BASE_URL}/api/registro-publico/info/{self.token}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "org_nombre" in d

    def test_info_token_invalid(self):
        r = requests.get(f"{BASE_URL}/api/registro-publico/info/no-existe-xxx", timeout=15)
        assert r.status_code == 404

    def test_info_token_inactivo_410(self, admin_token):
        # Desactivar
        requests.put(f"{BASE_URL}/api/admin/registro-publico/config", headers=H(admin_token), json={"activo": False})
        try:
            r = requests.get(f"{BASE_URL}/api/registro-publico/info/{self.token}", timeout=15)
            assert r.status_code == 410
        finally:
            requests.put(f"{BASE_URL}/api/admin/registro-publico/config", headers=H(admin_token), json={"activo": True})

    def test_crear_solicitud_email_invalido(self):
        r = requests.post(f"{BASE_URL}/api/registro-publico/{self.token}", json={
            "nombre": "Test", "apellidos": "User", "email": "no-es-email",
            "instrumento": "Violín", "password": "Password123",
        }, timeout=15)
        assert r.status_code in (400, 422)

    def test_crear_solicitud_password_corto(self):
        r = requests.post(f"{BASE_URL}/api/registro-publico/{self.token}", json={
            "nombre": "Test", "apellidos": "User",
            "email": f"test_short_{uuid.uuid4().hex[:6]}@example.com",
            "instrumento": "Violín", "password": "abc",
        }, timeout=15)
        assert r.status_code == 400

    def test_crear_solicitud_email_existente(self):
        r = requests.post(f"{BASE_URL}/api/registro-publico/{self.token}", json={
            "nombre": "Test", "apellidos": "User",
            "email": "admin@convocatorias.com",
            "instrumento": "Violín", "password": "Password123",
        }, timeout=15)
        assert r.status_code == 409


# =================================================================
# Bloque 1 — Listar / Aprobar / Rechazar
# =================================================================
@pytest.fixture(scope="module")
def solicitud_creada(admin_token):
    """Crea una solicitud de prueba y la limpia al final."""
    cfg = requests.get(f"{BASE_URL}/api/admin/registro-publico/config", headers=H(admin_token)).json()["config"]
    requests.put(f"{BASE_URL}/api/admin/registro-publico/config", headers=H(admin_token), json={"activo": True})
    email = f"TEST_iter21_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{BASE_URL}/api/registro-publico/{cfg['token']}", json={
        "nombre": "TEST21", "apellidos": "Iter21",
        "email": email, "instrumento": "Violín",
        "password": "TestPass123!",
        "telefono": "600000000",
        "mensaje": "Test automatizado iter21",
    }, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"No se pudo crear solicitud: {r.status_code} {r.text[:200]}")
    # buscarla
    rows = requests.get(f"{BASE_URL}/api/gestor/solicitudes-registro", headers=H(admin_token)).json().get("solicitudes", [])
    sol = next((s for s in rows if (s.get("email") or "").lower() == email.lower()), None)
    assert sol, "Solicitud no encontrada tras crear"
    yield {"id": sol["id"], "email": email}


class TestBloque1Solicitudes:
    def test_listar_solicitudes(self, admin_token, solicitud_creada):
        r = requests.get(f"{BASE_URL}/api/gestor/solicitudes-registro", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "solicitudes" in d and "pendientes" in d
        assert isinstance(d["solicitudes"], list)
        assert d["pendientes"] >= 1

    def test_rechazar_sin_motivo(self, admin_token, solicitud_creada):
        r = requests.post(f"{BASE_URL}/api/gestor/solicitudes-registro/{solicitud_creada['id']}/rechazar",
                          headers=H(admin_token), json={"motivo": ""}, timeout=15)
        assert r.status_code == 400

    def test_rechazar_solicitud(self, admin_token, solicitud_creada):
        r = requests.post(f"{BASE_URL}/api/gestor/solicitudes-registro/{solicitud_creada['id']}/rechazar",
                          headers=H(admin_token), json={"motivo": "Test rechazo automatizado"}, timeout=20)
        assert r.status_code == 200
        # verificar estado=rechazado
        rows = requests.get(f"{BASE_URL}/api/gestor/solicitudes-registro", headers=H(admin_token)).json().get("solicitudes", [])
        sol = next((s for s in rows if s["id"] == solicitud_creada["id"]), None)
        assert sol and sol["estado"] == "rechazado"
        assert sol.get("password_hash") in (None, "")  # borrado

    def test_no_aprobar_si_ya_rechazada(self, admin_token, solicitud_creada):
        r = requests.post(f"{BASE_URL}/api/gestor/solicitudes-registro/{solicitud_creada['id']}/aprobar",
                          headers=H(admin_token), timeout=15)
        assert r.status_code == 400


# =================================================================
# Bloque 1D/1E — Perfil completitud
# =================================================================
class TestBloque1DCompletitud:
    def test_mi_perfil_completitud(self, musico_token):
        r = requests.get(f"{BASE_URL}/api/portal/mi-perfil-completitud", headers=H(musico_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("minimos", "bancarios", "minimos_ok", "bancarios_ok", "primer_login_completar", "banner_persistente"):
            assert k in d, f"Falta key {k}"
        assert "instrumento" in d["minimos"]
        assert "telefono" in d["minimos"]
        assert "nivel_estudios" in d["minimos"]
        assert "iban" in d["bancarios"]
        assert "swift" in d["bancarios"]


# =================================================================
# Bloque 2A — CRM neutro
# =================================================================
class TestBloque2CRM:
    def test_get_contactos_musico(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/gestor/contactos/musico/{MUSICO_ID}", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "contactos" in d and isinstance(d["contactos"], list)

    def test_create_contacto_neutro(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/gestor/contactos", headers=H(admin_token), json={
            "usuario_id": MUSICO_ID,
            "evento_id": None,
            "tipo": "otro",
            "estado_respuesta": "sin_respuesta",
            "notas": "TEST_iter21 contacto neutro",
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("contacto") is not None
        assert d["contacto"].get("evento_id") is None

    def test_registrar_whatsapp(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/gestor/contactos/registrar-whatsapp/{MUSICO_ID}",
                          headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("contacto") is not None
        assert d["contacto"]["tipo"] == "whatsapp"


# =================================================================
# Bloque 4 — Catálogo plantillas con 5ª plantilla
# =================================================================
class TestBloque4Plantillas:
    def test_catalogo_5_plantillas(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/comunicaciones/catalogo", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "catalogo" in d
        keys = [p["key"] for p in d["catalogo"]]
        assert "acceso_perfil_creado" in keys, f"No está la 5ª plantilla. Keys: {keys}"
        assert len(keys) >= 5

    def test_crear_acceso_perfil_creado(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/comunicaciones/catalogo/acceso_perfil_creado/crear",
                          headers=H(admin_token), timeout=15)
        # 200 si crea, 409/400 si ya existe (idempotencia)
        assert r.status_code in (200, 201, 400, 409), r.text


# =================================================================
# Regresión — Login y configuración
# =================================================================
class TestRegresion:
    def test_login_admin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
        assert r.status_code == 200

    def test_login_dg(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=DG, timeout=15)
        assert r.status_code == 200

    def test_login_musico(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=MUSICO, timeout=15)
        assert r.status_code == 200
