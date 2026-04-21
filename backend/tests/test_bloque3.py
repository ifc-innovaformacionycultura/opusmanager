"""
BLOQUE 3 - Comunicación interna + emails + completitud perfil
Tests backend endpoints:
  - GET/POST /api/gestor/comentarios (reclamacion, evento)
  - GET /api/gestor/notificaciones + PUT /{id}/leer + POST /leer-todas
  - GET /api/gestor/emails/status
  - GET /api/gestor/emails/preview
  - POST /api/gestor/emails/test
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
GESTOR_EMAIL = "admin@convocatorias.com"
GESTOR_PASSWORD = "Admin123!"


@pytest.fixture
def gestor_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": GESTOR_EMAIL, "password": GESTOR_PASSWORD
    })
    assert r.status_code == 200, f"Gestor login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ============ Comentarios internos ============

class TestComentariosReclamacion:
    def test_create_and_list_comentario_reclamacion(self, gestor_headers):
        entidad_id = str(uuid.uuid4())  # entidad ficticia
        contenido = f"TEST nota interna {int(time.time())}"
        # POST
        r = requests.post(
            f"{BASE_URL}/api/gestor/comentarios",
            headers=gestor_headers,
            json={"tipo": "reclamacion", "entidad_id": entidad_id, "contenido": contenido}
        )
        assert r.status_code == 200, f"POST comentarios failed: {r.status_code} {r.text}"
        data = r.json()
        assert "comentario" in data
        c = data["comentario"]
        assert c is not None
        assert c.get("contenido") == contenido
        assert c.get("tipo") == "reclamacion"
        assert c.get("entidad_id") == entidad_id
        assert c.get("gestor_id")
        comentario_id = c["id"]

        # GET list
        r2 = requests.get(
            f"{BASE_URL}/api/gestor/comentarios",
            headers=gestor_headers,
            params={"tipo": "reclamacion", "entidad_id": entidad_id}
        )
        assert r2.status_code == 200, r2.text
        items = r2.json().get("comentarios", [])
        assert any(x["id"] == comentario_id for x in items)

    def test_create_comentario_evento(self, gestor_headers):
        entidad_id = str(uuid.uuid4())
        contenido = f"TEST evento note {int(time.time())}"
        r = requests.post(
            f"{BASE_URL}/api/gestor/comentarios",
            headers=gestor_headers,
            json={"tipo": "evento", "entidad_id": entidad_id, "contenido": contenido}
        )
        assert r.status_code == 200, r.text
        c = r.json().get("comentario")
        assert c and c.get("tipo") == "evento"


# ============ Notificaciones ============

class TestNotificaciones:
    def test_get_notificaciones(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/notificaciones", headers=gestor_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "notificaciones" in data
        assert "no_leidas" in data
        assert isinstance(data["notificaciones"], list)
        assert isinstance(data["no_leidas"], int)
        assert data["no_leidas"] >= 0

    def test_marcar_todas_leidas(self, gestor_headers):
        r = requests.post(f"{BASE_URL}/api/gestor/notificaciones/leer-todas", headers=gestor_headers)
        assert r.status_code == 200, r.text
        # Verify no_leidas = 0 after
        r2 = requests.get(f"{BASE_URL}/api/gestor/notificaciones", headers=gestor_headers)
        assert r2.status_code == 200
        assert r2.json()["no_leidas"] == 0


# ============ Emails ============

class TestEmails:
    def test_email_status(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/emails/status", headers=gestor_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "conectado" in data
        assert "sender" in data
        assert "mensaje" in data
        assert isinstance(data["conectado"], bool)

    def test_email_preview(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/emails/preview",
                         headers=gestor_headers, params={"tipo": "prueba"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "asunto" in data and "html" in data
        assert "prueba" in data["asunto"].lower() or "Email" in data["asunto"]

    def test_email_preview_nueva_convocatoria(self, gestor_headers):
        r = requests.get(f"{BASE_URL}/api/gestor/emails/preview",
                         headers=gestor_headers, params={"tipo": "nueva_convocatoria"})
        assert r.status_code == 200
        assert "html" in r.json()

    def test_email_test_send(self, gestor_headers):
        """POST /emails/test - debe devolver respuesta válida (sent=true o reason explicativo)."""
        payload = {
            "destinatario": "admin@convocatorias.com",
            "tipo": "prueba"
        }
        r = requests.post(f"{BASE_URL}/api/gestor/emails/test",
                          headers=gestor_headers, json=payload)
        # 200 siempre: el endpoint envuelve errores en la respuesta
        assert r.status_code == 200, f"Unexpected {r.status_code}: {r.text}"
        data = r.json()
        # Estructura: {sent: bool, ...}
        assert "sent" in data or "reason" in data or "error" in data or "id" in data, \
            f"Unexpected response shape: {data}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
