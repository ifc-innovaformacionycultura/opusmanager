"""Bloque 4 — Informes (8 tipos PDF A-H). Smoke test de POST /generar y GET /preview."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://contact-conductor.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@convocatorias.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def evento_id(headers):
    r = requests.get(f"{BASE}/api/gestor/eventos", headers=headers, timeout=30)
    assert r.status_code == 200
    data = r.json()
    evs = data.get("eventos") or data if isinstance(data, list) else data.get("eventos", [])
    if isinstance(data, list):
        evs = data
    assert evs, "No hay eventos en la BBDD para testear"
    return evs[0]["id"]


# Preview endpoints (A/E/F enriquecidos)
@pytest.mark.parametrize("tipo", ["A", "E", "F"])
def test_preview_tipo(headers, evento_id, tipo):
    r = requests.get(f"{BASE}/api/gestor/informes/preview/{tipo}/{evento_id}", headers=headers, timeout=30)
    assert r.status_code == 200, f"Preview {tipo} failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert "evento" in data
    assert data["evento"].get("id") == evento_id


# Generar PDF para los 8 tipos A-H
@pytest.mark.parametrize("tipo", ["A", "B", "C", "D", "E", "F", "G", "H"])
def test_generar_pdf(headers, evento_id, tipo):
    payload = {"tipo": tipo, "evento_ids": [evento_id], "opciones": {"plano_mode": "herradura"}}
    r = requests.post(f"{BASE}/api/gestor/informes/generar", json=payload, headers=headers, timeout=90)
    assert r.status_code == 200, f"Generar {tipo} falló: {r.status_code} {r.text[:300]}"
    ct = r.headers.get("content-type", "")
    assert "application/pdf" in ct, f"Content-Type inesperado tipo {tipo}: {ct}"
    body = r.content
    assert body[:4] == b"%PDF", f"Bytes no son PDF para tipo {tipo}: {body[:20]}"
    assert len(body) > 500, f"PDF demasiado corto tipo {tipo}: {len(body)} bytes"
