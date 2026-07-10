"""Render a real order (or a sample) into raw ESC/POS byte commands for thermal receipt
printers -- Mode B ("Printer Jaringan") of the printer integration.

Architecture note (read before touching this file): the FastAPI backend runs in the cloud,
not on the store's LAN, and browsers have no raw TCP socket API. Neither can open a socket
directly to a thermal printer sitting on the merchant's local network at e.g. 192.168.1.50:9100.
So this module only builds the BYTES to print -- delivering those bytes to the actual printer
requires a small local helper ("printer-bridge", see printer-bridge/bridge.py) running on a PC
on the same LAN as the printer, which the store owner starts once. The frontend fetches the
bytes from the backend, then POSTs them to that local bridge, which opens the raw socket.

Formatted for a 32-character line width (common for 58mm thermal paper; most 80mm printers
support wider lines but 32 cols renders correctly on both, just with more whitespace on 80mm).
Uses cp437 encoding, which is the default code page on the overwhelming majority of ESC/POS
thermal printers and covers Rp/rupiah formatting fine (plain ASCII digits and punctuation).
"""
from typing import Optional

LINE_WIDTH = 32

ESC_INIT = b"\x1b\x40"
ESC_ALIGN_LEFT = b"\x1b\x61\x00"
ESC_ALIGN_CENTER = b"\x1b\x61\x01"
ESC_BOLD_ON = b"\x1b\x45\x01"
ESC_BOLD_OFF = b"\x1b\x45\x00"
GS_CUT = b"\x1d\x56\x00"  # full cut; use b"\x1d\x56\x01" if the printer only supports partial cut


def _enc(s: str) -> bytes:
    return (s or "").encode("cp437", errors="replace")


def fmt_rp(n) -> str:
    try:
        n = int(round(float(n or 0)))
    except Exception:
        n = 0
    sign = "-" if n < 0 else ""
    return f"{sign}Rp{abs(n):,}".replace(",", ".")


def _kv_line(label: str, amount) -> bytes:
    val = fmt_rp(amount)
    pad = max(LINE_WIDTH - len(label) - len(val), 1)
    return _enc(label + " " * pad + val + "\n")


def _divider() -> bytes:
    return _enc("-" * LINE_WIDTH + "\n")


def build_receipt_escpos(order: dict, settings: Optional[dict] = None) -> bytes:
    """Build the full receipt for a real order. `settings` is the store's /api/settings doc
    (general + receipt blocks); falls back to sane defaults if not provided."""
    settings = settings or {}
    general = settings.get("general") or {}
    receipt = settings.get("receipt") or {}
    store_name = general.get("store_name") or "Toko"
    header_text = receipt.get("header_text") or ""
    footer_text = receipt.get("footer_text") or "Terima Kasih!"
    show_cashier = receipt.get("show_cashier", True)

    buf = bytearray()
    buf += ESC_INIT
    buf += ESC_ALIGN_CENTER
    buf += ESC_BOLD_ON
    buf += _enc(store_name[:LINE_WIDTH] + "\n")
    buf += ESC_BOLD_OFF
    if header_text:
        buf += _enc(header_text[:LINE_WIDTH] + "\n")
    buf += ESC_ALIGN_LEFT
    buf += _divider()
    buf += _enc(f"No: {order.get('order_no', '-')}\n")
    created_at = str(order.get("created_at") or "-")
    buf += _enc(f"Tgl: {created_at[:19].replace('T', ' ')}\n")
    if show_cashier and order.get("cashier_email"):
        buf += _enc(f"Kasir: {order.get('cashier_email')}\n")
    buf += _divider()

    for it in order.get("items", []):
        name = str(it.get("name") or "-")
        qty = it.get("quantity") or 0
        price = it.get("price") or 0
        subtotal = it.get("subtotal") or 0
        buf += _enc(name[:LINE_WIDTH] + "\n")
        left = f"  {qty} x {fmt_rp(price)}"
        right = fmt_rp(subtotal)
        pad = max(LINE_WIDTH - len(left) - len(right), 1)
        buf += _enc(left + " " * pad + right + "\n")

    buf += _divider()
    buf += _kv_line("Subtotal", order.get("subtotal", 0))
    if order.get("discount"):
        buf += _kv_line("Diskon", -abs(order.get("discount") or 0))
    if order.get("tax_amount"):
        buf += _kv_line(f"Pajak ({order.get('tax_percent', 0)}%)", order.get("tax_amount", 0))
    buf += ESC_BOLD_ON
    buf += _kv_line("TOTAL", order.get("total", 0))
    buf += ESC_BOLD_OFF
    if order.get("payment_method") == "cash" and order.get("cash_received") is not None:
        buf += _kv_line("Tunai", order.get("cash_received", 0))
        buf += _kv_line("Kembali", order.get("change", 0))
    else:
        buf += _enc(f"Metode: {order.get('payment_method', '-')}\n")
    buf += _divider()

    buf += ESC_ALIGN_CENTER
    buf += _enc(footer_text[:LINE_WIDTH] + "\n")
    buf += b"\n\n\n"
    buf += GS_CUT
    return bytes(buf)


def build_sample_escpos(settings: Optional[dict] = None) -> bytes:
    """Sample receipt for the Settings > Printer 'Test Print' button -- not tied to a real
    order, just enough to prove the printer/bridge/network path actually works end to end."""
    sample_order = {
        "order_no": "TEST-0001",
        "created_at": "2026-01-01T12:00:00",
        "cashier_email": "test@dagangos.com",
        "items": [
            {"name": "Contoh Produk A", "quantity": 2, "price": 15000, "subtotal": 30000},
            {"name": "Contoh Produk B", "quantity": 1, "price": 20000, "subtotal": 20000},
        ],
        "subtotal": 50000,
        "discount": 0,
        "tax_amount": 0,
        "tax_percent": 0,
        "total": 50000,
        "payment_method": "cash",
        "cash_received": 50000,
        "change": 0,
    }
    return build_receipt_escpos(sample_order, settings)
