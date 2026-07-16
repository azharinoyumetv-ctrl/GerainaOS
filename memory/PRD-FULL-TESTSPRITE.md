# Geraina POS by DagangOS — Full Technical PRD (for TestSprite)

**Purpose of this document:** this is a complete, implementation-level PRD intended to drive automated test generation (TestSprite). It documents every module's user flows, API contracts, UI selectors (`data-testid`), validation rules, and — critically — every known bug or intentionally-mocked/stubbed behavior discovered during a full codebase audit. Sections marked **KNOWN BUG** or **MOCKED/STUB** describe *actual current behavior*, not desired behavior — a correct test suite should assert this behavior exists (regression-lock the bug) or explicitly flag it as failing, depending on what the tester wants to track.

For a short executive summary instead of this full spec, see `memory/PRD.md` in the same repo.

---

## 1. Product Overview

Geraina POS is a multi-tenant SaaS point-of-sale system for Indonesian SMBs (warung, retail, F&B, bakeries, boutiques). Each registered account owns exactly one "store" per product module (Geraina vs. the sibling DapurOS restaurant product), scoped by an `X-DagangOS-Module` header. Core value props: QRIS + e-wallet payments via Xendit, PDF/thermal receipts, product/inventory management, and a 14-day free trial with tiered paid plans.

**Production URL:** `https://dagangos.com/geraina/*` (frontend), `https://dagangos.com/api/*` (backend, proxied through a Cloudflare Worker to the FastAPI backend on Vercel).

---

## 2. Architecture & Environment

- **Base API URL:** `${BACKEND_URL}/api` — production resolves to `https://dagangos.com/api`.
- **Auth:** every authenticated request sends `Authorization: Bearer <JWT>` — token is read from `localStorage["geraina_token"]`, falling back to `localStorage["dagangos_token"]`.
- **Tenant/module routing:** every request also sends `X-DagangOS-Module: geraina` — this tells the backend which store (Geraina vs DapurOS) to resolve for the current user. A user can have separate stores per module under one login.
- **No-store guard:** if the backend returns `409` with `detail: "no_store_for_module"`, the frontend's axios interceptor (`frontend/src/api/client.js`) hard-redirects to `/geraina/activate` so the user can create a Geraina store under their existing account.
- **Frontend routing:** all authenticated app routes live under `/geraina/app/*`, and are also duplicated (same route set, same components) under `/geraina/dashboard/*`, `/geraina/pos/*`, `/geraina/products/*`, etc., and a bare `/app/*` fallback — all resolve through one shared `getGerainaAppSubRoutes()` array defined once in `frontend/src/App.js`. Every route is wrapped in `<RoleGuard>`, which shows a `data-testid="auth-loading"` placeholder while `GET /auth/me` resolves the session.
- **Tech stack:** Backend = FastAPI + Motor (async MongoDB) + ReportLab (PDF) + Pandas (bulk import) + httpx + bcrypt + pyjwt. Frontend = React 19 + react-router 7 + Tailwind (custom tokens) + axios + qrcode.react + lucide-react. Database = MongoDB (collections: `users`, `stores`, `products`, `orders`, `counters`, `customers`, `memberships`, `staff`, `branches`, `expenses`, `debt_receivables`, `debt_payables`, `purchase_orders`, `goods_receiving`, `supplier_invoices`, `whatsapp_inbound`, `upgrade_requests`).

---

## 3. Auth & Session

### 3.1 Endpoints (`backend/routes_auth.py`, prefix `/api/auth`)

| Method | Path | Auth | Body | Response | Errors |
|---|---|---|---|---|---|
| POST | `/register` | none | `{email, password (min 6 chars), store_name}` + header `X-DagangOS-Module` (default `geraina`) | `Token{access_token, token_type:"bearer", user:{id,email,name,role,store_id,store_name,trial_ends_at,plan}}` | 400 `"Email sudah terdaftar"` |
| POST | `/login` | none | `{email, password}` | `Token{...}` | 401 `"Email atau password salah"` |
| POST | `/token` | none | OAuth2 form (`username`,`password`) — Swagger/OAuth2PasswordBearer flow | `Token{...}` | 401 same |
| GET | `/me` | Bearer | — | user public fields + `stores:[{store_id,name,module}]` | 401 invalid token |
| GET | `/stores` | Bearer | — | `[{store_id,name,module}]` | |
| POST | `/stores` | Bearer | `{module, store_name}` | `{store_id,name,module}` | 400 empty name; 409 `"Anda sudah memiliki toko untuk modul ini"` |

**Business logic:** registering creates a new store doc + seeds default units (Pcs/Box/Botol/Kilogram/Gram/Mililiter) and a default settings doc — deliberately no demo products/categories/staff/payment keys (clean-start policy). JWT payload: `{sub:user_id, store_id, role, email, iat, exp}`, HS256, expires in `JWT_EXPIRE_MINUTES` (default 1440 min / 24h). `get_current_user` resolves the *active store* per request from the `X-DagangOS-Module` header — the same user account can own separate stores per module.

### 3.2 Frontend

- **Login** (`Login.jsx`, routes `/login`, `/geraina/login`): testids `login-side, login-form, login-email-label, login-email-input, login-password-label, login-password-input, login-error, login-submit-btn, login-to-register-link`. Both fields `required`; email uses `type=email`; no client regex beyond native HTML5. Success → navigate to `/geraina/app/dashboard`.
- **Register** (`Register.jsx`, routes `/register`, `/geraina/register`): testids `register-form, register-store-input, register-email-input, register-password-input, register-error, register-submit-btn, register-to-login-link`. Password `minLength={6}` client-side, mirroring backend.
- **Activate** (`Activate.jsx`, route `/geraina/activate`, requires existing auth): testids `activate-page, activate-form, activate-store-name, activate-error, activate-submit`. Calls `POST /auth/stores {module:"geraina", store_name}`. Submit disabled if name is empty/whitespace or request in-flight. Has a logout button clearing `geraina_token, dagangos_token, dapuros_token, dagangos_user, geraina_user` from localStorage → redirects to `/login`.

### 3.3 RBAC model

There is no fine-grained permission system despite the UI suggesting one (see §11 Staff). The only enforced role check is `require_admin` (role must be `"admin"` or `"Owner"`), which gates exactly these endpoints:
- `POST /orders/{id}/mark-paid`
- `POST /orders/{id}/void`
- `POST /integrations/whatsapp/test`
- `POST /pricing/upgrade`

