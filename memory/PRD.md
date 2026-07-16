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
- Products — CRUD + drag-drop Excel/CSV import (template download), upsert by SKU; plus Categories, Brands, Units, Stock Adjustment, Stock Transfer sub-pages
- POS Kasir — bento grid by category, search, cart +/-, discount, tax, 3 payment methods (Cash / QRIS / E-wallet OVO·DANA·ShopeePay·LinkAja), receipt dialog with QR + PDF download
- Sales — orders table dengan filter status, per-row PDF receipt (thermal 80mm) + invoice (A4)
- Inventory — Stock Overview, Stock Movement, Inventory Valuation, Low Stock, Dead Stock
- Purchase — Purchase Orders, Goods Receiving, Supplier Invoices; Supplier list (CRUD)
- Customers — Customer CRUD (dedupe by phone), Membership tiers (min-points + discount %), Loyalty Rules config; Debt Receivables (piutang) & Payables (hutang)
- Staff — Staff Management, Roles, Permissions, Attendance
- Branches — multi-branch management
- Reports — 6 subtabs: Sales, Product, Inventory, Profit/Loss, Cashflow, Tax (detail di bawah)
- Settings — Payment Config (Cash/QRIS/E-wallet/EDC tabs), Printer (Mode A/B), Integrations (WhatsApp, Xendit), general Settings, Billing

### Backend
- `routes_auth.py`, `routes_products.py` (CRUD + bulk-import), `routes_orders.py` (payment-first order creation, stock decrement + payment dispatch), `routes_webhooks.py` (Xendit + WhatsApp, both signature-verified), `routes_pdf.py` (thermal + A4), `routes_pricing.py` (tiers + addons), `routes_customers.py` (customers/memberships/loyalty/debt), `routes_staff.py`, `routes_purchase.py`, `routes_inventory.py`, `routes_reports.py`, `routes_settings.py`, `routes_edc.py`, `routes_printer.py`, `xendit_client.py`, `whatsapp_client.py`, `edc_provider.py`, `escpos.py`

### Integrations LIVE-Tested
- **Xendit Test Mode** — real `XENDIT_SECRET_KEY` + `XENDIT_WEBHOOK_TOKEN` + `XENDIT_CALLBACK_URL` plugged
  - QRIS Dynamic: real `qr_id` issued, end-to-end webhook → order `paid` verified
  - E-wallet: needs client to set callback URL in Xendit dashboard (Settings → Developers → Callbacks → E-Wallets) → `https://dagangos-features.preview.emergentagent.com/api/webhooks/xendit`
  - Payment gateway call now happens *before* stock is decremented and the order is inserted — a failed QRIS/e-wallet call fails closed with a clear 502 + Indonesian error message, instead of silently leaving a "pending forever" order with stock already gone (fixed after a prior silent-success bug)
- **WhatsApp Cloud API (Meta)** — per-tenant, BYO (each store connects its own WABA/App in Settings → Integrasi: `phone_number_id`, `access_token`, `app_secret`, `webhook_verify_token`, receipt/PO templates). Sends automatic order receipts on checkout (if customer phone present) and PO notifications to suppliers via Meta template messages. Inbound webhook does per-tenant HMAC-SHA256 signature verification, routed by `phone_number_id`, fails closed if no secret configured. "Tes Kirim WhatsApp" button in Integrasi to verify config. **Caveat: real sending is blocked until each store owner gets their custom templates (`dagangos_order_receipt`, `dagangos_po_notify`) approved in Meta Business Manager** — wiring is complete, first send is gated on that external approval.
- **EDC (kartu debit/kredit via mesin EDC)** — pluggable provider architecture for BCA, Mandiri, BRI, BNI. All four are currently `NotConfiguredProvider` and clearly show "Belum Tersedia" in the UI (bank SDK + certification not yet integrated) — selecting one only saves a preference, never silently pretends to charge. Charge flow has race-condition protection (atomic claim via `find_one_and_update`, 409 on concurrent retry, auto-release on failure).
- **ESC/POS thermal printing** — Mode A (`local`, browser's native print) and Mode B (`network`, backend builds raw ESC/POS bytes, a local Python bridge app (`printer-bridge/bridge.py`, stdlib-only) forwards them to the LAN printer over TCP:9100, with origin allowlisting).
- **Stripe** — deferred per client decision

### Reporting engine — real data, mixed completeness
- **Profit/Laba Rugi**, **Cashflow/Arus Kas**, **Inventory turnover**, **Product report** — fully real, computed from `orders`/`products`/`expenses` collections (documented simplification: COGS uses current product cost, not cost-at-sale-time snapshot)
- **Sales tab** — real weekly total, but per-day distribution within the week uses hardcoded percentages rather than actual daily breakdown
- **Tax tab** — still a stub: PPN 11% computed client-side off monthly sales, no backend tax endpoint, "Unduh e-Faktur CSV" button is a non-functional placeholder

## Deployment Readiness
- All env vars via `os.environ.get`/dotenv, no hardcoded secrets
- Frontend uses `process.env.REACT_APP_BACKEND_URL`
- CORS, MongoDB, supervisor config all valid
- Console statements gated with `NODE_ENV !== 'production'`
- **2026-07-16 incident, resolved:** every deploy since ~Jul 12 had been silently failing at the CRA build step (`html-minifier-terser` choked on an inline PostHog script in `public/index.html`), leaving production on a stale build for several days without anyone aware. Fixed by disabling `minifyJS` on the HTML-minify pass in `craco.config.js` (same fix applied to DapurOS, which had the identical bug). Also fixed a separate Cloudflare Worker bug (`src/index.js`) that turned browser cache-revalidation `304` responses into hard `404`s for the app's own JS/CSS bundle, causing deterministic blank-page failures on 3 of the app's pages.
- A non-blocking `e2e-geraina` job now runs the Playwright suite against production after every deploy (`.github/workflows/deploy.yml`), giving automated confirmation that the app actually renders post-deploy — this caught both bugs above.

## Tech Stack
- Backend: FastAPI + Motor (async MongoDB) + ReportLab + Pandas + httpx + bcrypt + pyjwt
- Frontend: React 19 + react-router 7 + Tailwind (custom tokens, Cabinet Grotesk + Figtree) + axios + qrcode.react + lucide-react
- DB: MongoDB (collections: users, stores, products, orders, counters, customers, memberships, staff, branches, expenses)

## Test Credentials
See `/app/memory/test_credentials.md`. Default: `owner@geraina.com` / `geraina123`.

## Open Backlog
- Loyalty points / membership discounts are configured but **not yet applied automatically at POS checkout** — the checkout flow doesn't currently look up or award loyalty/membership on an order
- WhatsApp send is fully wired but blocked per-tenant until each store's message templates are approved by Meta
- EDC (BCA/Mandiri/BRI/BNI) is a stubbed architecture — real charging requires each bank's SDK + merchant certification, none integrated yet
- Sales report's per-day breakdown is estimated (hardcoded weekday percentages), not real daily aggregation
- Tax report has no real backend computation or e-Faktur export — currently a client-side estimate + non-functional export button
- Stripe Checkout multi-currency untuk turis (deferred)
- Real-time WebSocket order updates (currently polls 3.5s)
- PWA offline mode
