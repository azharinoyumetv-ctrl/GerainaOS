"""The five audit findings: isolated stores and provider doubles, no live money."""
import asyncio
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock

os.environ.setdefault('ENV', 'test')
os.environ.setdefault('JWT_SECRET_KEY', 'remaining-pos-tests-only-not-production-32-characters')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
import auth
import database
import routes_orders as orders
import routes_products as products
import routes_settings as settings

run = asyncio.run


@pytest.fixture
def fixture(monkeypatch):
    db = AsyncMongoMockClient().remaining_pos_tests
    user = {'id': 'owner-a', 'store_id': 'store-a', 'role': 'Owner', 'plan': 'business', 'email': 'owner@fixture.invalid'}
    for module in (orders, products, settings, database):
        monkeypatch.setattr(module, 'get_db', lambda: db)
    app = FastAPI()
    for router in (orders.router, products.router, settings.router):
        app.include_router(router)
    app.dependency_overrides[auth.get_current_user] = lambda: user
    gateway = AsyncMock(return_value={'payment_request_id': 'test-request', 'checkout_url': 'https://example.invalid/payment'})
    doku = AsyncMock(return_value={'response': {'payment': {'url': 'https://example.invalid/doku'}}})
    monkeypatch.setattr(orders, 'create_ewallet_charge', gateway)
    monkeypatch.setattr(orders, 'create_doku_checkout', doku)
    run(db.products.insert_one({'id': 'coffee', 'store_id': 'store-a', 'name': 'Coffee', 'sku': 'SKU-COFFEE', 'stock': 20, 'price': 1000}))
    return db, user, TestClient(app), gateway, doku


def checkout(client, method='cash', **changes):
    return client.post('/api/orders', json={'items': [{'product_id': 'coffee', 'name': 'Coffee', 'price': 1000, 'subtotal': 1000, 'quantity': 1}], 'payment_method': method, 'cash_received': 1000, **changes})


def test_catalogue_enumerates_every_product_without_cross_store_or_page_duplicates(fixture):
    db, _, client, *_ = fixture
    run(db.products.insert_many([{'id': f'p-{i:05d}', 'name': f'Product {i}', 'sku': f'SKU-{i}', 'store_id': 'store-a', 'active': i != 1200} for i in range(1203)] + [{'id': 'foreign', 'store_id': 'store-b', 'name': 'Private'}]))
    rows, cursor, pages = [], None, 0
    while True:
        response = client.get('/api/products/catalogue', params={'limit': 500, 'active_only': True, **({'cursor': cursor} if cursor else {})})
        assert response.status_code == 200
        value = response.json(); rows += value['items']; cursor = value['next_cursor']; pages += 1
        assert len(value['items']) <= 500
        if cursor is None:
            break
    assert pages == 3 and len(rows) == len({row['id'] for row in rows}) == value['total'] == 1203
    assert all(row['store_id'] == 'store-a' and row.get('active') is not False for row in rows)
    assert client.get('/api/products/lookup', params={'code': 'SKU-1202'}).json()['id'] == 'p-01202'


@pytest.mark.parametrize('cursor', ['not-a-cursor', 'e30', 'W10', 'A' * 1001])
def test_invalid_cursors_fail_cleanly(fixture, cursor):
    client = fixture[2]
    assert client.get('/api/products/catalogue', params={'cursor': cursor}).status_code == 400
    assert client.get('/api/orders/history', params={'cursor': cursor}).status_code == 400


@pytest.mark.parametrize('limit', [0, -1, 501])
def test_catalogue_page_size_is_bounded(fixture, limit):
    assert fixture[2].get('/api/products/catalogue', params={'limit': limit}).status_code == 422


def test_barcode_lookup_is_exact_active_scoped_and_rejects_duplicates(fixture):
    db, user, client, *_ = fixture
    user['role'] = 'Cashier'
    run(db.products.insert_many([{'id': 'special', 'store_id': 'store-a', 'sku': 'A[0].*'}, {'id': 'foreign', 'store_id': 'store-b', 'sku': 'SECRET'}, {'id': 'inactive', 'store_id': 'store-a', 'sku': 'OLD', 'active': False}]))
    assert client.get('/api/products/lookup', params={'code': 'a[0].*'}).json()['id'] == 'special'
    for code in ['.*', 'SECRET', 'OLD']:
        assert client.get('/api/products/lookup', params={'code': code}).status_code == 404
    run(db.products.insert_one({'id': 'duplicate', 'store_id': 'store-a', 'sku': 'SKU-COFFEE'}))
    assert client.get('/api/products/lookup', params={'code': 'SKU-COFFEE'}).status_code == 409


