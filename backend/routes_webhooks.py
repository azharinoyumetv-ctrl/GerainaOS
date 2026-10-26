from payment_state import provider_transition
"""Xendit webhook handler.

Endpoint: POST /api/webhooks/xendit
Auth: per-store -- header x-callback-token is looked up against each store's own
integrations.xendit.webhook_token (BYO, like the Xendit credentials themselves; see
xendit_client.py's history note for why this used to be a single global token/key and
why that was broken). Maps reference_id back to THAT store's order (order_no is only
unique per store+day -- see next_order_no in database.py -- so a global, unscoped
{"xendit_reference_id": ref} match could silently update a different store's
identically-numbered order; every match below is scoped by store_id too).
"""
import hashlib
import hmac
import logging
import os
import httpx
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from fastapi.responses import PlainTextResponse

from database import get_db
from doku_client import verify_doku_signature, map_doku_status
from auth import get_current_user

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

logger = logging.getLogger("geraina.webhooks")

# Note: WhatsApp inbound signature verification is per-tenant (whatsapp.app_secret in each
# store's integrations doc), NOT a single global secret -- see _verify_meta_signature below.
# Xendit callback-token verification follows the same per-tenant pattern -- see
# xendit_webhook below.


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


async def _process(payload: dict, store_id: str):
    db = get_db()
    if not isinstance(payload, dict):
        return
    nested = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    # Possible fields: reference_id (e-wallet/qr v2), external_id (qr v1), data.reference_id
    ref = (
        payload.get("reference_id")
        or payload.get("external_id")
        or nested.get("reference_id")
        or nested.get("external_id")
    )
    if not ref:
        return

    if payload.get('event') in ('payment_session.completed', 'payment_session.expired'):
        order = await db.orders.find_one({'gateway_reference': ref, 'payment_provider': 'xendit', 'store_id': store_id})
        if not order or nested.get('session_type') != 'PAY' or nested.get('currency') != 'IDR':
            return
        if order.get('gateway_session_id') and nested.get('payment_session_id') != order['gateway_session_id']:
            return
        try:
            amount = Decimal(str(nested.get('amount')))
            if not amount.is_finite() or amount <= 0 or amount != Decimal(str(order['total'])):
                return
        except (InvalidOperation, ValueError, TypeError):
            return
        completed = payload['event'] == 'payment_session.completed'
        if nested.get('status') != ('COMPLETED' if completed else 'EXPIRED'):
            return
        await provider_transition(db, {'id': order['id'], 'store_id': store_id}, 'paid' if completed else 'failed', {'xendit_webhook_payload': payload})
        return

    # Look up the order first (instead of blind update_one), scoped by the tenant this webhook
    # token belongs to, so we know what it's actually worth. This lets us verify the amount
    # before ever flipping to "paid", so a tampered or replayed webhook can't mark an order
    # paid for less than it's actually worth. Ported from DapurOS's routes_webhooks.py, which
    # had this hardening and this file didn't.
    order = await db.orders.find_one(
        {"xendit_reference_id": ref, "store_id": store_id}, {"_id": 0, "id": 1, "store_id": 1, "total": 1, "order_no": 1, "xendit_id": 1, "payment_status": 1}
    )
    if not order:
        logger.warning("Xendit webhook: no order found for reference_id=%s store_id=%s", ref, store_id)
        return

    new_status = _map_status(payload if "status" in payload else (nested or payload))
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    request_id = data.get("payment_request_id")
    if request_id and order.get("xendit_id") and request_id != order["xendit_id"]:
        return
    # Creation/authorization events and late notifications must not undo a settled payment.
    if (new_status == "pending" or order.get("payment_status") in ("refunded", "voided") or
            (order.get("payment_status") == "paid" and new_status != "refunded")):
        return

    if new_status == "paid":
        # Payments API v3 uses request_amount and captures[].capture_amount, not data.amount.
        # Never accept missing/NaN/zero/wrong amounts as evidence that money was received.
        webhook_amount = next((data[key] for key in ("request_amount", "amount", "capture_amount", "charge_amount") if key in data), None)
        try:
            amount = Decimal(str(webhook_amount))
            expected = Decimal(str(order.get("total", 0))).quantize(Decimal("1"))
            if not amount.is_finite() or amount <= 0 or amount != expected or data.get("currency", "IDR") != "IDR":
                return
            captures = data.get("captures")
            if captures is not None:
                if not isinstance(captures, list) or not captures:
                    return
                captured = sum(Decimal(str(row["capture_amount"])) for row in captures)
                if not captured.is_finite() or captured != expected:
                    return
        except (InvalidOperation, TypeError, ValueError, KeyError):
            return

    await provider_transition(db, {'id': order['id'], 'store_id': store_id}, new_status,
                              {'xendit_webhook_payload': payload})


