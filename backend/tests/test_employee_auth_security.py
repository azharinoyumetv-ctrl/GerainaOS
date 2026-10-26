"""Real JWT/auth dependencies against an isolated in-memory DB; no merchant data or messages."""
import asyncio
from contextlib import ExitStack
import os
from pathlib import Path
import sys
from unittest.mock import AsyncMock, patch

os.environ.setdefault("JWT_SECRET_KEY", "employee-auth-test-secret-at-least-thirty-two-bytes")
os.environ.setdefault("ENV", "test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
import pytest
import jwt
import auth
import routes_auth
import routes_settings
import routes_products
import routes_inventory
import routes_purchase
import routes_customers
import routes_orders
import routes_offline
import routes_edc
import routes_reports
import routes_devices
import routes_pricing
import routes_pdf
import routes_printer
import plan_limits
from permissions import capabilities_for, has_permission, require_permission

run = asyncio.run
PASSWORD = "UniqueFixture123"
HASH = auth.hash_password(PASSWORD)
WEAK_HASH = auth.hash_password("geraina123")


@pytest.mark.parametrize("path", ["/protected", "/billing-owner"])
def test_operational_backend_rejects_other_module_header(fixture, path):
    db, client, owner, employee = fixture[:4]
    token = auth.create_access_token(owner["id"], owner["store_id"], "Owner", owner["email"])
    response = client.get(path, headers={"Authorization": f"Bearer {token}", "X-DagangOS-Module": "dapuros"})
    assert response.status_code == 409
    assert response.json()["detail"] == "wrong_backend_for_module"


@pytest.fixture
def fixture():
    db = AsyncMongoMockClient().employee_auth_fixture
    owner = {"id": "owner-a", "email": "fixture.owner@example.com", "role": "Owner", "store_id": "store-a", "store_name": "Fixture store", "plan": "business", "password_hash": HASH}
    employee = {"id": "user-cashier", "email": "fixture.owner.cashier@example.com", "role": "Cashier", "store_id": "store-a", "store_name": "Stale staff label", "plan": "expired", "password_hash": HASH, "credential_version": 2, "must_change_password": False, "status": "Aktif"}
    member = {"id": "employee-a", "user_id": employee["id"], "store_id": "store-a", "name": "Fixture employee", "email": employee["email"], "role": "Cashier", "status": "Aktif"}
    run(db.users.insert_many([owner.copy(), employee.copy()]))
    run(db.staff.insert_one(member.copy()))
    run(db.stores.insert_one({"id": "store-a", "name": "Fixture store", "owner_user_id": owner["id"], "module": "geraina"}))
    app = FastAPI()
    app.include_router(routes_auth.router)
    route_modules = (routes_settings, routes_products, routes_inventory, routes_purchase, routes_customers, routes_orders, routes_offline, routes_edc, routes_reports, routes_devices, routes_pricing, routes_pdf, routes_printer)
    for module in route_modules:
        app.include_router(module.router)

    @app.get("/protected")
    async def protected(user: dict = Depends(auth.get_current_user)):
        return {"role": user["role"], "id": user["id"], "store_id": user["store_id"], "staff_id": user.get("staff_id"), "plan": user["plan"]}

    @app.get("/owner")
    async def owner_only(user: dict = Depends(auth.require_admin)):
        return {"id": user["id"]}

    @app.get("/billing-owner")
    async def billing_owner(user: dict = Depends(auth.require_billing_admin)):
        return {"id": user["id"]}

    @app.get("/manage-products")
    async def products(user: dict = Depends(require_permission("products.write"))):
        return {"id": user["id"]}

    with ExitStack() as stack:
        for module in (auth, routes_auth, *route_modules):
            stack.enter_context(patch.object(module, "get_db", lambda: db))
        stack.enter_context(patch.object(routes_auth, "reconcile_pending", AsyncMock()))
        yield db, TestClient(app), owner, employee, member


def login(client, employee, password=PASSWORD, **extra):
    return client.post("/api/auth/login", json={"email": employee["email"], "password": password, **extra}, headers={"X-DagangOS-Module": "geraina"})


def headers(user, version=None, legacy=False):
    token = auth.create_access_token(user["id"], user.get("store_id"), user["role"], user["email"], user.get("credential_version", 0) if version is None else version)
    if legacy:
        payload = jwt.decode(token, auth.JWT_SECRET, algorithms=[auth.JWT_ALG]); payload.pop("cv")
        token = jwt.encode(payload, auth.JWT_SECRET, algorithm=auth.JWT_ALG)
    return {"Authorization": "Bearer " + token, "X-DagangOS-Module": "geraina"}


def test_login_uses_membership_not_email_or_client_role_and_inherits_current_owner_plan(fixture):
    _, client, _, employee, member = fixture
    response = login(client, employee, role="Owner", store_id="other-store")
    assert response.status_code == 200
    data = response.json(); user = data["user"]
    assert user["role"] == "Cashier" and user["id"] == employee["id"]
    assert user["staff_id"] == member["id"] and user["store_id"] == "store-a"
    assert user["store_name"] == "Fixture store" and user["plan"] == "business"
    assert user["name"] == member["name"]
    assert user["is_store_owner"] is False and user["must_change_password"] is False
    assert "attendance.self" in user["capabilities"] and "*" not in user["capabilities"]
    assert "password_hash" not in user and "password" not in user
    payload = jwt.decode(data["access_token"], auth.JWT_SECRET, algorithms=[auth.JWT_ALG])
    assert payload["cv"] == 2 and payload["sub"] == employee["id"]


@pytest.mark.parametrize("changes", [{"status": "Non-Aktif"}, {"status": "inactive"}, {"disabled": True}, {"is_active": False}, {"deleted_at": "2026-01-01"}])
def test_disabled_user_cannot_login_or_keep_old_session(fixture, changes):
    db, client, _, employee, _ = fixture
    run(db.users.update_one({"id": employee["id"]}, {"$set": changes}))
    assert login(client, employee).status_code == 403
    assert client.get("/protected", headers=headers(employee)).status_code == 401


@pytest.mark.parametrize("status", ["Non-Aktif", "inactive", "disabled"])
def test_disabled_membership_cannot_login_or_keep_old_session(fixture, status):
    db, client, _, employee, member = fixture
    run(db.staff.update_one({"id": member["id"]}, {"$set": {"status": status}}))
    assert login(client, employee).status_code == 401
    assert client.get("/protected", headers=headers(employee)).status_code == 401


def test_deleted_membership_and_cross_product_access_are_rejected(fixture):
    db, client, _, employee, member = fixture
    assert client.get("/protected", headers={**headers(employee), "X-DagangOS-Module": "dapuros"}).status_code == 409
    run(db.staff.delete_one({"id": member["id"]}))
    assert login(client, employee).status_code == 401
    assert client.get("/protected", headers=headers(employee)).status_code == 401


def test_legacy_user_and_old_tokens_cannot_claim_employee_account(fixture):
    db, client, _, employee, _ = fixture
    run(db.users.update_one({"id": employee["id"]}, {"$unset": {"credential_version": ""}, "$set": {"password_hash": WEAK_HASH}}))
    assert login(client, employee, password="geraina123").status_code == 403
    assert client.get("/protected", headers=headers(employee, version=0, legacy=True)).status_code in (401, 403)


def test_shared_default_is_rejected_even_with_an_inconsistent_version_marker(fixture):
    db, client, _, employee, _ = fixture
    run(db.users.update_one({"id": employee["id"]}, {"$set": {"password_hash": WEAK_HASH, "must_change_password": True}}))
    assert login(client, employee, password="geraina123").status_code == 403


def test_old_employee_token_without_cv_is_rejected_after_owner_set_credentials(fixture):
    db, client, _, employee, _ = fixture
    run(db.users.update_one({"id": employee["id"]}, {"$set": {"credential_version": 0}}))
    assert client.get("/protected", headers=headers(employee, version=0, legacy=True)).status_code == 401


@pytest.mark.parametrize("role", ["Owner", "admin", "Unknown"])
def test_employee_cannot_receive_owner_or_unknown_membership_role(fixture, role):
    db, client, _, employee, member = fixture
    run(db.staff.update_one({"id": member["id"]}, {"$set": {"role": role}}))
    run(db.users.update_one({"id": employee["id"]}, {"$set": {"role": role}}))
    assert login(client, employee).status_code == 403
    assert client.get("/owner", headers=headers(employee)).status_code == 403


def test_users_role_alone_cannot_escalate_a_real_cashier_membership(fixture):
    db, client, _, employee, _ = fixture
    run(db.users.update_one({"id": employee["id"]}, {"$set": {"role": "Owner"}}))
    response = login(client, employee)
    assert response.status_code == 200 and response.json()["user"]["role"] == "Cashier"
    assert client.get("/owner", headers=headers(employee)).status_code == 403


def test_current_versions_revoke_old_tokens_after_reset_or_role_change(fixture):
    db, client, _, employee, _ = fixture
    assert client.get("/protected", headers=headers(employee)).status_code == 200
    run(db.users.update_one({"id": employee["id"]}, {"$inc": {"credential_version": 1}}))
    assert client.get("/protected", headers=headers(employee)).status_code == 401
    response = login(client, employee)
    assert response.status_code == 200
    assert client.get("/protected", headers={"Authorization": "Bearer " + response.json()["access_token"]}).status_code == 200


def test_temporary_credential_only_unlocks_identity_and_password_change(fixture):
    db, client, _, employee, _ = fixture
    run(db.users.update_one({"id": employee["id"]}, {"$set": {"must_change_password": True}}))
    response = login(client, employee); assert response.status_code == 200
    assert response.json()["user"]["must_change_password"] is True
    assert client.get("/api/auth/me", headers=headers(employee)).status_code == 200
    assert client.get("/protected", headers=headers(employee)).status_code == 403
    assert client.post("/api/auth/stores", headers=headers(employee), json={"module": "dapuros", "store_name": "Unauthorized"}).status_code == 403


@pytest.mark.parametrize("new_password", ["short1", "abcdefghijk", "12345678901", "geraina123", PASSWORD, "é" * 36 + "1"])
def test_employee_password_change_validates_unique_strong_password(fixture, new_password):
    db, client, _, employee, _ = fixture
    response = client.post("/api/auth/change-password", headers=headers(employee), json={"current_password": PASSWORD, "new_password": new_password})
    assert response.status_code in (400, 422)
    assert run(db.users.find_one({"id": employee["id"]}))["credential_version"] == 2


def test_password_change_rotates_session_and_never_changes_owner_credentials(fixture):
    db, client, owner, employee, _ = fixture
    run(db.users.update_one({"id": employee["id"]}, {"$set": {"must_change_password": True}}))
    response = client.post("/api/auth/change-password", headers=headers(employee), json={"current_password": PASSWORD, "new_password": "ChangedUnique456"})
    assert response.status_code == 200
    result = response.json(); assert result["user"]["must_change_password"] is False
    assert result["user"]["credential_version"] == 3
    assert client.get("/protected", headers=headers(employee)).status_code == 401
    assert client.get("/protected", headers={"Authorization": "Bearer " + result["access_token"]}).status_code == 200
    assert login(client, employee).status_code == 401
    assert login(client, employee, password="ChangedUnique456").status_code == 200
    forbidden = client.post("/api/auth/change-password", headers=headers(owner), json={"current_password": PASSWORD, "new_password": "ChangedUnique456"})
    assert forbidden.status_code == 403
    assert run(db.users.find_one({"id": owner["id"]}))["password_hash"] == HASH


def test_owner_legacy_jwt_and_legacy_store_identity_remain_supported(fixture):
    db, client, owner, _, _ = fixture
    assert client.get("/owner", headers=headers(owner, legacy=True)).status_code == 200
    run(db.stores.update_one({"id": "store-a"}, {"$unset": {"owner_user_id": "", "module": ""}}))
    assert client.get("/owner", headers=headers(owner, legacy=True)).status_code == 200
    assert login(client, owner).json()["user"]["is_store_owner"] is True


@pytest.mark.parametrize("stale_role", ["Cashier", "Warehouse", "admin"])
def test_actual_owner_authority_survives_a_stale_role_snapshot(fixture, stale_role):
    db, client, owner, _, _ = fixture
    run(db.users.update_one({"id": owner["id"]}, {"$set": {"role": stale_role}}))
    assert client.get("/owner", headers=headers(owner, legacy=True)).status_code == 200
    result = login(client, owner)
    assert result.status_code == 200 and result.json()["user"]["role"] == "Owner"
    run(db.stores.update_one({"id": "store-a"}, {"$set": {"module": "dapuros"}}))
    assert login(client, owner).status_code == 200


def test_expired_owner_can_still_reach_billing_and_sso_activation(fixture):
    db, client, owner, _, _ = fixture
    run(db.users.update_one({"id": owner["id"]}, {"$set": {"plan": "expired"}}))
    assert client.get("/protected", headers=headers(owner)).status_code == 402
    assert client.get("/billing-owner", headers=headers(owner)).status_code == 200
    run(db.stores.update_one({"id": "store-a"}, {"$set": {"module": "dapuros"}}))
    response = login(client, owner)
    assert response.status_code == 200 and response.json()["user"]["store_id"] is None
    assert client.get("/api/auth/me", headers=headers(owner)).status_code == 200


def test_capability_helpers_deny_staff_owner_actions_and_unknown_roles(fixture):
    _, client, owner, employee, _ = fixture
    assert client.get("/manage-products", headers=headers(employee)).status_code == 403
    assert client.get("/manage-products", headers=headers(owner)).status_code == 200
    assert not has_permission({"role": "Invented"}, "products.write")
    assert capabilities_for("admin") == ["*"]


@pytest.mark.parametrize("method,path,payload", [
    ("POST", "/api/settings", {"general": {"store_name": "Unauthorized"}}),
    ("GET", "/api/payments/config", None),
    ("POST", "/api/payments/config", {"bank_transfer": {"accounts": []}}),
    ("POST", "/api/payments/bank-qris", {"is_active": False}),
    ("GET", "/api/integrations", None),
    ("POST", "/api/integrations", {"xendit": {"is_active": True, "secret_key": "fixture-only"}}),
    ("POST", "/api/integrations/whatsapp/test", {}),
    ("GET", "/api/branches", None),
    ("POST", "/api/branches", {}),
    ("GET", "/api/devices", None),
    ("POST", "/api/devices", {}),
    ("GET", "/api/pricing/addons/my", None),
    ("POST", "/api/products", {}),
    ("PUT", "/api/products/product-a", {}),
    ("DELETE", "/api/products/product-a", None),
    ("POST", "/api/products/bulk-import", {}),
    ("GET", "/api/products/import-template.csv", None),
    ("POST", "/api/products/categories", {}),
    ("POST", "/api/products/brands", {}),
    ("POST", "/api/products/units", {}),
    ("POST", "/api/products/stock-adjustments", {}),
    ("POST", "/api/products/stock-transfers", {}),
    ("GET", "/api/purchase/orders", None),
    ("POST", "/api/purchase/orders", {}),
    ("POST", "/api/suppliers", {}),
    ("POST", "/api/debt/receivables", {}),
    ("POST", "/api/debt/payables", {}),
    ("GET", "/api/reports/profit", None),
    ("POST", "/api/expenses", {}),
    ("DELETE", "/api/customers/customer-a", None),
    ("GET", "/api/orders/product-sales", None),
])
def test_cashier_denied_operational_admin_boundaries_without_writes(fixture, method, path, payload):
    db, client, _, employee, _ = fixture
    response = client.request(method, path, headers=headers(employee), **({"json": payload} if payload is not None else {}))
    assert response.status_code == 403, (method, path, response.status_code)
    for collection in ("settings", "integrations", "products", "categories", "brands", "units", "stock_adjustments", "stock_transfers", "purchase_orders", "suppliers", "debt_receivables", "debt_payables", "expenses", "devices", "bank_qris_configs"):
        assert run(db[collection].count_documents({})) == 0


@pytest.mark.parametrize("method,path", [
    ("POST", "/api/orders"),
    ("GET", "/api/orders"),
    ("POST", "/api/offline/orders"),
    ("POST", "/api/edc/orders/order-a/charge"),
    ("GET", "/api/pdf/receipt/order-a"),
    ("GET", "/api/printer/orders/order-a/escpos"),
    ("POST", "/api/products"),
    ("POST", "/api/products/units"),
])
def test_warehouse_cannot_create_sales_or_change_product_master_data(fixture, method, path):
    db, client, _, employee, member = fixture
    run(db.staff.update_one({"id": member["id"]}, {"$set": {"role": "Warehouse"}}))
    run(db.users.update_one({"id": employee["id"]}, {"$set": {"role": "Warehouse"}}))
    response = client.request(method, path, headers=headers({**employee, "role": "Warehouse"}), **({"json": {}} if method == "POST" else {}))
    assert response.status_code == 403
    assert run(db.orders.count_documents({})) == 0
    assert run(db.products.count_documents({})) == 0


def test_employee_settings_are_display_only_and_public_qris_remains_readable(fixture):
    db, client, owner, employee, _ = fixture
    saved = {"store_id": "store-a", "general": {"store_name": "Fixture", "timezone": "Asia/Jakarta", "private_key": "fixture-secret"}, "receipt": {"footer_text": "Thanks", "show_cashier": True}, "printer": {"mode": "local", "paper_size": "80mm", "password": "fixture-secret"}, "security": {"secret": "fixture-secret"}}
    run(db.settings.insert_one(saved.copy()))
    response = client.get("/api/settings", headers=headers(employee)); assert response.status_code == 200
    assert response.json() == {"general": {"store_name": "Fixture", "timezone": "Asia/Jakarta"}, "receipt": {"footer_text": "Thanks", "show_cashier": True}, "printer": {"mode": "local", "paper_size": "80mm"}}
    assert client.get("/api/settings", headers=headers(owner)).json()["security"]["secret"] == "fixture-secret"
    assert client.get("/api/payments/bank-qris", headers=headers(employee)).status_code == 200
    assert run(db.settings.find_one({"store_id": "store-a"}))["general"]["store_name"] == "Fixture"


def test_manager_product_writes_are_scoped_and_warehouse_stock_reads_work(fixture):
    db, client, _, employee, member = fixture
    product = {"id": "foreign-product", "store_id": "store-b", "name": "Other store product", "price": 50, "stock": 10}
    run(db.products.insert_one(product.copy()))
    run(db.staff.update_one({"id": member["id"]}, {"$set": {"role": "Manager"}}))
    manager_headers = headers({**employee, "role": "Manager"})
    response = client.put("/api/products/foreign-product", headers=manager_headers, json={"name": "Changed"})
    assert response.status_code == 404
    assert run(db.products.find_one({"id": "foreign-product"}))["name"] == "Other store product"
    assert client.get("/api/products", headers=manager_headers).json() == []
    run(db.staff.update_one({"id": member["id"]}, {"$set": {"role": "Warehouse"}}))
    warehouse_headers = headers({**employee, "role": "Warehouse"})
    assert client.get("/api/products/stock-adjustments", headers=warehouse_headers).status_code == 200
    assert client.get("/api/products/stock-transfers", headers=warehouse_headers).status_code == 200