Every other authenticated endpoint only checks that the JWT is valid and resolves to a store — **any logged-in role (Cashier, Manager, Warehouse) can call any non-admin-gated endpoint**, including deleting products, deleting branches, or changing payment configuration. This is a real test target: verify a Cashier-role token can/cannot perform actions the UI implies are restricted.

---

## 4. Products Module

### 4.1 Endpoints (`backend/routes_products.py`, prefix `/api/products`)

| Method | Path | Auth | Body | Response | Errors |
|---|---|---|---|---|---|
| GET | `/?q=&category=&limit=500` | Bearer | — | `Product[]` (case-insensitive regex search on name/sku/category) | |
| GET | `/category-names` | Bearer | — | `string[]` distinct category names | |
| POST | `/` | Bearer | `{name*, sku?, price* (≥0), cost (≥0, default 0), stock (≥0, default 0), category (default "Umum"), unit (default "pcs"), image_url?, description?, active (default true)}` | `Product` | 422 validation |
| PUT | `/{id}` | Bearer | partial update (any subset) | updated `Product` | 400 "Tidak ada perubahan" if empty; 404 "Produk tidak ditemukan" |
| DELETE | `/{id}` | Bearer | — | `{ok:true}` | 404 |
| POST | `/bulk-import` | Bearer | multipart `file` (.csv/.xlsx/.xls) | `{inserted,updated,skipped,errors[]}` (errors capped at 20) | 400 bad format / missing `name`+`price` columns |
| GET | `/import-template.csv` | Bearer | — | `text/csv` static template | |

**Business logic:** bulk import upserts by SKU within the store. Required headers: `name`, `price`. Optional: `sku, cost, stock, category, unit, description, image_url, active`. `active` is loosely parsed (`"false"/"0"/"no"/"f"/"n"` → false). `PUT`/`DELETE` accept either the app `id` field or a raw Mongo ObjectId as fallback lookup.

### 4.2 Sub-resources (Categories, Brands, Units, Stock Adjustment, Stock Transfer)

All under `/api/products/...`:

| Resource | GET list | POST create | PUT update | DELETE |
|---|---|---|---|---|
| Categories | `/categories` | `/categories {name*, description?}` (400 on dup) | `/categories/{id}` | `/categories/{id}` |
| Brands | `/brands` | `/brands {name*, description?}` | `/brands/{id}` | `/brands/{id}` |
| Units | `/units` | `/units {name*, short_name*}` | `/units/{id}` | `/units/{id}` |
| Stock Adjustments | `/stock-adjustments` | `/stock-adjustments {product_name*, sku?, adjustment_qty* (int), type* ("add"/"sub"), reason*, created_by*}` | — (no update endpoint) | — (no delete endpoint) |
| Stock Transfers | `/stock-transfers` | `/stock-transfers {from_branch*, to_branch*, items:[{name,qty}]*, status (default "Shipped")}` | — | — |

**Business logic:** Stock Adjustment POST *also* mutates `products.stock` via `$inc` matched by SKU (+qty if `type=="add"`, -qty otherwise) — **only if `sku` is present** on the payload; adjustments without a SKU are logged but never touch stock. Stock Transfer POST does **not** touch product stock at all — it is a pure log record (no deduction from source, no addition to destination branch).

### 4.3 Frontend

- **`Products.jsx`** (`/geraina/app/products`): testids `products-page, open-import-btn, new-product-btn, products-search, products-category-filter, products-table, products-loading, products-empty`, per-row `product-row-{id}, edit-product-{id}, delete-product-{id}`. Form modal: `product-form-modal, product-form, product-form-close, pf-name, pf-sku, pf-category, pf-price, pf-cost, pf-stock, pf-unit, pf-image-preview, pf-image-remove, pf-image-drop, pf-image-input, pf-cancel, pf-save`. Import dialog: `import-dialog, import-close, import-dropzone, import-file-input, import-browse-btn, import-selected-file, import-template-link, import-error, import-cancel, import-upload-btn, import-result, import-inserted, import-updated, import-skipped, import-errors-block, import-done-btn`.
  - Client validation: name/price required; price/cost `type=number step=0.01`. Image upload restricted to `image/*` MIME, client-resized to max 320px longest edge, re-encoded as JPEG q=0.72 (base64 data URL) — **there is no file-upload endpoint; images are inlined as base64 into the product document.** Delete uses native `window.confirm`.
- **`products/Categories.jsx`, `Brands.jsx`, `Units.jsx`** (`/geraina/app/products/{categories|brands|units}`): simple add-only forms + list. **No inline-edit UI** despite the backend supporting PUT — forms only ever POST. testids: `categories-page/category-form/category-name-input/category-desc-input/category-submit/categories-list`; `brands-page/brand-form/brand-name-input/brand-desc-input/brand-submit/brands-list`; `units-page/unit-form/unit-name-input/unit-symbol-input/unit-submit/units-list`.
- **`products/StockAdjustment.jsx`** (`/geraina/app/products/stock-adjustment`): testids `stock-adjustment-page, adjustment-form, adjustment-product-select, adjustment-submit, adjustment-list`. Validation: productId + qty required, `qty > 0` numeric — **fails silently (no error message) if invalid, submit is just a no-op.**
- **`products/StockTransfer.jsx`** (`/geraina/app/products/stock-transfer`): testids `stock-transfer-page, transfer-form, transfer-dest-select, transfer-list`. Blocks submit silently if `fromBranch === toBranch` (no error shown). **`fromBranch` is a hardcoded, read-only text input** ("Outlet Utama (Jakarta)") — not sourced from the real `/branches` list.

---

## 5. Orders / POS Module

### 5.1 Endpoints (`backend/routes_orders.py`, prefix `/api/orders`)

