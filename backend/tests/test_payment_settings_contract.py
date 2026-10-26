"""Payment settings audit regressions; isolated stores, no provider requests."""
import asyncio
import os
import sys
from pathlib import Path

os.environ.setdefault("JWT_SECRET_KEY", "payment-settings-test-only-secret-at-least-32-bytes")
os.environ.setdefault("ENV", "test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
import auth
import routes_settings as settings


@pytest.fixture
def fixture(monkeypatch):
    db = AsyncMongoMockClient().payment_settings_contract
    user = {"id": "owner", "store_id": "audit-store", "role": "Owner", "plan": "business"}
    app = FastAPI()
    app.include_router(settings.router)
    app.dependency_overrides[auth.get_current_user] = lambda: user
    monkeypatch.setattr(settings, "get_db", lambda: db)
    return db, user, TestClient(app)


def test_new_store_has_no_invented_bank_account_or_active_unconfigured_gateway(fixture):
    db, _, client = fixture
    response = client.get('/api/payments/config')
    assert response.status_code == 200
    value = response.json()
    assert value['cash']['is_active'] is True
    assert value['cash']['require_drawer'] is False
    for key in ('qris', 'ewallet', 'va', 'credit_card', 'bank_transfer', 'edc'):
        assert value[key]['is_active'] is False
    assert value['bank_transfer']['accounts'] == [{'bank': '', 'account_no': '', 'account_name': ''}]
    assert asyncio.run(db.payments_config.count_documents({})) == 0


def test_section_save_preserves_other_providers_and_other_stores(fixture):
    db, _, client = fixture
    asyncio.run(db.payments_config.insert_many([
        {'store_id': 'audit-store', 'cash': {'is_active': True}, 'bank_transfer': {'accounts': [{'account_no': 'EXISTING-MERCHANT'}]}},
        {'store_id': 'other-store', 'cash': {'is_active': False}},
    ]))
    response = client.post('/api/payments/config', json={'cash': {'is_active': False}})
    assert response.status_code == 200
    assert response.json()['bank_transfer']['accounts'][0]['account_no'] == 'EXISTING-MERCHANT'
    assert asyncio.run(db.payments_config.find_one({'store_id': 'other-store'}))['cash']['is_active'] is False


@pytest.mark.parametrize('role', ['Manager', 'Cashier', 'Warehouse'])
def test_employee_cannot_read_or_write_owner_payment_configuration(fixture, role):
    db, user, client = fixture
    user['role'] = role
    assert client.get('/api/payments/config').status_code == 403
    assert client.post('/api/payments/config', json={'cash': {'is_active': False}}).status_code == 403
    assert asyncio.run(db.payments_config.count_documents({})) == 0
