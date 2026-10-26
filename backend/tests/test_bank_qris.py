"""Bank QRIS tests use synthetic codes and isolated Mongo mocks; no payments or merchant writes."""
import asyncio
import binascii
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock

os.environ.setdefault("JWT_SECRET_KEY", "bank-qris-tests-only-secret-at-least-32-bytes")
os.environ.setdefault("ENV", "test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
import auth
import database
import routes_orders as orders
import routes_settings as settings
from bank_qris import inspect_static_qris

run = asyncio.run


def field(tag, value):
    return f"{tag}{len(value):02d}{value}"


def synthetic_qris(**changes):
    fields = {"00": "01", "01": "11", "26": field("00", "ID.CO.QRIS.WWW") + field("01", "TEST-ONLY-NOT-PAYABLE"), "52": "5999", "53": "360", "58": "ID", "59": "GERAINA TEST ONLY", "60": "JAKARTA", **changes}
    raw = "".join(field(k, v) for k, v in fields.items() if v is not None) + "6304"
    return raw + f"{binascii.crc_hqx(raw.encode(), 0xFFFF):04X}"


@pytest.mark.parametrize("changes", [{}, {"01": None}, {"59": "TOKO CAFÉ"}])
def test_valid_static_code_is_preserved_exactly(changes):
    payload = synthetic_qris(**changes)
    result = inspect_static_qris(payload)
    assert result["qr_payload"] == payload
    assert result["merchant_city"] == "JAKARTA"


@pytest.mark.parametrize("changes", [{"01": "12"}, {"54": "12500"}, {"53": "840"}, {"58": "US"}, {"52": "x"}, {"59": ""}, {"60": ""}, {"26": field("00", "NOT.QRIS")}, {"26": "0010SHORT"}])
def test_dynamic_foreign_fixed_amount_or_malformed_codes_are_rejected(changes):
    with pytest.raises(ValueError):
        inspect_static_qris(synthetic_qris(**changes))


@pytest.mark.parametrize("payload", ["https://example.test", synthetic_qris()[:-4] + "0000", synthetic_qris() + "5901X", synthetic_qris().replace("5999", "5998"), "0002010102115900", synthetic_qris().replace("GERAINA", "GER\nINA"), "000201" + "é" * 1100])
def test_corruption_duplicates_and_non_qris_images_are_rejected(payload):
    with pytest.raises(ValueError):
        inspect_static_qris(payload)


@pytest.fixture
def fixture(monkeypatch):
    db = AsyncMongoMockClient().bank_qris_tests
    user = {"id": "owner-a", "store_id": "store-a", "email": "bank-fixture@example.test", "role": "Owner", "plan": "trial"}
    app = FastAPI()
    app.include_router(settings.router); app.include_router(orders.router)
    app.dependency_overrides[auth.get_current_user] = lambda: user
    for module in (settings, orders, database):
        monkeypatch.setattr(module, "get_db", lambda: db)
    gateway = AsyncMock(side_effect=AssertionError("Bank QRIS must never call a gateway"))
    monkeypatch.setattr(orders, "create_qris", gateway)
    monkeypatch.setenv("XENDIT_SECRET_KEY", "platform-subscription-fixture-only")
    run(db.products.insert_one({"id": "product-a", "store_id": "store-a", "stock": 10, "price": 12500, "name": "Fixture coffee", "cost": 4000}))
    return db, user, TestClient(app), gateway


def configure(client, **changes):
    return client.post("/api/payments/bank-qris", json={"bank_name": "Bank fixture", "qr_payload": synthetic_qris(), "is_active": True, "merchant_confirmed": True, **changes})


def create(client, **changes):
    return client.post("/api/orders", json={"items": [{"product_id": "product-a", "name": "Fixture coffee", "price": 12500, "quantity": 1, "subtotal": 12500}], "payment_method": "qris_bank", **changes})


def confirm(client, order_id, **changes):
    return client.post(f"/api/orders/{order_id}/confirm-bank-qris", json={"checked_in_bank": True, "received_amount": "12500", "reference": "BANK-TEST-ONLY", **changes})


def test_setup_scoped_public_safe_and_requires_owner_attestation(fixture):
    db, user, client, _ = fixture
    assert client.get("/api/payments/bank-qris").json()["is_active"] is False
    assert configure(client, merchant_confirmed=False).status_code == 400
    assert configure(client, qr_payload="invalid").status_code == 400
    assert run(db.bank_qris_configs.count_documents({})) == 0
    result = configure(client)
    assert result.status_code == 200
    assert result.json()["merchant_name"] == "GERAINA TEST ONLY"
    assert "updated_by" not in result.json() and "store_id" not in result.json()
    user["role"] = "Cashier"
    assert configure(client).status_code == 403
    assert client.get("/api/payments/bank-qris").json()["qr_payload"] == synthetic_qris()
    user["store_id"] = "store-b"
    assert client.get("/api/payments/bank-qris").json()["qr_payload"] == ""


@pytest.mark.parametrize("changes", [{}, {"discount": 12500}, {"tax_percent": 0.001}, {"tax_percent": 100000}])
def test_unconfigured_or_invalid_total_does_not_change_stock_or_create_order(fixture, changes):
    db, _, client, gateway = fixture
    if changes:
        assert configure(client).status_code == 200
    assert create(client, **changes).status_code in (400, 422)
    assert run(db.products.find_one({"id": "product-a"}))["stock"] == 10
    assert run(db.orders.count_documents({})) == 0
    gateway.assert_not_awaited()


def test_bank_order_needs_no_gateway_and_keeps_original_destination_snapshot(fixture):
    db, _, client, gateway = fixture
    assert configure(client).status_code == 200
    response = create(client)
    assert response.status_code == 200
    order = response.json()
    assert order["payment_status"] == "pending"
    assert order["bank_qris"]["qr_payload"] == synthetic_qris()
    assert run(db.products.find_one({"id": "product-a"}))["stock"] == 9
    assert configure(client, qr_payload=synthetic_qris(**{"59": "DIFFERENT TEST MERCHANT"})).status_code == 200
    assert client.get(f'/api/orders/{order["id"]}').json()["bank_qris"]["qr_payload"] == synthetic_qris()
    assert client.post(f'/api/orders/{order["id"]}/mark-paid').status_code == 400
    gateway.assert_not_awaited()


@pytest.mark.parametrize("changes,status", [({"checked_in_bank": False}, 400), ({"received_amount": "12000"}, 400), ({"received_amount": "12500.01"}, 400), ({"checked_in_bank": "true"}, 422), ({"received_amount": "NaN"}, 422), ({"received_amount": "0"}, 422), ({"received_amount": "12500", "store_id": "store-b"}, 422)])
def test_confirmation_requires_explicit_bank_check_exact_total_and_strict_body(fixture, changes, status):
    db, _, client, _ = fixture
    configure(client); order = create(client).json()
    assert confirm(client, order["id"], **changes).status_code == status
    assert run(db.orders.find_one({"id": order["id"]}))["payment_status"] == "pending"


@pytest.mark.parametrize("role,store,cashier,status", [("Warehouse", "store-a", "owner-a", 403), ("Cashier", "store-a", "someone-else", 403), ("Owner", "store-b", "owner-a", 404), ("Cashier", "store-a", "owner-a", 200), ("Manager", "store-a", "owner-a", 200)])
def test_confirmation_role_store_and_cashier_scope(fixture, role, store, cashier, status):
    db, user, client, _ = fixture
    configure(client); order = create(client).json()
    run(db.orders.update_one({"id": order["id"]}, {"$set": {"cashier_id": cashier}}))
    user.update(role=role, store_id=store)
    assert confirm(client, order["id"]).status_code == status


def test_repeat_and_concurrent_confirmation_keep_first_audit_and_do_not_change_stock(fixture):
    db, user, client, _ = fixture
    configure(client); order = create(client).json()
    first = confirm(client, order["id"]).json()
    user["id"] = "another-owner"
    second = confirm(client, order["id"], reference="DO-NOT-REPLACE").json()
    assert first["payment_confirmation"] == second["payment_confirmation"]
    assert first["payment_confirmation"]["bank_verified"] is False
    assert run(db.products.find_one({"id": "product-a"}))["stock"] == 9
    # A simultaneous retry races on the same pending predicate; one audit wins.
    run(db.orders.update_one({"id": order["id"]}, {"$set": {"payment_status": "pending"}, "$unset": {"payment_confirmation": ""}}))
    from bank_qris import BankQrisConfirmation
    async def concurrent():
        return await asyncio.gather(*(orders.confirm_bank_qris(order["id"], BankQrisConfirmation(checked_in_bank=True, received_amount=12500, reference=str(i)), user) for i in range(8)))
    results = run(concurrent())
    assert len({row["payment_confirmation"]["reference"] for row in results}) == 1


@pytest.mark.parametrize("state", ["voided", "failed", "refunded"])
def test_closed_order_cannot_be_confirmed(fixture, state):
    db, _, client, _ = fixture
    configure(client); order = create(client).json()
    run(db.orders.update_one({"id": order["id"]}, {"$set": {"payment_status": state}}))
    assert confirm(client, order["id"]).status_code == 409


def test_disabling_qris_blocks_new_orders_but_keeps_existing_pending_payment(fixture):
    _, _, client, _ = fixture
    configure(client); order = create(client).json()
    assert configure(client, is_active=False, merchant_confirmed=False).status_code == 200
    assert create(client).status_code == 400
    assert confirm(client, order["id"]).status_code == 200
