# Geraina POS for Android

The Android app connects to the production Geraina service at `https://dagangos.com/geraina/login`. It uses the existing responsive Geraina application in a hardened Android WebView, with native navigation, Android file selection, PDF/export saving, Android printing, privacy/help menus, and an account deletion request flow.

Application ID: `com.dagangos.geraina`. Current version: `1.1.2`, version code `4`. Android 14 (API 34) or newer; targets Android 16 (API 36). A recent Android System WebView/Chrome is required. The debug build uses a separate `.debug` app ID.

Distribution is website-first at `https://dagangos.com/geraina/android`. Google Play publication is postponed at the owner's request while the organization's D-U-N-S is unavailable. The parent portal's `scripts/stage-geraina-android.mjs` stages only the verified signed APK, its public metadata and selected screenshots.

The 1.1 redesign follows the approved preview in `design-preview/`: one light native header, five navigation tabs, forest-green sales summary, compact product lists, and a cashier cart sheet. Its Android-only styles are bundled in the APK; the hosted desktop application does not need deployment for this look. Dashboard figures come from the authenticated store, with explicit loading/error/empty states. See `MOBILE-REDESIGN.md` for implementation and verification details.

Internet is required. This version does not provide offline sales, a camera barcode scanner, direct Bluetooth/USB thermal printer access, or native subscription purchases. A keyboard-style barcode scanner can use the existing web POS input. Printing uses Android Print Services or a saved receipt PDF. The desktop printer bridge at `127.0.0.1` is not available in this Android app.

## Build

Use JDK 17, Android SDK platform 36 and build tools 36.0.0. Set `sdk.dir` in the ignored `local.properties`, or configure `ANDROID_HOME`. The Gradle wrapper is included.

```powershell
# Run once for a new Play app. Never replace an existing upload key.
.\scripts\Prepare-UploadKey.ps1

# Tests, release lint, signed APK, signed AAB, mapping file and SHA-256 checksums.
.\scripts\Build-Release.ps1

# Future update: keep the same key and increase the version code.
.\scripts\Build-Release.ps1 -VersionCode 5 -VersionName 1.1.3
```

Outputs are in `releases/`. Distribute the signed `.apk` through the website. Retain the `.aab` for a future Play release; do not upload it yet. Files in `releases/` are ignored by Git.

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
