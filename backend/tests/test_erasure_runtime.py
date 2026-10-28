import asyncio
from unittest.mock import AsyncMock

import pytest
from mongomock_motor import AsyncMongoMockClient

import erasure_runtime as runtime
from erasure_guard import PROTOCOL
from erasure_workflow import ErasureBlocked

run = asyncio.run


class FakeClient:
    def __init__(self, replies): self.replies, self.requests = replies, []
    async def __aenter__(self): return self
    async def __aexit__(self, *args): pass
    async def get(self, url, headers):
        self.requests.append((url, headers))
        value = self.replies[headers["X-DagangOS-Module"]]
        class Reply:
            def raise_for_status(self): pass
            def json(self): return value
        return Reply()


def valid(module):
    return {"module": module, "protocol": PROTOCOL, "write_fence_enabled": True, "implementation_sha256": "a" * 64}


def test_production_checks_both_fixed_origins_without_transmitting_database_credentials(monkeypatch):
    db = AsyncMongoMockClient().real_application_db
    monkeypatch.setenv("MONGO_URL", "mongodb+srv://private-user:private-password@fixture.invalid/")
    fake = FakeClient({module: valid(module) for module in ("geraina", "dapuros")})
    monkeypatch.setattr(runtime, "implementation_fingerprint", lambda: "a" * 64)
    monkeypatch.setattr(runtime.httpx, "AsyncClient", lambda **kwargs: fake)
    assert run(runtime.verify_runtime_fences(db))["status"] == "matching-production-fences"
    assert len(fake.requests) == 2
    assert all(url == "https://dagangos.com/api/system/erasure-capabilities" for url, _ in fake.requests)
    assert "private-password" not in str(fake.requests) and "private-user" not in str(fake.requests)


@pytest.mark.parametrize("change", [
    {"module": "geraina"}, {"protocol": "old"}, {"write_fence_enabled": False},
    {"implementation_sha256": "b" * 64}, {"implementation_sha256": None}])
def test_unverified_or_mismatched_other_backend_blocks_production(monkeypatch, change):
    monkeypatch.setenv("MONGO_URL", "mongodb+srv://fixture.invalid/")
    replies = {module: valid(module) for module in ("geraina", "dapuros")}
    replies["dapuros"].update(change)
    monkeypatch.setattr(runtime.httpx, "AsyncClient", lambda **kwargs: FakeClient(replies))
    with pytest.raises(ErasureBlocked): run(runtime.verify_runtime_fences(AsyncMongoMockClient().real_application_db))


def test_test_environment_flag_does_not_bypass_production_preflight(monkeypatch):
    monkeypatch.setenv("ENV", "test"); monkeypatch.setenv("MONGO_URL", "mongodb+srv://fixture.invalid/")
    monkeypatch.setattr(runtime.httpx, "AsyncClient", lambda **kwargs: FakeClient({module: {} for module in ("geraina", "dapuros")}))
    with pytest.raises(ErasureBlocked): run(runtime.verify_runtime_fences(AsyncMongoMockClient().real_application_db))


def test_old_deployed_pair_cannot_be_used_by_newer_support_tool(monkeypatch):
    monkeypatch.setenv("MONGO_URL", "mongodb+srv://fixture.invalid/")
    monkeypatch.setattr(runtime, "implementation_fingerprint", lambda: "b" * 64)
    monkeypatch.setattr(runtime.httpx, "AsyncClient", lambda **kwargs: FakeClient({module: valid(module) for module in ("geraina", "dapuros")}))
    with pytest.raises(ErasureBlocked, match="local support tool"):
        run(runtime.verify_runtime_fences(AsyncMongoMockClient().real_application_db))


def test_only_marked_loopback_fixture_can_skip_network_probes(monkeypatch):
    db = AsyncMongoMockClient()["geraina_erasure_workflow_" + "a" * 32]
    run(db.erasure_bench_fixture.insert_one({"_id": "disposable-workflow-fixture-only"}))
    monkeypatch.setenv("MONGO_URL", "mongodb://127.0.0.1:8847/")
    monkeypatch.setattr(runtime.httpx, "AsyncClient", lambda **kwargs: pytest.fail("Fixture must not probe a production service"))
    assert run(runtime.verify_runtime_fences(db))["status"] == "disposable-loopback-fixture"
