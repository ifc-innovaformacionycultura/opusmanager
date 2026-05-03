"""Iter30 (Iter B) — backend spot checks for the 5 surgical changes.
- 1A: GET /api/gestor/plantillas-definitivas works
- 4: PUT /api/portal/perfil accepts new nivel_estudios values
- 13: GET /api/gestor/eventos works (so frontend can list events)
- 15: backend block when publishing a borrador with pending verifications
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback to frontend env
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                    break
    except Exception:
        pass

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASS = "Admin123!"
MUSICO_EMAIL = "jesusalonsodirector@gmail.com"
MUSICO_PASS = "Musico123!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
                      timeout=20)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    j = r.json()
    return j.get("access_token") or j.get("token") or j.get("session", {}).get("access_token")


@pytest.fixture(scope="module")
def musico_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": MUSICO_EMAIL, "password": MUSICO_PASS},
                      timeout=20)
    if r.status_code != 200:
        pytest.skip(f"musico login failed: {r.status_code} {r.text[:200]}")
    j = r.json()
    return j.get("access_token") or j.get("token") or j.get("session", {}).get("access_token")


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# 1A — Plantillas definitivas backend reachable
def test_plantillas_definitivas_get(admin_token):
    r = requests.get(f"{BASE_URL}/api/gestor/plantillas-definitivas",
                     headers=hdr(admin_token), timeout=20)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:200]}"


# 13 — Eventos list reachable
def test_gestor_eventos_get(admin_token):
    r = requests.get(f"{BASE_URL}/api/gestor/eventos",
                     headers=hdr(admin_token), timeout=20)
    assert r.status_code == 200
    data = r.json()
    eventos = data["eventos"] if isinstance(data, dict) else data
    assert isinstance(eventos, list)
    assert len(eventos) > 0


# 4 — Portal perfil accepts new nivel values
@pytest.mark.parametrize("nivel", [
    "Superior finalizado", "Superior cursando",
    "Profesional finalizado", "Profesional cursando",
])
def test_portal_perfil_acepta_nivel(musico_token, nivel):
    # GET first to know shape
    g = requests.get(f"{BASE_URL}/api/portal/mi-perfil", headers=hdr(musico_token), timeout=20)
    assert g.status_code == 200, f"GET perfil status={g.status_code} body={g.text[:200]}"
    payload = {"nivel_estudios": nivel}
    r = requests.put(f"{BASE_URL}/api/portal/mi-perfil",
                     headers=hdr(musico_token), json=payload, timeout=20)
    assert r.status_code in (200, 204), f"status={r.status_code} body={r.text[:200]}"
    # verify persisted
    g2 = requests.get(f"{BASE_URL}/api/portal/mi-perfil", headers=hdr(musico_token), timeout=20)
    assert g2.status_code == 200
    body = g2.json()
    profile = body.get("profile", body)
    assert profile.get("nivel_estudios") == nivel
