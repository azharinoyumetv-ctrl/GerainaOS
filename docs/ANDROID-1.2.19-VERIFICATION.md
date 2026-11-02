# Geraina 1.2.19 — product gallery and direct camera

Status: signed website release candidate verified; live publication is checked separately.

Add/Edit Product now offers **Ambil foto** and **Pilih dari galeri**, including when replacing an existing picture. Android image uploads use the system photo picker; capture inputs launch the device camera and return the picture to the same product draft. Desktop browsers retain image-file selection. CSV/Excel and mixed uploads retain the document picker.

Photos are resized before saving. Saving waits for photo processing; cancellation, permission denial and invalid images preserve the draft and previous picture. Camera captures use a private, non-exported FileProvider restricted to their temporary cache directory. Completed reads and cancelled captures delete their temporary files; abandoned expired captures are pruned. Gallery originals are never deleted. No broad photo/storage permission was added.

Verified on this exact signed APK:

- Reproduced 1.2.18 opening DocumentsUI for a product image with no direct-camera action.
- Nine Playwright photo cases across phone, Xiaomi-tablet and Samsung-tablet layouts; eighteen category regressions also passed against actual API handlers and a disposable MongoDB replica.
- Nine installed-APK checks using the actual AOSP photo picker and emulated camera: denied permission, gallery selection without camera permission, gallery cancellation, real virtual-camera capture/preview, camera cancellation, saved/reopened image, empty temporary capture cache, tablet gallery replacement and tablet camera launch/cancel.
- Updating 1.2.18 preserved the isolated login and preference. Installed APK bytes matched the signed release.
- 32 Android unit tests, release lint, unchanged signer, native alignment, APK/AAB validation, distribution checks, credential exclusion and all 81 bundled frontend asset hashes passed.

Version 1.2.19, build 24, package `com.dagangos.geraina`, Android 14+.
APK SHA-256: `bd106fb998274962477ebcfd6bafff944eed64a1b75b2daa302445176309a7b0`.

No backend, payment handling or customer records changed. Native tests use an AOSP emulator and virtual camera, not physical vendor firmware. The separate Google Play distribution is not submitted or certified by these website-release checks. Android users need the new APK for this native change.

Implementation follows Android's [photo picker contracts](https://developer.android.com/training/data-storage/shared/photo-picker) and [TakePicture contract](https://developer.android.com/reference/androidx/activity/result/contract/ActivityResultContracts.TakePicture).

Machine-readable evidence: [ANDROID-1.2.19-VERIFICATION.json](ANDROID-1.2.19-VERIFICATION.json).
