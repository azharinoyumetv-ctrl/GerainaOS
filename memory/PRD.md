# Geraina POS by DagangOS — PRD

## Problem Statement
Build a SaaS POS (Point of Sale) for Indonesian SMEs (UMKM): warung kopi, butik fashion, retail, F&B. Affordable but premium-feeling, supports QRIS + e-wallet payments (Xendit), PDF receipts/invoices, multi-tenant (per-store), 14-day trial.

## Implemented (Jan 2026, Phase 1 from scratch)

### Public site
- **Landing page** (`/`) — hero with Indonesian young-entrepreneur Unsplash image, feature grid, pricing teaser (4 tiers), final CTA, footer
- **Pricing page** (`/pricing`) — 4 public tiers (Trial / Starter Rp 99K / Growth Rp 249K / Enterprise) with Growth highlighted as "Paling Populer", FAQ accordion
- **Login / Register** — JWT-based custom auth, bcrypt password hashing, store auto-creation on register with 14-day trial

### Authenticated app (`/app/*`)
- **Dashboard** — KPI stats (today/week/month sales), recent orders, trial upgrade banner with days-remaining, sidebar with logout
- **Products** — CRUD table + drag-drop **Excel/CSV import** (with template download), per-row edit/delete
- **POS Kasir** — bento product grid by category, search, cart with qty +/-, discount, tax%, 3 payment methods (Cash / QRIS / E-wallet OVO·DANA·ShopeePay·LinkAja), receipt dialog with QR display + PDF thermal/invoice download + auto-poll status
- **Sales (Penjualan)** — orders table with status filter, per-row PDF receipt (thermal 80mm) + invoice (A4) download

### Backend (FastAPI)
- `routes_auth.py` — register/login/me, JWT (HS256), bcrypt
- `routes_products.py` — CRUD + `/bulk-import` (xlsx/csv via pandas) + CSV template
- `routes_orders.py` — checkout with stock decrement, payment method dispatch, stats aggregation
- `routes_webhooks.py` — `/api/webhooks/xendit` (x-callback-token verified), `/simulate` dev hook
- `routes_pdf.py` — thermal 80mm receipt + A4 invoice via ReportLab
- `routes_pricing.py` — public pricing tiers
- `xendit_client.py` — QRIS dynamic + e-wallet charge, **mock fallback** when key not real (graceful demo)

### Integrations
- **Xendit** — QRIS dynamic + e-wallet (OVO/DANA/ShopeePay/LinkAja) with webhook callback handling. Mock-mode active when `XENDIT_SECRET_KEY` is placeholder so demo works without real Xendit account.
- **Stripe** — **DEFERRED** per user instruction

## Tech Stack
- Backend: FastAPI + Motor (async MongoDB) + ReportLab + Pandas + httpx
- Frontend: React 19 + react-router 7 + Tailwind (custom tokens, Cabinet Grotesk + Figtree fonts) + axios + qrcode.react + lucide-react
- DB: MongoDB (collections: users, stores, products, orders, counters)

## Test Credentials
See `/app/memory/test_credentials.md`. Default: `owner@geraina.com` / `geraina123` (created on first register call; testing agent should register fresh or login).

## P1 Backlog (not in this iteration)
- Stripe Checkout multi-currency (tourist payments)
- Real-time WebSocket order updates (instead of polling)
- Multi-cashier user management UI (admin can add cashiers)
- Reports page (top products, profit by category)
- Customer database + loyalty
- Receipt printing direct to thermal printer (ESC/POS)

## P2 Backlog
- Email notifications (SendGrid)
- WhatsApp receipt delivery (Twilio)
- Offline mode (PWA cache)
- Mobile app wrapper (Capacitor)
