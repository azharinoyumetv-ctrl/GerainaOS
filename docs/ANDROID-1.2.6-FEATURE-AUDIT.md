# Geraina 1.2.6: missing and mismatched feature audit

**Follow-up implementation:** the five remaining findings have now been addressed locally. See [POS-REMAINING-FIXES.md](POS-REMAINING-FIXES.md) and its verification record. The findings below preserve the original audit state.

Audited 26 October 2026. **DOKU is implemented and appears in the integration page tabs, but its sidebar entry was omitted.** The defect is confirmed in assets extracted from the published APK. It is one of several inconsistencies, not an isolated label problem.

**Status:** corrections are prepared locally. The public APK and website have not been updated by this audit. This is not a 1.2.7 release certification, and the open findings below remain unresolved.

## Coverage and evidence

- Original signed APK: 1.2.6 / code 11, SHA-256 `11da42cc1a7cc02e5afa02313a6136c5206851b15553952aca63be03ffd83b53`. The original package was preserved.
- Opened all 56 named operational screens using the original packaged frontend and real, read-only Geraina APIs. The first smoke check only verified that pages rendered. Recording response codes and placeholder content revealed billing/license HTTP 404s and two missing payment forms despite that smoke check passing.
- Reproduced 29 failing UI contracts against the original APK assets. The root `/app/pos` case was independently repeated after correcting the test server's alias handling; its actual failure was cashier access denial. The later read-only billing navigation finding was discovered by exercising SPA navigation, rather than page reloads.
- Patched frontend: 30 UI contracts at 412, 1016 and 1480 CSS-pixel widths, plus actual DOKU sidebar clicks at all three widths. These are Chromium checks with the Android presentation/bridge; they are not physical Xiaomi/Samsung or emulator installations.
- Patched frontend with live read-only APIs: all 56 screens passed, with no failed API responses or missing-configuration placeholders. Merchant record/payment/message writes were blocked.
- 71 isolated backend payment-settings/QRIS checks, 24 Android unit tests, 21 frontend tests, the 10 bridge checks, and the production frontend build passed.
- Static inventory: 124 backend route declarations and 129 frontend API references have compatible methods and paths. The generic PDF download wrapper takes a runtime path and is reported separately. This inventory does not validate every payload, financial rule or provider protocol.

Machine-readable results: [ANDROID-1.2.6-FEATURE-AUDIT.json](ANDROID-1.2.6-FEATURE-AUDIT.json). Detailed local screenshots and outputs are in `android-app/app/build/reports/navigation-audit-*`, `navigation-doku-click-*` and `screen-audit-patch-final/`.

## Corrections prepared locally

