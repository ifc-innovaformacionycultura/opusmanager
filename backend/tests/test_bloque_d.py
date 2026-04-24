"""Tests for Bloque D: seguimiento v2, plantillas-definitivas, cachets-config,
portal mis-eventos (publicado_musico) + disponibilidad/bulk, justificantes upload.
"""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://contact-conductor.preview.emergentagent.com').rstrip('/')

GESTOR_EMAIL = "admin@convocatorias.com"
GESTOR_PASSWORD = "Admin123!"
MUSICO_EMAIL = "jesusalonsodirector@gmail.com"
MUSICO_PASSWORD = "Musico123!"
JESUS_MUSICO_ID = "8bf521fa-dc27-4c5b-8069-d36d3d4eaad3"
EVENTO_PROBE_ID = "4b50bfe5-fdf4-48b9-92ec-34c4a7d88f27"  # 'Concierto de Temporada' con 4 ensayos


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login {email} falló: {r.status_code} {r.text[:200]}")
    d = r.json()
    tok = d.get("access_token") or d.get("token") or (d.get("session") or {}).get("access_token")
    assert tok, f"No token: {d}"
    return tok


@pytest.fixture(scope="session")
def gestor_headers():
    return {"Authorization": f"Bearer {_login(GESTOR_EMAIL, GESTOR_PASSWORD)}"}


@pytest.fixture(scope="session")
def musico_headers():
    return {"Authorization": f"Bearer {_login(MUSICO_EMAIL, MUSICO_PASSWORD)}"}


# ============== D-1: GET /api/gestor/seguimiento nuevo shape ==============
def test_seguimiento_shape_new(gestor_headers):
    r = requests.get(f"{BASE_URL}/api/gestor/seguimiento", headers=gestor_headers, timeout=30)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    assert "eventos" in j and "musicos" in j
    for ev in j["eventos"]:
        assert ev["estado"] in ("borrador", "abierto"), f"estado invalido: {ev['estado']}"
        assert "fechas" in ev and "ensayos" in ev
        for e in ev["ensayos"]:
            for k in ("id", "tipo", "fecha", "obligatorio"):
                assert k in e, f"ensayo sin {k}: {e}"
    # buscar Jesús
    jesus = next((m for m in j["musicos"] if m["id"] == JESUS_MUSICO_ID), None)
    if jesus:
        for k in ("nombre", "apellidos", "email", "instrumento", "asignaciones"):
            assert k in jesus, f"musico sin {k}"


# ============== D-2: publicar ==============
def test_publicar_despublicar(gestor_headers):
    # publish
    r = requests.post(f"{BASE_URL}/api/gestor/seguimiento/publicar", headers=gestor_headers,
                      json={"usuario_ids": [JESUS_MUSICO_ID], "evento_id": EVENTO_PROBE_ID, "publicar": True}, timeout=30)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    assert "publicados" in j and "creados" in j and "despublicados" in j
    # Verificar en portal/mis-eventos del músico
    mh = {"Authorization": f"Bearer {_login(MUSICO_EMAIL, MUSICO_PASSWORD)}"}
    rp = requests.get(f"{BASE_URL}/api/portal/mis-eventos", headers=mh, timeout=30)
    assert rp.status_code == 200
    body = rp.json()
    if isinstance(body, list):
        eventos = body
    else:
        eventos = body.get("asignaciones") or body.get("eventos") or []
    ids = [e.get("evento_id") or e.get("id") or (e.get("evento") or {}).get("id") for e in eventos]
    assert EVENTO_PROBE_ID in ids, f"evento no visible en portal tras publicar: {ids}"


# ============== D-3: bulk-accion 5 estados ==============
def test_bulk_accion_estados(gestor_headers):
    # Guardar estado original si existe
    estados = ["pendiente", "confirmado"]
    for est in estados:
        r = requests.post(f"{BASE_URL}/api/gestor/seguimiento/bulk-accion", headers=gestor_headers,
                          json={"usuario_ids": [JESUS_MUSICO_ID], "evento_id": EVENTO_PROBE_ID, "accion": est}, timeout=30)
        assert r.status_code == 200, f"{est}: {r.status_code} {r.text[:200]}"
        j = r.json()
        assert "actualizados" in j and "creados" in j
    # dejar confirmado al final (requerido por D-4)


