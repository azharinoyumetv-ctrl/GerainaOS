"""Shared credentials must never share a product's plan or trial clock."""
import asyncio
import copy
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

os.environ.setdefault("JWT_SECRET_KEY", "product-isolation-fixture-secret-at-least-32-bytes")
os.environ.setdefault("ENV", "test")
sys.path.insert(0, os.environ.get("ENTITLEMENT_BACKEND", str(Path(__file__).resolve().parents[1])))
import pytest
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
import auth
import routes_auth
import routes_pricing
from models import UserRegister

run = asyncio.run
NOW = datetime.now(timezone.utc)


@pytest.fixture
def account(monkeypatch):
    db = AsyncMongoMockClient().product_isolation
    monkeypatch.setattr(auth, "get_db", lambda: db)
    monkeypatch.setattr(routes_auth, "get_db", lambda: db)
    monkeypatch.setattr(routes_pricing, "get_db", lambda: db)
    app = FastAPI()
    app.include_router(routes_auth.router)
    @app.get("/operational")
    async def operational(token=Depends(auth.oauth2_scheme), module=Header(alias="X-DagangOS-Module")):
        # Exercise both product contexts; the edge routes each to its own backend.
        user = await auth.get_current_user(token, module, request=None)
        return routes_auth._user_public(user)
    return db, TestClient(app)


def seed(db, primary, *, target_age=3, legacy_plan="business", primary_days=2):
    other = "dapuros" if primary == "geraina" else "geraina"
    user = {"id":"owner", "email":"owner@example.invalid", "role":"Owner", "store_id":primary,
            "plan":legacy_plan, "trial_ends_at":(NOW + timedelta(days=primary_days)).isoformat(),
            "subscriptions":{primary:{"tier":"business", "status":"active", "expires_at":(NOW+timedelta(days=40)).isoformat()}}}
    run(db.users.insert_one(copy.deepcopy(user)))
    run(db.stores.insert_many([
        {"id":primary,"module":primary,"owner_user_id":"owner","created_at":(NOW-timedelta(days=12)).isoformat()},
        {"id":other,"module":other,"owner_user_id":"owner","created_at":(NOW-timedelta(days=target_age)).isoformat()},
    ]))
    token = auth.create_access_token("owner", primary, "Owner", user["email"])
    return user, other, {"Authorization":"Bearer "+token,"X-DagangOS-Module":other}


@pytest.mark.parametrize("primary", ["geraina", "dapuros"])
def test_other_product_gets_its_own_trial_not_global_paid_tier(account, primary):
    db, client = account
    _, other, headers = seed(db, primary)
    response = client.get("/operational", headers=headers)
    assert response.status_code == 200
    result = response.json()
    assert result["plan"] == "trial"
    assert result["subscription"] is None
    assert datetime.fromisoformat(result["trial_ends_at"]) == NOW + timedelta(days=11)
    assert client.get("/operational", headers={**headers,"X-DagangOS-Module":primary}).json()["plan"] == "business"


@pytest.mark.parametrize("primary", ["geraina", "dapuros"])
@pytest.mark.parametrize("legacy_plan", ["business", "trial", "expired"])
def test_expired_other_product_cannot_borrow_active_global_access(account, primary, legacy_plan):
    db, client = account
    before, _, headers = seed(db, primary, target_age=20, legacy_plan=legacy_plan)
    assert client.get("/operational", headers=headers).status_code == 402
    saved = run(db.users.find_one({"id":"owner"}))
    for key in ("plan","trial_ends_at","subscriptions"):
        assert saved[key] == before[key]
    assert client.get("/operational", headers={**headers,"X-DagangOS-Module":primary}).status_code == 200


@pytest.mark.parametrize("primary", ["geraina", "dapuros"])
def test_each_product_uses_only_its_own_paid_tier_and_expiry(account, primary):
    db, client = account
    _, other, headers = seed(db, primary)
    own_end = (NOW+timedelta(days=6)).isoformat()
    run(db.users.update_one({"id":"owner"},{"$set":{f"subscriptions.{other}":{"tier":"starter","status":"active","expires_at":own_end}}}))
    result = client.get("/operational",headers=headers).json()
    assert result["plan"] == "starter"
    assert result["subscription"]["expires_at"] == own_end


@pytest.mark.parametrize("primary", ["geraina", "dapuros"])
def test_activation_starts_one_trial_clock_without_resetting_existing_product(account, primary):
    db, _ = account
    user, other, _ = seed(db, primary)
    run(db.stores.delete_one({"id":other}))
    store = run(routes_auth._create_store(db, "owner", "Other Product", other))
    assert store["plan"] == "trial"
    start = datetime.fromisoformat(store["trial_started_at"])
    end = datetime.fromisoformat(store["trial_ends_at"])
    assert timedelta(days=14) == end-start
    assert start >= NOW
    assert run(db.users.find_one({"id":"owner"}))["trial_ends_at"] == user["trial_ends_at"]


@pytest.mark.parametrize("primary", ["geraina", "dapuros"])
def test_missing_trial_evidence_does_not_grant_a_free_paid_plan(account, primary):
    db, client = account
    _, other, headers = seed(db, primary)
    run(db.stores.update_one({"id":other},{"$unset":{"created_at":""}}))
    assert client.get("/operational",headers=headers).status_code == 402


@pytest.mark.parametrize("tier", ["trial", "starter", "pro", "business"])
def test_legacy_upgrade_cannot_rewrite_shared_account_entitlements(account, tier):
    db, _ = account
    before, _, _ = seed(db, "geraina")
    with pytest.raises(HTTPException) as blocked:
        run(routes_pricing.upgrade_plan({"tier_id":tier}, before))
    assert blocked.value.status_code == 409
    saved = run(db.users.find_one({"id":"owner"}))
    assert saved["plan"] == before["plan"]
    assert saved["subscriptions"] == before["subscriptions"]


@pytest.mark.parametrize("primary", ["geraina", "dapuros"])
def test_unlabelled_legacy_store_is_never_shared_between_products(account, primary):
    db, client = account
    _, other, headers = seed(db, primary)
    run(db.stores.delete_one({"id":other}))
    run(db.stores.update_one({"id":primary},{"$unset":{"module":""}}))
    run(db.users.update_one({"id":"owner"},{"$set":{"primary_module":primary}}))
    assert client.get("/operational",headers=headers).status_code == 409
    assert client.get("/operational",headers={**headers,"X-DagangOS-Module":primary}).json()["plan"] == "business"


@pytest.mark.parametrize("primary", ["geraina", "dapuros"])
def test_ambiguous_legacy_store_requires_product_verification(account, primary):
    db, client = account
    _, other, headers = seed(db, primary)
    run(db.stores.delete_one({"id":other}))
    run(db.stores.update_one({"id":primary},{"$unset":{"module":""}}))
    for module in (primary,other):
        response=client.get("/operational",headers={**headers,"X-DagangOS-Module":module})
        assert response.status_code == 409
        assert response.json()["detail"] == "legacy_store_module_unverified"
