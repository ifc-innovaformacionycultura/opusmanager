"""
OPUS MANAGER - Backend Test Suite
Tests for:
  - Auth (gestor/musico) login
  - Gestor: crear musico, filtros, instrumentos, export xlsx
  - Portal (musico): mis-eventos (companeros_confirmados), calendario
  - Cambio password primera vez
"""
import os
import io
import time
import pytest
import requests
from zipfile import ZipFile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Credentials
GESTOR_EMAIL = "admin@convocatorias.com"
GESTOR_PASSWORD = "Admin123!"
MUSICO_EMAIL = "jesusalonsodirector@gmail.com"
MUSICO_PASSWORD = "Musico123!"

# Supabase admin (for direct DB manipulation)
from supabase import create_client
SUPA_URL = os.environ.get('SUPABASE_URL', 'https://fklllpaobtgvjjxgngyi.supabase.co')
SUPA_KEY = os.environ.get(
    'SUPABASE_KEY',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrbGxscGFvYnRndmpqeGduZ3lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU5NTc2NCwiZXhwIjoyMDkyMTcxNzY0fQ.1crAbfyjHfslXhAnAZ7grGUcxlt5KlKZtbEmStx29Nc'
)
admin_supa = create_client(SUPA_URL, SUPA_KEY)


# ============ Fixtures ============

# NOTE: Tokens fetched FRESH per-test to avoid shared-session issues
# caused by backend re-using single supabase client across logins (RLS leak).
@pytest.fixture
def gestor_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": GESTOR_EMAIL, "password": GESTOR_PASSWORD
    })
    assert r.status_code == 200, f"Gestor login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def musico_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": MUSICO_EMAIL, "password": MUSICO_PASSWORD
    })
    if r.status_code != 200:
        pytest.skip(f"Musico login failed: {r.status_code} {r.text}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def gestor_token(gestor_headers):
    return gestor_headers["Authorization"].split(" ", 1)[1]


@pytest.fixture
def musico_token(musico_headers):
    return musico_headers["Authorization"].split(" ", 1)[1]


# ============ Auth basic ============

class TestHealthAndAuth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"

    def test_gestor_login(self, gestor_token):
        assert gestor_token
        assert isinstance(gestor_token, str)

    def test_musico_login(self, musico_token):
        assert musico_token

    def test_login_bad_credentials(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com", "password": "bad"
        })
        assert r.status_code in (400, 401)


# ============ Gestor: Musicos filtros + instrumentos ============

