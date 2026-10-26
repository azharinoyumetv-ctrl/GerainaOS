# Geraina 1.2.10 — subscription management

The website-distributed Android APK now lets the store Owner open package pricing and checkout from **Pengaturan → Langganan & Tagihan**, using the existing signed-in account. The embedded purchase pages stay on dagangos.com; Xendit's hosted payment page opens externally. A separate `gerainaDistribution=play` build retains purchase restrictions pending a Play billing implementation.

Both the website and Android billing page expose **Hentikan langganan** with explicit confirmation. Geraina currently sells prepaid monthly/yearly terms through platform Xendit Payment Links: there is no recurring plan, saved debit mandate or automatic renewal in this implementation. Stopping records the Owner's end-of-term intent; it neither charges/refunds money nor shortens paid access. **Batalkan penghentian** removes this intent without enabling automatic billing. Trial and expired accounts are explained separately.

Cancellation is authenticated, bound to the actual store Owner and current paid order, and rejects missing confirmation, stale orders, staff accounts and changed ownership. Separate per-product metadata survives duplicate payment notifications; a new paid order does not inherit an earlier cancellation. Paid access still expires on its original date.

Expired Owners retain access to billing while POS operations stay locked. A current subscriber can select another package or billing period. Before creating an invoice for a change, checkout explains that the existing full-price policy starts a new term on verified payment and replaces the previous term without crediting its remaining time. The Owner must explicitly confirm or return without purchasing. This release does not introduce proration or recurring charges.

Merchant POS gateway credentials, payment-method selections and bank-issued QRIS handling are separate from platform subscription payments and are unchanged.

## Verification

- 359 isolated backend tests, including 22 subscription tests; no production account changed.
- 26 portal tests, including 15 checkout/runtime checks and a package-change confirmation before invoice creation.
- 20 browser journeys across phone, Xiaomi and Samsung tablet layouts and desktop web: stop/undo, unchanged expiry and cashier access, expiry recovery, staff denial, failure and retry.
- Three real-browser pricing scenarios: changing period, unavailable provider and anonymous sign-in.
- 24 existing payment journeys and 48 POS/inventory checks passed.
- 31 navigation checks include the adjacent license settings page.
- 25 Android unit tests, release lint without errors, verified original signing certificate and all 18 packaged frontend manifest entries.
- Six checks in the installed signed APK on the Xiaomi tablet emulator, including an authenticated checkout POST intercepted before payment. The installed package bytes match the candidate APK.

Evidence: `SUBSCRIPTIONS-1.2.10-VERIFICATION.json`. Publication and public upgrade checks are recorded there after deployment. These tests do not make a real purchase, refund or cancellation on a customer account.