| Area | Confirmed mismatch | Correction |
| --- | --- | --- |
| Integration navigation | DOKU exists in page tabs but is missing from the sidebar. | Restore DOKU; sidebar and page tabs now share channel definitions. |
| Sales navigation | Sales history exists, and roles can access it, but has no sidebar entry. | Add **Riwayat Penjualan**. |
| EDC navigation/status | EDC exists in payment tabs but not the sidebar; its activation control is editable despite providers being unavailable. | Include its availability page and disable activation. This does not implement EDC. |
| Payment forms | URLs normalize `credit-card` and `bank-transfer` to underscore names, but form cases still expect hyphens. | Match the normalized names so both forms render. |
| Payment loading | Failed/empty configuration reads leave default fields available for saving; partially populated documents can crash rendering. | Block saves during loading/errors, show retry, merge missing sections with safe defaults. |
| Payment writes | A save resubmits unrelated sections; rapid repeated submissions can send duplicates. | Save the selected section only and lock repeated submissions. Other stores/providers remain unchanged in isolated tests. |
| New-store defaults | A fabricated receiving bank account and unconfigured active channels are supplied as defaults. | Default to blank account details and inactive gateway channels. Existing saved merchant configurations are preserved; they must not be silently rewritten. |
| Billing/license status | `/api/subscription` does not exist and returns 404; the UI then falls back to Trial. | Use the authenticated account's server-resolved plan/subscription instead. Remove outdated manual-activation wording. |
| Android account status | The native subscription blocker also hides/blocks the read-only billing overview. | Permit the two exact overview paths in JavaScript and Kotlin. Pricing, encoded checkout and nested checkout remain blocked and tested. |
| Callback instructions | DOKU and WhatsApp instructions point to the other backend's host. | Use the Geraina callback backend, consistent with Xendit. This is not a live payment/delivery certification. |
| Merchant integration screens | Developer webhook simulators are visible to ordinary merchants even when production rejects them. | Remove simulator controls from the merchant UI. Backend test endpoints are unchanged. |
| QRIS consistency | The integration sidebar inherits Pro gating for bank QRIS, while the actual bank QRIS page has no such requirement; its page loses payment tabs. | Apply per-channel plan requirements and retain payment navigation on bank QRIS. |
| Role/plan consistency | Android dashboard shortcuts send cashiers to forbidden inventory/report screens. | Filter shortcuts using the same frontend access rules as route guards. Keep sales history accessible. Remove unused kitchen/ingredient module permissions left over from another product. |
| Routes | Legacy links can open the wrong default page or deny an otherwise valid cashier route; unknown subsections can display an unrelated form with a save button. | Canonicalize aliases while preserving query/hash; show a safe not-found page for invalid app routes. |
| Menu expansion | In a browser, merely expanding a sidebar group changes the current screen. | Expand the group without navigating. |
| Financial representations | Reports invent a daily sales distribution. The tax page substitutes Rp15 million for zero/missing sales and offers an e-Faktur button that downloads nothing. The browser dashboard fabricates cash, margin, payment mix and branch allocations, and labels the first five catalogue entries as bestsellers. | Remove fabricated figures and the no-op export; show unavailable states and accurate catalogue labels. Preserve the Android dashboard's transaction-based figures. Tax calculation/export and those missing chart aggregations are still incomplete features. |

## Confirmed open findings, in priority order

| Priority | Finding | Evidence / required work |
| --- | --- | --- |
| P1 | **POS search, barcode lookup and offline catalogue stop at the first 500 products.** | An isolated Business store with 501 products returns 500 from the unparameterized product request. POS searches/scans that local list. Server search can find product 501, but POS does not use it. Implement complete, bounded catalogue retrieval plus server lookup and explicit offline coverage. Reproduction: `audit-catalogue-limits.py`. |
| P1 | **Sales history only searches the latest 200 orders.** | The same isolated reproduction inserts 201 orders; the default history response omits the oldest, and Sales filters that response locally. Add server search/pagination with a visible result boundary. |
| P1 | **Payment preferences are not connected consistently to checkout.** | Cash/channel enable flags and provider selections in `PaymentConfig` do not govern POS choices. E-wallet orders use Xendit even though the preference screen also offers Midtrans. Standalone VA, online-card and manual-transfer execution are absent. The patch explains these limitations; it does not manufacture working integrations. |
| P1 | **DOKU's default return destination is `/pos`, and POS does not consume the returned order reference.** | `routes_orders.py` constructs `DOKU_RETURN_URL` with this default. The gateway can return the customer to an unrelated portal route. Implement a safe canonical return/recovery flow and test it with the merchant's sandbox account before certifying DOKU. An environment override may change the live return URL; this audit did not inspect production secrets. |
| P1 | **Several read failures still look like empty business data or permanent loading.** | Examples: stock overview/low stock swallow request errors; profit/cashflow reports reset data to `null` and continue displaying loading. These source-confirmed branches require focused failure/retry work. Payment configuration failure/retry is corrected, but this is not yet consistent across every module. |

## Release limits and next work

The immediate POS priorities are complete catalogue/barcode coverage and searchable sales history. Completing a menu audit does not mean all advertised features are implemented.

No live DOKU/Xendit/Midtrans charge, bank settlement, WhatsApp delivery, or physical Bluetooth/USB print was performed. This audit made no production merchant data/configuration changes. No new APK was installed or published. TestSprite cannot validate this local patch until it has a reachable preview/release URL; its verification and the next APK's device/update checks remain pending. A future package must use a new version/code and the existing signer; published 1.2.6 must not be overwritten.
