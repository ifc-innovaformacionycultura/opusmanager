"""
Test suite for Roles and Permissions Management System
Tests: Login, Roles API, User Management, Permissions Configuration
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@convocatorias.com"
ADMIN_PASSWORD = "Admin123!"

class TestAuthLogin:
    """Test authentication with Bearer token"""
    
    def test_login_success_returns_token(self):
        """Login should return access_token for Authorization header usage"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        # Verify token structure
        assert "access_token" in data, "Response should contain access_token"
        assert "token_type" in data, "Response should contain token_type"
        assert data["token_type"] == "bearer", "Token type should be bearer"
        
        # Verify user object
        assert "user" in data, "Response should contain user object"
        user = data["user"]
        assert user["email"] == ADMIN_EMAIL
        assert user["role"] == "admin"
        assert "id" in user
        assert "name" in user
        
        print(f"Login successful - Token received, user: {user['name']}, role: {user['role']}")
    
    def test_login_invalid_credentials(self):
        """Login with wrong credentials should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("Invalid credentials correctly rejected with 401")
    
    def test_auth_me_with_bearer_token(self):
        """GET /api/auth/me should work with Authorization Bearer header"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Use token in Authorization header
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        print(f"Auth/me with Bearer token successful - User: {data['name']}")


class TestRolesAPI:
    """Test GET /api/admin/roles returns the 5 specific roles"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_roles_returns_5_specific_roles(self, auth_headers):
        """GET /api/admin/roles should return the 5 specific roles"""
        response = requests.get(f"{BASE_URL}/api/admin/roles", headers=auth_headers)
        
        assert response.status_code == 200, f"Get roles failed: {response.text}"
        roles = response.json()
        
        # Should have exactly 5 roles
        assert len(roles) == 5, f"Expected 5 roles, got {len(roles)}"
        
        # Extract role IDs
        role_ids = [r["id"] for r in roles]
        expected_roles = ["admin", "personal", "logistica", "archivo", "economico"]
        
        for expected_role in expected_roles:
            assert expected_role in role_ids, f"Missing role: {expected_role}"
        
        # Verify role structure
        for role in roles:
            assert "id" in role
            assert "name" in role
            assert "description" in role
            assert "color" in role
        
        # Verify specific role names
        role_names = {r["id"]: r["name"] for r in roles}
        assert role_names["admin"] == "Administrador"
        assert role_names["personal"] == "Gestor de Personal"
        assert role_names["logistica"] == "Gestor de Logística"
        assert role_names["archivo"] == "Gestor de Archivo"
        assert role_names["economico"] == "Gestor Económico"
        
        print(f"Roles API returned 5 correct roles: {role_ids}")
    
    def test_roles_requires_admin(self):
        """GET /api/admin/roles should require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/roles")
        assert response.status_code == 401, "Should require authentication"
        print("Roles endpoint correctly requires authentication")


