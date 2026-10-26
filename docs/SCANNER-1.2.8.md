> Superseded scanner-only candidate. The combined candidate and matching backend are documented in PAYMENT-WORKFLOW-CORRECTION.md and RELEASE-1.2.8-VERIFICATION.json.

# Geraina 1.2.8 barcode shortcut repair

The barcode icon beside Kasir search opened manual entry instead of the native camera. The manual-entry CSS also targeted a descendant class although the state class is on the HTML root, so its input stayed hidden.

The shortcut now launches the native POS scanner. The existing camera button remains available, and a separate **Ketik barcode** button opens a visible manual input. Both paths preserve normal product lookup and cart behavior. Backend/payment code is unchanged.

Verification: 48 browser checks across phone/Xiaomi/Samsung layouts, 38 frontend units, 24 Android units, release lint with zero errors, valid signing certificate, and all 18 packaged frontend manifest entries. In the actual signed 1.2.8 APK, both camera controls open a working emulated preview and manual entry adds the product to the cart. No merchant record or real payment was created. Physical barcode recognition is outside this verification.

Evidence: SCANNER-1.2.8.json and android-app/app/build/reports/pos-scanner/verification.json. Publication is recorded separately after the website and public updater checks.
