"""Durable, scoped support fulfillment. No public destructive endpoint."""
import hashlib
import os
import re
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Literal

from bson import json_util
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

import transactions
from erasure_guard import INTERNAL, guard_key, touch_active
from erasure_inventory import (STORE_COLLECTIONS, IDENTITY_FIELDS, PERSONAL_COLLECTIONS,
                               RETENTION_FIELDS, ITEM_FIELDS, EXTERNAL_STEPS)


class ErasureBlocked(ValueError): pass


def now(): return datetime.now(timezone.utc)
def _canonical(value): return json_util.dumps(value, sort_keys=True, separators=(",", ":"))
def sha(value): return hashlib.sha256(_canonical(value).encode()).hexdigest()


class RetentionRule(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    collection: str
    fields: list[str] = Field(min_length=1, max_length=30)
    reason: str = Field(min_length=3, max_length=240)
    expires_at: datetime

    @field_validator("expires_at")
    @classmethod
    def aware(cls, value):
        if value.tzinfo is None: raise ValueError("A timezone is required")
        return value.astimezone(timezone.utc)

    @model_validator(mode="after")
    def minimum_fields(self):
        if (self.collection not in RETENTION_FIELDS
                or not set(self.fields) <= RETENTION_FIELDS[self.collection]
                or len(set(self.fields)) != len(self.fields)):
            raise ValueError("Only the reviewed minimum financial/time fields can be retained")
        return self


class ErasureCase(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    user_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,128}$")
    store_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,128}$")
    scope: Literal["store", "staff"] = "store"
    request_reference: str = Field(min_length=3, max_length=160)
    identity_verification_reference: str = Field(min_length=3, max_length=240)
    retention_review_reference: str = Field(min_length=3, max_length=240)
    external_cleanup_reference: str = Field(default="", max_length=240)
    writes_paused_reference: str = Field(default="", max_length=240)  # Legacy case compatibility; never used as a lock.
    disposition: Literal["erase_all_after_review", "retain_minimum_after_review"]
    retention_rules: list[RetentionRule] = Field(default_factory=list, max_length=20)
    audit_expires_at: datetime

    @field_validator("audit_expires_at")
    @classmethod
    def audit_aware(cls, value):
        if value.tzinfo is None: raise ValueError("A timezone is required")
        return value.astimezone(timezone.utc)

    @model_validator(mode="after")
    def policy_consistent(self):
        if bool(self.retention_rules) != (self.disposition == "retain_minimum_after_review"):
            raise ValueError("Retention disposition and rules must agree")
        if len({rule.collection for rule in self.retention_rules}) != len(self.retention_rules):
            raise ValueError("One retention rule per collection")
        if any(rule.expires_at > self.audit_expires_at for rule in self.retention_rules):
            raise ValueError("Audit/recovery evidence must outlive retained data")
        if self.scope == "staff" and any(rule.collection not in PERSONAL_COLLECTIONS for rule in self.retention_rules):
            raise ValueError("Staff-only retention applies to personal time records; merchant sales remain de-identified in place")
        return self


def case_key(case):
    return sha([case.request_reference, case.user_id, case.store_id, case.scope])


def case_sha(case): return sha(case.model_dump(mode="json"))


def clean(row):
    return {key: value for key, value in row.items() if key not in ("erasure_state", "erasure_job")}


async def rows(db, name, query, session=None):
    return await db[name].find(query, session=session).to_list(None)


def linked_query(identities, emails=()):
    return {"$or": [*[{key: {"$in": list(identities)}} for key in IDENTITY_FIELDS],
                    *[{key: {"$in": list(emails)}} for key in ("email", "customer_email", "cashier_email")]]}


def redact_staff(value, identities, emails):
    """Remove structured staff attribution, preserving the merchant's amounts."""
    if isinstance(value, list): return [redact_staff(item, identities, emails) for item in value]
    if not isinstance(value, dict): return value
    attributed = any(value.get(key) in identities for key in IDENTITY_FIELDS if isinstance(value.get(key), str))
    result = {}
    for key, item in value.items():
        if key in IDENTITY_FIELDS and isinstance(item, str) and item in identities:
            result[key] = "deleted-staff"
        elif key in ("cashier_email", "staff_email", "actor_email", "confirmed_by_email") and (attributed or (isinstance(item, str) and item in emails)):
            result[key] = ""
        elif key in ("cashier_name", "staff_name", "actor_name", "confirmed_by_name") and attributed:
            result[key] = "Staf dihapus"
        else:
            result[key] = redact_staff(item, identities, emails)
    return result


