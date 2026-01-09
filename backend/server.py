from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
import uuid
from datetime import datetime, timezone
import hashlib
import hmac
import json
import httpx
from jose import jwt, JWTError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://sqhjsctsxlnivcbeclrn.supabase.co')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_PUBLIC_ANON_KEY', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SECRET_SERVICE_ROLE_KEY', '')
JWT_SECRET = os.environ.get('SUPABASE_LEGACY_JWT_SECRET', '')

# Correct tenant/branch from user specification
TENANT_ID = 'af8d6568-fb4d-43ce-a97d-8cebca6a44d9'
BRANCH_ID = 'd73bf34c-5c8c-47c8-9518-b85c7447ebde'

# Create the main app
app = FastAPI(title="RIWA POS API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class PinLoginRequest(BaseModel):
    username: str
    pin: str

class EmailLoginRequest(BaseModel):
    email: str
    password: str

class OrderCreateRequest(BaseModel):
    order_type: str  # qsr, takeaway, delivery
    order_source: Optional[str] = 'walkin'  # walkin, website, talabat, cari, jahez, katch, other
    items: List[Dict[str, Any]]
    subtotal: float
    tax: float = 0
    service_charge: float = 0
    delivery_fee: float = 0
    total: float
    payment_method: str  # cash, card
    cash_received: Optional[float] = None
    change_due: Optional[float] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    notes: Optional[str] = None

class OrderStatusUpdateRequest(BaseModel):
    order_id: str
    status: str

class KDSBumpRequest(BaseModel):
    kds_item_id: str

# ==================== HELPER FUNCTIONS ====================

async def supabase_request(method: str, endpoint: str, data: Optional[Dict] = None, use_service_key: bool = False):
    """Make authenticated request to Supabase"""
    key = SUPABASE_SERVICE_KEY if use_service_key else SUPABASE_ANON_KEY
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    
    async with httpx.AsyncClient() as client:
        if method == "GET":
            response = await client.get(url, headers=headers)
        elif method == "POST":
            response = await client.post(url, headers=headers, json=data)
        elif method == "PATCH":
            response = await client.patch(url, headers=headers, json=data)
        elif method == "DELETE":
            response = await client.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response

def generate_order_number() -> str:
    """Generate unique order number"""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_suffix = str(uuid.uuid4())[:4].upper()
    return f"ORD-{timestamp}-{random_suffix}"

# Global bill counter (stored in memory, will be loaded from DB on startup)
_bill_counter = {"prefix": 1, "number": 0}

async def generate_bill_number() -> str:
    """Generate sequential bill number in XXX-YYY format"""
    global _bill_counter
    
    try:
        # Try to get the last bill number from orders
        response = await supabase_request(
            "GET",
            f"orders?tenant_id=eq.{TENANT_ID}&select=bill_number&order=created_at.desc&limit=1",
            use_service_key=True
        )
        
        if response.status_code == 200 and response.json():
            last_bill = response.json()[0].get('bill_number', '')
            if last_bill and '-' in last_bill:
                try:
                    parts = last_bill.split('-')
                    _bill_counter["prefix"] = int(parts[0])
                    _bill_counter["number"] = int(parts[1])
                except:
                    pass
    except:
        pass
    
    # Increment counter
    _bill_counter["number"] += 1
    
    # Reset to next prefix when reaching 999
    if _bill_counter["number"] > 999:
        _bill_counter["prefix"] += 1
        _bill_counter["number"] = 1
    
    prefix = str(_bill_counter["prefix"]).zfill(3)
    number = str(_bill_counter["number"]).zfill(3)
    
    return f"{prefix}-{number}"

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/pin-login")
async def pin_login(request: PinLoginRequest):
    """Login with username and PIN"""
    try:
        # Query user by name/email and PIN for this tenant
        response = await supabase_request(
            "GET",
            f"users?tenant_id=eq.{TENANT_ID}&pin=eq.{request.pin}&select=id,name,email,role,branch_id,tenant_id",
            use_service_key=True
        )
        
        if response.status_code != 200:
            logger.error(f"PIN login query failed: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail="Database error")
        
        users = response.json()
        
        # Find user matching username (name or email)
        matched_user = None
        for user in users:
            if (user.get('name', '').lower() == request.username.lower() or 
                user.get('email', '').lower() == request.username.lower()):
                matched_user = user
                break
        
        if not matched_user:
            raise HTTPException(status_code=401, detail="Invalid username or PIN")
        
        # Generate session token
        token_data = {
            "user_id": matched_user['id'],
            "role": matched_user['role'],
            "branch_id": matched_user.get('branch_id', BRANCH_ID),
            "tenant_id": matched_user.get('tenant_id', TENANT_ID),
            "exp": datetime.now(timezone.utc).timestamp() + 86400  # 24h
        }
        token = jwt.encode(token_data, JWT_SECRET, algorithm="HS256")
        
        return {
            "success": True,
            "token": token,
            "user": {
                "id": matched_user['id'],
                "name": matched_user['name'],
                "email": matched_user.get('email'),
                "role": matched_user['role'],
                "branch_id": matched_user.get('branch_id'),
                "tenant_id": matched_user.get('tenant_id')
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PIN login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/email-login")
async def email_login(request: EmailLoginRequest):
    """Login with email/password via Supabase Auth"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "email": request.email,
                    "password": request.password
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid credentials")
            
            auth_data = response.json()
            user_id = auth_data['user']['id']
            
            # Get user from public.users
            user_response = await supabase_request(
                "GET",
                f"users?id=eq.{user_id}&tenant_id=eq.{TENANT_ID}",
                use_service_key=True
            )
            
            users = user_response.json() if user_response.status_code == 200 else []
            
            if not users:
                # Try to find by email
                user_response = await supabase_request(
                    "GET",
                    f"users?email=eq.{request.email}&tenant_id=eq.{TENANT_ID}",
                    use_service_key=True
                )
                users = user_response.json() if user_response.status_code == 200 else []
            
            if users:
                user = users[0]
            else:
                user = {
                    "id": user_id,
                    "name": request.email.split('@')[0],
                    "role": "admin",
                    "tenant_id": TENANT_ID,
                    "branch_id": BRANCH_ID
                }
            
            return {
                "success": True,
                "token": auth_data['access_token'],
                "refresh_token": auth_data.get('refresh_token'),
                "user": {
                    "id": user.get('id', user_id),
                    "name": user.get('name', request.email),
                    "email": request.email,
                    "role": user.get('role', 'admin'),
                    "branch_id": user.get('branch_id', BRANCH_ID),
                    "tenant_id": user.get('tenant_id', TENANT_ID)
                }
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/me")
async def get_current_user(authorization: str = Header(None)):
    """Get current user info"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")
    
    try:
        token = authorization.replace("Bearer ", "")
        
        # Try decoding as our custom token first
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            return {
                "id": payload.get('user_id'),
                "role": payload.get('role'),
                "branch_id": payload.get('branch_id'),
                "tenant_id": payload.get('tenant_id')
            }
        except JWTError:
            pass
        
        # Try as Supabase token
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {token}"
                }
            )
            
            if response.status_code == 200:
                user_data = response.json()
                return {
                    "id": user_data['id'],
                    "email": user_data.get('email'),
                    "role": "admin"
                }
        
        raise HTTPException(status_code=401, detail="Invalid token")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== MENU ENDPOINTS ====================

@api_router.get("/menu/categories")
async def get_categories():
    """Get all menu categories for this tenant"""
    try:
        response = await supabase_request(
            "GET",
            f"categories?tenant_id=eq.{TENANT_ID}&status=eq.active&order=sort_order.asc",
            use_service_key=True
        )
        
        if response.status_code != 200:
            logger.error(f"Categories query failed: {response.status_code} - {response.text}")
            return {"categories": []}
        
        categories = response.json() or []
        # Normalize field names
        for cat in categories:
            cat['name'] = cat.get('name_en', cat.get('name', ''))
            cat['name_ar'] = cat.get('name_ar', '')
            cat['is_active'] = cat.get('status') == 'active'
        
        return {"categories": categories}
    except Exception as e:
        logger.error(f"Get categories error: {e}")
        return {"categories": []}

@api_router.get("/menu/items")
async def get_items(category_id: Optional[str] = None):
    """Get menu items for this tenant"""
    try:
        endpoint = f"items?tenant_id=eq.{TENANT_ID}&status=eq.active&order=sort_order.asc"
        if category_id:
            endpoint += f"&category_id=eq.{category_id}"
        
        response = await supabase_request("GET", endpoint, use_service_key=True)
        
        if response.status_code != 200:
            logger.error(f"Items query failed: {response.status_code} - {response.text}")
            return {"items": []}
        
        items = response.json() or []
        # Normalize field names
        for item in items:
            item['name'] = item.get('name_en', item.get('name', ''))
            item['name_ar'] = item.get('name_ar', '')
            item['is_active'] = item.get('status') == 'active'
            # Map base_price to price for frontend compatibility
            item['price'] = item.get('base_price', item.get('price', 0))
        
        return {"items": items}
    except Exception as e:
        logger.error(f"Get items error: {e}")
        return {"items": []}

@api_router.get("/menu/item/{item_id}")
async def get_item_details(item_id: str):
    """Get item with variants and modifiers"""
    try:
        # Get item
        item_response = await supabase_request(
            "GET",
            f"items?id=eq.{item_id}&tenant_id=eq.{TENANT_ID}",
            use_service_key=True
        )
        
        if item_response.status_code != 200 or not item_response.json():
            raise HTTPException(status_code=404, detail="Item not found")
        
        item = item_response.json()[0]
        item['name'] = item.get('name_en', item.get('name', ''))
        item['name_ar'] = item.get('name_ar', '')
        item['price'] = item.get('base_price', item.get('price', 0))
        
        # Get variants
        variants_response = await supabase_request(
            "GET",
            f"item_variants?item_id=eq.{item_id}&status=eq.active&order=sort_order.asc",
            use_service_key=True
        )
        item['variants'] = variants_response.json() if variants_response.status_code == 200 else []
        
        # Get modifier groups linked to this item
        if item.get('modifier_group_ids'):
            modifier_groups = []
            for mg_id in item['modifier_group_ids']:
                mg_response = await supabase_request(
                    "GET",
                    f"modifier_groups?id=eq.{mg_id}&status=eq.active",
                    use_service_key=True
                )
                if mg_response.status_code == 200 and mg_response.json():
                    group = mg_response.json()[0]
                    group['name'] = group.get('name_en', group.get('name', ''))
                    
                    # Get modifiers
                    mods_response = await supabase_request(
                        "GET",
                        f"modifiers?modifier_group_id=eq.{mg_id}&status=eq.active&order=sort_order.asc",
                        use_service_key=True
                    )
                    group['modifiers'] = mods_response.json() if mods_response.status_code == 200 else []
                    modifier_groups.append(group)
            
            item['modifier_groups'] = modifier_groups
        else:
            item['modifier_groups'] = []
        
        return item
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get item details error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ORDER ENDPOINTS ====================

@api_router.post("/orders/create")
async def create_order(request: OrderCreateRequest, authorization: str = Header(None)):
    """Create a new order and push to KDS"""
    try:
        # Get user from token
        user_id = None
        user_branch_id = BRANCH_ID
        if authorization:
            try:
                token = authorization.replace("Bearer ", "")
                payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                user_id = payload.get('user_id')
                user_branch_id = payload.get('branch_id', BRANCH_ID)
            except:
                pass
        
        order_number = generate_order_number()
        order_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Create order matching the existing schema
        order_data = {
            "id": order_id,
            "tenant_id": TENANT_ID,
            "branch_id": user_branch_id,  # Use user's branch_id
            "order_number": order_number,
            "order_type": request.order_type.lower(),
            "channel": "pos",
            "status": "pending",
            "payment_status": "paid" if request.payment_method else "pending",
            # "payment_method": request.payment_method,  # Column doesn't exist in schema
            "subtotal": request.subtotal,
            "tax_amount": request.tax,
            "service_charge": request.service_charge,
            "delivery_fee": request.delivery_fee,
            "discount_amount": 0,
            "total_amount": request.total,
            "customer_name": request.customer_name,
            "customer_phone": request.customer_phone,
            "delivery_address": request.customer_address,
            "notes": request.notes,
            "user_id": user_id,
            "created_at": now,
            "updated_at": now
        }
        
        order_response = await supabase_request("POST", "orders", order_data, use_service_key=True)
        
        if order_response.status_code not in [200, 201]:
            logger.error(f"Order creation failed: {order_response.status_code} - {order_response.text}")
            raise HTTPException(status_code=500, detail="Failed to create order")
        
        # Create order items (the order_items table is used for KDS via real-time)
        for idx, item in enumerate(request.items):
            order_item_id = str(uuid.uuid4())
            
            # Create order item with correct column names for Supabase schema
            order_item_data = {
                "id": order_item_id,
                "order_id": order_id,
                "item_id": item.get('item_id'),
                "variant_id": item.get('variant_id'),
                "item_name_en": item.get('name', ''),
                "item_name_ar": item.get('name_ar', ''),
                "quantity": item.get('quantity', 1),
                "unit_price": item.get('unit_price', 0),
                "total_price": item.get('total_price', 0),
                "notes": item.get('notes'),
                "status": "pending",
                "created_at": now
            }
            item_response = await supabase_request("POST", "order_items", order_item_data, use_service_key=True)
            if item_response.status_code not in [200, 201]:
                logger.warning(f"Order item creation warning: {item_response.status_code} - {item_response.text}")
        
        return {
            "success": True,
            "order": {
                "id": order_id,
                "order_number": order_number,
                "status": "pending",
                "total": request.total
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create order error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/orders/update-status")
async def update_order_status(request: OrderStatusUpdateRequest, authorization: str = Header(None)):
    """Update order status"""
    try:
        user_id = None
        if authorization:
            try:
                token = authorization.replace("Bearer ", "")
                payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                user_id = payload.get('user_id')
            except:
                pass
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Update order
        update_data = {
            "status": request.status,
            "updated_at": now
        }
        
        response = await supabase_request(
            "PATCH",
            f"orders?id=eq.{request.order_id}&tenant_id=eq.{TENANT_ID}",
            update_data,
            use_service_key=True
        )
        
        if response.status_code not in [200, 204]:
            raise HTTPException(status_code=500, detail="Failed to update order")
        
        # Add state record
        state_data = {
            "id": str(uuid.uuid4()),
            "order_id": request.order_id,
            "status": request.status,
            "changed_by": user_id,
            "created_at": now
        }
        await supabase_request("POST", "order_states", state_data, use_service_key=True)
        
        return {"success": True, "status": request.status}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/orders")
async def get_orders(status: Optional[str] = None, limit: int = 50):
    """Get orders for this tenant"""
    try:
        # Query all orders for the tenant, not filtering by branch_id since it's causing issues
        endpoint = f"orders?tenant_id=eq.{TENANT_ID}&order=created_at.desc&limit={limit}"
        if status:
            endpoint += f"&status=eq.{status}"
        
        response = await supabase_request("GET", endpoint, use_service_key=True)
        
        if response.status_code != 200:
            logger.error(f"Orders query failed: {response.status_code} - {response.text}")
            return {"orders": []}
        
        orders = response.json() or []
        # Normalize field names for frontend
        for order in orders:
            order['subtotal'] = order.get('subtotal', 0)
            order['tax'] = order.get('tax_amount', 0)
            order['total'] = order.get('total_amount', 0)
        
        return {"orders": orders}
    except Exception as e:
        logger.error(f"Get orders error: {e}")
        return {"orders": []}

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    """Get single order with items"""
    try:
        # Get order
        order_response = await supabase_request(
            "GET",
            f"orders?id=eq.{order_id}&tenant_id=eq.{TENANT_ID}",
            use_service_key=True
        )
        
        if order_response.status_code != 200 or not order_response.json():
            raise HTTPException(status_code=404, detail="Order not found")
        
        order = order_response.json()[0]
        order['subtotal'] = order.get('subtotal', 0)
        order['tax'] = order.get('tax_amount', 0)
        order['total'] = order.get('total_amount', 0)
        
        # Get items
        items_response = await supabase_request(
            "GET",
            f"order_items?order_id=eq.{order_id}",
            use_service_key=True
        )
        
        items = items_response.json() if items_response.status_code == 200 else []
        # Get item names
        for item in items:
            if item.get('item_id'):
                item_detail = await supabase_request(
                    "GET",
                    f"items?id=eq.{item['item_id']}&select=name_en,name_ar",
                    use_service_key=True
                )
                if item_detail.status_code == 200 and item_detail.json():
                    detail = item_detail.json()[0]
                    item['item_name'] = detail.get('name_en', '')
                    item['item_name_ar'] = detail.get('name_ar', '')
        
        order['items'] = items
        
        # Get states
        states_response = await supabase_request(
            "GET",
            f"order_states?order_id=eq.{order_id}&order=created_at.asc",
            use_service_key=True
        )
        order['states'] = states_response.json() if states_response.status_code == 200 else []
        
        return order
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get order error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== KDS ENDPOINTS ====================

@api_router.get("/kds/items")
async def get_kds_items(station: Optional[str] = None):
    """Get KDS items from orders with pending/preparing status"""
    try:
        # Get orders with pending or preparing status
        orders_response = await supabase_request(
            "GET",
            f"orders?tenant_id=eq.{TENANT_ID}&status=in.(pending,accepted,preparing)&order=created_at.asc",
            use_service_key=True
        )
        
        if orders_response.status_code != 200:
            logger.error(f"KDS orders query failed: {orders_response.status_code}")
            return {"items": []}
        
        orders = orders_response.json() or []
        kds_items = []
        
        # Get items for each order
        for order in orders:
            items_response = await supabase_request(
                "GET",
                f"order_items?order_id=eq.{order['id']}&status=neq.completed&order=created_at.asc",
                use_service_key=True
            )
            
            if items_response.status_code == 200:
                items = items_response.json() or []
                for item in items:
                    item['order'] = {
                        'order_number': order.get('order_number'),
                        'order_type': order.get('order_type'),
                        'status': order.get('status')
                    }
                    item['order_number'] = order.get('order_number')
                    item['item_name'] = item.get('item_name_en', '')
                    item['item_name_ar'] = item.get('item_name_ar', '')
                    kds_items.append(item)
        
        return {"items": kds_items}
    except Exception as e:
        logger.error(f"Get KDS items error: {e}")
        return {"items": []}

@api_router.post("/kds/bump")
async def bump_kds_item(request: KDSBumpRequest):
    """Bump (complete) a KDS item - marks order_item as completed"""
    try:
        now = datetime.now(timezone.utc).isoformat()
        
        # Update order_item status
        response = await supabase_request(
            "PATCH",
            f"order_items?id=eq.{request.kds_item_id}",
            {"status": "completed"},
            use_service_key=True
        )
        
        if response.status_code not in [200, 204]:
            raise HTTPException(status_code=500, detail="Failed to bump item")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bump KDS item error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN ENDPOINTS ====================

@api_router.get("/admin/dashboard")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Today's orders
        orders_response = await supabase_request(
            "GET",
            f"orders?tenant_id=eq.{TENANT_ID}&branch_id=eq.{BRANCH_ID}&created_at=gte.{today}T00:00:00",
            use_service_key=True
        )
        
        orders = orders_response.json() if orders_response.status_code == 200 else []
        
        total_sales = sum(o.get('total_amount', 0) for o in orders)
        pending_count = len([o for o in orders if o.get('status') == 'pending'])
        
        return {
            "today_orders": len(orders),
            "today_sales": total_sales,
            "pending_count": pending_count,
            "currency": "KWD"
        }
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        return {"today_orders": 0, "today_sales": 0, "pending_count": 0, "currency": "KWD"}

@api_router.get("/admin/categories")
async def admin_get_categories():
    """Get all categories for admin"""
    try:
        response = await supabase_request(
            "GET",
            f"categories?tenant_id=eq.{TENANT_ID}&order=sort_order.asc",
            use_service_key=True
        )
        
        categories = response.json() if response.status_code == 200 else []
        for cat in categories:
            cat['name'] = cat.get('name_en', cat.get('name', ''))
            cat['name_ar'] = cat.get('name_ar', '')
            cat['is_active'] = cat.get('status') == 'active'
        
        return {"categories": categories}
    except Exception as e:
        logger.error(f"Admin categories error: {e}")
        return {"categories": []}

@api_router.post("/admin/categories")
async def admin_create_category(category: Dict[str, Any]):
    """Create a category"""
    try:
        category['id'] = str(uuid.uuid4())
        category['tenant_id'] = TENANT_ID
        category['name_en'] = category.pop('name', '')
        category['status'] = 'active' if category.pop('is_active', True) else 'inactive'
        category['created_at'] = datetime.now(timezone.utc).isoformat()
        
        response = await supabase_request("POST", "categories", category, use_service_key=True)
        
        if response.status_code not in [200, 201]:
            raise HTTPException(status_code=500, detail="Failed to create category")
        
        return {"success": True, "category": response.json()[0] if response.json() else category}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create category error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/admin/categories/{category_id}")
async def admin_update_category(category_id: str, category: Dict[str, Any]):
    """Update a category"""
    try:
        if 'name' in category:
            category['name_en'] = category.pop('name')
        if 'is_active' in category:
            category['status'] = 'active' if category.pop('is_active') else 'inactive'
        category['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        response = await supabase_request(
            "PATCH",
            f"categories?id=eq.{category_id}&tenant_id=eq.{TENANT_ID}",
            category,
            use_service_key=True
        )
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Update category error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/categories/{category_id}")
async def admin_delete_category(category_id: str):
    """Delete a category"""
    try:
        await supabase_request(
            "DELETE",
            f"categories?id=eq.{category_id}&tenant_id=eq.{TENANT_ID}",
            use_service_key=True
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Delete category error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/items")
async def admin_get_items():
    """Get all items for admin"""
    try:
        response = await supabase_request(
            "GET",
            f"items?tenant_id=eq.{TENANT_ID}&order=sort_order.asc",
            use_service_key=True
        )
        
        items = response.json() if response.status_code == 200 else []
        for item in items:
            item['name'] = item.get('name_en', item.get('name', ''))
            item['name_ar'] = item.get('name_ar', '')
            item['is_active'] = item.get('status') == 'active'
            item['price'] = item.get('base_price', 0)
        
        return {"items": items}
    except Exception as e:
        logger.error(f"Admin items error: {e}")
        return {"items": []}

@api_router.post("/admin/items")
async def admin_create_item(item: Dict[str, Any]):
    """Create an item"""
    try:
        item['id'] = str(uuid.uuid4())
        item['tenant_id'] = TENANT_ID
        item['name_en'] = item.pop('name', '')
        if 'price' in item:
            item['base_price'] = item.pop('price')
        item['status'] = 'active' if item.pop('is_active', True) else 'inactive'
        item['created_at'] = datetime.now(timezone.utc).isoformat()
        
        response = await supabase_request("POST", "items", item, use_service_key=True)
        
        if response.status_code not in [200, 201]:
            logger.error(f"Create item failed: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail="Failed to create item")
        
        result = response.json()[0] if response.json() else item
        result['price'] = result.get('base_price', 0)
        return {"success": True, "item": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create item error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/admin/items/{item_id}")
async def admin_update_item(item_id: str, item: Dict[str, Any]):
    """Update an item"""
    try:
        if 'name' in item:
            item['name_en'] = item.pop('name')
        if 'price' in item:
            item['base_price'] = item.pop('price')
        if 'is_active' in item:
            item['status'] = 'active' if item.pop('is_active') else 'inactive'
        item['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        response = await supabase_request(
            "PATCH",
            f"items?id=eq.{item_id}&tenant_id=eq.{TENANT_ID}",
            item,
            use_service_key=True
        )
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Update item error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/items/{item_id}")
async def admin_delete_item(item_id: str):
    """Delete an item"""
    try:
        await supabase_request(
            "DELETE",
            f"items?id=eq.{item_id}&tenant_id=eq.{TENANT_ID}",
            use_service_key=True
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Delete item error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== DELIVERY ZONES ====================

@api_router.get("/admin/delivery-zones")
async def get_delivery_zones():
    """Get delivery zones"""
    try:
        response = await supabase_request(
            "GET",
            f"delivery_zones?tenant_id=eq.{TENANT_ID}&order=zone_name.asc",
            use_service_key=True
        )
        return {"zones": response.json() if response.status_code == 200 else []}
    except Exception as e:
        logger.error(f"Get zones error: {e}")
        return {"zones": []}

@api_router.post("/admin/delivery-zones")
async def create_delivery_zone(zone: Dict[str, Any]):
    """Create a delivery zone"""
    try:
        zone['id'] = str(uuid.uuid4())
        zone['tenant_id'] = TENANT_ID
        zone['branch_id'] = BRANCH_ID
        zone['created_at'] = datetime.now(timezone.utc).isoformat()
        
        response = await supabase_request("POST", "delivery_zones", zone, use_service_key=True)
        
        if response.status_code not in [200, 201]:
            raise HTTPException(status_code=500, detail="Failed to create zone")
        
        return {"success": True, "zone": response.json()[0] if response.json() else zone}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create zone error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/admin/delivery-zones/{zone_id}")
async def update_delivery_zone(zone_id: str, zone: Dict[str, Any]):
    """Update a delivery zone"""
    try:
        zone['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        await supabase_request(
            "PATCH",
            f"delivery_zones?id=eq.{zone_id}&tenant_id=eq.{TENANT_ID}",
            zone,
            use_service_key=True
        )
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Update zone error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/delivery-zones/{zone_id}")
async def delete_delivery_zone(zone_id: str):
    """Delete a delivery zone"""
    try:
        await supabase_request(
            "DELETE",
            f"delivery_zones?id=eq.{zone_id}&tenant_id=eq.{TENANT_ID}",
            use_service_key=True
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Delete zone error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== COUPONS ====================

@api_router.get("/admin/coupons")
async def get_coupons():
    """Get all coupons"""
    try:
        response = await supabase_request(
            "GET",
            f"coupons?tenant_id=eq.{TENANT_ID}&order=created_at.desc",
            use_service_key=True
        )
        return {"coupons": response.json() if response.status_code == 200 else []}
    except Exception as e:
        logger.error(f"Get coupons error: {e}")
        return {"coupons": []}

@api_router.post("/admin/coupons")
async def create_coupon(coupon: Dict[str, Any]):
    """Create a coupon"""
    try:
        coupon['id'] = str(uuid.uuid4())
        coupon['tenant_id'] = TENANT_ID
        coupon['created_at'] = datetime.now(timezone.utc).isoformat()
        
        response = await supabase_request("POST", "coupons", coupon, use_service_key=True)
        
        if response.status_code not in [200, 201]:
            raise HTTPException(status_code=500, detail="Failed to create coupon")
        
        return {"success": True, "coupon": response.json()[0] if response.json() else coupon}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create coupon error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str):
    """Delete a coupon"""
    try:
        await supabase_request(
            "DELETE",
            f"coupons?id=eq.{coupon_id}&tenant_id=eq.{TENANT_ID}",
            use_service_key=True
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Delete coupon error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== LOYALTY ====================

@api_router.get("/admin/loyalty-settings")
async def get_loyalty_settings():
    """Get loyalty settings"""
    try:
        response = await supabase_request(
            "GET",
            f"loyalty_settings?tenant_id=eq.{TENANT_ID}",
            use_service_key=True
        )
        settings = response.json() if response.status_code == 200 else []
        return {"settings": settings[0] if settings else None}
    except Exception as e:
        logger.error(f"Get loyalty settings error: {e}")
        return {"settings": None}

@api_router.post("/admin/loyalty-settings")
async def save_loyalty_settings(settings: Dict[str, Any]):
    """Save loyalty settings"""
    try:
        settings['tenant_id'] = TENANT_ID
        settings['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        existing = await supabase_request(
            "GET",
            f"loyalty_settings?tenant_id=eq.{TENANT_ID}",
            use_service_key=True
        )
        
        if existing.status_code == 200 and existing.json():
            await supabase_request(
                "PATCH",
                f"loyalty_settings?tenant_id=eq.{TENANT_ID}",
                settings,
                use_service_key=True
            )
        else:
            settings['id'] = str(uuid.uuid4())
            settings['created_at'] = datetime.now(timezone.utc).isoformat()
            await supabase_request("POST", "loyalty_settings", settings, use_service_key=True)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Save loyalty settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/loyalty-rules")
async def get_loyalty_rules():
    """Get loyalty rules"""
    try:
        response = await supabase_request(
            "GET",
            f"loyalty_rules?tenant_id=eq.{TENANT_ID}&order=created_at.asc",
            use_service_key=True
        )
        return {"rules": response.json() if response.status_code == 200 else []}
    except Exception as e:
        logger.error(f"Get loyalty rules error: {e}")
        return {"rules": []}

@api_router.post("/admin/loyalty-rules")
async def create_loyalty_rule(rule: Dict[str, Any]):
    """Create a loyalty rule"""
    try:
        rule['id'] = str(uuid.uuid4())
        rule['tenant_id'] = TENANT_ID
        rule['created_at'] = datetime.now(timezone.utc).isoformat()
        
        response = await supabase_request("POST", "loyalty_rules", rule, use_service_key=True)
        
        return {"success": True, "rule": response.json()[0] if response.json() else rule}
    except Exception as e:
        logger.error(f"Create loyalty rule error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== SYSTEM SETTINGS ====================

@api_router.get("/admin/settings")
async def get_system_settings():
    """Get system settings"""
    try:
        response = await supabase_request(
            "GET",
            f"system_settings?tenant_id=eq.{TENANT_ID}&branch_id=eq.{BRANCH_ID}",
            use_service_key=True
        )
        settings = response.json() if response.status_code == 200 else []
        return {"settings": settings[0] if settings else None}
    except Exception as e:
        logger.error(f"Get settings error: {e}")
        return {"settings": None}

@api_router.post("/admin/settings")
async def save_system_settings(settings: Dict[str, Any]):
    """Save system settings"""
    try:
        settings['tenant_id'] = TENANT_ID
        settings['branch_id'] = BRANCH_ID
        settings['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        existing = await supabase_request(
            "GET",
            f"system_settings?tenant_id=eq.{TENANT_ID}&branch_id=eq.{BRANCH_ID}",
            use_service_key=True
        )
        
        if existing.status_code == 200 and existing.json():
            await supabase_request(
                "PATCH",
                f"system_settings?tenant_id=eq.{TENANT_ID}&branch_id=eq.{BRANCH_ID}",
                settings,
                use_service_key=True
            )
        else:
            settings['id'] = str(uuid.uuid4())
            settings['created_at'] = datetime.now(timezone.utc).isoformat()
            await supabase_request("POST", "system_settings", settings, use_service_key=True)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Save settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/api-keys")
async def save_api_key(request: Dict[str, Any]):
    """Save API key for payment providers"""
    try:
        key_data = {
            "id": str(uuid.uuid4()),
            "tenant_id": TENANT_ID,
            "provider": request.get('provider'),
            "api_key": request.get('api_key'),
            "api_secret": request.get('api_secret'),
            "is_test": request.get('is_test', True),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await supabase_request(
            "DELETE",
            f"payment_providers?tenant_id=eq.{TENANT_ID}&provider=eq.{request.get('provider')}",
            use_service_key=True
        )
        
        await supabase_request("POST", "payment_providers", key_data, use_service_key=True)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Save API key error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/api-keys/test")
async def test_api_key(request: Dict[str, Any]):
    """Test API key format"""
    try:
        api_key = request.get('api_key', '')
        if not api_key or len(api_key) < 10:
            return {"success": False, "message": "API key too short"}
        
        return {"success": True, "message": "API key format valid"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# ==================== PRINTER ENDPOINTS ====================

@api_router.get("/admin/printers")
async def get_printers():
    """Get printer configurations"""
    try:
        response = await supabase_request(
            "GET",
            f"printers?tenant_id=eq.{TENANT_ID}&branch_id=eq.{BRANCH_ID}",
            use_service_key=True
        )
        return {"printers": response.json() if response.status_code == 200 else []}
    except Exception as e:
        logger.error(f"Get printers error: {e}")
        return {"printers": []}

@api_router.post("/admin/printers")
async def save_printer(printer: Dict[str, Any]):
    """Save printer configuration"""
    try:
        printer['tenant_id'] = TENANT_ID
        printer['branch_id'] = BRANCH_ID
        printer['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        if printer.get('id'):
            await supabase_request(
                "PATCH",
                f"printers?id=eq.{printer['id']}&tenant_id=eq.{TENANT_ID}",
                printer,
                use_service_key=True
            )
        else:
            printer['id'] = str(uuid.uuid4())
            printer['created_at'] = datetime.now(timezone.utc).isoformat()
            await supabase_request("POST", "printers", printer, use_service_key=True)
        
        return {"success": True, "printer": printer}
    except Exception as e:
        logger.error(f"Save printer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/printers/{printer_id}")
async def delete_printer(printer_id: str):
    """Delete a printer"""
    try:
        await supabase_request(
            "DELETE",
            f"printers?id=eq.{printer_id}&tenant_id=eq.{TENANT_ID}",
            use_service_key=True
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Delete printer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== REPORTS ====================

@api_router.get("/admin/reports/orders")
async def get_orders_report(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get orders report"""
    try:
        endpoint = f"orders?tenant_id=eq.{TENANT_ID}&branch_id=eq.{BRANCH_ID}&order=created_at.desc"
        if start_date:
            endpoint += f"&created_at=gte.{start_date}T00:00:00"
        if end_date:
            endpoint += f"&created_at=lte.{end_date}T23:59:59"
        
        response = await supabase_request("GET", endpoint, use_service_key=True)
        orders = response.json() if response.status_code == 200 else []
        
        # Normalize and calculate summary
        for order in orders:
            order['total'] = order.get('total_amount', 0)
        
        total_sales = sum(o.get('total_amount', 0) for o in orders)
        total_orders = len(orders)
        avg_order = total_sales / total_orders if total_orders > 0 else 0
        
        return {
            "orders": orders,
            "summary": {
                "total_orders": total_orders,
                "total_sales": total_sales,
                "average_order": avg_order
            }
        }
    except Exception as e:
        logger.error(f"Orders report error: {e}")
        return {"orders": [], "summary": {}}

@api_router.get("/admin/audit-logs")
async def get_audit_logs(limit: int = 100):
    """Get audit logs"""
    try:
        response = await supabase_request(
            "GET",
            f"audit_logs?tenant_id=eq.{TENANT_ID}&order=created_at.desc&limit={limit}",
            use_service_key=True
        )
        return {"logs": response.json() if response.status_code == 200 else []}
    except Exception as e:
        logger.error(f"Audit logs error: {e}")
        return {"logs": []}

# ==================== RECEIPT ====================

@api_router.get("/receipt/{order_id}")
async def get_receipt_data(order_id: str):
    """Get receipt data for an order"""
    try:
        order = await get_order(order_id)
        order['branch_name'] = "Al-Katem & Al-Bukhari Palace"
        order['branch_name_ar'] = "قصر الكاظم والبخاري"
        order['generated_by'] = "RIWA POS"
        return order
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Receipt error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/")
async def root():
    return {"message": "RIWA POS API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
