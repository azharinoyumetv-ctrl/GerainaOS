"""Loopback-only add-on bench, real disposable Mongo transactions, no provider HTTP."""
import os,sys,socket,json,base64,hmac,hashlib
from pathlib import Path
from datetime import timedelta
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'backend'))
os.environ.update(ENV='test',JWT_SECRET_KEY='addon-audit-local-only-not-a-production-secret',MONGO_URL='mongodb://127.0.0.1:8847/?replicaSet=customerAudit',DB_NAME='geraina_addon_audit')
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
import database
database._db=AsyncIOMotorClient('mongodb://127.0.0.1:8847/?replicaSet=customerAudit').geraina_addon_audit
async def deny_http(*args,**kwargs):raise RuntimeError('External HTTP is disabled in the add-on bench')
httpx.AsyncClient.request=deny_http
original_connect=socket.socket.connect
def connect(self,address):
    if isinstance(address,tuple) and address[0] not in ('127.0.0.1','::1','localhost'):raise RuntimeError('External sockets are disabled')
    return original_connect(self,address)
socket.socket.connect=connect
import auth,billing_subscriptions as billing
from server import app
from fastapi import Body,HTTPException
OWNER='11111111-1111-4111-8111-111111111111';STORE='22222222-2222-4222-8222-222222222222'
PASSWORD='DisposableAudit123';HASH=auth.hash_password(PASSWORD)

def decode_receipt(receipt):
    payload,signature=receipt.split('.')
    actual=base64.urlsafe_b64decode(signature+'='*(-len(signature)%4))
    expected=hmac.new(b'dagangos-subscription-receipt-v1:addon-audit-key',payload.encode(),hashlib.sha256).digest()
    if not hmac.compare_digest(actual,expected):raise ValueError('Invalid local receipt')
    return json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))

async def payment_status(receipt):
    c=decode_receipt(receipt);invoice=await database.get_db().audit_invoices.find_one({'external_id':c['orderId']})
    state='pending' if not invoice else {'PENDING':'pending','PAID':'paid','EXPIRED':'failed','REFUNDED':'refunded'}[invoice['status']]
    if invoice and (invoice['amount']!=c['amount'] or invoice['currency']!='IDR'):state='unverified'
    return {'orderId':c['orderId'],'ownerId':c['ownerId'],'storeId':c['storeId'],**{k:c[k] for k in ('module','tier','period','amount')},
        **({'kind':'addon','addonId':c['addonId'],'renewalId':c.get('renewalId')} if c.get('kind')=='addon' else {}),'status':state,'paidAt':invoice.get('paid_at') if invoice else None}
billing.fetch_payment_status=payment_status

@app.post('/__audit/reset')
async def reset(payload:dict=Body(default={})):
    db=database.get_db()
    for name in await db.list_collection_names():await db[name].delete_many({})
    plan=payload.get('plan','pro');now=database.utcnow();sub={'tier':plan,'period':'monthly','status':'active','order_id':'audit-base-order','paid_at':now.isoformat(),'expires_at':(now+timedelta(days=20)).isoformat()}
    user={'id':OWNER,'store_id':STORE,'store_name':'Add-on audit','email':'owner@example.com','password_hash':HASH,'role':'Owner','plan':plan,'credential_version':0,'trial_ends_at':(now+timedelta(days=14)).isoformat()}
    if plan in ('pro','business'):user['subscriptions']={'geraina':sub}
    if plan=='expired':user.update(plan='trial',trial_ends_at=(now-timedelta(days=1)).isoformat())
    await db.users.insert_one(user);await db.stores.insert_one({'id':STORE,'owner_user_id':OWNER,'module':'geraina','name':'Add-on audit','plan':plan,**({'subscription':sub} if plan in ('pro','business') else {})})
    await db.users.insert_one({'id':'55555555-5555-4555-8555-555555555555','store_id':STORE,'email':'cashier@example.com','password_hash':HASH,'role':'Cashier','plan':plan,'credential_version':0})
    await db.staff.insert_one({'id':'staff-cashier','user_id':'55555555-5555-4555-8555-555555555555','store_id':STORE,'role':'Cashier','status':'Aktif','name':'Cashier'})
    devices=5 if plan=='pro' else 15 if plan=='business' else 1
    await db.devices.insert_many([{'id':f'device-{i}','device_id':f'device-{i}','store_id':STORE,'name':f'Audit {i}','status':'Aktif','created_at':now.isoformat(),'last_seen_at':now.isoformat()} for i in range(devices)])
    if plan=='business':await db.branches.insert_many([{'id':f'branch-{i}','store_id':STORE,'name':f'Branch {i}'} for i in range(2)])
    return {'ok':True}

@app.post('/__audit/invoice')
async def invoice(payload:dict):
    db=database.get_db();order=await db.subscription_orders.find_one({'_id':payload['external_id']})
    if not order or order['amount']!=payload['amount']:raise HTTPException(400,'Invalid local invoice')
    doc={**payload,'status':'PENDING','invoice_url':'https://checkout.xendit.co/web/geraina-checkout-fixture/'+order['_id'],'id':'local-invoice-'+order['_id']}
    await db.audit_invoices.insert_one(doc)
    return {k:v for k,v in doc.items() if k!='_id'}

@app.get('/__audit/invoice/{order_id}')
async def read_invoice(order_id:str):
    return await database.get_db().audit_invoices.find_one({'external_id':order_id},{'_id':0})

@app.post('/__audit/payment/{order_id}')
async def pay(order_id:str,payload:dict=Body(default={})):
    state=payload.get('state','PAID');db=database.get_db()
    await db.audit_invoices.update_one({'external_id':order_id},{'$set':{'status':state,'paid_amount':(await db.subscription_orders.find_one({'_id':order_id}))['amount'],'paid_at':database.utcnow().isoformat()}})
    return {'ok':True}

@app.get('/__audit/snapshot')
async def snapshot():
    db=database.get_db()
    return {'orders':await db.subscription_orders.find({},{'_id':0,'receipt':0}).to_list(100),'addons':await db.addon_purchases.find({},{'_id':0}).to_list(100),
        'invoice_count':await db.audit_invoices.count_documents({}),'devices':await db.devices.count_documents({'store_id':STORE}),'user':await db.users.find_one({'id':OWNER},{'_id':0,'password_hash':0})}

@app.post('/__audit/expire/{entitlement_id}')
async def expire(entitlement_id:str):
    await database.get_db().addon_purchases.update_many({'entitlement_id':entitlement_id},{'$set':{'expires_at':(database.utcnow()-timedelta(seconds=1)).isoformat()}})
    return {'ok':True}

if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=8848,log_level='warning')