@dataclass
class ErasurePlan:
    digest: str
    counts: dict
    records: dict = field(repr=False)
    updates: dict = field(repr=False)
    removed_accounts: list = field(repr=False)
    kept_accounts: list = field(repr=False)
    keys: list = field(repr=False)

    def summary(self):
        return {"status": "scope-prepared", "digest": self.digest, "counts": self.counts,
                "total_records": sum(self.counts.values()), "identities_removed": len(self.removed_accounts),
                "identities_preserved_for_other_services": len(self.kept_accounts),
                "records_with_staff_attribution_removed": sum(len(value) for value in self.updates.values())}


async def prepare_erasure(db, case, session=None, collection_names=None):
    if collection_names is None:
        if session is not None: raise ErasureBlocked("Inventory must be captured before the transaction")
        collection_names = await db.list_collection_names()
    accounts = await rows(db, "users", {"id": case.user_id}, session)
    stores = await rows(db, "stores", {"id": case.store_id}, session)
    if len(accounts) != 1 or len(stores) != 1:
        raise ErasureBlocked("Exactly one existing account and store must match; no data changed.")
    store = stores[0]
    if store.get("module") != "geraina": raise ErasureBlocked("An explicit Geraina store is required.")
    if store.get("legal_hold"): raise ErasureBlocked("An indefinite store hold requires review first.")
    if store.get("erasure_job") not in (None, case_key(case)):
        raise ErasureBlocked("Another closure case owns this store.")
    staff = await rows(db, "staff", {"store_id": case.store_id}, session)
    if case.scope == "store":
        if store.get("owner_user_id") != case.user_id:
            raise ErasureBlocked("Verified store-owner authority is required.")
        ids = {case.user_id} | {row["user_id"] for row in staff if row.get("user_id")}
        accounts = await rows(db, "users", {"$or": [{"store_id": case.store_id}, {"id": {"$in": sorted(ids)}}]}, session)
        if ids - {row.get("id") for row in accounts}: raise ErasureBlocked("Ambiguous linked account identities.")
    else:
        if store.get("owner_user_id") == case.user_id:
            raise ErasureBlocked("A store owner cannot use the staff-only scope.")
        staff = [row for row in staff if row.get("user_id") == case.user_id or row.get("id") == case.user_id]
        if not staff: raise ErasureBlocked("No staff membership matches the verified account.")
    ids = {row.get("id") for row in accounts}
    if None in ids or len(ids) != len(accounts): raise ErasureBlocked("Ambiguous linked account identities.")
    emails = {row["email"] for row in accounts if isinstance(row.get("email"), str)}
    if await db.users.find_one({"email": {"$in": sorted(emails)}, "id": {"$nin": sorted(ids)}}, session=session):
        raise ErasureBlocked("Duplicate email identities need an ownership review before erasure.")
    records, updates = {}, {}
    for name in STORE_COLLECTIONS:
        query = {"store_id": case.store_id}
        if name == "capacity_guards":
            query = {"$or": [query, {"_id": {"$regex": "^" + re.escape(case.store_id) + ":"}}]}
        selected = await rows(db, name, query, session)
        if any(row.get("module") not in (None, "geraina") for row in selected):
            raise ErasureBlocked("Conflicting product scope found.")
        if case.scope == "staff":
            if name in PERSONAL_COLLECTIONS:
                selected = [row for row in selected if (row.get("user_id") in ids or row.get("id") in ids
                            or row.get("staff_id") in {s.get("id") for s in staff}
                            or (name == "staff" and row.get("_id") in {s["_id"] for s in staff}))]
            else:
                replacements = []
                for row in selected:
                    replacement = redact_staff(row, ids | {s.get("id") for s in staff}, emails)
                    if replacement != row: replacements.append(replacement)
                if replacements: updates[name] = replacements
                selected = []
        records[name] = selected
    records["stores"] = stores if case.scope == "store" else []
    records["counters"] = await rows(db, "counters", {"$or": [
        {"store_id": case.store_id}, {"_id": {"$regex": "^" + re.escape(case.store_id) + ":"}}]}, session) if case.scope == "store" else []

    removed, kept, keys = [], [], [guard_key("store", case.store_id)]
    account_updates = []
    for account in accounts:
        identifier = account["id"]
        other_stores = await rows(db, "stores", {"owner_user_id": identifier, "id": {"$ne": case.store_id}}, session)
        if account.get("store_id") not in (None, case.store_id):
            legacy = await db.stores.find_one({"id": account["store_id"]}, session=session)
            if (legacy and not legacy.get("owner_user_id") and account.get("role") in ("Owner", "admin")
                    and legacy["_id"] not in {row["_id"] for row in other_stores}):
                other_stores.append(legacy)
        other_members = await rows(db, "staff", {"store_id": {"$ne": case.store_id},
            "$or": [{"user_id": identifier}, {"id": identifier}]}, session)
        other_stores.sort(key=lambda row: str(row.get("id")))
        other_members.sort(key=lambda row: (str(row.get("store_id")), str(row.get("id"))))
        subscriptions = account.get("subscriptions") or {}
        if not isinstance(subscriptions, dict): raise ErasureBlocked("Malformed shared subscription data requires review.")
        other_subscriptions = {key: value for key, value in subscriptions.items() if key != "geraina" and value}
        if other_stores or other_members or other_subscriptions:
            kept.append(identifier)
            replacement = deepcopy(account)
            # Only references/entitlement of the removed Geraina scope change.
            if account.get("store_id") == case.store_id:
                target = other_stores[0] if other_stores else None
                if target is None and other_members:
                    target = await db.stores.find_one({"id": other_members[0]["store_id"]}, session=session)
                replacement["store_id"] = target.get("id") if target else None
                replacement["last_active_store_id"] = replacement["store_id"]
                replacement["store_name"] = target.get("name") if target else None
            replacement.pop("erasure_state", None); replacement.pop("erasure_job", None)
            other_geraina = any(s.get("module") in (None, "geraina") for s in other_stores)
            for member in other_members:
                member_store = await db.stores.find_one({"id": member["store_id"]}, session=session)
                other_geraina = other_geraina or bool(member_store and member_store.get("module") == "geraina")
            replacement["_erasure_unset_geraina"] = not other_geraina
            account_updates.append(replacement)
            if not other_geraina: keys.append(guard_key("module", identifier, "geraina"))
        else:
            removed.append(identifier); keys.append(guard_key("account", identifier))
        keys.append(guard_key("membership", identifier, case.store_id))
    records["users"] = [row for row in accounts if row["id"] in removed]
    if account_updates: updates["users"] = account_updates

    rules = {rule.collection: rule for rule in case.retention_rules}
    for name, selected in records.items():
        for row in selected:
            if row.get("legal_hold"): raise ErasureBlocked("Release/review an indefinite legal hold before erasure.")
            until = row.get("retention_until")
            if until:
                try:
                    until = until if isinstance(until, datetime) else datetime.fromisoformat(until.replace("Z", "+00:00"))
                    if until.tzinfo is None: until = until.replace(tzinfo=timezone.utc)
                except (TypeError, ValueError): raise ErasureBlocked("Invalid retention marker requires review.") from None
                if until > now() and (name not in rules or rules[name].expires_at < until):
                    raise ErasureBlocked("The retention rule cannot shorten an existing required retention period.")
    pending = {"pending", "processing", "creating", "uncertain", "awaiting_payment"}
    for name in ("orders", "subscription_orders", "checkout_attempts"):
        selected = records[name] + updates.get(name, [])
        if any(any(str(row.get(key, "")).lower() in pending for key in ("payment_status", "status", "state", "payment_initialization")) for row in selected):
            raise ErasureBlocked("Resolve pending/uncertain payments before erasure.")
    if case.scope == "store":
        order_ids = {row.get("id") for row in records["orders"]}
        if any(row.get("state") != "failed" and row.get("order_id") not in order_ids for row in records["checkout_attempts"]):
            raise ErasureBlocked("An orphaned checkout attempt needs reconciliation.")

    # Unknown same-store collections fail closed. Other tenants/products are
    # deliberately outside a module/staff request and are never purged.
    for name in collection_names:
        if name.startswith("system.") or name in INTERNAL: continue
        if name not in STORE_COLLECTIONS | {"users", "stores", "counters"}:
            query = {"$or": [{"store_id": case.store_id}, *linked_query(removed)["$or"]]}
            if await db[name].find_one(query, session=session):
                raise ErasureBlocked("Uninventoried linked data must be reviewed first.")
        elif removed:
            linked = await rows(db, name, linked_query(removed), session)
            approved = {_canonical(row["_id"]) for row in records.get(name, []) + updates.get(name, [])}
            if any(_canonical(row["_id"]) not in approved for row in linked):
                raise ErasureBlocked("An identity has data outside this request; review its additional scope first.")

    snapshot = {name: sorted([clean(row) for row in selected], key=lambda row: _canonical(row["_id"]))
                for name, selected in sorted(records.items())}
    # Preserved users may keep using DapurOS: unrelated profile/product changes
    # are excluded from the destructive snapshot and are not overwritten.
    update_snapshot = {name: ([{"id": row["id"], "store_id": row.get("store_id"),
                              "geraina_subscription_removed": row["_erasure_unset_geraina"]} for row in selected] if name == "users" else selected)
                       for name, selected in sorted(updates.items())}
    digest = sha({"case": case.model_dump(mode="json"), "records": snapshot, "updates": update_snapshot,
                  "inventory": sorted(records)})
    return ErasurePlan(digest, {name: len(value) for name, value in snapshot.items() if value}, snapshot,
                       updates, sorted(removed), sorted(kept), sorted(set(keys)))


