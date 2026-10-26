"""Cost snapshots and exactly-once customer benefits, shared by online/offline settlement."""
from decimal import Decimal
from fastapi import HTTPException


async def customer_for_sale(db, store_id, payload, session, strict=True):
    identifier = getattr(payload, 'customer_id', None)
    query = {'store_id': store_id}
    if identifier:
        query['id'] = identifier
    else:
        alternatives = []
        for key in ('phone', 'email'):
            value = getattr(payload, 'customer_' + key, None)
            if value:
                alternatives.append({key: value})
        if not alternatives:
            return None
        query['$or'] = alternatives
    rows = await db.customers.find(query, {'_id': 0}, session=session).limit(2).to_list(length=2)
    if len(rows) != 1:
        if identifier and strict:
            raise HTTPException(409, 'Pelanggan tidak ditemukan atau berubah. Pilih ulang pelanggan.')
        return None
    return rows[0]


async def apply_loyalty(db, order, session, reverse=False):
    customer_id = order.get('customer_id')
    if not customer_id:
        return
    identity = f"{order['store_id']}:{order['id']}:earn"
    event = await db.loyalty_events.find_one({'_id': identity}, session=session)
    if reverse:
        if not event or event.get('reversed'):
            return
        changed = await db.loyalty_events.update_one({'_id': identity, 'reversed': {'$ne': True}},
                    {'$set': {'reversed': True}}, session=session)
        if changed.modified_count:
            customer=await db.customers.find_one({'store_id':order['store_id'],'id':customer_id},session=session)
            if customer:
                await db.customers.update_one({'store_id':order['store_id'],'id':customer_id},
                    {'$set':{'loyalty_points':max(0,customer.get('loyalty_points',0)-event['points'])}},session=session)
        return
    if event or order.get('payment_status') != 'paid':
        return
    rules = await db.loyalty_rules.find_one({'store_id': order['store_id']}, session=session)
    if not rules:
        return
    rate = rules.get('conversion_rate', 0)
    if not isinstance(rate, (int, float)) or rate <= 0:
        return
    points = int(Decimal(str(order['total'])) // Decimal(str(rate)))
    if points <= 0:
        return
    await db.loyalty_events.insert_one({'_id': identity, 'store_id': order['store_id'],
          'order_id': order['id'], 'customer_id': customer_id, 'points': points, 'reversed': False}, session=session)
    await db.customers.update_one({'store_id': order['store_id'], 'id': customer_id},
                  {'$inc': {'loyalty_points': points}}, session=session)
    order['loyalty_points_earned'] = points
    await db.orders.update_one({'id': order['id'], 'store_id': order['store_id']},
                  {'$set': {'loyalty_points_earned': points}}, session=session)
