# Geraina 1.2.18 — saved product categories

Status: signed release candidate verified; website publication is checked separately.

The product editor previously displayed a text input, and its choices only came from categories already assigned to products. Creating a category succeeded but did not make it selectable for the first product.

Add/Edit Product now has a native dropdown combining all saved category pages with existing product category names. Unused categories appear immediately; duplicate names appear once. Existing selections and optional custom entry remain available. Loading failures have an explicit retry that preserves the draft, and choices are scoped to the active account/store.

Verification:

- Reproduced the original failure after creating a category through the actual local API: the editor was an INPUT rather than SELECT.
- 18 Playwright cases passed across phone, Xiaomi-sized tablet and large Samsung-sized tablet layouts, using actual frontend/API code and a disposable MongoDB replica. Covers creation through save/edit/reload, legacy/custom values, retry, store isolation and pagination beyond 500 categories.
- The exact signed APK passed native dropdown opening, actual screen taps, product saving and selected-category persistence in phone and large tablet windows on the owned AOSP emulator. The tablet popup was visually inspected because its Chromium-drawn rows were absent from the Android accessibility tree; selection was verified through the DOM and actual API.
- Updating 1.2.17 to 1.2.18 preserved the isolated test login and preference. Installed APK bytes matched the release SHA-256.
- 27 Android unit tests, release lint, original signing identity, APK/AAB distribution checks, bundle validation, native alignment and private-credential exclusion passed. All 81 bundled frontend files matched their recorded hashes.

Version 1.2.18, build 23, package `com.dagangos.geraina`, Android 14+.
APK SHA-256: `a4b7130467db7930d2efbc3d4a99a600f41f42e0e2f66a54284c95dee39f6400`.

No backend or payment handling changed. Android users need the new APK because the product screen is bundled; web users receive the deployed frontend. No customer data, actual merchant payment or external delivery was used. Emulator checks do not certify physical vendor firmware.

Machine-readable evidence: [ANDROID-1.2.18-VERIFICATION.json](ANDROID-1.2.18-VERIFICATION.json).
