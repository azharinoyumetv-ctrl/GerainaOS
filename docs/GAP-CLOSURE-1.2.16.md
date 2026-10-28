# Geraina 1.2.16 — published gap closure

Website release published and verified on 29 October 2026 JST. Public release is 1.2.16/build 21. No payment-provider processing, server authorization, prices or customer records were changed in this pass. No Play upload was performed.

## Confirmed gaps repaired

| Gap | Repair | Acceptance evidence |
| --- | --- | --- |
| A failed lazy-screen download unmounts the whole app, leaving a blank screen | Per-screen error boundary, explicit retry with a fresh lazy import, and a home link; no automatic reload or logout | Original interrupted-download reproduction showed a blank phone screen. Recovery tests cover repeated failure, successful retry, unchanged session/document, and escape through navigation on three layouts. |
| Play selection still packaged the website updater and installer permission | Separate updater implementations and manifest overlays for Play/website; separate output folders | Both actual APK/AAB distributions pass compiled-code and manifest checks. A deliberate website-as-Play verification is rejected. |
| Play add-on purchase buttons offered a checkout that the native gate blocks | Consumption-only package/add-on controls; active access remains visible | Play billing/About/support/physical POS checks; website subscription regressions retain eligible purchases. |
| Dashboard chart says UTC even when daily totals follow the store timezone | Display the server-provided store timezone; keep calendar-day rendering stable | Focused fixture uses Asia/Jayapura and verifies both the chart accessibility label and visible note. No financial aggregation changed. |
| Rebuilding default settings could replace a published version locally | New candidate version/build; reject build codes at or below the published manifest | Version 1.2.15/build 20 is rejected before building/staging. |
| Privacy/deletion/store listing documentation disagrees with current app | Geraina-specific native policy link; public deletion instructions describe the authenticated support form; updated Play listing and readiness checklist | Portal tests and package/UI checks. Documentation is prepared locally, not yet published. |

## Verification

Exact final APK hashes, run directories and totals are recorded in GAP-CLOSURE-1.2.16.json after verification. Tests distinguish browser layouts, installed AOSP emulator profiles, and actual external/hardware results. Build and test-bench failures are preserved locally rather than counted as successful application tests.

The first recovery rerun overlapped a frontend rebuild and lost build/index.html; its clean-build rerun passed. The initial Play build exposed unsupported manifest placeholders/source wiring; those were replaced with distribution overlays and the AGP Kotlin source set. A website-only unit expectation was corrected for Play's intentional blocked checkout return. A native rerun initially retained its disposable login from the preceding distribution; clearing test login state fixed the bench. These do not establish physical-device results.

The old mobile presentation bench mocked retired product/history/statistics contracts. Its fixtures now use complete catalogue/history/daily statistics responses and its focused checks pass. It still blocks merchant writes; the intercepted product edit modifies only in-memory test fixtures.

## Owner-reported physical camera check

On 28 October 2026, the owner reported that camera scanning works well and quickly on both a physical phone and tablet. Optical camera scanning is recorded as passed by owner testing on those devices, separately from automated emulator checks. Device models, installed app version and individual barcode formats were not specified, so this does not certify the unpublished 1.2.16 package or every device/format.

## Playwright follow-up — 29 October 2026

The owner requested Playwright instead of TestSprite. All 42 browser cases passed across phone, Xiaomi-sized and Samsung-sized layouts: actual form login/rejection/recovery, deferred navigation, Back/Forward, failed-menu retry, onboarding and gateway method configuration. Ten additional support scenarios passed with captured SMTP and no real email.

Six installed-APK runs passed on Android 16 phone and 14.6-inch tablet emulators (three per device): startup/navigation/cold restart; support/deletion-request intake and actual permission denial/grant; and offline cash plus a real in-place 1.2.15-to-1.2.16 installation. Each upgrade preserved login, a preference, the catalogue and a genuine pending offline sale. Reconnect produced exactly two sales in total and stock 8 from an initial 10 after the two sales, without duplicate synchronization.

The APK is unchanged: SHA-256 `33273cea7288c06acdcf0ef183ec8893a59f34be46864888f9391355064722e7`. Only tests and evidence changed in this follow-up. Exact paths and scopes are in REMAINING-PLAYWRIGHT-1.2.16.json. Startup samples are emulator observations, not physical-device performance guarantees. Upgrade retention used Android installation via adb; official 1.2.16 update-feed delivery subsequently passed the real Android update flow described below. Support intake is tested, while actual account/data erasure remains separate. No provider charges, live settlement or external emails were performed.

## Open gates

- Navigation verification is now PASSED using Playwright at the owner's request. Historical TestSprite runs remain blocked; they are superseded for this workflow rather than relabelled successful.
- Startup/navigation, camera denial/grant, Bluetooth denial, cold restart and update retention passed on the installed phone and 14.6-inch tablet emulators. Physical printer output and vendor-specific device coverage remain open. Optical scanning on a physical phone/tablet is confirmed by the owner above.
- Live merchant gateway settlement/webhook/reconciliation and WhatsApp delivery need separately authorized provider tests.
- Deletion request intake is implemented; verified account/data erasure, shared-store authority and real retention periods still need an operating procedure and review.
- Final Data safety declarations, reviewer access, organization verification/D-U-N-S and Play Console testing/pre-launch findings remain external release gates.
- This pass is targeted gap closure. It does not certify all workflows, zero defects, 200,000-user capacity, or Google Play approval. The full backend suite was not rerun because backend code did not change; previous backend results remain historical.

The current submission checklist is ../android-app/play-store/RELEASE-CHECKLIST.md. It links the official Google requirements checked during this review.

## Published verification — 29 October 2026

Website APK 1.2.16/build 21 is live at https://dagangos.com/geraina/android. All four deployment jobs passed: deploy, Cloudflare zone audit, Geraina e2e and public accessibility. Six live listing/download checks and the public APK contract passed. The actual public 1.2.15-to-1.2.16 update passed seven checks, including user permission denial/retry and retained preferences/pending offline sale. Pulling the installed package confirmed SHA-256 `33273cea7288c06acdcf0ef183ec8893a59f34be46864888f9391355064722e7`.

At the owner's request, remaining equipment/provider behavior was tested on the bench: seven ESC/POS command tests (58/80 mm), 113 payment/configuration/webhook contract tests and 23 support-identity tests passed. These simulate/capture external effects. They do not claim printer paper output, settled funds, actual account erasure, WhatsApp delivery or Play Console approval. Those external/operating-policy limits remain explicit.

Publication source: GerainaOS `0e325020665052b8a6915ca1d9a6e4148ac47275`; portal `19a590e9d96a1b97f483fd45a0c4be3f65f71597`; workflow 40718805979.
