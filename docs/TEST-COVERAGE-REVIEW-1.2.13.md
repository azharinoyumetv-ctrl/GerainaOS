# Geraina 1.2.13 test coverage review

Reviewed 27 October 2026 after customer reports. This is an evidence review, not a new full functional audit or a claim of new runtime passes. No application behavior was changed by this review.

## Finding

The available tests do not establish that every customer feature works end to end on the current installed APK. Earlier statements about testing the whole app were broader than the evidence supports. A green targeted release report must not be presented as whole-app certification.

## Confirmed coverage gaps

| Gap | Repository evidence | Consequence |
| --- | --- | --- |
| Camera permission prompt bypassed | `android-app/scripts/verify-pos-scanner-android.cjs` grants CAMERA through ADB before opening the app. | That test cannot establish first-use Allow/Deny behavior or recovery after permission revocation. Opening the scanner is not proof of decoding a physical barcode. |
| Main deployment E2E suite is a desktop browser suite | `frontend/playwright.config.js` configures Desktop Chrome only and excludes `*-local.spec.js`, `customer-*.spec.js` and `payment-workflow.spec.js`. The deployment invokes that default config. | Passing deployment checks do not run those excluded local payment, inventory, offline, onboarding, role and customer audit scenarios. Excluding local benches from production is appropriate, but they require a separate local execution gate. |
| Latest native evidence is targeted | `docs/ADDON-CHECKOUT-1.2.13-VERIFICATION.json` records three installed Android add-on scenarios and seven public updater checks, with an exact APK hash. | These establish those flows on the Android 16 emulator. They do not establish every menu, every role or current-APK behavior across Android 14–17 and physical tablet models. |
| Older native benches retain release-specific assertions | For example, `verify-pos-scanner-android.cjs` asserts build 13 for its fixed candidate, and `verify-checkout-return-android.cjs` asserts 1.2.12/build 17. | Historical passes cannot be relabeled as current 1.2.13 passes. Version checks should remain strict, with explicit candidate inputs before rerunning them. |
| Provider simulation is narrower than live service integration | The 1.2.13 report explicitly records zero provider requests and simulated payment truth for paid fulfillment. | Amount binding, activation, renewal and reversal logic were tested, but this is not evidence of a real paid transaction, live merchant gateway settlement or external message delivery. |
| Physical device and external account behavior remains limited | Earlier customer audit documents disclose unverified physical Bluetooth/USB prints and optical camera capture. The latest release evidence adds no physical hardware certification. | Actual receipt output, printer reconnection, camera capture on customer hardware and mail-app account selection cannot be declared verified from browser callbacks or source inspection. |

## What the latest evidence actually supports

- 384 backend tests, including real Mongo concurrency and rollback cases; these are code-path tests, not a count of independently verified customer features.
- 33 checkout/website tests and 10 frontend return-link tests.
- Add-on browser purchase, unpaid, renewal, refund/expiry and eligibility flows across phone and two tablet layouts against a disposable real backend and simulated provider.
- Installed Android add-on checkout, real system Back from a separate unpaid fixture Activity, paid activation and exact package identity.
- Public download verification and an actual 1.2.12-to-1.2.13 Android installation preserving preferences and a pending offline sale.
- Successful production CI and a passed TestSprite public APK metadata/checksum check. Neither certifies all in-app features.

## Required acceptance work before claiming a complete audit

This checklist is not yet a new implemented gate or a completed audit.

1. Build the feature checklist from the current routes, tabs and visible actions. Track screen rendering separately from completion of each customer workflow.
2. For each applicable workflow, record the exact APK/version, role, plan, device profile and backend; exercise success, rejection, cancellation, failure, reload and persisted result. Include offline/reconnect where relevant.
3. Run first-use permission tests without pregranting access, including denial, repeated denial, revocation and recovery through Android settings.
4. Run the excluded local business and financial suites in a separate isolated job against the candidate; do not mix production services with disposable fixtures.
5. Rerun the applicable native regressions against the exact candidate. Keep older release evidence explicitly historical.
6. Mark provider simulation, physical hardware checks, unavailable features and untested cases explicitly. Unknown coverage remains unverified; it does not become a pass.

## Reporting rule

Report "the listed checks passed" with their scope. Do not report "everything tested", "fully audited", "all features working" or "bug-free" without a current feature-by-feature evidence record. A supported explanation of expected platform behavior is not a new device test.
