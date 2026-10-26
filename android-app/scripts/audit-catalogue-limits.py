"""Reproduce catalogue/history truncation in isolated in-memory stores."""
import asyncio
import json
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'backend'))
os.environ.setdefault('ENV', 'test')
os.environ.setdefault('JWT_SECRET_KEY', 'catalogue-audit-only-not-a-production-secret-32-characters')
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
import auth
import routes_products
import routes_orders

db = AsyncMongoMockClient().catalogue_limit_audit
user = {'id': 'isolated-owner', 'store_id': 'isolated-store', 'role': 'Owner', 'plan': 'business'}
routes_products.get_db = lambda: db
routes_orders.get_db = lambda: db
app = FastAPI()
app.include_router(routes_products.router)
app.include_router(routes_orders.router)
app.dependency_overrides[auth.get_current_user] = lambda: user
asyncio.run(db.products.insert_many([{'id': f'product-{i}', 'store_id': user['store_id'], 'name': f'Product {i:04d}', 'sku': f'SKU-{i}', 'stock': 1, 'price': 1000} for i in range(501)]))
asyncio.run(db.orders.insert_many([{'id': f'order-{i}', 'store_id': user['store_id'], 'order_no': f'ORDER-{i:04d}', 'created_at': f'2026-10-26T00:00:{i:04d}Z'} for i in range(201)]))
with TestClient(app) as client:
    products = client.get('/api/products')
    orders = client.get('/api/orders')
    search = client.get('/api/products', params={'q': 'SKU-500'})
    assert products.status_code == orders.status_code == search.status_code == 200
    assert len(products.json()) == 500 and 'product-500' not in {row['id'] for row in products.json()}
    assert len(orders.json()) == 200 and 'order-0' not in {row['id'] for row in orders.json()}
    assert [row['id'] for row in search.json()] == ['product-500']
report = {
    'status': 'confirmed_open_findings', 'scope': __doc__, 'merchantWrites': 0,
    'catalogue': {'fixtureProducts': 501, 'defaultResponseProducts': 500, 'missingProduct': 'product-500', 'serverSearchFindsMissingProduct': True, 'posUsesServerSearchOrPagination': False},
    'history': {'fixtureOrders': 201, 'defaultResponseOrders': 200, 'missingOlderOrder': 'order-0', 'salesSearchIsClientSide': True},
}
out = root / 'android-app/app/build/reports/navigation-audit/catalogue-limit-findings.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
