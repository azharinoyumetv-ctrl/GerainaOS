"""DOKU (Checkout/Jokul API) client -- BYO per-tenant credentials.

Mirrors the proven implementation in website-master-platform
(lib/actions/payments.ts createDokuCheckout/handleDokuNotification), adapted to
GerainaOS's per-store BYO pattern (credentials read from the store's
integrations.doku config, same as whatsapp_client.py -- NOT a shared global env
var, unlike xendit_client.py which is a separate, pre-existing inconsistency).

DOKU signs/verifies requests with HMAC-SHA256 over a canonical string built from
the Client-Id, Request-Id, Request-Timestamp, Request-Target and a SHA-256 Digest
of the exact raw request body. The body sent on the wire and the body digested
MUST be byte-identical, so callers must POST the same `body_json` string that was
used to compute the digest -- never let a JSON library re-serialize in between.
"""
import base64
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

DOKU_SANDBOX_BASE = "https://api-sandbox.doku.com"
DOKU_PRODUCTION_BASE = "https://api.doku.com"
CHECKOUT_PATH = "/checkout/v1/payment"


class DokuNotConfiguredError(Exception):
    """No DOKU credentials configured for this store (BYO not set up)."""
    pass


def _base_url(environment: str) -> str:
    return DOKU_PRODUCTION_BASE if environment == "production" else DOKU_SANDBOX_BASE


def _signature_string(client_id: str, request_id: str, timestamp: str, request_target: str, digest: str) -> str:
    return (
        f"Client-Id:{client_id}\n"
        f"Request-Id:{request_id}\n"
        f"Request-Timestamp:{timestamp}\n"
        f"Request-Target:{request_target}\n"
        f"Digest:{digest}"
    )


def _sign(client_id: str, request_id: str, timestamp: str, request_target: str, digest: str, shared_key: str) -> str:
    mac = hmac.new(shared_key.encode(), _signature_string(client_id, request_id, timestamp, request_target, digest).encode(), hashlib.sha256).digest()
    return "HMACSHA256=" + base64.b64encode(mac).decode()


def _method_types(preferred_channel: str) -> List[str]:
    va = ["VIRTUAL_ACCOUNT_BCA", "VIRTUAL_ACCOUNT_BANK_MANDIRI", "VIRTUAL_ACCOUNT_BRI", "VIRTUAL_ACCOUNT_BNI", "VIRTUAL_ACCOUNT_BANK_PERMATA"]
    ewallet = ["EMONEY_SHOPEEPAY", "EMONEY_OVO", "EMONEY_DANA"]
    minimart = ["ONLINE_TO_OFFLINE_ALFA"]
    if preferred_channel == "va":
        return va
    if preferred_channel == "ewallet":
        return ewallet
    if preferred_channel == "minimart":
        return minimart
    return va + ewallet + minimart  # "all" / default / unset


async def create_doku_checkout(
    cfg: Dict[str, Any],
    order_id: str,
    amount: int,
    callback_url: str,
    callback_url_result: str,
    customer_name: Optional[str] = None,
    customer_email: Optional[str] = None,
    customer_phone: Optional[str] = None,
) -> Dict[str, Any]:
    """cfg = the store's integrations.doku dict:
    {is_active, client_id, shared_key, environment ('sandbox'|'production'), preferred_channel}.
    """
    client_id = (cfg.get("client_id") or "").strip()
    shared_key = (cfg.get("shared_key") or "").strip()
    if not cfg.get("is_active") or not client_id or not shared_key:
        raise DokuNotConfiguredError(
            "DOKU belum dikonfigurasi. Tambahkan Client ID dan Shared Key DOKU toko Anda di Pengaturan > Integrasi."
        )
    environment = cfg.get("environment") or "sandbox"
    base = _base_url(environment)
    method_types = _method_types(cfg.get("preferred_channel") or "all")

    body = {
        "order": {
            "amount": int(round(amount)),
            "invoice_number": order_id,
            "currency": "IDR",
            "callback_url": callback_url,
            "callback_url_result": callback_url_result,
            # Keep the hosted DOKU result page instead of an immediate redirect, so
            # the cashier/customer can see the outcome before bouncing back.
            "auto_redirect": False,
        },
        "payment": {
            "payment_due_date": 60,
            "payment_method_types": method_types,
        },
        "customer": {
            "name": customer_name or "Pelanggan",
            "email": customer_email or "customer@example.com",
            "phone": customer_phone or "",
        },
    }
    # Compact, deterministic separators -- this exact string is what gets digested
    # AND what gets sent on the wire (see module docstring).
    body_json = json.dumps(body, separators=(",", ":"))
    digest = base64.b64encode(hashlib.sha256(body_json.encode()).digest()).decode()
    request_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    signature = _sign(client_id, request_id, timestamp, CHECKOUT_PATH, digest, shared_key)

    headers = {
        "Client-Id": client_id,
        "Request-Id": request_id,
        "Request-Timestamp": timestamp,
        "Signature": signature,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(base_url=base, timeout=20) as c:
        r = await c.post(CHECKOUT_PATH, content=body_json, headers=headers)
        try:
            data = r.json()
        except Exception:
            data = {}
        if r.status_code >= 400:
            msg = ", ".join(data.get("error_messages") or []) or data.get("message") or f"DOKU {r.status_code}: {r.text[:200]}"
            raise httpx.HTTPStatusError(f"DOKU checkout gagal: {msg}", request=r.request, response=r)
        return data


def verify_doku_signature(
    client_id: str,
    request_id: str,
    timestamp: str,
    request_target: str,
    raw_body: bytes,
    shared_key: str,
    incoming_signature: str,
) -> bool:
    """Recompute DOKU's HMAC signature over the exact raw inbound body and compare
    against what DOKU sent -- fail closed (False) on any missing piece."""
    if not shared_key or not incoming_signature or not client_id or not request_id or not timestamp:
        return False
    digest = base64.b64encode(hashlib.sha256(raw_body).digest()).decode()
    expected = _sign(client_id, request_id, timestamp, request_target, digest, shared_key)
    return hmac.compare_digest(expected, incoming_signature)


def map_doku_status(payload: Dict[str, Any]) -> str:
    """Map DOKU's transaction status to GerainaOS's internal order.payment_status values."""
    status = ((payload.get("transaction") or {}).get("status") or payload.get("status") or "").upper()
    if status == "SUCCESS":
        return "paid"
    if status == "FAILED":
        return "failed"
    if status == "CANCEL":
        return "voided"
    if status in ("REFUND", "DISPUTE", "CHARGEBACK"):
        return "refunded"
    return "pending"
