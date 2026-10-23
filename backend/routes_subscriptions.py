"""Subscription checkout and payment reconciliation; synced with DapurOS."""
import re

from fastapi import APIRouter, Depends, HTTPException

from auth import get_billing_user, require_billing_admin
from billing_subscriptions import prepare_order, attach_reference, reconcile_order, reconcile_pending
from database import get_db
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
    fresh = await get_db().users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return {"subscription": subscription_for(fresh, user["current_module"])}


@router.post("/reconcile")
async def reconcile(payload: dict):
    # This endpoint only triggers a fresh server-side payment check. Caller-supplied
    # status, amounts and account IDs are ignored, so it can never grant free access.
    order_id = payload.get("orderId")
    if not isinstance(order_id, str) or not re.fullmatch(r"DG-(geraina|dapuros)-[a-f0-9]{32}", order_id):
        raise HTTPException(400, "Nomor pesanan tidak valid")
    return await reconcile_order(order_id)
