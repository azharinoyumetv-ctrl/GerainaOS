"""Paid add-on entitlement contracts; no provider or production database calls."""
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
import pytest
from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient
import billing_subscriptions as billing
import routes_subscriptions
import routes_pricing
import plan_limits

run = asyncio.run
OWNER = '11111111-1111-4111-8111-111111111111'
STORE = '22222222-2222-4222-8222-222222222222'
ORDER = 'DG-geraina-' + 'a' * 32
NOW = datetime.now(timezone.utc)

@pytest.fixture
def shop(monkeypatch):
    db = AsyncMongoMockClient().addon_tests
    user = {'id': OWNER, 'store_id': STORE, 'current_module': 'geraina', 'role': 'Owner', 'email': 'owner@example.test', 'plan': 'pro',
            'subscriptions': {'geraina': {'tier': 'pro', 'period': 'monthly', 'status': 'active', 'order_id': 'base-paid-order', 'paid_at': NOW.isoformat(), 'expires_at': (NOW + timedelta(days=20)).isoformat()}}}
    run(db.users.insert_one(user.copy()))
    run(db.stores.insert_one({'id': STORE, 'owner_user_id': OWNER, 'module': 'geraina'}))
    for module in (billing, routes_subscriptions, routes_pricing): monkeypatch.setattr(module, 'get_db', lambda: db)
    return db, user

def payload(order=ORDER, addon='extra_device', **extra):
    return {'kind': 'addon', 'addonId': addon, 'orderId': order, 'tier': 'pro' if addon == 'extra_device' else 'business', 'period': 'monthly', **extra}

def prepare(user, order=ORDER, addon='extra_device', **extra):
    result = run(billing.prepare_order(payload(order, addon, **extra), user))
    run(billing.attach_reference(order, 'test-reference-' + order + '-signed-by-portal', user))
    return result

def confirm(user, order=ORDER, addon='extra_device', **extra):
    return run(billing.prepare_order(payload(order, addon, confirmAddon=True, **extra), user))

def proof(order=ORDER, addon='extra_device', state='paid', at=NOW, **extra):
    return {'orderId': order, 'ownerId': OWNER, 'storeId': STORE, 'module': 'geraina', 'tier': 'pro' if addon == 'extra_device' else 'business',
            'period': 'monthly', 'amount': 49000 if addon == 'extra_device' else 149000, 'kind': 'addon', 'addonId': addon, 'renewalId': None,
            'status': state, 'paidAt': at.isoformat(), **extra}

def test_addon_price_is_server_controlled_and_quote_grants_no_capacity(shop):
    db, user = shop
    result = prepare(user, amount=1)
    assert result['amount'] == 49000
    assert result['kind'] == 'addon'
    assert run(db.addon_purchases.count_documents({})) == 0
    assert run(plan_limits._active_addon_counts(db, STORE)) == {}

def test_verified_payment_activates_once_without_replacing_base_plan(shop, monkeypatch):
    db, user = shop
    prepare(user); confirm(user)
    monkeypatch.setattr(billing, 'fetch_payment_status', AsyncMock(return_value=proof()))
    for _ in range(3): assert run(billing.reconcile_order(ORDER))['activation'] == 'active'
    assert run(db.addon_purchases.count_documents({'status': 'active'})) == 1
    assert run(plan_limits._active_addon_counts(db, STORE)) == {'extra_device': 1}
    saved = run(db.users.find_one({'id': OWNER}))
    assert saved['subscriptions']['geraina']['order_id'] == 'base-paid-order'
    assert saved['subscriptions']['geraina']['tier'] == 'pro'

@pytest.mark.parametrize('state', ['pending', 'failed', 'refunded'])
def test_unpaid_failed_or_refunded_addons_do_not_grant_capacity(shop, monkeypatch, state):
    db, user = shop
    prepare(user); confirm(user)
    monkeypatch.setattr(billing, 'fetch_payment_status', AsyncMock(return_value=proof(state=state)))
    run(billing.reconcile_order(ORDER))
    assert run(plan_limits._active_addon_counts(db, STORE)) == {}

@pytest.mark.parametrize('field,value', [('amount', 1), ('kind', 'subscription'), ('addonId', 'extra_outlet'), ('storeId', 'other'), ('ownerId', 'other'), ('renewalId', 'other')])
def test_mismatched_addon_proof_cannot_activate(shop, monkeypatch, field, value):
    db, user = shop
    prepare(user); confirm(user)
    monkeypatch.setattr(billing, 'fetch_payment_status', AsyncMock(return_value={**proof(), field: value}))
    with pytest.raises(HTTPException): run(billing.reconcile_order(ORDER))
    assert run(plan_limits._active_addon_counts(db, STORE)) == {}

@pytest.mark.parametrize('plan', ['trial', 'starter', 'business', 'expired'])
def test_device_addon_requires_pro(shop, plan):
    _, user = shop
    user = {**user, 'plan': plan, 'subscriptions': {}}
    with pytest.raises(HTTPException): prepare(user)

