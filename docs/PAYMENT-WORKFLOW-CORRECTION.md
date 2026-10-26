# Payment workflow correction — local work in progress

The user confirmed that Payments selects the methods displayed in Kasir. Integrations configures each store's own gateway credentials and bank-issued QRIS. Reference: `memory/PRD.md` (POS and Settings), `memory/PRD-FULL-TESTSPRITE.md` §12, and DapurOS's payment configuration UI. Current user instructions supersede outdated PRD examples and demo defaults.

The 1.2.7 change replaced VA/card/transfer settings with the same DOKU fallback message, restricted e-wallet settings to Xendit, left fixed cashier buttons, and linked Integrations → QRIS to a Payments page. Those are regressions in the intended workflow. Gateway checkout must follow the selected merchant provider; missing setup needs an actionable explanation. Bank QRIS setup belongs to Integrations; its cashier visibility belongs to Payments.

The scanner-only 1.2.8 candidate was never published. Its earlier verification and staged package do not certify these additional payment changes. Rebuild and reverify the combined candidate before publication. Public version remains 1.2.7 until deployment succeeds.

## Corrected behavior

- Payments controls cashier visibility independently for cash, bank QRIS, e-wallet, VA and online cards. Electronic categories select the store's Xendit, Midtrans or DOKU account and expose that adapter's channels. Disabled categories disappear; selected but incomplete categories explain what setup is missing and block checkout.
- Integrations holds merchant credentials and QRIS setup. `/integrations/qris` retains integration tabs; `/payments/qris` contains only the cashier preference and a setup link.
- Xendit direct e-wallet remains supported. Hosted checkout adds Xendit Payment Sessions, Midtrans Snap and category-filtered DOKU Checkout. Allowed channels and provider are read from store policy and snapshotted with the order. The app never substitutes platform subscription credentials.
- An existing configured DOKU checkout stays usable while an Owner changes cash or QRIS preferences. Saving category-specific gateway choices moves that store to the selected categories and blocks the legacy broad checkout from bypassing them.
- Existing stock reservation, uncertain-response handling and idempotency apply to the new categories. Midtrans notifications verify merchant signatures and retrieve authoritative status; Xendit session events verify tenant, reference, session, amount, currency and PAY type. DOKU keeps signed tenant-scoped settlement.
- The search-side barcode icon opens the native camera; manual barcode entry has a separate control and visible input.

## Scope and limits

The release does not implement physical EDC or manual bank transfers. Their older preferences remain stored and their screens explain availability without directing every category to DOKU. Bank QRIS still requires staff confirmation in the bank merchant app. Provider request contracts and notification handling are tested with isolated doubles; no merchant's live account activation or settlement is certified. Physical barcode recognition and printer compatibility are not certified by an emulator.

The legacy `backend/tests/backend_test.py` targets a retired external preview host. It is excluded from the isolated backend suite; current local API and browser regressions supply the release evidence. No result from that retired host is counted as a successful check.

## Provider references

- [Xendit create session](https://docs.xendit.co/apidocs/create-session), [session notifications](https://docs.xendit.co/apidocs/webhook-notification-sent-defined-webhook-url-updates-payment-session), [channel catalogue](https://docs.xendit.co/docs/available-payment-methods)
- [Midtrans Snap method selection](https://docs.midtrans.com/docs/snap-advanced-feature), [notification verification](https://docs.midtrans.com/docs/https-notification-webhooks)
- [DOKU Checkout backend integration](https://developers.doku.com/accept-payments/doku-checkout/integration-guide/backend-integration)

Deploy the matching backend first and verify its read-only payment-options response before publishing the website frontend and APK. Verification results are in `RELEASE-1.2.8-VERIFICATION.json`.
