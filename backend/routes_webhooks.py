"""Xendit webhook handler.

Endpoint: POST /api/webhooks/xendit
Auth: header x-callback-token must match XENDIT_WEBHOOK_TOKEN.
Maps reference_id back to order, updates payment_status.
"""
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks

from database import get_db

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

WEBHOOK_TOKEN = os.environ.get("XENDIT_WEBHOOK_TOKEN", "")


def _map_status(payload: dict) -> str:
    """Map Xendit status across QR & e-wallet to internal status."""
    s = (payload.get("status") or payload.get("transaction_status") or "").upper()
    if s in ("SUCCEEDED", "COMPLETED", "SUCCESS", "PAID", "ACTIVE"):
        # 'ACTIVE' only used for QR creation event; we ignore. We treat actual payment SUCCEEDED/COMPLETED.
        if s == "ACTIVE":
            return "pending"
        return "paid"
    if s in ("FAILED", "EXPIRED"):
        return "failed"
    if s in ("VOIDED",):
        return "voided"
    if s in ("REFUNDED",):
        return "refunded"
    return "pending"


async def _process(payload: dict):
    db = get_db()
    # Possible fields: reference_id (e-wallet/qr v2), external_id (qr v1), data.reference_id
    ref = (
        payload.get("reference_id")
        or payload.get("external_id")
        or (payload.get("data") or {}).get("reference_id")
        or (payload.get("data") or {}).get("external_id")
    )
    if not ref:
        return
    new_status = _map_status(payload if "status" in payload else (payload.get("data") or payload))
    await db.orders.update_one(
        {"xendit_reference_id": ref},
        {
            "$set": {
                "payment_status": new_status,
                "xendit_webhook_payload": payload,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )


@router.post("/xendit")
async def xendit_webhook(req: Request, background: BackgroundTasks):
    token = req.headers.get("x-callback-token") or req.headers.get("X-Callback-Token")
    if not WEBHOOK_TOKEN or token != WEBHOOK_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid callback token")
    payload = await req.json()
    background.add_task(_process, payload)
    return {"received": True}


@router.post("/xendit/simulate")
async def simulate_webhook(payload: dict, req: Request):
    """Dev-only simulator (no token required) for local end-to-end tests."""
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "true").lower() not in ("1", "true", "yes")):
        raise HTTPException(status_code=403, detail="Simulator disabled")
    await _process(payload)
    return {"ok": True}


@router.post("/midtrans/simulate")
async def simulate_midtrans_webhook(payload: dict, req: Request):
    """Dev-only Midtrans webhook simulator (no token required)."""
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "true").lower() not in ("1", "true", "yes")):
        raise HTTPException(status_code=403, detail="Simulator disabled")
    # Map Midtrans-style payload to internal format
    mapped = {
        "reference_id": payload.get("order_id") or payload.get("reference_id"),
        "status": payload.get("transaction_status", payload.get("status", "settlement")).upper(),
    }
    if mapped["status"] in ("SETTLEMENT", "CAPTURE"):
        mapped["status"] = "SUCCEEDED"
    await _process(mapped)
    return {"ok": True}


@router.post("/stripe/simulate")
async def simulate_stripe_webhook(payload: dict, req: Request):
    """Dev-only Stripe webhook simulator (no token required)."""
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "true").lower() not in ("1", "true", "yes")):
        raise HTTPException(status_code=403, detail="Simulator disabled")
    # Map Stripe-style payload to internal format
    mapped = {
        "reference_id": payload.get("payment_intent") or payload.get("reference_id"),
        "status": payload.get("status", "succeeded").upper(),
    }
    if mapped["status"] == "SUCCEEDED":
        mapped["status"] = "SUCCEEDED"
    await _process(mapped)
    return {"ok": True}
