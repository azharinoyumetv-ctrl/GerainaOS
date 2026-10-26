"""Real replica-set regressions for the customer audit; no external charges."""
import asyncio
import json
import sys
from pathlib import Path
from uuid import uuid4
from unittest.mock import AsyncMock
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import auth
import database
import routes_orders as orders
import routes_purchase as purchase
import routes_inventory as inventory
import routes_customers as customers
import routes_records as records
import routes_stock as stock
import routes_reports as reports
import routes_offline as offline
import routes_products as products
import routes_webhooks as webhooks


@pytest_asyncio.fixture
async def shop(monkeypatch):
    connection = Path(__file__).resolve().parents[3] / 'tmp/offline-mongo/connection.json'
    uri = json.loads(connection.read_text())['uri']
    assert uri.startswith('mongodb://127.0.0.1:')
    connection = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=3000)
    db = connection['geraina_customer_fix_test_' + uuid4().hex]
    user = {'id':'owner-a','store_id':'store-a','email':'audit@example.com','role':'Owner','plan':'business'}
    for module in (orders,purchase,inventory,customers,records,stock,reports,offline,products,webhooks):
        monkeypatch.setattr(module,'get_db',lambda:db)
    monkeypatch.setattr(database,'get_db',lambda:db)
    gateway = AsyncMock(return_value={'payment_request_id':'request-a','checkout_url':'https://example.com/pay'})
    monkeypatch.setattr(orders,'create_ewallet_charge',gateway)
    app=FastAPI()
    for module in (orders,purchase,inventory,customers,records,stock,reports,offline,products,webhooks):
        app.include_router(module.router)
    app.dependency_overrides[auth.get_current_user]=lambda:user
    await db.products.insert_one({'id':'coffee','store_id':'store-a','name':'Coffee','price':1000,'cost':400,'stock':10,'active':True})
    async with AsyncClient(transport=ASGITransport(app=app),base_url='http://test') as client:
        yield db,user,client,gateway
    await connection.drop_database(db.name)
    connection.close()


def sale(**changes):
    return {'items':[{'product_id':'coffee','name':'Coffee','price':1000,'quantity':1,'subtotal':1000}],
            'payment_method':'cash','cash_received':1000,**changes}


@pytest.mark.asyncio
@pytest.mark.parametrize('changes',[{'cash_received':None},{'tax_percent':-1},{'tax_percent':101},
    {'discount':1001},{'cash_received':999},{'items':[{'product_id':'coffee','name':'Coffee','price':1000,'quantity':1,'subtotal':1}]}])
async def test_invalid_sale_does_not_change_stock_or_create_order(shop,changes):
    db,_,client,_=shop
    assert (await client.post('/api/orders',json=sale(**changes))).status_code>=400
    assert await db.orders.count_documents({})==0
    assert (await db.products.find_one({'id':'coffee'}))['stock']==10


@pytest.mark.asyncio
async def test_retry_and_concurrent_void_are_exactly_once(shop):
    db,_,client,_=shop
    responses=await asyncio.gather(*[client.post('/api/orders',json=sale(),headers={'Idempotency-Key':'same-attempt'}) for _ in range(8)])
    assert all(r.status_code==200 for r in responses)
    identifier=responses[0].json()['id']
    assert all(r.json()['id']==identifier for r in responses)
    assert await db.orders.count_documents({})==1
    assert (await db.products.find_one({'id':'coffee'}))['stock']==9
    cancelled=await asyncio.gather(*[client.post(f'/api/orders/{identifier}/void') for _ in range(8)])
    assert all(r.status_code==200 for r in cancelled)
    assert (await db.products.find_one({'id':'coffee'}))['stock']==10
    assert (await client.post(f'/api/orders/{identifier}/mark-paid')).status_code==409