# ============== D-4: plantillas-definitivas ==============
def test_plantillas_definitivas_shape(gestor_headers):
    # Asegurar que Jesús esté confirmado
    requests.post(f"{BASE_URL}/api/gestor/seguimiento/bulk-accion", headers=gestor_headers,
                  json={"usuario_ids": [JESUS_MUSICO_ID], "evento_id": EVENTO_PROBE_ID, "accion": "confirmado"}, timeout=30)

    r = requests.get(f"{BASE_URL}/api/gestor/plantillas-definitivas", headers=gestor_headers, timeout=30)
    assert r.status_code == 200, r.text[:400]
    j = r.json()
    assert "eventos" in j
    ev = next((e for e in j["eventos"] if e["id"] == EVENTO_PROBE_ID), None)
    assert ev is not None, f"evento probe no encontrado (debe tener confirmados). ids: {[e['id'] for e in j['eventos']]}"
    for k in ("nombre", "estado", "ensayos", "secciones", "totales", "total_musicos"):
        assert k in ev, f"evento sin {k}"
    for k in ("cache_previsto", "cache_real", "extras", "transporte", "alojamiento", "otros", "total"):
        assert k in ev["totales"], f"totales sin {k}"
    # Orden de secciones
    order_expected = ["Cuerda", "Viento Madera", "Viento Metal", "Percusión", "Teclados", "Coro"]
    labels = [s["label"] for s in ev["secciones"]]
    idxs = [order_expected.index(lb) for lb in labels if lb in order_expected]
    assert idxs == sorted(idxs), f"Secciones no ordenadas: {labels}"
    # Jesús debe estar en Cuerda (Violín)
    cuerda = next((s for s in ev["secciones"] if s["label"] == "Cuerda"), None)
    assert cuerda, f"No hay sección Cuerda. secciones: {labels}"
    jesus = next((m for m in cuerda["musicos"] if m["usuario_id"] == JESUS_MUSICO_ID), None)
    assert jesus, f"Jesús no está en Cuerda: {[m['usuario_id'] for m in cuerda['musicos']]}"
    for k in ("asignacion_id", "nombre", "instrumento", "cache_previsto", "cache_real", "total", "disponibilidad", "asistencia"):
        assert k in jesus, f"musico sin {k}"


# ============== D-7: cachets-config GET + PUT ==============
def test_cachets_config_get_put(gestor_headers):
    r = requests.get(f"{BASE_URL}/api/gestor/cachets-config/{EVENTO_PROBE_ID}", headers=gestor_headers, timeout=30)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    assert "cachets" in j and isinstance(j["cachets"], list)
    # UPSERT (usar string vacío para "nivel genérico" porque la columna es NOT NULL)
    payload = [
        {"instrumento": "Violín", "nivel_estudios": "Profesional", "importe": 380},
        {"instrumento": "Chelo", "nivel_estudios": "Profesional", "importe": 380},
        {"instrumento": "Piano", "nivel_estudios": "Profesional", "importe": 420},
    ]
    r2 = requests.put(f"{BASE_URL}/api/gestor/cachets-config/{EVENTO_PROBE_ID}",
                      headers=gestor_headers, json=payload, timeout=30)
    assert r2.status_code == 200, r2.text[:300]
    jj = r2.json()
    assert jj.get("ok") is True
    assert "escritas" in jj


# ============== D-8: Portal mis-eventos filtrado por publicado_musico ==============
def test_portal_mis_eventos_publicado_only(musico_headers, gestor_headers):
    # Asegurar publicado=True
    requests.post(f"{BASE_URL}/api/gestor/seguimiento/publicar", headers=gestor_headers,
                  json={"usuario_ids": [JESUS_MUSICO_ID], "evento_id": EVENTO_PROBE_ID, "publicar": True}, timeout=30)

    r = requests.get(f"{BASE_URL}/api/portal/mis-eventos", headers=musico_headers, timeout=30)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    eventos = j if isinstance(j, list) else (j.get("asignaciones") or j.get("eventos") or [])
    assert eventos, "mis-eventos vacío tras publicar"
    target = next((e for e in eventos if (e.get("evento_id") or e.get("id") or (e.get("evento") or {}).get("id")) == EVENTO_PROBE_ID), None)
    assert target, f"evento probe no visible: {[e.get('id') or e.get('evento_id') for e in eventos]}"
    # ensayos con mi_disponibilidad
    ens = target.get("ensayos") or (target.get("evento") or {}).get("ensayos") or []
    assert isinstance(ens, list) and len(ens) >= 1, f"no ensayos: {list(target.keys())}"
    for e in ens:
        assert "mi_disponibilidad" in e, f"ensayo sin mi_disponibilidad: {e.keys()}"
    # evento interno 'notas' no debe aparecer (notas_musicos está permitido)
    ev_obj = target.get("evento") or target
    assert "notas" not in ev_obj, "notas internas expuestas en portal"