| Method | Path | Auth | Body | Response | Errors |
|---|---|---|---|---|---|
| POST | `/` | Bearer | `{items:[{product_id,name,price,quantity≥1,subtotal}]*, payment_method* ("cash"\|"qris"\|"ewallet"\|"edc"), ewallet_channel? ("ID_OVO"\|"ID_DANA"\|"ID_SHOPEEPAY"\|"ID_LINKAJA"), customer_name?, customer_phone?, customer_email?, discount (default 0), tax_percent (default 0), cash_received?, note?}` | full `Order` doc | 400 "Order kosong" (empty items); 400 "Pembayaran tunai kurang" (cash_received < total); 400 "ewallet_channel wajib untuk e-wallet"; 502 QRIS/E-Wallet gateway failure with detail message |
| GET | `/?status=&limit=200` | Bearer | — | `Order[]` desc by `created_at` | |
| GET | `/stats` | Bearer | — | `{today_sales,today_orders,week_sales,week_orders,month_sales,month_orders,product_count}` | |
| GET | `/product-sales?days=30&limit=10` | Bearer | — | `[{product_id,name,sold,revenue}]` from paid orders | |
| GET | `/{id}` | Bearer | — | `Order` | 404 "Order tidak ditemukan" |
| POST | `/{id}/mark-paid` | Bearer, **admin/Owner only** | — | updated `Order` | 403 if not owner/admin; 404 |
| POST | `/{id}/void` | Bearer, **admin/Owner only** | — | `{ok:true}` or `{ok:true, already_voided:true}` | 404 |

**Business logic (critical path):**
- Stock deduction happens **only after** the payment-gateway call succeeds (or immediately for cash). If the QRIS/e-wallet gateway call throws, the order is never created and stock is never touched (502 returned). This was a deliberate fix for a prior silent-success bug where a failed gateway call left a "pending forever" order with stock already decremented.
- Calc: `subtotal = Σ item.subtotal`; `base = max(0, subtotal - discount)`; `tax_amount = base * tax_percent/100`; `total = base + tax_amount`.
- `payment_status`: `"paid"` immediately for cash; `"pending"` for qris/ewallet/edc until confirmed via webhook or manual mark-paid.
- Void (`admin/Owner` only) restores stock (increments product stock back); idempotent via `already_voided` short-circuit.
- Best-effort WhatsApp receipt auto-send on order creation if `customer_phone` set and the store's WhatsApp integration is active — wrapped in try/except, never fails the order itself.
- QRIS creation uses Xendit `create_qris`; e-wallet uses `create_ewallet_charge`, returning a checkout URL (first non-null of `desktop_web_checkout_url` / `mobile_web_checkout_url` / `mobile_deeplink_checkout_url`).

### 5.2 Frontend — `POS.jsx` (`/geraina/app/pos`)

Large testid surface:
- **Search/browse:** `pos-page, pos-search, pos-barcode-input, pos-categories, cat-all, cat-{categoryName}, pos-product-grid, pos-product-{id}, pos-no-products`.
- **Cart:** `pos-cart, pos-clear-cart, pos-customer-selector, pos-customer-dropdown, pos-selected-customer, cart-empty, cart-item-{idx}, cart-dec-{idx}, cart-qty-{idx}, cart-inc-{idx}, cart-discount, cart-tax, cart-total, cart-cash-received, cart-change`.
- **Payment method:** `pm-cash, pm-qris, pm-ewallet, pm-edc, pm-cash-details, pm-ewallet-details` + channel buttons `ew-{ID_OVO|ID_DANA|ID_SHOPEEPAY|ID_LINKAJA}`.
- **Cash keypad:** `cash-keypad, keypad-{0-9,00,back}, keypad-exact` (fills exact total), `keypad-clear`.
- **Checkout:** `checkout-btn` — disabled if cart empty, submitting, or (cash method AND `cash_received < total`).
- **Receipt dialog:** `receipt-dialog, receipt-order-no, receipt-close, receipt-status, qris-display` (renders `QRCodeSVG` of `xendit_qr_string`), `ewallet-display, ewallet-open-link, edc-display, edc-process-btn, edc-details, receipt-item-{i}, receipt-total, receipt-pdf-thermal-btn` (downloads `/pdf/receipt/{id}`), `receipt-pdf-invoice-btn` (downloads `/pdf/invoice/{id}`), `receipt-mark-paid` (owner-only — will 403 for non-owner staff), `receipt-done-btn`.
- **Barcode scanning:** dual-mode — a global hardware keyboard-wedge listener (resets buffer if inter-key gap >50ms, commits on Enter) AND a manual `pos-barcode-input` form. Both match against `product.sku` or `product.id`. No match → `alert("Produk dengan SKU/Barcode ini tidak ditemukan.")`. `scanned-overlay` toast shows for 3s after a successful scan.
- **EDC flow:** `edc-process-btn` → `POST /api/edc/orders/{id}/charge`; on failure shows an `alert()` offering manual mark-paid as fallback.
- Client validation is minimal beyond the checkout-button disabled logic — no client-side bound on negative discount/tax values (raw `type=number` inputs, no min/max attributes).

### 5.3 Frontend — `Sales.jsx` (`/geraina/app/sales`)

testids: `sales-page, sales-refresh, sales-search, sales-table, sales-loading, sales-empty`, filters `sales-filter-{all|paid|pending|failed}`, per-row `sales-row-{id}, sales-receipt-{id}, sales-invoice-{id}, sales-void-{id}`. Void → `POST /orders/{id}/void`, guarded by `window.confirm`. On 403 (non-owner) → `alert(e.response.data.detail || "Gagal membatalkan order (khusus Owner).")`.

---

## 6. Customers Module

### 6.1 Endpoints (`backend/routes_customers.py`)

| Method | Path | Auth | Body | Response | Errors |
|---|---|---|---|---|---|
| GET | `/customers` | Bearer | — | `Customer[]` by name | |
| POST | `/customers` | Bearer | `{name*, phone?, email?, membership_tier (default "Bronze"), loyalty_points (default 0), notes?}` | `Customer` | 400 "Nomor telepon pelanggan sudah ada" (dup phone, only if phone given) |
| PUT | `/customers/{id}` | Bearer | full replace of same fields | `Customer` | 404 "Pelanggan tidak ditemukan" |
| DELETE | `/customers/{id}` | Bearer | — | `{ok:true}` | 404 |
| GET | `/customers/memberships` | Bearer | — | `Membership[]` by `min_points` | |
| POST | `/customers/memberships` | Bearer | `{name*, min_points*, discount_percent*, description?}` | `Membership` | 400 "Membership tier sudah ada" |
| GET | `/customers/loyalty` | Bearer | — | `{conversion_rate=10000, point_value=100, min_redeem_points=50}` (defaults if unset) | |
| POST | `/customers/loyalty` | Bearer | full replace (upsert) | same shape | |
| GET | `/debt/receivables` | Bearer | — | `DebtReceivable[]` | |
| POST | `/debt/receivables` | Bearer | `{customer_name*, phone?, order_no*, amount*, paid_amount (default 0), due_date*, status (default "Unpaid")}` | `DebtReceivable` | 422 if required fields missing |
| GET | `/debt/payables` | Bearer | — | `DebtPayable[]` | |
| POST | `/debt/payables` | Bearer | `{supplier_name*, invoice_no*, amount*, paid_amount (default 0), due_date*, status (default "Unpaid")}` | `DebtPayable` | 422 if required fields missing |

