import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient
from pydantic import ValidationError

import account_erasure as erasure
import auth
from erasure_guard import guard_key
from erasure_inventory import EXTERNAL_STEPS
from test_account_erasure import seed, verified_case

run = asyncio.run


@pytest.fixture
def shop():
    db = AsyncMongoMockClient().workflow_tests
    run(seed(db))
    return db


def apply(db, case):
    plan = run(erasure.prepare_erasure(db, case))
    return run(erasure.fulfill_erasure(db, case, plan.digest))


def test_shared_owner_preserves_dapur_identity_and_entitlement(shop):
    run(shop.stores.insert_one({"id": "dapur-a", "owner_user_id": "owner-a", "module": "dapuros", "name": "Dapur fixture"}))
    run(shop.users.update_one({"id": "owner-a"}, {"$set": {
        "subscriptions": {"geraina": {"tier": "business"}, "dapuros": {"tier": "pro"}}, "credential_version": 17}}))
    original = run(shop.users.find_one({"id": "owner-a"}))
    result = apply(shop, verified_case())
    owner = run(shop.users.find_one({"id": "owner-a"}))
    assert result["identities_preserved_for_other_services"] == 1
    assert owner["email"] == original["email"] and owner["password_hash"] == original["password_hash"]
    assert owner["credential_version"] == 17 and owner["subscriptions"] == {"dapuros": {"tier": "pro"}}
    assert owner["store_id"] == "dapur-a"
    assert run(shop.stores.find_one({"id": "dapur-a"})) is not None
    assert run(shop.erasure_guards.find_one({"_id": guard_key("module", "owner-a", "geraina")}))["state"] == "erased"


def test_shared_identity_cannot_reenter_closed_geraina_but_can_resolve_dapur(shop, monkeypatch):
    run(shop.stores.insert_one({"id": "dapur-a", "owner_user_id": "owner-a", "module": "dapuros"}))
    apply(shop, verified_case())
    monkeypatch.setattr(auth, "get_db", lambda: shop)
    owner = run(shop.users.find_one({"id": "owner-a"}))
    with pytest.raises(HTTPException) as error:
        run(auth.resolve_user_context(owner, "geraina"))
    assert error.value.status_code == 401
    assert run(auth.resolve_user_context(owner, "dapuros"))["store_id"] == "dapur-a"


def test_duplicate_email_identity_requires_review(shop):
    run(shop.users.insert_one({"id": "duplicate", "store_id": "store-ab", "email": "owner-a@example.invalid"}))
    with pytest.raises(erasure.ErasureBlocked, match="Duplicate email"):
        run(erasure.prepare_erasure(shop, verified_case()))


def test_legacy_other_store_owner_is_preserved(shop):
    run(shop.stores.insert_one({"id": "legacy-other", "module": "dapuros", "name": "Legacy"}))
    run(shop.users.update_one({"id": "owner-a"}, {"$set": {"store_id": "legacy-other", "role": "Owner"}}))
    result = apply(shop, verified_case())
    assert result["identities_preserved_for_other_services"] == 1
    assert run(shop.users.find_one({"id": "owner-a"}))["store_id"] == "legacy-other"


def test_shared_staff_account_and_same_product_subscription_survive_membership_removal(shop):
    run(shop.stores.insert_one({"id": "owned-by-staff", "owner_user_id": "staff-a", "module": "geraina"}))
    run(shop.users.update_one({"id": "staff-a"}, {"$set": {"subscriptions": {"geraina": {"tier": "business"}}}}))
    result = apply(shop, verified_case(scope="staff", user_id="staff-a"))
    staff = run(shop.users.find_one({"id": "staff-a"}))
    assert result["identities_preserved_for_other_services"] == 1
    assert staff["store_id"] == "owned-by-staff"
    assert staff["subscriptions"]["geraina"]["tier"] == "business"
    assert run(shop.staff.count_documents({"store_id": "store-a", "user_id": "staff-a"})) == 0
    assert run(shop.stores.find_one({"id": "store-a"})).get("erasure_state") is None
    assert run(shop.users.find_one({"id": "owner-a"})) is not None


def test_staff_erasure_preserves_sales_amounts_and_removes_structured_identity(shop):
    run(shop.orders.update_one({"store_id": "store-a"}, {"$set": {"cashier_id": "staff-a",
        "cashier_email": "staff-a@example.invalid", "cashier_name": "Private Staff", "total": 12000,
        "payment_confirmation": {"confirmed_by": "staff-a", "confirmed_by_email": "staff-a@example.invalid"}}}))
    run(shop.attendance.update_one({"store_id": "store-a"}, {"$set": {"user_id": "staff-a", "staff_name": "Private Staff"}}))
    apply(shop, verified_case(scope="staff", user_id="staff-a"))
    order = run(shop.orders.find_one({"store_id": "store-a"}))
    assert order["total"] == 12000 and order["cashier_id"] == "deleted-staff"
    assert order["cashier_email"] == "" and order["cashier_name"] == "Staf dihapus"
    assert order["payment_confirmation"]["confirmed_by"] == "deleted-staff"
    assert run(shop.attendance.count_documents({"user_id": "staff-a"})) == 0
    assert run(shop.users.find_one({"id": "staff-a"})) is None
    assert run(shop.erasure_guards.find_one({"_id": guard_key("store", "store-a")}))["state"] == "active"


