"""Erasure scope/preview guards; real transaction checks live in the replica bench."""
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

import pytest
from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient
from pydantic import ValidationError

import account_erasure as erasure
import auth


run = asyncio.run


def verified_case(**changes):
    return erasure.ErasureCase(**{
        "user_id": "owner-a", "store_id": "store-a", "request_reference": "TEST-CASE-001",
        "identity_verification_reference": "disposable verified request",
        "retention_review_reference": "fixture with no retention requirement",
        "external_cleanup_reference": "fixture has no external copies",
        "writes_paused_reference": "isolated bench has no application traffic",
        "disposition": "erase_all_after_review", "audit_expires_at": datetime(2099, 1, 1, tzinfo=timezone.utc), **changes})


async def seed(db):
    await db.users.insert_many([
        {"id": "owner-a", "store_id": "store-a", "email": "owner-a@example.invalid", "password_hash": "private-hash"},
        {"id": "staff-a", "store_id": "store-a", "email": "staff-a@example.invalid"},
        {"id": "owner-b", "store_id": "store-ab", "email": "owner-b@example.invalid"}])
    await db.stores.insert_many([
        {"id": "store-a", "owner_user_id": "owner-a", "module": "geraina"},
        {"id": "store-ab", "owner_user_id": "owner-b", "module": "dapuros"}])
    await db.staff.insert_one({"id": "employee-a", "user_id": "staff-a", "store_id": "store-a"})
    for name in erasure.STORE_COLLECTIONS - {"staff", "checkout_attempts"}:
        await db[name].insert_many([
            {"id": name + "-a", "store_id": "store-a", "status": "paid"},
            {"id": name + "-b", "store_id": "store-ab", "module": "dapuros"}])
    await db.checkout_attempts.insert_one({"store_id": "store-a", "state": "prepared", "order_id": "orders-a"})
    await db.support_tickets.update_one({"store_id": "store-a"}, {"$set": {"user_id": "owner-a", "customer_email": "owner-a@example.invalid", "message": "private support body"}})
    await db.integrations.update_one({"store_id": "store-a"}, {"$set": {"secret_key": "private-provider-key"}})
    for name in ("counters", "capacity_guards"):
        await db[name].insert_many([{"_id": "store-a:products"}, {"_id": "store-ab:products"}])


@pytest.fixture
def shop():
    db = AsyncMongoMockClient().geraina_erasure_tests
    run(seed(db))
    return db


def test_preview_is_read_only_and_summary_never_contains_secrets(shop):
    before = run(shop.users.find({}).to_list(None))
    plan = run(erasure.prepare_erasure(shop, verified_case()))
    output = json.dumps(plan.summary()) + repr(plan)
    assert plan.counts["users"] == 2 and plan.counts["stores"] == 1
    assert plan.counts["counters"] == 1 and plan.counts["capacity_guards"] == 2
    assert not any(value in output for value in ("private-hash", "private-provider-key", "private support body", "@example.invalid"))
    assert run(shop.users.find({}).to_list(None)) == before


def test_complete_erasure_revokes_old_tokens_and_preserves_other_tenant(shop, monkeypatch):
    monkeypatch.setattr(auth, "get_db", lambda: shop)
    owner_token = auth.create_access_token("owner-a", "store-a", "Owner", "owner-a@example.invalid")
    staff_token = auth.create_access_token("staff-a", "store-a", "Cashier", "staff-a@example.invalid")
    other = run(shop.stores.find_one({"id": "store-ab"}))
    plan = run(erasure.prepare_erasure(shop, verified_case()))
    result = run(erasure.fulfill_erasure(shop, verified_case(), plan.digest))
    assert result["status"] == "primary-database-erased"
    assert run(shop.stores.find_one({"id": "store-ab"})) == other
    for name in erasure.STORE_COLLECTIONS:
        assert run(shop[name].count_documents({"store_id": "store-a"})) == 0
    assert run(shop.counters.find_one({"_id": "store-ab:products"})) is not None
    assert run(shop.capacity_guards.find_one({"_id": "store-a:products"})) is None
    for token in (owner_token, staff_token):
        with pytest.raises(HTTPException) as error:
            run(auth._decode_identity(token))
        assert error.value.status_code == 401
    assert run(shop.users.count_documents({"id": "owner-b"})) == 1
    assert run(erasure.fulfill_erasure(shop, verified_case(), plan.digest))["phase"] == "database_complete"