@pytest.mark.asyncio
async def test_failed_insert_rolls_back_and_retry_can_succeed(shop,monkeypatch):
    db,_,client,_=shop
    collection=db.orders
    original=collection.insert_one
    failed=AsyncMock(side_effect=RuntimeError('injected persistence failure'))
    class DatabaseProxy:
        def __getattr__(self,name):
            return collection if name=='orders' else getattr(db,name)
    monkeypatch.setattr(orders,'get_db',lambda:DatabaseProxy())
    monkeypatch.setattr(collection,'insert_one',failed)
    with pytest.raises(RuntimeError):
        await client.post('/api/orders',json=sale(),headers={'Idempotency-Key':'recoverable'})
    assert (await db.products.find_one({'id':'coffee'}))['stock']==10
    assert await db.orders.count_documents({})==0
    assert await db.checkout_attempts.count_documents({})==0
    monkeypatch.setattr(collection,'insert_one',original)
    assert (await client.post('/api/orders',json=sale(),headers={'Idempotency-Key':'recoverable'})).status_code==200


@pytest.mark.asyncio
@pytest.mark.parametrize('change',[{'active':False},{'stock':0},{'price':2000}])
async def test_unavailable_or_changed_product_is_rejected(shop,change):
    db,_,client,_=shop
    await db.products.update_one({'id':'coffee'},{'$set':change})
    assert (await client.post('/api/orders',json=sale())).status_code==409
    assert await db.orders.count_documents({})==0


@pytest.mark.asyncio
@pytest.mark.parametrize('identifier',['missing','foreign'])
async def test_checkout_cannot_reference_a_missing_or_foreign_product(shop,identifier):
    db,_,client,_=shop
    await db.products.insert_one({'id':'foreign','store_id':'other','name':'Private','price':1000,'stock':10,'active':True})
    body=sale(items=[{'product_id':identifier,'name':'Coffee','price':1000,'quantity':1,'subtotal':1000}])
    assert (await client.post('/api/orders',json=body)).status_code==409
    assert await db.orders.count_documents({})==0
    assert (await db.products.find_one({'id':'foreign'}))['stock']==10
    assert (await db.products.find_one({'id':'coffee'}))['stock']==10


@pytest.mark.asyncio
async def test_online_gateway_retry_reuses_the_durable_payment_intent(shop):
    db,_,client,gateway=shop
    await db.integrations.insert_one({'store_id':'store-a','xendit':{'is_active':True,'secret_key':'test-only','webhook_token':'test-only'}})
    body=sale(payment_method='ewallet',ewallet_channel='OVO')
    first=await client.post('/api/orders',json=body,headers={'Idempotency-Key':'wallet-attempt'})
    second=await client.post('/api/orders',json=body,headers={'Idempotency-Key':'wallet-attempt'})
    assert first.status_code==second.status_code==200
    assert first.json()['id']==second.json()['id']
    assert gateway.await_count==1


@pytest.mark.asyncio
async def test_receiving_is_itemized_atomic_and_exactly_once(shop):
    db,_,client,_=shop
    await db.suppliers.insert_one({'id':'supplier','store_id':'store-a','name':'Supplier'})
    body={'po_no':'PO-TEST','supplier_id':'supplier','total':1500,'items':[{'product_id':'coffee','qty':3,'cost':500}]}
    created=await client.post('/api/purchase/orders',json=body)
    assert created.status_code==200 and created.json()['items'][0]['qty']==3
    received=await asyncio.gather(*[client.post('/api/purchase/receiving',json={'po_no':'PO-TEST','request_id':'same-receipt'}) for _ in range(8)])
    assert all(r.status_code==200 for r in received)
    assert await db.goods_receiving.count_documents({})==1
    assert (await db.products.find_one({'id':'coffee'}))['stock']==13
    assert (await db.purchase_orders.find_one({'po_no':'PO-TEST'}))['items'][0]['received_qty']==3
    assert (await client.post('/api/purchase/receiving',json={'po_no':'MISSING'})).status_code==404


