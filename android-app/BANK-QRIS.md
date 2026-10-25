# Bank-issued QRIS with manual staff confirmation

Geraina 1.2.5 supports a merchant's existing static QRIS from its bank. This is separate from DagangOS subscription billing and does not require Xendit credentials. The QRIS recipient and transaction fees remain with the merchant under its bank agreement.

## Owner setup

1. Open **Pembayaran > QRIS**. This setup is available on Starter and higher plans.
2. Enter the issuing bank's name and select the original static QRIS image (PNG/JPG/WebP, up to 5 MB).
3. Check the recipient and acknowledge ownership before activating and saving.

The image is decoded on the device. Only the original QR payment payload and public merchant details are saved. The server validates EMV structure, checksum, Indonesian currency/country, merchant fields, static mode and absence of a fixed amount. These checks detect format problems; they do not authenticate bank ownership or verify payment. Dynamic/single-use codes and fixed-amount codes are rejected. No QR amount or recipient data is rewritten.

## Checkout and confirmation

1. Choose QRIS at checkout. Geraina saves a pending order with the merchant's QRIS snapshot and displays the exact total. Customers enter that amount in their payment app.
2. Check the incoming transaction in the bank's merchant app, matching the order's amount, time and reference. Do not rely on a payer's screenshot.
3. Check the bank-verification acknowledgment and enter the matching transaction amount. Optionally enter a bank reference, then confirm receipt.

The order stays pending until staff explicitly confirm. The audit records the confirming account, time, amount, reference and manual confirmation type; `bank_verified` remains false because Geraina does not contact the bank. Owner/Manager can confirm within their store; a Cashier can confirm their own order. Warehouse staff cannot confirm. Repeated/concurrent confirmations preserve the first audit and never deduct stock again.

The pending order reserves stock using the existing checkout behavior. Closing a receipt does not cancel it. POS remembers the last pending bank order per cashier/store, and **Riwayat pembayaran** opens Penjualan, where bank orders can be reopened. Other pending orders remain in server history. Owner can void an unpaid order if appropriate. Changing/disabling bank setup does not change the saved destination on an existing order.

Creating and confirming bank QRIS orders requires internet in this version. Cash checkout retains its existing offline queue. The legacy gateway QRIS route remains for older installed versions and earlier orders; a new `qris_bank` order never falls back to gateway credentials or the platform subscription key.

## Verification

- `backend/tests/test_bank_qris.py`: format/CRC, ownership acknowledgment, store/role scope, amount validation, original destination snapshot, disabled setup, idempotent/concurrent confirmation and closed-order rejection.
- `backend/tests/test_qris_contract.py`: legacy gateway and callback isolation.
- `scripts/verify-bank-qris.cjs`: an actual synthetic PNG QR image through the file input, setup/reload/failure handling, pending checkout, exact amount, failed confirmation retry, POS restart recovery, sales history and reachable controls. Browser widths 393/1016/1524 and installed Android profiles 14/17, Xiaomi Pad 6S Pro 12.4-inch and Samsung Ultra 14.6-inch.

No real bank transaction is initiated by these tests. Real bank settlement, merchant ownership and physical-device picker behavior are not certified by the fixture tests. Existing Android document-picker code handles selecting images; automated image tests supply a synthetic PNG through the file input.