### 6.2 KNOWN BUG — settling a debt is broken end-to-end

There is **no PUT/PATCH endpoint** for debt receivables or payables. `debt/AccountsReceivable.jsx`'s "Terima Bayar" and `debt/AccountsPayable.jsx`'s "Bayar Tagihan" both call `POST /api/debt/receivables` / `POST /api/debt/payables` with only `{id, paid_amount, status}`. Since `customer_name`/`order_no`/`amount`/`due_date` (receivables) or `supplier_name`/`invoice_no`/`amount`/`due_date` (payables) are all *required* on the Create models and are not sent, the call **422s**. There's no `.catch()` on the promise, so the "Pembayaran berhasil dicatat!" alert never fires and the user sees no feedback at all — the debt record silently never updates.

**Test target:** submit the settle flow, assert a 422 is returned by the network call, and assert the UI's debt-list amount/status is unchanged after the attempt.

### 6.3 Frontend

- **`customer/CustomerList.jsx`** (`/geraina/app/customers`): testids `customers-page, customer-form, customer-notes, customer-submit, customers-list`. No `required` HTML attributes — validation is `if (!name.trim()) return;` (silent no-op). Tier dropdown populated from `/customers/memberships`.
- **`customer/Membership.jsx`** (`/geraina/app/customers/membership`): testids `membership-page, membership-form, membership-submit, membership-list`. Silent no-op if name/minPoints/discount missing.
- **`customer/LoyaltyPoints.jsx`** (`/geraina/app/customers/loyalty`): only testid is `loyalty-page` — the 3 numeric inputs and submit button have **no testids** (selector gap). No client validation before POST.
- **`debt/AccountsReceivable.jsx`** (`/geraina/app/debt/receivable`): testids `receivables-page, receivables-list`. Settle flow uses a **native `prompt()`** dialog for the amount — not addressable via standard DOM selectors; TestSprite will need native-dialog handling or should treat this flow as effectively untestable via pure DOM automation.
- **`debt/AccountsPayable.jsx`** (`/geraina/app/debt/payable`): testids `payables-page, payables-list`. Same `prompt()`-based flow and same broken-POST bug as above.

---

## 7. Inventory Reporting Pages

None of these hit a dedicated backend "inventory" endpoint — all 5 pages derive their view client-side from `GET /products` (and, for movement/dead-stock, also `GET /orders?limit=100` and `GET /products/stock-adjustments`).

- **`inventory/StockOverview.jsx`** (`/geraina/app/inventory` and `/inventory/overview`, same component): testid `stock-overview-page`. `isLow = stock <= 5`, `isOut = stock <= 0`; status pill Habis/Menipis/Cukup.
- **`inventory/StockMovement.jsx`** (`/geraina/app/inventory/movement`): testid `stock-movement-page`. **MOCKED:** ships with 3 hardcoded `DEFAULT_MOVEMENTS` seed rows (`mov-init-1/2/3`) always prepended to the real derived list (from paid orders as "out" and adjustments as their type), sorted desc by date. These fake rows are never removed, only potentially sorted below real activity.
- **`inventory/InventoryValuation.jsx`** (`/geraina/app/inventory/valuation`): testid `inventory-valuation-page`. Client-computed: `totalAssetValue = Σ(stock*cost)`, `totalRetailValue = Σ(stock*price)`, gross-profit-potential = retail − asset.
- **`inventory/LowStock.jsx`** (`/geraina/app/inventory/low-stock`): testid `low-stock-page`. Filter `stock <= 5`. "Buat PO Baru" link to `/geraina/app/purchase/orders` only rendered if the low-stock list is non-empty.
- **`inventory/DeadStock.jsx`** (`/geraina/app/inventory/dead-stock`): testid `dead-stock-page`. **MISLABELED LOGIC:** product is "dead" if `stock > 0` AND its id doesn't appear in **any** of the most recent 100 orders — despite the UI label reading "Zero Sales 30 Hari Terakhir" (last 30 days), it's actually "never sold in the most recent 100 orders," not a real date-window query.

---

## 8. Purchase Module

### 8.1 Endpoints (`backend/routes_purchase.py`)

| Method | Path | Auth | Body | Response | Errors |
|---|---|---|---|---|---|
| GET | `/suppliers` | Bearer | — | `Supplier[]` | |
| POST | `/suppliers` | Bearer | `{name*, phone?, email?, address?}` | `Supplier` | 400 "Supplier sudah ada" |
| PUT | `/suppliers/{id}` | Bearer | same | `Supplier` | 404 |
| DELETE | `/suppliers/{id}` | Bearer | — | `{ok:true}` | 404 |
| GET | `/purchase/orders` | Bearer | — | `PurchaseOrder[]` | |
| POST | `/purchase/orders` | Bearer | `{po_no*, supplier_id*, supplier_name*, total*, status (default "Ordered")}` — **no `items` field in the model** | `PurchaseOrder` | 422 |
| GET | `/purchase/receiving` | Bearer | — | `GoodsReceiving[]` | |
| POST | `/purchase/receiving` | Bearer | `{po_no*, gr_no*, received_by*, received_at (default now)}` | `GoodsReceiving` | |
| GET | `/purchase/invoices` | Bearer | — | `SupplierInvoice[]` | |
| POST | `/purchase/invoices` | Bearer | `{invoice_no*, po_no*, amount*, status (default "Unpaid"), due_date*}` | `SupplierInvoice` | 422 |

### 8.2 KNOWN BUGS