@pytest.mark.asyncio
async def test_linked_invoice_payment_and_reopening_are_consistent(shop):
    db,_,client,_=shop
    invoice=await client.post('/api/purchase/invoices',json={'invoice_no':'INV-A','po_no':'','amount':2000,'due_date':'2026-11-30'})
    assert invoice.status_code==200
    payable=await db.debt_payables.find_one({})
    paid=await client.put('/api/debt/payables/'+payable['id'],json={'paid_amount':1000,'status':'Partial'})
    assert paid.status_code==200
    assert (await db.supplier_invoices.find_one({}))['status']=='Partial'
    assert (await client.put('/api/debt/payables/'+payable['id'],json={'paid_amount':3000,'status':'Paid'})).status_code==422
    assert (await client.put('/api/purchase/invoices/'+invoice.json()['id'],json={'status':'Paid'})).status_code==200
    assert (await db.debt_payables.find_one({}))['paid_amount']==2000
    assert (await client.put('/api/purchase/invoices/'+invoice.json()['id'],json={'status':'Unpaid'})).status_code==200
    assert (await db.debt_payables.find_one({}))['paid_amount']==0


@pytest.mark.asyncio
async def test_adjustment_uses_product_id_and_authenticated_actor_even_without_sku(shop):
    db,user,client,_=shop
    await db.products.update_one({'id':'coffee'},{'$set':{'sku':''}})
    body={'product_id':'coffee','adjustment_qty':5,'type':'add','reason':'Physical count','created_by':'forged','request_id':'same-adjustment'}
    first=await client.post('/api/products/stock-adjustments',json=body)
    second=await client.post('/api/products/stock-adjustments',json=body)
    assert first.status_code==second.status_code==200
    assert first.json()['created_by']==user['email']
    assert first.json()['id']==second.json()['id']
    assert (await db.products.find_one({'id':'coffee'}))['stock']==15
    assert (await client.post('/api/products/stock-adjustments',json={**body,'adjustment_qty':-1})).status_code==422


@pytest.mark.asyncio
async def test_branch_transfers_reserve_receive_and_cancel_exactly_once(shop):
    db,_,client,_=shop
    await db.branches.insert_one({'id':'branch-b','store_id':'store-a','name':'Bandung'})
    body={'from_branch':'main','to_branch':'branch-b','items':[{'product_id':'coffee','qty':4}],'request_id':'ship-once'}
    shipped=await client.post('/api/products/stock-transfers',json=body)
    assert shipped.status_code==200
    identifier=shipped.json()['id']
    assert (await db.products.find_one({'id':'coffee'}))['stock']==6
    received=await asyncio.gather(*[client.post(f'/api/products/stock-transfers/{identifier}/receive') for _ in range(8)])
    assert all(r.status_code==200 for r in received)
    product=await db.products.find_one({'id':'coffee'})
    assert product['stock_by_branch']['branch-b']==4 and product['stock']==6
    assert (await client.post(f'/api/products/stock-transfers/{identifier}/cancel')).status_code==409
    back=await client.post('/api/products/stock-transfers',json={'from_branch':'branch-b','to_branch':'main','items':[{'product_id':'coffee','qty':2}]})
    assert back.status_code==200
    assert (await client.post('/api/products/stock-transfers/'+back.json()['id']+'/cancel')).status_code==200
    assert (await db.products.find_one({'id':'coffee'}))['stock_by_branch']['branch-b']==4


@pytest.mark.asyncio
async def test_complete_record_pages_and_real_movements_are_store_scoped(shop):
    db,user,client,_=shop
    await db.customers.insert_many([{'id':f'customer-{i:04d}','name':f'Customer {i}','store_id':'store-a'} for i in range(201)])
    await db.customers.insert_one({'id':'foreign','name':'Private','store_id':'other'})
    ids=[];cursor=None
    while True:
        response=await client.get('/api/records/customers',params={'limit':50,**({'cursor':cursor} if cursor else {})})
        assert response.status_code==200
        page=response.json();assert page['total']==201
        ids += [r['id'] for r in page['items']];cursor=page['next_cursor']
        if not cursor:break
    assert len(set(ids))==len(ids)==201 and 'foreign' not in ids
    await client.post('/api/orders',json=sale())
    user['role']='Warehouse'
    response=await client.get('/api/inventory/movements')
    assert response.status_code==200
    assert response.json()['total']==1
    assert response.json()['items'][0]['quantity']==-1
    assert response.json()['items'][0]['product_name']=='Coffee'