async def ensure_indexes(db):
    await db.erasure_retained.create_index("expires_at", expireAfterSeconds=0)
    await db.erasure_jobs.create_index("purge_at", expireAfterSeconds=0)
    await db.erasure_guards.create_index("expires_at", expireAfterSeconds=0)


def public_job(job):
    return {"job_id": job["_id"], "phase": job["phase"], "counts": job.get("counts", {}),
            "external_steps": {name: value["status"] for name, value in job.get("external_steps", {}).items()},
            "scope": job["scope"], "retention": job.get("retention", []),
            "identities_preserved_for_other_services": job.get("kept_count", 0)}


async def get_job(db, case):
    job = await db.erasure_jobs.find_one({"_id": case_key(case)})
    if job and job["case_sha"] != case_sha(case): raise ErasureBlocked("This case reference is bound to a different reviewed case.")
    return job


async def begin_erasure(db, case, expected_digest, restore=False):
    if not isinstance(expected_digest, str) or not re.fullmatch("[0-9a-f]{64}", expected_digest):
        raise ErasureBlocked("Supply the exact reviewed dry-run digest.")
    existing = await get_job(db, case)
    if existing and existing["phase"] in ("database_complete", "complete") and not restore: return existing
    if existing and existing["phase"] == "closing" and existing["digest"] == expected_digest and not restore: return existing
    if case.audit_expires_at < now() + timedelta(minutes=int(os.getenv("JWT_EXPIRE_MINUTES", "1440")) + 1):
        raise ErasureBlocked("Approved audit/recovery expiry must cover the live session lifetime.")
    await ensure_indexes(db)
    inventory = await db.list_collection_names()

    async def freeze(session):
        previous = await get_job(db, case)
        plan = await prepare_erasure(db, case, session, inventory)
        if plan.digest != expected_digest: raise ErasureBlocked("Records or case changed since review; preview again.")
        for key in plan.keys:
            guard = await db.erasure_guards.find_one({"_id": key}, session=session)
            if guard and guard.get("state") != "active":
                if guard.get("job_id") != case_key(case): raise ErasureBlocked("Another closure case owns this scope.")
                if guard.get("state") == "erased" and not restore: raise ErasureBlocked("This scope was already erased.")
            else:
                await touch_active(db, [key], session)
            await db.erasure_guards.update_one({"_id": key}, {"$set": {"state": "closing", "job_id": case_key(case)}, "$unset": {"expires_at": ""}}, session=session)
        await db.stores.update_one({"id": case.store_id}, {"$set": {"erasure_state": "closing", "erasure_job": case_key(case)}}, session=session)
        if plan.removed_accounts:
            await db.users.update_many({"id": {"$in": plan.removed_accounts}}, {"$set": {"erasure_state": "closing", "erasure_job": case_key(case)}}, session=session)
        job = {"_id": case_key(case), "case_sha": case_sha(case), "phase": "closing", "digest": plan.digest,
               "keys": plan.keys, "removed_accounts": plan.removed_accounts, "scope": case.scope,
               "store_id": case.store_id, "kept_count": len(plan.kept_accounts), "counts": plan.counts,
               "audit_expires_at": case.audit_expires_at, "started_at": now(),
               "retention": [rule.model_dump(mode="json") for rule in case.retention_rules],
               "external_steps": {step: {"status": "pending"} for step in EXTERNAL_STEPS}}
        if previous and previous["phase"] == "closing": job["external_steps"] = previous["external_steps"]
        await db.erasure_jobs.replace_one({"_id": job["_id"]}, job, upsert=True, session=session)
        return job
    return await transactions.run_transaction(db, freeze)


