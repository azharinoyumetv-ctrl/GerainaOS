"""Real transactions and real ASGI app requests, on unique loopback fixtures only."""
import asyncio
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone, timedelta
from uuid import uuid4

os.environ["ENV"] = "test"
os.environ["JWT_SECRET_KEY"] = "disposable-cross-product-erasure-fixture-key-only"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from fastapi import Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

import account_erasure as erasure
import database
import auth
from erasure_guard import GuardedDatabase, actor_context, guard_key, transaction
from erasure_inventory import EXTERNAL_STEPS
from server import app
from test_account_erasure import seed, verified_case


class FailingCollection:
    def __init__(self, raw): self.raw = raw
    def __getattr__(self, name): return getattr(self.raw, name)
    async def delete_many(self, *args, **kwargs):
        await self.raw.delete_many(*args, **kwargs)
        raise RuntimeError("deliberate-fixture-interruption")


class FailingDatabase:
    def __init__(self, raw): self.raw = raw
    def __getattr__(self, name): return getattr(self.raw, name)
    def __getitem__(self, name): return FailingCollection(self.raw[name]) if name == "orders" else self.raw[name]


async def snapshot(db):
    return erasure._canonical({name: sorted(await db[name].find({}).to_list(None), key=lambda r: erasure._canonical(r["_id"]))
        for name in sorted(await db.list_collection_names())})


async def blocked(operation):
    try:
        await operation
        raise AssertionError("A fenced write unexpectedly succeeded")
    except HTTPException as error:
        assert error.status_code in (403, 409, 422)