@pytest.mark.asyncio
@pytest.mark.parametrize('kind,collection,total',[('suppliers','suppliers',106),('invoices','supplier_invoices',101)])
async def test_older_suppliers_and_unpaid_invoices_have_complete_pages(shop,kind,collection,total):
    db,_,client,_=shop
    await db[collection].insert_many([{'id':f'row-{i:04d}','store_id':'store-a','status':'Unpaid'} for i in range(total)])
    await db[collection].insert_one({'id':'private','store_id':'other','status':'Unpaid'})
    ids=[];cursor=None
    while True:
        response=await client.get('/api/records/'+kind,params={'limit':50,**({'cursor':cursor} if cursor else {})})
        assert response.status_code==200
        data=response.json();assert data['total']==total
        ids.extend(row['id'] for row in data['items']);cursor=data['next_cursor']
        if not cursor:break
    assert len(ids)==len(set(ids))==total and 'private' not in ids


@pytest.mark.asyncio
async def test_historical_profit_uses_immutable_cost_and_flags_missing_legacy_cost(shop):
    db,_,client,_=shop
    assert (await client.post('/api/orders',json=sale())).status_code==200
    before=(await client.get('/api/reports/profit')).json()
    assert before['totals']['net_profit']==600
    await db.products.update_one({'id':'coffee'},{'$set':{'cost':800}})
    after=(await client.get('/api/reports/profit')).json()
    assert after['totals']['net_profit']==600
    await db.orders.insert_one({'id':'legacy','store_id':'store-a','created_at':database.utcnow().isoformat(),
          'payment_status':'paid','total':1000,'items':[{'product_id':'coffee','quantity':1}]})
    legacy=(await client.get('/api/reports/profit')).json()
    assert legacy['totals']['revenue']==2000
    assert legacy['totals']['net_profit'] is None and not legacy['cost_complete']
    assert legacy['unknown_cost_orders']==1


@pytest.mark.asyncio
async def test_loyalty_awards_once_and_void_reverses_once(shop):
    db,_,client,_=shop
    await db.customers.insert_one({'id':'member','store_id':'store-a','name':'Member','phone':'0812000','loyalty_points':0})
    await db.loyalty_rules.insert_one({'store_id':'store-a','conversion_rate':1000,'point_value':100,'min_redeem_points':1})
    first=await client.post('/api/orders',json=sale(customer_id='member'),headers={'Idempotency-Key':'member-sale'})
    assert first.status_code==200
    await client.post('/api/orders',json=sale(customer_id='member'),headers={'Idempotency-Key':'member-sale'})
    assert (await db.customers.find_one({'id':'member'}))['loyalty_points']==1
    for _ in range(2):await client.post('/api/orders/'+first.json()['id']+'/void')
    assert (await db.customers.find_one({'id':'member'}))['loyalty_points']==0


@pytest.mark.asyncio
@pytest.mark.parametrize('zone',['WIB (UTC+7)','WITA (UTC+8)','WIT (UTC+9)'])
async def test_today_uses_the_store_day_and_chart_matches_same_boundary(shop,monkeypatch,zone):
    from datetime import datetime,timezone,timedelta
    db,_,client,_=shop
    clock=datetime(2026,10,26,3,0,tzinfo=timezone.utc)
    monkeypatch.setattr(orders,'utcnow',lambda:clock)
    await db.settings.insert_one({'store_id':'store-a','general':{'timezone':zone}})
    await db.orders.insert_one({'id':'early-local','store_id':'store-a','created_at':(clock.replace(hour=0)-timedelta(minutes=30)).isoformat(),
           'payment_status':'paid','total':1000})
    stats=(await client.get('/api/orders/stats')).json()
    assert stats['today_date']=='2026-10-26' and stats['today_sales']==1000
    assert stats['daily_sales'][-1]=={'date':'2026-10-26','value':1000}