class TestGestorMusicos:
    def test_list_musicos(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/musicos", headers=gestor_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "musicos" in data
        assert isinstance(data["musicos"], list)

    def test_list_musicos_with_q(self, gestor_headers):
        # Get all first
        all_r = requests.get(f"{BASE_URL}/api/gestor/musicos", headers=gestor_headers)
        all_count = len(all_r.json()["musicos"])
        # Filter with very specific query unlikely to match all
        r = requests.get(f"{BASE_URL}/api/gestor/musicos?q=zzzzzzzxxx", headers=gestor_headers)
        assert r.status_code == 200
        filt_count = len(r.json()["musicos"])
        assert filt_count <= all_count
        assert filt_count == 0

    def test_list_musicos_estado_activo(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/musicos?estado=activo", headers=gestor_headers)
        assert r.status_code == 200
        for m in r.json()["musicos"]:
            assert m.get("estado") == "activo"

    def test_instrumentos_endpoint(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/instrumentos", headers=gestor_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "instrumentos" in data
        assert isinstance(data["instrumentos"], list)
        # Sorted and unique
        lst = data["instrumentos"]
        assert lst == sorted(lst)
        assert len(lst) == len(set(lst))


# ============ Gestor: Crear musico (Fase 4) ============

class TestCrearMusico:
    def test_crear_musico_resend_unconfigured(self, gestor_headers):
        """Create musico: with RESEND_API_KEY empty -> email_enviado=False but musico created OK."""
        test_email = f"TEST_musico_{int(time.time())}_{os.urandom(3).hex()}@example.com"
        payload = {
            "email": test_email,
            "nombre": "Test",
            "apellidos": "Musico",
            "instrumento": "Violin",
            "telefono": "+34600000000"
        }
        r = requests.post(
            f"{BASE_URL}/api/gestor/musicos/crear",
            headers=gestor_headers, json=payload
        )
        assert r.status_code == 200, f"Crear musico failed: {r.status_code} {r.text}"
        data = r.json()

        # Assertions
        assert "password_temporal" in data and len(data["password_temporal"]) >= 8
        assert data.get("email_enviado") is False, f"Expected email_enviado False, got {data}"
        assert "musico" in data and data["musico"] is not None
        musico = data["musico"]
        assert musico["email"] == test_email
        assert musico["rol"] == "musico"
        assert musico["requiere_cambio_password"] is True

        user_id = musico.get("user_id")
        usuario_row_id = musico.get("id")
        assert user_id, "user_id missing in musico profile"

        # Cleanup: delete auth user and profile row
        try:
            admin_supa.auth.admin.delete_user(user_id)
        except Exception as e:
            print(f"Cleanup auth delete failed: {e}")
        try:
            admin_supa.table('usuarios').delete().eq('id', usuario_row_id).execute()
        except Exception as e:
            print(f"Cleanup profile delete failed: {e}")

    def test_crear_musico_duplicate(self, gestor_headers):
        """Creating musico with existing email should return 409."""
        payload = {
            "email": GESTOR_EMAIL,  # already exists
            "nombre": "Dup",
            "apellidos": "Test"
        }
        r = requests.post(f"{BASE_URL}/api/gestor/musicos/crear",
                          headers=gestor_headers, json=payload)
        assert r.status_code in (400, 409), f"Expected 4xx for duplicate, got {r.status_code}: {r.text}"


# ============ Gestor: Export XLSX ============

class TestExportXlsx:
    def test_export_xlsx_download(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/export/xlsx", headers=gestor_headers)
        assert r.status_code == 200, r.text
        # Content-Type
        ct = r.headers.get("content-type", "")
        assert "spreadsheetml" in ct or "xlsx" in ct, f"Unexpected CT: {ct}"
        # Content-Disposition header
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".xlsx" in cd, f"Bad CD: {cd}"
        # Valid xlsx = valid zip containing sheet files
        content = r.content
        assert len(content) > 100
        zf = ZipFile(io.BytesIO(content))
        names = zf.namelist()
        # Need xl/workbook.xml and 3 sheet files
        assert "xl/workbook.xml" in names
        wb_xml = zf.read("xl/workbook.xml").decode("utf-8", errors="ignore")
        for expected in ("Usuarios", "Eventos", "Asignaciones"):
            assert expected in wb_xml, f"Sheet '{expected}' missing in workbook.xml"


# ============ Portal: mis-eventos companeros ============

class TestPortalMisEventos:
    def test_mis_eventos(self, musico_headers):
        r = requests.get(f"{BASE_URL}/api/portal/mis-eventos", headers=musico_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "asignaciones" in data
        for asig in data["asignaciones"]:
            # Must include companeros fields
            assert "companeros_confirmados" in asig, f"Missing field: {asig}"
            assert "companeros_total" in asig
            assert isinstance(asig["companeros_confirmados"], int)
            assert isinstance(asig["companeros_total"], int)
            assert asig["companeros_confirmados"] <= asig["companeros_total"]


# ============ Portal: calendario ============

class TestPortalCalendario:
    def test_calendario_structure(self, musico_headers):
        r = requests.get(f"{BASE_URL}/api/portal/calendario", headers=musico_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "eventos" in data
        assert isinstance(data["eventos"], list)
        valid_colors = {"blue", "green", "orange"}
        valid_tipos = {"ensayo", "concierto", "fecha_limite"}
        required_fields = {"id", "tipo", "titulo", "fecha", "color", "evento_id", "evento_nombre"}
        for ev in data["eventos"]:
            missing = required_fields - set(ev.keys())
            assert not missing, f"Missing fields {missing} in {ev}"
            assert ev["color"] in valid_colors
            assert ev["tipo"] in valid_tipos
            # hora field key must exist (value may be None for fecha_limite)
            assert "hora" in ev


# ============ Fase 5: cambiar password primera vez endpoint ============

class TestCambiarPasswordPrimeraVez:
    def test_endpoint_updates_flag(self, musico_headers):
        """Setea requiere_cambio_password=True en DB, llama al endpoint, verifica a False."""
        # Set flag True
        admin_supa.table('usuarios').update(
            {"requiere_cambio_password": True}
        ).eq('email', MUSICO_EMAIL).execute()

        # Call endpoint with musico token
        r = requests.post(
            f"{BASE_URL}/api/portal/cambiar-password-primera-vez",
            headers=musico_headers
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data.get("requiere_cambio_password") is False

        # Verify DB
        row = admin_supa.table('usuarios').select('requiere_cambio_password').eq(
            'email', MUSICO_EMAIL
        ).execute()
        assert row.data
        assert row.data[0]["requiere_cambio_password"] is False

        # RESET: keep flag False (original state) - password unchanged by this endpoint


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
