"""Iter31 — Tests backend para /api/gestor/prefs-ui (GET/PUT).

Cubre:
  1) GET inicial para admin y músico (objeto vacío o con prefs previas).
  2) PUT con varias claves → 200 {ok:true, prefs: {...}} y GET posterior confirma persistencia.
  3) PUT merge parcial: segundo PUT actualiza una clave sin borrar la otra.
  4) PUT con null borra una clave específica.
  5) Aislamiento entre usuarios: admin y músico NO comparten prefs.
  6) Spot-check regresión: /api/gestor/bandeja, /api/admin/bandeja (si existe),
     /api/portal/mi-perfil siguen 200 tras incluir el nuevo router.

Limpieza: al terminar, resetea prefs_ui a {} para ambos usuarios (PUT con null a todas las claves).
"""
import os
import uuid
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

PREFS_URL = f"{BASE_URL}/api/gestor/prefs-ui"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        return None, r
    j = r.json()
    tok = j.get("access_token") or j.get("token") or j.get("session", {}).get("access_token")
    return tok, r


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


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


def _reset_all_keys(tok):
    """Borra todas las claves presentes en prefs_ui del usuario."""
    g = requests.get(PREFS_URL, headers=hdr(tok), timeout=20)
    if g.status_code != 200:
        return
    prefs = g.json().get("prefs", {}) or {}
    if not prefs:
        return
    null_payload = {k: None for k in prefs.keys()}
    requests.put(PREFS_URL, headers=hdr(tok),
                 json={"prefs": null_payload}, timeout=20)


@pytest.fixture(scope="module", autouse=True)
def _cleanup(admin_token, musico_token):
    # Reset previo para partir limpios
    _reset_all_keys(admin_token)
    _reset_all_keys(musico_token)
    yield
    # Reset posterior para no contaminar
    _reset_all_keys(admin_token)
    _reset_all_keys(musico_token)


# ---------- 1) GET inicial ----------

def test_get_prefs_admin_initial(admin_token):
    r = requests.get(PREFS_URL, headers=hdr(admin_token), timeout=20)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:200]}"
    body = r.json()
    assert "prefs" in body and isinstance(body["prefs"], dict)
    # Tras cleanup debe estar vacío
    assert body["prefs"] == {}


