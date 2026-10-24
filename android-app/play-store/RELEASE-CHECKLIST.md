# Geraina POS 1.1.2 — future Google Play submission

Prepared on 24 October 2026, Japan time. Website-first APK distribution is the approved release strategy. Google Play is postponed while the organization does not yet have its D-U-N-S. No package has been uploaded or submitted to Google Play.

## Files and identity

- `../releases/Geraina-POS-1.1.2.aab`: Google Play upload bundle.
- `../releases/Geraina-POS-1.1.2.apk`: signed APK for direct Android testing.
- `../releases/Geraina-POS-1.1.2-mapping.txt`: retain for crash deobfuscation.
- `../releases/Geraina-POS-1.1.2-SHA256.txt`: package checksums.
- App ID: `com.dagangos.geraina`; version code `4`; target API `36`; minimum API `34`.
- Public upload certificate: `../signing/geraina-upload-certificate.pem`.
- Upload certificate SHA-256: `52e14a39a7da4f5f528838f33602860e35960373070a6132d08f682487494ec8`.
- Developer/entity: PT DagangOS Digital Indonesia.
- Contact: contact@dagangos.com. Website: https://dagangos.com/geraina.

Back up the private upload key and its password configuration securely. Do not upload the private key, passwords, failure-test artifacts, or entire source directory to a public store listing.

## Verification and limits

The 1.1.2 signed release passes 9 unit tests, release lint (zero errors, 32 warnings), bundle validation, signature verification, 16 KB alignment and the private-credential package scan. Current device assertions and exact APK hashes are in `../releases/android-usability-report/index.html` and `../releases/release-verification.json`. They cover Android 14 and 17 phone emulators and large Android 16 tablet profiles. The release requires Android 14 or newer.

The previous 1.1.1 debug-APK baseline passed 24 phone checks and 116 large-tablet checks. Those historical reports remain in `../releases/android-test-report/` and `../releases/android-tablet-report/`; they are not counted as tests of the 1.1.2 APK. The current signed release has shrinking enabled and a non-debuggable application flag. AOSP userdebug forces WebView inspection at the OS level. Physical printer output, real payment-provider settlement and vendor firmware are outside these emulator runs.

The older TestSprite run used credentials that were rejected. The subsequently supplied account now passes API, mobile web, and Android app login checks for the Geraina store. Its password is stored only in the ignored local test configuration and was not sent to a cloud test service or embedded in the APK/AAB. Play Console reviewer access still needs to be configured separately.

This app is an Android client of the existing online Geraina application. It is not an offline POS. Direct Bluetooth/USB printer integration and camera scanning are not included. Subscription purchases and package changes are unavailable in this build; existing access and free registration remain available. Physical-goods POS payments remain part of Geraina.

## Before uploading

1. Run the current signed-release usability suite documented in `../ANDROID-TEST-BENCH.md`, and rerun broader file/print/offline scenarios when those features change.
2. Extend the device matrix when required. Physical HyperOS / One UI devices and peripherals require separate checks.
3. If advertising printer compatibility, validate output on the actual printer/service. The local bench verifies Android print preview, without sending a physical print job. Real payment-provider settlement is also separate from the isolated cash-sale UI fixture.
4. Review the hosted site's content when it changes, so newly added purchase links do not bypass the Android subscription restrictions. Automated tests already cover the current route restrictions.
5. Use the native APK screenshots captured in `phone-screenshots/` for the listing, or capture further device-specific views. They come from the installed Android app, not a browser preview.
6. The official Android page `/geraina/android`, `/geraina/privacy` and `/geraina/delete-account` are published and publicly verified. Retest those exact URLs before a future Play submission.
7. Confirm the privacy text and deletion-handling process with the business owner, including actual retention requirements and who monitors contact@dagangos.com. The request flow prepares an email; it does not instantly erase server records.
8. Complete Play Console declarations, reviewer account setup and the testing track requirements shown in your account. Local automation does not replace an account-specific closed-testing requirement.

## Play Console

Create an app named **Geraina POS**, default language Indonesian, type App, category Business, free download. Use the exact application ID above. Before enrolling in Play App Signing, preserve the existing website APK signing identity so Play builds can update direct installs. The key named geraina-upload.jks currently signs the actual direct APK; do not assume a new Google-generated signing key is compatible. Then use the AAB for the first internal testing release.

Add store text from `listing-id.txt`, the 512 × 512 app icon and the 1024 × 500 feature graphic. Add real device screenshots. Complete target audience, content rating, ads, app access and Data safety declarations. Supply working reviewer login details with access to a test store and instructions for the free trial/account setup. No reviewer credentials are included here.

Use `https://dagangos.com/geraina/privacy` as the privacy URL and `https://dagangos.com/geraina/delete-account` as the deletion URL **after publication and verification**. The app's native Privacy menu currently opens the existing DagangOS policy at `/kebijakan-privasi`.

Data safety must include data collected by the owned WebView and backend, not just Android permissions. Review account/email/user IDs, business/customer/staff details, transactions, uploaded files, device/session information, support conversations and third-party integrations. Do not select “no data collected.” Determine sharing, purposes, optionality, retention and encryption answers from the actual services and enabled integrations. No advertising SDK was added to the native app.

Start with internal testing and review the Play pre-launch report. If using a personal developer account created after 13 November 2023, Google currently requires a closed test with at least 12 continuously opted-in testers for 14 days before applying for production access. Organization accounts may follow a different process. Complete the requirements shown in your own Console.

## Official references checked

- Target API requirement: https://support.google.com/googleplay/android-developer/answer/11926878
- App Bundles: https://developer.android.com/guide/app-bundle
- Signing and Play App Signing: https://developer.android.com/studio/publish/app-signing
- Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Data safety, including owned WebViews: https://support.google.com/googleplay/android-developer/answer/10787469
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- New personal-account testing: https://support.google.com/googleplay/android-developer/answer/14151465
