# Geraina customer audit repairs

All 21 findings from the original audit are fixed and verified locally. This is a signed **1.2.7 / build 12 candidate**, not a published release. The public **1.2.6 / build 11** remains unchanged.

Verified: 2026-10-26T13:03:27.298883+00:00. Source includes uncommitted changes; normalized production source digest `87e5aaea3111beccd5edb06dc45335ebadac2ff36caedc1e03f7cbd50226faf8`.

## Evidence

- Backend: **313 passed**, including 33 real-Mongo repair cases, transaction rollbacks, concurrency, timeout recovery, store scope and signed callback contracts.
- Customer E2E: **294 passed**, zero skipped, flaky or retries, using the actual local API and a disposable Mongo replica across phone, Xiaomi tablet and large Samsung tablet layouts.
- Expanded invoice form creation, partial payment and final settlement: **3 passed**, one on each layout, with visible amount fields and persisted Paid status.
- Existing POS/inventory regressions: **45 passed**. Navigation: **30 passed**. Frontend units: **38 passed**. Android units: **24 passed** (cached native unit tasks; current release assets rebuilt).
- Release build and lint passed: **0 errors, 55 warnings**. Lint warnings are not counted as that many customer defects.
- Signed APK: com.dagangos.geraina, version 1.2.7 (12), Android 14+, target API 36. Signing certificate matches 1.2.6. All 18 bundled manifest entries verified; browser assets match after the documented remote-font/analytics stripping used for offline packaging.
- Native presentation is injected into Chromium for these layout checks. This does not certify physical Android behavior.
- 136 backend routes inventoried; 81 literal calls matched. Nine dynamic call sites were separately reviewed: PDF receipt/invoice; validated workspace paths and records allowlist; inventory movement; debt create/update; legacy PO line repair; invoice settlement; report endpoints.

Interactive report: [customer-fixes/index.html](../android-app/app/build/reports/customer-fixes/index.html). Raw evidence: [CUSTOMER-FIXES.json](CUSTOMER-FIXES.json).

## Closure by finding

| Finding | Repair | Verification |
| --- | --- | --- |
| AUD-001 | Server totals validate finite amounts, sufficient cash, tax, discounts and normalized line subtotals. | invalid_sale_does_not_change_stock_or_create_order; line_subtotals_cannot_drift_by_a_cent_or_pollute_sales_totals |
| AUD-002 | Checkout requires an active, current-price product owned by the authenticated store. | checkout_cannot_reference_a_missing_or_foreign_product; unavailable_or_changed_product_is_rejected |
| AUD-003 | Online stock reservations check availability atomically. Known offline cash shortages require an explicit warning/attestation; collected offline cash remains reconcilable. | unavailable_or_changed_product_is_rejected; existing offline-sale regressions |
| AUD-004 | A durable store/actor checkout key reuses the order and provider intent; uncertain timeouts never repeat a provider request. | retry_and_concurrent_void_are_exactly_once; online_gateway_retry_reuses_the_durable_payment_intent; gateway_timeout_preserves_intent_and_retry_never_charges_again |
| AUD-005 | Order, inventory, ledger and customer benefits commit in a Mongo transaction. Storage failures roll back local effects. | failed_insert_rolls_back_and_retry_can_succeed |
| AUD-006 | Concurrent voids restore inventory once; provider cancellation/failure also releases stock once. | retry_and_concurrent_void_are_exactly_once; signed_doku_notifications_require_exact_amount_and_handle_cancel_once |
| AUD-007 | Terminal orders cannot become paid through manual actions or late callbacks. Late funds require explicit merchant review. | failed_provider_release_and_late_paid_do_not_corrupt_inventory; signed_doku_notifications_require_exact_amount_and_handle_cancel_once |
| AUD-008 | PO lines retain validated product IDs, quantities, costs and received quantities. Legacy missing lines require explicit repair. | receiving_is_itemized_atomic_and_exactly_once; browser: Creating a purchase preserves its selected product and quantity |
| AUD-009 | Receiving validates the PO and remaining lines, adds stock and a real ledger event atomically, and deduplicates retries. | receiving_is_itemized_atomic_and_exactly_once; browser: Merchant creates an itemized PO, receives it and sees the actual stock movement |
| AUD-010 | Invoice and payable share transactional partial/full/reopened settlement; UI waits for the persisted status. | linked_invoice_payment_and_reopening_are_consistent; browser: A partial supplier payment and final invoice settlement agree on both screens |
| AUD-011 | Adjustments use product IDs, require positive quantities/reasons, and derive the author from authentication. | SKU-less adjustment regression; browser: An SKU-less product can be adjusted through its actual product ID |
| AUD-012 | Debt payments validate bounds and derive status; stale cumulative balances cannot overwrite a concurrent payment. | linked_invoice_payment_and_reopening_are_consistent |
| AUD-013 | Demo movements are removed. Real sales, reversals, product changes, receipts, adjustments and transfers write ledger events. Legacy incompleteness is disclosed. | complete_record_pages_and_real_movements_are_store_scoped; product_stock_compare_and_set_and_import_ledger_and_capacity; browser receiving/adjustment/transfer journeys |
| AUD-014 | Required reads distinguish loading, error, empty and success, with retry and stale-request protection. | browser: A failed read on each audited route is visible to the customer |
| AUD-015 | Adjustment, transfer and PO selectors enumerate the complete catalogue; tables page separately. | browser: Large catalogue selectors (501 products across three workflows and three layouts) |
| AUD-016 | Cursor APIs expose total counts and complete store-scoped customer, supplier and invoice collections; current clients enumerate them. | complete_record_pages_and_real_movements_are_store_scoped; older_suppliers_and_unpaid_invoices_have_complete_pages (201/106/101 records) |
| AUD-017 | Inventory movement uses inventory.read instead of requesting the forbidden POS order endpoint. | complete_record_pages_and_real_movements_are_store_scoped; browser Warehouse role audit |
| AUD-018 | Today and seven-day chart boundaries use the configured store timezone. | today_uses_the_store_day_and_chart_matches_same_boundary (WIB/WITA/WIT) |
| AUD-019 | New sales freeze unit cost; historical profit never reads current product cost. Unknown legacy costs produce an explicit incomplete report. | historical_profit_uses_immutable_cost_and_flags_missing_legacy_cost; browser recorded-profit journey |
| AUD-020 | Paid sales award customer points exactly once; void/refund reverses once. Redemption is explicitly unavailable. Manual correction requires authority and a current balance. | loyalty_awards_once_and_void_reverses_once; manual_loyalty_correction_requires_authority_and_current_balance; browser earning journey |
| AUD-021 | Transfers validate owned distinct branches and product IDs; shipping, receiving and cancellation update the correct branch balances once. Legacy record-only transfers are labelled. | branch_transfers_reserve_receive_and_cancel_exactly_once; browser: Branch shipment and receipt change only the correct branch balances |

