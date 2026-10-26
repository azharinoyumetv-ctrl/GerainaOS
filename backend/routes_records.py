"""Store-scoped cursor lists. Legacy array endpoints remain for older clients."""
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from auth import get_current_user
from database import get_db
from permissions import has_permission
from plan_limits import plan_rank
from paging import encode_cursor, decode_cursor

router=APIRouter(prefix='/api/records',tags=['record_pages'])
KINDS={
 'memberships':('memberships','customers.read','business',['name']),
 'customers':('customers','customers.read','starter',['name','phone','email']),
 'suppliers':('suppliers','suppliers.read','pro',['name','phone']),
 'purchase-orders':('purchase_orders','purchase.read','pro',['po_no','supplier_name']),
 'receiving':('goods_receiving','purchase.read','pro',['po_no','gr_no']),
 'invoices':('supplier_invoices','purchase.read','pro',['invoice_no','po_no']),
 'receivables':('debt_receivables','debt.read','pro',['customer_name','order_no']),
 'payables':('debt_payables','debt.read','pro',['supplier_name','invoice_no']),
 'categories':('categories','products.read','starter',['name']),
 'brands':('brands','products.read','starter',['name']),
 'units':('units','products.read','starter',['name','short_name']),
 'adjustments':('stock_adjustments','inventory.read','starter',['product_name','sku','reason']),
 'transfers':('stock_transfers','inventory.read','business',['from_branch','to_branch']),
 'branches':('branches','branches.manage','business',['name','address']),
}


@router.get('/{kind}')
async def records_page(kind: str,user: dict=Depends(get_current_user),cursor:Optional[str]=None,
                       limit:int=Query(500,ge=1,le=500),q:str=Query('',max_length=200)):
    if kind not in KINDS:
        raise HTTPException(404,'Jenis data tidak ditemukan.')
    collection,permission,plan,fields=KINDS[kind]
    if not has_permission(user,permission) or plan_rank(user.get('plan'))<plan_rank(plan):
        raise HTTPException(403,'Peran atau paket tidak mengizinkan data ini.')
    scope={'store_id':user['store_id']}
    if q.strip():
        scope['$or']=[{field:{'$regex':re.escape(q.strip()),'$options':'i'}} for field in fields]
    query=dict(scope)
    if cursor:
        after=decode_cursor(cursor,['id'])
        query['id']={'$gt':after['id']}
    db=get_db()
    rows=await db[collection].find(query,{'_id':0,'request_hash':0}).sort('id',1).limit(limit+1).to_list(limit+1)
    items,more=rows[:limit],len(rows)>limit
    return {'items':items,'total':await db[collection].count_documents(scope),
            'next_cursor':encode_cursor({'id':items[-1]['id']}) if more else None}
