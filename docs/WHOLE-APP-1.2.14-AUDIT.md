# Geraina 1.2.14 verification ledger

This ledger distinguishes software checks, emulated Android checks and external/hardware work. It does not certify that every possible interaction is defect-free. Final release metadata contains exact versions, APK hashes and publication checks.

## Completed software runs

- Full backend suite: 409 passed. Includes the new support authentication, identity binding, SMTP headers, missing configuration, uncertain delivery, idempotency and actual Mongo concurrency tests.
- Broad customer audit: 294 passed across phone, Xiaomi-sized and Samsung-sized browser layouts. Includes 56 screens per layout plus login, product creation, inventory, purchasing/receiving, branch balances, supplier payments, loyalty, historical profit, sales, offline/reconnect, bank QRIS confirmation, onboarding and employee access.
- Payment workflow suite: 24 passed across the three layouts. Verifies configured gateway/channel choices, cashier visibility, QRIS tab consistency and unavailable-method explanations. No gateway settlement was performed.
- Subscription management suite: 20 passed, including stop/resume, failure, reload, expired-owner access and employee restrictions.
- POS/inventory regression suite: 48 passed. Its API/provider fixtures are simulated; these are not hardware/provider certification.
- Support browser scenarios: 10 passed across phone and large tablet, including employee/expired account identities and recovery from ambiguous SMTP outcomes.

## Android evidence

The installed candidate is version 1.2.14/build 19. Each native support record includes the installed APK hash and actual Android version. Camera permissions are revoked before testing; the new tests do not pregrant them. Tests exercise the native Help menu, deletion-request cancellation/preparation, first-use camera denial/grant, camera preview and Bluetooth permission denial.

The installed tablet cash-sale test uses real disposable backend handlers and MongoDB. It switches the device network off, saves cash locally, reloads offline, reconnects and verifies exactly two orders and the correct stock changes; both sales appear in app history.

## Findings and reruns

- Fixed before publication: concurrent first support submissions could race collection creation/upserts. The route now creates its ticket index before transactions and locks the existing authenticated account. Real Mongo duplicate and rate-limit concurrency tests pass.
- Three POS test attempts failed because the frontend build replaced files while the test runner was reading them. The completed-build rerun passed all 48 without retries. These are recorded as bench failures, not customer defects.
- An initial Android emulator run encountered a System WebView native crash. A fresh run completed the installed-app checks. This is not evidence of a reproduced Kotlin exception or a certified physical-device fix.
- An initial native test expected title-case dialog text, but Android displayed uppercase button labels. The locator was corrected and the complete native workflow was rerun.

## Still requires external or physical verification

Physical Bluetooth/USB receipt output, vendor-specific printer protocols, optical barcode capture on customer cameras, live merchant gateway settlement/webhooks, bank settlement and live WhatsApp delivery are not established by these local runs. Browser dimensions are not a physical Samsung/Xiaomi hardware certification. Pending or unavailable checks remain unverified.

The public release must also pass package/signature/credential exclusion checks, deployed support delivery, website/download checks, CI, TestSprite and the actual in-app upgrade before publication is reported complete.