1. **PO line items are silently discarded.** `purchase/PurchaseOrder.jsx` builds a rich `items` array client-side and includes it in the `POST /purchase/orders` payload, but `PurchaseOrderCreate` has no `items` field, so it's silently dropped by Pydantic. The PO is created with only `po_no/supplier_id/supplier_name/total/status`. **Test target:** create a PO with items, then `GET /purchase/orders` and assert no `items` key is present on the returned record.
2. **"Tandai Lunas" (mark invoice paid) is broken.** `purchase/SupplierInvoice.jsx`'s `handlePay` calls `POST /purchase/invoices` with only `{id, status:"Paid"}` — since `invoice_no/po_no/amount/due_date` are required, this 422s. Same unhandled-rejection pattern as §6.2 (no `.catch()`, alert never fires, invoice status never actually changes).

**What does work:** `POST /purchase/receiving` auto-updates the matching PO's status to `"Received"` (matched by `po_no` + `store_id`) but does **not** touch product stock — no `$inc` anywhere in goods-receiving. `POST /purchase/invoices`, if `status != "paid"` (case-insensitive), auto-creates a matching `debt_payables` record with `paid_amount:0, status:"Unpaid"`. Best-effort WhatsApp PO notification on creation (non-blocking).

### 8.3 Frontend

- **`purchase/PurchaseOrder.jsx`** (`/geraina/app/purchase`, `/purchase/orders`): testids `purchase-orders-page, po-list`. Item-add sub-form has no testids (gap). "Tambah Item" validation: productId + qty (>0 numeric) + cost (>0 numeric) required before an item joins the local `poItems` array. "Kirim PO" only renders when `poItems.length > 0` and `supplierId` set.
- **`purchase/GoodsReceiving.jsx`** (`/geraina/app/purchase/receiving`): testids `goods-receiving-page, receiving-list`. Only POs with `status === "Ordered"` are shown as receivable. `received_by` is hardcoded `"Warehouse Manager"` — not tied to the logged-in user.
- **`purchase/SupplierInvoice.jsx`** (`/geraina/app/purchase/invoices`): testid `supplier-invoice-page`. `isOverdue` flag if `due_date < today` and unpaid.
- **`supplier/SupplierList.jsx`** (`/geraina/app/suppliers`): testids `suppliers-page, supplier-form, supplier-submit, suppliers-list`.

---

## 9. Staff Module

### 9.1 Endpoints (`backend/routes_staff.py`)

| Method | Path | Auth | Body | Response | Errors |
|---|---|---|---|---|---|
| GET | `/staff` | Bearer | — | `Staff[]` | |
| POST | `/staff` | Bearer | `{name*, email* (valid), role*, phone?, status (default "Aktif")}` | `Staff` | 400 "Email staff sudah terdaftar" |
| PUT | `/staff/{id}` | Bearer | same | `Staff` | 404 |
| DELETE | `/staff/{id}` | Bearer | — | `{ok:true}` | 404 |
| GET | `/attendance` | Bearer | — | `Attendance[]` desc by `clock_in` | |
| POST | `/attendance` | Bearer | `{staff_name*, clock_in*, clock_out?, status (default "Hadir")}` | `Attendance` | |
| PUT | `/attendance/{id}` | Bearer | no body — stamps `clock_out=now` | `Attendance` | 404 "Data absensi tidak ditemukan" |

### 9.2 Important security/data behaviors