@router.post("/xendit")
async def xendit_webhook(req: Request, background: BackgroundTasks):
    """Single shared URL for every tenant, same shape as the DOKU/WhatsApp handlers below:
    the inbound x-callback-token tells us which store's own Xendit account this call
    belongs to (each store pastes ITS OWN token into Pengaturan > Integrasi and configures
    ITS OWN Xendit dashboard to call back here with it) -- nothing is trusted or acted on
    until that lookup succeeds."""
    token = req.headers.get("x-callback-token") or req.headers.get("X-Callback-Token")
    if not token:
        raise HTTPException(status_code=401, detail="Invalid callback token")
    db = get_db()
    tenant = await db.integrations.find_one({"xendit.webhook_token": token})
    if not tenant or not (tenant.get("xendit") or {}).get("is_active"):
        raise HTTPException(status_code=401, detail="Invalid callback token")
    payload = await req.json()
    background.add_task(_process, payload, tenant["store_id"])
    return {"received": True}


@router.post("/xendit/simulate")
async def simulate_webhook(payload: dict, req: Request, store_id: str = ""):
    """Dev-only simulator (no token required) for local end-to-end tests. store_id must be
    passed explicitly (query param) now that order matching is store-scoped -- there is no
    single global Xendit account/token to infer it from anymore."""
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "false").lower() not in ("1", "true", "yes")):
        raise HTTPException(status_code=403, detail="Simulator disabled")
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id wajib diisi untuk simulator")
    await _process(payload, store_id)
    return {"ok": True}


@router.post('/midtrans')
async def midtrans_webhook(req: Request):
    payload = await req.json()
    if not isinstance(payload, dict):
        raise HTTPException(400, 'Notifikasi tidak valid.')
    reference = str(payload.get('order_id') or '')
    db = get_db()
    order = await db.orders.find_one({'gateway_reference': reference, 'payment_provider': 'midtrans'})
    if not order:
        raise HTTPException(404, 'Transaksi tidak ditemukan.')
    integration = await db.integrations.find_one({'store_id': order['store_id']}) or {}
    cfg = integration.get('midtrans') or {}
    key = str(cfg.get('server_key') or '')
    expected = hashlib.sha512((reference + str(payload.get('status_code') or '') + str(payload.get('gross_amount') or '') + key).encode()).hexdigest()
    if not key or cfg.get('is_active') is not True or not hmac.compare_digest(expected, str(payload.get('signature_key') or '')):
        raise HTTPException(401, 'Tanda tangan tidak valid.')
    # Midtrans's signature does not cover transaction_status. Confirm it server-to-server
    # before settlement; replaying a signed pending event must never fabricate a payment.
    base = 'https://api.midtrans.com' if cfg.get('environment') == 'production' else 'https://api.sandbox.midtrans.com'
    try:
        async with httpx.AsyncClient(base_url=base, auth=httpx.BasicAuth(key, ''), timeout=20) as client:
            response = await client.get(f'/v2/{reference}/status')
            response.raise_for_status()
            verified = response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, 'Status merchant belum dapat diperiksa. Ulangi notifikasi.')
    try:
        amount = Decimal(str(verified.get('gross_amount')))
        if verified.get('order_id') != reference or verified.get('currency', 'IDR') != 'IDR' or not amount.is_finite() or amount <= 0 or amount != Decimal(str(order['total'])):
            raise ValueError()
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(400, 'Referensi atau nominal pembayaran tidak sesuai.')
    status = verified.get('transaction_status')
    mapped = ('paid' if status == 'settlement' or (status == 'capture' and verified.get('fraud_status') == 'accept') else
              'failed' if status in ('deny', 'expire', 'cancel', 'failure') else 'refunded' if status == 'refund' else 'pending')
    await provider_transition(db, {'id': order['id'], 'store_id': order['store_id']}, mapped, {'midtrans_webhook_payload': verified})
    return {'received': True}


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
# Each tenant's Meta App also signs its own webhook payloads with ITS OWN App Secret -- there is
# no single shared secret that can verify every tenant's traffic, so verification must look up
# the correct tenant's `whatsapp.app_secret` before checking the signature. Tenant routing:
# GET verification matches by `whatsapp.webhook_verify_token` (the value Meta calls back with is
# whatever the store owner typed into their own Meta App's webhook config). POST inbound messages
# route by `whatsapp.phone_number_id` found in the payload itself -- so for POST, the payload's
# phone_number_id is read (but NOT trusted/processed) purely to pick which tenant's app_secret to
# verify the raw body's HMAC against. Nothing derived from the payload is acted on until that
# verification passes.

