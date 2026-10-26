"""The older isolated contract suites use MongoMock, which has no sessions.

Emulate rollback only in those test doubles. Production code always requires a
real MongoDB transaction; concurrency/rollback tests use a real replica set.
"""
import copy
import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import transactions


@pytest.fixture(autouse=True)
def mock_transaction_adapter(monkeypatch):
    original = transactions.run_transaction
    async def execute(db, operation):
        if '_AsyncMongoMockDatabase__database' not in vars(db):
            return await original(db, operation)
        names = await db.list_collection_names()
        snapshots = {name: copy.deepcopy(await db[name].find({}).to_list(None)) for name in names}
        try:
            return await operation(None)
        except Exception:
            for name in await db.list_collection_names():
                await db[name].delete_many({})
            for name, documents in snapshots.items():
                if documents:
                    await db[name].insert_many(documents)
            raise
    monkeypatch.setattr(transactions, 'run_transaction', execute)
