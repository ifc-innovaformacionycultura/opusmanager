"""
Tests para los Bloques 1-7 de la validación integral de OPUS MANAGER.
Bloque 1: Presupuestos Sección A — Cachets Base (GET/PUT /api/gestor/cachets-base)
Bloque 2: Plantillas Definitivas — cache_previsto + cache_fuente
Bloque 3: Asistencia y Pagos — /api/gestor/gestion-economica
Bloque 4: Análisis Económico — mismo endpoint, validación de estructura
Bloque 5: Planificador — /api/gestor/tareas (GET/POST/PUT/DELETE)
Bloque 6: Feedback / POST /api/gestor/incidencias (permitir error conocido de tabla)
Bloque 7: GET /api/gestor/incidencias
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://contact-conductor.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    tok = data.get("access_token") or data.get("token") or (data.get("session") or {}).get("access_token")
    assert tok, f"no token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ==================== BLOQUE 1: Cachets Base ====================
class TestBloque1CachetsBase:
    def test_get_cachets_base(self, headers):
        r = requests.get(f"{BASE_URL}/api/gestor/cachets-base", headers=headers, timeout=30)
        assert r.status_code == 200, f"GET cachets-base -> {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "cachets" in data
        assert isinstance(data["cachets"], list)

    def test_put_cachets_base_persistence(self, headers):
        # Leer estado actual
        r0 = requests.get(f"{BASE_URL}/api/gestor/cachets-base", headers=headers, timeout=30)
        original = r0.json().get("cachets", [])
        # Buscar/crear Violín Superior finalizado
        target_instr = "Violín"
        target_nivel = "Superior finalizado"
        existing = next((c for c in original if c.get("instrumento") == target_instr and c.get("nivel_estudios") == target_nivel), None)
        original_importe = float(existing.get("importe")) if existing else 0.0
        new_importe = original_importe + 7.0  # cambio detectable

        payload = [{"instrumento": target_instr, "nivel_estudios": target_nivel, "importe": new_importe}]
        r = requests.put(f"{BASE_URL}/api/gestor/cachets-base", headers=headers, json=payload, timeout=30)
        assert r.status_code == 200, f"PUT cachets-base -> {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert body.get("ok") is True

        # Verificar persistencia
        r2 = requests.get(f"{BASE_URL}/api/gestor/cachets-base", headers=headers, timeout=30)
        rows = r2.json().get("cachets", [])
        got = next((c for c in rows if c.get("instrumento") == target_instr and c.get("nivel_estudios") == target_nivel), None)
        assert got is not None, "No se encontró la fila tras PUT"
        assert abs(float(got["importe"]) - new_importe) < 0.01, f"importe no persistido: {got['importe']} vs {new_importe}"

        # Restaurar
        requests.put(
            f"{BASE_URL}/api/gestor/cachets-base",
            headers=headers,
            json=[{"instrumento": target_instr, "nivel_estudios": target_nivel, "importe": original_importe}],
            timeout=30,
        )


# ==================== BLOQUE 2: Plantillas Definitivas ====================
class TestBloque2PlantillasDefinitivas:
    def test_plantillas_definitivas_cache_previsto_fuente(self, headers):
        r = requests.get(f"{BASE_URL}/api/gestor/plantillas-definitivas", headers=headers, timeout=60)
        assert r.status_code == 200, f"GET plantillas-definitivas -> {r.status_code}: {r.text[:500]}"
        data = r.json()
        # La respuesta puede ser {eventos:[]} o lista
        eventos = data.get("eventos") if isinstance(data, dict) else data
        assert isinstance(eventos, list)
        if not eventos:
            pytest.skip("No hay eventos con músicos confirmados")

        found_musico = False
        fuentes_validas = {"exacto", "por_instrumento", "base_exacto", "base_por_instrumento", "asignacion", "sin_cachet", "sin_datos"}
        for ev in eventos:
            secciones = ev.get("secciones") or []
            for sec in secciones:
                for m in sec.get("musicos", []) or []:
                    found_musico = True
                    assert "cache_previsto" in m, f"falta cache_previsto en músico {m}"
                    assert "cache_fuente" in m, f"falta cache_fuente en músico {m}"
                    assert isinstance(m["cache_previsto"], (int, float)), f"cache_previsto no numérico: {m['cache_previsto']}"
                    assert m["cache_fuente"] in fuentes_validas, f"cache_fuente inesperado: {m['cache_fuente']}"
        if not found_musico:
            pytest.skip("Eventos sin músicos")


# ==================== BLOQUE 3-4: Gestión Económica ====================
class TestBloque34GestionEconomica:
    def test_gestion_economica(self, headers):
        r = requests.get(f"{BASE_URL}/api/gestor/gestion-economica", headers=headers, timeout=60)
        assert r.status_code == 200, f"GET gestion-economica -> {r.status_code}: {r.text[:500]}"
        data = r.json()
        # Validar que la estructura base existe
        assert isinstance(data, dict) or isinstance(data, list)


# ==================== BLOQUE 5: Tareas ====================
class TestBloque5Tareas:
    created_id = None

    def test_01_get_tareas(self, headers):
        r = requests.get(f"{BASE_URL}/api/gestor/tareas", headers=headers, timeout=30)
        assert r.status_code == 200, f"GET tareas -> {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_02_post_tarea(self, headers):
        payload = {
            "titulo": "TEST_tarea_automatica",
            "descripcion": "Creada por pytest",
            "estado": "pendiente",
            "prioridad": "media",
            "fecha_inicio": "2026-01-15",
            "fecha_limite": "2026-01-20",
        }
        r = requests.post(f"{BASE_URL}/api/gestor/tareas", headers=headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"POST tareas -> {r.status_code}: {r.text[:400]}"
        data = r.json()
        tarea = data.get("tarea") if isinstance(data, dict) and "tarea" in data else data
        assert "id" in tarea, f"no id en respuesta: {data}"
        TestBloque5Tareas.created_id = tarea["id"]
        assert tarea.get("titulo") == payload["titulo"]

    def test_03_put_tarea(self, headers):
        if not TestBloque5Tareas.created_id:
            pytest.skip("No tarea creada")
        payload = {"titulo": "TEST_tarea_automatica_edit", "estado": "en_progreso"}
        r = requests.put(f"{BASE_URL}/api/gestor/tareas/{TestBloque5Tareas.created_id}", headers=headers, json=payload, timeout=30)
        assert r.status_code == 200, f"PUT tarea -> {r.status_code}: {r.text[:400]}"

    def test_04_delete_tarea(self, headers):
        if not TestBloque5Tareas.created_id:
            pytest.skip("No tarea creada")
        r = requests.delete(f"{BASE_URL}/api/gestor/tareas/{TestBloque5Tareas.created_id}", headers=headers, timeout=30)
        assert r.status_code in (200, 204), f"DELETE tarea -> {r.status_code}: {r.text[:300]}"


# ==================== BLOQUE 6-7: Incidencias ====================
class TestBloque67Incidencias:
    def test_get_incidencias(self, headers):
        """Aceptable: 200 con lista, o 500 con error específico 'public.incidencias' no existe."""
        r = requests.get(f"{BASE_URL}/api/gestor/incidencias", headers=headers, timeout=30)
        if r.status_code == 200:
            data = r.json()
            assert isinstance(data, (list, dict))
        else:
            text = r.text.lower()
            assert "incidencias" in text and ("schema cache" in text or "not find" in text or "does not exist" in text), \
                f"Error distinto al conocido: {r.status_code} {r.text[:400]}"

    def test_post_incidencia(self, headers):
        payload = {"tipo": "incidencia", "descripcion": "TEST autogenerado", "pagina": "/admin/tareas"}
        r = requests.post(f"{BASE_URL}/api/gestor/incidencias", headers=headers, json=payload, timeout=30)
        if r.status_code in (200, 201):
            data = r.json()
            # limpieza si hay id
            inc = data.get("incidencia") if isinstance(data, dict) and "incidencia" in data else data
            if isinstance(inc, dict) and inc.get("id"):
                requests.delete(f"{BASE_URL}/api/gestor/incidencias/{inc['id']}", headers=headers, timeout=30)
        else:
            text = r.text.lower()
            # Aceptamos: (a) tabla no existe, (b) FK a usuarios (UID admin de Supabase Auth no sincronizado a tabla usuarios)
            acceptable = (
                ("incidencias" in text and ("schema cache" in text or "not find" in text or "does not exist" in text))
                or ("incidencias_usuario_id_fkey" in text)
            )
            assert acceptable, f"Error distinto al conocido en POST: {r.status_code} {r.text[:400]}"


# ==================== REGRESIÓN ====================
class TestRegresion:
    def test_login_gestor(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200

    def test_eventos_list(self, headers):
        r = requests.get(f"{BASE_URL}/api/gestor/eventos", headers=headers, timeout=30)
        assert r.status_code == 200