def _extract_phone_number_id(payload: dict) -> str | None:
    try:
        entry = (payload.get("entry") or [{}])[0]
        change = (entry.get("changes") or [{}])[0]
        value = change.get("value") or {}
        return (value.get("metadata") or {}).get("phone_number_id")
    except Exception:
        return None


def _verify_meta_signature(raw_body: bytes, signature_header: str, app_secret: str) -> bool:
    """Without a tenant-specific app_secret configured, this payload cannot be verified -- fail
    closed rather than accept unsigned payloads. A public webhook that trusts anything posted to
    it is an open relay, not an optional hardening step."""
    if not app_secret:
        return False
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
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

    try:
        payload = await req.json()
    except Exception:
        return {"received": True}

    # phone_number_id is used ONLY to pick which tenant's app_secret to verify against -- the
    # payload itself is not trusted or processed until _verify_meta_signature passes below.
    phone_number_id = _extract_phone_number_id(payload)
    if not phone_number_id:
        return {"received": True}

    db = get_db()
    tenant = await db.integrations.find_one({"whatsapp.phone_number_id": phone_number_id})
    if not tenant:
        return {"received": True}

    app_secret = (tenant.get("whatsapp") or {}).get("app_secret") or ""
    if not _verify_meta_signature(raw, sig, app_secret):
        # Still 200 (avoid Meta's retry storm on an unfixable signature mismatch) but the
        # unverified payload is discarded, not processed.
        return {"received": True}

    background.add_task(_process_whatsapp_inbound, payload)
    return {"received": True}


# ---------- DOKU ----------
# Single shared URL for every tenant: https://api.dagangos.com/api/webhooks/doku
# Each store's own DOKU merchant account is configured (BYO) to call back here. DOKU's
# inbound Client-Id header tells us which tenant's shared_key to verify the HMAC
# signature against -- same tenant-routing shape as the WhatsApp handler above: nothing
# from the payload is trusted or acted on until that store's own key verifies it.

async def _process_doku(raw_body: bytes, headers: dict):
    db = get_db()
    client_id = headers.get("client-id", "")
    request_id = headers.get("request-id", "")
    timestamp = headers.get("request-timestamp", "")
    signature = headers.get("signature", "")
    if not client_id:
        return

    tenant = await db.integrations.find_one({"doku.client_id": client_id})
    if not tenant:
        return
    doku_cfg = tenant.get("doku") or {}
    if not doku_cfg.get("is_active"):
        return
    shared_key = doku_cfg.get("shared_key") or ""

    ok = verify_doku_signature(
        client_id=client_id,
        request_id=request_id,
        timestamp=timestamp,
        request_target="/api/webhooks/doku",
        raw_body=raw_body,
        shared_key=shared_key,
        incoming_signature=signature,
    )
    if not ok:
        return

    try:
        payload = __import__("json").loads(raw_body or b"{}")
    except Exception:
        return

    invoice_number = (payload.get("order") or {}).get("invoice_number") or payload.get("invoice_number")
    if not invoice_number:
        return
    new_status = map_doku_status(payload)
    # DOKU Checkout retries may fail before another channel succeeds; FAILED is
    # not terminal for the checkout invoice. Follow DOKU notification best practice.
    # https://developers.doku.com/get-started-with-doku-api/notification/best-practice
    if new_status == 'failed':
        return
    scope = {'store_id': tenant.get('store_id'), '$or': [
        {'order_no': invoice_number, 'payment_method': 'doku'},
        {'gateway_reference': invoice_number, 'payment_provider': 'doku'}]}
    if new_status == 'paid':
        order = await db.orders.find_one(scope)
        try:
            received = Decimal(str((payload.get('order') or {}).get('amount')))
            if not order or not received.is_finite() or received <= 0 or received != Decimal(str(order['total'])):
                return
        except (InvalidOperation, TypeError, ValueError):
            return
    await provider_transition(db, scope,
                              new_status, {'doku_webhook_payload': payload})


