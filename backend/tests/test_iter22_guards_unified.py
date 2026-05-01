"""Iter22 — Unified admin guards via is_super_admin + solicitudes_pendientes badge.

Verifica:
- admin@convocatorias.com (rol BD = gestor, email-based super admin) puede acceder a
  endpoints que requerían admin/director_general (configuracion, recordatorios, preview, registro).
- director_general (jalonso@p.csmb.es) también accede.
- músico normal recibe 403.
- GET /api/gestor/pendientes incluye solicitudes_pendientes como entero.
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASSWORD = "Admin123!"
DG_EMAIL = "jalonso@p.csmb.es"
DG_PASSWORD = "Director2026!"
MUSICO_EMAIL = "jesusalonsodirector@gmail.com"
MUSICO_PASSWORD = "Musico123!"


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = (
        data.get("access_token")
        or data.get("token")
        or (data.get("session") or {}).get("access_token")
    )
    assert token, f"no access_token in login response: {list(data.keys())}"
    return token


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def dg_token():
    return _login(DG_EMAIL, DG_PASSWORD)


@pytest.fixture(scope="module")
def musico_token():
    return _login(MUSICO_EMAIL, MUSICO_PASSWORD)


# ---------------- admin@convocatorias.com as super admin (email-based) ----------------

class TestAdminEmailBasedSuperAdmin:
    def test_auth_me_admin(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        profile = body.get("profile") or body
        # rol en BD puede ser gestor pero email lo convierte en super admin
        assert (profile.get("email") or body.get("email") or "").lower() == ADMIN_EMAIL

    def test_get_configuracion_admin(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/configuracion",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "configuracion" in data
        assert data.get("editable") is True, "admin@convocatorias.com debe ver editable=True"

    def test_put_configuracion_admin_is_allowed(self, admin_token):
        # Primero obtenemos para luego restaurar.
        g = requests.get(
            f"{BASE_URL}/api/admin/configuracion",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert g.status_code == 200
        cfg = g.json().get("configuracion", {})
        # enviamos un PUT idempotente con los mismos datos críticos
        payload = {
            "dias_alerta_bancarios": cfg.get("dias_alerta_bancarios", 7),
        }
        r = requests.put(
            f"{BASE_URL}/api/admin/configuracion",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
            timeout=15,
        )
        # No debe devolver 403 (guard permisos correcto)
        assert r.status_code != 403, f"admin@ no debe tener 403 (is_super_admin): {r.text[:300]}"
        assert r.status_code in (200, 400, 422)

    def test_put_registro_publico_config_admin(self, admin_token):
        # GET primero para obtener estado actual
        g = requests.get(
            f"{BASE_URL}/api/admin/registro-publico/config",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert g.status_code == 200, g.text[:300]
        cfg = g.json() or {}
        payload = {"habilitado": cfg.get("habilitado", False)}
        r = requests.put(
            f"{BASE_URL}/api/admin/registro-publico/config",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
            timeout=15,
        )
        assert r.status_code != 403, f"admin@ no debe recibir 403: {r.text[:300]}"
        assert r.status_code in (200, 201, 422)

    def test_generar_token_preview_admin(self, admin_token):
        # Necesitamos un musico_id válido; usamos el músico de prueba
        r = requests.post(
            f"{BASE_URL}/api/gestor/preview/generar-token",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"musico_id": "8bf521fa-dc27-4c5b-8069-d36d3d4eaad3"},
            timeout=15,
        )
        assert r.status_code != 403, f"admin@ 403 en preview/generar-token: {r.text[:300]}"
        assert r.status_code in (200, 201, 400, 404, 422)

    def test_recordatorios_send_monthly_summary_admin(self, admin_token):
        # Endpoint destructivo: solo verificamos que el guard NO rechaza.
        # Usamos dry_run si lo soporta.
        r = requests.post(
            f"{BASE_URL}/api/admin/recordatorios/send-monthly-summary-musicians",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"dry_run": True},
            timeout=30,
        )
        # No debe ser 403 (guard OK); puede ser 200/400/500 según implementación
        assert r.status_code != 403, f"admin@ 403 en send-monthly-summary: {r.text[:300]}"


# ---------------- director_general access ----------------

class TestDirectorGeneralAccess:
    def test_configuracion_dg(self, dg_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/configuracion",
            headers={"Authorization": f"Bearer {dg_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("editable") is True

    def test_registro_publico_config_dg(self, dg_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/registro-publico/config",
            headers={"Authorization": f"Bearer {dg_token}"},
            timeout=15,
        )
        assert r.status_code == 200


# ---------------- músico denegado ----------------

class TestMusicoDenied:
    def test_musico_blocked_put_configuracion(self, musico_token):
        # El GET es abierto a cualquier autenticado (devuelve editable=False). El PUT debe estar bloqueado.
        r = requests.put(
            f"{BASE_URL}/api/admin/configuracion",
            headers={"Authorization": f"Bearer {musico_token}"},
            json={"dias_alerta_bancarios": 7},
            timeout=15,
        )
        assert r.status_code in (401, 403), f"músico debe recibir 403/401 en PUT config: {r.status_code}"

    def test_musico_blocked_registro_config(self, musico_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/registro-publico/config",
            headers={"Authorization": f"Bearer {musico_token}"},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_musico_blocked_preview(self, musico_token):
        r = requests.post(
            f"{BASE_URL}/api/gestor/preview/generar-token",
            headers={"Authorization": f"Bearer {musico_token}"},
            json={"musico_id": "8bf521fa-dc27-4c5b-8069-d36d3d4eaad3"},
            timeout=15,
        )
        assert r.status_code in (401, 403)


# ---------------- pendientes con solicitudes_pendientes ----------------

class TestPendientesBadge:
    def test_gestor_pendientes_has_solicitudes(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/gestor/pendientes",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "solicitudes_pendientes" in data, f"falta key: {list(data.keys())}"
        assert isinstance(data["solicitudes_pendientes"], int)
        assert data["solicitudes_pendientes"] >= 0
        # Otros campos legacy siguen presentes
        for k in ("reclamaciones_pendientes", "respuestas_nuevas", "comentarios_pendientes"):
            assert k in data, f"falta legacy key {k}"


# ---------------- regresión: login y smoke de rutas clave ----------------

class TestSmokeRegression:
    def test_login_admin(self):
        assert _login(ADMIN_EMAIL, ADMIN_PASSWORD)

    def test_login_dg(self):
        assert _login(DG_EMAIL, DG_PASSWORD)

    def test_login_musico(self):
        assert _login(MUSICO_EMAIL, MUSICO_PASSWORD)

    def test_portal_mi_perfil_completitud(self, musico_token):
        r = requests.get(
            f"{BASE_URL}/api/portal/mi-perfil-completitud",
            headers={"Authorization": f"Bearer {musico_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert "minimos" in body or "minimos_ok" in body

    def test_gestor_musicos_list(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/gestor/musicos",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        # Debe ser lista o dict con key musicos
        assert isinstance(data, (list, dict))

    def test_comunicaciones_catalogo(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/comunicaciones/catalogo",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        # Iter21 introdujo 5 plantillas en catálogo
        items = data if isinstance(data, list) else (data.get("catalogo") or data.get("plantillas") or data.get("items") or [])
        assert len(items) >= 4, f"catálogo plantillas insuficiente: {items}"
