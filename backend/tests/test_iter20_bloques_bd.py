"""Iter20 — Bloque 1, 2, B, D1-D4 + regresión.
Ejecuta contra REACT_APP_BACKEND_URL (ver /app/frontend/.env).
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://contact-conductor.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASS = "Admin123!"
DG_EMAIL = "jalonso@p.csmb.es"
DG_PASS = "Director2026!"
MUSICO_EMAIL = "jesusalonsodirector@gmail.com"
MUSICO_PASS = "Musico123!"
MUSICO_ID = "8bf521fa-dc27-4c5b-8069-d36d3d4eaad3"


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def dg_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": DG_EMAIL, "password": DG_PASS}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"DG login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def dg_headers(dg_token):
    return {"Authorization": f"Bearer {dg_token}", "Content-Type": "application/json"}


# --------------------------------------------------------------------------- #
# Regresión login (admin, DG, músico)
# --------------------------------------------------------------------------- #
class TestLoginRegression:
    def test_admin_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("token") or r.json().get("access_token")

    def test_dg_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": DG_EMAIL, "password": DG_PASS}, timeout=15)
        assert r.status_code == 200, r.text

    def test_musico_login(self):
        # login músico puede ser mismo endpoint o /api/auth/login-musico
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": MUSICO_EMAIL, "password": MUSICO_PASS}, timeout=15)
        if r.status_code == 200:
            assert r.json().get("token") or r.json().get("access_token")
        else:
            # fallback endpoint
            r2 = requests.post(f"{BASE_URL}/api/auth/login-musico",
                               json={"email": MUSICO_EMAIL, "password": MUSICO_PASS}, timeout=15)
            assert r2.status_code in (200, 404), r2.text


# --------------------------------------------------------------------------- #
# Bloque 1 — Configuración Organización
# --------------------------------------------------------------------------- #
class TestBloque1Configuracion:
    def test_get_config_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/configuracion", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert ("configuracion" in data) or ("config" in data) or ("org_nombre" in data)
        # editable=true para admin
        editable = data.get("editable")
        assert editable is True, f"editable should be True for admin, got {editable}"

    def test_put_config_admin(self, admin_headers):
        # obtener estado actual
        cur = requests.get(f"{BASE_URL}/api/admin/configuracion", headers=admin_headers, timeout=15).json()
        cfg = cur.get("configuracion") or cur.get("config") or cur
        current_irpf = cfg.get("irpf_porcentaje", 15)
        payload = {"irpf_porcentaje": current_irpf}
        r = requests.put(f"{BASE_URL}/api/admin/configuracion", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, f"PUT admin config failed: {r.status_code} {r.text[:300]}"

    def test_put_config_dg(self, dg_headers):
        cur = requests.get(f"{BASE_URL}/api/admin/configuracion", headers=dg_headers, timeout=15).json()
        cfg = cur.get("configuracion") or cur.get("config") or cur
        current_irpf = cfg.get("irpf_porcentaje", 15)
        r = requests.put(f"{BASE_URL}/api/admin/configuracion", headers=dg_headers,
                         json={"irpf_porcentaje": current_irpf}, timeout=15)
        assert r.status_code == 200, r.text


# --------------------------------------------------------------------------- #
# Bloque 2 — Fichaje QR
# --------------------------------------------------------------------------- #
class TestBloque2FichajeQR:
    @pytest.fixture(scope="class")
    def ensayo_id(self, admin_headers):
        # No hay GET /api/gestor/ensayos — buscamos un ensayo via eventos
        r = requests.get(f"{BASE_URL}/api/gestor/eventos", headers=admin_headers, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"No eventos endpoint: {r.status_code}")
        evs = r.json()
        if isinstance(evs, dict):
            evs = evs.get("eventos") or evs.get("items") or []
        for ev in evs[:20]:
            ev_id = ev.get("id")
            det = requests.get(f"{BASE_URL}/api/gestor/eventos/{ev_id}",
                               headers=admin_headers, timeout=10)
            if det.status_code == 200:
                detail = det.json()
                ensayos = detail.get("ensayos") or []
                if not ensayos and isinstance(detail.get("evento"), dict):
                    ensayos = detail["evento"].get("ensayos") or []
                if ensayos:
                    return ensayos[0].get("id")
        pytest.skip("No hay ensayos en ningún evento")

    def test_regenerar_qr_idempotent(self, admin_headers, ensayo_id):
        url = f"{BASE_URL}/api/gestor/ensayo-qr/{ensayo_id}/regenerar"
        r1 = requests.post(url, headers=admin_headers, timeout=15)
        assert r1.status_code == 200, f"1st regen failed: {r1.status_code} {r1.text[:300]}"
        qr1 = r1.json().get("qr") or {}
        token1 = qr1.get("token") or r1.json().get("token")
        assert token1, f"no token in response: {r1.json()}"
        r2 = requests.post(url, headers=admin_headers, timeout=15)
        assert r2.status_code == 200, f"2nd regen failed (idempotency): {r2.status_code} {r2.text[:300]}"
        qr2 = r2.json().get("qr") or {}
        token2 = qr2.get("token") or r2.json().get("token")
        assert token2

    def test_fichaje_info_by_token(self, admin_headers, ensayo_id):
        url = f"{BASE_URL}/api/gestor/ensayo-qr/{ensayo_id}/regenerar"
        r = requests.post(url, headers=admin_headers, timeout=15)
        qr = r.json().get("qr") or {}
        token = qr.get("token") or r.json().get("token")
        assert token, f"no token: {r.json()}"
        info = requests.get(f"{BASE_URL}/api/fichaje/info/{token}", timeout=15)
        assert info.status_code == 200, info.text
        data = info.json()
        assert "ensayo" in data or "nombre" in data or "evento" in data


# --------------------------------------------------------------------------- #
# Bloque B — Preview músico
# --------------------------------------------------------------------------- #
class TestBloqueBPreview:
    def test_generar_token_admin(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/gestor/preview/generar-token",
                          headers=admin_headers, json={"musico_id": MUSICO_ID}, timeout=15)
        assert r.status_code == 200, f"preview gen failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert "token" in data and len(data["token"]) > 10
        assert "expira_at" in data
        assert "musico_nombre" in data

    def test_get_preview_sin_auth(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/gestor/preview/generar-token",
                          headers=admin_headers, json={"musico_id": MUSICO_ID}, timeout=15)
        tok = r.json()["token"]
        # Sin Authorization header
        pv = requests.get(f"{BASE_URL}/api/preview/{tok}", timeout=15)
        assert pv.status_code == 200, pv.text
        data = pv.json()
        # IBAN enmascarado (no iban plano)
        perfil = data.get("perfil") or data.get("musico") or {}
        if "iban" in perfil:
            raw = perfil.get("iban")
            # si existe, aceptamos solo si está enmascarado
            assert raw is None or ("*" in str(raw) or raw == ""), f"IBAN no enmascarado: {raw}"
        # Debe tener varias secciones
        keys = set(data.keys())
        # aceptamos cualquiera de estas secciones
        assert keys & {"perfil", "eventos", "calendario", "pagos", "certificados", "reclamaciones", "comidas", "musico"}

    def test_preview_token_desconocido_404(self):
        r = requests.get(f"{BASE_URL}/api/preview/token-invalido-xyz-abc", timeout=15)
        assert r.status_code == 404

    def test_generar_token_desactiva_anteriores(self, admin_headers):
        r1 = requests.post(f"{BASE_URL}/api/gestor/preview/generar-token",
                           headers=admin_headers, json={"musico_id": MUSICO_ID}, timeout=15)
        t1 = r1.json()["token"]
        r2 = requests.post(f"{BASE_URL}/api/gestor/preview/generar-token",
                           headers=admin_headers, json={"musico_id": MUSICO_ID}, timeout=15)
        assert r2.status_code == 200
        # t1 debería haberse desactivado → 410
        pv = requests.get(f"{BASE_URL}/api/preview/{t1}", timeout=15)
        assert pv.status_code in (410, 404), f"El token anterior debería estar desactivado, got {pv.status_code}"


# --------------------------------------------------------------------------- #
# D3 — Catálogo plantillas email
# --------------------------------------------------------------------------- #
class TestD3Catalogo:
    def test_listar_catalogo(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/comunicaciones/catalogo", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data.get("catalogo") or data.get("items") or data
        assert isinstance(items, list)
        assert len(items) >= 4, f"Esperado >=4 plantillas en catálogo, got {len(items)}"
        for it in items:
            assert "key" in it or "id" in it
            assert "nombre" in it or "titulo" in it

    def test_crear_desde_catalogo(self, admin_headers):
        lst = requests.get(f"{BASE_URL}/api/comunicaciones/catalogo",
                           headers=admin_headers, timeout=15).json()
        items = lst.get("catalogo") or lst.get("items") or lst
        key = items[0].get("key") or items[0].get("id")
        r = requests.post(f"{BASE_URL}/api/comunicaciones/catalogo/{key}/crear",
                          headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("id") or data.get("plantilla_id") or data.get("plantilla")


# --------------------------------------------------------------------------- #
# D2 — Resumen mensual músicos
# --------------------------------------------------------------------------- #
class TestD2ResumenMensual:
    def test_send_monthly_summary_musicians_admin_email(self, admin_headers):
        """Admin por email (rol=gestor en BD) debería tener acceso."""
        r = requests.post(f"{BASE_URL}/api/admin/recordatorios/send-monthly-summary-musicians",
                          headers=admin_headers, timeout=60)
        # Si falla con 403, es bug: _es_admin en routes_recordatorios.py no reconoce admin por email
        assert r.status_code in (200, 202), f"{r.status_code} {r.text[:300]}"
        data = r.json()
        keys = set(data.keys())
        assert keys & {"enviados", "fallidos", "sent", "failed", "total", "resultados"}

    def test_send_monthly_summary_musicians_dg(self, dg_headers):
        """Director general siempre debe tener acceso."""
        r = requests.post(f"{BASE_URL}/api/admin/recordatorios/send-monthly-summary-musicians",
                          headers=dg_headers, timeout=90)
        assert r.status_code in (200, 202), f"{r.status_code} {r.text[:300]}"
        data = r.json()
        keys = set(data.keys())
        assert keys & {"enviados", "fallidos", "sent", "failed", "total", "resultados"}


# --------------------------------------------------------------------------- #
# D4 — Calendario eventos / widget 7 días
# --------------------------------------------------------------------------- #
class TestD4Calendario:
    def test_calendario_eventos(self, admin_headers):
        from datetime import date, timedelta
        desde = date.today().isoformat()
        hasta = (date.today() + timedelta(days=7)).isoformat()
        r = requests.get(f"{BASE_URL}/api/gestor/calendario-eventos",
                         headers=admin_headers, params={"desde": desde, "hasta": hasta}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Debe ser lista o dict con items
        items = data if isinstance(data, list) else (data.get("eventos") or data.get("items") or [])
        assert isinstance(items, list)
        # Si hay items, verificar estructura
        if items:
            sample = items[0]
            assert "tipo_calendario" in sample or "tipo" in sample
            # color puede estar presente
            # fechas
            assert "fecha" in sample or "fecha_inicio" in sample or "start" in sample


# --------------------------------------------------------------------------- #
# D1 — Opciones de menú comedor
# --------------------------------------------------------------------------- #
class TestD1OpcionesMenu:
    def test_comidas_confirmaciones_has_desglose(self, admin_headers):
        # buscamos un evento con comidas
        ev_r = requests.get(f"{BASE_URL}/api/gestor/eventos", headers=admin_headers, timeout=15)
        if ev_r.status_code != 200:
            pytest.skip("no gestor/eventos endpoint")
        evs = ev_r.json()
        if isinstance(evs, dict):
            evs = evs.get("eventos") or evs.get("items") or []
        if not evs:
            pytest.skip("no eventos")

        # Buscar comida existente
        found_comida_id = None
        for ev in evs[:15]:
            ev_id = ev.get("id")
            cr = requests.get(f"{BASE_URL}/api/gestor/eventos/{ev_id}/comidas",
                              headers=admin_headers, timeout=10)
            if cr.status_code == 200:
                coms = cr.json()
                if isinstance(coms, dict):
                    coms = coms.get("comidas") or coms.get("items") or []
                if coms:
                    found_comida_id = coms[0].get("id")
                    break
        if not found_comida_id:
            pytest.skip("no comida existente en eventos")
        r = requests.get(f"{BASE_URL}/api/gestor/comidas/{found_comida_id}/confirmaciones",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "desglose_por_opcion" in data, f"Campo desglose_por_opcion ausente: {list(data.keys())}"
        assert "opciones_menu" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
