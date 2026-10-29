# Geraina POS for Android

Current website release: **1.2.17, build 22**. Companion-app switching, independent sessions and cold-start retry are verified in `../docs/ANDROID-1.2.17-VERIFICATION.md`.

The Android app connects to the production Geraina service at `https://dagangos.com/geraina/login`. It bundles the Geraina frontend for offline startup in a hardened Android WebView, with durable cash-sale storage and replay, native camera barcode scanning, Bluetooth/USB receipt printing, navigation, Android file selection and PDF/export saving.

Application ID: `com.dagangos.geraina`. Source version: `1.2.16`, version code `21`; published website release: `1.2.16`. The separate Play build has not been submitted. Android 14 (API 34) or newer; targets Android 16 (API 36). A recent Android System WebView/Chrome is required. The debug build uses a separate `.debug` app ID. The public download version is recorded separately in the portal manifest.

Distribution is website-first at `https://dagangos.com/geraina/android`. Google Play publication is postponed at the owner's request while the organization's D-U-N-S is unavailable. The parent portal's `scripts/stage-geraina-android.mjs` stages only the verified signed APK, its public metadata and selected screenshots.

The 1.1 redesign follows the approved preview in `design-preview/`: one light native header, five navigation tabs, forest-green sales summary, compact product lists, and a cashier cart sheet. Its Android-only styles are bundled in the APK; the hosted desktop application does not need deployment for this look. Dashboard figures come from the authenticated store, with explicit loading/error/empty states. See `MOBILE-REDESIGN.md` for implementation and verification details.

Initial login and catalog preparation require internet. Prepared devices can restart offline, record cash sales, retrieve receipts and use native camera scanning and supported receipt printers. Synchronization runs when the app is active and connected. QRIS, wallets, card processing, PDF generation and account/package changes require connectivity. Native receipt output targets standard ESC/POS Bluetooth Classic SPP and USB printer-class devices; proprietary, BLE-only and USB serial models need separate adapters and are not claimed as supported. No physical printer has been supplied to verify paper output. See `OFFLINE-AND-HARDWARE.md` for exact scope and tests.

## Build

Use JDK 17, Android SDK platform 36 and build tools 36.0.0. Set `sdk.dir` in the ignored `local.properties`, or configure `ANDROID_HOME`. The Gradle wrapper is included.

```powershell
# Run once for a new Play app. Never replace an existing upload key.
.\scripts\Prepare-UploadKey.ps1

# Tests, release lint, signed APK, signed AAB, mapping file and SHA-256 checksums.
.\scripts\Build-Release.ps1

# Future update: keep the same key and increase the version code.
.\scripts\Build-Release.ps1 -VersionCode 10 -VersionName 1.2.5
```

Website outputs are in `releases/`. Build the separate Play candidate with `scripts/Build-Release.ps1 -Distribution play`; outputs go into `releases/play/`. Separate updater source and manifest overlays exclude the APK installer and its permission/provider from Play. The Play update control opens Google Play; the website build retains its verified updater. Both channels retain the original signing identity. The build checks compiled code and both package manifests before staging output, and rejects version codes already published. Files in `releases/` are ignored by Git. These checks do not establish Google Play approval; see the current submission checklist.

Bank QRIS uses the merchant's bank-issued static QRIS, uploaded in **Integrasi > QRIS bank**. **Pembayaran** selects what appears at the cashier. Staff check the bank's merchant app and explicitly confirm the matching amount; Geraina records who confirmed and when. No Xendit key is required. See [BANK-QRIS.md](BANK-QRIS.md) for verification limits.

## Updates inside the app

Version 1.2.3 adds a background update check at most once per day while the app is open (failed checks retry after 15 minutes). A small banner offers a newer release; it never automatically downloads or opens the installer. Users can also select **Periksa pembaruan** from the native menu before login or from About after login. Downloading requires confirmation and supports cancellation. The official HTTPS metadata, download size/SHA-256, package identity/version, OS/ABI compatibility and original signing certificate are checked before Android's normal installation confirmation. Android may first ask the user to allow Geraina as an installation source. Device restrictions are respected.

Versions through 1.2.2 require one website installation of 1.2.3 to acquire the updater. Install over the existing app, finish/save active work beforehand, and never uninstall or clear data to update. Stored offline sales, settings and the account remain in app storage. Only a foreground availability check is scheduled; no background service or forced update is added. See [IN-APP-UPDATES.md](IN-APP-UPDATES.md) for release and verification details.

The AndroidX message listener only grants native features to the production origin and main frame. File and content URL access, cleartext traffic, mixed content, third-party cookies, and release WebView debugging are disabled. Session backup is disabled. Native exports use Android's Save As picker and are limited to 10 MB. App code never receives arbitrary filesystem paths from web content.

## Protect the upload key

Back up both `signing/geraina-upload.jks` and `keystore.properties` in a secure password manager or encrypted backup before distribution. Despite its filename, this key signs the actual website APK and must be retained for app updates. The properties file contains the generated passwords. These files are ignored by Git and are not included in the release package. For a future Play release, configure Play App Signing to preserve signing compatibility with these directly installed APKs. A newly generated unrelated signing key would not update them. `signing/geraina-upload-certificate.pem` is the public certificate.

## Verify

```powershell
.\gradlew.bat testDebugUnitTest lintRelease
node scripts\verify-bridge.cjs
node scripts\verify-mobile-ui.cjs
```

The bridge verification uses Playwright from the adjacent frontend and locally installed Chrome. It tests the actual document-start bridge in Chromium, including PDF blobs revoked immediately after a click, file limits, native print messages, subscription gating, and origin isolation. It does not replace Android device tests.

The actual APK can also be exercised automatically on the local Android 16 emulator:

```powershell
.\scripts\Run-AndroidBench.ps1
```

See [the automated Android bench guide](ANDROID-TEST-BENCH.md) for initial runtime setup, test scope, local credentials, and the HTML report. It includes live account/navigation checks and isolated POS/file-handling fixtures, without creating merchant records or using a cloud service.

Version 1.1.1 passed 24 phone checks and 116 large-tablet checks: Xiaomi Pad 6S Pro (12.4-inch, 3048 × 2032) and Samsung Ultra-size (14.6-inch, 2960 × 1848), both portrait and landscape. Open `releases/android-tablet-report/index.html` for the matrix and actual emulator screenshots. These are Android 16 AOSP screen profiles, not Xiaomi/Samsung firmware or physical-device tests. The signed release also installs and renders the login form successfully.

See [the Play submission guide](play-store/RELEASE-CHECKLIST.md) for the release status, store copy, required website publication, device checks, and Play Console steps.
