# Geraina POS 1.2.6 candidate

APK candidate, code 11. The source update is prepared for main; the website APK remains on 1.2.5 until the remaining Android release checks pass.

## Changes

- Replace the role selector with account handoff requiring each employee's own login. Owner access requires Owner credentials. Unfinished carts and active writes block handoff; confirming handoff clears all shared session tokens. Employee authority comes from active server membership. Resetting or disabling credentials invalidates existing sessions.
- Legacy Geraina employee accounts using shared passwords must receive a unique temporary password from the Owner and set their personal password before using POS or attendance. Existing Owner credentials are preserved. No production staff records were changed.
- Cashiers open directly into POS. Render 48 product cards per page; search and barcode lookup retain the loaded catalogue. Product management renders 25 rows, avoids duplicate entry requests, and keeps summary totals across loaded products. Android skips hidden desktop charts.
- Add personal attendance for employees, separate from Owner/Manager team attendance. Server identity and time, stable check-in request IDs, and checkout tied to the actual shift prevent duplicate or mistaken shift actions.
- Align visible cashier controls with server permissions. Close the mobile drawer before the switch confirmation; render access denial safely; revalidate the session when connectivity returns.
- Contain Geraina records at the shared Dapur backend boundary. Preserve Dapur's existing employee sign-in and Owner cross-product activation; this is not a general Dapur feature rewrite.

## Local evidence

210 Geraina backend checks, 27 shared-backend checks, 23 Android unit checks, 9 catalogue component cases, 24 browser cashier-flow checks, 12 installed phone checks, 12 installed Xiaomi Pad screen-profile checks, and 24 bank-QRIS browser checks passed. Android release build/lint, original signer, bundle validation, alignment and credential exclusion passed.

With 500 synthetic products, the controlled 4x CPU replay measured POS readiness at 1,488 ms in 1.2.4 and 720 ms in this candidate. Visible cards fell from 500 to 48; the catalogue entry request count fell from two to one. These are isolated replay measurements, not a physical Xiaomi performance guarantee.

The machine-readable evidence is `android-app/releases/pos-candidate-1.2.6-verification.json`. Detailed local flow results and screenshots are under `android-app/app/build/reports/pos-accounts/`; comparison results are under `android-app/app/build/reports/navigation-performance/`.

## APK publication remains pending

The matching server changes must deploy before distributing the new APK. Remaining Android release-profile/updater checks and deployed TestSprite verification have not yet run for 1.2.6. Local verification did not migrate staff, make real bank payments, or write production merchant records. Existing bank-issued QRIS, actor-scoped offline cash sales, camera and printer implementations are retained; this pass does not certify physical printer hardware.

The broader Odoo comparison is paused at the user's request to focus on POS.
