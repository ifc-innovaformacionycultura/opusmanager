"""Iter30 (Iter B) — backend spot checks for the 5 surgical changes.
- 1A: GET /api/gestor/plantillas-definitivas works
- 4: PUT /api/portal/mi-perfil persists nivel_estudios (verified via admin endpoint)
- 13: GET /api/gestor/eventos works (so frontend can list events)

Note on PUNTO 4 verification: GET /api/portal/mi-perfil returns the JWT-cached
profile and does NOT re-read DB, so to verify persistence we either:
  (a) re-login the musico to get a fresh JWT with the new profile, or
  (b) query as admin via /api/gestor/musicos.
We use (b) primarily and (a) as a cross-check.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
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


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password},
                      timeout=20)
    if r.status_code != 200:
        return None, r
    j = r.json()
    tok = j.get("access_token") or j.get("token") or j.get("session", {}).get("access_token")
    return tok, r


@pytest.fixture(scope="module")
def admin_token():
    tok, r = _login(ADMIN_EMAIL, ADMIN_PASS)
    if not tok:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return tok


@pytest.fixture(scope="module")
def musico_token():
    tok, r = _login(MUSICO_EMAIL, MUSICO_PASS)
    if not tok:
        pytest.skip(f"musico login failed: {r.status_code} {r.text[:200]}")
    return tok


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


def _find_musico_via_admin(admin_token, email):
    """Buscar el músico por email en /api/gestor/musicos y devolver el dict completo."""
    r = requests.get(f"{BASE_URL}/api/gestor/musicos",
                     headers=hdr(admin_token), timeout=20,
                     params={"q": email})
    assert r.status_code == 200, f"GET musicos status={r.status_code} body={r.text[:200]}"
    data = r.json()
    musicos = data.get("musicos") if isinstance(data, dict) else data
    if not isinstance(musicos, list):
        # fallback: alguna versión devuelve {data: [...]} u otra forma
        musicos = data.get("data", []) if isinstance(data, dict) else []
    for m in musicos:
        if (m.get("email") or "").lower() == email.lower():
            return m
    return None


# 4 — PUT /api/portal/mi-perfil persiste nivel_estudios (verificado vía admin)
@pytest.mark.parametrize("nivel", [
    "Superior finalizado",
    "Superior cursando",
    "Profesional finalizado",
    "Profesional cursando",
])
def test_portal_perfil_persiste_nivel_estudios(musico_token, admin_token, nivel):
    # 1) PUT con el nuevo nivel
    payload = {"nivel_estudios": nivel}
    r = requests.put(f"{BASE_URL}/api/portal/mi-perfil",
                     headers=hdr(musico_token), json=payload, timeout=20)
    assert r.status_code in (200, 204), f"PUT status={r.status_code} body={r.text[:200]}"

    # 2) Verificar persistencia leyendo desde el admin (relee DB, no usa JWT cache)
    musico = _find_musico_via_admin(admin_token, MUSICO_EMAIL)
    assert musico is not None, f"músico {MUSICO_EMAIL} no encontrado en /api/gestor/musicos"
    assert musico.get("nivel_estudios") == nivel, (
        f"persistencia fallida vía admin: esperado='{nivel}' "
        f"actual='{musico.get('nivel_estudios')}'"
    )


# 4b — Cross-check: tras un re-login del músico, el JWT nuevo refleja el cambio
def test_portal_perfil_persistencia_via_relogin(musico_token):
    # 1) PUT con un valor conocido
    target = "Superior finalizado"
    r = requests.put(f"{BASE_URL}/api/portal/mi-perfil",
                     headers=hdr(musico_token), json={"nivel_estudios": target},
                     timeout=20)
    assert r.status_code in (200, 204), f"PUT status={r.status_code}"

    # 2) Re-login para obtener un JWT con el profile fresco
    fresh_tok, login_resp = _login(MUSICO_EMAIL, MUSICO_PASS)
    assert fresh_tok, f"re-login failed: {login_resp.status_code} {login_resp.text[:200]}"

    # 3) GET /api/portal/mi-perfil con el token fresh
    g = requests.get(f"{BASE_URL}/api/portal/mi-perfil",
                     headers=hdr(fresh_tok), timeout=20)
    assert g.status_code == 200
    body = g.json()
    profile = body.get("profile", body)
    assert profile.get("nivel_estudios") == target, (
        f"tras re-login GET mi-perfil devolvió '{profile.get('nivel_estudios')}', "
        f"esperado '{target}'"
    )