async def main():
    client = AsyncIOMotorClient("mongodb://127.0.0.1:8847/?replicaSet=customerAudit", serverSelectionTimeoutMS=5000)
    created, checks = [], []
    async def fixture():
        name = "geraina_erasure_workflow_" + uuid4().hex
        assert name.startswith("geraina_erasure_workflow_")
        created.append(name); raw = client[name]
        await seed(raw)
        await raw.erasure_bench_fixture.insert_one({"_id": "disposable-workflow-fixture-only"})
        await raw.users.update_one({"id": "owner-a"}, {"$set": {"email": "owner-a@example.com", "role": "Owner",
            "password_hash": auth.hash_password("DisposableFixtureOnly9!"), "plan": "business",
            "subscriptions": {"geraina": {"tier": "business", "status": "active", "period": "yearly", "expires_at": "2099-01-01T00:00:00Z"}}}})
        await raw.products.update_one({"store_id": "store-a"}, {"$set": {"name": "Fixture Kopi", "price": 12000, "stock": 10, "category": "Minuman", "unit": "pcs"}})
        await raw.orders.update_one({"store_id": "store-a"}, {"$set": {"total": 12000, "cashier_id": "staff-a", "cashier_email": "staff-a@example.invalid", "cashier_name": "Private Staff"}})
        await raw.stores.update_one({"id": "store-a"}, {"$set": {"name": "Erasure Fixture"}})
        await raw.staff.update_one({"user_id": "staff-a"}, {"$set": {"role": "Cashier", "name": "Fixture staff", "email": "staff-a@example.com", "status": "Aktif"}})
        await raw.users.update_one({"id": "staff-a"}, {"$set": {"email": "staff-a@example.com", "role": "Cashier", "credential_version": 0,
            "password_hash": auth.hash_password("DisposableFixtureOnly9!")}})
        for name in ("categories", "brands", "units"):
            await raw[name].update_one({"store_id": "store-a"}, {"$set": {"name": "Minuman" if name == "categories" else "Fixture", "short_name": "pcs"}})
        await raw.orders.update_one({"store_id": "store-a"}, {"$set": {"order_no": "ERASURE-FIXTURE", "payment_status": "paid", "payment_method": "cash",
            "subtotal": 12000, "discount": 0, "tax_percent": 0, "tax_amount": 0, "created_at": datetime.now(timezone.utc).isoformat(),
            "items": [{"product_id": "products-a", "name": "Fixture Kopi", "price": 12000, "quantity": 1, "subtotal": 12000}]}})
        return raw
    async def login(api):
        response = await api.post("/api/auth/login", json={"email": "owner-a@example.com", "password": "DisposableFixtureOnly9!"})
        assert response.status_code == 200, "Geraina HTTP login failed"
        return {"Authorization": "Bearer " + response.json()["access_token"], "X-DagangOS-Module": "geraina"}
    async def dapur_check(raw):
        process = await asyncio.create_subprocess_exec(sys.executable, str(Path(__file__).with_name("verify_erasure_dapur.py")),
            "--database", raw.name, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        output, error = await asyncio.wait_for(process.communicate(), 40)
        if process.returncode:
            # The child uses fixtures only; retain failure details locally.
            out.mkdir(parents=True, exist_ok=True)
            (out / "dapur-fixture-error.log").write_bytes(error)
            raise AssertionError("Independent DapurOS process failed; inspect the local fixture error log")
        return output.decode().strip()

    out = Path(__file__).resolve().parents[2] / "android-app/app/build/reports/account-erasure"
    out.mkdir(parents=True, exist_ok=True)
    try:
        await client.admin.command("ping")
        # Recover only explicitly marked disposable fixtures left by a killed
        # earlier bench process, never an application/customer database.
        import re
        for name in await client.list_database_names():
            if re.fullmatch(r"geraina_erasure_workflow_[a-f0-9]{32}", name):
                if await client[name].erasure_bench_fixture.find_one({"_id": "disposable-workflow-fixture-only"}):
                    await client.drop_database(name)
        raw = await fixture(); guarded = GuardedDatabase(raw)
        before_guard = await raw.erasure_guards.find_one({"_id": guard_key("store", "store-a")})
        # Concurrent first writers exercise guard creation + transaction retry.
        await asyncio.gather(*(guarded.products.update_one({"store_id": "store-a"}, {"$inc": {"stock": 1}}) for _ in range(6)))
        assert (await raw.products.find_one({"store_id": "store-a"}))["stock"] == 16
        checks.append("Concurrent first writes create guards safely and preserve all six increments")
        # A pre-existing transaction must drain; the old preview must not erase
        # the new, unreviewed value when the lock is released.
        entered, release = asyncio.Event(), asyncio.Event()
        async def writer(session):
            await guarded.products.update_one({"store_id": "store-a"}, {"$inc": {"stock": 1}}, session=session)
            entered.set(); await release.wait()
        write_task = asyncio.create_task(transaction(raw, writer)); await entered.wait()
        case = verified_case(); old = await erasure.prepare_erasure(raw, case)
        freeze_task = asyncio.create_task(erasure.begin_erasure(raw, case, old.digest))
        release.set(); await write_task
        try:
            await freeze_task; raise AssertionError("A stale preview was accepted")
        except erasure.ErasureBlocked: pass
        assert (await raw.products.find_one({"store_id": "store-a"}))["stock"] == 17
        checks.append("Closure waits for an existing transaction and rejects the now-stale preview without losing the committed write")

        # Actual backend login + a request that has already authenticated before
        # closure. It must still be blocked at its eventual database write.
        raw = await fixture(); database._client = client; database._db = raw; database._guarded = None
        request_entered, request_release = asyncio.Event(), asyncio.Event()
        @app.post("/__erasure_bench_delayed_write")
        async def delayed(user=Depends(auth.get_current_user)):
            request_entered.set(); await request_release.wait()
            await database.get_db().products.update_one({"store_id": user["store_id"]}, {"$set": {"stock": 999}})
            return {"ok": True}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://geraina-fixture") as api:
            headers = await login(api)
            cash = {"items": [{"product_id": "products-a", "name": "Fixture Kopi", "price": 12000, "quantity": 1, "subtotal": 12000}],
                    "payment_method": "cash", "cash_received": 12000}
            sale_headers = {**headers, "Idempotency-Key": "disposable-fence-cash-sale"}
            sale = await api.post("/api/orders", headers=sale_headers, json=cash)
            assert sale.status_code == 200, "Cash sale regressed behind write fencing"
            repeat = await api.post("/api/orders", headers=sale_headers, json=cash)
            assert repeat.status_code == 200 and repeat.json()["id"] == sale.json()["id"]
            assert (await raw.products.find_one({"store_id": "store-a"}))["stock"] == 9
            void = await api.post("/api/orders/" + sale.json()["id"] + "/void", headers=headers)
            assert void.status_code == 200 and (await raw.products.find_one({"store_id": "store-a"}))["stock"] == 10
            offline = {**cash, "expected_store_id": "store-a", "expected_cashier_id": "owner-a", "client_order_id": str(uuid4()), "sold_at": datetime.now(timezone.utc).isoformat()}
            first_offline = await api.post("/api/offline/orders", headers=headers, json=offline)
            second_offline = await api.post("/api/offline/orders", headers=headers, json=offline)
            assert first_offline.status_code == second_offline.status_code == 200
            assert (await raw.products.find_one({"store_id": "store-a"}))["stock"] == 9
            checks.append("Real Geraina HTTP cash checkout, duplicate retry, void/stock restoration and offline synchronization retain their existing atomic behavior behind the fence")
            expected_retained = await raw.orders.count_documents({"store_id": "store-a"})
            pending = asyncio.create_task(api.post("/__erasure_bench_delayed_write", headers=headers)); await request_entered.wait()
            case = verified_case(disposition="retain_minimum_after_review", retention_rules=[{
                "collection": "orders", "fields": ["total", "created_at"], "reason": "Reviewed fixture accounting", "expires_at": datetime.now(timezone.utc) + timedelta(days=7)}])
            plan = await erasure.prepare_erasure(raw, case); await erasure.begin_erasure(raw, case, plan.digest)
            request_release.set(); response = await pending
            assert response.status_code == 409
            assert (await raw.products.find_one({"store_id": "store-a"}))["stock"] == 9
            assert (await api.get("/api/products", headers=headers)).status_code in (401, 409)
            checks.append("A real Geraina HTTP request authenticated before closure is fenced at its later write; closing access is visible through normal authentication")
            frozen = await snapshot(raw)
            try:
                await erasure.resume_erasure(FailingDatabase(raw), case)
                raise AssertionError("Expected disposable interruption")
            except RuntimeError as error: assert str(error) == "deliberate-fixture-interruption"
            assert await snapshot(raw) == frozen
            assert (await erasure.get_job(raw, case))["phase"] == "closing"
            checks.append("An actual mid-erasure database failure rolls back records and retention copies; durable closure remains resumable")
            result = await erasure.resume_erasure(raw, case)
            assert result == await erasure.resume_erasure(raw, case)
            assert result == await erasure.fulfill_erasure(raw, case, plan.digest)
            assert await raw.erasure_retained.count_documents({}) == expected_retained
            assert (await api.get("/api/auth/me", headers=headers)).status_code == 401
            checks.append("Retry after an interruption or lost success response returns the durable result without duplicate retention copies; old sessions reject")
            assert set(result["external_steps"].values()) == {"pending"}
            for step in EXTERNAL_STEPS:
                result = await erasure.acknowledge_external(raw, case, step, "disposable-fixture-no-external-copies-" + step, "not_applicable")
            assert result["phase"] == "complete"
            checks.append("Overall completion requires a separately recorded outcome for every external-copy step; the database result alone never reports full completion")
            index = await raw.erasure_retained.index_information()
            assert any(item.get("expireAfterSeconds") == 0 for item in index.values())
            vault = await raw.erasure_retained.find_one({})
            assert set(vault["payload"]) <= {"total", "created_at"}
            await raw.erasure_retained.drop_index("expires_at_1")
            await raw.erasure_retained.update_one({"_id": vault["_id"]}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
            assert (await erasure.purge_expired_retention(raw))["expired_retained_records_removed"] == 1
            checks.append("Real retention projection excludes identity/contact/provider fields; the TTL index is installed and deterministic expiry removes only due data")

        # Shared identity remains usable through the independent DapurOS code,
        # both while Geraina is frozen and after Geraina has been erased.
        raw = await fixture()
        await raw.stores.insert_one({"id": "dapur-a", "owner_user_id": "owner-a", "module": "dapuros", "name": "Dapur fixture"})
        await raw.users.update_one({"id": "owner-a"}, {"$set": {"subscriptions.dapuros": {
            "tier": "business", "status": "active", "period": "yearly", "expires_at": "2099-01-01T00:00:00Z"}}})
        case = verified_case(); plan = await erasure.prepare_erasure(raw, case)
        await erasure.begin_erasure(raw, case, plan.digest)
        await dapur_check(raw)
        await erasure.resume_erasure(raw, case)
        await dapur_check(raw)
        owner = await raw.users.find_one({"id": "owner-a"})
        assert owner["subscriptions"]["dapuros"]["tier"] == "business" and "geraina" not in owner["subscriptions"]
        checks.append("Independent DapurOS HTTP login and product writes work during and after Geraina closure; shared credentials and the DapurOS paid entitlement survive")

        # Staff-only close reopens the merchant store and blocks a previously
        # authenticated staff request even though the store is active again.
        raw = await fixture(); guarded = GuardedDatabase(raw)
        case = verified_case(scope="staff", user_id="staff-a")
        plan = await erasure.prepare_erasure(raw, case); await erasure.fulfill_erasure(raw, case, plan.digest)
        order = await raw.orders.find_one({"store_id": "store-a"})
        assert order["total"] == 12000 and order["cashier_id"] == "deleted-staff" and order["cashier_email"] == ""
        token = actor_context.set(("staff-a", "geraina"))
        try: await blocked(guarded.products.update_one({"store_id": "store-a"}, {"$set": {"stock": 999}}))
        finally: actor_context.reset(token)
        token = actor_context.set(("owner-a", "geraina"))
        try: await guarded.products.update_one({"store_id": "store-a"}, {"$inc": {"stock": 1}})
        finally: actor_context.reset(token)
        checks.append("Staff-only erasure preserves sales totals, removes attribution, reopens the store to its owner and still fences the erased staff identity")

        # Closure cancellation before erasure and replay after backup restore.
        raw = await fixture(); guarded = GuardedDatabase(raw); case = verified_case()
        plan = await erasure.prepare_erasure(raw, case); await erasure.begin_erasure(raw, case, plan.digest)
        await blocked(guarded.products.insert_one({"id": "blocked-fixture", "store_id": "store-a", "name": "must not save"}))
        await erasure.cancel_erasure(raw, case)
        await guarded.products.update_one({"store_id": "store-a"}, {"$inc": {"stock": 1}})
        plan = await erasure.prepare_erasure(raw, case)
        backup = {name: await raw[name].find({}).to_list(None) for name in await raw.list_collection_names() if not name.startswith("erasure_")}
        await erasure.fulfill_erasure(raw, case, plan.digest)
        for name, documents in backup.items():
            existing = {str(row["_id"]) for row in await raw[name].find({}).to_list(None)}
            missing = [row for row in documents if str(row["_id"]) not in existing]
            if missing: await raw[name].insert_many(missing)
        await blocked(guarded.products.update_one({"store_id": "store-a"}, {"$set": {"stock": 999}}))
        replay = await erasure.prepare_erasure(raw, case)
        await erasure.begin_erasure(raw, case, replay.digest, restore=True); await erasure.resume_erasure(raw, case)
        assert await raw.users.find_one({"id": "owner-a"}) is None
        assert await raw.users.find_one({"id": "owner-b"}) is not None
        checks.append("Cancellation before commit safely reopens writes; restored records stay fenced and reviewed restore replay removes them without affecting another tenant")

        # Exercise all driver mutation shapes, including callbacks/upserts and
        # nested helper calls that omit session inside an outer transaction.
        raw = await fixture(); guarded = GuardedDatabase(raw)
        async def nested(session):
            await guarded.products.update_one({"store_id": "store-a"}, {"$inc": {"stock": 1}}, session=session)
            await guarded.counters.find_one_and_update({"_id": "store-a:counter"}, {"$inc": {"seq": 1}}, upsert=True)
        await transaction(raw, nested)
        after_guard = await raw.erasure_guards.find_one({"_id": guard_key("store", "store-a")})
        assert after_guard["revision"] - (before_guard or {}).get("revision", 0) == 1
        case = verified_case(); plan = await erasure.prepare_erasure(raw, case); await erasure.begin_erasure(raw, case, plan.digest)
        operations = [
            guarded.products.insert_many([{"store_id": "store-a", "id": "late"}]),
            guarded.products.update_one(filter={"store_id": "store-a"}, update={"$set": {"stock": 100}}),
            guarded.products.update_many({"store_id": "store-a"}, {"$inc": {"stock": 1}}),
            guarded.products.replace_one({"store_id": "store-a"}, {"id": "replacement", "store_id": "store-a"}),
            guarded.products.find_one_and_replace({"store_id": "store-a"}, {"id": "replacement", "store_id": "store-a"}),
            guarded.products.find_one_and_update({"store_id": "store-a"}, {"$set": {"stock": 1}}),
            guarded.products.delete_many({"store_id": "store-a"}),
            guarded.products.find_one_and_delete({"store_id": "store-a"}),
            guarded.products.update_one({"id": "late-orphan"}, {"$set": {"name": "missing scope"}}, upsert=True),
        ]
        for operation in operations: await blocked(operation)
        assert (await raw.products.find_one({"store_id": "store-a"}))["stock"] == 11
        checks.append("All supported Mongo mutation shapes are fenced, unscoped upserts fail closed, and nested helpers share the outer session without a self-deadlock")

        # The real operator entry point must use the raw privileged connection,
        # preserve its preview digest and expose durable recovery commands.
        raw = await fixture(); case = verified_case()
        case_file = out / ("disposable-case-" + uuid4().hex + ".json")
        case_file.write_text(case.model_dump_json(), encoding="utf-8")
        async def cli(*arguments):
            env = {**os.environ, "MONGO_URL": "mongodb://127.0.0.1:8847/?replicaSet=customerAudit", "DB_NAME": raw.name}
            process = await asyncio.create_subprocess_exec(sys.executable, str(Path(__file__).resolve().parents[1] / "fulfill_account_erasure.py"),
                "--case", str(case_file), *arguments, env=env, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            output, error = await asyncio.wait_for(process.communicate(), 30)
            if process.returncode:
                (out / "cli-fixture-error.log").write_bytes(error)
                raise AssertionError("Operator command failed; inspect its local fixture log")
            return json.loads(output)
        try:
            preview = await cli()
            assert preview["status"] == "dry-run-no-data-changed"
            assert (await cli("--begin", "--plan-digest", preview["digest"]))["phase"] == "closing"
            assert (await cli("--status"))["phase"] == "closing"
            result = await cli("--resume")
            assert result["phase"] == "database_complete" and result == await cli("--resume")
            for step in EXTERNAL_STEPS:
                result = await cli("--ack-external", step, "--evidence-ref", "disposable-fixture-no-external-copies-" + step, "--outcome", "not_applicable")
            assert result["phase"] == "complete"
            checks.append("Actual operator CLI preview, begin, status, resume/retry and external-step acknowledgements pass against the marked local fixture")
        finally:
            case_file.unlink(missing_ok=True)

        # Serve the actual app only on a pre-bound loopback socket for the
        # Playwright fixture. This is not a production route or deployment.
        import socket
        import uvicorn
        control_key = uuid4().hex
        browser_raw = await fixture()
        api_client = AsyncIOMotorClient("mongodb://127.0.0.1:8847/?replicaSet=customerAudit", serverSelectionTimeoutMS=5000)
        database._client = api_client; database._db = api_client[browser_raw.name]; database._guarded = None
        @app.post("/__erasure_bench_control")
        async def browser_control(payload: dict):
            nonlocal browser_raw
            if payload.get("fixture_key") != control_key: raise HTTPException(403)
            if payload.get("action") == "reset":
                browser_raw = await fixture(); database._db = api_client[browser_raw.name]; database._guarded = None
                return {"ok": True}
            assert await browser_raw.erasure_bench_fixture.find_one({"_id": "disposable-workflow-fixture-only"})
            case = verified_case(scope="staff", user_id="staff-a") if payload.get("action") == "staff" else verified_case()
            plan = await erasure.prepare_erasure(browser_raw, case)
            await erasure.fulfill_erasure(browser_raw, case, plan.digest)
            return {"ok": True}
        sock = socket.socket(); sock.bind(("127.0.0.1", 0)); port = sock.getsockname()[1]
        server = uvicorn.Server(uvicorn.Config(app, log_level="error", access_log=False))
        serving = asyncio.create_task(server.serve(sockets=[sock]))
        try:
            for _ in range(100):
                if server.started: break
                await asyncio.sleep(0.05)
            assert server.started
            process = await asyncio.create_subprocess_exec("node", str(Path(__file__).resolve().parents[2] / "android-app/scripts/verify-erasure-browser.cjs"),
                "--port", str(port), "--fixture-key", control_key, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            output, error = await asyncio.wait_for(process.communicate(), timeout=150)
            (out / "browser-fixture.log").write_bytes(output + error)
            assert process.returncode == 0, "Playwright erasure fixture failed; inspect the local browser log"
            checks.append("Actual built frontend passed Playwright sign-in, closed-account reload/login, staff logout and surviving-owner access on desktop and phone layouts")
        finally:
            server.should_exit = True
            await serving
            sock.close()

        report = {"status": "passed", "finishedAt": datetime.now(timezone.utc).isoformat(), "checks": checks,
            "scope": "Real local MongoDB replica, Geraina ASGI HTTP and independent DapurOS process; fixtures only",
            "productionWrites": 0, "realExternalActions": 0,
            "sourceFiles": ["backend/erasure_guard.py", "backend/erasure_workflow.py", "backend/erasure_inventory.py", "backend/database.py", "backend/auth.py", "backend/fulfill_account_erasure.py"]}
    finally:
        for name in created:
            assert name.startswith("geraina_erasure_workflow_")
            await client.drop_database(name)
        client.close()
        database._client = database._db = database._guarded = None
    report["fixtures_removed"] = True
    (out / "workflow-verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__": asyncio.run(main())
