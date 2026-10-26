**Latest audit:** [21 broader customer experience issues](CUSTOMER-EXPERIENCE-AUDIT.md) remain open. Hold the next release; the fixes documented below remain locally verified.

# Additional defects confirmed after the focused POS checks

26 October 2026. **All three defects below are now corrected and verified locally.** The current Playwright CLI suite passes 45 checks across phone, Xiaomi-sized and Samsung-sized browser layouts. Publication still requires the new package's release checks.

A read-only diagnostic against the prepared frontend and isolated API fixtures reproduced three additional defects:

| Defect | Reproduction | Impact |
| --- | --- | --- |
| Inventory valuation truncates the catalogue | Supply 501 products, each with stock 1 and cost Rp100. The standalone valuation page requests the legacy 500-product endpoint and displays Rp50,000 instead of Rp50,100. | Inventory value is understated for larger catalogues. |
| Inventory valuation hides load failures | Return HTTP 503 for its product request. The page displays Rp0 and an empty table without an error/retry state. | A connection failure looks like zero inventory. |
| Dead-stock calculation does not implement its advertised 30-day window | Supply an in-stock product whose only sale was in January 2000. The page excludes it from the zero-sales-in-30-days list. | It checks only the latest 100 orders and does not filter by date or paid status, so classification can be wrong. |

Sources: `frontend/src/pages/inventory/InventoryValuation.jsx` and `frontend/src/pages/inventory/DeadStock.jsx`. These are separate screens from the stock overview, low-stock page and Reports → Inventory tab corrected in the previous batch.

Detailed reproduction evidence and screenshots are under `android-app/app/build/reports/followup-defects/verification.json`. No product code, production merchant records or payment settings were changed by this diagnostic.

The reproduction table above preserves the original failures. Corrections:

- Valuation reads every catalogue page before computing asset/retail totals; only 50 table rows render at a time. All 501 fixture products are counted, producing the expected Rp50,100 asset value.
- A failed valuation read shows an error and retry. Metrics and empty results appear only after a successful complete read.
- Dead stock uses a new store-scoped server report over all positive-quantity paid sales in the last 30 days. The UTC window stays fixed across cursor pages. Old/unpaid sales do not hide products; failure/retry and valid empty results are distinct.

Verification: **271 backend tests** (including 27 new inventory cases), **38 frontend unit tests**, a successful frontend build, and **45 Playwright CLI checks with no failures, skips or retries**. The three new browser regressions failed against the previous bundle before passing with the fixes. See [INVENTORY-FIXES-VERIFICATION.json](INVENTORY-FIXES-VERIFICATION.json) for evidence and the bundle checksum.

The matching backend must be deployed before the new frontend/package because dead stock now requires `GET /api/reports/inventory/dead-stock`. Startup adds a non-unique store/status/date order index; no destructive migration is required. Native package installation/update checks, physical printer checks and live gateway settlement remain unverified. The published APK is still 1.2.6 and does not include these local fixes.
