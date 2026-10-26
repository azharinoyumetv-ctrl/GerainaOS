# Geraina customer experience audit — 26 October 2026

> Repair follow-up: all 21 findings have locally verified fixes. See [CUSTOMER-FIXES.md](CUSTOMER-FIXES.md). The original observations below remain historical evidence. Device and deployed-candidate checks are still pending.

**Decision: hold the next release.** This audit confirms **21 grouped issues: 16 P1 and 5 P2**. They include runtime defects, unfinished workflows, and a documented accounting approximation with customer impact. P1 means correct before a wider rollout; P2 means finish or clearly disclose the limitation. The 48 failed browser checks repeat 16 failing scenarios across three layouts; they are not 48 separate bugs.

## Scope and evidence

- Current prepared source/frontend, including the pending local fixes. Published APK remains **1.2.6 / build 11**, unchanged. This is not a claim that every finding was reproduced inside that installed APK.
- **56 app routes × 3 layouts = 168 route health checks** passed. These check rendering, actual local API responses, runtime errors and whole-page overflow. Rendering alone does not establish that every button/workflow is complete.
- **276 Playwright checks: 228 passed, 48 failed**, zero skips, zero flaky results, zero retries. Profiles: phone 412×915; Xiaomi-sized tablet 1016×1100; Samsung-sized tablet 1480×924.
- Real Owner, Manager, Cashier and Warehouse authentication/membership. API routes are real; broad screen tests use a disposable in-memory database. Cash/offline/QRIS/PDF/attendance/onboarding journeys and independent financial reproductions additionally use an actual local MongoDB replica set.
- **280 existing backend regressions passed**, including nine real-Mongo transaction tests. **24 Android unit checks passed** using the current cached Gradle task. Android debug lint passed with **0 errors / 51 warnings**. Reviewed lint warnings are not counted as confirmed defects.
- **27 adversarial in-memory API cases** and **16 independent real-Mongo HTTP cases** exercise suspected gaps. These are targeted reproductions, not representative pass-rate measurements. Real-Mongo results supersede mock list-limit behavior.
- No production merchant records, configuration, charges, bank settlement or third-party messages were changed. Product behavior was not edited during the audit. Only audit tests and evidence were added.

## What works in the tested journeys

Real-API login rejects invalid credentials and supports password reveal. Category, brand and unit creation persist after reload. A barcode callback fills the new product SKU, and the saved product is found in POS. Native camera capture itself remains unverified.

Against real MongoDB on all three layouts, cash sales persist once, decrement stock once, appear in sales history and produce a real PDF. Offline cash survives reload and reconnects. A lost synchronization response replays the same sale ID without a duplicate order or stock deduction. Bank QRIS stays pending until staff confirms the exact amount and records a manual audit trail. Cashier check-in/out uses the employee server identity. Registration creates an empty trial store; expired POS stays locked while public Pricing remains reachable. Switching merchants cannot replay the previous merchant’s queued cash sale.

An initial audit assertion expected the guarded in-app billing page to open after trial expiry. The documented recovery path is public Pricing. That expectation was corrected, the recovery flow passed, and it is not counted as a defect.

## Confirmed findings

