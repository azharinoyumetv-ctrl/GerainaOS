"""Account-bound subscriptions; the portal verifies Midtrans using its existing key.

Keep this module identical in both product backends. A browser redirect or webhook
body never grants access: read payment truth from the fixed portal payment service.
"""
import calendar
import re
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from database import get_db, utcnow
from subscription_state import subscription_for

PRICES = {
    "geraina": {"starter": (149000, 1490000), "pro": (349000, 3490000), "business": (549000, 5490000)},
    "dapuros": {"starter": (249000, 2490000), "pro": (499000, 4990000), "business": (749000, 7490000)},
}
PAYMENT_STATUS_URL = "https://dagangos.com/api/subscriptions/payment-status"


def stamp(value):
    return value.astimezone(timezone.utc).isoformat(timespec="microseconds")


def term_end(start, period):
    month = start.month - 1 + (12 if period == "yearly" else 1)
    year = start.year + month // 12
    month = month % 12 + 1
    return start.replace(year=year, month=month, day=min(start.day, calendar.monthrange(year, month)[1]))


async def prepare_order(payload, user):
    module = user["current_module"]
    tier, period, order_id = payload.get("tier"), payload.get("period"), payload.get("orderId")
    if tier not in PRICES.get(module, {}) or period not in ("monthly", "yearly") or not isinstance(order_id, str) or not re.fullmatch(rf"DG-{module}-[a-f0-9]{{32}}", order_id):
        raise HTTPException(400, "Pilihan paket tidak valid")
    active = subscription_for(user, module)
    if active and active["active"] and active["tier"] == tier:
        raise HTTPException(409, detail={"code": "subscription_active", "subscription": active})
    record = {
        "_id": order_id, "owner_id": user["id"], "store_id": user["store_id"],
        "module": module, "tier": tier, "period": period,
        "amount": PRICES[module][tier][period == "yearly"],
        "status": "pending", "created_at": stamp(utcnow()),
    }
    db = get_db()
    if not await db.stores.find_one({"id": user["store_id"], "owner_user_id": user["id"], "module": {"$in": [module, None]}}):
        raise HTTPException(403, "Akun pemilik toko diperlukan")
    try:
        await db.subscription_orders.insert_one(record)
    except DuplicateKeyError:
        existing = await db.subscription_orders.find_one({"_id": order_id})
        if not existing or any(existing.get(key) != record[key] for key in ("owner_id", "store_id", "module", "tier", "period", "amount")):
            raise HTTPException(409, "Pesanan tidak cocok dengan akun ini")
        record = existing
    return {**{key: record[key] for key in ("owner_id", "store_id", "module", "tier", "period", "amount")}, "order_id": order_id, "email": user["email"]}


async def attach_reference(order_id, receipt, user):
    if not isinstance(receipt, str) or not 50 <= len(receipt) <= 4000:
        raise HTTPException(400, "Referensi pembayaran tidak valid")
    result = await get_db().subscription_orders.update_one(
        {"_id": order_id, "owner_id": user["id"], "store_id": user["store_id"], "module": user["current_module"],
         "$or": [{"receipt": {"$exists": False}}, {"receipt": receipt}]},
        {"$set": {"receipt": receipt}},
    )
    if not result.matched_count:
        raise HTTPException(409, "Referensi pesanan tidak cocok")
    return {"ok": True}


async def fetch_payment_status(receipt):
    async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
        response = await client.post(PAYMENT_STATUS_URL, json={"receipt": receipt})
        response.raise_for_status()
        return response.json()


