# Iter C+G backend spot-check: documentos (recibos/certificados) + fichaje
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://contact-conductor.preview.emergentagent.com").rstrip("/")

ADMIN = {"email": "admin@convocatorias.com", "password": "Admin123!"}
MUSICO = {"email": "jesusalonsodirector@gmail.com", "password": "Musico123!"}
MUSICO_EMAIL = MUSICO["email"]


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:200]}"
    data = r.json()
    token = (
        data.get("access_token")
        or data.get("token")
        or (data.get("session") or {}).get("access_token")
    )
    assert token, f"no token in {data.keys()}"
    return token


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def musico_headers():
    return {"Authorization": f"Bearer {_login(MUSICO)}"}


# ---------- 18: Recibos admin ----------
def test_admin_recibos_listado_contiene_jesus_300(admin_headers):
    r = requests.get(f"{BASE_URL}/api/gestor/documentos/recibos", headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text[:200]
    lst = r.json() if isinstance(r.json(), list) else r.json().get("recibos", [])
    # match by musico email or 300 bruto
    def _is_jesus(x):
        for key in ("usuario", "musico"):
            u = x.get(key) or {}
            if (u.get("email") or "").lower() == MUSICO_EMAIL:
                return True
        return (x.get("musico_email") or "").lower() == MUSICO_EMAIL
    jesus = [x for x in lst if _is_jesus(x)]
    assert jesus, f"No recibo for Jesús Alonso in {len(lst)} recibos. Sample: {lst[:1] if lst else []}"
    r0 = jesus[0]
    assert float(r0.get("importe_bruto", 0)) == 300.0, f"bruto={r0.get('importe_bruto')}"
    assert float(r0.get("irpf_importe", 0)) == 45.0, f"irpf={r0.get('irpf_importe')}"
    assert float(r0.get("importe_neto", 0)) == 255.0, f"neto={r0.get('importe_neto')}"
    assert r0.get("publicado") is True, f"publicado={r0.get('publicado')}"


# ---------- 18: Certificados admin ----------
def test_admin_certificados_contiene_jesus_8h(admin_headers):
    r = requests.get(f"{BASE_URL}/api/gestor/documentos/certificados", headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text[:200]
    lst = r.json() if isinstance(r.json(), list) else r.json().get("certificados", [])
    def _is_jesus(x):
        for key in ("usuario", "musico"):
            u = x.get(key) or {}
            if (u.get("email") or "").lower() == MUSICO_EMAIL:
                return True
        return False
    jesus = [x for x in lst if _is_jesus(x)]
    assert jesus, f"No certificado for Jesús. total={len(lst)}, sample={lst[:1] if lst else []}"
    c0 = jesus[0]
    assert float(c0.get("horas_totales", 0)) == 8.0, f"horas={c0.get('horas_totales')}"
    assert c0.get("temporada") == "2025-2026", f"temporada={c0.get('temporada')}"
    assert c0.get("publicado") is True


# ---------- 18: Portal músico ----------
def test_portal_mi_historial_recibos(musico_headers):
    r = requests.get(f"{BASE_URL}/api/portal/mi-historial/recibos", headers=musico_headers, timeout=20)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    lst = r.json() if isinstance(r.json(), list) else r.json().get("recibos", [])
    assert len(lst) >= 1, f"Expected >=1 recibo, got {len(lst)}"
    r0 = lst[0]
    assert float(r0.get("importe_neto", 0)) == 255.0 or float(r0.get("importe_bruto", 0)) == 300.0


def test_portal_mi_historial_certificados(musico_headers):
    r = requests.get(f"{BASE_URL}/api/portal/mi-historial/certificados", headers=musico_headers, timeout=20)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    lst = r.json() if isinstance(r.json(), list) else r.json().get("certificados", [])
    assert len(lst) >= 1, f"Expected >=1 certificado, got {len(lst)}"


# ---------- 1B: Fichaje spot-check ----------
def test_fichaje_entrada_token_invalido(musico_headers):
    r = requests.post(f"{BASE_URL}/api/fichaje/entrada/ZZ_INVALID_TOKEN_XYZ",
                      headers=musico_headers, json={}, timeout=15)
    assert r.status_code in (400, 404, 422), f"unexpected {r.status_code}: {r.text[:200]}"
    j = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    assert "detail" in j or "message" in j or "error" in j


def test_fichaje_estado_endpoint_schema(musico_headers, admin_headers):
    # Get one ensayo id via portal evento listing (músico) to exercise endpoint.
    er = requests.get(f"{BASE_URL}/api/portal/mis-eventos", headers=musico_headers, timeout=15)
    if er.status_code != 200:
        pytest.skip(f"no mis-eventos: {er.status_code}")
    evs = er.json() if isinstance(er.json(), list) else er.json().get("eventos", [])
    ensayo_id = None
    musico_id = None
    for ev in evs:
        evid = (ev.get("evento") or {}).get("id") or ev.get("id")
        if not evid:
            continue
        ens = requests.get(f"{BASE_URL}/api/portal/evento/{evid}/ensayos", headers=musico_headers, timeout=15)
        if ens.status_code == 200:
            en_list = ens.json() if isinstance(ens.json(), list) else ens.json().get("ensayos", [])
            if en_list:
                ensayo_id = en_list[0].get("id")
                break
    # musico_id via /auth/me
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=musico_headers, timeout=10)
    if me.status_code == 200:
        musico_id = (me.json().get("profile") or {}).get("id") or me.json().get("id")
    if not ensayo_id or not musico_id:
        pytest.skip(f"no ensayo/musico id (ensayo={ensayo_id} musico={musico_id})")
    st = requests.get(f"{BASE_URL}/api/fichaje/estado/{ensayo_id}/{musico_id}", headers=musico_headers, timeout=15)
    assert st.status_code == 200, f"{st.status_code} {st.text[:200]}"
    body = st.json()
    assert "estado" in body, body
    assert body["estado"] in ("sin_fichar", "entrada_registrada", "completo"), body