@pytest.mark.asyncio
async def test_legacy_offline_replay_hash_remains_compatible(shop):
    import hashlib
    db,user,client,_=shop
    identifier=str(uuid4())
    body={**sale(),'expected_store_id':user['store_id'],'expected_cashier_id':user['id'],
          'client_order_id':identifier,'sold_at':database.utcnow().isoformat()}
    parsed=offline.OfflineCashSale(**body)
    legacy=parsed.model_dump(mode='json');legacy.pop('customer_id')
    for line in legacy['items']:line.pop('unit_cost')
    digest=hashlib.sha256(json.dumps(legacy,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    await db.orders.insert_one({'_id':'offline:store-a:'+identifier,'id':identifier,'store_id':'store-a',
          'cashier_id':user['id'],'offline_request_hash':digest,'payment_status':'paid'})
    response=await client.post('/api/offline/orders',json=body)
    assert response.status_code==200 and response.json()['id']==identifier
    assert await db.orders.count_documents({})==1
    assert (await db.products.find_one({'id':'coffee'}))['stock']==10


@pytest.mark.asyncio
async def test_failed_provider_release_and_late_paid_do_not_corrupt_inventory(shop):
    from payment_state import provider_transition
    db,_,client,_=shop
    await db.integrations.insert_one({'store_id':'store-a','xendit':{'is_active':True,'secret_key':'test-only','webhook_token':'test-only'}})
    created=await client.post('/api/orders',json=sale(payment_method='ewallet',ewallet_channel='OVO'))
    assert created.status_code==200
    scope={'store_id':'store-a','id':created.json()['id']}
    for _ in range(2):await provider_transition(db,scope,'failed',{'xendit_webhook_payload':{'status':'FAILED'}})
    assert (await db.products.find_one({'id':'coffee'}))['stock']==10
    await provider_transition(db,scope,'paid',{'xendit_webhook_payload':{'status':'SUCCESS'}})
    record=await db.orders.find_one(scope)
    assert record['payment_status']=='failed' and record.get('payment_exception')
    await client.post('/api/orders/'+record['id']+'/void')
    assert (await db.products.find_one({'id':'coffee'}))['stock']==10


@pytest.mark.asyncio
async def test_gateway_timeout_preserves_intent_and_retry_never_charges_again(shop):
    import httpx
    db,_,client,gateway=shop
    gateway.side_effect=httpx.ReadTimeout('simulated response lost')
    await db.integrations.insert_one({'store_id':'store-a','xendit':{'is_active':True,'secret_key':'test-only','webhook_token':'test-only'}})
    body=sale(payment_method='ewallet',ewallet_channel='OVO')
    first=await client.post('/api/orders',json=body,headers={'Idempotency-Key':'timeout-attempt'})
    second=await client.post('/api/orders',json=body,headers={'Idempotency-Key':'timeout-attempt'})
    assert first.status_code==second.status_code==200
    assert first.json()['id']==second.json()['id']
    assert second.json()['payment_initialization']=='uncertain'
    assert gateway.await_count==1 and await db.orders.count_documents({})==1
    assert (await db.products.find_one({'id':'coffee'}))['stock']==9


@pytest.mark.asyncio
async def test_signed_doku_notifications_require_exact_amount_and_handle_cancel_once(shop):
    import base64,hashlib
    from doku_client import _sign
    db,_,_,_=shop
    await db.integrations.insert_one({'store_id':'store-a','doku':{'is_active':True,'client_id':'audit-client','shared_key':'audit-key'}})
    await db.orders.insert_one({'id':'doku-sale','store_id':'store-a','order_no':'DOKU-A','total':1000,'payment_method':'doku',
          'payment_status':'pending','inventory_applied':True,'inventory_ledger_version':1,
          'items':[{'product_id':'coffee','name':'Coffee','quantity':1}]})
    await db.products.update_one({'id':'coffee'},{'$set':{'stock':9}})
    async def notify(status,amount=1000):
        raw=json.dumps({'order':{'invoice_number':'DOKU-A','amount':amount},'transaction':{'status':status}}).encode()
        timestamp=database.utcnow().isoformat();request_id=str(uuid4())
        signature=_sign('audit-client',request_id,timestamp,'/api/webhooks/doku',base64.b64encode(hashlib.sha256(raw).digest()).decode(),'audit-key')
        await webhooks._process_doku(raw,{'client-id':'audit-client','request-id':request_id,'request-timestamp':timestamp,'signature':signature})
    await notify('FAILED')
    await notify('SUCCESS',999)
    assert (await db.orders.find_one({'id':'doku-sale'}))['payment_status']=='pending'
    for _ in range(2): await notify('CANCEL')
    assert (await db.orders.find_one({'id':'doku-sale'}))['payment_status']=='voided'
    assert (await db.products.find_one({'id':'coffee'}))['stock']==10
    assert await db.stock_movements.count_documents({})==1
    await notify('SUCCESS')
    record=await db.orders.find_one({'id':'doku-sale'})
    assert record['payment_status']=='voided' and record.get('payment_exception')


@pytest.mark.asyncio
async def test_product_stock_compare_and_set_and_import_ledger_and_capacity(shop):
    db,user,client,_=shop
    results=await asyncio.gather(*[client.put('/api/products/coffee',json={'stock':12,'expected_stock':10}) for _ in range(5)])
    assert sorted(r.status_code for r in results)==[200,409,409,409,409]
    assert (await db.products.find_one({'id':'coffee'}))['stock']==12
    assert (await db.stock_movements.find_one({}))['quantity']==2
    await db.products.update_one({'id':'coffee'},{'$set':{'sku':'COFFEE'}})
    user['plan']='starter'
    await db.products.insert_many([{'id':f'capacity-{i}','store_id':'store-a'} for i in range(999)])
    result=await client.post('/api/products/bulk-import',files={'file':('audit.csv','name,sku,price,cost,stock\nCoffee,COFFEE,1000,400,13\nNew,NEW,1000,400,2\n','text/csv')})
    assert result.status_code==200
    assert result.json()['updated']==1 and result.json()['inserted']==0 and result.json()['errors']
    assert (await db.products.find_one({'id':'coffee'}))['stock']==13
    assert await db.products.count_documents({'store_id':'store-a'})==1000
    assert await db.stock_movements.count_documents({})==2


@pytest.mark.asyncio
async def test_manual_loyalty_correction_requires_authority_and_current_balance(shop):
    db,user,client,_=shop
    await db.customers.insert_one({'id':'member','store_id':'store-a','name':'Member','loyalty_points':5})
    body={'name':'Member','loyalty_points':10,'expected_loyalty_points':5}
    user['role']='Cashier'
    assert (await client.put('/api/customers/member',json=body)).status_code==403
    user['role']='Owner'
    assert (await client.put('/api/customers/member',json={**body,'expected_loyalty_points':4})).status_code==409
    assert (await client.put('/api/customers/member',json=body)).status_code==200
    assert (await db.customers.find_one({'id':'member'}))['loyalty_points']==10
    assert await db.loyalty_events.count_documents({'type':'manual_correction'})==1


@pytest.mark.asyncio
async def test_line_subtotals_cannot_drift_by_a_cent_or_pollute_sales_totals(shop):
    db,_,client,_=shop
    wrong=sale(items=[{'product_id':'coffee','name':'Coffee','price':1000,'quantity':1,'subtotal':999.99}])
    assert (await client.post('/api/orders',json=wrong)).status_code==422
    await db.products.update_one({'id':'coffee'},{'$set':{'price':0.1}})
    valid=sale(items=[{'product_id':'coffee','name':'Coffee','price':0.1,'quantity':3,'subtotal':0.30000000000000004}])
    response=await client.post('/api/orders',json=valid)
    assert response.status_code==200
    assert response.json()['items'][0]['subtotal']==response.json()['subtotal']==0.3