async def reconcile_order(order_id, *, force=True):
    db = get_db()
    order = await db.subscription_orders.find_one({"_id": order_id})
    if not order or not order.get("receipt"):
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if not force:
        claimed = await db.subscription_orders.update_one(
            {"_id": order_id, "$or": [{"checked_at": {"$exists": False}}, {"checked_at": {"$lt": stamp(utcnow() - timedelta(seconds=15))}}]},
            {"$set": {"checked_at": stamp(utcnow())}},
        )
        if not claimed.matched_count:
            return {"status": order["status"], "activation": order.get("activation", "pending")}
    try:
        payment = await fetch_payment_status(order["receipt"])
    except (httpx.HTTPError, ValueError, TypeError):
        raise HTTPException(503, "Status pembayaran belum dapat diperiksa")
    expected = {"orderId": order["_id"], "ownerId": order["owner_id"], "storeId": order["store_id"], **{key: order[key] for key in ("module", "tier", "period", "amount")}}
    if any(payment.get(key) != value for key, value in expected.items()):
        raise HTTPException(502, "Konfirmasi pembayaran tidak cocok dengan pesanan")
    state = payment.get("status")
    if state not in ("paid", "pending", "failed", "refunded"):
        raise HTTPException(503, "Pembayaran belum terverifikasi")
    field = f"subscriptions.{order['module']}"
    activation = order.get("activation", "pending")
    expiry = order.get("expires_at")
    if state == "paid":
        try:
            paid_at = datetime.fromisoformat(payment["paidAt"])
            if paid_at.tzinfo is None:
                raise ValueError("Missing payment timezone")
        except (KeyError, ValueError, TypeError):
            raise HTTPException(502, "Waktu pembayaran belum terverifikasi")
        paid_stamp, expiry = stamp(paid_at), stamp(term_end(paid_at, order["period"]))
        subscription = {"tier": order["tier"], "period": order["period"], "status": "active", "order_id": order_id, "paid_at": paid_stamp, "expires_at": expiry}
        # Deterministic dates and an atomic timestamp/order comparison make retries
        # harmless and stop an older payment from overwriting a newer subscription.
        result = await db.users.update_one(
            {"id": order["owner_id"], "$or": [
                {f"{field}.paid_at": {"$exists": False}},
                {f"{field}.paid_at": {"$lt": paid_stamp}},
                {f"{field}.paid_at": paid_stamp, f"{field}.order_id": {"$lte": order_id}},
            ]}, {"$set": {field: subscription}},
        )
        activation = "active" if result.matched_count else "superseded"
        if result.matched_count:
            store = await db.stores.update_one(
                {"id": order["store_id"], "owner_user_id": order["owner_id"], "$or": [
                    {"subscription.paid_at": {"$exists": False}},
                    {"subscription.paid_at": {"$lt": paid_stamp}},
                    {"subscription.paid_at": paid_stamp, "subscription.order_id": {"$lte": order_id}},
                ]},
                {"$set": {"subscription": subscription, "plan": order["tier"]}},
            )
            if not store.matched_count and not await db.stores.find_one({"id": order["store_id"], "owner_user_id": order["owner_id"]}):
                raise HTTPException(503, "Toko untuk aktivasi tidak ditemukan")
    elif state in ("failed", "refunded"):
        result = await db.users.update_one(
            {"id": order["owner_id"], f"{field}.order_id": order_id},
            {"$set": {f"{field}.status": "revoked"}},
        )
        if result.matched_count:
            await db.stores.update_one(
                {"id": order["store_id"], "owner_user_id": order["owner_id"], "subscription.order_id": order_id},
                {"$set": {"subscription.status": "revoked", "plan": "expired"}},
            )
        activation = "revoked" if result.matched_count else "pending"
    await db.subscription_orders.update_one({"_id": order_id}, {"$set": {"status": state, "activation": activation, "expires_at": expiry, "checked_at": stamp(utcnow())}})
    return {"status": state, "activation": activation, "tier": order["tier"], "expires_at": expiry}


async def reconcile_pending(user, module):
    # Login/focus can recover a missed webhook without repeatedly checking every API request.
    orders = await get_db().subscription_orders.find({"owner_id": user["id"], "module": module, "receipt": {"$exists": True}, "status": "pending"}).sort("created_at", -1).limit(1).to_list(length=1)
    for order in orders:
        try:
            await reconcile_order(order["_id"], force=False)
        except HTTPException:
            pass  # A payment-service outage must not prevent the user from signing in.
