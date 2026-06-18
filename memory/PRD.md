# Geraina POS by DagangOS — PRD

## Problem Statement
SaaS POS untuk UMKM Indonesia (warung kopi, retail, F&B, toko kue, butik). Affordable tapi premium-feeling, support QRIS + e-wallet (Xendit), PDF receipt/invoice, multi-tenant per-store, 14-hari trial.

## FINAL Pricing (locked — DO NOT MODIFY without explicit client approval)

| Paket          | Bulanan       | Tahunan        | Catatan                  |
| -------------- | ------------- | -------------- | ------------------------ |
| Free Trial     | Gratis        | 14 hari        | 1 outlet, limited        |
| Starter        | Rp 99.000     | Rp 990.000     | Small warung/toko        |
| **Pro**        | **Rp 249.000**| **Rp 2.490.000**| **Main package** (highlighted) |
| Business       | Rp 499.000    | Rp 4.990.000   | Bigger store, multi-kasir|
| Multi-Branch   | Rp 799.000+   | Custom         | Multiple branches        |

**Add-ons:**
- Extra device: Rp 49.000/bulan
- Extra branch: Rp 199.000/bulan
- Remote setup: Rp 499.000 one-time
- Product import setup: Rp 499.000–999.000 one-time
- On-site setup: Rp 1.000.000–3.000.000 + transport, one-time

## Implemented
### Public site
- Landing (`/`) — hero pakai asset client (`customer-assets.../0kij0lxo_*.png`), features grid, pricing teaser 5 tier, CTA, footer
- Pricing (`/pricing`) — 5 tier dengan monthly/yearly toggle (Hemat ~17% badge), Pro highlighted "Paling Direkomendasikan", section Add-ons, FAQ accordion
- Login / Register — JWT auth, bcrypt, register auto-create store + 14-day trial

### Authenticated app (`/app/*`)
- Dashboard — KPI stats, recent orders, trial upgrade banner with days-remaining
- Products — CRUD + drag-drop Excel/CSV import (template download), upsert by SKU
- POS Kasir — bento grid by category, search, cart +/-, discount, tax, 3 payment methods (Cash / QRIS / E-wallet OVO·DANA·ShopeePay·LinkAja), receipt dialog with QR + PDF download
- Sales — orders table dengan filter status, per-row PDF receipt (thermal 80mm) + invoice (A4)

### Backend
- `routes_auth.py`, `routes_products.py` (CRUD + bulk-import), `routes_orders.py` (stock decrement + payment dispatch), `routes_webhooks.py` (Xendit token-verified), `routes_pdf.py` (thermal + A4), `routes_pricing.py` (tiers + addons), `xendit_client.py` (live API with mock fallback)

### Integrations LIVE-Tested
- **Xendit Test Mode** — real `XENDIT_SECRET_KEY` + `XENDIT_WEBHOOK_TOKEN` + `XENDIT_CALLBACK_URL` plugged
  - QRIS Dynamic: real `qr_id` issued, end-to-end webhook → order `paid` verified
  - E-wallet: needs client to set callback URL in Xendit dashboard (Settings → Developers → Callbacks → E-Wallets) → `https://dagangos-features.preview.emergentagent.com/api/webhooks/xendit`
- **Stripe** — deferred per client decision

## Deployment Readiness — PASS ✅
- All env vars via `os.environ.get`/dotenv, no hardcoded secrets
- Frontend uses `process.env.REACT_APP_BACKEND_URL`
- CORS, MongoDB, supervisor config all valid
- Console statements gated with `NODE_ENV !== 'production'`
- Frontend compiles clean (zero warnings)

## Tech Stack
- Backend: FastAPI + Motor (async MongoDB) + ReportLab + Pandas + httpx + bcrypt + pyjwt
- Frontend: React 19 + react-router 7 + Tailwind (custom tokens, Cabinet Grotesk + Figtree) + axios + qrcode.react + lucide-react
- DB: MongoDB (collections: users, stores, products, orders, counters)

## Test Credentials
See `/app/memory/test_credentials.md`. Default: `owner@geraina.com` / `geraina123`.

## Open Backlog
- Stripe Checkout multi-currency untuk turis (deferred)
- Real-time WebSocket order updates (currently polls 3.5s)
- Multi-cashier admin UI
- Reports page (top products, profit per kategori, low stock)
- Customer DB + loyalty
- WhatsApp/Email receipt delivery
- Direct ESC/POS thermal printer
- PWA offline mode
