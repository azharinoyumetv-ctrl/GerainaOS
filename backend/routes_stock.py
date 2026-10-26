"""Inventory history is authorized as inventory, without access to POS endpoints."""
import re
from typing import Optional
from fastapi import APIRouter, Depends, Query
from database import get_db
from auth import get_current_user
from permissions import require_permission
from plan_limits import require_plan
from paging import encode_cursor, decode_cursor
from store_time import store_zone

router=APIRouter(prefix='/api/inventory',tags=['stock_ledger'])


@router.get('/branches',dependencies=[Depends(require_permission('inventory.read'))])
async def inventory_branches(user:dict=Depends(require_plan('business'))):
    rows=await get_db().branches.find({'store_id':user['store_id']},{'_id':0,'id':1,'name':1}).sort('name',1).to_list(None)
    return [{'id':'main','name':'Outlet utama'},*rows]


def history_pipeline(store_id):
    def legacy_order(void=False):
        match={'store_id':store_id,'inventory_ledger_version':{'$ne':1}}
        if void:
            match.update(payment_status='voided',inventory_void_ledger_version={'$ne':1})
        return [{'$match':match},{'$unwind':{'path':'$items','includeArrayIndex':'line_index'}},
          {'$project':{'_id':0,'id':{'$concat':['legacy:order:','$id',':void:' if void else ':sale:',{'$toString':'$line_index'}]},
           'store_id':1,'product_id':'$items.product_id','product_name':'$items.name',
           'quantity':{'$multiply':[1 if void else -1,{'$ifNull':['$items.quantity',0]}]},
           'reference':'$order_no','kind':{'$literal':'void_legacy' if void else 'sale_legacy'},
           'created_at':{'$ifNull':['$voided_at','$updated_at']} if void else '$created_at',
           'actor_id':'$cashier_id','branch_id':{'$literal':'main'},'reconstructed':{'$literal':True}}}]
    adjustments=[{'$match':{'store_id':store_id,'inventory_ledger_version':{'$ne':1}}},
        {'$project':{'_id':0,'id':{'$concat':['legacy:adjustment:','$id']},'store_id':1,'product_id':1,
          'product_name':1,'quantity':{'$cond':[{'$eq':['$type','add']},'$adjustment_qty',{'$multiply':[-1,'$adjustment_qty']}]},
          'reference':{'$concat':['ADJ-','$id']},'kind':{'$literal':'adjustment_legacy'},'created_at':1,
          'actor_id':'$created_by','branch_id':{'$literal':'main'},'reconstructed':{'$literal':True}}}]
    return [{'$match':{'store_id':store_id}},{'$project':{'_id':0}},
       {'$unionWith':{'coll':'orders','pipeline':legacy_order()}},
       {'$unionWith':{'coll':'orders','pipeline':legacy_order(True)}},
       {'$unionWith':{'coll':'stock_adjustments','pipeline':adjustments}}]


@router.get('/movements',dependencies=[Depends(require_permission('inventory.read'))])
async def stock_history(user:dict=Depends(get_current_user),cursor:Optional[str]=None,
                         limit:int=Query(50,ge=1,le=100),q:str=Query('',max_length=200)):
    db=get_db();pipeline=history_pipeline(user['store_id'])
    if q.strip():
        pipeline.append({'$match':{'$or':[{field:{'$regex':re.escape(q.strip()),'$options':'i'}} for field in ('product_name','reference')]}})
    counts=await db.stock_movements.aggregate(pipeline+[{'$count':'total'}]).to_list(1)
    total=counts[0]['total'] if counts else 0
    if cursor:
        after=decode_cursor(cursor,['created_at','id'])
        pipeline.append({'$match':{'$or':[{'created_at':{'$lt':after['created_at']}},
             {'created_at':after['created_at'],'id':{'$lt':after['id']}}]}})
    rows=await db.stock_movements.aggregate(pipeline+[{'$sort':{'created_at':-1,'id':-1}},{'$limit':limit+1}]).to_list(limit+1)
    items,more=rows[:limit],len(rows)>limit
    return {'items':items,'total':total,'timezone':str(await store_zone(db,user['store_id'])),'next_cursor':encode_cursor({k:items[-1][k] for k in ('created_at','id')}) if more else None,
       'history_note':'Riwayat lama direkonstruksi dari transaksi dan penyesuaian tersimpan. Perubahan manual lama serta catatan transfer/penerimaan lama yang tidak mengubah stok mungkin tidak memiliki rincian.'}
