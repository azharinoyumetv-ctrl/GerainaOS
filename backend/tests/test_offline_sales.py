"""Integration tests against an isolated, loopback-only MongoDB replica set."""
import asyncio
import copy
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import routes_offline as offline

USER = {"id": "cashier-a", "store_id": "store-a", "email": "cashier@example.invalid", "role": "Cashier"}


@pytest_asyncio.fixture
async def db(monkeypatch):
    connection = Path(__file__).resolve().parents[3] / "tmp/offline-mongo/connection.json"
    uri = json.loads(connection.read_text())["uri"]
    assert uri.startswith("mongodb://127.0.0.1:"), "Tests may only use the isolated loopback database"
    client = AsyncIOMotorClient(uri)
    name = "geraina_offline_test_" + uuid4().hex
    database = client[name]
    await database.products.insert_one({"id": "coffee", "store_id": "store-a", "name": "Coffee", "stock": 10})
    monkeypatch.setattr(offline, "get_db", lambda: database)
    yield database
    assert name.startswith("geraina_offline_test_")
    await client.drop_database(name)
    client.close()


def sale(**changes):
    value = {"expected_store_id": "store-a", "expected_cashier_id": "cashier-a", "client_order_id": str(uuid4()), "sold_at": datetime.now(timezone.utc).isoformat(), "payment_method": "cash", "items": [{"product_id": "coffee", "name": "Coffee", "price": 12500, "quantity": 2, "subtotal": 25000}], "discount": 1000, "tax_percent": 10, "cash_received": 30000}
    value.update(changes)
    return offline.OfflineCashSale(**value)


@pytest.mark.asyncio
async def test_replay_after_lost_response_changes_stock_once(db):
    payload = sale()
    first = await offline.synchronize_cash_sale(payload, USER)
    second = await offline.synchronize_cash_sale(payload, USER)
    assert first == second
    assert first["total"] == 26400 and first["change"] == 3600
    assert await db.orders.count_documents({}) == 1
    assert (await db.products.find_one({"id": "coffee"}))["stock"] == 8
    assert "_id" not in first and "offline_request_hash" not in first


@pytest.mark.asyncio
async def test_simultaneous_retries_are_idempotent(db):
    payload = sale()
    results = await asyncio.gather(*(offline.synchronize_cash_sale(payload, USER) for _ in range(6)))
    assert len({row["order_no"] for row in results}) == 1
    assert await db.orders.count_documents({}) == 1
    assert (await db.products.find_one({"id": "coffee"}))["stock"] == 8


@pytest.mark.asyncio
async def test_failure_after_insert_rolls_back_inventory_and_order(db, monkeypatch):
    async def fail(document, **options):
        await db.orders.insert_one(document, **options)
        raise RuntimeError("simulated interruption before commit")
    proxy = SimpleNamespace(client=db.client, counters=db.counters, products=db.products, stock_movements=db.stock_movements, orders=SimpleNamespace(find_one=db.orders.find_one, insert_one=fail))
    monkeypatch.setattr(offline, "get_db", lambda: proxy)
    with pytest.raises(RuntimeError):
        await offline.synchronize_cash_sale(sale(), USER)
    assert await db.orders.count_documents({}) == 0
    assert (await db.products.find_one({"id": "coffee"}))["stock"] == 10
    assert await db.counters.count_documents({}) == 0


@pytest.mark.asyncio
async def test_changed_replay_and_wrong_account_are_rejected(db):
    original = sale()
    await offline.synchronize_cash_sale(original, USER)
    changed = original.model_copy(update={"cash_received": 40000})
    with pytest.raises(HTTPException) as conflict:
        await offline.synchronize_cash_sale(changed, USER)
    assert conflict.value.status_code == 409
    for user in [{**USER, "store_id": "store-b"}, {**USER, "id": "cashier-b"}]:
        with pytest.raises(HTTPException) as denied:
            await offline.synchronize_cash_sale(original, user)
        assert denied.value.status_code == 403
    assert await db.orders.count_documents({}) == 1


@pytest.mark.asyncio
async def test_missing_product_preserves_actual_sale_with_inventory_warning(db):
    payload = sale()
    await db.products.delete_one({"id": "coffee"})
    result = await offline.synchronize_cash_sale(payload, USER)
    assert result["payment_status"] == "paid"
    assert result["inventory_warnings"] == [{"product_id": "coffee", "reason": "product_missing"}]


@pytest.mark.asyncio
@pytest.mark.parametrize("changes", [{"payment_method": "qris"}, {"cash_received": 1}, {"discount": 26000}])
async def test_invalid_or_electronic_offline_sale_makes_no_change(db, changes):
    with pytest.raises(HTTPException):
        await offline.synchronize_cash_sale(sale(**changes), USER)
    assert await db.orders.count_documents({}) == 0
    assert (await db.products.find_one({"id": "coffee"}))["stock"] == 10


@pytest.mark.asyncio
async def test_http_authentication_and_validation(db):
    app = FastAPI(); app.include_router(offline.router)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.post("/api/offline/orders", json=sale().model_dump(mode="json"))).status_code == 401
        app.dependency_overrides[offline.get_current_user] = lambda: {**USER, "role": "Warehouse"}
        assert (await client.post("/api/offline/orders", json=sale().model_dump(mode="json"))).status_code == 403
        app.dependency_overrides[offline.get_current_user] = lambda: USER
        assert (await client.post("/api/offline/orders", json={})).status_code == 422
        payload = sale().model_dump(mode="json")
        response = await client.post("/api/offline/orders", json=payload)
        assert response.status_code == 200 and response.json()["id"] == payload["client_order_id"]
