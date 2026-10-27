# Geraina 1.2.11 — purchase feedback and tier visibility

The package purchase grid offers Starter, Pro and Business in both the bundled React page and the public checkout page. Existing account holders no longer see a Trial purchase card or the signup shortcut on that purchase page. Trial signup remains available for new accounts.

The first Buy tap paints a spinner, disables repeated submissions and announces that payment is opening. The same feedback covers the explicit package-change confirmation. The controls recover when returning from checkout. A longer wait displays a message without automatically retrying a payment request.

The React Buy control now carries the selected tier and period directly to the purchase page, removing the legacy checkout redirect. A saved, valid purchase intent continues without waiting for a redundant account-status request. The authoritative account, price, payment and duplicate checks still run on the server. A URL alone or expired intent cannot initiate checkout. No payment-provider protocol, backend entitlement logic or price was changed.

The one-line tier notice uses amber for Trial, green for Starter, blue for Pro, purple for Business and red for expired access. Measured text contrast is at least 4.5:1. The notice stays 36 pixels high.

Verification covers 24 purchase scenarios on phone, Xiaomi and Samsung layouts; 15 colored notice checks; three React purchase/back-navigation checks; nine checks in the signed tablet APK; 31 existing navigation checks; 26 portal checkout/routing tests; and 25 Android unit tests with release lint and signature verification. Test payment requests are intercepted before contacting a provider. Measured feedback times describe the UI response, not live Xendit processing time.

Publication, public package delivery and the actual Android update are recorded in `PURCHASE-EXPERIENCE-1.2.11-VERIFICATION.json` after release.
