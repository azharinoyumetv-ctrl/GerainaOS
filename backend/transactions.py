"""Local business mutations require MongoDB transactions; never degrade to partial writes."""
from fastapi import HTTPException
from pymongo.errors import OperationFailure


async def run_transaction(db, operation):
    try:
        async with await db.client.start_session() as session:
            return await session.with_transaction(operation)
    except (NotImplementedError, OperationFailure) as error:
        if isinstance(error, NotImplementedError) or error.code in (20, 303):
            raise HTTPException(503, 'Penyimpanan transaksi belum siap. Data belum diubah; coba lagi atau hubungi dukungan.') from None
        raise