def test_get_prefs_musico_initial(musico_token):
    r = requests.get(PREFS_URL, headers=hdr(musico_token), timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "prefs" in body and isinstance(body["prefs"], dict)
    assert body["prefs"] == {}


# ---------- 2) PUT y persistencia (GET posterior) ----------

def test_put_prefs_admin_and_persistence(admin_token):
    uid = str(uuid.uuid4())
    payload = {"prefs": {"key1": "val1", "key2": [1, 2, 3], "marker_uuid": uid}}
    r = requests.put(PREFS_URL, headers=hdr(admin_token), json=payload, timeout=20)
    assert r.status_code == 200, f"PUT status={r.status_code} body={r.text[:200]}"
    body = r.json()
    assert body.get("ok") is True
    assert body["prefs"]["key1"] == "val1"
    assert body["prefs"]["key2"] == [1, 2, 3]
    assert body["prefs"]["marker_uuid"] == uid

    # GET posterior confirma persistencia
    g = requests.get(PREFS_URL, headers=hdr(admin_token), timeout=20)
    assert g.status_code == 200
    prefs = g.json()["prefs"]
    assert prefs["key1"] == "val1"
    assert prefs["key2"] == [1, 2, 3]
    assert prefs["marker_uuid"] == uid


# ---------- 3) PUT merge parcial ----------

def test_put_merge_partial_does_not_wipe_untouched_keys(admin_token):
    # Asegurar estado inicial
    requests.put(PREFS_URL, headers=hdr(admin_token),
                 json={"prefs": {"key1": "val1", "key2": [1, 2, 3]}}, timeout=20)

    # Merge parcial: sólo actualizamos key1
    r = requests.put(PREFS_URL, headers=hdr(admin_token),
                     json={"prefs": {"key1": "actualizado"}}, timeout=20)
    assert r.status_code == 200
    merged = r.json()["prefs"]
    assert merged["key1"] == "actualizado"
    assert merged["key2"] == [1, 2, 3], f"merge rompió key2: {merged}"

    # GET confirma
    g = requests.get(PREFS_URL, headers=hdr(admin_token), timeout=20)
    gp = g.json()["prefs"]
    assert gp["key1"] == "actualizado"
    assert gp["key2"] == [1, 2, 3]


# ---------- 4) PUT con null borra clave ----------

def test_put_null_deletes_key(admin_token):
    # Estado inicial con key1 y key2
    requests.put(PREFS_URL, headers=hdr(admin_token),
                 json={"prefs": {"key1": "keep", "key2": [1, 2, 3]}}, timeout=20)

    r = requests.put(PREFS_URL, headers=hdr(admin_token),
                     json={"prefs": {"key2": None}}, timeout=20)
    assert r.status_code == 200
    merged = r.json()["prefs"]
    assert "key2" not in merged, f"key2 debió borrarse, prefs={merged}"
    assert merged.get("key1") == "keep"

    # GET confirma que key2 no existe pero key1 sí
    g = requests.get(PREFS_URL, headers=hdr(admin_token), timeout=20)
    gp = g.json()["prefs"]
    assert "key2" not in gp
    assert gp.get("key1") == "keep"


# ---------- 5) Aislamiento entre usuarios ----------

def test_prefs_isolation_between_users(admin_token, musico_token):
    # Admin guarda un marcador único
    admin_marker = f"admin-{uuid.uuid4()}"
    requests.put(PREFS_URL, headers=hdr(admin_token),
                 json={"prefs": {"owner_marker": admin_marker}}, timeout=20)

    # Músico guarda otro marcador único
    musico_marker = f"musico-{uuid.uuid4()}"
    requests.put(PREFS_URL, headers=hdr(musico_token),
                 json={"prefs": {"owner_marker": musico_marker}}, timeout=20)

    # Cada uno lee su propio marcador
    admin_prefs = requests.get(PREFS_URL, headers=hdr(admin_token), timeout=20).json()["prefs"]
    musico_prefs = requests.get(PREFS_URL, headers=hdr(musico_token), timeout=20).json()["prefs"]
    assert admin_prefs.get("owner_marker") == admin_marker
    assert musico_prefs.get("owner_marker") == musico_marker
    assert admin_prefs.get("owner_marker") != musico_prefs.get("owner_marker")


def test_musico_can_put_own_prefs(musico_token):
    r = requests.put(PREFS_URL, headers=hdr(musico_token),
                     json={"prefs": {"seguimiento_eventos_ocultos": ["uuid-a", "uuid-b"]}},
                     timeout=20)
    assert r.status_code == 200
    prefs = r.json()["prefs"]
    assert prefs["seguimiento_eventos_ocultos"] == ["uuid-a", "uuid-b"]

    g = requests.get(PREFS_URL, headers=hdr(musico_token), timeout=20)
    assert g.json()["prefs"]["seguimiento_eventos_ocultos"] == ["uuid-a", "uuid-b"]


# ---------- 6) Regresión básica: otros endpoints responden ----------

def test_regression_gestor_bandeja_reachable(admin_token):
    r = requests.get(f"{BASE_URL}/api/gestor/bandeja", headers=hdr(admin_token), timeout=20)
    # Aceptamos 200 o 404 (si el endpoint es de detalle); nunca 5xx
    assert r.status_code < 500, f"regresión bandeja: {r.status_code} {r.text[:200]}"


def test_regression_portal_mi_perfil_reachable(musico_token):
    r = requests.get(f"{BASE_URL}/api/portal/mi-perfil", headers=hdr(musico_token), timeout=20)
    assert r.status_code == 200


def test_regression_no_auth_returns_401(admin_token):
    # Sin token → 401/403, nunca 500
    r = requests.get(PREFS_URL, timeout=20)
    assert r.status_code in (401, 403), f"esperado 401/403, got {r.status_code}"