def retained_projection(row, rule):
    result = {}
    for name in rule.fields:
        if name not in row: continue
        value = row[name]
        if name == "items":
            result[name] = [{key: item[key] for key in ITEM_FIELDS if key in item
                            and isinstance(item[key], (str, int, float, bool))} for item in value if isinstance(item, dict)] if isinstance(value, list) else []
        elif isinstance(value, (str, int, float, bool, datetime)) or value is None:
            result[name] = value
    return result


async def resume_erasure(db, case):
    job = await get_job(db, case)
    if not job: raise ErasureBlocked("A reviewed closure has not started.")
    if job["phase"] in ("database_complete", "complete"): return {"status": "primary-database-erased", **public_job(job)}
    if job["phase"] != "closing": raise ErasureBlocked("The case is not resumable.")
    inventory = await db.list_collection_names()

    async def erase(session):
        current = await db.erasure_jobs.find_one({"_id": job["_id"]}, session=session)
        if current["phase"] in ("database_complete", "complete"): return {"status": "primary-database-erased", **public_job(current)}
        for key in current["keys"]:
            guard = await db.erasure_guards.find_one({"_id": key}, session=session)
            if not guard or guard.get("state") != "closing" or guard.get("job_id") != job["_id"]:
                raise ErasureBlocked("Closure protection changed; no erasure was performed.")
            # Lock guards against cancellation/another resumer in this transaction.
            await db.erasure_guards.update_one({"_id": key}, {"$inc": {"revision": 1}}, session=session)
        plan = await prepare_erasure(db, case, session, inventory)
        if plan.digest != current["digest"]: raise ErasureBlocked("Records changed; preview and review again before resuming.")
        rules = {rule.collection: rule for rule in case.retention_rules}
        for name, selected in plan.records.items():
            rule = rules.get(name)
            if rule and rule.expires_at > now():
                for row in selected:
                    identifier = job["_id"] + ":" + name + ":" + sha(row["_id"])
                    await db.erasure_retained.update_one({"_id": identifier}, {"$setOnInsert": {
                        "case_id": job["_id"], "collection": name, "expires_at": rule.expires_at,
                        "reason": rule.reason, "payload": retained_projection(row, rule)}}, upsert=True, session=session)
            if selected:
                deleted = await db[name].delete_many({"_id": {"$in": [row["_id"] for row in selected]}}, session=session)
                if deleted.deleted_count != len(selected): raise ErasureBlocked("Concurrent change; erasure must roll back.")
        for name, selected in plan.updates.items():
            for row in selected:
                if name == "users":
                    change = {"$unset": {"subscriptions.geraina": ""}} if row["_erasure_unset_geraina"] else {}
                    if row["_erasure_unset_geraina"]:
                        change["$set"] = {"closed_modules.geraina": job["_id"]}
                    # Preserve unrelated DapurOS profile/entitlement writes.
                    original = await db.users.find_one({"_id": row["_id"]}, session=session)
                    if original.get("store_id") == case.store_id:
                        change.setdefault("$set", {}).update({key: row.get(key) for key in ("store_id", "last_active_store_id", "store_name")})
                    if change: await db.users.update_one({"_id": row["_id"]}, change, session=session)
                else:
                    await db[name].replace_one({"_id": row["_id"]}, row, session=session)
        for key in current["keys"]:
            state = "active" if case.scope == "staff" and key == guard_key("store", case.store_id) else "erased"
            await db.erasure_guards.update_one({"_id": key}, {"$set": {"state": state}}, session=session)
        if case.scope == "staff":
            await db.stores.update_one({"id": case.store_id, "erasure_job": job["_id"]}, {"$unset": {"erasure_state": "", "erasure_job": ""}}, session=session)
        await db.erasure_jobs.update_one({"_id": job["_id"]}, {"$set": {"phase": "database_complete", "database_completed_at": now()}}, session=session)
        current["phase"] = "database_complete"
        return {"status": "primary-database-erased", **public_job(current)}
    return await transactions.run_transaction(db, erase)


