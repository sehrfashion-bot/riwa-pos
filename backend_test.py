#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class RIWAPOSAPITester:
    def __init__(self, base_url="https://fastpos-riwa.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:500]
                })

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            self.failed_tests.append({"test": name, "error": "Request timeout"})
            return False, {}
        except requests.exceptions.ConnectionError:
            print(f"❌ Failed - Connection error")
            self.failed_tests.append({"test": name, "error": "Connection error"})
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({"test": name, "error": str(e)})
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_menu_categories(self):
        """Test menu categories endpoint"""
        success, response = self.run_test(
            "Menu Categories",
            "GET",
            "menu/categories",
            200
        )
        return success, response

    def test_menu_items(self):
        """Test menu items endpoint"""
        success, response = self.run_test(
            "Menu Items",
            "GET",
            "menu/items",
            200
        )
        return success, response

    def test_admin_dashboard(self):
        """Test admin dashboard endpoint"""
        success, response = self.run_test(
            "Admin Dashboard",
            "GET",
            "admin/dashboard",
            200
        )
        return success, response

    def test_pin_login(self):
        """Test PIN login with valid credentials"""
        success, response = self.run_test(
            "PIN Login (Valid Credentials)",
            "POST",
            "auth/pin-login",
            200,  # Expecting 200 for valid login
            data={"username": "Cashier 1", "pin": "1234"}
        )
        
        if success and response.get('success') and response.get('token'):
            self.token = response['token']
            print(f"   ✅ Login successful, token obtained")
            return True, response
        else:
            print(f"   ❌ Login failed or no token received")
            return False, response

    def test_email_login(self):
        """Test email login (will fail without valid credentials but should return proper error)"""
        success, response = self.run_test(
            "Email Login (Invalid Credentials)",
            "POST",
            "auth/email-login",
            401,  # Expecting 401 for invalid credentials
            data={"email": "test@example.com", "password": "wrongpassword"}
        )
        return success

    def test_auth_me_without_token(self):
        """Test auth/me endpoint without token"""
        success, response = self.run_test(
            "Auth Me (No Token)",
            "GET",
            "auth/me",
            401  # Expecting 401 for no token
        )
        return success

    def test_admin_categories(self):
        """Test admin categories endpoint"""
        success, response = self.run_test(
            "Admin Categories",
            "GET",
            "admin/categories",
            200
        )
        return success

    def test_admin_items(self):
        """Test admin items endpoint"""
        success, response = self.run_test(
            "Admin Items",
            "GET",
            "admin/items",
            200
        )
        return success

    def test_kds_items(self):
        """Test KDS items endpoint"""
        success, response = self.run_test(
            "KDS Items",
            "GET",
            "kds/items",
            200
        )
        return success

    def test_orders_endpoint(self):
        """Test orders endpoint"""
        success, response = self.run_test(
            "Orders List",
            "GET",
            "orders",
            200
        )
        return success

def main():
    print("🚀 Starting RIWA POS API Testing...")
    print("=" * 50)
    
    # Setup
    tester = RIWAPOSAPITester()
    
    # Core health and connectivity tests
    print("\n📋 CORE CONNECTIVITY TESTS")
    print("-" * 30)
    tester.test_health_check()
    tester.test_root_endpoint()
    
    # Menu API tests
    print("\n🍽️ MENU API TESTS")
    print("-" * 30)
    tester.test_menu_categories()
    tester.test_menu_items()
    
    # Auth API tests
    print("\n🔐 AUTHENTICATION TESTS")
    print("-" * 30)
    tester.test_pin_login()
    tester.test_email_login()
    tester.test_auth_me_without_token()
    
    # Admin API tests
    print("\n👨‍💼 ADMIN API TESTS")
    print("-" * 30)
    tester.test_admin_dashboard()
    tester.test_admin_categories()
    tester.test_admin_items()
    
    # Order and KDS tests
    print("\n📦 ORDER & KDS TESTS")
    print("-" * 30)
    tester.test_orders_endpoint()
    tester.test_kds_items()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for failure in tester.failed_tests:
            print(f"  - {failure.get('test', 'Unknown')}: {failure.get('error', failure.get('response', 'Unknown error'))}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())