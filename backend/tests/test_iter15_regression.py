"""Iter 15 — Regression E2E tests for:
- CRM contactos
- Sistema de invitación de músicos
- Web Push (VAPID + suscribir + test)
- Notif preferencias (gestor + músico)
- Recordatorios admin (status/run-now/run-last-call/historial/suscriptores/errores)
- Dashboard KPIs (recordatorios_enviados_hoy + errores_recientes)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://contact-conductor.preview.emergentagent.com"

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASSWORD = "Admin123!"
DG_EMAIL = "jalonso@p.csmb.es"
DG_PASSWORD = "Director2026!"
GESTOR_REGULAR_EMAIL = "palvarez@netmetrix.es"
GESTOR_REGULAR_PASSWORD = "Opus2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def dg_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": DG_EMAIL, "password": DG_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"DG login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def gestor_regular_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": GESTOR_REGULAR_EMAIL, "password": GESTOR_REGULAR_PASSWORD}, timeout=30)
    if r.status_code != 200:
        return None
    return r.json().get("access_token") or r.json().get("token")


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============ CRM CONTACTOS ============

class TestCRMContactos:
    def test_resumen(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/gestor/contactos/resumen", headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "resumen" in data
        assert isinstance(data["resumen"], list)

    def test_seguimiento_includes_crm_and_estado_invitacion(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/gestor/seguimiento", headers=H(admin_token), timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        musicos = data.get("musicos") or []
        assert isinstance(musicos, list) and musicos, "No hay músicos en /seguimiento"
        found_crm_field = False
        found_estado_invitacion = False
        for m in musicos:
            if "estado_invitacion" in m:
                found_estado_invitacion = True
            for a in (m.get("asignaciones") or []):
                if "crm" in a:
                    found_crm_field = True
                    break
            if found_crm_field and found_estado_invitacion:
                break
        assert found_crm_field, "Campo 'crm' no encontrado en /seguimiento musicos[].asignaciones[]"
        assert found_estado_invitacion, "Campo 'estado_invitacion' no encontrado en /seguimiento musicos[]"

    def test_create_and_list_contacto(self, admin_token):
        # Get a usuario_id and evento_id from /seguimiento
        r = requests.get(f"{BASE_URL}/api/gestor/seguimiento", headers=H(admin_token), timeout=60)
        assert r.status_code == 200
        data = r.json()
        musicos = data.get("musicos") or []
        usuario_id = None
        evento_id = None
        for m in musicos:
            for a in (m.get("asignaciones") or []):
                if a.get("evento_id"):
                    usuario_id = m.get("id")
                    evento_id = a.get("evento_id")
                    break
            if usuario_id:
                break
        if not (usuario_id and evento_id):
            pytest.skip("No hay usuario/evento para test CRM")

        # POST contacto
        payload = {
            "usuario_id": usuario_id,
            "evento_id": evento_id,
            "tipo": "llamada",
            "estado_respuesta": "sin_respuesta",
            "notas": "TEST_iter15 regression",
        }
        r = requests.post(f"{BASE_URL}/api/gestor/contactos", headers=H(admin_token), json=payload, timeout=30)
        assert r.status_code == 200, r.text
        c = r.json().get("contacto")
        assert c and c.get("usuario_id") == usuario_id
        assert c.get("tipo") == "llamada"

        # GET historial
        r = requests.get(f"{BASE_URL}/api/gestor/contactos/{usuario_id}/{evento_id}",
                         headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        assert any(co.get("notas") == "TEST_iter15 regression" for co in r.json().get("contactos", []))

    def test_create_invalid_tipo(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/gestor/contactos", headers=H(admin_token), json={
            "usuario_id": "00000000-0000-0000-0000-000000000000",
            "evento_id": "00000000-0000-0000-0000-000000000000",
            "tipo": "invalid_tipo",
        }, timeout=30)
        assert r.status_code == 400


# ============ INVITACIONES ============

class TestInvitaciones:
    def test_activar_token_invalido_404(self):
        r = requests.get(f"{BASE_URL}/api/portal/activar/no-existe-token-xyz", timeout=30)
        assert r.status_code == 404

    def test_invitar_y_activar_get(self, admin_token):
        # Encontrar un músico con rol musico
        r = requests.get(f"{BASE_URL}/api/admin/musicos", headers=H(admin_token), timeout=30)
        if r.status_code != 200:
            r = requests.get(f"{BASE_URL}/api/gestor/musicos", headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        musicos = r.json() if isinstance(r.json(), list) else r.json().get("musicos", [])
        # Pick last músico (avoid changing first/admin) — and never use jesusalonsodirector
        target = None
        for m in reversed(musicos):
            email = m.get("email", "")
            if email and email != "jesusalonsodirector@gmail.com" and m.get("rol") == "musico":
                target = m
                break
        if not target:
            pytest.skip("No hay músico para invitar")

        mid = target["id"]
        r = requests.post(f"{BASE_URL}/api/gestor/musicos/{mid}/invitar",
                          headers=H(admin_token), json={"enviar_email": False}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        token = body.get("token")
        url_act = body.get("url_activacion", "")
        assert token and len(token) >= 10
        assert "/activar/" in url_act, f"URL inválida: {url_act}"

        # GET /api/portal/activar/{token} con token válido (sin login)
        r = requests.get(f"{BASE_URL}/api/portal/activar/{token}", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("email") == target.get("email")
        # NO hacemos POST de activación: cambia password real.


# ============ PUSH ============

class TestPush:
    def test_vapid_public_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/push/vapid-public", timeout=30)
        assert r.status_code == 200, r.text
        assert "public_key" in r.json()
        assert len(r.json()["public_key"]) > 20

    def test_suscribir(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/push/suscribir", headers=H(admin_token), json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/TEST_iter15_endpoint_xyz",
            "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
            "auth": "tBHItJI5svbpez7KI4CCXg",
            "user_agent": "TEST_iter15"
        }, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_push_test_endpoint(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/push/test", headers=H(admin_token), json={
            "titulo": "TEST", "body": "TEST iter15", "url": "/"
        }, timeout=30)
        assert r.status_code == 200, r.text
        assert "enviadas" in r.json()


# ============ NOTIF PREFERENCIAS (gestor) ============

class TestNotifPreferencias:
    def test_get_prefs_gestor(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/auth/me/notif-preferencias", headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        prefs = r.json().get("preferencias", {})
        for k in ("convocatorias", "tareas", "comentarios", "recordatorios", "reclamaciones", "verificaciones"):
            assert k in prefs

    def test_put_prefs_partial(self, admin_token):
        # Toggle comentarios=false, then restore
        r = requests.put(f"{BASE_URL}/api/auth/me/notif-preferencias",
                         headers=H(admin_token), json={"comentarios": False}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["preferencias"]["comentarios"] is False
        # restore
        r = requests.put(f"{BASE_URL}/api/auth/me/notif-preferencias",
                         headers=H(admin_token), json={"comentarios": True}, timeout=30)
        assert r.status_code == 200
        assert r.json()["preferencias"]["comentarios"] is True


# ============ RECORDATORIOS ADMIN ============

class TestRecordatorios:
    def test_status(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/recordatorios/status", headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("running") is True, f"Scheduler no corriendo: {d}"
        ids = {j["id"] for j in d.get("jobs", [])}
        assert "recordatorios_diarios" in ids, f"jobs={d.get('jobs')}"
        assert "recordatorios_ultima_llamada" in ids
        assert d.get("dias_antes_disponibilidad") == 3
        assert d.get("dias_antes_logistica") == 2
        assert d.get("dias_antes_tareas") == 1

    def test_run_now(self, dg_token):
        r = requests.post(f"{BASE_URL}/api/admin/recordatorios/run-now", headers=H(dg_token), timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("total_enviados"), int)
        results = d.get("results") or []
        jobs = {x.get("job") for x in results}
        assert "disponibilidad" in jobs
        assert "logistica" in jobs
        assert "tareas" in jobs

    def test_run_last_call(self, dg_token):
        r = requests.post(f"{BASE_URL}/api/admin/recordatorios/run-last-call", headers=H(dg_token), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("total_enviados"), int)
        assert d.get("tipo") == "ultima_llamada"

    def test_historial(self, dg_token):
        r = requests.get(f"{BASE_URL}/api/admin/recordatorios/historial?limit=20", headers=H(dg_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "historial" in d
        for item in d["historial"][:5]:
            assert "usuario_nombre" in item

    def test_suscriptores(self, dg_token):
        r = requests.get(f"{BASE_URL}/api/admin/recordatorios/suscriptores", headers=H(dg_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "suscriptores" in d

    def test_errores(self, dg_token):
        r = requests.get(f"{BASE_URL}/api/admin/recordatorios/errores", headers=H(dg_token), timeout=30)
        assert r.status_code == 200, r.text
        assert "errores" in r.json()

    def test_run_now_gestor_regular_403(self, admin_token):
        # admin@convocatorias.com tiene rol='gestor' (no admin/director_general)
        r = requests.post(f"{BASE_URL}/api/admin/recordatorios/run-now",
                          headers=H(admin_token), timeout=30)
        assert r.status_code == 403, f"Gestor regular debió recibir 403, recibió {r.status_code}: {r.text[:200]}"

    def test_historial_gestor_regular_403(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/recordatorios/historial", headers=H(admin_token), timeout=30)
        assert r.status_code == 403


# ============ DASHBOARD KPIs ============

class TestDashboardKPIs:
    def test_resumen_includes_new_kpis(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/gestor/dashboard/resumen", headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        kpis = d.get("kpis") or d
        assert "recordatorios_enviados_hoy" in kpis, f"keys: {list(kpis.keys())}"
        assert "errores_recientes" in kpis
        assert isinstance(kpis["recordatorios_enviados_hoy"], int)
        assert isinstance(kpis["errores_recientes"], int)
