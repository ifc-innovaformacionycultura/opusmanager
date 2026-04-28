"""Iteration 14 — Backend regression for final massive iteration.

Covers:
- Login director_general
- GET /api/gestor/eventos/{id}/verificaciones-historial: super-admin 200, gestor 403
- GET /api/gestor/dashboard/resumen: KPIs + listas
- Reset verificaciones cuando estado abierto -> borrador
- POST /api/gestor/montaje/{id}/generar?ensayo_id=... acepta query param
- Regresión: 10 informes A-J
"""
import os
import time
import pytest
import requests

def _read_env_url():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env_url() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
API = f"{BASE_URL}/api"

DG_EMAIL = "jalonso@p.csmb.es"
DG_PASS = "Director2026!"
ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASS = "Admin123!"
GESTOR_EMAIL = "palvarez@netmetrix.es"
GESTOR_PASS = "Opus2026!"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text[:200]}")
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token for {email}: {r.json()}"
    return tok


@pytest.fixture(scope="session")
def dg_token():
    return _login(DG_EMAIL, DG_PASS)


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def gestor_token():
    return _login(GESTOR_EMAIL, GESTOR_PASS)


@pytest.fixture(scope="session")
def evento_id(admin_token):
    r = requests.get(f"{API}/gestor/eventos", headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    assert r.status_code == 200, r.text[:200]
    data = r.json()
    eventos = data if isinstance(data, list) else data.get("eventos", [])
    assert eventos, "No eventos in DB"
    return eventos[0]["id"]


# ============== Auth ==============
class TestAuth:
    def test_login_director_general(self):
        r = requests.post(f"{API}/auth/login", json={"email": DG_EMAIL, "password": DG_PASS}, timeout=20)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("access_token") or body.get("token")
        # rol & requiere_cambio_password
        usr = body.get("user") or body.get("usuario") or body.get("profile") or {}
        # No assertion forzada de rol pq estructura puede variar — sólo log
        print("DG login user keys:", list(usr.keys()) if isinstance(usr, dict) else type(usr))


# ============== Verificaciones Historial ==============
class TestVerificacionesHistorial:
    def test_historial_dg_200(self, dg_token, evento_id):
        r = requests.get(
            f"{API}/gestor/eventos/{evento_id}/verificaciones-historial",
            headers={"Authorization": f"Bearer {dg_token}"}, timeout=20)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert "historial" in body
        assert "total" in body
        assert isinstance(body["historial"], list)
        # Verificar DESC si hay >=2
        h = body["historial"]
        if len(h) >= 2:
            ts = [x.get("verificado_at") or "" for x in h]
            assert ts == sorted(ts, reverse=True), f"No DESC: {ts}"

    def test_historial_admin_200(self, admin_token, evento_id):
        r = requests.get(
            f"{API}/gestor/eventos/{evento_id}/verificaciones-historial",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200

    def test_historial_gestor_regular_403(self, gestor_token, evento_id):
        r = requests.get(
            f"{API}/gestor/eventos/{evento_id}/verificaciones-historial",
            headers={"Authorization": f"Bearer {gestor_token}"}, timeout=20)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text[:200]}"


# ============== Dashboard ==============
class TestDashboardResumen:
    def test_dashboard_admin_estructura(self, admin_token):
        r = requests.get(f"{API}/gestor/dashboard/resumen",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        b = r.json()
        for k in ("kpis", "proximos_15_dias", "pendientes_equipo", "pendientes_verificacion"):
            assert k in b, f"Falta key {k}"
        kpis = b["kpis"]
        for k in ("verificaciones_pendientes", "comentarios_pendientes", "tareas_proximas", "eventos_proximos"):
            assert k in kpis, f"Falta KPI {k}"
            assert isinstance(kpis[k], int)

    def test_dashboard_dg_200(self, dg_token):
        r = requests.get(f"{API}/gestor/dashboard/resumen",
                         headers={"Authorization": f"Bearer {dg_token}"}, timeout=30)
        assert r.status_code == 200

    def test_dashboard_gestor_regular_200(self, gestor_token):
        r = requests.get(f"{API}/gestor/dashboard/resumen",
                         headers={"Authorization": f"Bearer {gestor_token}"}, timeout=30)
        assert r.status_code == 200


# ============== Reset verificaciones (abierto -> borrador) ==============
class TestResetVerificaciones:
    def test_reset_al_pasar_abierto_a_borrador(self, admin_token, evento_id):
        H = {"Authorization": f"Bearer {admin_token}"}
        # 1. Obtener estado actual del evento
        r = requests.get(f"{API}/gestor/eventos/{evento_id}", headers=H, timeout=20)
        assert r.status_code == 200
        ev = r.json().get("evento") or r.json()
        estado_inicial = ev.get("estado")

        # 2. Forzar evento a 'abierto'
        rput = requests.put(f"{API}/gestor/eventos/{evento_id}",
                            headers=H, json={"estado": "abierto"}, timeout=20)
        assert rput.status_code == 200, rput.text[:300]

        # 3. Crear una verificación en estado 'verificado'
        rv = requests.put(f"{API}/gestor/eventos/{evento_id}/verificaciones/datos_generales",
                          headers=H, json={"estado": "verificado", "notas": "test reset"}, timeout=20)
        assert rv.status_code == 200, rv.text[:300]

        # 4. Confirmar que existe
        rget = requests.get(f"{API}/gestor/eventos/{evento_id}/verificaciones", headers=H, timeout=20)
        assert rget.status_code == 200
        data = rget.json()["verificaciones"]
        dg_sec = next((x for x in data if x["seccion"] == "datos_generales"), None)
        assert dg_sec and dg_sec["estado"] == "verificado"

        # 5. Cambiar evento a 'borrador' -> debe borrar verificaciones
        rput2 = requests.put(f"{API}/gestor/eventos/{evento_id}",
                             headers=H, json={"estado": "borrador"}, timeout=20)
        assert rput2.status_code == 200, rput2.text[:300]

        # 6. Confirmar que la verificación ya no existe (vuelve a 'pendiente' por default)
        time.sleep(0.5)
        rget2 = requests.get(f"{API}/gestor/eventos/{evento_id}/verificaciones", headers=H, timeout=20)
        assert rget2.status_code == 200
        data2 = rget2.json()["verificaciones"]
        dg_sec2 = next((x for x in data2 if x["seccion"] == "datos_generales"), None)
        assert dg_sec2["estado"] == "pendiente", f"Esperado pendiente tras reset, got {dg_sec2}"

        # 7. Restaurar estado original
        if estado_inicial:
            requests.put(f"{API}/gestor/eventos/{evento_id}",
                         headers=H, json={"estado": estado_inicial}, timeout=20)


# ============== Montaje generar con ensayo_id ==============
class TestMontajeGenerar:
    def test_generar_montaje_acepta_ensayo_id_query(self, admin_token, evento_id):
        H = {"Authorization": f"Bearer {admin_token}"}
        # Sin ensayo_id (todo el evento)
        r1 = requests.post(f"{API}/gestor/montaje/{evento_id}/generar", headers=H, timeout=30)
        assert r1.status_code in (200, 201, 400), f"sin ensayo_id: {r1.status_code} {r1.text[:200]}"

        # Buscar ensayos
        re = requests.get(f"{API}/gestor/eventos/{evento_id}/ensayos", headers=H, timeout=20)
        if re.status_code == 200:
            ens = re.json()
            ensayos = ens if isinstance(ens, list) else ens.get("ensayos", [])
            if ensayos:
                eid = ensayos[0]["id"]
                r2 = requests.post(f"{API}/gestor/montaje/{evento_id}/generar?ensayo_id={eid}",
                                   headers=H, timeout=30)
                # No debe ser 422 (param query OK)
                assert r2.status_code != 422, f"422 indica que query param no es aceptado: {r2.text[:300]}"
                assert r2.status_code in (200, 201, 400, 404), r2.text[:200]


# ============== Regresión PDFs A-J ==============
class TestInformesRegresion:
    @pytest.mark.parametrize("tipo", ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"])
    def test_pdf_tipo(self, tipo, admin_token, evento_id):
        H = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(f"{API}/gestor/informes/generar",
                          headers=H, json={"tipo": tipo, "evento_ids": [evento_id]}, timeout=60)
        assert r.status_code == 200, f"tipo {tipo}: {r.status_code} {r.text[:300]}"
        assert r.content[:4] == b"%PDF", f"tipo {tipo} no es PDF"
        assert len(r.content) > 1000, f"tipo {tipo} PDF muy pequeño: {len(r.content)} bytes"
