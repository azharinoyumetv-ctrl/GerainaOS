"""Payments -> cashier -> chosen merchant gateway. No external money or merchant writes."""
import asyncio
import base64
import hashlib
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import auth
import database
import merchant_checkout as merchant
import routes_orders as orders
import routes_settings as settings
import routes_webhooks as webhooks
from doku_client import _sign

run = asyncio.run
KEYS = {
    'xendit': {'is_active': True, 'secret_key': 'store-x-key', 'webhook_token': 'store-x-callback'},
    'midtrans': {'is_active': True, 'server_key': 'store-m-key', 'environment': 'sandbox'},
    'doku': {'is_active': True, 'client_id': 'store-d-client', 'shared_key': 'store-d-key', 'environment': 'sandbox'},
}


@pytest.fixture
def shop(monkeypatch):
    db = AsyncMongoMockClient().payment_workflow
    user = {'id': 'owner-a', 'store_id': 'store-a', 'role': 'Owner', 'plan': 'business', 'email': 'fixture@example.invalid'}
    for module in (orders, settings, webhooks, database):
        monkeypatch.setattr(module, 'get_db', lambda: db)
    app = FastAPI()
    for module in (orders, settings, webhooks):
        app.include_router(module.router)
    app.dependency_overrides[auth.get_current_user] = lambda: user
    run(db.integrations.insert_one({'store_id': 'store-a', **KEYS}))
    run(db.products.insert_one({'id': 'coffee', 'store_id': 'store-a', 'name': 'Coffee', 'stock': 20, 'price': 10000}))
    return db, user, TestClient(app)


def sale(client, method, **extra):
    return client.post('/api/orders', headers={'Idempotency-Key': extra.pop('attempt', method)}, json={
        'items': [{'product_id': 'coffee', 'name': 'Coffee', 'price': 10000, 'quantity': 1, 'subtotal': 10000}],
        'payment_method': method, **extra})


@pytest.mark.parametrize('provider', merchant.GATEWAYS)
@pytest.mark.parametrize('method', ['ewallet', 'va', 'credit_card'])
def test_configuration_selects_provider_and_disabled_method_cannot_checkout(shop, monkeypatch, provider, method):
    db, _, client = shop
    gateway = AsyncMock(return_value={'gateway_checkout_url': 'https://example.invalid/hosted'})
    direct = AsyncMock(return_value={'payment_request_id': 'request-x', 'checkout_url': 'https://example.invalid/wallet'})
    monkeypatch.setattr(orders, 'create_merchant_checkout', gateway)
    monkeypatch.setattr(orders, 'create_ewallet_charge', direct)
    assert client.post('/api/payments/config', json={method: {'is_active': True, 'provider': provider}}).status_code == 200
    choice = client.get('/api/payments/options').json()['methods'][method]
    assert choice['displayed'] is True and choice['enabled'] is True and choice['provider'] == provider
    assert all(secret not in json.dumps(choice) for cfg in KEYS.values() for secret in cfg.values() if isinstance(secret, str))
    extra = {'ewallet_channel': 'OVO'} if provider == 'xendit' and method == 'ewallet' else {}
    response = sale(client, method, **extra)
    assert response.status_code == 200, response.text
    created = response.json()
    assert created['payment_status'] == 'pending'
    if extra:
        assert direct.await_count == 1 and gateway.await_count == 0
    else:
        assert gateway.call_args.args[0] == provider
        assert gateway.call_args.args[1] == KEYS[provider]
        assert gateway.call_args.args[3] == [row['code'] for row in choice['channels']]
        assert created['payment_provider'] == provider
        assert created['gateway_reference'] == created['id']
        assert sale(client, method).json()['id'] == created['id']
        assert gateway.await_count == 1
    assert client.post('/api/payments/config', json={method: {'is_active': False}}).status_code == 200
    hidden = client.get('/api/payments/options').json()['methods'][method]
    assert hidden['displayed'] is False and hidden['enabled'] is False
    assert sale(client, method, attempt='disabled').status_code == 400
    assert run(db.products.find_one({'id': 'coffee'}))['stock'] == 19