@router.post("/doku")
async def doku_webhook(req: Request, background: BackgroundTasks):
    """DOKU always expects a 200 with a specific ack body -- verification failures are
    logged internally (via _process_doku silently discarding), not surfaced as HTTP
    errors, since DOKU will otherwise retry-storm an endpoint that 4xx/5xxs it."""
    raw = await req.body()
    headers = {k.lower(): v for k, v in req.headers.items()}
    background.add_task(_process_doku, raw, headers)
    return {"received": True}


@router.post("/doku/simulate")
async def simulate_doku_webhook(payload: dict, req: Request, store_id: str = ""):
    """Dev-only DOKU webhook simulator (no signature required).

    HISTORY: this originally matched only by {"order_no": invoice_number}, with no store_id
    scope at all -- the exact class of cross-tenant collision bug fixed for the real /doku
    and /xendit(/simulate) handlers elsewhere in this file (order_no is only unique per
    store+day, see next_order_no in database.py). A simulator that can silently update a
    different store's identically-numbered order is still a real bug even though it's
    dev-gated. Brought in line with /xendit/simulate's contract: store_id is now required."""
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "false").lower() not in ("1", "true", "yes")):
        raise HTTPException(status_code=403, detail="Simulator disabled")
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id wajib diisi untuk simulator")
    db = get_db()
    invoice_number = (payload.get("order") or {}).get("invoice_number") or payload.get("invoice_number")
    if not invoice_number:
        return {"ok": False}
    new_status = map_doku_status(payload)
    await provider_transition(db, {'order_no': invoice_number, 'store_id': store_id},
                              new_status, {'doku_webhook_payload': payload})
    return {"ok": True}


@router.post("/whatsapp/simulate")
async def simulate_whatsapp_webhook(payload: dict, req: Request, store_id: str = ""):
    """Dev-only WhatsApp inbound webhook simulator (no Meta signature required).

    There was previously no simulate endpoint for WhatsApp at all -- TestSprite's
    'Webhook Processing: WhatsApp inbound webhook is accepted' test had nothing to call.
    Mirrors _process_whatsapp_inbound's real routing/storage shape (same
    entry[].changes[].value.metadata.phone_number_id envelope Meta actually sends), but
    skips the HMAC signature check and takes store_id explicitly rather than re-deriving
    the tenant from phone_number_id, since a simulator is run by someone who already knows
    which store they're testing."""
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "false").lower() not in ("1", "true", "yes")):
        raise HTTPException(status_code=403, detail="Simulator disabled")
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id wajib diisi untuk simulator")
    db = get_db()
    tenant = await db.integrations.find_one({"store_id": store_id})
    if not tenant or not (tenant.get("whatsapp") or {}).get("is_active"):
        raise HTTPException(status_code=400, detail="WhatsApp belum dikonfigurasi/aktif untuk toko ini")
    phone_number_id = (tenant.get("whatsapp") or {}).get("phone_number_id") or _extract_phone_number_id(payload) or "simulated"
    try:
        value = (((payload.get("entry") or [{}])[0]).get("changes") or [{}])[0].get("value") or payload
    except Exception:
        value = payload
    await db.whatsapp_inbound.insert_one({
        "store_id": store_id,
        "phone_number_id": phone_number_id,
        "payload": value,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "_simulated": True,
    })
    return {"ok": True}


@router.get("/whatsapp/inbound")
async def list_whatsapp_inbound(user: dict = Depends(get_current_user)):
    """Authenticated, store-scoped read of this store's own received inbound WhatsApp
    messages (real + simulated) -- lets the Integrasi simulator panel show that a message
    actually landed instead of firing a POST into the void with no way to verify it."""
    db = get_db()
    cursor = db.whatsapp_inbound.find({"store_id": user["store_id"]}, {"_id": 0}).sort("received_at", -1).limit(10)
    return await cursor.to_list(length=10)
