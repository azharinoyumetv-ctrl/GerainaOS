"""Merchant-supplied static QRIS. Format validation never verifies a bank payment."""
import binascii
import re
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, StrictBool


class BankQrisSetup(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bank_name: str = Field(default="", max_length=100)
    qr_payload: str = Field(default="", max_length=2048)
    is_active: StrictBool = False
    merchant_confirmed: StrictBool = False


class BankQrisConfirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    checked_in_bank: StrictBool
    received_amount: Decimal = Field(gt=0, le=10_000_000, allow_inf_nan=False)
    reference: str = Field(default="", max_length=100)


def tlv(value: str) -> dict:
    """EMV MPM length is the number of characters in the value, not UTF-8 bytes."""
    fields = {}
    cursor = 0
    while cursor < len(value):
        header = value[cursor:cursor + 4]
        if len(header) != 4 or not re.fullmatch(r"[0-9]{4}", header):
            raise ValueError("Struktur QRIS tidak valid. Unggah kode asli dari bank.")
        tag, length = header[:2], int(header[2:])
        end = cursor + 4 + length
        if length < 1 or end > len(value) or tag in fields:
            raise ValueError("Struktur QRIS tidak lengkap atau memiliki data duplikat.")
        fields[tag] = value[cursor + 4:end]
        cursor = end
    return fields


def inspect_static_qris(payload: str) -> dict:
    if (not isinstance(payload, str) or not 20 <= len(payload) <= 2048 or len(payload.encode("utf-8")) > 2048 or
            any(ord(char) < 32 or ord(char) == 127 for char in payload)):
        raise ValueError("Kode QRIS tidak valid.")
    fields = tlv(payload)
    if not payload.startswith("000201") or fields.get("00") != "01":
        raise ValueError("Gambar harus berisi QRIS merchant, bukan barcode atau tautan.")
    if fields.get("01") not in (None, "11"):
        raise ValueError("Gunakan QRIS statis dari bank. QRIS dinamis/sekali pakai tidak dapat disimpan untuk digunakan ulang.")
    if fields.get("53") != "360" or fields.get("58") != "ID":
        raise ValueError("Gunakan QRIS Indonesia dengan mata uang Rupiah.")
    if "54" in fields:
        raise ValueError("Gunakan QRIS statis tanpa nominal tetap agar pelanggan dapat membayar sesuai total belanja.")
    if not re.fullmatch(r"[0-9]{4}", fields.get("52", "")) or not 1 <= len(fields.get("59", "")) <= 25 or not 1 <= len(fields.get("60", "")) <= 15:
        raise ValueError("Identitas merchant pada QRIS tidak lengkap.")
    accounts = [tlv(value) for tag, value in fields.items() if 26 <= int(tag) <= 51]
    if not any(account.get("00", "").startswith("ID.") for account in accounts):
        raise ValueError("Identitas penerima QRIS tidak ditemukan.")
    if not re.fullmatch(r"[A-Fa-f0-9]{4}", fields.get("63", "")) or not payload[-8:-4] == "6304":
        raise ValueError("Pemeriksaan kode QRIS tidak valid.")
    expected = f"{binascii.crc_hqx(payload[:-4].encode('utf-8'), 0xFFFF):04X}"
    if fields["63"].upper() != expected:
        raise ValueError("Kode QRIS rusak atau berubah. Unggah ulang gambar asli dari bank.")
    return {"merchant_name": fields["59"], "merchant_city": fields["60"], "qr_payload": payload}


def public_bank_qris(saved: dict | None) -> dict:
    saved = saved or {}
    return {key: saved.get(key, default) for key, default in {
        "bank_name": "", "merchant_name": "", "merchant_city": "", "qr_payload": "", "is_active": False,
        "confirmation_mode": "manual_bank", "updated_at": None,
    }.items()}


def bank_qris_snapshot(saved: dict | None, total) -> dict:
    if not saved or saved.get("is_active") is not True:
        raise ValueError("QRIS bank belum diatur/diaktifkan. Minta Owner membuka Pembayaran > QRIS.")
    details = inspect_static_qris(saved.get("qr_payload", ""))
    amount = Decimal(str(total))
    if not amount.is_finite() or not 0 < amount <= 10_000_000 or amount != amount.to_integral_value():
        raise ValueError("Total QRIS harus berupa Rupiah bulat, lebih dari nol dan maksimal Rp10.000.000.")
    return {**details, "bank_name": saved.get("bank_name", ""), "confirmation_mode": "manual_bank"}
