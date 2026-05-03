"""Iter E2 — Cerrar/Reabrir Económico del evento.

Pre-condición: plantilla concluida (estado_cierre='cerrado_plantilla').
Cleanup: reabrir-economico + reabrir-plantilla, dejar evento en 'abierto'.
"""
import os
import sys
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://contact-conductor.preview.emergentagent.com').rstrip('/')

ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASSWORD = "Admin123!"
GESTOR_EMAIL = "palvarez@netmetrix.es"
GESTOR_PASSWORD = "Opus2026!"

# Evento de pruebas (Concierto de Navidad) — ya tiene historial
EVENTO_ID = "c4409142-8ca9-4a98-8c59-e9bd88b5d529"


def _login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"Login {email}: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token") or (data.get("session") or {}).get("access_token")
    assert token
    return token


@pytest.fixture(scope="module")
def admin_headers():
    t = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def gestor_headers():
    try:
        t = _login(GESTOR_EMAIL, GESTOR_PASSWORD)
    except AssertionError as e:
        pytest.skip(f"Gestor login failed: {e}")
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def _ensure_evento_abierto(admin_headers):
    """Reabre evento si está en cerrado_economico o cerrado_plantilla."""
    # Intento reabrir económico (ignora 4xx)
    requests.post(
        f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/reabrir-economico",
        headers=admin_headers, timeout=20,
    )
    # Intento reabrir plantilla
    requests.post(
        f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/reabrir-plantilla",
        headers=admin_headers, timeout=20,
    )


@pytest.fixture(scope="module", autouse=True)
def cleanup_around(admin_headers):
    """Garantiza estado abierto antes y después del módulo."""
    _ensure_evento_abierto(admin_headers)
    yield
    _ensure_evento_abierto(admin_headers)


