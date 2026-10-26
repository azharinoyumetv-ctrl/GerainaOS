"""Idempotent inventory events written in the same transaction as their source."""
async def movement(db, session, *, identifier, store_id, product_id, name, quantity,
                   reference, kind, actor, at, branch_id='main', reconstructed=False):
    if not quantity:
        return
    await db.stock_movements.update_one({'_id': identifier}, {'$setOnInsert': {
        'id': identifier, 'store_id': store_id, 'product_id': product_id,
        'product_name': name, 'quantity': quantity, 'reference': reference,
        'kind': kind, 'actor_id': actor, 'created_at': at, 'branch_id': branch_id,
        'reconstructed': reconstructed,
    }}, upsert=True, session=session)
