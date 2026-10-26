"""Durable replay of cash sales, with stock and the order in one MongoDB transaction."""
from permissions import require_permission
import hashlib
import json
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import OperationFailure

from auth import get_current_user
from database import get_db
from models import OrderLineItem
from stock_ledger import movement
from sale_effects import customer_for_sale, apply_loyalty

router = APIRouter(prefix="/api/offline", tags=["offline"])


class OfflineCashSale(BaseModel):
    expected_store_id: str = Field(min_length=1, max_length=200)
    expected_cashier_id: str = Field(min_length=1, max_length=200)
    client_order_id: UUID
    sold_at: datetime
    items: list[OrderLineItem] = Field(min_length=1, max_length=500)
    payment_method: str
    discount: float = Field(default=0, ge=0, allow_inf_nan=False)
    tax_percent: float = Field(default=0, ge=0, le=100, allow_inf_nan=False)
    cash_received: float = Field(ge=0, allow_inf_nan=False)
    customer_id: str | None = Field(default=None, max_length=200)
    customer_name: str | None = Field(default=None, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=64)
    customer_email: str | None = Field(default=None, max_length=254)
    note: str | None = Field(default=None, max_length=1000)


def money(value):
    result = Decimal(str(value))
    if not result.is_finite() or result < 0 or result > Decimal("1000000000000"):
        raise HTTPException(422, "Nominal transaksi tidak valid")
    return result.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def prepare_sale(payload: OfflineCashSale):
    if payload.payment_method != "cash":
        raise HTTPException(422, "Pembayaran offline hanya untuk tunai; pembayaran elektronik memerlukan koneksi")
    if payload.sold_at.tzinfo is None or payload.sold_at > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise HTTPException(422, "Waktu transaksi tidak valid. Periksa tanggal dan jam perangkat")
    lines, seen = [], set()
    for item in payload.items:
        if not item.product_id or len(item.product_id) > 200 or item.product_id in seen or item.quantity > 100000 or len(item.name) > 200:
            raise HTTPException(422, "Baris produk tidak valid atau duplikat")
        seen.add(item.product_id)
        price = money(item.price)
        subtotal = money(price * item.quantity)
        if abs(money(item.subtotal) - subtotal) > Decimal("0.01"):
            raise HTTPException(422, "Subtotal produk tidak cocok")
        lines.append({**item.model_dump(), "price": float(price), "subtotal": float(subtotal)})
    subtotal = sum((money(line["subtotal"]) for line in lines), Decimal(0))
    discount = money(payload.discount)
    if discount > subtotal:
        raise HTTPException(422, "Diskon melebihi subtotal")
    tax = money((subtotal - discount) * Decimal(str(payload.tax_percent)) / 100)
    total = subtotal - discount + tax
    cash = money(payload.cash_received)
    if cash < total:
        raise HTTPException(422, "Pembayaran tunai kurang")
    return lines, {"subtotal": float(subtotal), "discount": float(discount), "tax_amount": float(tax), "total": float(total), "cash_received": float(cash), "change": float(cash - total)}


def public_order(document):
    return {key: value for key, value in document.items() if key not in ("_id", "offline_request_hash")}


@router.post("/orders", dependencies=[Depends(require_permission("pos.use"))])
async def synchronize_cash_sale(payload: OfflineCashSale, user: dict = Depends(get_current_user)):
    if payload.expected_store_id != user["store_id"] or payload.expected_cashier_id != user["id"]:
        raise HTTPException(403, "Masuk kembali ke akun dan toko asal transaksi untuk menyinkronkan")
    lines, totals = prepare_sale(payload)
    db = get_db()
    identifier = str(payload.client_order_id)
    identity = f"offline:{user['store_id']}:{identifier}"
    digest = hashlib.sha256(json.dumps(payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    legacy = payload.model_dump(mode='json')
    legacy.pop('customer_id', None)
    for line in legacy['items']:
        line.pop('unit_cost', None)
    legacy_digest = hashlib.sha256(json.dumps(legacy, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    legacy_compatible = payload.customer_id is None and all(item.unit_cost is None for item in payload.items)

    async def commit(session):
        existing = await db.orders.find_one({"_id": identity}, session=session)
        if existing:
            if existing.get("cashier_id") != user["id"] or (existing.get("offline_request_hash") != digest and not (legacy_compatible and existing.get("offline_request_hash") == legacy_digest)):
                raise HTTPException(409, "Nomor transaksi sudah dipakai untuk data yang berbeda. Transaksi lokal tetap disimpan")
            return public_order(existing)
        sold_at = payload.sold_at.astimezone(timezone.utc)
        day = sold_at.strftime("%Y%m%d")
        counter = await db.counters.find_one_and_update(
            {"_id": f"{user['store_id']}:{day}"}, {"$inc": {"seq": 1}},
            upsert=True, return_document=ReturnDocument.AFTER, session=session,
        )
        warnings = []
        snapshot_lines = [dict(line) for line in lines]
        for line in snapshot_lines:
            product = await db.products.find_one_and_update(
                {"store_id": user["store_id"], "id": line["product_id"]},
                {"$inc": {"stock": -line["quantity"]}}, return_document=ReturnDocument.AFTER, session=session,
            )
            if line.get('unit_cost') is not None:
                line['cost_snapshot_source'] = 'offline_catalogue'
            else:
                line['unit_cost'] = product.get('cost') if product else None
                line['cost_snapshot_source'] = 'sync_time' if line['unit_cost'] is not None else 'unknown'
            await movement(db, session, identifier=f"{identifier}:sale:{line['product_id']}", store_id=user['store_id'],
                product_id=line['product_id'], name=line['name'], quantity=-line['quantity'], reference=f"GR-{day}-{counter['seq']:04d}",
                kind='sale', actor=user['id'], at=sold_at.isoformat())
            if product is None:
                warnings.append({"product_id": line["product_id"], "reason": "product_missing"})
            elif product.get("stock", 0) < 0:
                warnings.append({"product_id": line["product_id"], "reason": "stock_below_zero"})
        customer = await customer_for_sale(db, user["store_id"], payload, session, strict=False)
        document = {
            "_id": identity, "id": identifier, "store_id": user["store_id"],
            "cashier_id": user["id"], "cashier_email": user["email"],
            "order_no": f"GR-{day}-{counter['seq']:04d}", "items": snapshot_lines, **totals,
            "customer_id": customer["id"] if customer else None, "inventory_ledger_version": 1,
            "tax_percent": payload.tax_percent, "payment_method": "cash", "payment_status": "paid",
            "customer_name": payload.customer_name, "customer_phone": payload.customer_phone,
            "customer_email": payload.customer_email, "note": payload.note,
            "created_at": sold_at.isoformat(), "updated_at": datetime.now(timezone.utc).isoformat(),
            "offline_reference": f"OFF-{identifier.replace('-', '')[:16].upper()}",
            "offline_request_hash": digest, "inventory_warnings": warnings,
        }
        await db.orders.insert_one(document, session=session)
        await apply_loyalty(db, document, session)
        return public_order(document)

    try:
        async with await db.client.start_session() as session:
            return await session.with_transaction(commit)
    except OperationFailure as error:
        if error.code in (20, 303):
            raise HTTPException(503, "Sinkronisasi belum tersedia. Transaksi tetap aman di perangkat; jangan hapus data aplikasi") from None
        raise