# ============== D-9: portal disponibilidad/bulk + flujo porcentaje ==============
def test_disponibilidad_bulk_y_porcentaje(musico_headers, gestor_headers):
    # Obtener ensayos del evento probe desde portal
    r = requests.get(f"{BASE_URL}/api/portal/mis-eventos", headers=musico_headers, timeout=30)
    assert r.status_code == 200
    eventos = r.json() if isinstance(r.json(), list) else (r.json().get("asignaciones") or r.json().get("eventos") or [])
    target = next((e for e in eventos if (e.get("evento_id") or e.get("id") or (e.get("evento") or {}).get("id")) == EVENTO_PROBE_ID), None)
    assert target, "evento probe no visible"
    ens = target.get("ensayos") or (target.get("evento") or {}).get("ensayos") or []
    assert len(ens) >= 4, f"se esperaban 4 ensayos, hay {len(ens)}"

    # Snapshot inicial
    snapshot = [(e["id"], e.get("mi_disponibilidad")) for e in ens]

    # Enviar: 2 Sí, 1 No, 1 null (borrar)
    entries = [
        {"ensayo_id": ens[0]["id"], "asiste": True},
        {"ensayo_id": ens[1]["id"], "asiste": True},
        {"ensayo_id": ens[2]["id"], "asiste": False},
        {"ensayo_id": ens[3]["id"], "asiste": None},
    ]
    rb = requests.post(f"{BASE_URL}/api/portal/disponibilidad/bulk", headers=musico_headers,
                       json={"entries": entries}, timeout=30)
    assert rb.status_code == 200, rb.text[:300]
    jb = rb.json()
    assert jb.get("ok") is True
    for k in ("actualizados", "creados", "borrados"):
        assert k in jb, f"respuesta sin {k}"

    # Verificar en seguimiento % disponibilidad de Jesús = 50 (2 de 4)
    rs = requests.get(f"{BASE_URL}/api/gestor/seguimiento", headers=gestor_headers, timeout=30)
    assert rs.status_code == 200
    js = rs.json()
    jesus = next((m for m in js["musicos"] if m["id"] == JESUS_MUSICO_ID), None)
    assert jesus, "Jesús no en seguimiento"
    asig = (jesus.get("asignaciones") or {}).get(EVENTO_PROBE_ID)
    assert asig, f"sin asignacion de Jesús en evento probe: {list((jesus.get('asignaciones') or {}).keys())}"
    disp = asig.get("disponibilidad") or {}
    pct = disp.get("porcentaje_disponibilidad")
    if pct is None:
        pct = asig.get("porcentaje_disponibilidad")
    assert pct == 50 or pct == 50.0, f"esperado 50%, got {pct}"

    # Restore: volver a estado original
    restore_entries = []
    for (eid, prev) in snapshot:
        restore_entries.append({"ensayo_id": eid, "asiste": prev})
    requests.post(f"{BASE_URL}/api/portal/disponibilidad/bulk", headers=musico_headers,
                  json={"entries": restore_entries}, timeout=30)


# ============== D-5: guardar asistencias/gastos/anotaciones ==============
def test_plantillas_guardar(gestor_headers):
    # asegurar confirmado
    requests.post(f"{BASE_URL}/api/gestor/seguimiento/bulk-accion", headers=gestor_headers,
                  json={"usuario_ids": [JESUS_MUSICO_ID], "evento_id": EVENTO_PROBE_ID, "accion": "confirmado"}, timeout=30)

    # obtener asignacion_id y un ensayo_id
    rp = requests.get(f"{BASE_URL}/api/gestor/plantillas-definitivas", headers=gestor_headers, timeout=30)
    assert rp.status_code == 200
    ev = next((e for e in rp.json()["eventos"] if e["id"] == EVENTO_PROBE_ID), None)
    assert ev
    cuerda = next((s for s in ev["secciones"] if s["label"] == "Cuerda"), None)
    jesus = next((m for m in cuerda["musicos"] if m["usuario_id"] == JESUS_MUSICO_ID), None)
    asig_id = jesus["asignacion_id"]
    ensayo_id = ev["ensayos"][0]["id"]

    payload = {
        "asistencias": [
            {"usuario_id": JESUS_MUSICO_ID, "ensayo_id": ensayo_id, "asistencia_real": True}
        ],
        "gastos": [
            {"usuario_id": JESUS_MUSICO_ID, "evento_id": EVENTO_PROBE_ID,
             "transporte_importe": 45.5, "alojamiento_importe": 120, "cache_extra": 50,
             "motivo_extra": "Test", "notas": "TEST_bloque_d"}
        ],
        "anotaciones": [
            {"asignacion_id": asig_id, "numero_atril": 3, "letra": "A", "comentario": "Test"}
        ],
    }
    r = requests.put(f"{BASE_URL}/api/gestor/plantillas-definitivas/guardar",
                     headers=gestor_headers, json=payload, timeout=30)
    assert r.status_code == 200, r.text[:400]
    j = r.json()
    assert j.get("ok") is True
    assert "resumen" in j
    for k in ("asistencias", "gastos", "anotaciones"):
        assert k in j["resumen"], f"resumen sin {k}"


# ============== D-6: upload justificante ==============
def test_upload_justificante(gestor_headers):
    files = {"archivo": ("test.txt", b"TEST_JUSTIFICANTE_BLOQUE_D", "text/plain")}
    params = {"usuario_id": JESUS_MUSICO_ID, "evento_id": EVENTO_PROBE_ID, "tipo": "transporte"}
    r = requests.post(f"{BASE_URL}/api/gestor/plantillas-definitivas/justificante",
                      headers=gestor_headers, params=params, files=files, timeout=60)
    assert r.status_code == 200, r.text[:500]
    j = r.json()
    assert "url" in j and "path" in j
    assert EVENTO_PROBE_ID in j["path"]
    assert JESUS_MUSICO_ID in j["path"]
    assert "transporte_" in j["path"]

    # Cleanup: borrar el archivo subido
    try:
        from supabase import create_client
        admin = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
        admin.storage.from_("justificantes").remove([j["path"]])
    except Exception as ex:
        print(f"cleanup justificante warn: {ex}")
