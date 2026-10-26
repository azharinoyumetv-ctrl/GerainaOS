**Latest audit:** [21 broader customer experience issues](CUSTOMER-EXPERIENCE-AUDIT.md) remain open. Hold the next release; the fixes documented below remain locally verified.

# Five POS audit findings: local implementation

**Later follow-up:** [three additional inventory defects](POS-FOLLOWUP-DEFECTS.md) are now corrected and locally verified. The expanded CLI suite passes 45 checks; new package release checks remain pending. See [current evidence](INVENTORY-FIXES-VERIFICATION.json).

26 October 2026. All five findings from the [1.2.6 audit](ANDROID-1.2.6-FEATURE-AUDIT.md) are addressed in local source. Payment scope follows the user's decision: keep the working methods consistent, with virtual accounts handled through gateway checkout. This does not add standalone card/EDC or bank-transfer processing.

The public APK is still 1.2.6. No production code, merchant configuration, payment or message was changed during this work.

| Finding | Implemented behaviour |
| --- | --- |
| POS stops at 500 products | A store-scoped cursor endpoint loads the complete active catalogue in bounded pages. POS searches that catalogue, keeps only 48 cards mounted, and resolves online barcodes against the server, including products beyond the first page. Duplicate active SKUs produce an explicit error. |
| Incomplete offline catalogue | IndexedDB is replaced only after every page completes and the count is consistent. An interrupted later page leaves the previous complete cache intact. Old caches without completeness metadata are labelled accordingly. A failed refresh can be retried. Stock overview, low-stock and the Reports → Inventory tab read the full catalogue, with 50 rendered table rows per page. The separate inventory valuation page is also corrected in the follow-up above. |
| History stops at 200 orders | A server search/filter endpoint pages by timestamp and ID, with deterministic ordering for equal timestamps. Sales searches all matching store records, renders 50 rows, and offers next/previous controls and result counts. Stale requests and account changes cannot overwrite a newer result. |
| Payment settings disagree with checkout | A public, credential-free readiness endpoint drives POS choices. Online order creation independently enforces enabled methods and e-wallet channels before a gateway call or stock change. Cash toggles and supported Xendit channels now affect checkout. A provider selection cannot silently fall back to a different provider. |
| DOKU returns to the wrong place | New checkout callbacks point to the canonical sales page with the stored order ID. The reference survives sign-in and resolves only within the authenticated store. The receipt reads the stored server status; URL parameters such as `status=paid` cannot mark anything paid. Missing/unavailable references show an error and retry. |
| Failed reads look like zero data or endless loading | POS, sales history, stock overview, low-stock alerts and all report readers distinguish loading, errors, valid empty results and successful data. Retry is explicit, and superseded/unmounted requests cannot change the current view. Reports request only the data needed by the selected report. |

The first two rows are the catalogue finding and its offline safety requirements; the remaining rows cover the other four findings.

## Working payment methods

| Method | Source of truth |
| --- | --- |
| Cash | Store's cash preference. Offline devices use their last saved policy; completed offline cash sales remain eligible for synchronization. |
| Bank QRIS | Store's enabled bank-issued static QRIS. Staff confirmation remains manual. No gateway key is required. |
| Xendit e-wallets | Store's active integration, own secret key and callback token, supported plan, enabled e-wallet preference and enabled OVO/DANA/ShopeePay/LinkAja channels. No platform subscription key is used as a fallback. |
| DOKU checkout | Store's active integration, own Client ID/shared key, plan and configured channel preference. The existing DOKU hosted checkout provides supported virtual accounts, e-wallets and minimarket channels. |

Unimplemented standalone VA, online-card, manual-transfer and EDC options no longer have activation/save controls. Merchant Midtrans checkout is also explicitly unavailable, rather than accepting an activation that POS cannot execute. Existing stored credentials/account details are preserved. The payment-config response still includes complete legacy sections so older clients can read partial documents safely. Subscription billing is unchanged.

This patch does not claim that every provider's virtual-account API has been implemented. It keeps the methods actually implemented in Geraina consistent, as requested.

## Verification

The machine-readable evidence is [POS-REMAINING-FIXES-VERIFICATION.json](POS-REMAINING-FIXES-VERIFICATION.json). It records the current counts, individual UI results and the prepared frontend bundle hash.

- Isolated backend checks include 1,203 products over three pages, exact/duplicate/inactive barcode handling, 257 orders with equal timestamps, search beyond the former history window, store boundaries, disabled channels/methods, merchant-only credentials, DOKU return URLs and preservation of legacy configuration.
- Frontend unit checks cover complete catalogue enumeration, interrupted/malformed/changing pages and safe authentication return URLs.
- The focused UI matrix uses phone, Xiaomi-sized and Samsung-sized Chromium viewports with the Android presentation and isolated API/IndexedDB fixtures. It covers complete offline-cache preservation, actual settings-to-POS changes, old-order search, DOKU login recovery, scoped reference errors, failure/retry states and actor-scoped cash receipts.
- Navigation regression checks retain the earlier DOKU/sidebar, route, plan, permission, billing, QRIS and unavailable-feature fixes.

These checks do not make real gateway charges, bank settlements or WhatsApp sends. They are not certification on physical tablets or printers. The new package's Android device/update checks and TestSprite verification against a reachable preview/release URL remain pending.

## Run with the laptop's Playwright CLI

From `GerainaOS/frontend`:

```powershell
npm run build
.\node_modules\.bin\playwright.cmd test --config=playwright.local.config.js
```

Latest local CLI run: **45 passed, 0 failed, 0 retries**, with 45 screenshots.

This runs 12 focused POS scenarios plus three inventory regressions at phone, Xiaomi-tablet and Samsung-tablet widths: 45 tests. The dedicated local config excludes the production registration/CRUD specs and intercepts all application/API traffic with isolated fixtures. The standalone Node bench and CLI suite share the original POS scenario definitions.

The HTML report is `android-app/app/build/reports/playwright-cli/report/index.html`, with screenshots and request evidence for each test and a trace for any failure. Raw CLI results are saved alongside it in `results.json`. To reopen the report:

```powershell
.\node_modules\.bin\playwright.cmd show-report ..\android-app\app\build\reports\playwright-cli\report
```

## Rollout

Deploy the matching backend before distributing a new APK. The new UI requires `/products/catalogue`, `/products/lookup`, `/orders/history`, `/orders/resolve`, `/payments/options` and `/reports/inventory/dead-stock`; the old list routes remain available for existing clients. Startup adds non-unique catalogue, history and paid-order date indexes. No destructive data migration is required.

The next package must use a new version/code and the existing signing key. Published 1.2.6 must retain its current bytes and checksum. No release artifact was overwritten or published by this task.
