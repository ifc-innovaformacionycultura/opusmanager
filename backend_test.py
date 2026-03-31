#!/usr/bin/env python3
"""
Backend API Testing for Panel de Gestión de Convocatorias
Tests all authentication and CRUD endpoints
"""

import requests
import sys
import json
from datetime import datetime

class ConvocatoriasAPITester:
    def __init__(self, base_url="https://contact-conductor.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.user_data = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append({"test": name, "error": details})

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = self.session.get(f"{self.api_url}/")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Message: {data.get('message', 'No message')}"
            self.log_test("API Root", success, details)
            return success
        except Exception as e:
            self.log_test("API Root", False, str(e))
            return False

    def test_login(self):
        """Test login with admin credentials"""
        try:
            login_data = {
                "email": "admin@convocatorias.com",
                "password": "Admin123!"
            }
            response = self.session.post(f"{self.api_url}/auth/login", json=login_data)
            success = response.status_code == 200
            
            if success:
                self.user_data = response.json()
                details = f"Logged in as: {self.user_data.get('name')} ({self.user_data.get('role')})"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
            
            self.log_test("Login", success, details)
            return success
        except Exception as e:
            self.log_test("Login", False, str(e))
            return False

    def test_auth_me(self):
        """Test getting current user info"""
        try:
            response = self.session.get(f"{self.api_url}/auth/me")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", User: {data.get('name')} ({data.get('email')})"
            self.log_test("Auth Me", success, details)
            return success
        except Exception as e:
            self.log_test("Auth Me", False, str(e))
            return False

    def test_seasons_crud(self):
        """Test seasons CRUD operations"""
        try:
            # Get seasons
            response = self.session.get(f"{self.api_url}/seasons")
            get_success = response.status_code == 200
            seasons_data = response.json() if get_success else []
            self.log_test("Get Seasons", get_success, f"Found {len(seasons_data)} seasons")
            
            # Create season (test)
            new_season = {
                "name": f"Test Season {datetime.now().strftime('%H%M%S')}",
                "sheet_url": "https://docs.google.com/spreadsheets/d/test"
            }
            response = self.session.post(f"{self.api_url}/seasons", json=new_season)
            create_success = response.status_code == 200
            created_season = response.json() if create_success else {}
            self.log_test("Create Season", create_success, f"Created season: {created_season.get('name', 'Unknown')}")
            
            return get_success and create_success
        except Exception as e:
            self.log_test("Seasons CRUD", False, str(e))
            return False

    def test_events_crud(self):
        """Test events CRUD operations"""
        try:
            # Get events
            response = self.session.get(f"{self.api_url}/events")
            get_success = response.status_code == 200
            events_data = response.json() if get_success else []
            self.log_test("Get Events", get_success, f"Found {len(events_data)} events")
            
            # Test event update if events exist
            if events_data:
                event_id = events_data[0]['id']
                update_data = {"name": f"Updated Event {datetime.now().strftime('%H%M%S')}"}
                response = self.session.put(f"{self.api_url}/events/{event_id}", json=update_data)
                update_success = response.status_code == 200
                self.log_test("Update Event", update_success, f"Updated event {event_id}")
                return get_success and update_success
            
            return get_success
        except Exception as e:
            self.log_test("Events CRUD", False, str(e))
            return False

    def test_contacts_crud(self):
        """Test contacts CRUD operations"""
        try:
            # Get contacts
            response = self.session.get(f"{self.api_url}/contacts")
            get_success = response.status_code == 200
            contacts_data = response.json() if get_success else []
            self.log_test("Get Contacts", get_success, f"Found {len(contacts_data)} contacts")
            
            # Create test contact
            new_contact = {
                "baremo": 85,
                "apellidos": "Test",
                "nombre": "Usuario",
                "dni": "12345678T",
                "provincia": "Madrid",
                "especialidad": "Violín",
                "categoria": "Tutti",
                "telefono": "600000000",
                "email": f"test{datetime.now().strftime('%H%M%S')}@test.com",
                "iban": "ES1234567890123456789012",
                "swift": "TESTBANK"
            }
            response = self.session.post(f"{self.api_url}/contacts", json=new_contact)
            create_success = response.status_code == 200
            self.log_test("Create Contact", create_success, f"Created contact: {new_contact['email']}")
            
            return get_success and create_success
        except Exception as e:
            self.log_test("Contacts CRUD", False, str(e))
            return False

    def test_email_templates_crud(self):
        """Test email templates CRUD operations"""
        try:
            # Get templates
            response = self.session.get(f"{self.api_url}/email-templates")
            get_success = response.status_code == 200
            templates_data = response.json() if get_success else []
            self.log_test("Get Email Templates", get_success, f"Found {len(templates_data)} templates")
            
            # Create test template
            new_template = {
                "type": "test_template",
                "header_image": "",
                "subject": "Test Subject",
                "body": "Test email body content",
                "signature_image": ""
            }
            response = self.session.post(f"{self.api_url}/email-templates", json=new_template)
            create_success = response.status_code == 200
            self.log_test("Create Email Template", create_success, f"Created template: {new_template['type']}")
            
            return get_success and create_success
        except Exception as e:
            self.log_test("Email Templates CRUD", False, str(e))
            return False

    def test_event_responses(self):
        """Test event responses endpoint"""
        try:
            # Get events first
            events_response = self.session.get(f"{self.api_url}/events")
            if events_response.status_code == 200:
                events = events_response.json()
                if events:
                    event_id = events[0]['id']
                    response = self.session.get(f"{self.api_url}/event-responses/{event_id}")
                    success = response.status_code == 200
                    responses_data = response.json() if success else []
                    self.log_test("Get Event Responses", success, f"Found {len(responses_data)} responses for event")
                    return success
            
            self.log_test("Get Event Responses", False, "No events found to test responses")
            return False
        except Exception as e:
            self.log_test("Get Event Responses", False, str(e))
            return False

    def test_column_mapping(self):
        """Test column mapping endpoints"""
        try:
            # Get mapping
            response = self.session.get(f"{self.api_url}/column-mapping")
            get_success = response.status_code == 200
            self.log_test("Get Column Mapping", get_success, f"Status: {response.status_code}")
            
            # Save mapping
            test_mapping = {
                "mapping": {
                    "nombre": "A",
                    "apellidos": "B",
                    "email": "C",
                    "telefono": "D"
                }
            }
            response = self.session.post(f"{self.api_url}/column-mapping", json=test_mapping)
            save_success = response.status_code == 200
            self.log_test("Save Column Mapping", save_success, f"Status: {response.status_code}")
            
            return get_success and save_success
        except Exception as e:
            self.log_test("Column Mapping", False, str(e))
            return False

    def test_email_matrix(self):
        """Test email matrix endpoints"""
        try:
            # Get matrix
            response = self.session.get(f"{self.api_url}/email-matrix")
            get_success = response.status_code == 200
            matrix_data = response.json() if get_success else []
            self.log_test("Get Email Matrix", get_success, f"Found {len(matrix_data)} matrix entries")
            
            # Save matrix
            test_matrix = [
                {"event_id": "test-event", "template_type": "convocatoria_temporada", "enabled": True},
                {"event_id": "test-event", "template_type": "convocatoria_individual", "enabled": False}
            ]
            response = self.session.post(f"{self.api_url}/email-matrix", json=test_matrix)
            save_success = response.status_code == 200
            self.log_test("Save Email Matrix", save_success, f"Status: {response.status_code}")
            
            return get_success and save_success
        except Exception as e:
            self.log_test("Email Matrix", False, str(e))
            return False

    def test_logout(self):
        """Test logout"""
        try:
            response = self.session.post(f"{self.api_url}/auth/logout")
            success = response.status_code == 200
            self.log_test("Logout", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Logout", False, str(e))
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Backend API Tests for Panel de Gestión de Convocatorias")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            ("API Root", self.test_api_root),
            ("Login", self.test_login),
            ("Auth Me", self.test_auth_me),
            ("Seasons CRUD", self.test_seasons_crud),
            ("Events CRUD", self.test_events_crud),
            ("Contacts CRUD", self.test_contacts_crud),
            ("Email Templates CRUD", self.test_email_templates_crud),
            ("Event Responses", self.test_event_responses),
            ("Column Mapping", self.test_column_mapping),
            ("Email Matrix", self.test_email_matrix),
            ("Logout", self.test_logout)
        ]
        
        for test_name, test_func in tests:
            print(f"\n📋 Running {test_name}...")
            test_func()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for failed in self.failed_tests:
                print(f"  - {failed['test']}: {failed['error']}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = ConvocatoriasAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())