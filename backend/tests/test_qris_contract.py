"""QRIS contract tests: fake provider transport and isolated in-memory stores, no money movement."""
import copy
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import xendit_client as client
import routes_webhooks as webhooks
import routes_settings as settings


class Collection:
    def __init__(self, rows):
        self.rows = copy.deepcopy(rows)
        self.updates = 0

    @staticmethod
    def matches(row, query):
        for key, value in query.items():
            current = row
            for part in key.split("."):
                current = current.get(part) if isinstance(current, dict) else None
            if isinstance(value, dict) and "$nin" in value:
                if current in value["$nin"]:
                    return False
            elif current != value:
                return False
        return True

    async def find_one(self, query, projection=None):
        return next((copy.deepcopy(row) for row in self.rows if self.matches(row, query)), None)

    async def update_one(self, query, changes):
        for row in self.rows:
            if self.matches(row, query):
                row.update(changes["$set"])
                self.updates += 1
                break


@pytest.fixture
def database(monkeypatch):
    db = SimpleNamespace(
        integrations=Collection([
            {"store_id": "store-a", "xendit": {"is_active": True, "webhook_token": "isolated-token-a"}},
            {"store_id": "store-b", "xendit": {"is_active": True, "webhook_token": "isolated-token-b"}},
        ]),
        orders=Collection([
            {"id": "order-a", "store_id": "store-a", "order_no": "GR-SAME-REF", "xendit_reference_id": "GR-SAME-REF", "xendit_id": "pr-a", "total": 12500, "payment_status": "pending"},
            {"id": "order-b", "store_id": "store-b", "order_no": "GR-SAME-REF", "xendit_reference_id": "GR-SAME-REF", "xendit_id": "pr-b", "total": 12500, "payment_status": "pending"},
        ]),
    )
    monkeypatch.setattr(webhooks, "get_db", lambda: db)
    monkeypatch.setattr(settings, "get_db", lambda: db)
    return db


def capture(**fields):
    return {"event": "payment.capture", "data": {"reference_id": "GR-SAME-REF", "payment_request_id": "pr-a", "status": "SUCCEEDED", "currency": "IDR", "request_amount": 12500, "captures": [{"capture_amount": 12500}], **fields}}


@pytest.mark.asyncio
async def test_store_key_is_used_and_platform_key_is_never_a_fallback(monkeypatch):
    monkeypatch.setenv("XENDIT_SECRET_KEY", "platform-subscription-fixture-key")
    monkeypatch.delenv("ALLOW_PAYMENT_MOCK", raising=False)
    with pytest.raises(client.PaymentNotConfiguredError):
        await client.create_qris({}, "NO-CONFIG", 12500)
    seen = []
    async def transport(request):
        import json
        seen.append(request)
        body = json.loads(request.content)
        assert request.url == "https://api.xendit.co/v3/payment_requests"
        assert body["channel_code"] == "QRIS" and body["request_amount"] == 12500
        assert body["reference_id"] == "STORE-A-ORDER" and body["currency"] == "IDR"
        return httpx.Response(200, json={"payment_request_id": "pr-a", "actions": [{"descriptor": "QR_STRING", "value": "000201-ISOLATED-QR-FIXTURE"}]})
    real_client = httpx.AsyncClient
    monkeypatch.setattr(client.httpx, "AsyncClient", lambda **kw: real_client(**kw, transport=httpx.MockTransport(transport)))
    response = await client.create_qris({"is_active": True, "secret_key": "store-a-fixture-key"}, "STORE-A-ORDER", 12500)
    import base64
    assert seen[0].headers["Authorization"] == "Basic " + base64.b64encode(b"store-a-fixture-key:").decode()
    assert response["qr_string"] == "000201-ISOLATED-QR-FIXTURE"