class TestUserManagement:
    """Test user CRUD operations"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_all_users(self, auth_headers):
        """GET /api/admin/users should return list of users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        
        assert response.status_code == 200, f"Get users failed: {response.text}"
        users = response.json()
        
        assert isinstance(users, list)
        # Should have at least the admin user
        assert len(users) >= 1
        
        # Verify user structure
        for user in users:
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user
            # Password hash should NOT be returned
            assert "password_hash" not in user
        
        print(f"Get users returned {len(users)} users")
    
    def test_create_user_with_personal_role(self, auth_headers):
        """Create a new user with 'personal' role"""
        test_email = f"TEST_personal_user_{os.urandom(4).hex()}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/admin/users", headers=auth_headers, json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "Test Personal User",
            "role": "personal"
        })
        
        assert response.status_code == 200, f"Create user failed: {response.text}"
        user = response.json()
        
        assert user["email"] == test_email.lower()
        assert user["name"] == "Test Personal User"
        assert user["role"] == "personal"
        assert user["is_active"] == True
        assert "id" in user
        
        # Verify user was persisted - GET to confirm
        get_response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        users = get_response.json()
        created_user = next((u for u in users if u["email"] == test_email.lower()), None)
        assert created_user is not None, "Created user not found in users list"
        assert created_user["role"] == "personal"
        
        print(f"Created user with personal role: {user['id']}")
        
        # Cleanup - delete the test user
        requests.delete(f"{BASE_URL}/api/admin/users/{user['id']}", headers=auth_headers)
    
    def test_update_user_role(self, auth_headers):
        """Edit existing user and change their role"""
        # First create a test user
        test_email = f"TEST_update_role_{os.urandom(4).hex()}@test.com"
        
        create_response = requests.post(f"{BASE_URL}/api/admin/users", headers=auth_headers, json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "Test Update Role User",
            "role": "personal"
        })
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update the user's role to 'logistica'
        update_response = requests.put(f"{BASE_URL}/api/admin/users/{user_id}", headers=auth_headers, json={
            "role": "logistica"
        })
        
        assert update_response.status_code == 200, f"Update user failed: {update_response.text}"
        updated_user = update_response.json()
        assert updated_user["role"] == "logistica"
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        users = get_response.json()
        found_user = next((u for u in users if u["id"] == user_id), None)
        assert found_user is not None
        assert found_user["role"] == "logistica"
        
        print(f"Updated user role from 'personal' to 'logistica'")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=auth_headers)
    
    def test_delete_user(self, auth_headers):
        """Delete a user and verify removal"""
        # Create a test user
        test_email = f"TEST_delete_{os.urandom(4).hex()}@test.com"
        
        create_response = requests.post(f"{BASE_URL}/api/admin/users", headers=auth_headers, json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "Test Delete User",
            "role": "archivo"
        })
        user_id = create_response.json()["id"]
        
        # Delete the user
        delete_response = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        
        # Verify user no longer exists
        get_response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        users = get_response.json()
        found_user = next((u for u in users if u["id"] == user_id), None)
        assert found_user is None, "Deleted user should not exist"
        
        print(f"User deleted successfully")