- **New staff get a hardcoded default password: `"geraina123"`.** Creating a staff record auto-creates a login credential in `users` (if the email isn't already a user). There is no forced-reset flow. **Test target:** create a staff member, log in with `password="geraina123"`, and confirm access is granted.
- Updating a staff member's role/email keeps the linked `users` record in sync.
- Deleting a staff member **hard-deletes** the linked `users` record too — the delete-confirm dialog says "menonaktifkan" (deactivate), but the actual effect is permanent deletion of both records, not a soft-deactivate. This is a UI-copy/behavior mismatch worth an explicit test.

### 9.3 Frontend

- **`staff/StaffManagement.jsx`** (`/geraina/app/staff`, `/staff/management`): testids `staff-page, staff-list` (form fields have no testids — gap). Role dropdown: Owner/Manager/Cashier/Warehouse. Status: Aktif/Non-Aktif.
- **`staff/Attendance.jsx`** (`/geraina/app/staff/attendance`): testid `attendance-page`. **BUG:** "Absen Masuk Sekarang" hardcodes `staff_name: "Azhar Owner"` regardless of who is actually logged in — every clock-in is attributed to this fixed literal string.
- **`staff/Roles.jsx`** (`/geraina/app/staff/roles`): testid `roles-page`. **Fully static/hardcoded** — 4 role descriptions from a local array, zero API calls, nothing editable.
- **`staff/Permissions.jsx`** (`/geraina/app/staff/permissions`): testid `permissions-page`. **Fully static/hardcoded** — a 13-module × 4-role permission matrix from a local JS object; checkboxes are `readOnly`/`cursor-not-allowed`. No backend endpoint backs this at all — purely informational/decorative.

---

## 10. Branches Module

### 10.1 Endpoints (`backend/routes_settings.py`)

| Method | Path | Auth | Body | Response | Errors |
|---|---|---|---|---|---|
| GET | `/branches` | Bearer | — | `Branch[]` by name | |
| POST | `/branches` | Bearer | `{name*, address?, phone?}` | `Branch` | 400 "Cabang/Outlet sudah terdaftar" |
| PUT | `/branches/{id}` | Bearer | same | `Branch` | 404 "Cabang tidak ditemukan" |
| DELETE | `/branches/{id}` | Bearer | — | `{ok:true}` | 404 |

### 10.2 Frontend

**`branches/BranchManagement.jsx`** (`/geraina/app/branches`): testids `branches-page, branches-list` (form inputs have no testids — gap). Standard add/edit/delete, `window.confirm` on delete.

---

## 11. Reports Module

### 11.1 Endpoints (`backend/routes_reports.py`, prefix `/api`)

| Method | Path | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/expenses?date_from=&date_to=` | Bearer | — | `Expense[]` (≤500) |
| POST | `/expenses` | Bearer | body `{category*, description?, amount* (>0), expense_date*}` | `Expense` |
| DELETE | `/expenses/{id}` | Bearer | — | `{ok:true}` / 404 "Pengeluaran tidak ditemukan" |
| GET | `/reports/profit?months=6 (1-24)` | Bearer | — | `{series:[{month,year,revenue,cost,operating_expenses,profit}], totals:{revenue,cogs,operating_expenses,gross_profit,net_profit}}` |
| GET | `/reports/cashflow?weeks=4 (1-12)` | Bearer | — | `{series:[{name,inflow,outflow}]}` |
| GET | `/reports/inventory/turnover?days=30 (1-365)` | Bearer | — | `{period_days,cogs_period,current_inventory_value,turnover_ratio_period,turnover_ratio_monthly_est}` (ratios `null` if inventory value is 0) |

Also consumed on this page: `GET /orders/stats`, `GET /orders/product-sales?days=30&limit=8`, `GET /products`.

**Documented backend simplifications:** COGS uses *current* product `cost`, not a cost-at-sale-time snapshot; inventory turnover uses *current* stock value as a stand-in for average inventory (no periodic snapshots exist).

### 11.2 Frontend — `reports/Reports.jsx`

Route `/geraina/app/reports/{type}` for `type ∈ {sales, product, inventory, profit, cashflow, tax}` (default `sales`; unrecognized types render "Tipe laporan tidak didukung."). Only one testid on the whole page: `reports-page` — **no per-tab or per-widget testids** (tabs are plain `<Link>`s with no testid; significant selector gap for granular assertions).

- **`sales` tab — MOCKED:** `salesData` splits `stats.week_sales` across 7 fixed percentage weights (0.10/0.15/0.12/0.18/0.22/0.35/0.28), not real per-day aggregation. Only the summary numbers below the chart (avg daily, 7-day total, 30-day total, transaction count) are real.
- **`product` tab:** real, from `/orders/product-sales`.
- **`inventory` tab:** real, from `/reports/inventory/turnover` + `/products` for OOS count.
- **`profit` tab:** real, from `/reports/profit`.
- **`cashflow` tab:** real, from `/reports/cashflow` + an expense CRUD form (category select/description/amount/date inputs have no testids — gap). Client validation: `category && amount>0 && expense_date` required, else `alert("Lengkapi kategori, jumlah, dan tanggal pengeluaran.")`.
- **`tax` tab — ENTIRELY MOCKED:** `taxBase` defaults to a literal `15000000` if `stats.month_sales` is falsy (displays a fake number even with zero real sales in edge cases), PPN computed at a hardcoded 11%. The "Unduh Format e-Faktur CSV" button does **not** call any backend endpoint — it only shows `alert("Laporan e-Faktur DJP siap diunduh (Format CSV).")` with no actual file produced. **Test target:** assert no network request or file download occurs on this button click — it's UI theater by design, not a bug to "fix" via testing, but a behavior to document.

---

## 12. Settings, Payments & Integrations Module

### 12.1 Settings endpoint

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/settings` | — | Saved doc, or hardcoded Indonesian defaults |
| POST | `/settings` | arbitrary dict, upserted | No server-side schema validation — any JSON is accepted and merged (`$set`) |

### 12.2 Payments config endpoint

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/payments/config` | — | Saved doc, or defaults incl. sample QRIS `merchant_id:"MID-GER-QRIS-99"`, e-wallet channel toggles, VA bank toggles, `edc:{is_active:false, provider:""}` |
| POST | `/payments/config` | arbitrary dict | **Validation:** if `qris.is_active===true`, `qris.merchant_id` must be non-empty/non-whitespace, else `400 "Merchant ID wajib diisi"` — the only field-level validation in this module. |

### 12.3 Integrations endpoint

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/integrations` | — | Defaults: all `is_active:false`, empty BYO credential fields |
| POST | `/integrations` | arbitrary dict | **Validation:** WhatsApp `webhook_verify_token` must be globally unique across stores — `400 "Webhook Verify Token WhatsApp ini sudah dipakai toko lain — pilih string yang unik"` if collision |
| POST | `/integrations/whatsapp/test` | **admin/Owner only** — `{target*, phone_number_id, access_token}` (from payload, not saved config) | Sends a `hello_world` template via Meta Cloud API using inline-passed credentials (doesn't require saving first). 400 if any required field missing. |

### 12.4 EDC endpoints (`backend/routes_edc.py`, prefix `/api/edc`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/providers` | Bearer | List of bank IDs from `BANK_LABELS`, all `status:"not_configured"` |
| POST | `/orders/{id}/charge` | Bearer | **Atomic double-charge protection:** `find_one_and_update` filters on `payment_status $nin ["paid","charging"]`, sets to `"charging"`. A concurrent retry gets `None` back → 409 `"Transaksi EDC untuk order ini sedang diproses atau sudah lunas"`. 400 if already `"paid"`. 502 if `edc.is_active=false`, no provider configured, or the (unimplemented, no bank certified) provider charge fails — the claim is released back to prior status on any failure so retries are possible. On success: sets `edc_provider/edc_transaction_id/edc_approval_code/edc_card_type/edc_last4`. |

**Test target:** fire two concurrent `POST /edc/orders/{id}/charge` calls for the same order and assert exactly one succeeds/proceeds while the other gets 409.

### 12.5 Frontend

- **`settings/Settings.jsx`** (`/geraina/app/settings/{general|store|billing|receipt|printer|users|license}`): page testid `settings-page`.
  - **BUG:** `billing`/`subscription`/`license` tabs call `GET /api/subscription`, which **does not exist** anywhere in the backend (confirmed by exhaustive grep across all `routes_*.py`). Expect this call to 404; `sub` state stays `null`, so all `sub?.plan`/`sub?.status` fields silently fall back to hardcoded defaults (`"trial"`) regardless of actual account plan. testids: `license-management-area, license-plan, subscription-billing-management-area, subscription-status-badge, subscription-plan-title, view-pricing-matrix-link`.
  - **BUG:** `store` tab fields are **uncontrolled inputs with no state binding at all** — nothing typed here (legal name, NPWP, etc.) ever saves.
  - **Printer tab:** mode toggle `local` (browser `window.print()`) vs `network` (fetches `GET /printer/test-escpos`, then POSTs to a separately-installed local printer-bridge app at `http://127.0.0.1:{bridge_port}/print`). **The bridge is not part of the web app** and will not be running in a typical TestSprite browser environment — network-mode test-print will always fail with a connection error unless the bridge is separately mocked or actually running on the test machine.
- **`payments/PaymentConfig.jsx`** (`/geraina/app/payments/{cash|qris|ewallet|va|credit-card|bank-transfer|edc}`; note `credit-card`→`credit_card`, `bank-transfer`→`bank_transfer` normalization): testids `payment-config-page, payment-config-save-btn`. QRIS tab mirrors backend validation client-side: `qris-merchant-id-input, qris-validation-error` — blocks submit if `is_active` and merchant_id blank. EDC tab: all 4 banks show "Belum Tersedia" — selecting one only stores a preference.
- **`integrations/Integrations.jsx`** (`/geraina/app/integrations/{xendit|midtrans|stripe|qris|whatsapp|telegram|email}`): testid `integrations-page`. WhatsApp tab: `wa-test-number, wa-test-btn, wa-test-result` — calls `POST /integrations/whatsapp/test` using currently-typed (possibly unsaved) credentials from local state.

---

## 13. Printer / PDF Module

### 13.1 Endpoints

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/printer/test-escpos` | Bearer | `{data_base64, byte_length}` — sample ESC/POS bytes from store settings |
| GET | `/api/printer/orders/{order_id}/escpos` | Bearer | `{data_base64, byte_length}` — full receipt payload for an order | 404 if order not found |
| GET | `/api/pdf/receipt/{order_id}` | Bearer | 80mm thermal PDF, dynamic height by item count | 404 if order not found |
| GET | `/api/pdf/invoice/{order_id}` | Bearer | A4 invoice PDF | 404 if order not found |

**Architecture note (documented in source):** the backend only *builds* raw ESC/POS bytes — it cannot deliver them to a LAN printer itself. Delivery requires the separately-distributed `printer-bridge` local app (see §12.5). PDF downloads (`receipt-pdf-thermal-btn`/`receipt-pdf-invoice-btn` on POS, `sales-receipt-{id}`/`sales-invoice-{id}` on Sales) work standalone without the bridge.

---

## 14. Webhooks Module

### 14.1 Endpoints (`backend/routes_webhooks.py`, prefix `/api/webhooks`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/xendit` | header `x-callback-token` must equal env `XENDIT_WEBHOOK_TOKEN` | 401 `"Invalid callback token"` if missing/mismatched. Maps `reference_id`/`external_id` → order, updates `payment_status` via background task. Status mapping: SUCCEEDED/COMPLETED/SUCCESS/PAID→paid, ACTIVE→pending (QR-creation event, not a payment), FAILED/EXPIRED→failed, VOIDED→voided, REFUNDED→refunded, else pending. |
| POST | `/xendit/simulate` | none, gated by env `ALLOW_WEBHOOK_SIMULATE` | 403 "Simulator disabled" unless env flag truthy. Dev-only, no token required. |
| POST | `/midtrans/simulate` | same env gate | Maps Midtrans-style payload → internal format |
| POST | `/stripe/simulate` | same env gate | Maps Stripe-style payload → internal format |
| GET | `/whatsapp` | Meta verification handshake — query `hub.mode`, `hub.verify_token`, `hub.challenge`, `hub.phone_number_id` | 403 if `mode != "subscribe"` or no token; 403 "Verify token tidak dikenali" if no tenant's `webhook_verify_token` matches. On match, caches `phone_number_id` onto that tenant and echoes `hub.challenge` as plain text. |
| POST | `/whatsapp` | HMAC-SHA256 (`x-hub-signature-256` header) verified against the **per-tenant** `app_secret` | **Always returns `{received:true}` HTTP 200 regardless of outcome** (Meta backs off/disables webhooks that don't 200). `phone_number_id` from the (untrusted) payload body is used only to look up which tenant's `app_secret` to verify against — nothing is processed/stored until `hmac.compare_digest` passes. Unmatched/failed-signature payloads are silently discarded (still 200). Valid messages queue as background task → `whatsapp_inbound` collection. |

**Security test targets:**
1. Send a webhook with tenant A's `phone_number_id` but tenant B's HMAC signature → expect silent-discard (200, no processing).
2. Send with a missing/malformed `x-hub-signature-256` header → expect silent-discard (200).
3. Verify webhook always 200s even on outright rejection — never surface a 4xx to Meta.
4. Xendit webhook with wrong `x-callback-token` → expect 401 (this one *does* surface a real error, unlike WhatsApp).

---

## 15. Pricing / Licensing Module

### 15.1 Endpoints (`backend/routes_pricing.py`, prefix `/api/pricing`)

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/tiers` | none | Static array: `trial` (free, 14 days, 1 outlet, max 100 products), `starter` (Rp 99.000/mo, Rp 990.000/yr), `pro` (Rp 249.000/mo, Rp 2.490.000/yr, `highlight:true`, badge "Paling Direkomendasikan"), `business` (Rp 499.000/mo, Rp 4.990.000/yr), `multibranch` (Rp 799.000+/mo, yearly `null`/"Custom") |
| GET | `/addons` | none | `extra_device` (Rp 49.000/mo), `extra_branch` (Rp 199.000/mo) |
| POST | `/upgrade` | **admin/Owner only** | body `{tier_id}` |

**Business logic (deliberate anti-abuse design):** `POST /pricing/upgrade` self-service-activates **only for free tiers** (price 0 monthly and yearly — i.e. only `"trial"`), setting `plan` on both `users` and `stores` immediately → `{ok:true, status:"activated", plan:tier_id}`. For **any paid tier**, it does not grant the plan — it inserts an `upgrade_requests` doc with `status:"pending"` → `{ok:true, status:"pending_manual_activation", ...}` (no payment gateway wired; requires manual DagangOS staff activation). 400 `"Paket tidak valid"` for unknown `tier_id`.

### 15.2 Frontend — `Pricing.jsx` (`/pricing`, `/geraina/pricing`)

testids: `pricing-page, pricing-nav-logo, pricing-nav-dashboard` (if logged in) or `pricing-nav-login/pricing-nav-register` (if not), `pricing-hero, billing-toggle, billing-monthly, billing-yearly, pricing-card-{tierId}, pricing-badge-{tierId}` (pro only), `pricing-monthly-eq-{tierId}` (yearly view only), `pricing-features-{tierId}, pricing-cta-{tierId}, addons-section, addon-{id}, pricing-faq, faq-{i}, faq-toggle-{i}, faq-answer-{i}` (rendered only when open). CTA behavior branches: not logged in → link to register; logged in + `user.plan === tier.id` → disabled "Paket Aktif"; logged in + trial tier + different plan → calls `POST /pricing/upgrade`; **all non-trial tiers always render a `mailto:sales@dagangos.com` link regardless of login state** — the paid-tier CTA never actually calls the upgrade endpoint (matches the manual-activation-only backend design).

### 15.3 `LicenseDevices.jsx` (`/geraina/app/license`) — fully mocked, no backend

**Backend has zero endpoints for licenses or devices** (confirmed by exhaustive grep — no `license`/`device` routes exist anywhere in `backend/`). The entire page is client-side mocked: `mockDevices` is a hardcoded 2-row array (`DEV-08122-TAB`, `DEV-09211-MOB`), "Sinkronisasi Terakhir: Baru Saja", "Pencadangan Cloud: Aktif", "Batas Sinkronisasi Offline: 7 Hari Tersisa" are all static strings. testids: `license-page, license-title, license-status, license-grace, license-expiry`, per-device `device-row-{id}`. Only real data used is `user.plan` from `/auth/me`. **Any test expecting this page to reflect real backend device/license state will always fail by design — it is a fully static mock screen.**

---

## 16. Dashboard Module — `Dashboard.jsx` (`/geraina/app/dashboard`)

Fetches on mount (parallel, each independently caught/silenced on failure): `GET /orders/stats`, `GET /orders?limit=5`, `GET /products`, `GET /debt/receivables`, `GET /debt/payables`, `GET /attendance`, `GET /branches`.

testids: `dashboard-page, dashboard-greeting, trial-upgrade-banner` (only if `plan==="trial"`), `trial-banner-upgrade-cta`. The 5 `StatCard`s use testids `stat-revenue, stat-profit, stat-transactions, stat-basket, stat-cash`. **The 11 widget cards/charts below the KPI row have no testids at all** — significant selector gap.

**Real vs. mocked, by widget:**
- **Real:** `stat-revenue` (`today_sales`), `stat-transactions` (`today_orders`), Top 5 Products table (first 5 of `/products`), Recent Transactions table (`/orders?limit=5`), Low Stock widget (`products.filter(stock<=5)`), Inventory Valuation widget (`Σ stock*cost`), Receivables/Payables totals, Staff Activity widget (first 2 of `/attendance`).
- **Partially estimated:** `stat-profit` = `today_sales * 0.4` (hardcoded 40% margin assumption — source comment literally says "Estimated 40% margin", unrelated to actual product cost data); `stat-cash` = `today_sales*0.6 + 500000` (comment: "Cash in hand mock").
- **Fully mocked, static regardless of DB state:** `salesTrendData` (same fixed-percentage-of-week_sales pattern as Reports §11.2), `pmtData` (payment method pie — static `{Cash:45, QRIS:30, E-Wallet:15, Bank VA:10}` percentages, never computed from real `payment_method` distribution), `cashflowData` (bar chart — 4 fully hardcoded weeks of Rupiah figures, completely disconnected from the real `/reports/cashflow` endpoint), `branchData` (bar chart — derives percentages of `month_sales` by fixed array-index weights `0.5/0.35/0.15`, not real per-branch figures).

**Test target:** write Dashboard chart-value assertions to expect these 4 widgets are **static/non-reactive** to seeded test data, rather than expecting them to reflect reality — a naive "seed data, assert chart matches" test will fail by design on Payment Distribution %, Cashflow bar chart, Branch Comparison chart, and Sales Trend area chart.

---

## 17. Cross-Cutting Test Priorities (recommended TestSprite focus areas)

1. **Debt settlement is broken** (§6.2): `POST /debt/receivables` and `/debt/payables` with partial payload → 422, silent UI failure (no `.catch()`).
2. **Invoice mark-paid is broken** (§8.2): same pattern on `POST /purchase/invoices`.
3. **PO line items are dropped server-side** (§8.2): `items` never persists or returns from `GET /purchase/orders`.
4. **`/api/subscription` doesn't exist** (§12.5): Settings billing/subscription/license tabs always see a failed fetch, silently fall back to `"trial"` defaults.
5. **LicenseDevices.jsx is 100% mocked** (§15.3): no backend license/device API exists at all.
6. **Dashboard + Reports "sales"/"tax" tabs mix real and fabricated numbers** (§§11.2, 16): several charts/widgets are static regardless of DB state — assert non-reactivity, not correctness.
7. **New staff get a hardcoded default password `"geraina123"`** (§9.2) — security-relevant, worth an explicit login test.
8. **Attendance clock-in hardcodes `"Azhar Owner"`** (§9.3) regardless of actual logged-in user.
9. **EDC double-charge protection** (§12.4) — atomic state machine (`pending→charging→paid`), 409 on concurrent charge; good race-condition test target.
10. **WhatsApp webhook per-tenant signature verification** (§14): always 200s, silently discards unverified/unmatched payloads — good negative-security test target (wrong signature, unknown phone_number_id, missing header).
11. **RBAC boundary testing** (§3.3): only 4 endpoints enforce `admin`/`Owner` role; every other endpoint accepts any authenticated role. Test that a Cashier-role token *can* (not "should be blocked from") delete products/branches/change payment config — this documents the actual (permissive) behavior, not the UI's implied restrictions.
12. **QRIS/e-wallet payment-first ordering** (§5.1): simulate a gateway failure (e.g. via the webhook simulate endpoints if `ALLOW_WEBHOOK_SIMULATE` is set in the test environment, or by triggering a 502 condition) and assert no order is created and no stock is deducted.
13. **Order void restores stock and is idempotent** (§5.1): void twice, assert `already_voided:true` on the second call and no double stock-restoration.

---

## 18. Test Credentials

Default seeded test account (see also `GerainaOS/memory/test_credentials.md` in the repo): `owner@geraina.com` / `geraina123`.

For a clean-slate registration flow test, register a new account via `POST /auth/register` (or the `/geraina/register` UI) — this seeds default units and settings but **no demo products/categories/staff/payment keys** (deliberate clean-start policy), so most modules will show empty states immediately after registration. Plan for tests to seed their own fixture data via the relevant CRUD endpoints before testing dependent flows (e.g. create a product before testing POS checkout).

---

*This document was compiled by a full audit of the GerainaOS codebase (`D:\Fullstack Apps\DagangOS\GerainaOS`) — backend `routes_*.py` files and frontend `src/pages/**/*.jsx` — as of 2026-07-17. Endpoint paths, request/response shapes, and `data-testid` selectors are transcribed verbatim from source, not paraphrased, so they should be directly usable for automated test generation.*
