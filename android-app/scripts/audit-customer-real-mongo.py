"""Independent HTTP reproductions using only the disposable loopback replica set."""
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import requests
from pymongo import MongoClient

HOST='http://127.0.0.1:8848'
db=MongoClient('mongodb://127.0.0.1:8847/?replicaSet=customerAudit',serverSelectionTimeoutMS=3000).geraina_customer_audit
results=[]


def payload(**changes):
    return {'items':[{'product_id':'product-0000','name':'Audit Product 0000','price':1000,'quantity':1,'subtotal':1000}],'payment_method':'cash','cash_received':1000,**changes}


def run(identifier,fn):
    requests.post(HOST+'/__audit/reset',json={},timeout=10).raise_for_status()
    login=requests.post(HOST+'/api/auth/login',json={'email':'owner-a@example.com','password':'DisposableAudit123'},timeout=10).json()
    headers={'Authorization':'Bearer '+login['access_token']}
    def api(method,url,data=None,extra=None):
        return requests.request(method,HOST+'/api'+url,headers={**headers,**(extra or {})},json=data,timeout=10)
    try:
        fn(api)
        result={'id':identifier,'status':'passed'}
    except AssertionError as e:
        result={'id':identifier,'status':'failed','detail':str(e)}
    except Exception as e:
        result={'id':identifier,'status':'inconclusive','detail':type(e).__name__+': '+str(e)}
    results.append(result);print(result['status'].upper()+': '+identifier,flush=True)


def totals(api):
    p=payload();p['items'][0]['subtotal']=1
    r=api('POST','/orders',p)
    assert r.status_code>=400 or r.json()['total']==1000,f'HTTP {r.status_code}; line 1000 x 1 recorded at total {r.json().get("total")}'


run('ORDER-LINE-TOTAL',totals)


def no_cash(api):
    p=payload();del p['cash_received'];r=api('POST','/orders',p)
    assert r.status_code>=400,f'HTTP {r.status_code}; payment_status={r.json().get("payment_status")}'


run('CASH-REQUIRED',no_cash)


def negative_tax(api):
    r=api('POST','/orders',payload(tax_percent=-200))
    assert r.status_code>=400,f'HTTP {r.status_code}; paid total={r.json().get("total")}'


run('ORDER-NEGATIVE-TAX',negative_tax)


def product_reference(api):
    p=payload();p['items'][0]['product_id']='foreign-product';r=api('POST','/orders',p)
    assert r.status_code>=400,f'HTTP {r.status_code}; another store product ID accepted as a sale item'


run('ORDER-FOREIGN-PRODUCT',product_reference)


def zero_stock(api):
    db.products.update_one({'id':'product-0000'},{'$set':{'stock':0}})
    r=api('POST','/orders',payload())
    assert r.status_code>=400 or r.json().get('inventory_warnings'),f'Stock became {db.products.find_one({"id":"product-0000"})["stock"]} without warning'


run('ORDER-STOCK',zero_stock)


def retry(api):
    first=api('POST','/orders',payload(),{'Idempotency-Key':'audit-same-attempt'}).json()
    second=api('POST','/orders',payload(),{'Idempotency-Key':'audit-same-attempt'}).json()
    assert first['id']==second['id'],f'Same keyed attempt created {db.orders.count_documents({})} orders and stock={db.products.find_one({"id":"product-0000"})["stock"]}'


run('ORDER-RETRY',retry)


def resurrect(api):
    order=api('POST','/orders',payload()).json()
    api('POST',f'/orders/{order["id"]}/void')
    r=api('POST',f'/orders/{order["id"]}/mark-paid')
    assert r.status_code>=400,f'Voided -> {r.json().get("payment_status")}; stock={db.products.find_one({"id":"product-0000"})["stock"]}'


run('VOID-TERMINAL',resurrect)


def concurrent_void(api):
    order=api('POST','/orders',payload()).json()
    with ThreadPoolExecutor(max_workers=8) as pool:
        responses=list(pool.map(lambda _:api('POST',f'/orders/{order["id"]}/void'),range(8)))
    stock=db.products.find_one({'id':'product-0000'})['stock']
    assert stock==10,f'8 concurrent cancellations returned {[r.status_code for r in responses]}; final stock={stock}, expected 10'