## Limits and release gates

- Physical Android installation/update from 1.2.6 to 1.2.7, including Xiaomi and Samsung devices; no device was connected.
- Physical Bluetooth pairing/printing and real camera capture; browser callbacks do not certify hardware.
- Real merchant Xendit/DOKU settlement, cancellation/refunds and bank receipt verification. Provider calls were stubbed/blocked; signed callback contracts were tested locally.
- Production-network launch/navigation performance and representative merchant data latency.
- TestSprite against a deployed candidate: no preview/release URL containing this candidate exists.

No production merchant records, real payment charges or third-party messages were changed. Bank QRIS remains staff-confirmed; Geraina does not independently verify the bank receipt. Electronic void does not automatically refund money; the UI warns staff to handle refunds in the merchant provider account.

Historical records are not fabricated: old missing costs remain unknown, old non-executing receipts/transfers remain labelled, and legacy POs without lines require explicit repair. Offline collected cash remains preservable and synchronizable, even if stock/catalogue changed after collection.

Deploy the matching backend and frontend before the APK; MongoDB transactions require a replica set. Device installation/update and deployed-candidate verification remain release gates. No production push or publication happened in this repair pass.

## Audit correction

The native dashboard already displayed unknown data plus Retry using role=status. The initial alert-only audit misclassified that case. The other swallowed-read failures were real. It now exposes role=alert, validates reads and uses the server store day.

## Reproduction

Use the disposable local audit server documented in [the original audit](CUSTOMER-EXPERIENCE-AUDIT.md), then run `playwright test --config=playwright.fixes.config.js` with `GERAINA_AUDIT_HOST=http://127.0.0.1:8848`. The server blocks external providers. Never point it at production data. Run `backend/tests` excluding the separate production smoke script `backend_test.py`.

DOKU callback policy follows [notification best practices](https://developers.doku.com/get-started-with-doku-api/notification/best-practice) and [notification samples](https://developers.doku.com/get-started-with-doku-api/notification/http-notification-sample-non-snap). These are protocol tests, not provider certification.
