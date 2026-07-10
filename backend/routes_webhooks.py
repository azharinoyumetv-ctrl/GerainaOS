"""Xendit webhook handler.

Endpoint: POST /api/webhooks/xendit
Auth: header x-callback-token must match XENDIT_WEBHOOK_TOKEN.
Maps reference_id back to order, updates payment_status.
"""
import hashlib
import hmac
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from fastapi.responses import PlainTextResponse

from database import get_db

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

WEBHOOK_TOKEN = os.environ.get("XENDIT_WEBHOOK_TOKEN", "")
WHATSAPP_APP_SECRET = os.environ.get("WHATSAPP_APP_SECRET", "")


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
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "false").lower() not in ("1", "true", "yes")):
        raise HTTPException(status_code=403, detail="Simulator disabled")
    await _process(payload)
    return {"ok": True}


@router.post("/midtrans/simulate")
async def simulate_midtrans_webhook(payload: dict, req: Request):
    """Dev-only Midtrans webhook simulator (no token required)."""
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "false").lower() not in ("1", "true", "yes")):
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
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "false").lower() not in ("1", "true", "yes")):
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


# ---------- WhatsApp (Meta Cloud API) ----------
# Single shared URL for every tenant: https://api.dagangos.com/api/webhooks/whatsapp
# Each store has its own Meta App/WABA (BYO) and points ITS webhook config at this one URL.
# Tenant routing: GET verification matches by `whatsapp.webhook_verify_token` (the value Meta
# calls back with is whatever the store owner typed into their own Meta App's webhook config).
# POST inbound messages route by `whatsapp.phone_number_id` found in the payload itself.

def _verify_meta_signature(raw_body: bytes, signature_header: str) -> bool:
    """Without WHATSAPP_APP_SECRET configured, this endpoint cannot be verified -- fail closed
    rather than accept unsigned payloads. A public webhook that trusts anything posted to it is
    an open relay, not an optional hardening step."""
    if not WHATSAPP_APP_SECRET:
        return False
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(WHATSAPP_APP_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    provided = signature_header.split("=", 1)[1]
    return hmac.compare_digest(expected, provided)


@router.get("/whatsapp")
async def whatsapp_verify(req: Request):
    """Meta calls this once per tenant, when that tenant's store owner registers this shared
    URL as their Meta App's webhook callback."""
    mode = req.query_params.get("hub.mode")
    token = req.query_params.get("hub.verify_token")
    challenge = req.query_params.get("hub.challenge")
    phone_number_id = req.query_params.get("hub.phone_number_id")

    if mode != "subscribe" or not token:
        raise HTTPException(status_code=403, detail="Invalid verification request")

    db = get_db()
    tenant = await db.integrations.find_one({"whatsapp.webhook_verify_token": token})
    if not tenant:
        raise HTTPException(status_code=403, detail="Verify token tidak dikenali")

    if phone_number_id:
        # Cache it so POST routing doesn't depend on the store owner having also pasted the
        # phone_number_id into Integrasi manually -- Meta hands it to us here for free.
        await db.integrations.update_one(
            {"_id": tenant["_id"]},
            {"$set": {"whatsapp.phone_number_id": phone_number_id}},
        )

    return PlainTextResponse(challenge or "")


async def _process_whatsapp_inbound(payload: dict):
    db = get_db()
    try:
        entry = (payload.get("entry") or [{}])[0]
        change = (entry.get("changes") or [{}])[0]
        value = change.get("value") or {}
        phone_number_id = (value.get("metadata") or {}).get("phone_number_id")
        if not phone_number_id:
            return
        tenant = await db.integrations.find_one({"whatsapp.phone_number_id": phone_number_id})
        if not tenant or not (tenant.get("whatsapp") or {}).get("is_active"):
            return
        await db.whatsapp_inbound.insert_one({
            "store_id": tenant.get("store_id"),
            "phone_number_id": phone_number_id,
            "payload": value,
            "received_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass


@router.post("/whatsapp")
async def whatsapp_inbound(req: Request, background: BackgroundTasks):
    """Always return 200 to Meta -- inbound processing must never fail the webhook, or Meta
    will back off and eventually stop calling it."""
    raw = await req.body()
    sig = req.headers.get("x-hub-signature-256", "")
    if not _verify_meta_signature(raw, sig):
        # Still 200 (avoid Meta's retry storm on an unfixable signature mismatch) but the
        # unverified payload is discarded, not processed.
        return {"received": True}

    try:
        payload = await req.json()
    except Exception:
        return {"received": True}

    background.add_task(_process_whatsapp_inbound, payload)
    return {"received": True}