@pytest.mark.parametrize('provider', merchant.GATEWAYS)
@pytest.mark.parametrize('method', ['ewallet', 'va', 'credit_card'])
def test_outbound_hosted_checkout_uses_only_selected_channels_and_store_credentials(monkeypatch, provider, method):
    seen = []
    original = httpx.AsyncClient
    def respond(request):
        seen.append(request)
        return httpx.Response(201, json={'payment_session_id': 'session-x', 'payment_link_url': 'https://checkout.xendit.co/sessions/x',
            'token': 'snap-m', 'redirect_url': 'https://app.sandbox.midtrans.com/snap/v2/vtweb/x',
            'response': {'payment': {'url': 'https://pay.doku.com/x'}}})
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs))
    channels = [merchant.selected_channels(method, {}, provider)[0]['code']]
    result = run(merchant.create_merchant_checkout(provider, KEYS[provider], {'id': 'unique-order', 'order_no': 'GR-1', 'total': 10000}, channels))
    assert result['gateway_checkout_url'].startswith('https://') and len(seen) == 1
    request, body = seen[0], json.loads(seen[0].content)
    if provider == 'xendit':
        assert request.url == 'https://api.xendit.co/sessions'
        assert base64.b64decode(request.headers['authorization'].split()[1]).decode() == 'store-x-key:'
        assert body['allowed_payment_channels'] == channels and body['allow_save_payment_method'] == 'DISABLED'
    elif provider == 'midtrans':
        assert request.url == 'https://app.sandbox.midtrans.com/snap/v1/transactions'
        assert base64.b64decode(request.headers['authorization'].split()[1]).decode() == 'store-m-key:'
        assert body['enabled_payments'] == channels and body['credit_card']['secure'] is True
    else:
        assert request.headers['client-id'] == 'store-d-client'
        assert body['payment']['payment_method_types'] == channels
    assert 'platform' not in str(request.headers)


def test_qris_display_preference_is_separate_from_bank_setup_and_gateway(shop):
    db, _, client = shop
    run(db.bank_qris_configs.insert_one({'store_id': 'store-a', 'is_active': True, 'qr_payload': 'existing-bank-code'}))
    run(db.integrations.delete_many({}))
    assert client.get('/api/payments/options').json()['methods']['qris_bank']['enabled'] is True
    assert client.post('/api/payments/config', json={'qris_bank': {'is_active': False}}).status_code == 200
    assert client.get('/api/payments/options').json()['methods']['qris_bank']['displayed'] is False
    assert run(db.bank_qris_configs.find_one({'store_id': 'store-a'}))['qr_payload'] == 'existing-bank-code'
    assert client.post('/api/payments/config', json={'qris_bank': {'is_active': True}}).status_code == 200
    assert client.get('/api/payments/options').json()['methods']['qris_bank']['enabled'] is True


def test_missing_integration_is_visible_but_not_usable_and_never_falls_back(shop):
    db, _, client = shop
    run(db.integrations.update_one({'store_id': 'store-a'}, {'$set': {'midtrans': {'is_active': False}}}))
    assert client.post('/api/payments/config', json={'va': {'is_active': True, 'provider': 'Midtrans'}}).status_code == 200
    value = client.get('/api/payments/options').json()['methods']['va']
    assert value['displayed'] is True and value['enabled'] is False and 'Midtrans' in value['reason']
    assert sale(client, 'va').status_code == 400
    assert run(db.orders.count_documents({})) == 0
    assert run(db.products.find_one({'id': 'coffee'}))['stock'] == 20


def test_legacy_doku_entry_cannot_bypass_saved_method_choices(shop):
    db, _, client = shop
    assert client.post('/api/payments/config', json={'va': {'is_active': False, 'provider': 'DOKU'}}).status_code == 200
    assert sale(client, 'doku').status_code == 400
    assert run(db.orders.count_documents({})) == 0


def test_cash_and_qris_changes_preserve_existing_gateway_checkout(shop):
    _, _, client = shop
    assert client.get('/api/payments/options').json()['methods']['doku']['displayed'] is True
    assert client.post('/api/payments/config', json={'cash': {'is_active': False}, 'qris_bank': {'is_active': False}}).status_code == 200
    assert client.get('/api/payments/options').json()['methods']['doku']['enabled'] is True


@pytest.mark.parametrize('outcome', ['declined', 'timeout', 'malformed_success'])
def test_gateway_failure_preserves_attempt_identity_and_cannot_send_a_second_charge(shop, monkeypatch, outcome):
    db, _, client = shop
    request = httpx.Request('POST', 'https://api.xendit.co/sessions')
    error = (httpx.HTTPStatusError('Declined', request=request, response=httpx.Response(400, request=request)) if outcome == 'declined' else
             httpx.ReadTimeout('Response uncertain', request=request) if outcome == 'timeout' else ValueError('Missing checkout link'))
    gateway = AsyncMock(side_effect=error)
    monkeypatch.setattr(orders, 'create_merchant_checkout', gateway)
    assert client.post('/api/payments/config', json={'va': {'is_active': True, 'provider': 'Xendit'}}).status_code == 200
    response = sale(client, 'va')
    assert response.status_code == (400 if outcome == 'declined' else 200)
    if outcome != 'declined':
        assert response.json()['payment_initialization'] == 'uncertain'
        assert response.json()['payment_status'] == 'pending'
    retry = sale(client, 'va')
    assert retry.status_code == response.status_code and gateway.await_count == 1
    assert run(db.orders.count_documents({})) == (0 if outcome == 'declined' else 1)
    assert run(db.products.find_one({'id': 'coffee'}))['stock'] == (20 if outcome == 'declined' else 19)


