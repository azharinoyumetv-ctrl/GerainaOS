"""Subscription checkout and payment reconciliation; synced with DapurOS."""
import re
import asyncio

from fastapi import APIRouter, Depends, HTTPException

from auth import get_billing_user, require_billing_admin
from billing_subscriptions import prepare_order, attach_reference, reconcile_order, reconcile_pending
from database import get_db
from database import utcnow
from subscription_state import subscription_for

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


@router.post("/orders")
async def create_order(payload: dict, user: dict = Depends(require_billing_admin)):
    await reconcile_pending(user, user["current_module"])
    fresh = await get_db().users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return await prepare_order(payload, {**user, "subscriptions": fresh.get("subscriptions", {})})


@router.post("/orders/{order_id}/reference")
async def payment_reference(order_id: str, payload: dict, user: dict = Depends(require_billing_admin)):
    return await attach_reference(order_id, payload.get("receipt"), user)


@router.get("/current")
async def current(user: dict = Depends(get_billing_user)):
    await reconcile_pending(user, user["current_module"])
    if user.get('role') in ('Owner', 'admin'):
        orders = await get_db().subscription_orders.find({'owner_id': user['id'], 'store_id': user['store_id'], 'module': 'geraina', 'kind': 'addon', 'status': 'pending', 'receipt': {'$exists': True}}).sort('created_at', -1).limit(2).to_list(length=2)
        async def check(order):
            try: await reconcile_order(order['_id'], force=False)
            except HTTPException: pass
        await asyncio.gather(*(check(order) for order in orders))
    fresh = await get_db().users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return await billing_view(user, fresh)


async def billing_view(user, fresh=None):
    db = get_db()
    if fresh is None:
        fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    if not fresh:
        raise HTTPException(401, "Akun tidak lagi tersedia")
    store = await db.stores.find_one({"id": user["store_id"], "owner_user_id": user["id"], "module": {"$in": [user["current_module"], None]}})
    result = {
        "subscription": subscription_for(fresh, user["current_module"]),
        "plan": user.get("plan"), "trial_ends_at": user.get("trial_ends_at"),
        "billing_model": "prepaid", "auto_renew": False,
        "can_manage": user.get("role") in ("Owner", "admin") and store is not None,
    }
    if result['can_manage']:
        from addon_billing import view
        result['addons'] = await view(db, {**user, 'subscriptions': fresh.get('subscriptions', {})})
    return result


@router.post('/orders/{order_id}/invoice-claim')
async def claim_addon_invoice(order_id: str, user: dict = Depends(require_billing_admin)):
    from addon_billing import claim_invoice
    return await claim_invoice(order_id, user)


async def set_end_of_term(payload, user, stopping):
    # This service sells prepaid terms, not recurring Xendit plans. Record the
    # owner's intent without charging/refunding or shortening their paid access.
    view = await billing_view(user)
    if not view["can_manage"]:
        raise HTTPException(403, "Akun pemilik toko diperlukan")
    if payload.get("confirm") is not True:
        raise HTTPException(400, "Konfirmasi pemilik diperlukan")
    subscription = view["subscription"]
    if not subscription or not subscription["active"] or not subscription.get("order_id") or payload.get("orderId") != subscription["order_id"]:
        raise HTTPException(409, "Paket telah berubah atau tidak lagi aktif. Muat ulang informasi paket.")
    module, order_id = user["current_module"], subscription["order_id"]
    preference = {"order_id": order_id, "cancel_at_period_end": stopping}
    if stopping:
        preference["cancel_requested_at"] = subscription.get("cancel_requested_at") or utcnow().isoformat()
    result = await get_db().users.update_one(
        {"id": user["id"], "store_id": user["store_id"], f"subscriptions.{module}.order_id": order_id,
         f"subscriptions.{module}.status": "active", f"subscriptions.{module}.expires_at": subscription["expires_at"]},
        {"$set": {f"subscription_preferences.{module}": preference}},
    )
    if not result.matched_count:
        raise HTTPException(409, "Paket telah berubah. Muat ulang informasi paket.")
    return await billing_view(user)


@router.post("/cancel")
async def cancel(payload: dict, user: dict = Depends(require_billing_admin)):
    return await set_end_of_term(payload, user, True)


@router.post("/resume")
async def resume(payload: dict, user: dict = Depends(require_billing_admin)):
    return await set_end_of_term(payload, user, False)


@router.post("/reconcile")
async def reconcile(payload: dict):
    # This endpoint only triggers a fresh server-side payment check. Caller-supplied
    # status, amounts and account IDs are ignored, so it can never grant free access.
    order_id = payload.get("orderId")
    if not isinstance(order_id, str) or not re.fullmatch(r"DG-(geraina|dapuros)-[a-f0-9]{32}", order_id):
        raise HTTPException(400, "Nomor pesanan tidak valid")
    return await reconcile_order(order_id)
