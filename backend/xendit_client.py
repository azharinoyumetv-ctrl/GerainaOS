"""Xendit API client (test mode safe with mock fallback)."""
import os
import uuid
from typing import Any, Dict, Optional
import httpx

XENDIT_BASE = "https://api.xendit.co"
XENDIT_API_VERSION = "2022-07-31"


def _key() -> str:
    return os.environ.get("XENDIT_SECRET_KEY", "")


def _is_mock_mode() -> bool:
    k = _key()
    return (not k) or k.startswith("xnd_development_REPLACE") or k == "test"


async def _post(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    auth = httpx.BasicAuth(_key(), "")
    headers = {"api-version": XENDIT_API_VERSION}
    async with httpx.AsyncClient(base_url=XENDIT_BASE, headers=headers, auth=auth, timeout=20) as c:
        r = await c.post(path, json=payload)
        if r.status_code >= 400:
            raise httpx.HTTPStatusError(f"Xendit {r.status_code}: {r.text}", request=r.request, response=r)
        return r.json()


# ---------- QRIS Dynamic ----------
async def create_qris(external_id: str, amount: int, currency: str = "IDR") -> Dict[str, Any]:
    if _is_mock_mode():
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
    payload = {
        "reference_id": external_id,
        "type": "DYNAMIC",
        "currency": currency,
        "amount": amount,
        "expires_at": None,
    }
    return await _post("/qr_codes", payload)


# ---------- E-Wallet Charge ----------
async def create_ewallet_charge(
    reference_id: str,
    amount: int,
    channel_code: str,
    customer_phone: Optional[str] = None,
    customer_email: Optional[str] = None,
    success_url: Optional[str] = None,
    failure_url: Optional[str] = None,
    currency: str = "IDR",
) -> Dict[str, Any]:
    if _is_mock_mode():
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
    return await _post("/ewallets/charges", payload)
