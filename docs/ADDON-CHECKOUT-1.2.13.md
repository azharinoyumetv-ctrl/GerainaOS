# Geraina 1.2.13 — paid capacity add-ons

Owners can buy add-ons from Langganan & Tagihan or Harga in Android and web. An explicit quote shows the price, one-month term, required base package and its expiry before opening Xendit. Unpaid orders can be inspected and resumed from Billing. Only independently verified payment grants capacity.

- Pro: extra cashier device, Rp49,000/month, maximum two extra device entitlements.
- Business: extra outlet, Rp149,000/month, includes five devices and fifteen staff seats.
- One prepaid calendar month per purchase; no automatic renewal. Renew extends the existing entitlement's paid time, without duplicating its capacity.
- The matching base package must remain active. Add-on expiry or refund affects its own paid cycle and never replaces or revokes the base package. Existing business records and registered devices are preserved.
- Trial, Starter, staff and mismatched packages cannot purchase. Existing manual active grants remain recognized within their required package. Old clients receive a clear update instruction instead of creating another unpayable manual request.

Checkout uses DagangOS subscription billing. Merchants' POS gateway credentials and bank QRIS configuration are unchanged. Confirmation is serialized in real Mongo transactions; a one-time invoice claim prevents concurrent duplicate invoice creation. An uncertain provider creation result is not retried automatically: Billing retains the order reference for inspection or support recovery.

Validation: full backend suite, genuine Mongo concurrency/rollback tests, Worker runtime tests, browser purchase/renewal/expiry flows on phone and two large-tablet layouts, installed Android tablet checkout with a separate offline checkout Activity and real system Back, exact installed APK hash, original signing certificate, bundle validation, alignment and credential exclusion. The provider was simulated for fulfillment tests; no real charge was made. See the companion verification JSON for actual counts and publication checks.

The matching backend must be deployed before the website and APK are published.
