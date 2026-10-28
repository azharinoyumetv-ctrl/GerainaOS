"""Offline payment/account integration tests; never contact a gateway or real DB."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock

os.environ["JWT_SECRET_KEY"] = "subscription-tests-only-secret-at-least-32-bytes"
os.environ["ENV"] = "test"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

import auth
import billing_subscriptions as billing
import routes_auth
import routes_subscriptions
from subscription_state import apply_subscription

OWNER = "11111111-1111-4111-8111-111111111111"
STORE = "22222222-2222-4222-8222-222222222222"
ORDER = "DG-geraina-" + "a" * 32
NOW = datetime.now(timezone.utc)
run = asyncio.run


@pytest.fixture
def account(monkeypatch):
    db = AsyncMongoMockClient().billing_tests
    user = {"id": OWNER, "email": "owner@example.test", "role": "Owner", "store_id": STORE, "current_module": "geraina", "plan": "trial", "trial_ends_at": (NOW + timedelta(days=14)).isoformat()}
    run(db.users.insert_one(user.copy()))
    run(db.stores.insert_one({"id": STORE, "owner_user_id": OWNER, "module": "geraina"}))
    for module in (billing, auth, routes_auth, routes_subscriptions):
        monkeypatch.setattr(module, "get_db", lambda: db)
    return db, user


def prepare(user, order=ORDER, tier="starter", period="monthly"):
    run(billing.prepare_order({"orderId": order, "tier": tier, "period": period, "amount": 1, "owner_id": "attacker"}, user))
    run(billing.attach_reference(order, "test-reference-" + order + "-signed-by-portal", user))


def payment(order=ORDER, tier="starter", period="monthly", state="paid", at=NOW):
    return {"orderId": order, "ownerId": OWNER, "storeId": STORE, "module": "geraina", "tier": tier, "period": period, "amount": billing.PRICES["geraina"][tier][period == "yearly"], "status": state, "paidAt": at.isoformat()}


def test_paid_order_activates_correct_account_and_product_only(account, monkeypatch):
    db, user = account
    prepare(user)
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment()))
    result = run(billing.reconcile_order(ORDER))
    saved = run(db.users.find_one({"id": OWNER}))
    assert result["activation"] == "active"
    assert apply_subscription(saved, "geraina")["plan"] == "starter"
    assert apply_subscription(saved, "dapuros")["plan"] == "trial"
    assert run(db.stores.find_one({"id": STORE}))["plan"] == "starter"
    assert saved["plan"] == "trial"  # no global upgrade leaking into another product


def test_duplicate_notifications_and_status_refreshes_do_not_extend_subscription(account, monkeypatch):
    db, user = account
    prepare(user)
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment()))
    results = [run(billing.reconcile_order(ORDER)) for _ in range(4)]
    assert len({result["expires_at"] for result in results}) == 1
    assert run(db.subscription_orders.count_documents({"_id": ORDER})) == 1
    assert run(db.users.find_one({"id": OWNER}))["subscriptions"]["geraina"]["order_id"] == ORDER


@pytest.mark.parametrize("state", ["pending", "failed", "refunded"])
def test_unpaid_or_reversed_order_cannot_activate(account, monkeypatch, state):
    db, user = account
    prepare(user)
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment(state=state)))
    run(billing.reconcile_order(ORDER))
    assert "subscriptions" not in run(db.users.find_one({"id": OWNER}))


@pytest.mark.parametrize("field,value", [("amount", 1), ("ownerId", "attacker"), ("storeId", "other"), ("module", "dapuros"), ("orderId", "other")])
def test_mismatched_payment_proof_cannot_grant_access(account, monkeypatch, field, value):
    db, user = account
    prepare(user)
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value={**payment(), field: value}))
    with pytest.raises(HTTPException) as error:
        run(billing.reconcile_order(ORDER))
    assert error.value.status_code == 502
    assert "subscriptions" not in run(db.users.find_one({"id": OWNER}))


def test_older_payment_and_older_refund_cannot_overwrite_new_purchase(account, monkeypatch):
    db, user = account
    newer = "DG-geraina-" + "b" * 32
    prepare(user)
    prepare(user, newer, "pro")
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment(newer, "pro", at=NOW + timedelta(seconds=1))))
    run(billing.reconcile_order(newer))
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment()))
    assert run(billing.reconcile_order(ORDER))["activation"] == "superseded"
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment(state="refunded")))
    run(billing.reconcile_order(ORDER))
    assert apply_subscription(run(db.users.find_one({"id": OWNER})), "geraina")["plan"] == "pro"
    assert run(db.stores.find_one({"id": STORE}))["subscription"]["order_id"] == newer


def test_refund_revokes_only_the_purchase_that_granted_current_access(account, monkeypatch):
    db, user = account
    prepare(user)
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment()))
    run(billing.reconcile_order(ORDER))
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment(state="refunded")))
    run(billing.reconcile_order(ORDER))
    saved = run(db.users.find_one({"id": OWNER}))
    assert apply_subscription(saved, "geraina")["plan"] == "expired"
    assert apply_subscription(saved, "dapuros")["plan"] == "trial"


def test_existing_active_package_prevents_duplicate_payment(account, monkeypatch):
    db, user = account
    prepare(user)
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment()))
    run(billing.reconcile_order(ORDER))
    saved = run(db.users.find_one({"id": OWNER}))
    with pytest.raises(HTTPException) as error:
        prepare({**user, "subscriptions": saved["subscriptions"]}, "DG-geraina-" + "c" * 32)
    assert error.value.detail["code"] == "subscription_active"
    assert run(db.subscription_orders.count_documents({})) == 1


def test_expiry_and_calendar_terms_are_enforced(account):
    _, user = account
    assert billing.term_end(datetime(2028, 1, 31, tzinfo=timezone.utc), "monthly").day == 29
    assert billing.term_end(datetime(2028, 2, 29, tzinfo=timezone.utc), "yearly").day == 28
    expired = {**user, "subscriptions": {"geraina": {"tier": "business", "status": "active", "expires_at": (NOW - timedelta(seconds=1)).isoformat()}}}
    assert apply_subscription(expired, "geraina")["plan"] == "expired"


def test_api_binds_order_to_authenticated_owner_and_does_not_trust_browser_paid_status(account, monkeypatch):
    db, user = account
    app = FastAPI()
    app.include_router(routes_subscriptions.router)
    app.include_router(routes_auth.router)
    token = auth.create_access_token(OWNER, STORE, "Owner", user["email"])
    headers = {"Authorization": "Bearer " + token, "X-DagangOS-Module": "geraina"}
    with TestClient(app) as client:
        assert client.post("/api/subscriptions/orders", json={"orderId": ORDER, "tier": "starter", "period": "monthly"}).status_code == 401
        response = client.post("/api/subscriptions/orders", headers=headers, json={"orderId": ORDER, "tier": "starter", "period": "monthly", "amount": 1, "owner_id": "attacker"})
        assert response.status_code == 200
        assert response.json()["owner_id"] == OWNER
        assert response.json()["amount"] == 149000
        run(billing.attach_reference(ORDER, "test-reference-" + ORDER + "-signed-by-portal", user))
        monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment(state="pending")))
        result = client.post("/api/subscriptions/reconcile", json={"orderId": ORDER, "status": "paid", "owner_id": "attacker"})
        assert result.status_code == 200
        assert result.json()["status"] == "pending"
        assert client.get("/api/auth/me", headers=headers).json()["plan"] == "trial"
        monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment()))
        assert client.post("/api/subscriptions/reconcile", json={"orderId": ORDER}).json()["activation"] == "active"
        assert client.get("/api/auth/me", headers=headers).json()["plan"] == "starter"


def test_payment_service_outage_does_not_break_login_or_grant_access(account, monkeypatch):
    db, user = account
    prepare(user)
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(side_effect=httpx.ConnectError("offline")))
    run(billing.reconcile_pending(user, "geraina"))
    assert "subscriptions" not in run(db.users.find_one({"id": OWNER}))


def test_paid_access_is_enforced_by_real_auth_and_expires_per_product(account, monkeypatch):
    db, user = account
    run(db.users.update_one({"id": OWNER}, {"$set": {"plan": "expired"}}))
    prepare(user)
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment()))
    run(billing.reconcile_order(ORDER))
    token = auth.create_access_token(OWNER, STORE, "Owner", user["email"])
    assert run(auth.get_current_user(token, "geraina"))["plan"] == "starter"
    run(db.stores.insert_one({"id": "other-store", "owner_user_id": OWNER, "module": "dapuros"}))
    with pytest.raises(HTTPException) as other_product:
        run(auth.get_current_user(token, "dapuros"))
    assert other_product.value.status_code == 402
    run(db.users.update_one({"id": OWNER}, {"$set": {"subscriptions.geraina.expires_at": (NOW - timedelta(seconds=1)).isoformat()}}))
    with pytest.raises(HTTPException) as expired:
        run(auth.get_current_user(token, "geraina"))
    assert expired.value.status_code == 402


def test_dapuros_yearly_payment_activates_its_own_catalog_tier(account, monkeypatch):
    db, user = account
    run(db.stores.update_one({"id": STORE}, {"$set": {"module": "dapuros"}}))
    user = {**user, "current_module": "dapuros"}
    order = "DG-dapuros-" + "d" * 32
    prepare(user, order, "business", "yearly")
    proof = {**payment(order, "business", "yearly"), "module": "dapuros", "amount": 7490000}
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=proof))
    result = run(billing.reconcile_order(order))
    saved = run(db.users.find_one({"id": OWNER}))
    assert result["activation"] == "active"
    assert apply_subscription(saved, "dapuros")["plan"] == "business"
    assert apply_subscription(saved, "geraina")["plan"] == "trial"
    assert datetime.fromisoformat(result["expires_at"]) == billing.term_end(NOW, "yearly")


def billing_client(user):
    app = FastAPI()
    app.include_router(routes_subscriptions.router)
    token = auth.create_access_token(user["id"], user["store_id"], user["role"], user["email"])
    return TestClient(app), {"Authorization": "Bearer " + token, "X-DagangOS-Module": "geraina"}


def activate(account, monkeypatch):
    db, user = account
    prepare(user)
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment()))
    run(billing.reconcile_order(ORDER))
    return db, user


def test_stop_retains_paid_access_survives_webhook_retries_and_can_be_undone(account, monkeypatch):
    db, user = activate(account, monkeypatch)
    with billing_client(user)[0] as client:
        headers = billing_client(user)[1]
        before = client.get("/api/subscriptions/current", headers=headers).json()
        assert before["billing_model"] == "prepaid" and before["auto_renew"] is False
        assert before["can_manage"] is True
        for _ in range(2):
            stopped = client.post("/api/subscriptions/cancel", headers=headers, json={"orderId": ORDER, "confirm": True})
            assert stopped.status_code == 200, stopped.text
            assert stopped.json()["subscription"]["cancel_at_period_end"] is True
            assert stopped.json()["subscription"]["active"] is True
            assert stopped.json()["subscription"]["expires_at"] == before["subscription"]["expires_at"]
        run(billing.reconcile_order(ORDER))
        current = client.get("/api/subscriptions/current", headers=headers).json()["subscription"]
        assert current["cancel_at_period_end"] is True
        assert run(auth.get_current_user(headers["Authorization"][7:], "geraina"))["plan"] == "starter"
        assert run(db.stores.find_one({"id": STORE}))["subscription"]["status"] == "active"
        resumed = client.post("/api/subscriptions/resume", headers=headers, json={"orderId": ORDER, "confirm": True})
        assert resumed.status_code == 200
        assert resumed.json()["subscription"]["cancel_at_period_end"] is False
        assert resumed.json()["auto_renew"] is False  # undoing the notice cannot authorize auto-debit


def test_stop_requires_owner_confirmation_current_order_and_does_not_touch_other_products(account, monkeypatch):
    db, user = activate(account, monkeypatch)
    run(db.users.update_one({"id": OWNER}, {"$set": {"subscriptions.dapuros": {"tier": "pro", "status": "active", "expires_at": (NOW + timedelta(days=20)).isoformat()}}}))
    with billing_client(user)[0] as client:
        headers = billing_client(user)[1]
        assert client.post("/api/subscriptions/cancel", json={"orderId": ORDER, "confirm": True}).status_code == 401
        for payload in ({"orderId": ORDER}, {"orderId": ORDER, "confirm": "true"}):
            assert client.post("/api/subscriptions/cancel", headers=headers, json=payload).status_code == 400
        assert client.post("/api/subscriptions/cancel", headers=headers, json={"orderId": "DG-geraina-" + "e" * 32, "confirm": True}).status_code == 409
        assert client.post("/api/subscriptions/cancel", headers=headers, json={"orderId": ORDER, "confirm": True}).status_code == 200
    saved = run(db.users.find_one({"id": OWNER}))
    assert apply_subscription(saved, "dapuros")["plan"] == "pro"
    for role in ("Manager", "Cashier", "Warehouse"):
        employee = {**user, "id": role.lower(), "email": role.lower() + "@example.test", "role": role, "credential_version": 0}
        run(db.users.insert_one(employee))
        run(db.staff.insert_one({"id": "staff-" + role, "user_id": employee["id"], "store_id": STORE, "role": role, "status": "Aktif"}))
        with billing_client(employee)[0] as client:
            assert client.post("/api/subscriptions/cancel", headers=billing_client(employee)[1], json={"orderId": ORDER, "confirm": True}).status_code == 403
    run(db.stores.update_one({"id": STORE}, {"$set": {"owner_user_id": "another-owner"}}))
    with billing_client(user)[0] as client:
        assert client.post("/api/subscriptions/resume", headers=billing_client(user)[1], json={"orderId": ORDER, "confirm": True}).status_code == 401


def test_stopped_term_expires_normally_and_new_purchase_has_no_old_stop_flag(account, monkeypatch):
    db, user = activate(account, monkeypatch)
    with billing_client(user)[0] as client:
        headers = billing_client(user)[1]
        assert client.post("/api/subscriptions/cancel", headers=headers, json={"orderId": ORDER, "confirm": True}).status_code == 200
        run(db.users.update_one({"id": OWNER}, {"$set": {"subscriptions.geraina.expires_at": (NOW - timedelta(seconds=1)).isoformat()}}))
        assert client.get("/api/subscriptions/current", headers=headers).json()["subscription"]["active"] is False
        assert client.post("/api/subscriptions/resume", headers=headers, json={"orderId": ORDER, "confirm": True}).status_code == 409
    assert apply_subscription(run(db.users.find_one({"id": OWNER})), "geraina")["plan"] == "expired"
    newer = "DG-geraina-" + "c" * 32
    prepare(user, newer, "pro")
    monkeypatch.setattr(billing, "fetch_payment_status", AsyncMock(return_value=payment(newer, "pro", at=NOW + timedelta(seconds=1))))
    run(billing.reconcile_order(newer))
    subscription = apply_subscription(run(db.users.find_one({"id": OWNER})), "geraina")["subscription"]
    assert subscription["active"] is True and subscription["cancel_at_period_end"] is False


def test_changing_billing_period_exposes_current_term_for_explicit_purchase_confirmation(account, monkeypatch):
    db, user = activate(account, monkeypatch)
    fresh = run(db.users.find_one({"id": OWNER}))
    result = run(billing.prepare_order({"orderId": "DG-geraina-" + "f" * 32, "tier": "starter", "period": "yearly"}, {**user, "subscriptions": fresh["subscriptions"]}))
    assert result["active_subscription"]["tier"] == "starter"
    assert result["active_subscription"]["expires_at"] == fresh["subscriptions"]["geraina"]["expires_at"]
    assert result["amount"] == 1490000


def test_manual_business_grant_has_real_expiry_and_shared_store_access(account):
    db, user = account
    grant = {"tier": "business", "status": "active", "expires_at": "2099-11-10T13:01:19+00:00", "source": "manual_grant"}
    run(db.users.update_one({"id": OWNER}, {"$set": {"trial_ends_at": (NOW - timedelta(days=1)).isoformat(), "subscriptions.geraina": grant}}))
    run(db.stores.update_one({"id": STORE}, {"$set": {"subscription": grant, "plan": "business"}}))
    context = run(auth.resolve_user_context(run(db.users.find_one({"id": OWNER})), "geraina"))
    view = run(routes_subscriptions.billing_view(context))
    assert context["plan"] == view["plan"] == "business"
    assert view["subscription"]["active"] is True
    assert view["subscription"]["expires_at"] == grant["expires_at"]
    outlet = next(offer for offer in view["addons"]["offers"] if offer["id"] == "extra_outlet")
    assert outlet["eligible"] is True
    assert run(db.subscription_orders.count_documents({})) == 0  # no fabricated purchase
    assert apply_subscription(run(db.users.find_one({"id": OWNER})), "dapuros")["plan"] != "business"
    employee = {"id": "grant-cashier", "email": "cashier@example.test", "role": "Cashier", "store_id": STORE, "credential_version": 0}
    run(db.users.insert_one(employee.copy()))
    run(db.staff.insert_one({"id": "grant-staff", "user_id": employee["id"], "store_id": STORE, "role": "Cashier", "status": "Aktif"}))
    staff = run(auth.resolve_user_context(employee, "geraina"))
    assert staff["plan"] == "business" and staff["subscription"]["expires_at"] == grant["expires_at"]
    assert staff["is_store_owner"] is False