# ============================================================
# 1) GET /api/gestor/gestion-economica — schema
# ============================================================
class TestGestionEconomicaSchema:
    def test_get_returns_eventos_with_e2_fields(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/gestor/gestion-economica",
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200, f"GET fallo: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert "eventos" in data
        eventos = data["eventos"]
        if not eventos:
            pytest.skip("Sin eventos en gestion-economica")
        ev = eventos[0]
        # Iter E2 fields
        for f in (
            "estado_cierre",
            "cerrado_plantilla_at",
            "cerrado_plantilla_por_nombre",
            "cerrado_economico_at",
            "cerrado_economico_por_nombre",
            "tiene_historial_cierre",
        ):
            assert f in ev, f"Falta '{f}' en evento {ev.get('id')}"

    def test_eventos_abiertos_aparecen(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/gestor/gestion-economica",
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200
        eventos = r.json().get("eventos", [])
        opens = [e for e in eventos if (e.get("estado_cierre") or "abierto") == "abierto"]
        assert len(opens) >= 1, "Regresión: deben aparecer eventos abiertos"


# ============================================================
# 2) POST cerrar-economico — autorización + pre-condiciones
# ============================================================
class TestCerrarEconomicoAuth:
    def test_gestor_normal_403(self, gestor_headers):
        r = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/cerrar-economico",
            headers=gestor_headers, timeout=20,
        )
        assert r.status_code == 403, f"Esperado 403, got {r.status_code} {r.text[:300]}"
        detail = (r.json().get("detail") or "").lower()
        assert "director general" in detail or "administradores" in detail

    def test_admin_sin_plantilla_concluida_400(self, admin_headers):
        # Garantiza plantilla NO concluida
        _ensure_evento_abierto(admin_headers)
        r = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/cerrar-economico",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 400, f"Esperado 400, got {r.status_code} {r.text[:300]}"
        detail = r.json().get("detail") or ""
        assert detail == "Debes concluir primero la plantilla del evento antes de cerrar el económico.", \
            f"Mensaje exacto incorrecto: {detail!r}"

    def test_404_evento_inexistente(self, admin_headers):
        fake = "00000000-0000-0000-0000-000000000000"
        r = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{fake}/cerrar-economico",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 404


# ============================================================
# 3) Flujo completo concluir → cerrar-economico → bloqueos → reabrir
# ============================================================
class TestFlujoCerrarEconomico:
    def test_full_flow(self, admin_headers, gestor_headers):
        # Estado base: abierto
        _ensure_evento_abierto(admin_headers)

        # 1) Concluir plantilla (pre-condición)
        rc = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/concluir-plantilla",
            headers=admin_headers, timeout=30,
        )
        assert rc.status_code == 200, f"Concluir plantilla falló: {rc.status_code} {rc.text[:300]}"

        # 2) Cerrar económico → 200
        rce = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/cerrar-economico",
            headers=admin_headers, timeout=60,
        )
        assert rce.status_code == 200, f"Cerrar económico falló: {rce.status_code} {rce.text[:300]}"
        d = rce.json()
        assert d.get("ok") is True
        for k in ("actualizadas", "recibos_generados", "cerrado_economico_at", "cerrado_economico_por_nombre"):
            assert k in d, f"Falta '{k}' en respuesta"
        assert d["cerrado_economico_at"]
        assert d["cerrado_economico_por_nombre"]
        # No duplicación: ya había 1 recibo, así que recibos_generados puede ser 0 o más, pero finito
        assert isinstance(d["recibos_generados"], int)
        assert d["recibos_generados"] >= 0

        # 3) GET refleja cerrado_economico
        rg = requests.get(
            f"{BASE_URL}/api/gestor/gestion-economica",
            headers=admin_headers, timeout=30,
        )
        assert rg.status_code == 200
        evs = rg.json().get("eventos", [])
        ev_match = next((e for e in evs if e["id"] == EVENTO_ID), None)
        assert ev_match is not None
        assert ev_match.get("estado_cierre") == "cerrado_economico"
        assert ev_match.get("cerrado_economico_at")
        assert ev_match.get("cerrado_economico_por_nombre")

        # 4) Segunda llamada cerrar → 400 'El económico ya está cerrado.'
        rce2 = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/cerrar-economico",
            headers=admin_headers, timeout=20,
        )
        assert rce2.status_code == 400
        assert (rce2.json().get("detail") or "") == "El económico ya está cerrado."

        # 5) PUT pago bloqueado 403 — necesitamos un asignacion_id del evento
        from_asigs = supa_get_asignaciones(EVENTO_ID, admin_headers)
        if from_asigs:
            asig_id = from_asigs[0]
            rp = requests.put(
                f"{BASE_URL}/api/gestor/asignaciones/{asig_id}/pago",
                json={"estado_pago": "pagado"},
                headers=admin_headers, timeout=20,
            )
            assert rp.status_code == 403, f"PUT pago debería ser 403, got {rp.status_code} {rp.text[:300]}"
            det = (rp.json().get("detail") or "").lower()
            assert "no se permiten cambios" in det and "cerrado" in det

        # 6) POST pagos-bulk bloqueado 403
        rb = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/pagos-bulk",
            json={"estado_pago": "pagado"},
            headers=admin_headers, timeout=20,
        )
        assert rb.status_code == 403, f"Bulk debería ser 403, got {rb.status_code} {rb.text[:300]}"
        det = (rb.json().get("detail") or "").lower()
        assert "no se permiten cambios" in det and "cerrado" in det

        # 7) Gestor normal NO puede reabrir
        rr_g = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/reabrir-economico",
            headers=gestor_headers, timeout=20,
        )
        assert rr_g.status_code == 403
        det = (rr_g.json().get("detail") or "").lower()
        assert "director general" in det or "administradores" in det

        # 8) Admin reabre → 200 → estado='cerrado_plantilla'
        rr = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/reabrir-economico",
            headers=admin_headers, timeout=30,
        )
        assert rr.status_code == 200, f"Reabrir económico falló: {rr.status_code} {rr.text[:300]}"
        dr = rr.json()
        assert dr.get("ok") is True

        rg2 = requests.get(
            f"{BASE_URL}/api/gestor/gestion-economica",
            headers=admin_headers, timeout=30,
        )
        evs2 = rg2.json().get("eventos", [])
        ev2 = next((e for e in evs2 if e["id"] == EVENTO_ID), None)
        assert ev2 is not None
        assert ev2.get("estado_cierre") == "cerrado_plantilla", \
            f"Tras reabrir económico, estado debe ser 'cerrado_plantilla' (NO 'abierto'), got {ev2.get('estado_cierre')}"
        assert not ev2.get("cerrado_economico_at"), "cerrado_economico_at debe ser None tras reabrir"
        assert not ev2.get("cerrado_economico_por_nombre"), "cerrado_economico_por_nombre debe ser None tras reabrir"

    def test_pagos_bulk_regresion_evento_abierto(self, admin_headers):
        """Regresión: en evento abierto, pagos-bulk responde 200."""
        _ensure_evento_abierto(admin_headers)
        # No cambiar pagos reales — usar 'pendiente' que no genera recibos
        rb = requests.post(
            f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/pagos-bulk",
            json={"estado_pago": "pendiente"},
            headers=admin_headers, timeout=20,
        )
        assert rb.status_code == 200, f"Bulk regresión falló: {rb.status_code} {rb.text[:300]}"
        d = rb.json()
        assert d.get("ok") is True