def test_retain_only_approved_minimum_fields_and_purge_at_expiry(shop):
    run(shop.orders.update_one({"store_id": "store-a"}, {"$set": {
        "total": 12000, "cashier_email": "secret@example.invalid", "customer_email": "customer@example.invalid",
        "note": "private text", "xendit_raw": {"secret": "never keep"},
        "items": [{"name": "Kopi", "quantity": 1, "price": 12000, "customer_email": "do-not-copy@example.invalid"}]}}))
    expiry = datetime.now(timezone.utc) + timedelta(days=7)
    case = verified_case(disposition="retain_minimum_after_review", retention_rules=[{
        "collection": "orders", "fields": ["total", "items", "created_at"], "reason": "Reviewed fixture accounting duty", "expires_at": expiry}])
    result = apply(shop, case)
    assert result["phase"] == "database_complete"
    vault = run(shop.erasure_retained.find_one({}))
    assert vault["payload"]["total"] == 12000
    assert not any(value in str(vault) for value in ("secret@example", "customer@example", "private text", "never keep", "do-not-copy"))
    assert run(erasure.purge_expired_retention(shop))["expired_retained_records_removed"] == 0
    # MongoMock expires TTL rows on access; disable its monitor for this
    # separate deterministic operator-purge check.
    run(shop.erasure_retained.drop_index("expires_at_1"))
    run(shop.erasure_retained.update_one({"_id": vault["_id"]}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}}))
    assert run(erasure.purge_expired_retention(shop))["expired_retained_records_removed"] == 1
    assert run(erasure.purge_expired_retention(shop))["expired_retained_records_removed"] == 0


@pytest.mark.parametrize("field", ["password_hash", "cashier_email", "customer_email", "note", "xendit_raw", "receipt", "bank_qris", "store_id"])
def test_retention_rejects_nonminimum_personal_and_secret_fields(field):
    with pytest.raises(ValidationError):
        verified_case(disposition="retain_minimum_after_review", retention_rules=[{
            "collection": "orders", "fields": [field], "reason": "fixture reason", "expires_at": "2098-01-01T00:00:00Z"}])


def test_retention_must_cover_existing_deadline(shop):
    run(shop.orders.update_one({"store_id": "store-a"}, {"$set": {"retention_until": "2098-05-01T00:00:00Z"}}))
    case = verified_case(disposition="retain_minimum_after_review", retention_rules=[{
        "collection": "orders", "fields": ["total"], "reason": "Reviewed obligation", "expires_at": "2098-01-01T00:00:00Z"}])
    with pytest.raises(erasure.ErasureBlocked, match="cannot shorten"):
        run(erasure.prepare_erasure(shop, case))


def test_begin_cancel_and_repeated_cancel_never_erase_data(shop):
    case = verified_case(); plan = run(erasure.prepare_erasure(shop, case))
    job = run(erasure.begin_erasure(shop, case, plan.digest))
    assert job["phase"] == "closing"
    assert run(shop.users.find_one({"id": "owner-a"}))["erasure_state"] == "closing"
    assert run(erasure.cancel_erasure(shop, case))["phase"] == "cancelled"
    assert run(erasure.cancel_erasure(shop, case))["phase"] == "cancelled"
    assert run(shop.users.find_one({"id": "owner-a"})).get("erasure_state") is None
    assert run(shop.orders.count_documents({"store_id": "store-a"})) == 1
    with pytest.raises(erasure.ErasureBlocked): run(erasure.resume_erasure(shop, case))


def test_resume_is_idempotent_and_committed_erasure_cannot_be_cancelled(shop):
    case = verified_case(); plan = run(erasure.prepare_erasure(shop, case))
    run(erasure.begin_erasure(shop, case, plan.digest))
    first = run(erasure.resume_erasure(shop, case))
    assert first == run(erasure.resume_erasure(shop, case))
    assert first == run(erasure.fulfill_erasure(shop, case, plan.digest))
    with pytest.raises(erasure.ErasureBlocked): run(erasure.cancel_erasure(shop, case))


def test_external_completion_requires_each_step_and_cannot_be_silently_changed(shop):
    case = verified_case(); result = apply(shop, case)
    assert set(result["external_steps"].values()) == {"pending"}
    for step in EXTERNAL_STEPS:
        result = run(erasure.acknowledge_external(shop, case, step, "disposable-evidence-" + step, "not_applicable"))
    assert result["phase"] == "complete"
    assert run(erasure.acknowledge_external(shop, case, "mail", "disposable-evidence-mail", "not_applicable")) == result
    with pytest.raises(erasure.ErasureBlocked):
        run(erasure.acknowledge_external(shop, case, "mail", "different evidence"))
    assert "disposable-evidence-mail" not in str(run(shop.erasure_jobs.find_one({})))


def test_case_reuse_cannot_change_subject_or_policy(shop):
    case = verified_case(); apply(shop, case)
    with pytest.raises(erasure.ErasureBlocked):
        run(erasure.get_job(shop, verified_case(retention_review_reference="different disposition")))


def test_backup_restore_replay_removes_reintroduced_records(shop):
    case = verified_case(); plan = run(erasure.prepare_erasure(shop, case))
    snapshot = {name: run(shop[name].find({}).to_list(None)) for name in run(shop.list_collection_names())}
    apply(shop, case)
    # Restore only erased primary records, keeping the durable closure receipt.
    for name, documents in snapshot.items():
        existing = {str(row["_id"]) for row in run(shop[name].find({}).to_list(None))}
        missing = [row for row in documents if str(row["_id"]) not in existing]
        if missing: run(shop[name].insert_many(missing))
    restored = run(erasure.prepare_erasure(shop, case))
    run(erasure.begin_erasure(shop, case, restored.digest, restore=True))
    assert run(erasure.resume_erasure(shop, case))["phase"] == "database_complete"
    assert run(shop.users.find_one({"id": "owner-a"})) is None
    assert run(shop.users.find_one({"id": "owner-b"})) is not None
