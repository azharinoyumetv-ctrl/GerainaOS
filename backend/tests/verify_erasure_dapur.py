"""Independent DapurOS process against the parent's disposable replica fixture."""
import argparse
import asyncio
import os
from pathlib import Path
import re
import sys

import httpx
from motor.motor_asyncio import AsyncIOMotorClient


async def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--database", required=True)
    args = parser.parse_args()
    assert re.fullmatch(r"geraina_erasure_workflow_[a-f0-9]{32}", args.database)
    os.environ["ENV"] = "test"
    os.environ["JWT_SECRET_KEY"] = "disposable-cross-product-erasure-fixture-key-only"
    root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(root / "DapurOS/backend"))
    import database
    from server import app
    client = AsyncIOMotorClient("mongodb://127.0.0.1:8847/?replicaSet=customerAudit", serverSelectionTimeoutMS=5000)
    raw = client[args.database]
    assert await raw.erasure_bench_fixture.find_one({"_id": "disposable-workflow-fixture-only"})
    database._db = raw; database._client = client; database._guarded = None
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://dapur-fixture") as api:
            login = await api.post("/api/auth/login", json={"email": "owner-a@example.com", "password": "DisposableFixtureOnly9!"})
            assert login.status_code == 200, "DapurOS sign-in failed"
            headers = {"Authorization": "Bearer " + login.json()["access_token"], "X-DagangOS-Module": "dapuros"}
            me = await api.get("/api/auth/me", headers=headers)
            assert me.status_code == 200 and me.json()["store_id"] == "dapur-a"
            created = await api.post("/api/products", headers=headers, json={"name": "Dapur independent process fixture", "sku": "DP-ERASURE-FIXTURE", "price": 5000, "stock": 1})
            assert created.status_code in (200, 201), "DapurOS write was blocked by another product's closure"
            assert await raw.products.find_one({"store_id": "dapur-a", "sku": "DP-ERASURE-FIXTURE"})
        print("Independent DapurOS HTTP sign-in, identity and product write passed.")
    finally:
        client.close()


if __name__ == "__main__": asyncio.run(main())