async def fulfill_erasure(db, case, expected_digest):
    await begin_erasure(db, case, expected_digest)
    return await resume_erasure(db, case)


async def cancel_erasure(db, case):
    async def cancel(session):
        job = await db.erasure_jobs.find_one({"_id": case_key(case)}, session=session)
        if not job or job["case_sha"] != case_sha(case): raise ErasureBlocked("Matching case not found.")
        if job["phase"] == "cancelled": return public_job(job)
        if job["phase"] != "closing": raise ErasureBlocked("Committed erasure cannot be undone by cancellation.")
        for key in job["keys"]:
            await db.erasure_guards.update_one({"_id": key, "job_id": job["_id"], "state": "closing"},
                {"$set": {"state": "active"}, "$unset": {"job_id": ""}}, session=session)
        for name in ("stores", "users"):
            await db[name].update_many({"erasure_job": job["_id"]}, {"$unset": {"erasure_state": "", "erasure_job": ""}}, session=session)
        await db.erasure_jobs.update_one({"_id": job["_id"]}, {"$set": {"phase": "cancelled"}}, session=session)
        job["phase"] = "cancelled"
        return public_job(job)
    return await transactions.run_transaction(db, cancel)


async def acknowledge_external(db, case, step, evidence_reference, outcome="completed"):
    if step not in EXTERNAL_STEPS or outcome not in ("completed", "not_applicable") or len(evidence_reference.strip()) < 3:
        raise ErasureBlocked("A known step, explicit outcome and private evidence reference are required.")
    job = await get_job(db, case)
    if not job or job["phase"] not in ("database_complete", "complete"):
        raise ErasureBlocked("Complete the primary database step first.")
    async def acknowledge(session):
        current = await db.erasure_jobs.find_one({"_id": job["_id"]}, session=session)
        previous = current["external_steps"][step]
        value = {"status": outcome, "evidence_sha": sha(evidence_reference.strip())}
        if previous["status"] != "pending" and previous != value:
            raise ErasureBlocked("An external completion record cannot be silently changed.")
        current["external_steps"][step] = value
        update = {"external_steps": current["external_steps"]}
        if all(item["status"] != "pending" for item in current["external_steps"].values()):
            update.update(phase="complete", purge_at=case.audit_expires_at)
            await db.erasure_guards.update_many({"job_id": job["_id"], "state": "erased"}, {"$set": {"expires_at": case.audit_expires_at}}, session=session)
            current["phase"] = "complete"
        await db.erasure_jobs.update_one({"_id": job["_id"]}, {"$set": update}, session=session)
        return public_job(current)
    return await transactions.run_transaction(db, acknowledge)


async def purge_expired_retention(db):
    # The same deadline also has a Mongo TTL index. This deterministic operator
    # path verifies/reconciles expiry without waiting for the TTL monitor.
    result = await db.erasure_retained.delete_many({"expires_at": {"$lte": now()}})
    return {"expired_retained_records_removed": result.deleted_count}
