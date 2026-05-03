"""Iter F2 — Transporte de Material multi-operación + Listas favoritas.

Endpoints nuevos:
- GET  /api/gestor/transporte-material/{evento_id}/operaciones → {cabecera, operaciones:[{...,items:[]}]}
- PUT  /api/gestor/transporte-material/{evento_id}/cabecera   → solo cabecera (sin tocar legacy)
- POST /api/gestor/transporte-material/{evento_id}/operaciones → crea op + items
- PUT  /api/gestor/transporte-material/operaciones/{op_id}    → REPLACE de items
- DELETE /api/gestor/transporte-material/operaciones/{op_id}  → cascada items
- GET/POST/PUT /api/gestor/listas-material-favoritas[/{id}]   → globales
- DELETE /api/gestor/listas-material-favoritas/{id}           → solo super admin (403 gestor normal)

Regresión legacy:
- GET/PUT /api/gestor/transporte-material/{evento_id} (sin /operaciones, sin /cabecera) sigue OK.

Cleanup: borra todas las operaciones y listas favoritas creadas por el test.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    try:
        with open('/app/frontend/.env') as _f:
            for _line in _f:
                if _line.startswith('REACT_APP_BACKEND_URL='):
                    BASE_URL = _line.split('=', 1)[1].strip().rstrip('/')
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL no definido"

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASSWORD = "Admin123!"
GESTOR_EMAIL = "palvarez@netmetrix.es"
GESTOR_PASSWORD = "Opus2026!"

EVENTO_ID = "c4409142-8ca9-4a98-8c59-e9bd88b5d529"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login {email}: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token") or (data.get("session") or {}).get("access_token")
    assert token
    return token


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN_EMAIL, ADMIN_PASSWORD)}",
            "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def gestor_headers():
    return {"Authorization": f"Bearer {_login(GESTOR_EMAIL, GESTOR_PASSWORD)}",
            "Content-Type": "application/json"}


# IDs creados durante el test, para cleanup
_created_ops = []
_created_listas = []


@pytest.fixture(scope="module", autouse=True)
def cleanup_after(admin_headers):
    yield
    # Borrar ops
    for op_id in _created_ops:
        try:
            requests.delete(f"{BASE_URL}/api/gestor/transporte-material/operaciones/{op_id}",
                            headers=admin_headers, timeout=15)
        except Exception:
            pass
    # Borrar listas favoritas
    for lid in _created_listas:
        try:
            requests.delete(f"{BASE_URL}/api/gestor/listas-material-favoritas/{lid}",
                            headers=admin_headers, timeout=15)
        except Exception:
            pass


# ============== T1: GET /operaciones estructura =====================
class TestGetOperaciones:
    def test_get_operaciones_estructura(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
                         headers=gestor_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "cabecera" in data
        assert "operaciones" in data
        assert isinstance(data["operaciones"], list)
        # Cada operación debe tener items (lista)
        for op in data["operaciones"]:
            assert "items" in op
            assert isinstance(op["items"], list)
            assert "tipo" in op
            assert op["tipo"] in (
                'carga_origen', 'descarga_destino', 'carga_destino',
                'descarga_origen', 'otro'
            )


# ============== T2: PUT /cabecera =====================
class TestPutCabecera:
    def test_put_cabecera_solo_actualiza_cabecera(self, gestor_headers):
        # Actualizar campos cabecera
        body = {
            "empresa": "TEST_F2 Transportes",
            "contacto_empresa": "TEST_F2 Contacto",
            "telefono_empresa": "+34999000111",
            "presupuesto_euros": 250.50,
            "estado": "pendiente",
            "notas": "TEST_F2 notas cabecera",
        }
        r = requests.put(f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/cabecera",
                         json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Verificar via GET /operaciones
        r2 = requests.get(f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
                          headers=gestor_headers, timeout=20)
        assert r2.status_code == 200
        cab = r2.json()["cabecera"]
        assert cab is not None
        assert cab["empresa"] == "TEST_F2 Transportes"
        assert cab["contacto_empresa"] == "TEST_F2 Contacto"
        assert cab["telefono_empresa"] == "+34999000111"
        assert float(cab["presupuesto_euros"]) == 250.50
        assert cab["estado"] == "pendiente"
        assert cab["notas"] == "TEST_F2 notas cabecera"


# ============== T3: POST /operaciones ==============
class TestPostOperacion:
    def test_post_operacion_con_items(self, gestor_headers):
        body = {
            "tipo": "carga_origen",
            "orden": 1,
            "fecha": "2026-03-15",
            "hora": "09:30:00",
            "direccion": "TEST_F2 C/ Origen 1, Madrid",
            "notas": "TEST_F2 carga inicial",
            "items": [
                {"nombre_manual": "TEST_F2 Atril 1", "cantidad": 5, "notas": "negros"},
                {"nombre_manual": "TEST_F2 Silla 1", "cantidad": 12, "notas": None},
            ],
        }
        r = requests.post(
            f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
            json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert "operacion_id" in d
        op_id = d["operacion_id"]
        _created_ops.append(op_id)

        # Verificar persistencia
        r2 = requests.get(f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
                          headers=gestor_headers, timeout=20)
        assert r2.status_code == 200
        ops = r2.json()["operaciones"]
        op = next((o for o in ops if o["id"] == op_id), None)
        assert op is not None, "operación creada no encontrada"
        assert op["tipo"] == "carga_origen"
        assert op["direccion"] == "TEST_F2 C/ Origen 1, Madrid"
        assert len(op["items"]) == 2
        nombres = sorted([it["nombre_manual"] for it in op["items"]])
        assert nombres == ["TEST_F2 Atril 1", "TEST_F2 Silla 1"]

    def test_post_tipo_invalido_422(self, gestor_headers):
        body = {"tipo": "tipo_invalido_xx", "items": []}
        r = requests.post(
            f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
            json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 422, f"esperado 422, got {r.status_code}: {r.text[:200]}"

    def test_post_carga_origen_acepta_items_repetidos(self, gestor_headers):
        # carga_origen con mismo nombre repetido
        body = {
            "tipo": "carga_origen",
            "orden": 99,
            "items": [
                {"nombre_manual": "TEST_F2 ItemRep", "cantidad": 1},
                {"nombre_manual": "TEST_F2 ItemRep", "cantidad": 1},
                {"nombre_manual": "TEST_F2 ItemRep", "cantidad": 1},
            ],
        }
        r = requests.post(
            f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
            json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 200, r.text
        op_id = r.json()["operacion_id"]
        _created_ops.append(op_id)

        r2 = requests.get(f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
                          headers=gestor_headers, timeout=20)
        ops = r2.json()["operaciones"]
        op = next((o for o in ops if o["id"] == op_id), None)
        assert op is not None
        repetidos = [it for it in op["items"] if it.get("nombre_manual") == "TEST_F2 ItemRep"]
        assert len(repetidos) == 3


# ============== T4: PUT /operaciones/{id} REPLACE ==============
class TestPutOperacion:
    def test_put_operacion_replace_items(self, gestor_headers):
        # Crear primero
        body_post = {"tipo": "descarga_destino", "orden": 2, "items": [
            {"nombre_manual": "TEST_F2 PrevA", "cantidad": 1},
            {"nombre_manual": "TEST_F2 PrevB", "cantidad": 1},
        ]}
        r = requests.post(
            f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
            json=body_post, headers=gestor_headers, timeout=20)
        assert r.status_code == 200
        op_id = r.json()["operacion_id"]
        _created_ops.append(op_id)

        # PUT con items nuevos (deben reemplazar a los anteriores)
        body_put = {"tipo": "descarga_destino", "orden": 5,
                    "fecha": "2026-04-01", "hora": "18:00:00",
                    "direccion": "TEST_F2 Auditorio",
                    "notas": "TEST_F2 actualizada",
                    "items": [
                        {"nombre_manual": "TEST_F2 NuevoX", "cantidad": 7},
                    ]}
        r2 = requests.put(
            f"{BASE_URL}/api/gestor/transporte-material/operaciones/{op_id}",
            json=body_put, headers=gestor_headers, timeout=20)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("ok") is True

        # Verify
        r3 = requests.get(f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
                          headers=gestor_headers, timeout=20)
        op = next((o for o in r3.json()["operaciones"] if o["id"] == op_id), None)
        assert op is not None
        assert op["orden"] == 5
        assert op["direccion"] == "TEST_F2 Auditorio"
        assert len(op["items"]) == 1
        assert op["items"][0]["nombre_manual"] == "TEST_F2 NuevoX"
        assert op["items"][0]["cantidad"] == 7

    def test_put_operacion_404(self, gestor_headers):
        body = {"tipo": "otro", "items": []}
        r = requests.put(
            f"{BASE_URL}/api/gestor/transporte-material/operaciones/00000000-0000-0000-0000-000000000000",
            json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 404


# ============== T5: DELETE /operaciones/{id} ==============
class TestDeleteOperacion:
    def test_delete_operacion_con_items(self, gestor_headers):
        body = {"tipo": "otro", "orden": 0,
                "items": [{"nombre_manual": "TEST_F2 ToDelete", "cantidad": 1}]}
        r = requests.post(
            f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
            json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 200
        op_id = r.json()["operacion_id"]

        rd = requests.delete(
            f"{BASE_URL}/api/gestor/transporte-material/operaciones/{op_id}",
            headers=gestor_headers, timeout=20)
        assert rd.status_code == 200
        assert rd.json().get("ok") is True

        # Verify removed
        r2 = requests.get(f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
                          headers=gestor_headers, timeout=20)
        ops_ids = [o["id"] for o in r2.json()["operaciones"]]
        assert op_id not in ops_ids

    def test_delete_operacion_404(self, gestor_headers):
        rd = requests.delete(
            f"{BASE_URL}/api/gestor/transporte-material/operaciones/00000000-0000-0000-0000-000000000000",
            headers=gestor_headers, timeout=20)
        assert rd.status_code == 404


# ============== T6: 5 tipos válidos ==============
class TestTiposValidos:
    @pytest.mark.parametrize("tipo", [
        'carga_origen', 'descarga_destino', 'carga_destino', 'descarga_origen', 'otro'
    ])
    def test_tipo_valido(self, gestor_headers, tipo):
        body = {"tipo": tipo, "orden": 0, "items": []}
        r = requests.post(
            f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}/operaciones",
            json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 200, f"tipo={tipo}: {r.text[:200]}"
        op_id = r.json()["operacion_id"]
        _created_ops.append(op_id)


# ============== T7: Listas Favoritas CRUD ==============
class TestListasFavoritas:
    def test_get_listas_orden_nombre(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/listas-material-favoritas",
                         headers=gestor_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "listas" in data
        assert isinstance(data["listas"], list)
        # Verificar orden por nombre
        nombres = [l["nombre"] for l in data["listas"]]
        assert nombres == sorted(nombres, key=lambda x: (x or '').lower()) or nombres == sorted(nombres)

    def test_post_lista_creado_por_auto(self, gestor_headers):
        body = {
            "nombre": "TEST_F2 Mi Lista Favorita",
            "descripcion": "TEST_F2 desc",
            "items": [
                {"nombre_manual": "TEST_F2 Atril fav", "cantidad": 4, "orden": 0},
                {"nombre_manual": "TEST_F2 Banqueta fav", "cantidad": 2, "orden": 1},
            ],
        }
        r = requests.post(f"{BASE_URL}/api/gestor/listas-material-favoritas",
                          json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 200, r.text
        lista = r.json()["lista"]
        assert lista is not None
        assert lista["nombre"] == "TEST_F2 Mi Lista Favorita"
        assert lista.get("creado_por") is not None
        assert lista.get("creado_por_nombre")  # nombre auto
        assert isinstance(lista.get("items"), list)
        assert len(lista["items"]) == 2
        _created_listas.append(lista["id"])

    def test_put_lista_actualiza(self, gestor_headers):
        # Crear y luego actualizar
        body = {"nombre": "TEST_F2 ListaUpdate", "descripcion": "v1",
                "items": [{"nombre_manual": "TEST_F2 X", "cantidad": 1}]}
        r = requests.post(f"{BASE_URL}/api/gestor/listas-material-favoritas",
                          json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 200
        lid = r.json()["lista"]["id"]
        _created_listas.append(lid)

        upd = {"nombre": "TEST_F2 ListaUpdate v2", "descripcion": "v2_actualizada",
               "items": [
                   {"nombre_manual": "TEST_F2 Y", "cantidad": 3},
                   {"nombre_manual": "TEST_F2 Z", "cantidad": 5},
               ]}
        r2 = requests.put(f"{BASE_URL}/api/gestor/listas-material-favoritas/{lid}",
                          json=upd, headers=gestor_headers, timeout=20)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("ok") is True

        # GET y verificar
        r3 = requests.get(f"{BASE_URL}/api/gestor/listas-material-favoritas",
                          headers=gestor_headers, timeout=20)
        lst = next((l for l in r3.json()["listas"] if l["id"] == lid), None)
        assert lst is not None
        assert lst["nombre"] == "TEST_F2 ListaUpdate v2"
        assert lst["descripcion"] == "v2_actualizada"
        assert len(lst["items"]) == 2

    def test_delete_403_gestor_normal(self, gestor_headers):
        # Crear con admin
        body = {"nombre": "TEST_F2 ListaParaBorrar", "items": []}
        # Crearla con gestor está bien, igual cualquiera puede crear
        r = requests.post(f"{BASE_URL}/api/gestor/listas-material-favoritas",
                          json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 200
        lid = r.json()["lista"]["id"]
        _created_listas.append(lid)  # cleanup como admin

        # Intentar borrar como gestor normal → 403
        rd = requests.delete(f"{BASE_URL}/api/gestor/listas-material-favoritas/{lid}",
                             headers=gestor_headers, timeout=20)
        assert rd.status_code == 403, f"esperado 403, got {rd.status_code}: {rd.text[:200]}"
        msg = (rd.json().get("detail") or "").lower()
        assert "director general" in msg or "administradores" in msg

    def test_delete_admin_ok(self, admin_headers, gestor_headers):
        body = {"nombre": "TEST_F2 AdminBorra", "items": []}
        r = requests.post(f"{BASE_URL}/api/gestor/listas-material-favoritas",
                          json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 200
        lid = r.json()["lista"]["id"]

        rd = requests.delete(f"{BASE_URL}/api/gestor/listas-material-favoritas/{lid}",
                             headers=admin_headers, timeout=20)
        assert rd.status_code == 200, rd.text
        assert rd.json().get("ok") is True

        # Verificar que desapareció
        r2 = requests.get(f"{BASE_URL}/api/gestor/listas-material-favoritas",
                          headers=gestor_headers, timeout=20)
        ids = [l["id"] for l in r2.json()["listas"]]
        assert lid not in ids


# ============== T8: REGRESIÓN legacy GET/PUT ==============
class TestRegresionLegacy:
    def test_get_legacy_transporte_material(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}",
                         headers=gestor_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "transporte" in data
        # No es estructura {cabecera, operaciones}
        assert "operaciones" not in data
        assert "cabecera" not in data

    def test_put_legacy_transporte_material(self, gestor_headers):
        # PUT con campos planos (legacy TransporteMaterialIn)
        body = {
            "empresa": "TEST_F2_LEGACY Empresa",
            "contacto_empresa": "TEST_F2_LEGACY Contacto",
            "telefono_empresa": "+34111222333",
            "estado": "pendiente",
            "notas": "TEST_F2_LEGACY",
        }
        r = requests.put(f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}",
                         json=body, headers=gestor_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "transporte" in d
        assert d.get("action") in ("created", "updated")

        # GET legacy debe reflejar
        r2 = requests.get(f"{BASE_URL}/api/gestor/transporte-material/{EVENTO_ID}",
                          headers=gestor_headers, timeout=20)
        t = r2.json()["transporte"]
        assert t["empresa"] == "TEST_F2_LEGACY Empresa"
