# RIWA POS - Product Requirements Document

## Project Overview
**Name:** RIWA POS - Al-Katem & Al-Bukhari Palace
**Type:** Production POS System for Kuwait Restaurant
**Tech Stack:** React + FastAPI + Supabase (existing database)

## Original Problem Statement
Build a production-ready POS system with:
- Main index page with two large tiles (POS and Admin)
- /pos route for cashier with PIN/email login, order creation, KDS
- /admin route for full management including orders inbox, menu manager, delivery zones, reports
- Bilingual EN/AR support with RTL
- Real-time Supabase subscriptions
- Network printer support for Kuwait restaurant printers

## User Personas
1. **Cashier** - Uses PIN login, creates orders via POS terminal, views KDS
2. **Kitchen Staff** - Views KDS, bumps items when ready
3. **Admin/Manager** - Full access to admin panel, orders, menu management, reports

## Core Requirements (Static)
- ✅ Landing page with POS and Admin tiles
- ✅ POS login (PIN and Email)
- ✅ Admin login (Email/Password via Supabase Auth)
- ✅ POS Terminal with categories, items, cart, payment
- ✅ KDS with station filtering and buzzer alerts
- ✅ Admin Dashboard with stats
- ✅ Admin Orders inbox with real-time updates
- ✅ Menu Manager (Categories, Items)
- ✅ Delivery Zones with polygon drawing (Leaflet)
- ✅ Coupons CRUD
- ✅ Loyalty Program settings
- ✅ Printer/Device configuration
- ✅ API Keys management (UI only)
- ✅ Reports with CSV export
- ✅ Bilingual EN/AR with RTL support
- ✅ Offline queue with IndexedDB sync

## What's Been Implemented (January 2026)
### Backend (FastAPI)
- Authentication endpoints (PIN login, Email login via Supabase)
- Menu endpoints (categories, items with normalization for existing DB)
- Order CRUD with KDS item creation
- Admin endpoints (dashboard, settings, printers, coupons, loyalty, zones)
- Health check endpoint

### Frontend (React)
- Landing page with POS/Admin tiles
- POS Login with PIN pad and email form
- POS Terminal with full order flow
- KDS with station filtering and buzzer
- POS Settings with printer config
- Admin Login
- Admin Layout with sidebar navigation
- Admin Dashboard with stats cards
- Admin Orders with real-time polling and status updates
- Admin Menu Manager (Categories, Items CRUD)
- Admin Delivery Zones with Leaflet map
- Admin Coupons CRUD
- Admin Loyalty Settings
- Admin Devices/Printers config
- Admin Settings (General, Receipt, API Keys)
- Admin Reports with CSV export

### Database Compatibility
- Works with existing Supabase database
- Normalized field names (name_en → name)
- Fallback tenant support for existing data
- PIN authentication supporting plain text PINs

## Prioritized Backlog

### P0 (Critical) - Done
- ✅ Authentication flows
- ✅ Menu display
- ✅ Order creation
- ✅ Basic admin functions

### P1 (High Priority) - Next
- [ ] Order variants and modifiers display
- [ ] Receipt printing via network printer
- [ ] Real-time Supabase subscriptions (currently polling)
- [ ] Order tracking page

### P2 (Medium Priority)
- [ ] PDF receipt generation
- [ ] Coupon validation in POS
- [ ] Loyalty points calculation
- [ ] Customer management

### P3 (Low Priority)
- [ ] Advanced reporting/analytics
- [ ] Multi-branch support
- [ ] Inventory management

## Next Tasks
1. Test order creation flow end-to-end
2. Implement real Supabase realtime subscriptions
3. Add network printer test functionality
4. Create order tracking page for customers
