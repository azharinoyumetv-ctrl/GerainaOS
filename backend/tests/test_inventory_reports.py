"""Inventory report regressions, using isolated stores and no production service."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

os.environ.setdefault('ENV', 'test')
os.environ.setdefault('JWT_SECRET_KEY', 'inventory-tests-only-not-production-32-characters')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
import auth
import routes_reports as reports
from paging import encode_cursor

run = asyncio.run
END = datetime(2026, 10, 26, 10, tzinfo=timezone.utc)
START = END - timedelta(days=30)
URL = '/api/reports/inventory/dead-stock'


@pytest.fixture
def inventory(monkeypatch):
    db = AsyncMongoMockClient().inventory_report_tests
    user = {'id': 'owner-a', 'store_id': 'store-a', 'role': 'Owner', 'plan': 'business'}
    clock = {'now': END}
    monkeypatch.setattr(reports, 'get_db', lambda: db)
    monkeypatch.setattr(reports, 'utcnow', lambda: clock['now'])
    app = FastAPI()
    app.include_router(reports.router)
    app.dependency_overrides[auth.get_current_user] = lambda: user
    return db, user, TestClient(app), clock


def product(identifier, **changes):
    return {'id': identifier, 'store_id': 'store-a', 'name': identifier,
            'stock': 1, 'cost': 100, **changes}


def sale(identifier, at=END, status='paid', quantity=1, **changes):
    return {'id': f'sale-{identifier}', 'store_id': 'store-a',
            'payment_status': status, 'created_at': at.isoformat(),
            'items': [{'product_id': identifier, 'quantity': quantity}], **changes}


def test_every_paid_order_and_product_is_considered_with_scoped_pages(inventory):
    db, _, client, _ = inventory
    run(db.products.insert_many([product(f'p-{i:04d}') for i in range(620)] + [
        product('foreign', store_id='store-b'), product('zero', stock=0),
        product('negative', stock=-1), product('inactive', active=False),
    ]))
    # 120 distinct sold products exceed the legacy latest-100-order sample.
    run(db.orders.insert_many([sale(f'p-{i:04d}', END - timedelta(minutes=i)) for i in range(120)] + [
        sale('p-0619', store_id='store-b'),
    ]))
    received, cursor, pages = [], None, 0
    while True:
        response = client.get(URL, params={'limit': 50, **({'cursor': cursor} if cursor else {})})
        assert response.status_code == 200
        value = response.json()
        assert value['total'] == 501 and len(value['items']) <= 50
        assert value['days'] == 30
        assert value['window_start'] == START.isoformat()
        assert value['window_end'] == END.isoformat()
        received += value['items']; cursor = value['next_cursor']; pages += 1
        if cursor is None:
            break
    ids = [row['id'] for row in received]
    assert pages == 11 and len(ids) == len(set(ids)) == 501
    assert ids == sorted(['inactive'] + [f'p-{i:04d}' for i in range(120, 620)])
    assert all(row['store_id'] == 'store-a' and '_id' not in row for row in received)
    # Reading reports must not alter either collection.
    assert run(db.products.count_documents({})) == 624
    assert run(db.orders.count_documents({})) == 121


@pytest.mark.parametrize('at,status,quantity,expected_dead', [
    (END, 'paid', 1, False),
    (START, 'paid', 1, False),
    (START - timedelta(microseconds=1), 'paid', 1, True),
    (END + timedelta(microseconds=1), 'paid', 1, True),
    (datetime(2000, 1, 1, tzinfo=timezone.utc), 'paid', 1, True),
    (END, 'pending', 1, True),
    (END, 'failed', 1, True),
    (END, 'voided', 1, True),
    (END, 'paid', 0, True),
    (END, 'paid', -1, True),
])
def test_only_positive_paid_sales_inside_window_count(inventory, at, status, quantity, expected_dead):
    db, _, client, _ = inventory
    run(db.products.insert_one(product('coffee')))
    run(db.orders.insert_one(sale('coffee', at, status, quantity)))
    response = client.get(URL)
    assert response.status_code == 200
    assert response.json()['total'] == int(expected_dead)
    assert [row['id'] for row in response.json()['items']] == (['coffee'] if expected_dead else [])


def test_cursor_keeps_the_same_thirty_day_window_when_clock_advances(inventory):
    db, _, client, clock = inventory
    run(db.products.insert_many([product(f'p-{i:03d}') for i in range(55)]))
    run(db.orders.insert_one(sale('p-054', START + timedelta(hours=1))))
    first = client.get(URL).json()
    assert len(first['items']) == 50 and first['total'] == 54
    clock['now'] += timedelta(days=2)
    second = client.get(URL, params={'cursor': first['next_cursor']}).json()
    assert second['window_start'] == first['window_start']
    assert second['window_end'] == first['window_end']
    assert second['total'] == 54 and len(second['items']) == 4
    assert second['next_cursor'] is None
    assert 'p-054' not in [row['id'] for row in second['items']]
    assert client.get(URL).json()['total'] == 55


@pytest.mark.parametrize('cursor', [
    'invalid', 'e30', 'A' * 1001,
    encode_cursor({'id': 'p', 'as_of': 'not-a-date'}),
    encode_cursor({'id': 'p', 'as_of': '2026-10-26T10:00:00'}),
    encode_cursor({'id': 'p', 'as_of': (END + timedelta(seconds=1)).isoformat()}),
])
def test_malformed_or_future_cursor_is_rejected(inventory, cursor):
    assert inventory[2].get(URL, params={'cursor': cursor}).status_code == 400


@pytest.mark.parametrize('limit', [0, -1, 101])
def test_page_size_is_bounded(inventory, limit):
    assert inventory[2].get(URL, params={'limit': limit}).status_code == 422


@pytest.mark.parametrize('role,plan,status', [
    ('Owner', 'business', 200), ('Manager', 'pro', 200),
    ('Warehouse', 'pro', 200), ('Owner', 'trial', 200),
    ('Cashier', 'business', 403), ('Owner', 'starter', 403),
])
def test_inventory_permission_and_plan_are_enforced(inventory, role, plan, status):
    _, user, client, _ = inventory
    user.update(role=role, plan=plan)
    response = client.get(URL)
    assert response.status_code == status
    if status == 200:
        assert response.json()['items'] == []
        assert response.json()['total'] == 0
        assert response.json()['next_cursor'] is None
