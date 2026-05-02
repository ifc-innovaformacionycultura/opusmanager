"""Iter23 — Centro de Comunicaciones / Bandeja de Entrada (IMAP + SMTP)
Valida endpoints de /api/gestor/bandeja/* y /api/admin/bandeja/*
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://contact-conductor.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASSWORD = "Admin123!"
GESTOR_NO_ADMIN_EMAIL = "palvarez@netmetrix.es"
GESTOR_NO_ADMIN_PASSWORD = "Opus2026!"


def _login(email: str, password: str):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} -> {r.status_code}: {r.text}"
    body = r.json()
    return body.get("access_token") or body.get("token")


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="session")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def gestor_no_admin_h():
    try:
        tok = _login(GESTOR_NO_ADMIN_EMAIL, GESTOR_NO_ADMIN_PASSWORD)
    except AssertionError:
        pytest.skip("gestor no-admin login failed; cannot test 403 guard")
    return {"Authorization": f"Bearer {tok}"}


# ---------- Listado bandeja ----------
class TestBandejaListado:
    def test_inbox_vacia_o_lista(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/gestor/bandeja/emails", params={"carpeta": "INBOX"}, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "emails" in data and isinstance(data["emails"], list)
        assert "contadores" in data
        for k in ("no_leidos", "inbox", "destacados", "enviados"):
            assert k in data["contadores"]


# ---------- Config IMAP ----------
class TestConfigBandeja:
    def test_get_config_campos(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/admin/bandeja/config", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()
        for k in ("gmail_imap_host", "gmail_imap_port", "gmail_imap_user",
                  "gmail_imap_app_password_masked", "gmail_imap_app_password_configurada",
                  "gmail_sync_enabled", "gmail_sync_folder"):
            assert k in c, f"falta {k}"

    def test_put_config_persiste(self, admin_h):
        body = {
            "gmail_imap_host": "imap.gmail.com",
            "gmail_imap_port": 993,
            "gmail_imap_user": "innovaformacionyculturapruebas@gmail.com",
            "gmail_imap_app_password": "fakepass1234",
            "gmail_sync_enabled": False,
            "gmail_sync_folder": "INBOX",
        }
        r = requests.put(f"{BASE_URL}/api/admin/bandeja/config", json=body, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # GET -> debe reflejar
        g = requests.get(f"{BASE_URL}/api/admin/bandeja/config", headers=admin_h, timeout=30).json()
        assert g["gmail_imap_user"] == "innovaformacionyculturapruebas@gmail.com"
        assert g["gmail_imap_app_password_configurada"] is True
        assert g["gmail_imap_app_password_masked"]  # no vacío
        assert g["gmail_sync_enabled"] is False
        assert g["gmail_sync_folder"] == "INBOX"

    def test_put_password_vacia_no_sobrescribe(self, admin_h):
        # Asegurar que hay password ya
        requests.put(f"{BASE_URL}/api/admin/bandeja/config",
                     json={"gmail_imap_app_password": "existingpass1234", "gmail_imap_user": "innovaformacionyculturapruebas@gmail.com"},
                     headers=admin_h, timeout=30)
        before = requests.get(f"{BASE_URL}/api/admin/bandeja/config", headers=admin_h, timeout=30).json()
        assert before["gmail_imap_app_password_configurada"] is True
        masked_before = before["gmail_imap_app_password_masked"]

        # Ahora PUT con password vacío
        r = requests.put(f"{BASE_URL}/api/admin/bandeja/config",
                         json={"gmail_imap_app_password": "", "gmail_imap_host": "imap.gmail.com"},
                         headers=admin_h, timeout=30)
        assert r.status_code == 200
        after = requests.get(f"{BASE_URL}/api/admin/bandeja/config", headers=admin_h, timeout=30).json()
        assert after["gmail_imap_app_password_configurada"] is True
        assert after["gmail_imap_app_password_masked"] == masked_before

    def test_test_conexion_credenciales_falsas(self, admin_h):
        # Con password fake, debe devolver {ok:false, error:...} SIN 500
        requests.put(f"{BASE_URL}/api/admin/bandeja/config",
                     json={"gmail_imap_app_password": "fakepass1234",
                           "gmail_imap_user": "innovaformacionyculturapruebas@gmail.com"},
                     headers=admin_h, timeout=30)
        r = requests.post(f"{BASE_URL}/api/admin/bandeja/test-conexion", headers=admin_h, timeout=45)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is False
        assert "error" in d and d["error"]


# ---------- Sincronizar ----------
class TestSincronizar:
    def test_sync_deshabilitado(self, admin_h):
        # Asegurar enabled=false
        requests.put(f"{BASE_URL}/api/admin/bandeja/config",
                     json={"gmail_sync_enabled": False}, headers=admin_h, timeout=30)
        r = requests.post(f"{BASE_URL}/api/gestor/bandeja/sincronizar", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is False
        assert "deshabilitada" in (d.get("error") or "").lower() or "deshabilit" in (d.get("error") or "").lower()


# ---------- Permisos ----------
class TestPermisosAdmin:
    def test_put_config_requiere_admin(self, gestor_no_admin_h):
        r = requests.put(f"{BASE_URL}/api/admin/bandeja/config",
                         json={"gmail_imap_host": "imap.gmail.com"},
                         headers=gestor_no_admin_h, timeout=30)
        assert r.status_code == 403, f"esperado 403, got {r.status_code}: {r.text}"


# ---------- Responder (saliente) + leido/destacar + archivar ----------
class TestRespondarYFlujo:
    @pytest.fixture(scope="class")
    def sent_email_id(self, admin_h):
        payload = {
            "destinatario": "innovaformacionyculturapruebas@gmail.com",
            "asunto": "TEST iter23 saliente",
            "cuerpo_html": "<p>hola test</p>",
        }
        r = requests.post(f"{BASE_URL}/api/gestor/bandeja/responder", json=payload, headers=admin_h, timeout=60)
        assert r.status_code == 200, r.text
        # Resend puede fallar por key dummy → ok puede ser False. No exigimos ok=True.
        # Listar SENT y localizar por asunto
        r2 = requests.get(f"{BASE_URL}/api/gestor/bandeja/emails", params={"carpeta": "SENT"}, headers=admin_h, timeout=30)
        assert r2.status_code == 200
        rows = r2.json().get("emails", [])
        matches = [e for e in rows if e.get("asunto") == "TEST iter23 saliente"]
        assert matches, f"no se encontró email saliente en SENT. emails={[e.get('asunto') for e in rows[:5]]}"
        return matches[0]["id"]

    def test_sent_aparece_en_sent(self, sent_email_id):
        assert sent_email_id

    def test_marcar_leido(self, admin_h, sent_email_id):
        r = requests.put(f"{BASE_URL}/api/gestor/bandeja/emails/{sent_email_id}/leido",
                         json={"leido": False}, headers=admin_h, timeout=30)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        r2 = requests.put(f"{BASE_URL}/api/gestor/bandeja/emails/{sent_email_id}/leido",
                          json={"leido": True}, headers=admin_h, timeout=30)
        assert r2.status_code == 200

    def test_marcar_destacado(self, admin_h, sent_email_id):
        r = requests.put(f"{BASE_URL}/api/gestor/bandeja/emails/{sent_email_id}/destacar",
                         json={"destacado": True}, headers=admin_h, timeout=30)
        assert r.status_code == 200
        # Debe aparecer en DESTACADOS
        r2 = requests.get(f"{BASE_URL}/api/gestor/bandeja/emails", params={"carpeta": "DESTACADOS"}, headers=admin_h, timeout=30)
        ids = [e["id"] for e in r2.json().get("emails", [])]
        assert sent_email_id in ids, "email destacado no aparece en DESTACADOS"

    def test_archivar(self, admin_h, sent_email_id):
        r = requests.delete(f"{BASE_URL}/api/gestor/bandeja/emails/{sent_email_id}", headers=admin_h, timeout=30)
        assert r.status_code == 200
        # No en SENT
        sent = requests.get(f"{BASE_URL}/api/gestor/bandeja/emails", params={"carpeta": "SENT"}, headers=admin_h, timeout=30).json().get("emails", [])
        assert sent_email_id not in [e["id"] for e in sent]
        # Sí en ARCHIVED
        arch = requests.get(f"{BASE_URL}/api/gestor/bandeja/emails", params={"carpeta": "ARCHIVED"}, headers=admin_h, timeout=30).json().get("emails", [])
        assert sent_email_id in [e["id"] for e in arch]
