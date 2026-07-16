"""POS / Orders routes."""
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db, utcnow, next_order_no
from models import OrderCreate, Order, OrderLineItem
from auth import get_current_user, require_admin
from xendit_client import create_qris, create_ewallet_charge

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _calc(order: OrderCreate) -> dict:
    subtotal = sum(i.subtotal for i in order.items)
    discount = order.discount or 0
    base = max(0, subtotal - discount)
    tax = base * (order.tax_percent or 0) / 100
    total = base + tax
    return {"subtotal": subtotal, "discount": discount, "tax_amount": tax, "total": total}


@router.post("")
async def create_order(payload: OrderCreate, user: dict = Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order kosong")

    db = get_db()
    calc = _calc(payload)
    order_no = await next_order_no(user["store_id"])
    order_id = str(uuid.uuid4())

    change = None
    if payload.payment_method == "cash" and payload.cash_received is not None:
        change = round(payload.cash_received - calc["total"], 2)
        if change < 0:
            raise HTTPException(status_code=400, detail="Pembayaran tunai kurang")

    doc = {
        "id": order_id,
        "store_id": user["store_id"],
        "cashier_id": user["id"],
        "cashier_email": user["email"],
        "order_no": order_no,
        "items": [i.model_dump() for i in payload.items],
        "subtotal": calc["subtotal"],
        "discount": calc["discount"],
        "tax_percent": payload.tax_percent or 0,
        "tax_amount": calc["tax_amount"],
        "total": calc["total"],
        "payment_method": payload.payment_method,
        "payment_status": "paid" if payload.payment_method == "cash" else "pending",
        "ewallet_channel": payload.ewallet_channel,
        "customer_name": payload.customer_name,
        "customer_phone": payload.customer_phone,
        "customer_email": payload.customer_email,
        "cash_received": payload.cash_received,
        "change": change,
        "note": payload.note,
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(),
    }

    # Xendit integrations -- resolved BEFORE stock is touched. A misconfigured/failed
    # gateway must fail the request cleanly (no order, no stock change) instead of
    # silently creating a "pending forever" order with no QR/checkout link and already
    # -decremented stock: the previous version swallowed this exception into xendit_raw
    # only, which the frontend never surfaces (POS.jsx only renders the QR/link block
    # when xendit_qr_string / xendit_checkout_url is present) -- customer and cashier saw
    # nothing, silently.
    if payload.payment_method == "qris":
        try:
            res = await create_qris(external_id=order_no, amount=int(round(calc["total"])))
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"QRIS belum dikonfigurasi atau gagal membuat kode QR ({e}). Atur Xendit di Pengaturan > Integrasi.")
        doc["xendit_id"] = res.get("id")
        doc["xendit_reference_id"] = order_no
        doc["xendit_qr_string"] = res.get("qr_string")
        doc["xendit_raw"] = res
    elif payload.payment_method == "ewallet":
        if not payload.ewallet_channel:
            raise HTTPException(status_code=400, detail="ewallet_channel wajib untuk e-wallet")
        try:
            res = await create_ewallet_charge(
                reference_id=order_no,
                amount=int(round(calc["total"])),
                channel_code=payload.ewallet_channel,
                customer_phone=payload.customer_phone,
                customer_email=payload.customer_email,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"E-Wallet belum dikonfigurasi atau gagal memulai pembayaran ({e}). Atur Xendit di Pengaturan > Integrasi.")
        doc["xendit_id"] = res.get("id")
        doc["xendit_reference_id"] = order_no
        actions = res.get("actions") or {}
        doc["xendit_checkout_url"] = (
            actions.get("desktop_web_checkout_url")
            or actions.get("mobile_web_checkout_url")
            or actions.get("mobile_deeplink_checkout_url")
        )
        doc["xendit_raw"] = res

    # Reduce stock atomically -- only after the payment gateway step above succeeded
    # (or wasn't needed), so a failed qris/ewallet init never leaves stock decremented
    # for an order that was never actually created.
    for it in payload.items:
        await db.products.update_one(
            {"id": it.product_id, "store_id": user["store_id"]},
            {"$inc": {"stock": -it.quantity}},
        )

    await db.orders.insert_one(doc)

    # Auto-kirim struk ke WhatsApp pelanggan (best-effort; toggle "Kirim Struk Otomatis").
    # Diinisiasi toko -> wajib template. Pakai template KUSTOM dagangos_order_receipt (Bahasa
    # Indonesia, tanpa tombol CTA, 4 parameter teks biasa) -- lihat TEMPLATE_RECEIPT_* di
    # whatsapp_client.py. Belum disetujui Meta pada saat kode ini ditulis; ajukan lewat Meta
    # Business Manager sebelum ini benar-benar bisa mengirim.
    try:
        if payload.customer_phone:
            from whatsapp_client import (
                get_wa_config, send_meta_message,
                TEMPLATE_RECEIPT_NAME_DEFAULT, TEMPLATE_RECEIPT_LANG_DEFAULT,
            )
            wa = await get_wa_config(db, user["store_id"])
            if wa.get("is_active"):
                settings = await db.settings.find_one({"store_id": user["store_id"]}, {"_id": 0})
                store_name = ((settings or {}).get("general") or {}).get("store_name") or user.get("store_name") or "Toko"
                total_str = f"{int(round(calc['total'])):,}".replace(",", ".")
                method_labels = {"cash": "Tunai", "qris": "QRIS", "ewallet": "E-Wallet", "card": "Kartu"}
                payment_method_label = method_labels.get(payload.payment_method, payload.payment_method or "-")
                template_name = wa.get("template_receipt") or TEMPLATE_RECEIPT_NAME_DEFAULT
                template_lang = wa.get("template_receipt_lang") or TEMPLATE_RECEIPT_LANG_DEFAULT
                params = [order_no, store_name, total_str, payment_method_label]
                doc["whatsapp"] = await send_meta_message(wa, payload.customer_phone, template_name, params, lang=template_lang)
    except Exception:
        pass

    doc.pop("_id", None)
    return doc


