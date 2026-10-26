"""Product writes that change stock also commit a real inventory event."""
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow
from plan_limits import check_capacity
from stock_ledger import movement


async def save_product(db, user, values, session, identifier=None, expected_stock=None):
    store_id=user['store_id'];at=utcnow().isoformat()
    if 'name' in values:
        values={**values,'name':values['name'].strip()}
        if not values['name']:
            raise HTTPException(422,'Nama produk wajib diisi.')
    if identifier is None:
        # Serializes capacity checks across concurrent imports/create requests.
        await db.capacity_guards.update_one({'_id':store_id+':products'},{'$inc':{'revision':1}},upsert=True,session=session)
        await check_capacity(db,store_id,user.get('plan'),'products','max_products')
        identifier=str(uuid4())
        doc={**values,'id':identifier,'store_id':store_id,'created_at':at,'updated_at':at,'inventory_ledger_version':1}
        await db.products.insert_one(dict(doc),session=session)
        delta=values.get('stock',0);kind='product_created'
    else:
        doc=await db.products.find_one({'store_id':store_id,'id':identifier},session=session)
        if not doc:
            raise HTTPException(404,'Produk tidak ditemukan.')
        if expected_stock is not None and doc.get('stock',0)!=expected_stock:
            raise HTTPException(409,'Stok berubah sejak produk dibuka. Segarkan data sebelum mengubah stok.')
        delta=values.get('stock',doc.get('stock',0))-doc.get('stock',0)
        await db.products.update_one({'store_id':store_id,'id':identifier},
                  {'$set':{**values,'updated_at':at}},session=session)
        doc={**doc,**values,'updated_at':at};kind='product_updated'
    await movement(db,session,identifier=str(uuid4()),store_id=store_id,product_id=identifier,name=doc['name'],
          quantity=delta,reference='PROD-'+identifier[:8].upper(),kind=kind,actor=user['id'],at=at)
    return {key:value for key,value in doc.items() if key!='_id'}
