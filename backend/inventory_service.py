"""Inventory changes and branch transfers, each committed with its audit event."""
import hashlib
import json
import re
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow
from stock_ledger import movement


async def branch(db, store_id, value, session):
    if value == 'main':
        return {'id':'main','name':'Outlet utama'}
    rows = await db.branches.find({'store_id':store_id,'$or':[{'id':value},{'name':value}]}, session=session).limit(2).to_list(2)
    if len(rows)!=1 or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',rows[0]['id']):
        raise HTTPException(422,'Cabang tidak ditemukan di toko ini. Pilih ulang cabang.')
    return rows[0]


def stock_field(branch_id):
    return 'stock' if branch_id=='main' else 'stock_by_branch.'+branch_id


def request_identity(store_id, kind, request_id, body):
    fingerprint=hashlib.sha256(json.dumps(body,sort_keys=True).encode()).hexdigest()
    key=hashlib.sha256((request_id or str(uuid4())).encode()).hexdigest()
    return f'{store_id}:{kind}:{key}',fingerprint


async def adjustment(db, payload, user, session):
    scope={'store_id':user['store_id']}
    if payload.product_id:
        scope['id']=payload.product_id
    elif payload.sku and payload.sku!='N/A':
        scope['sku']=payload.sku
    else:
        raise HTTPException(422,'Pilih produk dengan ID yang valid; SKU kosong tidak dapat dijadikan referensi.')
    products=await db.products.find(scope,session=session).limit(2).to_list(2)
    if len(products)!=1:
        raise HTTPException(409,'Produk tidak ditemukan atau SKU duplikat. Pilih ulang produk.')
    product=products[0]
    identity,digest=request_identity(user['store_id'],'adjustment',payload.request_id,
               {'product_id':product['id'],'qty':payload.adjustment_qty,'type':payload.type,'reason':payload.reason})
    previous=await db.stock_adjustments.find_one({'_id':identity},session=session)
    if previous:
        if previous['request_hash']!=digest:
            raise HTTPException(409,'Referensi penyesuaian telah digunakan untuk data berbeda.')
        return previous
    delta=payload.adjustment_qty if payload.type=='add' else -payload.adjustment_qty
    target={'id':product['id'],'store_id':user['store_id']}
    if delta<0:
        target['stock']={'$gte':-delta}
    changed=await db.products.update_one(target,{'$inc':{'stock':delta}},session=session)
    if not changed.modified_count:
        raise HTTPException(409,'Stok tidak cukup untuk penyesuaian ini.')
    identifier,at=str(uuid4()),utcnow().isoformat()
    doc={'_id':identity,'id':identifier,'store_id':user['store_id'],'product_id':product['id'],
         'product_name':product['name'],'sku':product.get('sku'),'adjustment_qty':payload.adjustment_qty,
         'type':payload.type,'reason':payload.reason,'created_by':user.get('email') or user['id'],
         'created_at':at,'inventory_ledger_version':1,'request_hash':digest}
    await db.stock_adjustments.insert_one(dict(doc),session=session)
    await movement(db,session,identifier=identifier+':adjustment',store_id=user['store_id'],product_id=product['id'],
          name=product['name'],quantity=delta,reference='ADJ-'+identifier[:8].upper(),kind='adjustment',actor=user['id'],at=at)
    return doc


async def ship(db,payload,user,session):
    source=await branch(db,user['store_id'],payload.from_branch,session)
    destination=await branch(db,user['store_id'],payload.to_branch,session)
    if source['id']==destination['id']:
        raise HTTPException(422,'Cabang asal dan tujuan harus berbeda.')
    ids=[item.product_id for item in payload.items]
    if len(set(ids))!=len(ids):
        raise HTTPException(422,'Produk transfer duplikat.')
    identity,digest=request_identity(user['store_id'],'transfer',payload.request_id,
          {'from':source['id'],'to':destination['id'],'items':[item.model_dump() for item in payload.items]})
    previous=await db.stock_transfers.find_one({'_id':identity},session=session)
    if previous:
        if previous['request_hash']!=digest:
            raise HTTPException(409,'Referensi transfer telah digunakan untuk data berbeda.')
        return previous
    identifier,at=str(uuid4()),utcnow().isoformat()
    lines=[];field=stock_field(source['id'])
    for item in payload.items:
        product=await db.products.find_one({'id':item.product_id,'store_id':user['store_id']},session=session)
        if not product:
            raise HTTPException(404,'Produk transfer tidak ditemukan.')
        changed=await db.products.update_one({'id':item.product_id,'store_id':user['store_id'],field:{'$gte':item.qty}},
                   {'$inc':{field:-item.qty}},session=session)
        if not changed.modified_count:
            raise HTTPException(409,'Stok di cabang asal tidak cukup.')
        lines.append({'product_id':item.product_id,'name':product['name'],'qty':item.qty})
        await movement(db,session,identifier=f'{identifier}:ship:{item.product_id}',store_id=user['store_id'],
              product_id=item.product_id,name=product['name'],quantity=-item.qty,reference='TR-'+identifier[:8].upper(),
              kind='transfer_shipped',actor=user['id'],at=at,branch_id=source['id'])
    doc={'_id':identity,'id':identifier,'store_id':user['store_id'],'from_branch':source['name'],'to_branch':destination['name'],
         'from_branch_id':source['id'],'to_branch_id':destination['id'],'items':lines,'status':'Shipped',
         'inventory_applied':True,'created_at':at,'created_by':user['id'],'request_hash':digest}
    await db.stock_transfers.insert_one(dict(doc),session=session)
    return doc


async def finish_transfer(db,identifier,user,session,cancel=False):
    scope={'id':identifier,'store_id':user['store_id']}
    transfer=await db.stock_transfers.find_one(scope,session=session)
    if not transfer:
        raise HTTPException(404,'Transfer tidak ditemukan.')
    final='Cancelled' if cancel else 'Received'
    if transfer['status']==final:
        return transfer
    if transfer['status']!='Shipped' or not transfer.get('inventory_applied'):
        raise HTTPException(409,'Transfer lama hanya berupa catatan atau sudah ditutup; stok tidak diubah.')
    target=transfer['from_branch_id'] if cancel else transfer['to_branch_id']
    at=utcnow().isoformat()
    for line in transfer['items']:
        product=await db.products.find_one({'id':line['product_id'],'store_id':user['store_id']},session=session)
        if not product:
            raise HTTPException(409,'Produk transfer telah berubah. Hubungi Owner untuk memperbaiki referensi.')
        await db.products.update_one({'id':line['product_id'],'store_id':user['store_id']},
                      {'$inc':{stock_field(target):line['qty']}},session=session)
        await movement(db,session,identifier=f"{identifier}:{final}:{line['product_id']}",store_id=user['store_id'],
              product_id=line['product_id'],name=line['name'],quantity=line['qty'],reference='TR-'+identifier[:8].upper(),
              kind='transfer_cancelled' if cancel else 'transfer_received',actor=user['id'],at=at,branch_id=target)
    await db.stock_transfers.update_one(scope,{'$set':{'status':final,'updated_at':at,'closed_by':user['id']}},session=session)
    return {**transfer,'status':final,'updated_at':at}
