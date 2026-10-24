# Automated Android test bench

This bench installs the actual Geraina debug APK on a headless Android 16 emulator, drives its embedded application and native Android controls, and produces a local HTML report with full-device screenshots. It uses Playwright's Android WebView integration and Android's own UI hierarchy for native menus, file pickers, and print preview. No Firebase account or cloud test upload is required.

The completed Geraina 1.1.1 runs on 24 October 2026 passed 24 phone checks, 116 large-tablet checks and 9 local unit tests. Portable reports and actual emulator screenshots are in `releases/android-test-report/` and `releases/android-tablet-report/`. Tablet testing reproduced and fixed dashboard alignment, a wrapping cashier title, and a checkout panel extending below the Xiaomi landscape viewport. Live merchant products, sales and support conversations were not changed.

## Current signed-release usability checks (1.1.2)

The current suite installs `com.dagangos.geraina`, verifies version code 4, minimum SDK 34 and the non-debuggable release flag, then checks login contrast, Suite navigation, category/brand/unit form recovery, text selection, keyboard and dialog dismissal, double-Back exit and session persistence. Tablet runs additionally verify persistent navigation and bounded landscape checkout. API writes are intercepted locally.

Prepare and start `android14`, `android17`, `xiaomi12` and `tablet146` with the profile argument on the emulator scripts. Set `GERAINA_DEVICE_PROFILE` to the corresponding profile and run `node scripts/run-usability-android.cjs`. For predeployment tests, `GERAINA_USE_LOCAL_FRONTEND=1` serves the prepared frontend at the production origin. Unset it to check the deployed frontend. Export completed runs with `node scripts/export-usability-reports.cjs android14 android17 xiaomi12 tablet146`.

Pointers are `app/build/reports/android-usability/latest-<profile>.json`. The portable report requires passing assertions against the exact signed APK hash. Android 14 and 17 phone ports are 5570 and 5572; the tablet ports are unchanged. The debug-APK bench documented below is the earlier 1.1.1 baseline and does not count as current signed-APK coverage.

## Earlier debug bench

From this Android project in PowerShell:

```powershell
# First run only: download and verify Google's emulator and Android 16 system image.
.\scripts\Prepare-TestEmulator.ps1

# Start the emulator, verify the account, build the test APK and run the suite.
.\scripts\Run-AndroidBench.ps1

# Large tablet matrix; prepare each profile once, then test both orientations.
.\scripts\Prepare-TestEmulator.ps1 -Profile xiaomi12
.\scripts\Run-AndroidBench.ps1 -Profile xiaomi12 -Orientation portrait
.\scripts\Run-AndroidBench.ps1 -Profile xiaomi12 -Orientation landscape -SkipBuild
.\scripts\Prepare-TestEmulator.ps1 -Profile tablet146
.\scripts\Run-AndroidBench.ps1 -Profile tablet146 -Orientation portrait -SkipBuild
.\scripts\Run-AndroidBench.ps1 -Profile tablet146 -Orientation landscape -SkipBuild
node scripts/export-tablet-reports.cjs
```

The emulator needs access to Windows Hypervisor Platform; a restricted shell may need permission to launch it outside its sandbox. The emulator is hidden and runs in the background. It uses four CPU cores and 3 GB of RAM. Its SDK, downloads and virtual disk live in the ignored `../android-sdk/` directory, separate from the SDK used to compile the app.

The local credentials are loaded from the ignored `../.env.android-test` file. Credentials are not embedded in an APK, passed to a cloud testing service, or included in reports. The test account's active store must match the configured store before proceeding. `GERAINA_TEST_ALLOW_WRITES=false` is the default; authenticated tests inspect the existing account without changing merchant records. Use a dedicated test account.

## Coverage

- Native launch, production origin and document-start bridge.
- Real login and correct store verification.
- Native Products and Cashier shortcuts, product search, required-field validation, and empty-cart checkout prevention.
- POS quantity, discount, tax, cash/change and receipt behavior using network-intercepted local fixture records. No order is sent to the merchant database for this scenario.
- Live inventory and sales-report screens.
- Session persistence after restarting the app and rotating the device.
- Native deletion-request dialog cancellation and logout.
- SaaS subscription route restrictions.
- Android Save As picker, PDF bytes saved to Downloads, cancellation and another download.
- Android file picker and reading the selected CSV file. The fixture file is not imported into the merchant database.
- Android print-preview launch; no print job is sent to a physical printer.
- Offline error display/recovery and an HTTP error followed by the native Retry action.
- Android application crash logs.

Each check records a pass/fail result and a full-device screenshot. Assertions inspect UI state and exported bytes; screenshots provide additional evidence. These checks do not prove every possible layout is correct or validate physical printer output, real payment settlement, or every feature of the backend.

## Reports and device lifecycle

Open `app/build/reports/android-bench/latest-report.json` for the phone report. Tablet pointers use `latest-<profile>-<orientation>.json`; they never overwrite the phone pointer. The runner exports a passing phone run to `releases/android-test-report/`. `export-tablet-reports.cjs` requires all four tablet runs to pass before producing the portable matrix. Exports contain HTML, JSON and screenshots, with no device logs or credentials. Each raw run also has its own directory with sanitized logs.

The `xiaomi12` profile uses 2032 × 3048 pixels / 320 logical dpi / 294 physical dpi; `tablet146` uses 1848 × 2960 / 240 / 239. Landscape swaps the visible orientation. Each tablet run has 29 checks: the 24 common checks plus profile/orientation verification, centered dashboard columns, a populated product list and bounded edit dialog, populated cashier geometry, and checkout with the actual Android soft keyboard shown. Both the checkout and the catalogue scroll within the available workspace.

These are Android 16 AOSP emulators. They match screen geometry and Android size class, not HyperOS, One UI, proprietary peripherals or physical hardware. The signed APK smoke test checks installation, rendered login, version and the non-debuggable application flag. AOSP userdebug forces WebView inspection at the OS level, so absence of its debugging socket cannot be verified on this system image; see Chromium's `android_webview/docs/net-debugging.md`.

The automated app ID is `com.dagangos.geraina.debug`. The signed release app and its private signing key are not modified by these tests. Debug WebView inspection remains disabled in the release build.

To stop the test emulator after testing:

```powershell
& "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\adb.exe" -s emulator-5556 emu kill
```

The runner only accepts emulator serials and does not control a connected personal phone. The three used ports are 5556 (phone), 5566 (Samsung-size) and 5568 (Xiaomi-size). Prepared optional profiles also exist for smaller tablets, but those are not part of the current 1.1.1 release matrix.