def test_second_pending_checkout_is_not_a_second_charge_or_third_device(shop, monkeypatch):
    db, user = shop
    prepare(user); confirm(user)
    other = 'DG-geraina-' + 'b' * 32
    with pytest.raises(HTTPException) as error: prepare(user, other)
    assert error.value.detail['code'] == 'addon_pending'
    monkeypatch.setattr(billing, 'fetch_payment_status', AsyncMock(return_value=proof()))
    run(billing.reconcile_order(ORDER))
    prepare(user, other); confirm(user, other)
    monkeypatch.setattr(billing, 'fetch_payment_status', AsyncMock(return_value=proof(order=other)))
    run(billing.reconcile_order(other))
    with pytest.raises(HTTPException): prepare(user, 'DG-geraina-' + 'c' * 32)

def test_expiry_and_required_plan_gate_new_capacity_without_deleting_devices(shop, monkeypatch):
    db, user = shop
    prepare(user); confirm(user)
    monkeypatch.setattr(billing, 'fetch_payment_status', AsyncMock(return_value=proof()))
    run(billing.reconcile_order(ORDER))
    run(db.addon_purchases.update_one({'_id': ORDER}, {'$set': {'expires_at': (NOW - timedelta(seconds=1)).isoformat()}}))
    assert run(plan_limits._active_addon_counts(db, STORE)) == {}
    run(db.addon_purchases.update_one({'_id': ORDER}, {'$set': {'expires_at': (NOW + timedelta(days=10)).isoformat()}}))
    assert run(plan_limits._active_addon_counts(db, STORE, 'starter')) == {}
    assert run(plan_limits._active_addon_counts(db, STORE, 'pro')) == {'extra_device': 1}

def test_renewal_extends_one_entitlement_and_refund_only_revokes_its_cycle(shop, monkeypatch):
    db, user = shop
    prepare(user); confirm(user)
    monkeypatch.setattr(billing, 'fetch_payment_status', AsyncMock(return_value=proof()))
    first = run(billing.reconcile_order(ORDER))
    renewal = 'DG-geraina-' + 'd' * 32
    prepare(user, renewal, renewalId=ORDER); confirm(user, renewal, renewalId=ORDER)
    monkeypatch.setattr(billing, 'fetch_payment_status', AsyncMock(return_value=proof(order=renewal, renewalId=ORDER, at=NOW + timedelta(seconds=1))))
    result = run(billing.reconcile_order(renewal))
    assert result['expires_at'] > first['expires_at']
    assert run(plan_limits._active_addon_counts(db, STORE)) == {'extra_device': 1}
    monkeypatch.setattr(billing, 'fetch_payment_status', AsyncMock(return_value=proof(order=renewal, renewalId=ORDER, state='refunded')))
    run(billing.reconcile_order(renewal))
    assert run(plan_limits._active_addon_counts(db, STORE)) == {'extra_device': 1}

def test_business_outlet_addon_grants_bundled_capacity(shop, monkeypatch):
    db, user = shop
    user = {**user, 'plan': 'business', 'subscriptions': {}}
    run(db.users.update_one({'id': OWNER}, {'$set': {'plan': 'business', 'subscriptions': {}}}))
    prepare(user, addon='extra_outlet'); confirm(user, addon='extra_outlet')
    monkeypatch.setattr(billing, 'fetch_payment_status', AsyncMock(return_value=proof(addon='extra_outlet')))
    run(billing.reconcile_order(ORDER))
    counts = run(plan_limits._active_addon_counts(db, STORE, 'business'))
    assert counts == {'extra_outlet': 1}
    assert plan_limits._addon_bonus(counts, 'max_devices') == 5
    assert plan_limits._addon_bonus(counts, 'max_employees') == 15

def test_refund_is_terminal_and_cannot_reactivate_capacity(shop, monkeypatch):
    db, user = shop
    prepare(user); confirm(user)
    for state in ('paid', 'refunded', 'paid'):
        monkeypatch.setattr(billing, 'fetch_payment_status', AsyncMock(return_value=proof(state=state)))
        run(billing.reconcile_order(ORDER))
    assert run(plan_limits._active_addon_counts(db, STORE, 'pro')) == {}
    assert run(db.addon_purchases.find_one({'_id': ORDER}))['status'] == 'revoked'
    assert run(db.users.find_one({'id': OWNER}))['subscriptions']['geraina']['order_id'] == 'base-paid-order'

def test_invoice_claim_is_scoped_to_owner_and_store(shop):
    from addon_billing import claim_invoice
    _, user = shop
    prepare(user); confirm(user)
    assert run(claim_invoice(ORDER, {**user, 'id': 'other-owner'})) == {'claimed': False}
    assert run(claim_invoice(ORDER, {**user, 'store_id': 'other-store'})) == {'claimed': False}
    assert run(claim_invoice(ORDER, user)) == {'claimed': True}
    assert run(claim_invoice(ORDER, user)) == {'claimed': False}

def test_expired_renewal_does_not_bypass_two_device_limit(shop):
    from addon_billing import view
    db, user = shop
    for i, days in enumerate((-1, 10, 20)):
        key = 'DG-geraina-' + str(i) * 32
        run(db.addon_purchases.insert_one({'_id': key, 'id': key, 'entitlement_id': key, 'store_id': STORE, 'addon_id': 'extra_device',
            'status': 'active', 'source': 'verified_checkout', 'expires_at': (NOW + timedelta(days=days)).isoformat()}))
    result = run(view(db, user))
    assert result['purchases'][0]['can_renew'] is False
    assert result['purchases'][1]['can_renew'] is True
