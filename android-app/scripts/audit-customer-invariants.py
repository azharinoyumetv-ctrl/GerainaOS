"""Adversarial customer workflows; expected invariants and observed failures.

Actual FastAPI routes/authentication, isolated in-memory database per case.
This is a diagnostic, not a replacement for real Mongo transaction/hardware tests.
"""
import asyncio
import importlib.util
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
import logging
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('local_audit', Path(__file__).with_name('customer-audit-server.py'))
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)
logging.getLogger('httpx').setLevel(logging.WARNING)
client = TestClient(host.app)
results = []


def reset():
    asyncio.run(host.reset({}))
    response = client.post('/api/auth/login', json={'email':'owner-a@example.com','password':host.PASSWORD})
    assert response.status_code == 200
    return {'Authorization':'Bearer '+response.json()['access_token']}


def order(**changes):
    return {'items':[{'product_id':'product-0000','name':'Audit Product 0000','price':1000,'quantity':1,'subtotal':1000}], 'payment_method':'cash','cash_received':1000,**changes}


def snapshot():
    return client.get('/__audit/snapshot').json()


def case(identifier, name, fn):
    headers=reset()
    try:
        actual=fn(headers)
        results.append({'id':identifier,'name':name,'status':'passed','observed':actual})
    except AssertionError as error:
        results.append({'id':identifier,'name':name,'status':'failed','detail':str(error)})
    except Exception as error:
        results.append({'id':identifier,'name':name,'status':'inconclusive','detail':type(error).__name__+': '+str(error)})
    print(results[-1]['status'].upper()+': '+identifier+' '+name, flush=True)


def normal_cash(h):
    result=client.post('/api/orders',headers=h,json=order()).json()
    assert result['total']==1000 and result['payment_status']=='paid'
    assert snapshot()['products'][0]['stock']==9
    return {'total':result['total'],'stock':9}


case('CASH-HAPPY','A paid cash sale decrements stock exactly once',normal_cash)


def forged_subtotal(h):
    payload=order();payload['items'][0]['subtotal']=1
    r=client.post('/api/orders',headers=h,json=payload)
    total=r.json().get('total')
    assert r.status_code>=400 or total==1000, f'price=1000 x quantity=1 with subtotal=1 returned HTTP {r.status_code}, total={total}; stock={snapshot()["products"][0]["stock"]}'


case('ORDER-LINE-TOTAL','Server reconciles line quantity/price with its subtotal',forged_subtotal)


def missing_cash(h):
    payload=order();payload.pop('cash_received')
    r=client.post('/api/orders',headers=h,json=payload)
    assert r.status_code>=400, f'Cash with no received amount returned HTTP {r.status_code}, status={r.json().get("payment_status")}'


case('CASH-REQUIRED','Cash checkout requires a received amount',missing_cash)


for identifier in ('missing-product','foreign-product'):
    def invalid_product(h,identifier=identifier):
        payload=order();payload['items'][0]['product_id']=identifier
        r=client.post('/api/orders',headers=h,json=payload)
        assert r.status_code>=400, f'{identifier} accepted with HTTP {r.status_code}, order count={len(snapshot()["orders"])}'
    case('ORDER-'+identifier.upper(),'A sale references an existing product in its own store',invalid_product)


def inactive(h):
    client.post('/__audit/scenario/inactive')
    r=client.post('/api/orders',headers=h,json=order())
    assert r.status_code>=400, f'Inactive product accepted with HTTP {r.status_code}'


case('ORDER-INACTIVE','Online checkout rejects an inactive product',inactive)


def negative_total(h):
    r=client.post('/api/orders',headers=h,json=order(tax_percent=-200))
    assert r.status_code>=400, f'Negative tax produced HTTP {r.status_code}, total={r.json().get("total")}, change={r.json().get("change")}'


case('ORDER-NEGATIVE-TAX','Negative tax cannot produce a paid negative sale',negative_total)