class TestPermissionsConfig:
    """Test permissions configuration endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_permissions_config(self, auth_headers):
        """GET /api/admin/permissions-config should return permissions"""
        response = requests.get(f"{BASE_URL}/api/admin/permissions-config", headers=auth_headers)
        
        assert response.status_code == 200, f"Get permissions config failed: {response.text}"
        data = response.json()
        
        # Should have permissions key
        assert "permissions" in data or data == {}
        print(f"Permissions config retrieved successfully")
    
    def test_save_permissions_config(self, auth_headers):
        """POST /api/admin/permissions-config should save permissions matrix"""
        test_permissions = {
            "permissions": {
                "dashboard": {
                    "ver": {
                        "admin": True,
                        "personal": True,
                        "logistica": True,
                        "archivo": True,
                        "economico": True
                    }
                },
                "config_eventos": {
                    "ver": {
                        "admin": True,
                        "personal": False,
                        "logistica": True,
                        "archivo": False,
                        "economico": False
                    },
                    "editar": {
                        "admin": True,
                        "personal": False,
                        "logistica": True,
                        "archivo": False,
                        "economico": False
                    }
                }
            }
        }
        
        # Save permissions
        save_response = requests.post(f"{BASE_URL}/api/admin/permissions-config", 
                                      headers=auth_headers, json=test_permissions)
        
        assert save_response.status_code == 200, f"Save permissions failed: {save_response.text}"
        
        # Verify persistence - GET to confirm
        get_response = requests.get(f"{BASE_URL}/api/admin/permissions-config", headers=auth_headers)
        assert get_response.status_code == 200
        
        saved_data = get_response.json()
        assert "permissions" in saved_data
        assert "dashboard" in saved_data["permissions"]
        assert saved_data["permissions"]["dashboard"]["ver"]["personal"] == True
        
        print("Permissions configuration saved and retrieved successfully")
    
    def test_get_roles_config(self, auth_headers):
        """GET /api/admin/roles-config should return roles configuration"""
        response = requests.get(f"{BASE_URL}/api/admin/roles-config", headers=auth_headers)
        
        assert response.status_code == 200, f"Get roles config failed: {response.text}"
        data = response.json()
        
        # Should have roles key
        assert "roles" in data
        roles = data["roles"]
        assert len(roles) == 5
        
        print(f"Roles config retrieved with {len(roles)} roles")
    
    def test_save_roles_config(self, auth_headers):
        """POST /api/admin/roles-config should save roles configuration"""
        test_roles = {
            "roles": [
                {"id": "admin", "name": "Administrador", "description": "Acceso completo", "color": "red", "isSystem": True},
                {"id": "personal", "name": "Gestor de Personal", "description": "Gestión de contactos", "color": "blue", "isSystem": False},
                {"id": "logistica", "name": "Gestor de Logística", "description": "Gestión de eventos", "color": "green", "isSystem": False},
                {"id": "archivo", "name": "Gestor de Archivo", "description": "Gestión documental", "color": "purple", "isSystem": False},
                {"id": "economico", "name": "Gestor Económico", "description": "Gestión de cachés", "color": "yellow", "isSystem": False}
            ]
        }
        
        save_response = requests.post(f"{BASE_URL}/api/admin/roles-config", 
                                      headers=auth_headers, json=test_roles)
        
        assert save_response.status_code == 200, f"Save roles config failed: {save_response.text}"
        print("Roles configuration saved successfully")


class TestUserPermissions:
    """Test user permissions endpoint"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_user_permissions_admin(self, auth_headers):
        """GET /api/user/permissions should return 'all' for admin"""
        response = requests.get(f"{BASE_URL}/api/user/permissions", headers=auth_headers)
        
        assert response.status_code == 200, f"Get user permissions failed: {response.text}"
        data = response.json()
        
        assert data["role"] == "admin"
        assert data["permissions"] == "all"
        
        print("Admin user has 'all' permissions as expected")
    
    def test_get_user_permissions_non_admin(self, auth_headers):
        """Create non-admin user and verify their permissions"""
        # Create a test user with 'personal' role
        test_email = f"TEST_perms_{os.urandom(4).hex()}@test.com"
        test_password = "TestPass123!"
        
        create_response = requests.post(f"{BASE_URL}/api/admin/users", headers=auth_headers, json={
            "email": test_email,
            "password": test_password,
            "name": "Test Permissions User",
            "role": "personal"
        })
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Login as the new user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        assert login_response.status_code == 200
        user_token = login_response.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        # Get permissions for this user
        perms_response = requests.get(f"{BASE_URL}/api/user/permissions", headers=user_headers)
        assert perms_response.status_code == 200
        
        data = perms_response.json()
        assert data["role"] == "personal"
        # Non-admin should have permissions object (not "all")
        assert data["permissions"] != "all"
        
        print(f"Non-admin user has role-specific permissions: {data['role']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=auth_headers)


class TestSendCredentials:
    """Test send credentials endpoint (MOCKED)"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_send_credentials_mocked(self, auth_headers):
        """POST /api/admin/users/{id}/send-credentials should return success (MOCKED)"""
        # Create a test user
        test_email = f"TEST_creds_{os.urandom(4).hex()}@test.com"
        
        create_response = requests.post(f"{BASE_URL}/api/admin/users", headers=auth_headers, json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "Test Credentials User",
            "role": "personal"
        })
        user_id = create_response.json()["id"]
        
        # Send credentials (MOCKED - doesn't actually send email)
        send_response = requests.post(f"{BASE_URL}/api/admin/users/{user_id}/send-credentials", 
                                      headers=auth_headers)
        
        assert send_response.status_code == 200, f"Send credentials failed: {send_response.text}"
        data = send_response.json()
        assert "message" in data
        assert "simulated" in data["message"].lower() or test_email.lower() in data["message"].lower()
        
        print(f"Send credentials (MOCKED) returned: {data['message']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