@pytest.mark.parametrize("mutation", [
    ("new_private_collection", {"store_id": "store-a", "private_data": "must-not-ignore"}),
    ("new_private_collection", {"user_id": "owner-a"}),
    ("subscription_orders", {"owner_id": "owner-a", "module": "geraina", "status": "paid"}),
    ("products", {"store_id": "store-a", "legal_hold": True}),
    ("products", {"store_id": "store-a", "retention_until": "2099-01-01"}),
    ("orders", {"store_id": "store-a", "payment_status": "pending"}),
    ("subscription_orders", {"store_id": "store-a", "status": "uncertain"}),
    ("checkout_attempts", {"store_id": "store-a", "state": "creating"}),
    ("checkout_attempts", {"store_id": "store-a", "state": "prepared", "order_id": "missing"}),
    ("products", {"store_id": "store-a", "module": "dapuros"}),
    ("orders", {"store_id": "store-ab", "cashier_id": "staff-a"}),
])
def test_ambiguous_or_retained_scopes_fail_without_mutation(shop, mutation):
    name, row = mutation
    run(shop[name].insert_one(dict(row)))
    before = run(shop.users.count_documents({}))
    with pytest.raises(erasure.ErasureBlocked):
        run(erasure.prepare_erasure(shop, verified_case()))
    assert run(shop.users.count_documents({})) == before
    assert run(shop.stores.count_documents({"id": "store-a"})) == 1


@pytest.mark.parametrize("field", ["id", "module", "owner_user_id"])
def test_wrong_store_or_owner_is_rejected(shop, field):
    run(shop.stores.update_one({"id": "store-a"}, {"$set": {field: "wrong"}}))
    with pytest.raises(erasure.ErasureBlocked):
        run(erasure.prepare_erasure(shop, verified_case()))


def test_preview_detects_changed_data_and_changed_case(shop):
    plan = run(erasure.prepare_erasure(shop, verified_case()))
    run(shop.products.update_one({"store_id": "store-a"}, {"$set": {"price": 123}}))
    with pytest.raises(erasure.ErasureBlocked, match="changed"):
        run(erasure.fulfill_erasure(shop, verified_case(), plan.digest))
    newer = run(erasure.prepare_erasure(shop, verified_case()))
    with pytest.raises(erasure.ErasureBlocked, match="changed"):
        run(erasure.fulfill_erasure(shop, verified_case(request_reference="TEST-CASE-002"), newer.digest))
    assert run(shop.users.count_documents({})) == 3


@pytest.mark.parametrize("digest", ["", "bad", None, "a" * 63])
def test_apply_requires_valid_preview_digest(shop, digest):
    with pytest.raises(erasure.ErasureBlocked):
        run(erasure.fulfill_erasure(shop, verified_case(), digest))


def test_case_does_not_accept_query_objects_or_unreviewed_disposition(shop):
    with pytest.raises(ValidationError):
        verified_case(user_id={"$ne": None})
    with pytest.raises(ValidationError):
        verified_case(store_id=".*")
    with pytest.raises(ValidationError):
        verified_case(identity_verification_reference="")
    with pytest.raises(ValidationError):
        verified_case(disposition="retain_unknown")


def test_missing_linked_account_is_not_silently_ignored(shop):
    run(shop.staff.insert_one({"id": "orphan-staff", "store_id": "store-a", "user_id": "missing-account"}))
    with pytest.raises(erasure.ErasureBlocked, match="Ambiguous"):
        run(erasure.prepare_erasure(shop, verified_case()))


@pytest.mark.parametrize("arguments", [["--apply"], ["--plan-digest", "a" * 64]])
def test_operator_command_needs_both_apply_and_digest_before_reading_case(arguments):
    env = {key: value for key, value in os.environ.items() if key not in ("MONGO_URL", "DB_NAME")}
    result = subprocess.run([sys.executable, str(Path(erasure.__file__).with_name("fulfill_account_erasure.py")),
                             "--case", "must-not-be-read.json", *arguments], env=env, capture_output=True, text=True, timeout=10)
    assert result.returncode == 2
    assert "Applying requires" in result.stderr and "Traceback" not in result.stderr


def test_operator_validation_does_not_echo_private_case_values(tmp_path):
    case = tmp_path / "private.json"
    case.write_text(json.dumps({"user_id": {"$ne": "private-case-value-do-not-log"}}), encoding="utf-8")
    env = {key: value for key, value in os.environ.items() if key not in ("MONGO_URL", "DB_NAME")}
    result = subprocess.run([sys.executable, str(Path(erasure.__file__).with_name("fulfill_account_erasure.py")),
                             "--case", str(case)], env=env, capture_output=True, text=True, timeout=10)
    assert result.returncode == 2
    assert "Invalid erasure case" in result.stderr
    assert "private-case-value-do-not-log" not in result.stdout + result.stderr
    assert "Traceback" not in result.stderr