| ID | Priority | Finding | Customer impact |
| --- | --- | --- | --- |
| AUD-001 | P1 | Online sale amount validation is incomplete | Incorrect revenue/change can be recorded by an authenticated checkout request. Native offline-cash validation is a separate path. |
| AUD-002 | P1 | Online sale accepts unavailable or foreign product references | Invalid products become paid sales without a matching store stock deduction. This did not expose or modify the other store product. |
| AUD-003 | P1 | Online checkout silently oversells stock | A sale at stock 0 leaves stock -1 without a warning. Preserve explicit historical offline-sale reconciliation separately. |
| AUD-004 | P1 | Online checkout has no retry idempotency | The same keyed request creates two orders and deducts stock twice. Electronic provider duplication is a risk, not a tested charge. |
| AUD-005 | P1 | Order storage failure leaves stock deducted | Injected insert failures leave stock 9 with zero orders instead of rolling back to 10. |
| AUD-006 | P1 | Concurrent void restores stock repeatedly | Eight actual HTTP cancellations on real MongoDB left stock above its original 10 units. |
| AUD-007 | P1 | Voided orders can be marked paid again | Stock stays restored while the sale reappears in paid revenue. |
| AUD-008 | P1 | Purchase order product lines are discarded | Selected products, quantities and costs are not persisted; an order cannot support accurate receiving. |
| AUD-009 | P1 | Receiving changes status but does not add inventory | Five units received leave stock 10 instead of 15; a nonexistent PO can also get a successful receipt. |
| AUD-010 | P1 | Supplier invoice and payable statuses diverge | Paying via Hutang leaves the invoice Unpaid; reopening an invoice leaves the debt Paid. |
| AUD-011 | P1 | Stock adjustments can succeed without changing the selected product | An SKU-less product sends N/A and stays at stock 10 after an add-5 success. Negative quantities and a forged author are also accepted. |
| AUD-012 | P1 | Debt endpoints allow overpayment | A Rp1000 payable accepts paid_amount Rp2000 without rejection. |
| AUD-013 | P1 | Stock movement shows invented business transactions | A fresh store displays Kopi Arabika 250g, ORD-1002 and other default movements that never occurred. |
| AUD-014 | P1 | Load errors still look like empty or healthy data on eight screens | HTTP 503 is hidden on dashboard, stock movement, purchase orders/receiving/invoices, customers, suppliers and branches. |
| AUD-015 | P2 | Adjustment, transfer and purchase selectors still stop at product 500 | Product 501 is available in the catalogue but cannot be chosen in three workflows. |
| AUD-016 | P1 | Customer, supplier and unpaid invoice lists silently truncate | Real Mongo returns 200/201 customers, 100/106 suppliers and 100/101 unpaid invoices, with no continuation or count boundary. |
| AUD-017 | P2 | Warehouse stock movement requests a forbidden POS endpoint | The permitted inventory screen requests /orders?limit=100, gets 403, then leaves its sample movement list. |
| AUD-018 | P1 | Today totals use UTC instead of the store timezone | A paid sale at 23:00 UTC / 06:00 WIB on the current store day is missing from today_sales. |
| AUD-019 | P2 | Historical profit changes when current product cost changes | Recorded net profit changed from Rp600 to Rp200 after editing current cost. This is an existing documented approximation. |
| AUD-020 | P2 | Saved loyalty earning rules do not award sale points | A matched customer buying Rp1000 under a saved Rp1000=1 point rule remains at zero points. |
| AUD-021 | P2 | Transfers are record-only and lack basic validation | A transfer between the same nonexistent branch with quantity -5 is accepted as Shipped; schema stores product names, without branch balances or a receiving workflow. |

## Repair acceptance criteria

### AUD-001 — Online sale amount validation is incomplete

Recompute/validate line totals; require sufficient finite received cash; bound discount/tax and forbid negative/nonfinite totals.

Evidence: `ORDER-LINE-TOTAL`, `CASH-REQUIRED`, `ORDER-NEGATIVE-TAX`. Source: `backend/routes_orders.py:55`, `backend/models.py:93`.

### AUD-002 — Online sale accepts unavailable or foreign product references

Validate every product belongs to the store, exists, and is saleable before payment/order mutations.

Evidence: `ORDER-MISSING-PRODUCT`, `ORDER-FOREIGN-PRODUCT`, `ORDER-INACTIVE`. Source: `backend/routes_orders.py:65`.

### AUD-003 — Online checkout silently oversells stock

Use an explicit stock policy with atomic availability checks or a clear recorded override/warning.

Evidence: `ORDER-STOCK`. Source: `backend/routes_orders.py:206`, `frontend/src/pages/POS.jsx:332`.

### AUD-004 — Online checkout has no retry idempotency

Persist a checkout attempt key, reuse provider reference and order across retries, and test response-loss recovery.

Evidence: `ORDER-RETRY`. Source: `backend/routes_orders.py:65`.

### AUD-005 — Order storage failure leaves stock deducted

Commit local order/inventory effects atomically and reconcile external payment intents after failures.

Evidence: `ORDER-ATOMICITY`. Source: `backend/routes_orders.py:206`.

### AUD-006 — Concurrent void restores stock repeatedly

Use a guarded atomic status transition plus exactly-once stock restoration; concurrent requests must restore only once.

Evidence: `VOID-CONCURRENT`. Source: `backend/routes_orders.py:398`.

### AUD-007 — Voided orders can be marked paid again

Enforce legal payment state transitions, including manual actions and late provider callbacks.

Evidence: `VOID-TERMINAL`, `A voided sale cannot be marked paid again without restoring stock accounting`. Source: `backend/routes_orders.py:379`.

### AUD-008 — Purchase order product lines are discarded

