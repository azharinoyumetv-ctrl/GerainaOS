# Geraina 1.2.12 — return from unpaid external checkout

Reproduced on the signed 1.2.11 APK: one Buy tap opened an external unpaid checkout activity. Android Back returned to pricing with the spinner still active; the next app Back navigated through sign-in. The stored test session token remained intact, so the reproduced sign-out symptom was an incorrect navigation detour.

The app now remembers a subscription checkout handoff to Xendit and returns to **Pengaturan → Langganan & Tagihan** with a clean GET when Android resumes. This discards the suspended loading screen and does not replay the purchase POST. Billing checks the existing account and payment status normally. Back from signed-in package selection also returns to billing. Store data, authentication validation and entitlement/payment verification are unchanged.

The return rule only applies to Geraina subscription pages handing off to the approved Xendit checkout origins. POS payment links and unrelated external links retain their original behavior. A genuinely revoked session still requires sign-in. The return destination is restricted to the fixed billing URL and retained across saved Android activity state.

Verification uses an actual separate Android activity with no Internet permission, selected only for a test checkout URL. The browser receives a real 303 redirect, Android pauses Geraina, and the system Back key closes the unpaid checkout activity. It does not select a payment method, create a live invoice or make a payment.

The installed candidate passes seven lifecycle checks: single-tap handoff, direct signed-in return without a spinner, unchanged unpaid plan, retry, Back from selection, unrelated external-link behavior and revoked-session rejection. It also passes 31 existing navigation checks, 26 Android unit tests, release lint and package signature/bundle verification. The original 1.2.11 reproduction and the exact installed APK hash are recorded in `CHECKOUT-RETURN-1.2.12-VERIFICATION.json`.

To repeat the local lifecycle bench, start the Xiaomi emulator, run `Build-CheckoutFixture.ps1`, then `verify-checkout-return-android.cjs`. Set `GERAINA_CHECKOUT_BASELINE=1` only for the old 1.2.11 reproduction. The fixture APK is a disposable test tool and is not part of the customer APK.
