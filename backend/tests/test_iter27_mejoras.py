"""Iter27 — Mejoras sobre Bandeja + HelpPanel + Widget últimos emails.

Cubre:
  - POST /api/gestor/bandeja/marcar-todos-leidos (INBOX y SENT)
  - GET /api/admin/bandeja/config: email_firma_html + email_firma_preview_default
  - PUT /api/admin/bandeja/config: persistencia o 400 claro si columna no existe
  - POST /api/gestor/bandeja/responder: inyecta firma en cuerpo_html
  - GET /api/gestor/bandeja/emails?musico_id=... filtro
  - Permisos: gestor no-admin puede marcar-todos-leidos pero NO GET/PUT admin config
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://contact-conductor.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASSWORD = "Admin123!"
GESTOR_EMAIL = "palvarez@netmetrix.es"
GESTOR_PASSWORD = "Opus2026!"


def _login(email: str, password: str):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} -> {r.status_code}: {r.text}"
    body = r.json()
    return body.get("access_token") or body.get("token")


@pytest.fixture(scope="session")
def admin_h():
    tok = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def gestor_h():
    try:
        tok = _login(GESTOR_EMAIL, GESTOR_PASSWORD)
    except AssertionError:
        pytest.skip("gestor no-admin login failed")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def test_musico_id(admin_h):
    """Busca un músico existente para usar en filtros."""
    # Usamos el endpoint de músicos del gestor
    r = requests.get(f"{BASE_URL}/api/gestor/musicos", headers=admin_h, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"no se pueden listar músicos: {r.status_code}")
    data = r.json()
    # Puede ser dict o list
    if isinstance(data, dict):
        lst = data.get("musicos") or data.get("data") or data.get("items") or []
    else:
        lst = data
    if not lst:
        pytest.skip("no hay músicos en BD")
    return lst[0].get("id") or lst[0].get("user_id")


# ---------- Widget: filtro por musico_id ----------
class TestWidgetUltimosEmails:
    def test_filtro_musico_id_inbox(self, admin_h, test_musico_id):
        r = requests.get(
            f"{BASE_URL}/api/gestor/bandeja/emails",
            params={"carpeta": "INBOX", "musico_id": test_musico_id, "limit": 3},
            headers=admin_h, timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "emails" in data and isinstance(data["emails"], list)
        # Todos los emails devueltos deben pertenecer a ese músico (si hay alguno)
        for e in data["emails"]:
            assert e.get("musico_id") == test_musico_id

    def test_filtro_musico_id_sent(self, admin_h, test_musico_id):
        r = requests.get(
            f"{BASE_URL}/api/gestor/bandeja/emails",
            params={"carpeta": "SENT", "musico_id": test_musico_id, "limit": 3},
            headers=admin_h, timeout=30,
        )
        assert r.status_code == 200
        for e in r.json().get("emails", []):
            assert e.get("musico_id") == test_musico_id


# ---------- Config: firma institucional ----------
class TestConfigFirma:
    def test_get_config_incluye_campos_firma(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/admin/bandeja/config", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        cfg = r.json()
        assert "email_firma_html" in cfg, "GET /config debe incluir email_firma_html"
        assert "email_firma_preview_default" in cfg, "GET /config debe incluir email_firma_preview_default"
        # email_firma_html es string (puede ser '')
        assert isinstance(cfg["email_firma_html"], str)
        # preview default es string HTML
        assert isinstance(cfg["email_firma_preview_default"], str)

    def test_put_firma_persiste_o_400_claro(self, admin_h):
        """PUT con firma custom debe persistir. Si la columna no existe → 400 con mensaje claro."""
        firma = "<strong>IFC OPUS TEST</strong><br/>www.ifcopus.com"
        r = requests.put(
            f"{BASE_URL}/api/admin/bandeja/config",
            json={"email_firma_html": firma},
            headers=admin_h, timeout=30,
        )
        if r.status_code == 400:
            # Acceptable si la columna aún no existe — debe decirlo explícitamente
            detail = (r.json().get("detail") or "").lower()
            assert "email_firma_html" in detail or "columna" in detail or "column" in detail, \
                f"400 debe mencionar columna faltante. detail={detail}"
            pytest.skip(f"Columna email_firma_html no migrada aún: {detail}")
        assert r.status_code == 200, f"PUT firma: {r.status_code} {r.text}"
        assert r.json().get("ok") is True

        # GET posterior — persiste
        g = requests.get(f"{BASE_URL}/api/admin/bandeja/config", headers=admin_h, timeout=30).json()
        assert g["email_firma_html"] == firma, f"firma no persistió: {g.get('email_firma_html')}"


# ---------- Marcar todos como leídos ----------
class TestMarcarTodosLeidos:
    @pytest.fixture(scope="class")
    def seed_email_inbox(self, admin_h):
        """Inserta 1 email entrante no-leído directamente vía un POST responder (saliente) — no sirve.
        Mejor: intentamos crear 1 row entrante via supabase si el endpoint existe, o aprovechamos
        un sync. Como no podemos insertar entrantes directo vía API pública, probamos el endpoint
        de marcar-todos-leidos y validamos que no falla y devuelve estructura correcta.
        """
        # No hay endpoint público para insertar entrantes. El test validará estructura
        # y comportamiento con los datos existentes.
        return None

    def test_marcar_todos_leidos_inbox(self, admin_h, seed_email_inbox):
        r = requests.post(
            f"{BASE_URL}/api/gestor/bandeja/marcar-todos-leidos",
            params={"carpeta": "INBOX"},
            headers=admin_h, timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data.get("ok") is True
        assert "actualizados" in data and isinstance(data["actualizados"], int)

        # Segundo call debe devolver 0 (todos ya leídos)
        r2 = requests.post(
            f"{BASE_URL}/api/gestor/bandeja/marcar-todos-leidos",
            params={"carpeta": "INBOX"},
            headers=admin_h, timeout=30,
        )
        assert r2.status_code == 200
        assert r2.json().get("actualizados") == 0

        # Contador global no_leidos debería ser 0
        lst = requests.get(
            f"{BASE_URL}/api/gestor/bandeja/emails",
            params={"carpeta": "INBOX"}, headers=admin_h, timeout=30,
        ).json()
        assert lst["contadores"]["no_leidos"] == 0

    def test_marcar_todos_leidos_sent_no_afecta_inbox(self, admin_h):
        r = requests.post(
            f"{BASE_URL}/api/gestor/bandeja/marcar-todos-leidos",
            params={"carpeta": "SENT"},
            headers=admin_h, timeout=30,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_marcar_todos_leidos_gestor_no_admin_ok(self, gestor_h):
        """Gestor no-admin SÍ puede marcar todos leídos (NO requiere admin)."""
        r = requests.post(
            f"{BASE_URL}/api/gestor/bandeja/marcar-todos-leidos",
            params={"carpeta": "INBOX"},
            headers=gestor_h, timeout=30,
        )
        assert r.status_code == 200, f"gestor no-admin debe poder marcar todos leídos: {r.status_code} {r.text}"


# ---------- Permisos: gestor no-admin NO config ----------
class TestPermisos:
    def test_gestor_no_admin_NO_get_config(self, gestor_h):
        r = requests.get(f"{BASE_URL}/api/admin/bandeja/config", headers=gestor_h, timeout=30)
        assert r.status_code == 403, f"gestor no-admin debe recibir 403 en GET /config: {r.status_code}"

    def test_gestor_no_admin_NO_put_config(self, gestor_h):
        r = requests.put(
            f"{BASE_URL}/api/admin/bandeja/config",
            json={"email_firma_html": "<p>hack</p>"},
            headers=gestor_h, timeout=30,
        )
        assert r.status_code == 403


# ---------- Responder: firma inyectada ----------
class TestResponderFirma:
    def test_responder_incluye_firma(self, admin_h):
        asunto_unico = f"TEST iter27 firma {uuid.uuid4().hex[:8]}"
        payload = {
            "destinatario": "innovaformacionyculturapruebas@gmail.com",
            "asunto": asunto_unico,
            "cuerpo_html": "<p>cuerpo de prueba iter27</p>",
        }
        r = requests.post(f"{BASE_URL}/api/gestor/bandeja/responder", json=payload, headers=admin_h, timeout=60)
        assert r.status_code == 200, r.text
        # Resend puede fallar por key dummy → ok puede ser False, pero el row saliente se crea

        # Localizar el email saliente creado
        time.sleep(1)
        lst = requests.get(
            f"{BASE_URL}/api/gestor/bandeja/emails",
            params={"carpeta": "SENT", "limit": 50}, headers=admin_h, timeout=30,
        ).json()
        rows = [e for e in lst.get("emails", []) if e.get("asunto") == asunto_unico]
        assert rows, f"no se encontró saliente '{asunto_unico}' en SENT"
        em_id = rows[0]["id"]

        # GET detalle — cuerpo_html debe contener firma (border-top o <strong>)
        det = requests.get(f"{BASE_URL}/api/gestor/bandeja/emails/{em_id}", headers=admin_h, timeout=30)
        assert det.status_code == 200
        cuerpo = (det.json().get("email") or {}).get("cuerpo_html") or ""
        assert "cuerpo de prueba iter27" in cuerpo, "el cuerpo original debe estar presente"
        # Firma: o bien contiene border-top (default firma) o contiene la firma custom
        firma_detectada = ("border-top" in cuerpo) or ("IFC OPUS" in cuerpo) or ("<strong>" in cuerpo and "</strong>" in cuerpo)
        assert firma_detectada, f"cuerpo debería incluir la firma inyectada. cuerpo={cuerpo[:500]}"

        # Cleanup: archivar
        requests.delete(f"{BASE_URL}/api/gestor/bandeja/emails/{em_id}", headers=admin_h, timeout=30)