@pytest.mark.asyncio
@pytest.mark.parametrize("response", [{}, {"payment_request_id": "pr-a"}, {"payment_request_id": "pr-a", "actions": [{"descriptor": "WEB_URL", "value": "https://example.invalid"}]}, {"actions": [{"descriptor": "QR_STRING", "value": "qr"}]}])
async def test_incomplete_gateway_response_is_rejected(monkeypatch, response):
    monkeypatch.delenv("ALLOW_PAYMENT_MOCK", raising=False)
    monkeypatch.setattr(client, "_create_payment_request", AsyncMock(return_value=response))
    with pytest.raises(client.PaymentNotConfiguredError):
        await client.create_qris({"is_active": True, "secret_key": "isolated-key"}, "REF", 12500)


@pytest.mark.asyncio
async def test_real_callback_envelope_is_tenant_scoped_and_duplicate_safe(database):
    app = FastAPI(); app.include_router(webhooks.router)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://isolated.invalid") as api:
        assert (await api.post("/api/webhooks/xendit", json=capture())).status_code == 401
        assert (await api.post("/api/webhooks/xendit", headers={"x-callback-token": "wrong-token"}, json=capture())).status_code == 401
        for _ in range(2):
            assert (await api.post("/api/webhooks/xendit", headers={"x-callback-token": "isolated-token-a"}, json=capture())).status_code == 200
    assert database.orders.rows[0]["payment_status"] == "paid"
    assert database.orders.rows[1]["payment_status"] == "pending"
    assert database.orders.updates == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("changes", [{"request_amount": 0}, {"request_amount": 100}, {"request_amount": None}, {"request_amount": "NaN"}, {"request_amount": "Infinity"}, {"currency": "USD"}, {"captures": [{"capture_amount": 100}]}, {"captures": []}, {"payment_request_id": "pr-other"}])
async def test_wrong_or_unproven_amount_and_payment_identity_cannot_settle(database, changes):
    await webhooks._process(capture(**changes), "store-a")
    assert database.orders.updates == 0


@pytest.mark.asyncio
async def test_missing_amount_and_out_of_order_events_cannot_mark_or_unmark_paid(database):
    body = capture(); del body["data"]["request_amount"]
    await webhooks._process(body, "store-a")
    assert database.orders.updates == 0
    await webhooks._process(capture(), "store-a")
    for state in ["ACTIVE", "PENDING", "FAILED", "EXPIRED"]:
        await webhooks._process(capture(status=state), "store-a")
    assert database.orders.rows[0]["payment_status"] == "paid"
    assert database.orders.updates == 1


@pytest.mark.asyncio
async def test_callback_from_another_store_does_not_settle_matching_reference(database):
    await webhooks._process(capture(), "store-b")
    assert database.orders.updates == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("amount", [0, -1, 10_000_001, 1.5, True])
async def test_invalid_qris_amount_never_contacts_provider(monkeypatch, amount):
    request = AsyncMock(); monkeypatch.setattr(client, "_create_payment_request", request)
    with pytest.raises(client.PaymentNotConfiguredError):
        await client.create_qris({"is_active": True, "secret_key": "isolated-key"}, "REF", amount)
    request.assert_not_called()


@pytest.mark.asyncio
async def test_status_is_store_scoped_secret_free_and_does_not_claim_verified_payment(database, monkeypatch):
    monkeypatch.setenv("XENDIT_SECRET_KEY", "platform-subscription-key")
    result = await settings.qris_setup_status({"store_id": "store-a"})
    assert result == {"provider": "xendit", "credentialSource": "merchant_store", "flowVersion": 2, "active": True,
                      "apiKeyConfigured": False, "callbackTokenConfigured": True, "paymentVerified": False}
    import json
    assert "isolated-token-a" not in json.dumps(result)


@pytest.mark.asyncio
async def test_only_owner_can_manage_integration_secrets():
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as error:
        await settings.integration_owner({"role": "Cashier", "plan": "pro"})
    assert error.value.status_code == 403
    assert (await settings.integration_owner({"role": "Owner", "plan": "pro"}))["role"] == "Owner"
