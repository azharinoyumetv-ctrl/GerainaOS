# Geraina 1.2 offline and Android hardware

These capabilities are release requirements following the owner's existing customer commitments.

## Cash sales and synchronization

The Android APK bundles the built Geraina frontend, including its executable scripts and styles. Main app routes and static files are served from the APK at the existing HTTPS origin. Initial login, catalog preparation and electronic payments require connectivity. After initial preparation, an authenticated cashier can restart offline, sell from the cached catalog and retrieve locally stored receipts.

IndexedDB stores a cash sale using a strict durable transaction before checkout acknowledges payment or clears the cart. The inventory snapshot and sale are stored together. Each sale has an immutable UUID and a visible offline reference. Sales and catalogs are separated by cashier and store. Logout retains queued sales for the same account to recover; another account cannot read or replay them. Uninstalling or clearing app data can still delete unsynchronized records.

The app retries while open when connectivity returns, on focus, periodically, or with the Sync button. `/api/offline/orders` authenticates the originating cashier/store and commits the sale, counter and stock changes in one MongoDB transaction. The deterministic record identity and payload hash prevent duplicate writes and conflicting replays. Server timestamps preserve the recorded sale time. Inventory changes from another device or deleted products create visible reconciliation warnings while preserving the completed cash sale. Electronic payments remain online and are never marked paid by offline fallback.

The new endpoint does not send receipt messages or create gateway charges. Tests use an isolated local replica set and intercepted records, never merchant writes.

## Receipt printers

Native receipt output supports paired Bluetooth Classic printers using the standard SPP service and ESC/POS text commands, and USB printer-class devices with a bulk OUT endpoint through OTG. The owner has not specified a printer model. BLE-only, proprietary vendor protocols and USB serial adapters are not claimed as compatible.

Printer setup is available in Settings > Printer and the native app menu. Paper profiles are 58 mm / 32 characters and 80 mm / 48 characters. Printing a local receipt does not require the server or a PC bridge. Print payloads are built from structured receipt data; control characters in merchant/product text are removed. Connection and write failures do not automatically reprint a potentially partial receipt. A successful transport write means data reached the connection, not proof that paper was printed.

No physical printer was provided. Native UI, receipt encoding, permissions and error handling can be tested automatically; physical output and model-specific compatibility require an actual printer. Do not claim universal Bluetooth or USB compatibility.

## Camera barcode scanning

CameraX provides the native preview. A bundled ML Kit barcode model decodes on-device without a model download. Scanned values are matched to SKU/product ID in the current store catalog. Camera denial retains manual barcode entry. Camera and nearby-device permissions are requested when the respective feature is used. The SDK's technical diagnostics are disclosed in the privacy document.

## Verification

- `backend/tests/test_offline_sales.py`: real local MongoDB transaction/replay/concurrency/rollback tests.
- `scripts/verify-offline-pos.cjs`: durable checkout, restart, retry and account-isolation checks in Chromium with isolated endpoints.
- `scripts/run-offline-android.cjs`: installed APK; actual Android connectivity disabled; API responses additionally blocked during offline checks; cold restart, camera permissions, native printer dialog and replay recovery.
- `BarcodeDecoderTest`: bundled model decodes an EAN-13 fixture in two rotations on Android.
- `ReceiptEncoderTest`: financial amounts, pending reference, control-byte sanitation and both paper widths.

Current verification records distinguish the exact APK hash and emulator profiles from physical hardware. A build or screenshot alone does not confirm printer compatibility.
