"""
Iteration 9 – OPUS MANAGER: convocatoria por instrumento + cachets por evento.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://contact-conductor.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASS = "Admin123!"
MUS_EMAIL = "jesusalonsodirector@gmail.com"
MUS_PASS = "Musico123!"


@pytest.fixture(scope="module")
def gestor_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, r.text[:200]
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def musico_token():
    r = requests.post(f"{API}/auth/login", json={"email": MUS_EMAIL, "password": MUS_PASS}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Músico login: {r.status_code}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def gheaders(gestor_token):
    return {"Authorization": f"Bearer {gestor_token}"}


@pytest.fixture(scope="module")
def mheaders(musico_token):
    return {"Authorization": f"Bearer {musico_token}"}


@pytest.fixture(scope="module")
def first_evento_id(gheaders):
    r = requests.get(f"{API}/gestor/eventos", headers=gheaders, timeout=30)
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("eventos", [])
    assert items
    return items[0]["id"]


@pytest.fixture(scope="module")
def first_ensayo_id(gheaders):
    # Localizar un ensayo de seguimiento (persistido)
    r = requests.get(f"{API}/gestor/seguimiento", headers=gheaders, timeout=30)
    if r.status_code == 200:
        data = r.json()
        for ev in data.get("eventos", []):
            for e in (ev.get("ensayos") or []):
                if e.get("id"):
                    return e["id"]
    pytest.skip("No hay ensayos persistidos")


# ---------------- ensayo_instrumentos ----------------
class TestEnsayoInstrumentos:
    def test_get_default_19(self, gheaders, first_ensayo_id):
        r = requests.get(f"{API}/gestor/ensayos/{first_ensayo_id}/instrumentos", headers=gheaders, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "instrumentos" in data and "ha_custom" in data
        lst = data["instrumentos"]
        assert len(lst) >= 18, f"Esperados ~19 instrumentos, llegaron {len(lst)}"
        for it in lst:
            assert "instrumento" in it and "convocado" in it

    def test_put_upsert_and_persist(self, gheaders, first_ensayo_id):
        # Payload = lista directa (no envoltorio)
        payload = [
            {"instrumento": "Violín", "convocado": True},
            {"instrumento": "Piano", "convocado": False},
        ]
        r = requests.put(
            f"{API}/gestor/ensayos/{first_ensayo_id}/instrumentos",
            json=payload, headers=gheaders, timeout=30,
        )
        assert r.status_code == 200, r.text[:400]
        body = r.json()
        assert body.get("ok") is True
        assert "creados" in body and "actualizados" in body

        # Re-GET
        r2 = requests.get(f"{API}/gestor/ensayos/{first_ensayo_id}/instrumentos", headers=gheaders, timeout=30)
        assert r2.status_code == 200
        data = r2.json()
        assert data["ha_custom"] is True
        piano = next((i for i in data["instrumentos"] if i["instrumento"].lower() == "piano"), None)
        assert piano and piano["convocado"] is False, "Piano debería quedar convocado=false"

        # Restaurar
        requests.put(
            f"{API}/gestor/ensayos/{first_ensayo_id}/instrumentos",
            json=[{"instrumento": "Piano", "convocado": True}], headers=gheaders, timeout=30,
        )


# ---------------- cachets-config por evento ----------------
class TestCachetsConfigEvento:
    def test_crud_full(self, gheaders, first_evento_id):
        # GET inicial
        r = requests.get(f"{API}/gestor/cachets-config/{first_evento_id}", headers=gheaders, timeout=30)
        assert r.status_code == 200

        # PUT (lista directa)
        payload = [
            {"instrumento": "Violín", "nivel_estudios": "Superior finalizado", "importe": 410},
            {"instrumento": "Piano", "nivel_estudios": "Profesional cursando", "importe": 205},
        ]
        r2 = requests.put(
            f"{API}/gestor/cachets-config/{first_evento_id}",
            json=payload, headers=gheaders, timeout=30,
        )
        assert r2.status_code == 200, r2.text[:300]
        assert r2.json().get("ok") is True

        # Re-GET
        r3 = requests.get(f"{API}/gestor/cachets-config/{first_evento_id}", headers=gheaders, timeout=30)
        assert r3.status_code == 200
        lst = r3.json().get("cachets", [])
        violin = [c for c in lst if c.get("instrumento") == "Violín"
                  and c.get("nivel_estudios") == "Superior finalizado"]
        assert violin and violin[0].get("importe") in (410, 410.0)

        # UPDATE mismo registro
        payload2 = [{"instrumento": "Violín", "nivel_estudios": "Superior finalizado", "importe": 420}]
        r4 = requests.put(
            f"{API}/gestor/cachets-config/{first_evento_id}",
            json=payload2, headers=gheaders, timeout=30,
        )
        assert r4.status_code == 200
        r5 = requests.get(f"{API}/gestor/cachets-config/{first_evento_id}", headers=gheaders, timeout=30)
        lst = r5.json().get("cachets", [])
        violin = [c for c in lst if c.get("instrumento") == "Violín"
                  and c.get("nivel_estudios") == "Superior finalizado"]
        assert violin and violin[0].get("importe") in (420, 420.0)

    def test_copy_from_base(self, gheaders, first_evento_id):
        r = requests.post(
            f"{API}/gestor/cachets-config/{first_evento_id}/copy-from-base",
            headers=gheaders, timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("ok") is True
        # Espera alguno de los dos contadores
        assert "copiados" in body or "actualizados" in body


# ---------------- Plantillas definitivas ----------------
class TestPlantillasDefinitivas:
    def test_convocado_en_disponibilidad_y_asistencia(self, gheaders):
        r = requests.get(f"{API}/gestor/plantillas-definitivas", headers=gheaders, timeout=60)
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else r.json().get("eventos", [])
        found_disp = False
        found_asis = False
        for ev in items:
            for sec in ev.get("secciones", []):
                for m in sec.get("musicos", []):
                    for cell in m.get("disponibilidad", []) or []:
                        if isinstance(cell, dict) and "convocado" in cell:
                            found_disp = True
                    for cell in m.get("asistencia", []) or []:
                        if isinstance(cell, dict) and "convocado" in cell:
                            found_asis = True
                if found_disp and found_asis:
                    break
        assert found_disp, "plantillas-definitivas: no hay campo 'convocado' en disponibilidad"
        assert found_asis, "plantillas-definitivas: no hay campo 'convocado' en asistencia"


# ---------------- Seguimiento ----------------
class TestSeguimiento:
    def test_convocado_en_disponibilidad(self, gheaders):
        r = requests.get(f"{API}/gestor/seguimiento", headers=gheaders, timeout=60)
        assert r.status_code == 200
        data = r.json()
        musicos = data.get("musicos", [])
        found = False
        for m in musicos:
            asigs = m.get("asignaciones") or []
            if isinstance(asigs, dict):
                asigs = list(asigs.values())
            for asg in asigs:
                if not isinstance(asg, dict):
                    continue
                disp = asg.get("disponibilidad") or []
                cells = list(disp.values()) if isinstance(disp, dict) else disp
                for cell in cells:
                    if isinstance(cell, dict) and "convocado" in cell:
                        found = True
                        break
            if found:
                break
        assert found, "/seguimiento no incluye campo 'convocado' en celdas de disponibilidad"


# ---------------- Gestion economica ----------------
class TestGestionEconomica:
    def test_endpoint_200(self, gheaders):
        r = requests.get(f"{API}/gestor/gestion-economica", headers=gheaders, timeout=60)
        assert r.status_code == 200


# ---------------- Portal músico ----------------
class TestPortal:
    def test_mis_eventos_ensayos_convocado(self, mheaders):
        r = requests.get(f"{API}/portal/mis-eventos", headers=mheaders, timeout=30)
        assert r.status_code == 200
        data = r.json()
        asigs = data.get("asignaciones", []) if isinstance(data, dict) else data
        assert isinstance(asigs, list) and asigs, "No hay asignaciones del músico"
        # Al menos una asignación con ensayos debería incluir 'convocado'
        found = False
        for a in asigs:
            for e in (a.get("ensayos") or []):
                if isinstance(e, dict) and "convocado" in e:
                    found = True
                    break
            if found:
                break
        assert found, "Portal /mis-eventos: ensayos no incluyen campo 'convocado'"