Persist validated product/quantity/cost lines and verify them after saving and reloading.

Evidence: `PURCHASE-LINES`, `Creating a purchase preserves its selected product and quantity`. Source: `backend/models.py:227`, `backend/routes_purchase.py:79`, `frontend/src/pages/purchase/PurchaseOrder.jsx:53`.

### AUD-009 — Receiving changes status but does not add inventory

Validate the PO and remaining line quantities, update inventory atomically, and prevent duplicate receiving.

Evidence: `RECEIVING-STOCK`, `RECEIVING-REFERENCE`, `Receiving a purchase changes actual stock rather than only its status`. Source: `backend/routes_purchase.py:127`, `frontend/src/pages/purchase/GoodsReceiving.jsx:33`.

### AUD-010 — Supplier invoice and payable statuses diverge

Use a shared linked settlement record and update both screens consistently for partial/full/reversed payments.

Evidence: `DEBT-INVOICE`, `INVOICE-DEBT`. Source: `backend/routes_customers.py:187`, `backend/routes_purchase.py:190`.

### AUD-011 — Stock adjustments can succeed without changing the selected product

Identify the store product by ID, validate a positive quantity/type, require a matched update, and derive actor from auth.

Evidence: `ADJUSTMENT-PRODUCT-ID`, `ADJUSTMENT-VALIDATION`. Source: `backend/routes_inventory.py:163`, `frontend/src/pages/products/StockAdjustment.jsx:29`.

### AUD-012 — Debt endpoints allow overpayment

Validate finite nonnegative debt/payment amounts, cap settlement to the balance, and derive status from the ledger.

Evidence: `DEBT-OVERPAY`. Source: `backend/models.py:312`, `backend/routes_customers.py:187`.

### AUD-013 — Stock movement shows invented business transactions

Remove demo entries and use a complete server-backed movement ledger with real receipts, adjustments, sales and reversals.

Evidence: `Stock movement on a new store contains no invented sales or purchases`. Source: `frontend/src/pages/inventory/StockMovement.jsx:4`.

### AUD-014 — Load errors still look like empty or healthy data on eight screens

Distinguish loading/error/valid empty/success and offer retry; do not save defaults after failed configuration reads.

Evidence: `A failed read on dashboard`, `A failed read on inventory/movement`, `A failed read on purchase/orders`, `A failed read on purchase/receiving`, `A failed read on purchase/invoices`, `A failed read on customers`, `A failed read on suppliers`, `A failed read on branches`. Source: `frontend/src/pages/Dashboard.jsx:47`, `frontend/src/pages/purchase/GoodsReceiving.jsx:13`, `frontend/src/pages/customer/CustomerList.jsx:22`, `frontend/src/pages/branches/BranchManagement.jsx:14`.

### AUD-015 — Adjustment, transfer and purchase selectors still stop at product 500

Use complete catalogue enumeration or searchable server selectors with explicit paging.

Evidence: `products/stock-adjustment can select product 501`, `products/stock-transfer can select product 501`, `purchase/orders can select product 501`. Source: `frontend/src/pages/products/StockAdjustment.jsx:16`, `frontend/src/pages/products/StockTransfer.jsx:17`, `frontend/src/pages/purchase/PurchaseOrder.jsx:19`.

### AUD-016 — Customer, supplier and unpaid invoice lists silently truncate

Provide store-scoped search/pagination and visible complete counts, including older unpaid bills.

Evidence: `LIST-CUSTOMERS`, `LIST-SUPPLIERS`, `LIST-UNPAID-INVOICES`. Source: `backend/routes_customers.py:19`, `backend/routes_purchase.py:19`, `backend/routes_purchase.py:150`.

### AUD-017 — Warehouse stock movement requests a forbidden POS endpoint

Serve inventory movement through inventory.read and keep sale-history/credential permissions separate.

Evidence: `warehouse permitted screens / inventory/movement`. Source: `frontend/src/pages/inventory/StockMovement.jsx:16`, `backend/routes_orders.py:256`.

### AUD-018 — Today totals use UTC instead of the store timezone

Apply the configured IANA store timezone to day boundaries and test WIB/WITA/WIT midnight transitions.

Evidence: `REPORT-LOCAL-DAY`. Source: `backend/routes_orders.py:270`.

### AUD-019 — Historical profit changes when current product cost changes

Snapshot cost on new sale lines; use explicit approximation/unknown handling for legacy sales rather than rewriting history.

