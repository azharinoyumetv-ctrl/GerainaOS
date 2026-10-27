"""Real Mongo replica-set checks for add-on reservation/payment atomicity."""
import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import AsyncMock
import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError
import billing_subscriptions as billing
from addon_billing import claim_invoice
from addon_catalog import active_counts

@pytest_asyncio.fixture
async def account(monkeypatch):
    client = AsyncIOMotorClient('mongodb://127.0.0.1:8847/?replicaSet=customerAudit', serverSelectionTimeoutMS=3000)
    db = client['geraina_addon_concurrency_' + uuid4().hex]
    now = datetime.now(timezone.utc)
    user = {'id': '11111111-1111-4111-8111-111111111111', 'store_id': '22222222-2222-4222-8222-222222222222', 'current_module': 'geraina', 'role': 'Owner', 'plan': 'pro', 'email': 'concurrency@example.test',
        'subscriptions': {'geraina': {'tier': 'pro', 'status': 'active', 'order_id': 'base', 'expires_at': (now+timedelta(days=20)).isoformat()}}}
    await db.users.insert_one(user.copy()); await db.stores.insert_one({'id': user['store_id'], 'owner_user_id': user['id'], 'module': 'geraina'})
    monkeypatch.setattr(billing, 'get_db', lambda: db)
    yield db, user, now
    await client.drop_database(db.name); client.close()

def selection(letter, **extra):
    return {'kind': 'addon', 'addonId': 'extra_device', 'tier': 'pro', 'period': 'monthly', 'orderId': 'DG-geraina-'+letter*32, **extra}

async def quote(user, letter):
    payload = selection(letter)
    await billing.prepare_order(payload, user)
    await billing.attach_reference(payload['orderId'], 'local-signed-reference-for-addon-' + payload['orderId'], user)
    return payload

@pytest.mark.asyncio
async def test_concurrent_confirmations_reserve_only_one_pending_checkout(account):
    db,user,_ = account
    a,b = await quote(user,'a'),await quote(user,'b')
    results = await asyncio.gather(*(billing.prepare_order({**p,'confirmAddon':True},user) for p in (a,b)), return_exceptions=True)
    assert sum(isinstance(r,dict) for r in results)==1
    failures=[r for r in results if isinstance(r,HTTPException)];assert len(failures)==1 and failures[0].detail['code']=='addon_pending'
    assert await db.addon_purchases.count_documents({'status':'pending'})==1

@pytest.mark.asyncio
async def test_concurrent_invoice_claims_and_notifications_are_idempotent(account,monkeypatch):
    db,user,now=account;p=await quote(user,'c');await billing.prepare_order({**p,'confirmAddon':True},user)
    claims=await asyncio.gather(*(claim_invoice(p['orderId'],user) for _ in range(3)));assert sum(r['claimed'] for r in claims)==1
    proof={'orderId':p['orderId'],'ownerId':user['id'],'storeId':user['store_id'],'module':'geraina','tier':'pro','period':'monthly','amount':49000,'kind':'addon','addonId':'extra_device','renewalId':None,'status':'paid','paidAt':now.isoformat()}
    monkeypatch.setattr(billing,'fetch_payment_status',AsyncMock(return_value=proof))
    results=await asyncio.gather(*(billing.reconcile_order(p['orderId']) for _ in range(3)))
    assert all(r['activation']=='active' for r in results)
    assert len({r['expires_at'] for r in results})==1
    assert await active_counts(db,user['store_id'],'pro')=={'extra_device':1}
    assert (await db.users.find_one({'id':user['id']}))['subscriptions']['geraina']['order_id']=='base'

@pytest.mark.asyncio
async def test_failed_reservation_rolls_back_store_and_order_updates(account):
    db,user,_=account;p=await quote(user,'d')
    await db.addon_purchases.insert_one({'_id':p['orderId'],'store_id':'different-store','status':'failed'})
    before=(await db.stores.find_one({'id':user['store_id']})).get('addon_checkout_revision')
    with pytest.raises(DuplicateKeyError):await billing.prepare_order({**p,'confirmAddon':True},user)
    assert (await db.subscription_orders.find_one({'_id':p['orderId']}))['status']=='draft'
    assert (await db.stores.find_one({'id':user['store_id']})).get('addon_checkout_revision')==before
    assert await db.addon_purchases.count_documents({'store_id':user['store_id']})==0
