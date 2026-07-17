"""Xendit API client -- BYO per-tenant credentials, v3 Payment Request API.

HISTORY (credentials): this used to read a single global XENDIT_SECRET_KEY env
var, shared across every store, while the Settings > Integrasi UI told
merchants "use your own Xendit key -- transactions go to your own account."
Those two things were both true and incompatible: a merchant's own key, once
saved, was written to integrations.xendit.secret_key and then never read by
anything -- the actual charge calls only ever consulted the env var. Converted
to the same per-store BYO pattern as doku_client.py/EDC/WhatsApp: credentials
come from the calling store's own integrations.xendit config.

HISTORY (API version): this used to call Xendit's older, separate /qr_codes
and /ewallets/charges endpoints. Confirmed against Xendit's own current
OpenAPI spec (Payments v3) that neither endpoint appears there at all --
the current, documented integration path is the unified Payment Request API
(POST /v3/payment_requests, one shape for every channel via channel_code).
Migrated to that. Confirmed per-channel details (channel_code strings,
channel_properties fields, response action descriptor) against
docs.xendit.co's individual channel pages (QRIS, OVO, LinkAja) rather than
assuming the old codes/shapes still applied -- e.g. e-wallet channel codes
dropped their "ID_" prefix (OVO not ID_OVO), and OVO no longer needs a
mobile_number in channel_properties (v3 OVO is REDIRECT/SKIP like the other
e-wallets, not the old phone-linked flow).
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import httpx

XENDIT_BASE = "https://api.xendit.co"
PAYMENT_REQUESTS_PATH = "/v3/payment_requests"

# Confirmed via docs.xendit.co/docs/{qris,ovo,linkaja} etc -- plain channel_code,
# no "ID_" prefix in the v3 Payment Request API (unlike the old /ewallets/charges API).
EWALLET_CHANNELS = {"OVO", "DANA", "SHOPEEPAY", "LINKAJA"}


class PaymentNotConfiguredError(Exception):
    """No real payment provider key configured (production, BYO not set up)."""
    pass


def _is_mock_mode(cfg: Dict[str, Any]) -> bool:
    # Mock payment responses are DEV-ONLY. In production, a merchant that hasn't
    # configured their own (BYO) Xendit key must get a clear error — never a fake QR.
    if os.environ.get("ALLOW_PAYMENT_MOCK", "false").lower() not in ("1", "true", "yes"):
        return False
    k = (cfg.get("secret_key") or "").strip()
    return (not k) or k.startswith("xnd_development_REPLACE") or k == "test"


def _require_configured(cfg: Dict[str, Any], purpose: str) -> None:
    if not cfg.get("is_active") or not (cfg.get("secret_key") or "").strip():
        raise PaymentNotConfiguredError(
            f"Xendit belum dikonfigurasi. Tambahkan API key Xendit toko Anda di Pengaturan → Integrasi untuk menerima {purpose}."
        )


async def _create_payment_request(cfg: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    key = (cfg.get("secret_key") or "").strip()
    auth = httpx.BasicAuth(key, "")
    async with httpx.AsyncClient(base_url=XENDIT_BASE, auth=auth, timeout=20) as c:
        r = await c.post(PAYMENT_REQUESTS_PATH, json=payload)
        if r.status_code >= 400:
            raise httpx.HTTPStatusError(f"Xendit {r.status_code}: {r.text}", request=r.request, response=r)
        return r.json()


def _first_action_value(res: Dict[str, Any], descriptor: str) -> Optional[str]:
    """v3 responses carry the QR string / redirect URL inside an actions[] array,
    e.g. [{"type": "PRESENT_TO_CUSTOMER", "descriptor": "QR_STRING", "value": "..."}].
    Defensive: an unexpected/missing shape returns None rather than raising --
    same lesson as the DOKU response-parsing incident earlier this session."""
    try:
        for action in res.get("actions") or []:
            if isinstance(action, dict) and action.get("descriptor") == descriptor:
                return action.get("value")
    except Exception:
        pass
    return None


# ---------- QRIS (dynamic, single-use) ----------
async def create_qris(cfg: Dict[str, Any], external_id: str, amount: int, currency: str = "IDR") -> Dict[str, Any]:
    """cfg = the store's integrations.xendit dict: {is_active, secret_key, webhook_token}."""
    if _is_mock_mode(cfg):
        # Mock for demo when no real key set
        mock_res = {
            "payment_request_id": f"mock_qr_{uuid.uuid4().hex[:12]}",
            "reference_id": external_id,
            "request_amount": amount,
            "currency": currency,
            "status": "REQUIRES_ACTION",
            "actions": [{
                "type": "PRESENT_TO_CUSTOMER",
                "descriptor": "QR_STRING",
                "value": (
                    f"00020101021226680014ID.CO.QRIS.WWW0118ID{uuid.uuid4().hex[:18].upper()}0303UMI"
                    f"5204481253033605802ID5910Geraina POS6007Jakarta61051234062260722MOCK{external_id[:8]}"
                ),
            }],
            "_mock": True,
        }
        # Same flattening as the real path below -- caught by a local test that the mock
        # branch previously skipped this and left qr_string missing entirely.
        mock_res["qr_string"] = _first_action_value(mock_res, "QR_STRING")
        return mock_res
    _require_configured(cfg, "QRIS")
    payload = {
        "reference_id": external_id,
        "type": "PAY",
        "country": "ID",
        "currency": currency,
        "request_amount": amount,
        "capture_method": "AUTOMATIC",
        "channel_code": "QRIS",
        "channel_properties": {
            # QRIS payment requests expire after 48h per Xendit's channel spec --
            # set it explicitly rather than relying on their default.
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
    }
    res = await _create_payment_request(cfg, payload)
    res.setdefault("qr_string", _first_action_value(res, "QR_STRING"))
    return res


# ---------- E-Wallet (OVO / DANA / SHOPEEPAY / LINKAJA) ----------
async def create_ewallet_charge(
    cfg: Dict[str, Any],
    reference_id: str,
    amount: int,
    channel_code: str,
    customer_phone: Optional[str] = None,
    customer_email: Optional[str] = None,
    success_url: Optional[str] = None,
    failure_url: Optional[str] = None,
    currency: str = "IDR",
) -> Dict[str, Any]:
    """cfg = the store's integrations.xendit dict: {is_active, secret_key, webhook_token}.
    channel_code is the plain v3 code: OVO | DANA | SHOPEEPAY | LINKAJA (no ID_ prefix)."""
    if _is_mock_mode(cfg):
        action_url = f"https://example.com/mock-ewallet/{reference_id}"
        mock_res = {
            "payment_request_id": f"mock_ewc_{uuid.uuid4().hex[:12]}",
            "reference_id": reference_id,
            "channel_code": channel_code,
            "request_amount": amount,
            "currency": currency,
            "status": "REQUIRES_ACTION",
            "actions": [{"type": "REDIRECT_CUSTOMER", "descriptor": "WEB_URL", "value": action_url}],
            "_mock": True,
        }
        mock_res["checkout_url"] = _first_action_value(mock_res, "WEB_URL")
        return mock_res

    _require_configured(cfg, "e-wallet")
    payload = {
        "reference_id": reference_id,
        "type": "PAY",
        "country": "ID",
        "currency": currency,
        "request_amount": amount,
        "capture_method": "AUTOMATIC",
        "channel_code": channel_code,
        "channel_properties": {
            "success_return_url": success_url or "https://dagangos.com/geraina/app/pos",
            "failure_return_url": failure_url or "https://dagangos.com/geraina/app/pos",
        },
    }
    res = await _create_payment_request(cfg, payload)
    res.setdefault("checkout_url", _first_action_value(res, "WEB_URL"))
    return res
