#!/usr/bin/env python3

import requests
import sys
import json
import uuid
from datetime import datetime

class RIWAPOSAPITester:
    def __init__(self, base_url="https://fastpos-riwa.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.created_order_id = None
        self.created_item_id = None
        self.kds_item_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.classic_burger_item = None

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
        """Test menu items endpoint and verify prices from Supabase"""
        success, response = self.run_test(
            "Menu Items (Verify Prices from Supabase)",
            "GET",
            "menu/items",
            200
        )
        
        if success and response.get('items'):
            items = response['items']
            print(f"   📋 Found {len(items)} items")
            
            # Look for Classic Burger and verify price structure
            for item in items:
                if 'Classic Burger' in item.get('name', ''):
                    self.classic_burger_item = item
                    price = item.get('price', 0)
                    base_price = item.get('base_price', 0)
                    print(f"   🍔 Classic Burger found - Price: {price} KWD, Base Price: {base_price} KWD")
                    
                    # Verify that price field is mapped from base_price
                    if price == base_price and price > 0:
                        print(f"   ✅ Price mapping from base_price working correctly")
                    else:
                        print(f"   ⚠️  Price mapping issue - price: {price}, base_price: {base_price}")
                    break
            else:
                print(f"   ⚠️  Classic Burger not found in menu items")
        
        return success, response

    def test_complete_order_flow(self):
        """Test complete order flow: login -> add Classic Burger -> payment -> verify order"""
        print("\n🔄 TESTING COMPLETE ORDER FLOW")
        print("-" * 40)
        
        # Step 1: Login (already done in main flow)
        if not self.token:
            print("❌ Cannot test order flow - no authentication token")
            return False
        
        # Step 2: Verify Classic Burger is available
        if not self.classic_burger_item:
            print("❌ Cannot test order flow - Classic Burger not found in menu")
            return False
        
        item_id = self.classic_burger_item.get('id')
        item_price = self.classic_burger_item.get('price', 2.500)
        
        print(f"   🍔 Using Classic Burger - ID: {item_id}, Price: {item_price} KWD")
        
        # Step 3: Create order with Classic Burger
        order_data = {
            "order_type": "qsr",
            "items": [
                {
                    "item_id": item_id,
                    "name": "Classic Burger",
                    "quantity": 1,
                    "unit_price": item_price,
                    "total_price": item_price
                }
            ],
            "subtotal": item_price,
            "tax": round(item_price * 0.05, 3),  # 5% tax
            "service_charge": 0,
            "delivery_fee": 0,
            "total": round(item_price * 1.05, 3),
            "payment_method": "cash",
            "cash_received": 3.000,
            "change_due": round(3.000 - (item_price * 1.05), 3)
        }
        
        success, response = self.run_test(
            "Complete Order Flow - Create Order",
            "POST",
            "orders/create",
            200,
            data=order_data
        )
        
        if success and response.get('success'):
            self.created_order_id = response.get('order', {}).get('id')
            order_number = response.get('order', {}).get('order_number')
            print(f"   ✅ Order created successfully!")
            print(f"   📋 Order ID: {self.created_order_id}")
            print(f"   🏷️  Order Number: {order_number}")
            return True, response
        else:
            print(f"   ❌ Order creation failed")
            return False, response

    def test_kds_real_time_verification(self):
        """Test KDS real-time verification - check if order appears in KDS"""
        print("\n📺 TESTING KDS REAL-TIME VERIFICATION")
        print("-" * 40)
        
        # Get KDS items to see if our order appears
        success, response = self.run_test(
            "KDS Items - Check for Pending Orders",
            "GET",
            "kds/items",
            200
        )
        
        if success:
            items = response.get('items', [])
            print(f"   📋 Found {len(items)} KDS items")
            
            # Look for our created order
            order_found = False
            for item in items:
                if item.get('order_id') == self.created_order_id:
                    order_found = True
                    self.kds_item_id = item.get('id')
                    order_number = item.get('order_number')
                    item_name = item.get('item_name', item.get('item_name_en', ''))
                    print(f"   ✅ Order found in KDS!")
                    print(f"   📋 Order Number: {order_number}")
                    print(f"   🍔 Item: {item_name}")
                    print(f"   🆔 KDS Item ID: {self.kds_item_id}")
                    break
            
            if not order_found and self.created_order_id:
                print(f"   ⚠️  Created order {self.created_order_id} not found in KDS items")
                print(f"   📋 Available KDS items: {[item.get('order_number', 'No order number') for item in items]}")
            elif not self.created_order_id:
                print(f"   ℹ️  No order was created in previous test, so KDS check is informational only")
            
            return True
        
        return False

    def test_kds_bump_functionality(self):
        """Test KDS bump functionality to complete an item"""
        if not self.kds_item_id:
            print("   ⚠️  No KDS item ID available for bump test")
            return False
        
        success, response = self.run_test(
            "KDS Bump - Complete Item",
            "POST",
            "kds/bump",
            200,
            data={"kds_item_id": self.kds_item_id}
        )
        
        if success:
            print(f"   ✅ KDS item bumped successfully!")
            
            # Verify item is no longer in KDS
            verify_success, verify_response = self.run_test(
                "KDS Items - Verify Item Removed After Bump",
                "GET",
                "kds/items",
                200
            )
            
            if verify_success:
                items = verify_response.get('items', [])
                item_still_present = any(item.get('id') == self.kds_item_id for item in items)
                
                if not item_still_present:
                    print(f"   ✅ Item successfully removed from KDS after bump")
                else:
                    print(f"   ⚠️  Item still present in KDS after bump")
        
        return success

    def test_admin_menu_management(self):
        """Test admin menu management functionality"""
        print("\n👨‍💼 TESTING ADMIN MENU MANAGEMENT")
        print("-" * 40)
        
        # Test 1: GET /api/admin/categories - list categories
        cat_success, cat_response = self.run_test(
            "Admin - Get Categories",
            "GET",
            "admin/categories",
            200
        )
        
        if cat_success:
            categories = cat_response.get('categories', [])
            print(f"   📋 Found {len(categories)} categories")
            for cat in categories:
                print(f"   📁 Category: {cat.get('name', 'Unnamed')} (ID: {cat.get('id', 'No ID')})")
        
        # Test 2: GET /api/admin/items - should show items with prices
        items_success, items_response = self.run_test(
            "Admin - Get Items with Prices",
            "GET",
            "admin/items",
            200
        )
        
        existing_item_id = None
        if items_success:
            items = items_response.get('items', [])
            print(f"   📋 Found {len(items)} items")
            for item in items:
                name = item.get('name', 'Unnamed')
                price = item.get('price', 0)
                base_price = item.get('base_price', 0)
                print(f"   🍽️  Item: {name} - Price: {price} KWD, Base Price: {base_price} KWD")
                if not existing_item_id:
                    existing_item_id = item.get('id')
        
        # Test 3: POST /api/admin/items - create a new item
        new_item_data = {
            "name": f"Test Burger {datetime.now().strftime('%H%M%S')}",
            "name_ar": "برجر تجريبي",
            "description": "Test burger for API testing",
            "price": 3.750,
            "category_id": categories[0].get('id') if categories else None,
            "is_active": True
        }
        
        create_success, create_response = self.run_test(
            "Admin - Create New Item",
            "POST",
            "admin/items",
            200,
            data=new_item_data
        )
        
        if create_success and create_response.get('success'):
            created_item = create_response.get('item', {})
            self.created_item_id = created_item.get('id')
            print(f"   ✅ Item created successfully!")
            print(f"   🆔 New Item ID: {self.created_item_id}")
            print(f"   🍽️  Name: {created_item.get('name')}")
            print(f"   💰 Price: {created_item.get('price', created_item.get('base_price'))} KWD")
        
        # Test 4: PATCH /api/admin/items/{id} - update item price
        if existing_item_id:
            update_data = {
                "price": 4.250,
                "name": "Updated Test Item"
            }
            
            update_success, update_response = self.run_test(
                f"Admin - Update Item Price (ID: {existing_item_id})",
                "PATCH",
                f"admin/items/{existing_item_id}",
                200,
                data=update_data
            )
            
            if update_success:
                print(f"   ✅ Item updated successfully!")
        
        return cat_success and items_success

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
        """Test PIN login with valid credentials - Cashier 1, PIN 1234"""
        success, response = self.run_test(
            "PIN Login (Cashier 1, PIN 1234)",
            "POST",
            "auth/pin-login",
            200,
            data={"username": "Cashier 1", "pin": "1234"}
        )
        
        if success and response.get('success') and response.get('token'):
            self.token = response['token']
            user_info = response.get('user', {})
            print(f"   ✅ Login successful!")
            print(f"   👤 User: {user_info.get('name', 'Unknown')}")
            print(f"   🏢 Role: {user_info.get('role', 'Unknown')}")
            print(f"   🏪 Branch ID: {user_info.get('branch_id', 'Unknown')}")
            return True, response
        else:
            print(f"   ❌ Login failed or no token received")
            return False, response

    def test_order_creation(self):
        """Test order creation with authentication"""
        if not self.token:
            print("❌ Cannot test order creation - no authentication token")
            return False
            
        # Use the actual item ID from the menu items we retrieved
        order_data = {
            "order_type": "qsr",
            "items": [
                {
                    "item_id": "f0dc0172-3684-4108-b88b-a87c04c75b90",  # Using actual item ID from menu
                    "name": "Classic Burger",
                    "quantity": 1,
                    "unit_price": 1.500,
                    "total_price": 1.500
                }
            ],
            "subtotal": 1.500,
            "tax": 0.075,
            "service_charge": 0,
            "delivery_fee": 0,
            "total": 1.575,
            "payment_method": "cash"  # Required field
        }
        
        success, response = self.run_test(
            "Order Creation",
            "POST",
            "orders/create",
            200,
            data=order_data
        )
        
        if success and response.get('success'):
            self.created_order_id = response.get('order', {}).get('id')
            print(f"   ✅ Order created with ID: {self.created_order_id}")
            return True, response
        else:
            print(f"   ❌ Order creation failed")
            return False, response

    def test_email_login_valid(self):
        """Test email login with test credentials"""
        success, response = self.run_test(
            "Email Login (Test Credentials)",
            "POST",
            "auth/email-login",
            200,  # Expecting success or proper error handling
            data={"email": "admin@riwapos.com", "password": "admin123"}
        )
        return success, response

    def test_auth_me_without_token(self):
        """Test auth/me endpoint without token"""
        # Temporarily remove token for this test
        temp_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Auth Me (No Token)",
            "GET",
            "auth/me",
            401  # Expecting 401 for no token
        )
        
        # Restore token
        self.token = temp_token
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
    
    # Authentication tests (must be first to get token)
    print("\n🔐 AUTHENTICATION TESTS")
    print("-" * 30)
    pin_success, pin_response = tester.test_pin_login()
    tester.test_email_login_valid()
    tester.test_auth_me_without_token()
    
    # Menu API tests
    print("\n🍽️ MENU API TESTS")
    print("-" * 30)
    tester.test_menu_categories()
    tester.test_menu_items()
    
    # Order creation test (requires authentication)
    print("\n📦 ORDER CREATION TEST")
    print("-" * 30)
    if pin_success:
        tester.test_order_creation()
    else:
        print("❌ Skipping order creation test - PIN login failed")
    
    # Order and KDS tests
    print("\n📦 ORDER & KDS TESTS")
    print("-" * 30)
    tester.test_orders_endpoint()
    tester.test_kds_items()
    
    # Admin API tests
    print("\n👨‍💼 ADMIN API TESTS")
    print("-" * 30)
    tester.test_admin_dashboard()
    tester.test_admin_categories()
    tester.test_admin_items()
    
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