def insufficient(h):
    client.post('/__audit/scenario/empty-stock')
    r=client.post('/api/orders',headers=h,json=order())
    assert r.status_code>=400 or r.json().get('inventory_warnings'), f'Online sale accepted at stock 0; resulting stock={snapshot()["products"][0]["stock"]}, warning={r.json().get("inventory_warnings")}'


case('ORDER-STOCK','Online overselling is rejected or explicitly warned',insufficient)


def retry(h):
    headers={**h,'Idempotency-Key':'disposable-audit-payment-attempt'}
    first=client.post('/api/orders',headers=headers,json=order()).json()
    second=client.post('/api/orders',headers=headers,json=order()).json()
    assert first['id']==second['id'], f'Retrying the same keyed request created {len(snapshot()["orders"])} orders; stock={snapshot()["products"][0]["stock"]}'


case('ORDER-RETRY','Repeated online payment attempt cannot duplicate a sale',retry)


def void_repay(h):
    r=client.post('/api/orders',headers=h,json=order()).json()
    client.post(f'/api/orders/{r["id"]}/void',headers=h)
    final=client.post(f'/api/orders/{r["id"]}/mark-paid',headers=h)
    assert final.status_code>=400, f'Voided sale became {final.json().get("payment_status")}; stock={snapshot()["products"][0]["stock"]} (already restored)'


case('VOID-TERMINAL','Voided sale cannot reappear as revenue with restored stock',void_repay)


def invoice_round_trip(h):
    made=client.post('/api/purchase/invoices',headers=h,json={'invoice_no':'INV-AUDIT','po_no':'PO-AUDIT','amount':5000,'status':'Unpaid','due_date':'2026-11-30'}).json()
    url='/api/purchase/invoices/'+made['id']
    client.put(url,headers=h,json={'status':'Paid'})
    client.put(url,headers=h,json={'status':'Unpaid'})
    state=snapshot()
    invoice=state['supplier_invoices'][0];debt=state['debt_payables'][0]
    assert invoice['status'].lower()==debt['status'].lower(), f'Invoice={invoice["status"]}, matching payable={debt["status"]}, paid_amount={debt["paid_amount"]}'


case('INVOICE-DEBT','Reopening an invoice keeps the matching payable consistent',invoice_round_trip)


def overpaid_debt(h):
    r=client.post('/api/debt/payables',headers=h,json={'supplier_name':'Audit supplier','invoice_no':'AUDIT','amount':1000,'paid_amount':0,'status':'Unpaid','due_date':'2026-11-30'}).json()
    paid=client.put('/api/debt/payables/'+r['id'],headers=h,json={'paid_amount':2000,'status':'Paid'})
    assert paid.status_code>=400, f'Payable amount 1000 accepted paid_amount={paid.json().get("paid_amount")} with HTTP {paid.status_code}'


case('DEBT-OVERPAY','Debt payment cannot exceed the debt amount',overpaid_debt)


def invalid_adjustment(h):
    r=client.post('/api/products/stock-adjustments',headers=h,json={'product_name':'Audit Product 0000','sku':'AUDIT-0000','adjustment_qty':-5,'type':'add','reason':'Audit','created_by':'Forged author'})
    assert r.status_code>=400, f'Adding -5 was accepted; stock={snapshot()["products"][0]["stock"]}, recorded_author={r.json().get("created_by")}'


case('ADJUSTMENT-VALIDATION','Inventory additions require a positive amount',invalid_adjustment)


def purchase_lines(h):
    r=client.post('/api/purchase/orders',headers=h,json={'po_no':'PO-LINES','supplier_id':'supplier-a','supplier_name':'Audit supplier','total':5000,'items':[{'product_id':'product-0000','quantity':5,'price':1000}]}).json()
    assert r.get('items'), f'Saved purchase fields: {sorted(r.keys())}; selected product and quantity were discarded'


case('PURCHASE-LINES','Purchase preserves product and quantity lines',purchase_lines)


