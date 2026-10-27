import asyncio
import smtplib
from unittest.mock import Mock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

import routes_support as support

run = asyncio.run

@pytest.fixture
def shop(monkeypatch):
    db = AsyncMongoMockClient().support_tests
    user = {'id': 'customer-owner', 'store_id': 'store-a', 'email': 'customer@example.com', 'store_name': 'Toko Customer', 'role': 'Owner', 'plan': 'pro'}
    run(db.users.insert_one(user.copy()))
    monkeypatch.setattr(support, 'get_db', lambda: db)
    monkeypatch.setenv('SUPPORT_SMTP_PASSWORD', 'disposable-mail-fixture-only')
    sent = Mock()
    monkeypatch.setattr(support, 'send_message', sent)
    app = FastAPI(); app.include_router(support.router)
    app.dependency_overrides[support.get_billing_user] = lambda: user.copy()
    with TestClient(app) as client: yield client, db, user, sent

def body(**extra):
    return {'request_id': str(uuid4()), 'subject': 'Barcode scanner', 'message': 'Camera cannot open on my tablet.', 'app_version': '1.2.14', **extra}

def test_anonymous_requests_cannot_read_identity_or_send_email():
    app = FastAPI(); app.include_router(support.router)
    with TestClient(app) as client:
        assert client.get('/api/support/context').status_code == 401
        assert client.post('/api/support/requests', json=body()).status_code == 401

def test_context_and_delivery_use_authenticated_customer_email(shop):
    client, db, user, sent = shop
    context = client.get('/api/support/context').json()
    assert client.get('/api/support/context').headers['Cache-Control'] == 'private, no-store'
    assert context == {'customer_email': user['email'], 'store_name': user['store_name'], 'recipient': 'contact@dagangos.com', 'delivery_ready': True}
    payload = body(); result = client.post('/api/support/requests', json=payload)
    assert result.status_code == 200 and result.json()['status'] == 'accepted'
    ticket, config = sent.call_args.args
    assert ticket['customer_email'] == user['email'] and ticket['store_id'] == user['store_id']
    assert config['security'] == 'ssl'
    assert 'password' not in result.text and 'disposable-mail-fixture-only' not in result.text
    assert client.get('/api/support/requests/'+payload['request_id']).json() == result.json()

@pytest.mark.parametrize('field', ['customer_email', 'email', 'from', 'to', 'store_id', 'user_id'])
def test_form_cannot_override_identity_or_recipient(shop, field):
    client, db, user, sent = shop
    assert client.post('/api/support/requests', json=body(**{field: 'attacker@example.com'})).status_code == 422
    sent.assert_not_called(); assert run(db.support_tickets.count_documents({})) == 0

def test_repeat_submission_and_lost_response_do_not_send_twice(shop):
    client, db, user, sent = shop; payload = body()
    first = client.post('/api/support/requests', json=payload).json()
    for _ in range(3): assert client.post('/api/support/requests', json=payload).json() == first
    sent.assert_called_once(); assert run(db.support_tickets.count_documents({})) == 1
    assert client.post('/api/support/requests', json={**payload, 'message': 'A different message now.'}).status_code == 409

def test_request_status_is_scoped_to_account_and_store(shop):
    client, db, user, sent = shop; payload = body()
    assert client.post('/api/support/requests', json=payload).status_code == 200
    original_user = user['id']; user['id'] = 'other-user'
    assert client.get('/api/support/requests/'+payload['request_id']).status_code == 404
    user['id'] = original_user; user['store_id'] = 'other-store'
    assert client.get('/api/support/requests/'+payload['request_id']).status_code == 404

def test_missing_mail_credentials_never_reports_sent(shop, monkeypatch):
    client, db, user, sent = shop
    monkeypatch.delenv('SUPPORT_SMTP_PASSWORD'); monkeypatch.delenv('RESEND_API_KEY', raising=False)
    assert client.get('/api/support/context').json()['delivery_ready'] is False
    assert client.post('/api/support/requests', json=body()).status_code == 503
    sent.assert_not_called(); assert run(db.support_tickets.count_documents({})) == 0

def test_mail_timeout_is_uncertain_and_not_automatically_resent(shop):
    client, db, user, sent = shop; payload = body(); sent.side_effect = TimeoutError('SMTP interrupted')
    result = client.post('/api/support/requests', json=payload)
    assert result.json()['status'] == 'uncertain'
    assert client.post('/api/support/requests', json=payload).json()['status'] == 'uncertain'
    sent.assert_called_once()

def test_authenticated_account_rate_limit(shop):
    client, db, user, sent = shop
    for _ in range(5): assert client.post('/api/support/requests', json=body()).status_code == 200
    assert client.post('/api/support/requests', json=body()).status_code == 429
    assert sent.call_count == 5

@pytest.mark.parametrize('role', ['Owner', 'Manager', 'Cashier', 'Warehouse'])
def test_support_is_available_to_each_authenticated_role_and_expired_plan(shop, role):
    client, db, user, sent = shop; user.update(role=role, plan='expired')
    assert client.post('/api/support/requests', json=body()).json()['customer_email'] == user['email']

@pytest.mark.parametrize('changes', [{'subject': 'abc\r\nBcc: attacker@example.com'}, {'message': 'x'}, {'app_version': 'bad\nheader'}, {'request_id': 'not-a-uuid'}])
def test_invalid_inputs_do_not_create_tickets(shop, changes):
    client, db, user, sent = shop
    assert client.post('/api/support/requests', json=body(**changes)).status_code == 422
    sent.assert_not_called()

@pytest.mark.parametrize('mode', ['ssl', 'starttls'])
def test_smtp_uses_fixed_sender_recipient_and_customer_reply_to(monkeypatch, mode):
    smtp = Mock(); smtp.__enter__ = Mock(return_value=smtp); smtp.__exit__ = Mock(return_value=False); smtp.send_message.return_value = {}
    factory = Mock(return_value=smtp)
    monkeypatch.setattr(smtplib, 'SMTP_SSL' if mode == 'ssl' else 'SMTP', factory)
    ticket = {'reference': 'GRS-test', 'request_id': str(uuid4()), 'customer_email': 'customer@example.com', 'store_name': 'Customer store', 'role': 'Cashier', 'app_version': '1.2.14', 'subject': 'Need help', 'message': 'Problem details here.'}
    config = {'host': 'smtp.example.invalid', 'port': 465 if mode == 'ssl' else 587, 'user': 'fixture', 'password': 'not-a-real-key', 'security': mode}
    support.send_message(ticket, config)
    smtp.login.assert_called_once_with('fixture', 'not-a-real-key')
    message = smtp.send_message.call_args.args[0]
    assert message['Reply-To'] == 'customer@example.com'
    assert message['To'] == 'contact@dagangos.com'
    assert smtp.send_message.call_args.kwargs == {'from_addr': 'contact@dagangos.com', 'to_addrs': ['contact@dagangos.com']}
    assert 'customer@example.com' in message.get_content()
    if mode == 'starttls': smtp.starttls.assert_called_once()
