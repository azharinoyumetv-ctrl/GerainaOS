# Geraina 1.2.20 — saved product units

Status: signed website release candidate verified; live publication is checked separately.

Add/Edit Product now selects units from the store's saved **Satuan Unit** list. Choices show the full name and symbol, such as **Kilogram (kg)**, and save the symbol in the existing product `unit` field. This preserves the existing receipt, inventory and import contract; registry IDs are not substituted for display units.

The default `pcs`, existing free-text/full-name units and explicit **Satuan lainnya…** remain supported. Existing products retain their original unit unless the owner changes it. Duplicate symbols are collapsed, all registry pages are read, choices refresh when the editor opens, and a failed load offers retry without discarding the product draft. Responses are guarded against a changed account/store or a superseding request. Units are loaded when opening the editor, without adding a request to ordinary product browsing.

Verification scope:

- Reproduced 1.2.19 rendering a text input despite a saved unit created through the actual management screen.
- 15 Playwright unit cases across phone, Xiaomi-tablet and Samsung-tablet layouts: real saved-unit creation, new/edit/save/reload, default/custom/legacy values, invalid empty custom values, loading failure/retry, store isolation, fresh choices, pagination and duplicate symbols.
- Eighteen category and nine photo regression cases passed against the actual API and a disposable local MongoDB replica. The 501-unit pagination case uses explicit paginated response fixtures; save/reload and store checks use real handlers.
- Installed signed-APK tests cover updating 1.2.19 with login/preference retention and both phone and resized large-tablet windows. Phone selection uses a real Android popup tap; tablet selection uses Playwright against the actual WebView. Each creates a saved unit, saves its symbol in a product and reopens the retained selection. Category and photo actions remain present.
- 32 Android unit tests, release lint, original signer, APK/AAB structure/distribution checks, native alignment, credential exclusion and bundled-asset hashes are recorded in the machine-readable evidence.

Version 1.2.20, build 25, package `com.dagangos.geraina`, Android 14+.
APK SHA-256: `b6fcece07b4ab7b3b23a6bb3c8fe0b68bb1aa3818da185aaf432cb460ca31e0f`.

No backend/payment changes or production customer writes. Emulators do not certify physical vendor firmware. Android needs the new APK for this bundled product form; the hosted web form receives the source deployment. Gallery/camera behavior from 1.2.19 remains included. This is the website distribution, with no claim of Play Console submission.

Evidence: [ANDROID-1.2.20-VERIFICATION.json](ANDROID-1.2.20-VERIFICATION.json).