def receiving(h):
    client.post('/__audit/scenario/purchase')
    r=client.post('/api/purchase/receiving',headers=h,json={'po_no':'PO-AUDIT','gr_no':'GR-AUDIT','received_by':'Audit owner'})
    state=snapshot();stock=state['products'][0]['stock']
    assert r.status_code==200 and stock==15, f'HTTP {r.status_code}; PO status={state["purchase_orders"][0]["status"]}, actual stock={stock}, expected=15'


case('RECEIVING-STOCK','Received goods update inventory quantities',receiving)


def receiving_unknown(h):
    r=client.post('/api/purchase/receiving',headers=h,json={'po_no':'DOES-NOT-EXIST','gr_no':'GR-AUDIT','received_by':'Audit owner'})
    assert r.status_code>=400, f'Receipt accepted for nonexistent PO with HTTP {r.status_code}'


case('RECEIVING-REFERENCE','A goods receipt must reference a real store purchase',receiving_unknown)


def tenant_boundary(h):
    response=client.put('/api/products/foreign-product',headers=h,json={'stock':0})
    assert response.status_code==404
    assert next(p for p in snapshot()['products'] if p['id']=='foreign-product')['stock']==20


case('TENANT-PRODUCT','Other-store product writes are rejected',tenant_boundary)


def permission_boundary(h):
    response=client.post('/api/auth/login',json={'email':'cashier@example.com','password':host.PASSWORD})
    headers={'Authorization':'Bearer '+response.json()['access_token']}
    assert client.post('/api/payments/config',headers=headers,json={'cash':{'is_active':False}}).status_code==403
    assert client.get('/api/integrations',headers=headers).status_code==403
    assert client.post('/api/orders/arbitrary/void',headers=headers).status_code==403


case('CASHIER-AUTHORITY','Cashier cannot access credentials, payment settings or owner void',permission_boundary)


def failed_insert(h):
    import routes_orders
    db=host.database.get_db()
    original=routes_orders.get_db
    class Proxy:
        def __getattr__(self,name):
            if name=='orders':
                class BrokenOrders:
                    insert_one=AsyncMock(side_effect=RuntimeError('Injected order-storage failure'))
                return BrokenOrders()
            return getattr(db,name)
    routes_orders.get_db=lambda:Proxy()
    try:
        try:
            client.post('/api/orders',headers=h,json=order())
        except RuntimeError:
            pass
    finally:
        routes_orders.get_db=original
    state=snapshot()
    assert state['products'][0]['stock']==10, f'Order insert failed twice; orders={len(state["orders"])}, stock={state["products"][0]["stock"]} (should roll back to 10)'


case('ORDER-ATOMICITY','Failed order storage cannot leave stock deducted without a sale',failed_insert)


def local_day(h):
    # The seeded store says WIB (UTC+7). Yesterday 23:00 UTC is today 06:00 WIB.
    at=datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0)-timedelta(hours=1)
    asyncio.run(host.database.get_db().orders.insert_one({'id':'early-local-sale','store_id':'store-a','payment_status':'paid','total':1000,'created_at':at.isoformat()}))
    r=client.get('/api/orders/stats',headers=h).json()
    assert r['today_sales']==1000, f'Store timezone=WIB; sale at {at.isoformat()} belongs to current local day but today_sales={r["today_sales"]}'


case('REPORT-LOCAL-DAY','Today totals follow the configured store day',local_day)


def historical_cost(h):
    client.post('/api/orders',headers=h,json=order())
    before=client.get('/api/reports/profit',headers=h).json()['totals']
    client.put('/api/products/product-0000',headers=h,json={'cost':800})
    after=client.get('/api/reports/profit',headers=h).json()['totals']
    assert before['net_profit']==after['net_profit'], f'Editing current product cost from 400 to 800 rewrote recorded sale net profit from {before["net_profit"]} to {after["net_profit"]}'


case('REPORT-HISTORICAL-COST','Current cost edits do not rewrite historical sale profit',historical_cost)


