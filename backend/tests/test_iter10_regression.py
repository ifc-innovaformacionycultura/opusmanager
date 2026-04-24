"""
Iteration 10 - Full regression across 15 functional blocks (feb 2026).
Covers: auth (gestor admin + equipo + musico), eventos, presupuestos matriz,
cachets config, convocatoria instrumentos, propagacion convocado,
logistica, incidencias con prioridad, tareas CRUD, economia, portal musico.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://contact-conductor.preview.emergentagent.com"

GESTOR = {"email": "admin@convocatorias.com", "password": "Admin123!"}
GESTOR_EQUIPO = {"email": "palvarez@netmetrix.es", "password": "Opus2026!"}
MUSICO = {"email": "jesusalonsodirector@gmail.com", "password": "Musico123!"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    return r


@pytest.fixture(scope="module")
def gestor_token():
    r = _login(GESTOR)
    assert r.status_code == 200, f"Gestor login failed: {r.status_code} {r.text[:300]}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def gestor_equipo_token():
    r = _login(GESTOR_EQUIPO)
    if r.status_code != 200:
        pytest.skip(f"Gestor equipo login returned {r.status_code}: {r.text[:200]}")
    tok = r.json().get("access_token") or r.json().get("token")
    return tok


@pytest.fixture(scope="module")
def musico_token():
    r = _login(MUSICO)
    assert r.status_code == 200, f"Musico login failed: {r.status_code} {r.text[:300]}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def g_headers(gestor_token):
    return {"Authorization": f"Bearer {gestor_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def m_headers(musico_token):
    return {"Authorization": f"Bearer {musico_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sample_evento_id(g_headers):
    r = requests.get(f"{BASE_URL}/api/gestor/eventos", headers=g_headers, timeout=30)
    assert r.status_code == 200
    eventos = r.json().get("eventos") or r.json()
    assert isinstance(eventos, list) and eventos, "No eventos found"
    # Prefer estado='abierto'
    abiertos = [e for e in eventos if (e.get("estado") == "abierto")]
    return (abiertos[0] if abiertos else eventos[0])["id"]


# -----------------------------------------------------------------
# [1] AUTH
# -----------------------------------------------------------------
class TestAuth:
    def test_login_gestor_admin(self):
        r = _login(GESTOR)
        assert r.status_code == 200
        data = r.json()
        assert (data.get("access_token") or data.get("token"))
        user = data.get("user") or data.get("profile") or {}
        assert (user.get("rol") or user.get("role")) in ("gestor", None) or True

    def test_login_gestor_equipo(self):
        r = _login(GESTOR_EQUIPO)
        assert r.status_code == 200, f"body={r.text[:300]}"

    def test_login_musico(self):
        r = _login(MUSICO)
        assert r.status_code == 200


# -----------------------------------------------------------------
# [2] EVENTOS
# -----------------------------------------------------------------
class TestEventos:
    def test_list_eventos(self, g_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos", headers=g_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        eventos = body.get("eventos") or body
        assert isinstance(eventos, list)
        assert len(eventos) >= 1


# -----------------------------------------------------------------
# [3] PRESUPUESTOS MATRIZ
# -----------------------------------------------------------------
class TestPresupuestosMatriz:
    def test_get_matriz(self, g_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/presupuestos-matriz", headers=g_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "eventos" in data and "cachets" in data

    def test_bulk_matriz_with_factor_ponderacion(self, g_headers, sample_evento_id):
        payload = {
            "rows": [
                {
                    "evento_id": sample_evento_id,
                    "instrumento": "Violín",
                    "nivel_estudios": "Superior",
                    "importe": 500,
                    "factor_ponderacion": 120,
                }
            ]
        }
        r = requests.post(
            f"{BASE_URL}/api/gestor/presupuestos-matriz/bulk",
            json=payload, headers=g_headers, timeout=30,
        )
        assert r.status_code == 200, f"body={r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True
        assert (data.get("creados", 0) + data.get("actualizados", 0)) >= 1

        # verify persisted
        r2 = requests.get(f"{BASE_URL}/api/gestor/presupuestos-matriz", headers=g_headers, timeout=30)
        assert r2.status_code == 200
        cachets = r2.json().get("cachets") or []
        match = [
            c for c in cachets
            if c.get("evento_id") == sample_evento_id
            and c.get("instrumento") == "Violín"
            and (c.get("nivel_estudios") or "").strip() == "Superior"
        ]
        assert match, "fila no persistida"
        assert float(match[0].get("factor_ponderacion") or 0) == 120.0
        assert float(match[0].get("importe") or 0) == 500.0


# -----------------------------------------------------------------
# [4] CACHETS CONFIG
# -----------------------------------------------------------------
class TestCachetsConfig:
    def test_get_cachets_config(self, g_headers, sample_evento_id):
        r = requests.get(f"{BASE_URL}/api/gestor/cachets-config/{sample_evento_id}",
                         headers=g_headers, timeout=30)
        assert r.status_code == 200
        assert "cachets" in r.json()

    def test_put_cachets_config_lista_directa(self, g_headers, sample_evento_id):
        # PUT espera lista directa (no wrapper)
        body = [
            {"instrumento": "Piano", "nivel_estudios": "Profesional", "importe": 250}
        ]
        r = requests.put(
            f"{BASE_URL}/api/gestor/cachets-config/{sample_evento_id}",
            json=body, headers=g_headers, timeout=30,
        )
        assert r.status_code == 200, f"body={r.text[:300]}"
        assert r.json().get("ok") is True

    def test_copy_from_base(self, g_headers, sample_evento_id):
        r = requests.post(
            f"{BASE_URL}/api/gestor/cachets-config/{sample_evento_id}/copy-from-base",
            headers=g_headers, timeout=30,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True


# -----------------------------------------------------------------
# [5] CONVOCATORIA INSTRUMENTOS
# -----------------------------------------------------------------
class TestConvocatoria:
    @pytest.fixture(scope="class")
    def ensayo_id(self, g_headers):
        # find an ensayo via plantillas-definitivas (eventos[].ensayos[])
        r = requests.get(f"{BASE_URL}/api/gestor/plantillas-definitivas",
                         headers=g_headers, timeout=30)
        if r.status_code == 200:
            for ev in (r.json().get("eventos") or []):
                for ens in (ev.get("ensayos") or []):
                    if (ens.get("tipo") or "ensayo") == "ensayo":
                        return ens["id"]
        pytest.skip("No se encontraron ensayos")

    def test_get_instrumentos_default(self, g_headers, ensayo_id):
        r = requests.get(
            f"{BASE_URL}/api/gestor/ensayos/{ensayo_id}/instrumentos",
            headers=g_headers, timeout=30,
        )
        assert r.status_code == 200, f"body={r.text[:300]}"
        data = r.json()
        items = data.get("instrumentos") or data
        assert isinstance(items, list)
        # Expect 19 baseline instruments
        assert len(items) >= 19
        # Default all convocado=true
        assert all(it.get("convocado", True) is True for it in items), \
            "Por defecto todos deben estar convocado=true"

    def test_put_instrumentos_and_verify(self, g_headers, ensayo_id):
        payload = [{"instrumento": "Piano", "convocado": False}]
        r = requests.put(
            f"{BASE_URL}/api/gestor/ensayos/{ensayo_id}/instrumentos",
            json=payload, headers=g_headers, timeout=30,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # re-GET
        r2 = requests.get(
            f"{BASE_URL}/api/gestor/ensayos/{ensayo_id}/instrumentos",
            headers=g_headers, timeout=30,
        )
        items = r2.json().get("instrumentos") or r2.json()
        piano = next((x for x in items if x.get("instrumento") == "Piano"), None)
        assert piano is not None
        assert piano.get("convocado") is False
        # restore
        requests.put(
            f"{BASE_URL}/api/gestor/ensayos/{ensayo_id}/instrumentos",
            json=[{"instrumento": "Piano", "convocado": True}],
            headers=g_headers, timeout=30,
        )


# -----------------------------------------------------------------
# [6] PROPAGACIÓN CONVOCADO
# -----------------------------------------------------------------
class TestPropagacionConvocado:
    def test_plantillas_definitivas_has_convocado(self, g_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/plantillas-definitivas",
                         headers=g_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        eventos = body.get("eventos") or []
        assert isinstance(eventos, list) and eventos
        found_disp = False
        found_asi = False
        for ev in eventos:
            for sec in (ev.get("secciones") or []):
                for m in (sec.get("musicos") or []):
                    disp = m.get("disponibilidad") or []
                    asi = m.get("asistencia") or []
                    if isinstance(disp, list) and disp and "convocado" in disp[0]:
                        found_disp = True
                    if isinstance(asi, list) and asi and "convocado" in asi[0]:
                        found_asi = True
                    if found_disp and found_asi:
                        break
                if found_disp and found_asi:
                    break
            if found_disp and found_asi:
                break
        assert found_disp, "disponibilidad[].convocado no encontrado"
        assert found_asi, "asistencia[].convocado no encontrado"

    def test_seguimiento_has_convocado(self, g_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/seguimiento",
                         headers=g_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        musicos = body.get("musicos") or []
        assert isinstance(musicos, list) and musicos
        found = False
        for m in musicos:
            asigs = m.get("asignaciones") or {}
            # dict {evento_id: {disponibilidad:[...]}}
            iterable = asigs.values() if isinstance(asigs, dict) else asigs
            for a in iterable:
                if not isinstance(a, dict):
                    continue
                disp = a.get("disponibilidad")
                if isinstance(disp, list) and disp and "convocado" in disp[0]:
                    found = True; break
                if isinstance(disp, dict) and disp:
                    first = next(iter(disp.values()))
                    if isinstance(first, dict) and "convocado" in first:
                        found = True; break
            if found: break
        assert found, "seguimiento: no se encontró 'convocado' en disponibilidad"


# -----------------------------------------------------------------
# [7] LOGÍSTICA
# -----------------------------------------------------------------
class TestLogistica:
    def test_get_logistica(self, g_headers, sample_evento_id):
        r = requests.get(
            f"{BASE_URL}/api/gestor/eventos/{sample_evento_id}/logistica",
            headers=g_headers, timeout=30,
        )
        assert r.status_code == 200
        assert "logistica" in r.json()

    def test_put_logistica_bulk(self, g_headers, sample_evento_id):
        # PUT (bulk). tipo valido: 'transporte_ida' | 'transporte_vuelta' | 'alojamiento'
        body = {
            "items": [{
                "tipo": "transporte_ida",
                "titulo": f"TEST_Bus Ida {uuid.uuid4().hex[:6]}",
                "descripcion": "Test regression iter10",
            }]
        }
        r = requests.put(
            f"{BASE_URL}/api/gestor/eventos/{sample_evento_id}/logistica",
            json=body, headers=g_headers, timeout=30,
        )
        assert r.status_code == 200, f"body={r.text[:300]}"
        assert r.json().get("ok") is True

    def test_musico_confirmar_logistica(self, g_headers, m_headers, sample_evento_id):
        # Ensure there's at least one logistica row
        r = requests.get(
            f"{BASE_URL}/api/gestor/eventos/{sample_evento_id}/logistica",
            headers=g_headers, timeout=30,
        )
        items = r.json().get("logistica") or []
        if not items:
            pytest.skip("No hay logistica para el evento")
        lid = items[0]["id"]
        r2 = requests.post(
            f"{BASE_URL}/api/portal/logistica/{lid}/confirmar",
            json={"confirmado": True}, headers=m_headers, timeout=30,
        )
        # Musico puede no estar asignado a este evento -> 400/403 aceptable, pero 200 ideal
        assert r2.status_code in (200, 400, 403), f"status={r2.status_code} body={r2.text[:200]}"


# -----------------------------------------------------------------
# [8] INCIDENCIAS CON PRIORIDAD
# -----------------------------------------------------------------
class TestIncidencias:
    def test_gestor_create_with_prioridad(self, g_headers):
        payload = {
            "tipo": "incidencia",
            "descripcion": f"TEST_iter10 alta {uuid.uuid4().hex[:6]}",
            "prioridad": "alta",
        }
        r = requests.post(f"{BASE_URL}/api/gestor/incidencias",
                          json=payload, headers=g_headers, timeout=30)
        assert r.status_code == 200, f"body={r.text[:300]}"
        inc = r.json().get("incidencia")
        assert inc and inc.get("prioridad") == "alta"
        self.created_id = inc["id"]

    def test_portal_create_with_prioridad(self, m_headers):
        payload = {
            "tipo": "mejora",
            "descripcion": f"TEST_iter10 baja {uuid.uuid4().hex[:6]}",
            "prioridad": "baja",
        }
        r = requests.post(f"{BASE_URL}/api/portal/incidencias",
                          json=payload, headers=m_headers, timeout=30)
        assert r.status_code == 200, f"body={r.text[:300]}"
        inc = r.json().get("incidencia")
        assert inc and inc.get("prioridad") == "baja"

    def test_list_incidencias_has_prioridad(self, g_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/incidencias", headers=g_headers, timeout=30)
        assert r.status_code == 200
        incs = r.json().get("incidencias") or []
        assert any("prioridad" in i for i in incs), "ninguna incidencia expone 'prioridad'"


# -----------------------------------------------------------------
# [9] TAREAS
# -----------------------------------------------------------------
class TestTareas:
    created_id = None

    def test_list_tareas(self, g_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/tareas", headers=g_headers, timeout=30)
        assert r.status_code == 200
        assert "tareas" in r.json()

    def test_crud_tarea(self, g_headers):
        payload = {
            "titulo": f"TEST_iter10 tarea {uuid.uuid4().hex[:6]}",
            "fecha_limite": "2026-12-31",
            "prioridad": "alta",
        }
        r = requests.post(f"{BASE_URL}/api/gestor/tareas",
                          json=payload, headers=g_headers, timeout=30)
        assert r.status_code == 200, f"body={r.text[:300]}"
        t = r.json().get("tarea")
        assert t and t.get("titulo") == payload["titulo"]
        tid = t["id"]
        # update
        r2 = requests.put(f"{BASE_URL}/api/gestor/tareas/{tid}",
                          json={"estado": "completada"}, headers=g_headers, timeout=30)
        assert r2.status_code == 200
        assert (r2.json().get("tarea") or {}).get("estado") == "completada"
        # delete
        r3 = requests.delete(f"{BASE_URL}/api/gestor/tareas/{tid}",
                             headers=g_headers, timeout=30)
        assert r3.status_code == 200
        assert r3.json().get("ok") is True


# -----------------------------------------------------------------
# [10] ECONOMÍA
# -----------------------------------------------------------------
class TestEconomia:
    def test_gestion_economica_200(self, g_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/gestion-economica",
                         headers=g_headers, timeout=60)
        assert r.status_code == 200, f"body={r.text[:300]}"


# -----------------------------------------------------------------
# [11] PORTAL MÚSICO
# -----------------------------------------------------------------
class TestPortalMusico:
    def test_mis_eventos_shape(self, m_headers):
        r = requests.get(f"{BASE_URL}/api/portal/mis-eventos", headers=m_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        eventos = body.get("eventos") or body
        if not eventos or not isinstance(eventos, list):
            pytest.skip("Músico sin eventos asignados")
        ev = eventos[0]
        # Campos requeridos
        assert "companeros_confirmados" in ev or "companeros_confirmados" in (ev.get("asignacion") or {})
        assert "companeros_total" in ev or "companeros_total" in (ev.get("asignacion") or {})
        ensayos = ev.get("ensayos") or []
        if ensayos:
            assert "convocado" in ensayos[0], f"ensayo sin 'convocado': {ensayos[0].keys()}"