@router.get("")
async def list_orders(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = 200,
):
    db = get_db()
    flt = {"store_id": user["store_id"]}
    if status:
        flt["payment_status"] = status
    cursor = db.orders.find(flt, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


@router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    db = get_db()
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=7)).isoformat()
    month_start = (now - timedelta(days=30)).isoformat()

    async def sum_in(after: str, paid_only: bool = True) -> dict:
        match = {"store_id": user["store_id"], "created_at": {"$gte": after}}
        if paid_only:
            match["payment_status"] = "paid"
        cur = db.orders.aggregate([
            {"$match": match},
            {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
        ])
        rows = await cur.to_list(length=1)
        return rows[0] if rows else {"total": 0, "count": 0}

    today = await sum_in(today_start)
    week = await sum_in(week_start)
    month = await sum_in(month_start)
    product_count = await db.products.count_documents({"store_id": user["store_id"]})
    return {
        "today_sales": today.get("total", 0),
        "today_orders": today.get("count", 0),
        "week_sales": week.get("total", 0),
        "week_orders": week.get("count", 0),
        "month_sales": month.get("total", 0),
        "month_orders": month.get("count", 0),
        "product_count": product_count,
    }


@router.get("/product-sales")
async def product_sales(user: dict = Depends(get_current_user), days: int = 30, limit: int = 10):
    """Laporan produk terjual REAL: agregasi qty + revenue per produk dari order LUNAS."""
    db = get_db()
    from datetime import datetime, timezone, timedelta
    after = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cur = db.orders.aggregate([
        {"$match": {"store_id": user["store_id"], "payment_status": "paid", "created_at": {"$gte": after}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": {"pid": "$items.product_id", "name": "$items.name"},
            "sold": {"$sum": "$items.quantity"},
            "revenue": {"$sum": "$items.subtotal"},
        }},
        {"$sort": {"sold": -1}},
        {"$limit": limit},
    ])
    rows = await cur.to_list(length=limit)
    return [
        {
            "product_id": r["_id"].get("pid"),
            "name": r["_id"].get("name") or "-",
            "sold": r.get("sold", 0),
            "revenue": r.get("revenue", 0),
        }
        for r in rows
    ]


@router.get("/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.orders.find_one({"id": order_id, "store_id": user["store_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    return doc


@router.post("/{order_id}/mark-paid")
async def mark_paid(order_id: str, user: dict = Depends(require_admin)):
    """Owner-only manual settle: confirm a pending non-cash order was actually received
    (e.g. paid via the merchant's own external EDC/QRIS). Not a payment simulator."""
    db = get_db()
    res = await db.orders.find_one_and_update(
        {"id": order_id, "store_id": user["store_id"]},
        {"$set": {"payment_status": "paid", "updated_at": utcnow().isoformat()}},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    return res


@router.post("/{order_id}/void")
async def void_order(order_id: str, user: dict = Depends(require_admin)):
    """Batalkan order (owner-only): set payment_status 'voided' dan KEMBALIKAN stok/bahan
    yang sudah dipotong saat order dibuat. Idempotent."""
    db = get_db()
    order = await db.orders.find_one({"id": order_id, "store_id": user["store_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    if order.get("payment_status") == "voided":
        return {"ok": True, "already_voided": True}

    for it in order.get("items", []):
        pid = it.get("product_id")
        qty = it.get("quantity", 0)
        prod = await db.products.find_one({"id": pid, "store_id": user["store_id"]})
        if prod and prod.get("recipe"):
            for rec in prod["recipe"]:
                ing_id = rec.get("ingredient_id")
                rec_qty = rec.get("quantity") or rec.get("qty") or 0
                await db.ingredients.update_one(
                    {"id": ing_id, "store_id": user["store_id"]},
                    {"$inc": {"stock": float(rec_qty) * qty}},
                )
        elif prod:
            await db.products.update_one(
                {"id": pid, "store_id": user["store_id"]},
                {"$inc": {"stock": qty}},
            )

    await db.orders.update_one(
        {"id": order_id, "store_id": user["store_id"]},
        {"$set": {"payment_status": "voided", "updated_at": utcnow().isoformat()}},
    )
    return {"ok": True}