for collection,url in [('customers','/api/customers'),('suppliers','/api/suppliers')]:
    def complete_list(h,collection=collection,url=url):
        db=host.database.get_db()
        existing=asyncio.run(db[collection].count_documents({'store_id':'store-a'}))
        asyncio.run(db[collection].insert_many([{'id':f'{collection}-{i:03d}','store_id':'store-a','name':f'Audit {i:03d}'} for i in range(105)]))
        r=client.get(url,headers=h)
        assert r.status_code==200
        rows=r.json()
        assert len(rows)==105+existing, f'{collection}: {105+existing} saved records, list returns only {len(rows)} with no cursor/count boundary'
    case('LIST-'+collection.upper(),'Business record lists expose their complete results',complete_list)


def no_sku_adjustment(h):
    client.put('/api/products/product-0000',headers=h,json={'sku':''})
    r=client.post('/api/products/stock-adjustments',headers=h,json={'product_name':'Audit Product 0000','sku':'N/A','adjustment_qty':5,'type':'add','reason':'Audit receive','created_by':'Owner'})
    stock=snapshot()['products'][0]['stock']
    assert r.status_code>=400 or stock==15, f'Product without SKU: adjustment returned HTTP {r.status_code} but stock stayed {stock}; expected 15'


case('ADJUSTMENT-PRODUCT-ID','An adjustment cannot report success without updating the selected product',no_sku_adjustment)


def pay_linked_debt(h):
    client.post('/api/purchase/invoices',headers=h,json={'invoice_no':'INV-LINKED','po_no':'PO-AUDIT','amount':5000,'status':'Unpaid','due_date':'2026-11-30'})
    payable=snapshot()['debt_payables'][0]
    client.put('/api/debt/payables/'+payable['id'],headers=h,json={'paid_amount':5000,'status':'Paid'})
    state=snapshot()
    assert state['supplier_invoices'][0]['status'].lower()=='paid', f'Payable={state["debt_payables"][0]["status"]}, matching invoice={state["supplier_invoices"][0]["status"]}'


case('DEBT-INVOICE','Paying an invoice through Hutang updates both linked screens',pay_linked_debt)


def loyalty(h):
    customer=client.post('/api/customers',headers=h,json={'name':'Audit member','phone':'081200000000','loyalty_points':0}).json()
    client.post('/api/customers/loyalty',headers=h,json={'conversion_rate':1000,'point_value':100,'min_redeem_points':1})
    client.post('/api/orders',headers=h,json=order(customer_name=customer['name'],customer_phone=customer['phone']))
    saved=next(c for c in client.get('/api/customers',headers=h).json() if c['id']==customer['id'])
    assert saved['loyalty_points']==1, f'Configured Rp1000=1 point; matched customer paid Rp1000, saved loyalty_points={saved["loyalty_points"]}'


case('LOYALTY-ACCRUAL','Saved earning rules are applied to a paid customer sale',loyalty)


def invalid_transfer(h):
    r=client.post('/api/products/stock-transfers',headers=h,json={'from_branch':'Nonexistent branch','to_branch':'Nonexistent branch','items':[{'name':'Audit Product 0000','qty':-5}],'status':'Shipped'})
    assert r.status_code>=400,f'HTTP {r.status_code}; nonexistent identical branches and negative quantity recorded as {r.json().get("status")}'


case('TRANSFER-VALIDATION','A shipped transfer requires valid distinct branches and positive product quantities',invalid_transfer)
output=ROOT/'android-app/app/build/reports/customer-audit/api-invariants.json'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps({'scope':'Actual API/auth handlers, disposable in-memory stores; diagnostic only; no external providers', 'productionWrites':0,'results':results,'passed':sum(r['status']=='passed' for r in results),'failed':sum(r['status']=='failed' for r in results),'inconclusive':sum(r['status']=='inconclusive' for r in results)},indent=2),encoding='utf-8')
print('Evidence:',output)
