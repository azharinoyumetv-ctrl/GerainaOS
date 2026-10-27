"""Actual Mongo transactions; SMTP is captured, never delivered."""
import asyncio
from uuid import uuid4
from unittest.mock import Mock
import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import HTTPException
import routes_support as support

@pytest_asyncio.fixture
async def shop(monkeypatch):
    client=AsyncIOMotorClient('mongodb://127.0.0.1:8847/?replicaSet=customerAudit',serverSelectionTimeoutMS=3000)
    db=client['geraina_support_concurrency_'+uuid4().hex]
    monkeypatch.setattr(support,'get_db',lambda:db)
    monkeypatch.setenv('SUPPORT_SMTP_PASSWORD','disposable-mail-fixture-only')
    sent=Mock();monkeypatch.setattr(support,'send_message',sent)
    user={'id':'customer-a','store_id':'store-a','email':'customer@example.com','role':'Owner','store_name':'Concurrent store'}
    await db.users.insert_one(user.copy())
    yield db,user,sent
    await client.drop_database(db.name);client.close()

def request():return support.SupportRequest(request_id=uuid4(),subject='Need support',message='This is an isolated test message.')

@pytest.mark.asyncio
async def test_concurrent_repeat_submission_delivers_once(shop):
    db,user,sent=shop;payload=request()
    results=await asyncio.gather(*(support.create(payload,user) for _ in range(4)))
    assert all(r['status'] in ('sending','accepted') for r in results)
    assert sent.call_count==1 and await db.support_tickets.count_documents({})==1
    assert (await support.create(payload,user))['status']=='accepted'
    assert sent.call_count==1

@pytest.mark.asyncio
async def test_concurrent_requests_cannot_bypass_rate_limit(shop):
    db,user,sent=shop
    results=await asyncio.gather(*(support.create(request(),user) for _ in range(8)),return_exceptions=True)
    assert len([r for r in results if isinstance(r,dict)])==5
    failures=[r for r in results if isinstance(r,HTTPException)]
    assert len(failures)==3 and all(r.status_code==429 for r in failures)
    assert sent.call_count==5 and await db.support_tickets.count_documents({})==5