def test_history_search_and_cursor_cover_old_orders_with_equal_timestamps(fixture):
    db, _, client, *_ = fixture
    start = datetime(2026, 10, 26, tzinfo=timezone.utc)
    docs = [{'id': f'order-{i:04d}', 'store_id': 'store-a', 'order_no': f'GR-[{i:04d}]', 'created_at': (start + timedelta(seconds=i // 4)).isoformat(), 'payment_status': 'paid' if i % 2 else 'pending'} for i in range(257)]
    run(db.orders.insert_many(docs + [{**docs[0], 'id': 'other-store', 'store_id': 'store-b'}]))
    received, cursor = [], None
    while True:
        value = client.get('/api/orders/history', params={'limit': 50, **({'cursor': cursor} if cursor else {})}).json()
        received += value['items']; cursor = value['next_cursor']
        assert len(value['items']) <= 50 and value['total'] == 257
        if not cursor:
            break
    assert len(received) == len({row['id'] for row in received}) == 257
    assert [row['id'] for row in received] == [row['id'] for row in sorted(docs, key=lambda row: (row['created_at'], row['id']), reverse=True)]
    result = client.get('/api/orders/history', params={'q': '[0000]', 'status': 'pending'}).json()
    assert result['total'] == 1 and result['items'][0]['id'] == 'order-0000'
    assert client.get('/api/orders/history', params={'q': '[0000]', 'status': 'paid'}).json()['total'] == 0
    assert client.get('/api/orders/history', params={'q': '.*'}).json()['total'] == 0


@pytest.mark.parametrize('role', ['Owner', 'Manager', 'Cashier'])
def test_history_and_reference_require_sales_permission(fixture, role):
    _, user, client, *_ = fixture
    user['role'] = role
    assert client.get('/api/orders/history').status_code == 200
    user['role'] = 'Warehouse'
    assert client.get('/api/orders/history').status_code == 403
    assert client.get('/api/orders/resolve', params={'reference': 'coffee'}).status_code == 403


@pytest.mark.parametrize('method', ['cash', 'va', 'credit_card', 'bank_transfer', 'edc', 'arbitrary-method'])
def test_disabled_or_unsupported_methods_do_not_create_orders_or_touch_stock(fixture, method):
    db, _, client, *_ = fixture
    run(db.payments_config.insert_one({'store_id': 'store-a', 'cash': {'is_active': False}}))
    assert checkout(client, method).status_code == 400
    assert run(db.orders.count_documents({})) == 0
    assert run(db.products.find_one({'id': 'coffee'}))['stock'] == 20


def test_wallet_flags_channels_and_merchant_keys_govern_both_menu_and_server(fixture):
    db, _, client, gateway, _ = fixture
    run(db.integrations.insert_one({'store_id': 'store-a', 'xendit': {'is_active': True, 'secret_key': 'merchant-only-key', 'webhook_token': 'merchant-callback'}}))
    options = client.get('/api/payments/options').json()
    assert options['methods']['ewallet']['enabled'] is True
    assert 'merchant-only-key' not in json.dumps(options) and 'merchant-callback' not in json.dumps(options)
    assert client.get('/api/payments/config').json()['ewallet']['is_active'] is True
    assert client.post('/api/payments/config', json={'ewallet': {'is_active': True, 'provider': 'Xendit', 'channels': {'DANA': False, 'OVO': True, 'ShopeePay': False, 'LinkAja': False}}}).status_code == 200
    options = client.get('/api/payments/options').json()
    assert options['ewallet_channels'] == [{'code': 'OVO', 'label': 'OVO'}]
    assert checkout(client, 'ewallet', ewallet_channel='DANA').status_code == 400
    assert gateway.await_count == 0
    assert checkout(client, 'ewallet', ewallet_channel='ID_OVO').status_code == 200
    assert gateway.call_args.kwargs['cfg']['secret_key'] == 'merchant-only-key'
    assert gateway.call_args.kwargs['channel_code'] == 'OVO'
    assert client.post('/api/payments/config', json={'ewallet': {'is_active': False}}).status_code == 200
    assert checkout(client, 'ewallet', ewallet_channel='OVO').status_code == 400


@pytest.mark.parametrize('section', ['va', 'credit_card', 'bank_transfer', 'edc'])
def test_unimplemented_method_cannot_be_activated_as_working(fixture, section):
    assert fixture[2].post('/api/payments/config', json={section: {'is_active': True}}).status_code == 400


def test_midtrans_is_not_silently_substituted_for_xendit(fixture):
    db, _, client, gateway, _ = fixture
    run(db.integrations.insert_one({'store_id': 'store-a', 'xendit': {'is_active': True, 'secret_key': 'merchant-key', 'webhook_token': 'callback-key'}}))
    assert client.post('/api/payments/config', json={'ewallet': {'is_active': True, 'provider': 'Midtrans'}}).status_code == 200
    assert client.get('/api/payments/options').json()['methods']['ewallet']['enabled'] is False
    assert checkout(client, 'ewallet', ewallet_channel='DANA').status_code == 400
    assert gateway.await_count == 0


def test_doku_returns_to_the_stored_order_without_trusting_url_status(fixture, monkeypatch):
    db, user, client, _, doku = fixture
    monkeypatch.setenv('DOKU_RETURN_URL', 'https://evil.invalid/redirect')
    run(db.integrations.insert_one({'store_id': 'store-a', 'doku': {'is_active': True, 'client_id': 'own-client', 'shared_key': 'own-key', 'environment': 'sandbox'}}))
    response = checkout(client, 'doku')
    assert response.status_code == 200
    order = response.json()
    expected = f'https://dagangos.com/geraina/app/sales?order={order["id"]}'
    assert doku.call_args.kwargs['callback_url'] == doku.call_args.kwargs['callback_url_result'] == expected
    assert doku.call_args.kwargs['cfg']['client_id'] == 'own-client'
    assert order['payment_status'] == 'pending'
    resolved = client.get('/api/orders/resolve', params={'reference': order['id'], 'status': 'paid', 'amount': 0})
    assert resolved.json()['payment_status'] == 'pending'
    assert client.get('/api/orders/resolve', params={'reference': order['order_no']}).json()['id'] == order['id']
    user['store_id'] = 'store-b'
    assert client.get('/api/orders/resolve', params={'reference': order['id']}).status_code == 404


def test_midtrans_credentials_do_not_implicitly_enable_any_cashier_method(fixture):
    db, _, client, *_ = fixture
    assert client.post('/api/integrations', json={'midtrans': {'is_active': True, 'server_key': 'merchant-key'}}).status_code == 200
    options = client.get('/api/payments/options').json()
    assert all(options['methods'][name]['enabled'] is False for name in ('ewallet', 'va', 'credit_card'))


def test_missing_callback_configuration_does_not_offer_unsettleable_wallet_orders(fixture, monkeypatch):
    db, _, client, gateway, _ = fixture
    monkeypatch.setenv('XENDIT_SECRET_KEY', 'platform-subscription-key-not-for-merchants')
    run(db.integrations.insert_one({'store_id': 'store-a', 'xendit': {'is_active': True, 'secret_key': 'merchant-key'}}))
    assert client.get('/api/payments/options').json()['methods']['ewallet']['enabled'] is False
    assert checkout(client, 'ewallet', ewallet_channel='DANA').status_code == 400
    assert gateway.await_count == 0


def test_partial_settings_remain_readable_by_older_clients_without_rewriting_saved_data(fixture):
    db, _, client, *_ = fixture
    run(db.payments_config.insert_one({'store_id': 'store-a', 'cash': {'is_active': False}, 'bank_transfer': {'is_active': True, 'accounts': [{'account_no': 'OWN-LEGACY-ACCOUNT'}]}}))
    value = client.get('/api/payments/config').json()
    assert set(('cash', 'qris', 'ewallet', 'va', 'credit_card', 'bank_transfer', 'edc')).issubset(value)
    assert value['cash']['is_active'] is False and value['cash']['provider']
    assert value['bank_transfer']['is_active'] is False
    assert value['bank_transfer']['accounts'][0]['account_no'] == 'OWN-LEGACY-ACCOUNT'
    saved = run(db.payments_config.find_one({'store_id': 'store-a'}))
    assert saved['bank_transfer']['is_active'] is True and 'ewallet' not in saved
