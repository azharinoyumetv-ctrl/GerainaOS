"""Loopback-only category regression host; never uses a production database."""
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
os.environ.update(ENV='test', JWT_SECRET_KEY='isolated-category-regression-only',
                  MONGO_URL='mongodb://127.0.0.1:8847/?replicaSet=customerAudit',
                  DB_NAME='geraina_categories_' + uuid.uuid4().hex)

import socket
import httpx
import database
import auth
from fastapi import Body
from server import app

async def deny_http(*args, **kwargs):
    raise RuntimeError('Category regression blocks external provider requests')

httpx.AsyncClient.request = deny_http
original_connect = socket.socket.connect
def loopback_connect(self, address):
    if isinstance(address, tuple) and address[0] not in ('127.0.0.1', '::1', 'localhost'):
        raise RuntimeError('Category regression blocks non-loopback sockets')
    return original_connect(self, address)
socket.socket.connect = loopback_connect
password_hash = auth.hash_password('DisposableAudit123')

@app.post('/__audit/reset')
async def reset(options: dict = Body(default={})):
    db = database.get_raw_db()
    for name in await db.list_collection_names():
        await db[name].delete_many({})
    now = datetime.now(timezone.utc).isoformat()
    for suffix in ('a', 'b'):
        subscription = {'tier': 'business', 'status': 'active', 'source': 'manual_grant', 'expires_at': '2099-01-01T00:00:00+00:00'}
        await db.users.insert_one({'id': 'owner-' + suffix, 'email': 'owner-' + suffix + '@example.com',
            'password_hash': password_hash, 'role': 'Owner', 'plan': 'business',
            'store_id': 'store-' + suffix, 'store_name': 'Isolated category store ' + suffix,
            'created_at': now, 'credential_version': 0, 'subscriptions': {'geraina': subscription}})
        await db.stores.insert_one({'id': 'store-' + suffix, 'name': 'Isolated category store ' + suffix,
            'module': 'geraina', 'owner_user_id': 'owner-' + suffix, 'created_at': now, 'subscription': subscription})
    await db.products.insert_one({'id': 'product-0000', 'store_id': 'store-a', 'name': 'Legacy product',
        'sku': 'LEGACY-1', 'price': 1000, 'cost': 500, 'stock': 4, 'category': 'Legacy category',
        'unit': 'pcs', 'active': True, 'created_at': now, 'updated_at': now})
    return {'ok': True, 'disposable': True}

@app.on_event('shutdown')
async def cleanup():
    db = database.get_raw_db()
    assert db.name.startswith('geraina_categories_')
    await db.client.drop_database(db.name)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8856, log_level='warning')
