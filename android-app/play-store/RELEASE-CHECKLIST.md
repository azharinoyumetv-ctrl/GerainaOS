# Geraina POS — Google Play readiness

Reviewed 29 October 2026. Public website release: 1.2.16/build 21. The separate Play build is 1.2.16/build 21. No Play submission or approval is claimed. Organization verification and the owner's D-U-N-S remain external prerequisites.

## Package gate

- App ID `com.dagangos.geraina`; minimum API 34; target API 36. The current target-API policy requires API 36 for new phone/tablet apps. Recheck at submission.
- Build `scripts/Build-Release.ps1 -Distribution play`. Upload only the AAB from `releases/play/`, never the website AAB in `releases/`.
- Android unit tests, release lint and `Verify-Distribution.ps1` must pass. The latter checks actual APK permissions, AAB manifest and compiled code. Play excludes the APK installer, installation permission, update provider and unknown-source-settings action; its update control opens Google Play. The website APK must retain its verified updater.
- Run `scripts/Verify-Release.ps1 -VersionName 1.2.16 -Distribution play` for signature, bundle structure, 16 KB alignment and credential exclusion.
- Retain the existing signing identity for website-install compatibility: SHA-256 `52e14a39a7da4f5f528838f33602860e35960373070a6132d08f682487494ec8`. Plan Play App Signing accordingly; never generate an unrelated replacement key.
- Play consumes existing SaaS package/add-on access until Play Billing is implemented and verified. No external package/add-on checkout prompts. Existing package stop controls and physical-goods POS payments remain separate.
- The build rejects version codes at or below the published manifest. Website and Play files have separate destinations.

## Customer workflow gate

Verify login/password reveal, session expiry, server-enforced roles, staff identity, product/barcode workflows, totals, retry idempotency, atomic stock changes, void states, receipts and reporting. Verify offline cash survives restart/update and reconciles exactly once without crossing merchants.

Test readable inputs, tablet layouts, loading/error/empty states and interrupted menu downloads. A failed secondary screen must retain navigation and offer an explicit retry. Check native first-use camera/Bluetooth grant, denial and cancellation; file picking/exports; About version/update channel; and consistent tier/expiry across screens and authorization. Use exact versioned evidence; do not count historical tests as checks of a new package.

## Privacy, support and deletion

- Public URLs: https://dagangos.com/geraina/privacy and https://dagangos.com/geraina/delete-account. Both must load without login and identify Geraina POS / PT DagangOS Digital Indonesia. Native Privacy opens the Geraina-specific policy.
- Android Menu → Minta penghapusan akun → Buka formulir dukungan opens a prepared request using the authenticated account email. Only explicit submission sends it. The public page provides email instructions without requiring app access.
- A request is not completed erasure. Document who verifies and handles requests, removal/anonymization of account and associated data, shared-store authority, and actual retention periods before Play submission. Do not invent retention periods or silently delete shared transaction records.
- Support uses the authenticated customer's email as Reply-To; it does not send through their personal mailbox. Verify delivery, uncertain responses and duplicate protection.

Prepare Data safety from the owned WebView, backend and native SDKs, including account/email/user IDs, staff/business/customer/supplier/transaction data, optional uploads, device/session/security information and support content. Camera frames are processed locally by the barcode feature; Google ML Kit also has its own technical/installation/diagnostic disclosures. Do not declare no data collected. Final sharing, purposes, optionality, encryption and retention answers require actual service review.

## External gates still required

1. The owner confirmed fast physical phone/tablet camera scanning on 28 October 2026 (models/version unspecified). On 29 October, the signed 1.2.16 APK passed startup, permission recovery and update retention on phone and 14.6-inch AOSP tablet emulators using Playwright. Additional vendor firmware/device coverage remains separate; see [the follow-up evidence](../../docs/REMAINING-PLAYWRIGHT-1.2.16.json).
2. Actual paper output on advertised ESC/POS Bluetooth Classic/USB printer models. BLE-only and proprietary protocols are not certified.
3. Merchant-owned payment gateway settlement and signed webhooks, pending/failed/expired/cancelled payments and reconciliation. Local fixtures cannot certify providers.
4. Verified deletion handling, final retention policy and Data safety declarations.
5. Play Console developer/organization verification, app-access reviewer test store, content rating, ads/target-audience declarations, current screenshots/listing and internal testing.
6. Account-specific testing requirements, Play pre-launch report and Android Vitals/crash review.

These gates need evidence before calling the app Play-ready. No blanket all-defects-closed claim is justified by local tests.

## Official references

- [Target API](https://support.google.com/googleplay/android-developer/answer/11926878)
- [APK installation permission](https://support.google.com/googleplay/android-developer/answer/12085295)
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Payments](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Signing](https://developer.android.com/studio/publish/app-signing)
- [ML Kit disclosure](https://developers.google.com/ml-kit/android-data-disclosure)