run('VOID-CONCURRENT',concurrent_void)


def lines(api):
    r=api('POST','/purchase/orders',{'po_no':'PO-LINES','supplier_id':'supplier-a','supplier_name':'Audit supplier','total':5000,'items':[{'product_id':'product-0000','qty':5,'cost':1000}]}).json()
    assert r.get('items'),f'Persisted fields={list(db.purchase_orders.find_one({}, {"_id":0}).keys())}; no product lines'


run('PURCHASE-LINES',lines)


def receiving(api):
    requests.post(HOST+'/__audit/scenario/purchase',timeout=10).raise_for_status()
    r=api('POST','/purchase/receiving',{'po_no':'PO-AUDIT','gr_no':'GR-AUDIT','received_by':'Audit owner'})
    stock=db.products.find_one({'id':'product-0000'})['stock']
    assert stock==15,f'HTTP {r.status_code}; PO={db.purchase_orders.find_one({})["status"]}; actual stock={stock}, expected 15'


run('RECEIVING-STOCK',receiving)


def debt(api):
    api('POST','/purchase/invoices',{'invoice_no':'INV-AUDIT','po_no':'PO-AUDIT','amount':5000,'status':'Unpaid','due_date':'2026-11-30'})
    payable=db.debt_payables.find_one({})
    api('PUT','/debt/payables/'+payable['id'],{'paid_amount':5000,'status':'Paid'})
    assert db.supplier_invoices.find_one({})['status']=='Paid',f'Payable={db.debt_payables.find_one({})["status"]}; invoice={db.supplier_invoices.find_one({})["status"]}'


run('DEBT-INVOICE',debt)


for collection,url in [('customers','/customers'),('suppliers','/suppliers')]:
    def complete(api,collection=collection,url=url):
        count=201 if collection=='customers' else 105
        db[collection].insert_many([{'id':f'{collection}-{i}','store_id':'store-a','name':f'Customer {i:03d}'} for i in range(count)])
        expected=db[collection].count_documents({'store_id':'store-a'})
        r=api('GET',url);assert r.status_code==200
        actual=len(r.json())
        assert actual==expected,f'{expected} records saved, only {actual} returned, no paging/total envelope'
    run('LIST-'+collection.upper(),complete)


def invoices(api):
    db.supplier_invoices.insert_many([{'id':f'inv-{i}','store_id':'store-a','invoice_no':f'INV-{i}',
        'po_no':'PO-AUDIT','amount':1000,'status':'Unpaid','due_date':'2026-10-20',
        'created_at':datetime.now(timezone.utc).isoformat()} for i in range(101)])
    r=api('GET','/purchase/invoices')
    assert r.status_code==200
    assert len(r.json())==101,f'101 unpaid invoices saved; UI list response has only {len(r.json())}, without search/paging/total'


run('LIST-UNPAID-INVOICES',invoices)


def local_day(api):
    at=datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0)-timedelta(hours=1)
    db.orders.insert_one({'id':'local-day','store_id':'store-a','payment_status':'paid','total':1000,'created_at':at.isoformat()})
    r=api('GET','/orders/stats').json()
    assert r['today_sales']==1000,f'WIB store today excludes sale at {at.isoformat()}; today_sales={r["today_sales"]}'


run('REPORT-LOCAL-DAY',local_day)


def cost(api):
    api('POST','/orders',payload());before=api('GET','/reports/profit').json()['totals']['net_profit']
    api('PUT','/products/product-0000',{'cost':800});after=api('GET','/reports/profit').json()['totals']['net_profit']
    assert before==after,f'Past net profit changed from {before} to {after} after current cost edit'


run('REPORT-HISTORICAL-COST',cost)


out=Path(__file__).resolve().parents[1]/'app/build/reports/customer-audit/real-mongo-invariants.json'
out.write_text(json.dumps({'scope':'Actual HTTP API + actual disposable MongoDB replica at 127.0.0.1; no mocked API/database responses','productionWrites':0,'results':results,'passed':sum(r['status']=='passed' for r in results),'failed':sum(r['status']=='failed' for r in results),'inconclusive':sum(r['status']=='inconclusive' for r in results)},indent=2),encoding='utf-8')