def supa_get_asignaciones(evento_id, admin_headers):
    """Obtiene IDs de asignaciones del evento vía endpoint."""
    try:
        r = requests.get(
            f"{BASE_URL}/api/gestor/gestion-economica",
            headers=admin_headers, timeout=30,
        )
        evs = r.json().get("eventos", [])
        ev = next((e for e in evs if e["id"] == evento_id), None)
        if not ev:
            return []
        # Las asignaciones suelen estar en 'musicos' o 'asignaciones'
        for key in ("asignaciones", "musicos", "items"):
            if key in ev and ev[key]:
                ids = [x.get("asignacion_id") or x.get("id") for x in ev[key]]
                return [i for i in ids if i]
        return []
    except Exception:
        return []


# ============================================================
# 4) GET historial-cierres — 4 tipos
# ============================================================
class TestHistorialCierres:
    def test_returns_4_tipos(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/gestor/eventos/{EVENTO_ID}/historial-cierres",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200, f"GET historial: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert "evento_id" in data and data["evento_id"] == EVENTO_ID
        assert "entries" in data
        assert isinstance(data["entries"], list)
        # Tras el flujo completo deberíamos tener registros de econ + plantilla
        tipos = {e.get("tipo") for e in data["entries"]}
        # Valida que el endpoint NO filtra fuera ningún tipo Iter E2
        for e in data["entries"]:
            assert e.get("tipo") in {
                "evento_concluido", "evento_reabierto",
                "economico_cerrado", "economico_reabierto",
            }, f"tipo inesperado: {e.get('tipo')}"
        # Tras el flujo deberíamos tener al menos economico_cerrado y economico_reabierto
        assert "economico_cerrado" in tipos or "economico_reabierto" in tipos, \
            f"Esperado al menos un tipo Iter E2 en el historial, got {tipos}"


# ============================================================
# 5) routes_recordatorios.job_cerrar_economico
# ============================================================
class TestJobCerrarEconomico:
    def test_import_and_invoke(self):
        sys.path.insert(0, "/app/backend")
        try:
            from dotenv import load_dotenv
            load_dotenv("/app/backend/.env")
        except Exception:
            pass
        try:
            from routes_recordatorios import job_cerrar_economico
        except Exception as e:
            pytest.fail(f"No se puede importar job_cerrar_economico: {e}")
        result = job_cerrar_economico()
        assert isinstance(result, dict)
        assert result.get("job") == "cerrar_economico"
        for k in ("enviados", "revisados", "dias_antes"):
            assert k in result, f"Falta '{k}' en resultado del job"
        assert isinstance(result["enviados"], int)
        assert isinstance(result["revisados"], int)
        assert isinstance(result["dias_antes"], int)
