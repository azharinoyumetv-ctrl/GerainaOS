"""Local business mutations require MongoDB transactions; never degrade to partial writes."""
from fastapi import HTTPException
from pymongo.errors import OperationFailure
from erasure_guard import transaction


async def run_transaction(db, operation):
    return await transaction(db, operation)
