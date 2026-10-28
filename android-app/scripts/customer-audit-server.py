"""Local-only audit host: actual API handlers, disposable in-memory database.

Never import this module from production. No production database or provider
connection is used. All outbound HTTP and non-loopback socket connections fail.
"""
import os
import sys
import socket
from pathlib import Path
from datetime import timedelta

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
os.environ['ENV'] = 'test'
os.environ['JWT_SECRET_KEY'] = 'local-customer-audit-only-not-a-production-secret'
os.environ['MONGO_URL'] = 'mongodb://127.0.0.1:1'
os.environ['DB_NAME'] = 'geraina_disposable_audit'
import httpx
from mongomock_motor import AsyncMongoMockClient
import database

if os.environ.get('GERAINA_AUDIT_REAL_MONGO') == '1':
    from motor.motor_asyncio import AsyncIOMotorClient
    # Hardcoded disposable loopback replica; never accept a production URI/name.
    database._db = AsyncIOMotorClient('mongodb://127.0.0.1:8847/?replicaSet=customerAudit').geraina_customer_audit
else:
    database._db = AsyncMongoMockClient().geraina_disposable_audit


async def deny_http(*args, **kwargs):
    raise RuntimeError('External provider HTTP is disabled by the local audit host')


httpx.AsyncClient.request = deny_http
original_connect = socket.socket.connect


def loopback_connect(self, address):
    if isinstance(address, tuple) and address[0] not in ('127.0.0.1', '::1', 'localhost'):
        raise RuntimeError('Non-loopback connections are disabled by the audit host')
    return original_connect(self, address)


socket.socket.connect = loopback_connect
import auth
from server import app
from fastapi import Body
from routes_auth import _seed_store_skeleton

PASSWORD = 'DisposableAudit123'
PASSWORD_HASH = auth.hash_password(PASSWORD)


@app.post('/__audit/reset')
async def reset(options: dict = Body(default={})):
    db = database.get_db()
    for name in await db.list_collection_names():
        await db[name].delete_many({})
    now = database.utcnow().isoformat()
    for suffix in ('a', 'b'):
        await db.users.insert_one({'id': f'owner-{suffix}', 'email': f'owner-{suffix}@example.com',
            'password_hash': PASSWORD_HASH, 'role': 'Owner', 'plan': 'business',
            'store_id': f'store-{suffix}', 'store_name': f'Audit Store {suffix.upper()}',
            'created_at': now, 'credential_version': 0})
        await db.stores.insert_one({'id': f'store-{suffix}', 'name': f'Audit Store {suffix.upper()}',
            'module': 'geraina', 'owner_user_id': f'owner-{suffix}', 'created_at': now})
        await _seed_store_skeleton(db, f'store-{suffix}', f'Audit Store {suffix.upper()}', 'geraina')
    for role in ('Cashier', 'Manager', 'Warehouse'):
        identifier = role.lower()
        await db.users.insert_one({'id': identifier, 'email': f'{identifier}@example.com',
            'password_hash': PASSWORD_HASH, 'role': role, 'store_id': 'store-a',
            'plan': 'business', 'credential_version': 0, 'created_at': now})
        await db.staff.insert_one({'id': f'staff-{identifier}', 'user_id': identifier,
            'store_id': 'store-a', 'name': f'Audit {role}', 'role': role,
            'status': 'Aktif', 'email': f'{identifier}@example.com', 'created_at': now})
    count = int(options.get('products', 3))
    if count:
        await db.products.insert_many([{'id': f'product-{i:04d}', 'store_id': 'store-a',
            'name': f'Audit Product {i:04d}', 'sku': f'AUDIT-{i:04d}',
            'price': 1000, 'cost': 400, 'stock': 10, 'category': 'Audit category',
            'unit': 'pcs', 'active': True, 'created_at': now, 'updated_at': now}
            for i in range(count)])
    await db.products.insert_one({'id': 'foreign-product', 'store_id': 'store-b',
        'name': 'Private product', 'sku': 'PRIVATE', 'price': 1000, 'stock': 20,
        'active': True, 'created_at': now, 'updated_at': now})
    await db.branches.insert_one({'id': 'branch-a', 'store_id': 'store-a',
        'name': 'Audit Bandung', 'address': 'Audit address', 'phone': '000',
        'status': 'Aktif', 'created_at': now})
    await db.suppliers.insert_one({'id': 'supplier-a', 'store_id': 'store-a',
        'name': 'Audit supplier', 'phone': '', 'email': '', 'address': '',
        'created_at': now, 'updated_at': now})
    return {'ok': True, 'disposable': True, 'password': PASSWORD,
            'accounts': ['owner-a', 'owner-b', 'cashier', 'manager', 'warehouse']}


@app.get('/__audit/snapshot')
async def snapshot():
    names = ['products','orders','stock_adjustments','stock_transfers','purchase_orders',
             'goods_receiving','supplier_invoices','debt_payables','debt_receivables', 'customers', 'attendance']
    return {name: await database.get_db()[name].find({}, {'_id': 0}).to_list(None) for name in names}


@app.post('/__audit/scenario/{name}')
async def scenario(name: str):
    db = database.get_db()
    if name == 'purchase':
        await db.purchase_orders.insert_one({'id': 'po-a', 'store_id': 'store-a',
            'po_no': 'PO-AUDIT', 'supplier_id': 'supplier-a', 'supplier_name': 'Audit supplier',
            'total': 5000, 'status': 'Ordered', 'created_at': database.utcnow().isoformat(),
            'items': [{'product_id': 'product-0000', 'name': 'Audit Product 0000', 'quantity': 5, 'qty': 5, 'price': 1000}]})
    elif name == 'inactive':
        await db.products.update_one({'id': 'product-0000'}, {'$set': {'active': False}})
    elif name == 'empty-stock':
        await db.products.update_one({'id': 'product-0000'}, {'$set': {'stock': 0}})
    elif name == 'expired':
        await db.users.update_one({'id': 'owner-a'}, {'$set': {'plan':'trial', 'trial_ends_at': (database.utcnow()-timedelta(days=1)).isoformat()}})
    elif name in ('subscription-malformed', 'subscription-legacy-business', 'subscription-manual-business'):
        await db.users.update_one({'id': 'owner-a'}, {'$set': {
            'plan': 'Business' if name == 'subscription-malformed' else 'business' if name == 'subscription-legacy-business' else 'trial',
            'trial_ends_at': '2099-11-10T13:01:19+00:00'}, '$unset': {'subscriptions': ''}})
        if name == 'subscription-manual-business':
            subscription = {'tier': 'business', 'status': 'active', 'source': 'manual_grant', 'expires_at': '2099-11-10T13:01:19+00:00'}
            await db.users.update_one({'id': 'owner-a'}, {'$set': {'subscriptions.geraina': subscription}})
            await db.stores.update_one({'id': 'store-a'}, {'$set': {'subscription': subscription, 'plan': 'business'}})
    elif name in ('subscription-active', 'subscription-expired'):
        subscription = {'tier': 'pro', 'period': 'monthly', 'status': 'active',
            'order_id': 'DG-geraina-' + 'a' * 32, 'paid_at': database.utcnow().isoformat(),
            'expires_at': (database.utcnow() + timedelta(days=20 if name == 'subscription-active' else -1)).isoformat()}
        await db.users.update_one({'id': 'owner-a'}, {'$set': {'subscriptions.geraina': subscription}})
        await db.stores.update_one({'id': 'store-a'}, {'$set': {'subscription': subscription, 'plan': 'pro'}})
    return {'ok': True}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=int(os.environ.get('GERAINA_AUDIT_PORT', '8846')), log_level='warning')
