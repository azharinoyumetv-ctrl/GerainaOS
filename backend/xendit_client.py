"""Xendit API client -- BYO per-tenant credentials.

HISTORY: this used to read a single global XENDIT_SECRET_KEY env var, shared
across every store, while the Settings > Integrasi UI told merchants "use
your own Xendit key -- transactions go to your own account." Those two
things were both true and incompatible: a merchant's own key, once saved,
was written to integrations.xendit.secret_key and then never read by
anything -- the actual charge calls only ever consulted the env var. If that
env var happened to be unset (as production currently is), literally no
store's Xendit could work no matter what they entered. If it HAD been set,
every store would have shared one Xendit merchant account, which is worse:
cross-tenant payment collection under someone else's business identity.
Converted to the same per-store BYO pattern as doku_client.py/EDC/WhatsApp:
credentials come from the calling store's own integrations.xendit config.
"""
import os
import uuid
from typing import Any, Dict, Optional
import httpx

XENDIT_BASE = "https://api.xendit.co"
XENDIT_API_VERSION = "2022-07-31"


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


async def _post(cfg: Dict[str, Any], path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    key = (cfg.get("secret_key") or "").strip()
    auth = httpx.BasicAuth(key, "")
    headers = {"api-version": XENDIT_API_VERSION}
    cb = os.environ.get("XENDIT_CALLBACK_URL")
    if cb:
        headers["x-callback-url"] = cb
    async with httpx.AsyncClient(base_url=XENDIT_BASE, headers=headers, auth=auth, timeout=20) as c:
        r = await c.post(path, json=payload)
        if r.status_code >= 400:
            raise httpx.HTTPStatusError(f"Xendit {r.status_code}: {r.text}", request=r.request, response=r)
        return r.json()


# ---------- QRIS Dynamic ----------
async def create_qris(cfg: Dict[str, Any], external_id: str, amount: int, currency: str = "IDR") -> Dict[str, Any]:
    """cfg = the store's integrations.xendit dict: {is_active, secret_key, webhook_token}."""
    if _is_mock_mode(cfg):
        # Mock for demo when no real key set
        return {
            "id": f"mock_qr_{uuid.uuid4().hex[:12]}",
            "external_id": external_id,
            "amount": amount,
            "currency": currency,
            "qr_string": (
                f"00020101021226680014ID.CO.QRIS.WWW0118ID{uuid.uuid4().hex[:18].upper()}0303UMI"
                f"5204481253033605802ID5910Geraina POS6007Jakarta61051234062260722MOCK{external_id[:8]}"
            ),
            "status": "ACTIVE",
            "type": "DYNAMIC",
            "_mock": True,
        }
    if not cfg.get("is_active") or not (cfg.get("secret_key") or "").strip():
        raise PaymentNotConfiguredError(
            "Xendit belum dikonfigurasi. Tambahkan API key Xendit toko Anda di Pengaturan → Integrasi untuk menerima QRIS."
        )
    payload = {
        "reference_id": external_id,
        "type": "DYNAMIC",
        "currency": currency,
        "amount": amount,
        "expires_at": None,
    }
    return await _post(cfg, "/qr_codes", payload)


# ---------- E-Wallet Charge ----------
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
    """cfg = the store's integrations.xendit dict: {is_active, secret_key, webhook_token}."""
    if _is_mock_mode(cfg):
        action_url = f"https://example.com/mock-ewallet/{reference_id}"
        return {
            "id": f"mock_ewc_{uuid.uuid4().hex[:12]}",
            "reference_id": reference_id,
            "channel_code": channel_code,
            "currency": currency,
            "amount": amount,
            "status": "PENDING",
            "actions": {
                "desktop_web_checkout_url": action_url,
                "mobile_web_checkout_url": action_url,
                "mobile_deeplink_checkout_url": action_url,
            },
            "_mock": True,
        }

    if not cfg.get("is_active") or not (cfg.get("secret_key") or "").strip():
        raise PaymentNotConfiguredError(
            "Xendit belum dikonfigurasi. Tambahkan API key Xendit toko Anda di Pengaturan → Integrasi untuk menerima e-wallet."
        )
    chan_props: Dict[str, Any] = {}
    if channel_code in ("ID_OVO",):
        chan_props["mobile_number"] = customer_phone or "+628123456789"
    elif channel_code in ("ID_DANA", "ID_SHOPEEPAY", "ID_LINKAJA"):
        chan_props["success_redirect_url"] = success_url or "https://example.com/success"
        if failure_url:
            chan_props["failure_redirect_url"] = failure_url

    payload = {
        "reference_id": reference_id,
        "currency": currency,
        "amount": amount,
        "checkout_method": "ONE_TIME_PAYMENT",
        "channel_code": channel_code,
        "channel_properties": chan_props,
        "customer": {
            "given_names": "Customer",
            "email": customer_email or "customer@example.com",
            "mobile_number": customer_phone or "+628123456789",
        },
    }
    return await _post(cfg, "/ewallets/charges", payload)