Evidence: `REPORT-HISTORICAL-COST`. Source: `backend/routes_reports.py:1`, `backend/routes_reports.py:128`.

### AUD-020 — Saved loyalty earning rules do not award sale points

Persist the customer ID on sales and apply earning/reversal/redemption rules exactly once, or clearly describe manual-only points.

Evidence: `LOYALTY-ACCRUAL`. Source: `backend/routes_customers.py:109`, `backend/routes_orders.py:65`, `frontend/src/pages/customer/LoyaltyPoints.jsx:50`.

### AUD-021 — Transfers are record-only and lack basic validation

Validate store branch/product IDs and positive quantities; implement shipment/receipt/reversal inventory effects or label this as a transfer log.

Evidence: `TRANSFER-VALIDATION`. Source: `backend/models.py:200`, `backend/routes_inventory.py:197`, `frontend/src/pages/products/StockTransfer.jsx:33`.

## Recommended repair order

1. Checkout calculation/validation, attempt idempotency and atomic writes.
2. Exactly-once cancellation and legal payment status transitions.
3. Purchase lines, receiving, adjustments and linked debts/invoices.
4. Remove invented movement data, repair role-specific reads, and expose read failures.
5. Complete selectors/list paging and store-local report boundaries.
6. Explicitly finish or label loyalty, cost history, branch transfers and refunds.

Do not replace an already completed offline cash sale with a rejected online attempt during repairs: offline cash preserves a real payment and has its own safe replay contract. Online payment attempts, reservations and provider reconciliation need separate treatment. No live provider duplication/refund was performed; those risks must be tested in merchant sandboxes.

## Verification still needed

- Physical Android phone/tablet installation, touch keyboard, rotation, split screen, large font, accessibility and sustained low-memory performance.
- Physical Bluetooth printer pairing/printing and real camera barcode capture.
- Real Xendit/DOKU merchant charges, signatures/webhook settlement and cancellations/refunds.
- Actual bank receipt: QRIS test exercises staff-confirmed recording with a synthetic nonpayable QR, not bank verification.
- New APK installer/update/rollback on Android devices.
- Production network cold launch/navigation performance and representative merchant dataset latency.
- Deployed candidate via TestSprite: no candidate preview/release URL is deployed.

No Android device was connected to ADB during this audit. Browser dimensions do not certify Xiaomi/Samsung hardware behavior, Android back gestures, native keyboard, Bluetooth printer or camera permissions. Local loopback timings cannot establish production launch/navigation performance.

Other scope boundaries: automatic partial returns/refunds and complete tax/e-Faktur export are not certified. Unsupported payment methods are already labelled unavailable; their absence is not counted as a working integration.

## Reports and reruns

- Summary: `android-app/app/build/reports/customer-audit/index.html`.
- Full route/journey failures: `customer-audit/report/index.html`.
- Real-Mongo healthy journeys: `customer-audit/real-mongo/report/index.html`.
- Role audit: `customer-audit/roles/report/index.html`.
- Onboarding/session isolation: `customer-audit/onboarding/report/index.html`.
- Independent actual database reproductions: `customer-audit/real-mongo-invariants.json`.
- Machine-readable durable record: [CUSTOMER-EXPERIENCE-AUDIT.json](CUSTOMER-EXPERIENCE-AUDIT.json).

The audit hosts are local-only tools, not production application endpoints. Start `android-app/scripts/customer-audit-server.py` on 127.0.0.1:8846 for the disposable in-memory screen bench. Real-Mongo cases use a disposable replica named `customerAudit` on 127.0.0.1:8847 and the same host with `GERAINA_AUDIT_REAL_MONGO=1`, `GERAINA_AUDIT_PORT=8848`. No production Mongo URI is accepted by this bench. With these hosts running, the Playwright commands below run from `frontend`:

```powershell
.\node_modules\.bin\playwright.cmd test --config=playwright.audit.config.js
.\node_modules\.bin\playwright.cmd test --config=playwright.role-audit.config.js
$env:GERAINA_AUDIT_HOST='http://127.0.0.1:8848'
.\node_modules\.bin\playwright.cmd test --config=playwright.money-audit.config.js
.\node_modules\.bin\playwright.cmd test --config=playwright.onboarding-audit.config.js
```

The broad and role suites deliberately fail until the open findings are repaired. The diagnostic scripts write JSON outcomes; their process exit code alone is not a pass verdict. Production release/versioning remains a separate step after fixes and package checks.