@pytest.mark.parametrize('changes', [{'is_active': 'yes'}, {'channels': {'DANA': 'false'}}, {'channels': []}])
def test_malformed_config_does_not_enable_methods(shop, changes):
    assert shop[2].post('/api/payments/config', json={'ewallet': {'provider': 'Xendit', **changes}}).status_code == 422


@pytest.mark.parametrize('provider', merchant.GATEWAYS)
def test_disabling_one_channel_filters_it_without_enabling_other_provider_channels(shop, provider):
    _, _, client = shop
    names = list(merchant.GATEWAYS[provider]['va'])
    assert client.post('/api/payments/config', json={'va': {'is_active': True, 'provider': provider, 'banks': {name: name == names[0] for name in names}}}).status_code == 200
    assert client.get('/api/payments/options').json()['methods']['va']['channels'] == [{'label': names[0], 'code': merchant.GATEWAYS[provider]['va'][names[0]]}]


def pending(db, provider):
    run(db.orders.insert_one({'id': 'unique-order', 'store_id': 'store-a', 'gateway_reference': 'unique-order', 'gateway_session_id': 'session-x',
        'payment_provider': provider, 'order_no': 'GR-1', 'total': 10000, 'payment_status': 'pending', 'items': []}))


@pytest.mark.parametrize('alter', [{}, {'amount': 9999}, {'currency': 'USD'}, {'session_type': 'SAVE'}, {'payment_session_id': 'wrong'}])
def test_xendit_session_notification_checks_reference_session_amount_currency_and_type(shop, alter):
    db, _, client = shop
    pending(db, 'xendit')
    payload = {'event': 'payment_session.completed', 'data': {'reference_id': 'unique-order', 'payment_session_id': 'session-x', 'session_type': 'PAY', 'currency': 'IDR', 'amount': 10000, 'status': 'COMPLETED', **alter}}
    assert client.post('/api/webhooks/xendit', headers={'x-callback-token': 'store-x-callback'}, json=payload).status_code == 200
    assert run(db.orders.find_one({'id': 'unique-order'}))['payment_status'] == ('pending' if alter else 'paid')


@pytest.mark.parametrize('state,fraud,expected', [('settlement', 'accept', 'paid'), ('capture', 'accept', 'paid'), ('capture', 'challenge', 'pending'), ('pending', 'accept', 'pending')])
def test_midtrans_uses_verified_provider_status_not_unsigned_notification_status(shop, monkeypatch, state, fraud, expected):
    db, _, client = shop
    pending(db, 'midtrans')
    original, seen = httpx.AsyncClient, []
    def respond(request):
        seen.append(request)
        return httpx.Response(200, json={'order_id': 'unique-order', 'gross_amount': '10000.00', 'currency': 'IDR', 'transaction_status': state, 'fraud_status': fraud})
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs))
    payload = {'order_id': 'unique-order', 'status_code': '200', 'gross_amount': '10000.00', 'transaction_status': 'settlement'}
    payload['signature_key'] = hashlib.sha512(b'unique-order20010000.00store-m-key').hexdigest()
    assert client.post('/api/webhooks/midtrans', json=payload).status_code == 200
    assert seen[0].url == 'https://api.sandbox.midtrans.com/v2/unique-order/status'
    assert run(db.orders.find_one({'id': 'unique-order'}))['payment_status'] == expected


def test_midtrans_rejects_another_stores_signature_without_provider_requests(shop):
    db, _, client = shop
    pending(db, 'midtrans')
    payload = {'order_id': 'unique-order', 'status_code': '200', 'gross_amount': '10000.00', 'signature_key': hashlib.sha512(b'unique-order20010000.00other-store-key').hexdigest()}
    assert client.post('/api/webhooks/midtrans', json=payload).status_code == 401
    assert run(db.orders.find_one({'id': 'unique-order'}))['payment_status'] == 'pending'


def test_doku_generic_method_settles_only_matching_merchant_reference(shop):
    db, _, client = shop
    pending(db, 'doku')
    raw = json.dumps({'order': {'invoice_number': 'unique-order', 'amount': 10000}, 'transaction': {'status': 'SUCCESS'}}).encode()
    digest = base64.b64encode(hashlib.sha256(raw).digest()).decode()
    signature = _sign('store-d-client', 'request-1', '2026-10-27T00:00:00Z', '/api/webhooks/doku', digest, 'store-d-key')
    response = client.post('/api/webhooks/doku', content=raw, headers={'client-id': 'store-d-client', 'request-id': 'request-1', 'request-timestamp': '2026-10-27T00:00:00Z', 'signature': signature})
    assert response.status_code == 200
    assert run(db.orders.find_one({'id': 'unique-order'}))['payment_status'] == 'paid'
