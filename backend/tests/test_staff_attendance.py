"""Staff credentials and attendance use isolated Mongo mocks; no merchant/network writes."""
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

os.environ.setdefault("ENV", "test")
os.environ.setdefault("JWT_SECRET_KEY", "staff-attendance-fixtures-only-secret")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
import auth
import routes_staff as staff
from models import AttendanceCheckIn

run = asyncio.run
PASSWORD = "UniqueFixture123!"


@pytest.fixture
def fixture(monkeypatch):
    db = AsyncMongoMockClient().staff_attendance_tests
    actor = {"id": "owner-a", "store_id": "store-a", "store_name": "Fixture store", "name": "Fixture Owner", "email": "owner-a@example.com", "role": "Owner", "is_store_owner": True, "plan": "business"}
    run(db.stores.insert_one({"id": "store-a", "owner_user_id": "owner-a", "module": "geraina"}))
    run(db.users.insert_one({**actor, "credential_version": 0, "password_hash": auth.hash_password(PASSWORD)}))
    for module in (staff, auth):
        monkeypatch.setattr(module, "get_db", lambda: db)
    app = FastAPI(); app.include_router(staff.router)
    app.dependency_overrides[auth.get_current_user] = lambda: actor
    return db, actor, TestClient(app)


def create(client, **changes):
    return client.post("/api/staff", json={"name": "Fixture Employee", "email": "employee@example.com", "phone": "", "role": "Cashier", "status": "Aktif", "initial_password": PASSWORD, **changes})


def update(client, row, **changes):
    payload = {key: row.get(key) for key in ("name", "email", "phone", "role", "status")}
    return client.put("/api/staff/" + row["id"], json={**payload, **changes})


def clock_in(client, request_id=None):
    return client.post("/api/attendance/me/check-in", json={"request_id": str(request_id or uuid4())})


def clock_out(client, attendance_id=None):
    if attendance_id is None:
        current = client.get("/api/attendance/me").json()
        row = current.get("open_shift") or next(iter(current.get("history", [])), {})
        attendance_id = row.get("id", "missing")
    return client.post("/api/attendance/me/check-out", json={"attendance_id": attendance_id})


def as_employee(db, actor, role="Cashier", identity="employee-a"):
    row = {"id": identity, "user_id": identity, "store_id": "store-a", "name": "Actual Employee", "email": "employee-a@example.com", "role": role, "status": "Aktif"}
    run(db.staff.insert_one(row))
    actor.update(id=identity, role=role, name="Authenticated Employee", is_store_owner=False)
    return row


@pytest.mark.parametrize("role", ["Manager", "Cashier", "Warehouse"])
def test_owner_creates_linked_employee_with_unique_temporary_password_and_no_secret_response(fixture, role):
    db, _, client = fixture
    response = create(client, role=role)
    assert response.status_code == 200
    row = response.json(); account = run(db.users.find_one({"id": row["user_id"]}))
    assert row["id"] == row["user_id"] == account["staff_id"]
    assert account["credential_version"] == 0 and account["must_change_password"] is True
    assert account["role"] == role and auth.verify_password(PASSWORD, account["password_hash"])
    for body in (row, client.get("/api/staff").json()[0]):
        assert "initial_password" not in body and "password_hash" not in body


@pytest.mark.parametrize("role", ["Manager", "Cashier", "Warehouse"])
def test_non_owner_cannot_create_edit_reset_or_deactivate_employee(fixture, role):
    db, actor, client = fixture
    row = create(client).json(); actor["role"] = role
    assert create(client, email="second@example.com").status_code == 403
    assert update(client, row, initial_password="AnotherUnique123").status_code == 403
    assert client.delete("/api/staff/" + row["id"]).status_code == 403
    assert client.get("/api/staff").status_code == (200 if role == "Manager" else 403)


@pytest.mark.parametrize("role", ["Owner", "admin", "not-a-role"])
def test_employee_assignments_cannot_grant_owner_or_unknown_role(fixture, role):
    db, _, client = fixture
    assert create(client, role=role).status_code == 422
    assert run(db.staff.count_documents({})) == 0


@pytest.mark.parametrize("password", ["short1", "abcdefghijk", "12345678901", "geraina123", "é" * 40 + "123"])
def test_weak_or_bcrypt_oversized_initial_password_is_rejected(fixture, password):
    db, _, client = fixture
    response = create(client, initial_password=password)
    assert response.status_code in (400, 422)
    assert password not in response.text
    assert run(db.staff.count_documents({})) == 0


def test_owner_email_and_cross_store_email_collisions_do_not_change_existing_accounts(fixture):
    db, _, client = fixture
    foreign = {"id": "foreign", "store_id": "store-b", "email": "foreign@example.com", "role": "Owner", "password_hash": "unchanged"}
    run(db.users.insert_one(foreign.copy()))
    assert create(client, email="owner-a@example.com").status_code == 409
    assert create(client, email="FOREIGN@example.com").status_code == 409
    row = create(client).json()
    assert update(client, row, email="foreign@example.com").status_code == 409
    assert run(db.users.find_one({"id": "foreign"}))["password_hash"] == "unchanged"
    assert run(db.users.find_one({"id": "owner-a"}))["role"] == "Owner"


def test_duplicate_email_case_and_repeated_staff_create_are_rejected(fixture):
    db, _, client = fixture
    assert create(client).status_code == 200
    assert create(client, email="EMPLOYEE@example.com").status_code == 409
    assert run(db.staff.count_documents({})) == 1


def test_role_email_password_and_inactive_state_are_synchronized_and_revoke_old_session_versions(fixture):
    db, _, client = fixture
    row = create(client).json()
    response = update(client, row, email="changed@example.com", role="Manager", status="Non-Aktif", initial_password="ResetFixture123!")
    assert response.status_code == 200
    account = run(db.users.find_one({"id": row["user_id"]}))
    assert (account["email"], account["role"], account["status"]) == ("changed@example.com", "Manager", "Non-Aktif")
    assert account["credential_version"] == 1 and account["must_change_password"] is True
    assert auth.verify_password("ResetFixture123!", account["password_hash"])
    assert not auth.verify_password(PASSWORD, account["password_hash"])


def test_soft_deactivation_preserves_staff_user_attendance_and_is_idempotent(fixture):
    db, _, client = fixture
    row = create(client).json()
    run(db.attendance.insert_one({"id": "history", "store_id": "store-a", "user_id": row["user_id"]}))
    assert client.delete("/api/staff/" + row["id"]).status_code == 200
    assert client.delete("/api/staff/" + row["id"]).status_code == 200
    account = run(db.users.find_one({"id": row["user_id"]}))
    assert account["status"] == "Non-Aktif" and account["credential_version"] == 1
    assert run(db.staff.count_documents({})) == run(db.attendance.count_documents({})) == 1
    response = update(client, {**row, "status": "Non-Aktif"}, status="Aktif")
    assert response.status_code == 200 and response.json()["login_enabled"] is True
    account = run(db.users.find_one({"id": row["user_id"]}))
    assert account["credential_version"] == 2 and account["is_active"] is True


def test_true_store_owner_legacy_roster_row_is_read_only(fixture):
    db, _, client = fixture
    row = {"id": "legacy-owner-row", "store_id": "store-a", "name": "Owner", "email": "owner-a@example.com", "role": "Owner", "status": "Aktif"}
    run(db.staff.insert_one(row.copy()))
    assert client.get("/api/staff").json()[0]["is_owner_account"] is True
    assert update(client, row, role="Manager", initial_password="NotAllowedReset123").status_code == 403
    assert client.delete("/api/staff/" + row["id"]).status_code == 403
    assert run(db.users.find_one({"id": "owner-a"}))["credential_version"] == 0


def test_unlinked_legacy_record_needs_owner_reset_and_is_not_matched_to_foreign_account(fixture):
    db, _, client = fixture
    row = {"id": "legacy-staff", "store_id": "store-a", "name": "Legacy employee", "email": "legacy@example.com", "role": "Cashier", "status": "Aktif"}
    run(db.staff.insert_one(row.copy()))
    assert update(client, row).status_code == 400
    response = update(client, row, initial_password=PASSWORD)
    assert response.status_code == 200 and response.json()["user_id"] != row["id"]
    assert run(db.users.find_one({"id": response.json()["user_id"]}))["must_change_password"] is True


def test_staff_id_in_another_store_is_not_editable_or_deactivated(fixture):
    db, actor, client = fixture
    row = create(client).json(); actor["store_id"] = "store-b"
    assert update(client, row).status_code == 404
    assert client.delete("/api/staff/" + row["id"]).status_code == 404
    assert run(db.users.find_one({"id": row["user_id"]}))["status"] == "Aktif"


def test_failed_staff_insert_does_not_leave_an_orphan_login(fixture, monkeypatch):
    db, _, client = fixture
    collection = db.staff
    class StaffProxy:
        def __getattr__(self, name):
            return getattr(collection, name)
        async def insert_one(self, document):
            raise RuntimeError("isolated insert failure")
    class DatabaseProxy:
        staff = StaffProxy()
        def __getattr__(self, name):
            return getattr(db, name)
        def __getitem__(self, name):
            return getattr(self, name)
    monkeypatch.setattr(staff, "get_db", lambda: DatabaseProxy())
    with pytest.raises(RuntimeError):
        create(client)
    assert run(db.users.count_documents({"email": "employee@example.com"})) == 0


@pytest.mark.parametrize("role", ["Owner", "Manager", "Cashier", "Warehouse"])
def test_entitled_roles_clock_their_actual_identity_from_server_time(fixture, monkeypatch, role):
    db, actor, client = fixture
    if role != "Owner":
        as_employee(db, actor, role)
    now = datetime(2026, 10, 25, 17, 30, tzinfo=timezone.utc)
    monkeypatch.setattr(staff, "utcnow", lambda: now)
    response = clock_in(client)
    assert response.status_code == 200
    row = response.json()
    assert row["user_id"] == actor["id"] and row["clock_in"] == now.isoformat()
    assert row["staff_name"] == ("Fixture Owner" if role == "Owner" else "Actual Employee")
    assert row["work_date"] == "2026-10-26" and row["timezone"] == "Asia/Jakarta"
    own = client.get("/api/attendance/me").json()
    assert own["open_shift"]["id"] == row["id"] and own["history"][0]["id"] == row["id"]


@pytest.mark.parametrize("route", ["/api/attendance", "/api/attendance/me/check-in", "/api/attendance/me/check-out"])
def test_forged_identity_time_status_or_owner_override_body_is_rejected(fixture, route):
    _, _, client = fixture
    response = client.post(route, json={"staff_name": "Someone else", "user_id": "other", "clock_in": "2099-01-01", "status": "Hadir"})
    assert response.status_code == 422


def test_duplicate_and_concurrent_clock_ins_create_only_one_open_shift(fixture):
    db, actor, client = fixture
    as_employee(db, actor)
    one = clock_in(client).json()
    two = client.post("/api/attendance", json={}).json()
    assert one["id"] == two["id"]
    async def concurrent():
        return await asyncio.gather(*(staff.check_in_me(AttendanceCheckIn(request_id=uuid4()), actor) for _ in range(8)))
    rows = run(concurrent())
    assert {row["id"] for row in rows} == {one["id"]}
    assert run(db.attendance.count_documents({"is_open": True})) == 1


def test_old_request_retries_never_create_or_close_the_next_shift(fixture):
    db, _, client = fixture
    first_request, redundant_request = uuid4(), uuid4()
    first = clock_in(client, first_request).json()
    redundant = clock_in(client, redundant_request).json()
    assert redundant["id"] == first["id"]
    assert clock_out(client, first["id"]).status_code == 200
    next_shift = clock_in(client).json()
    assert next_shift["id"] != first["id"]
    for request in (first_request, redundant_request):
        replay = clock_in(client, request)
        assert replay.status_code == 200 and replay.json()["id"] == first["id"] and replay.json()["is_open"] is False
    assert clock_out(client, first["id"]).json()["is_open"] is False
    assert client.get("/api/attendance/me").json()["open_shift"]["id"] == next_shift["id"]
    assert run(db.attendance.count_documents({})) == 2


def test_concurrent_first_check_ins_hit_the_unique_open_shift_guard(fixture, monkeypatch):
    db, actor, _ = fixture
    collection = db.attendance
    class CollectionProxy:
        def __getattr__(self, name):
            return getattr(collection, name)
        async def find_one(self, query, *args, **kwargs):
            row = await collection.find_one(query, *args, **kwargs)
            if row is None and query == {"store_id": actor["store_id"], "user_id": actor["id"], "is_open": True}:
                self.arrived += 1
                if self.arrived == 8:
                    self.gate.set()
                await self.gate.wait()
            return row
    proxy = CollectionProxy()
    class DatabaseProxy:
        attendance = proxy
        def __getattr__(self, name):
            return getattr(db, name)
    monkeypatch.setattr(staff, "get_db", lambda: DatabaseProxy())
    async def race():
        proxy.arrived = 0; proxy.gate = asyncio.Event()
        return await asyncio.wait_for(asyncio.gather(*(staff.check_in_me(AttendanceCheckIn(request_id=uuid4()), actor) for _ in range(8))), timeout=3)
    rows = run(race())
    assert len({row["id"] for row in rows}) == 1
    assert run(db.attendance.count_documents({"is_open": True})) == 1


def test_request_ids_and_shift_ids_are_required_for_new_personal_actions(fixture):
    _, _, client = fixture
    for route in ("/api/attendance/me/check-in", "/api/attendance/me/check-out"):
        assert client.post(route, json={}).status_code == 422
    assert client.post("/api/attendance/me/check-in", json={"request_id": "not-a-uuid"}).status_code == 422


def test_clock_out_is_idempotent_and_overnight_shift_keeps_start_work_date(fixture, monkeypatch):
    _, actor, client = fixture
    monkeypatch.setattr(staff, "utcnow", lambda: datetime(2026, 10, 25, 16, 55, tzinfo=timezone.utc))
    opened = clock_in(client).json()
    monkeypatch.setattr(staff, "utcnow", lambda: datetime(2026, 10, 25, 18, 5, tzinfo=timezone.utc))
    closed = clock_out(client).json()
    monkeypatch.setattr(staff, "utcnow", lambda: datetime(2026, 10, 26, 1, 0, tzinfo=timezone.utc))
    repeated = client.put("/api/attendance/" + opened["id"]).json()
    assert closed["id"] == opened["id"] and closed["work_date"] == "2026-10-25"
    assert closed["clock_out"] == repeated["clock_out"] and closed["closed_by"] == actor["id"]
    assert client.get("/api/attendance/me").json()["open_shift"] is None


def test_another_employee_or_store_shift_cannot_be_closed_or_read_as_own(fixture):
    db, actor, client = fixture
    opened = clock_in(client).json()
    as_employee(db, actor)
    assert client.put("/api/attendance/" + opened["id"]).status_code == 403
    assert client.get("/api/attendance/me").json()["history"] == []
    actor["store_id"] = "store-b"
    run(db.staff.insert_one({"id": "staff-b", "user_id": actor["id"], "store_id": "store-b", "name": "Employee b", "status": "Aktif"}))
    assert client.put("/api/attendance/" + opened["id"]).status_code == 404


@pytest.mark.parametrize("role,expected", [("Owner", 200), ("Manager", 200), ("Cashier", 403), ("Warehouse", 403)])
def test_team_attendance_is_separate_from_personal_access(fixture, role, expected):
    db, actor, client = fixture
    if role != "Owner":
        as_employee(db, actor, role)
    assert client.get("/api/attendance").status_code == expected


def test_legacy_attendance_is_not_assigned_by_name_and_remains_team_read_only(fixture):
    db, actor, client = fixture
    run(db.attendance.insert_one({"id": "legacy", "store_id": "store-a", "staff_name": actor["name"], "clock_in": "2026-10-24T00:00:00Z", "clock_out": None, "status": "Hadir"}))
    assert client.get("/api/attendance/me").json()["history"] == []
    assert client.get("/api/attendance").json()[0]["legacy_unassigned"] is True
    assert client.put("/api/attendance/legacy").status_code == 403


@pytest.mark.parametrize("saved,expected", [("WIB (UTC+7)", "Asia/Jakarta"), ("WITA (UTC+8)", "Asia/Makassar"), ("WIT (UTC+9)", "Asia/Jayapura"), ("Asia/Jayapura", "Asia/Jayapura"), ("invalid", "Asia/Jakarta")])
def test_store_timezone_is_returned_for_consistent_employee_display(fixture, saved, expected):
    db, _, client = fixture
    run(db.settings.insert_one({"store_id": "store-a", "general": {"timezone": saved}}))
    assert client.get("/api/attendance/me").json()["timezone"] == expected


@pytest.mark.parametrize("plan,status", [("starter", 403), ("pro", 403), ("business", 200), ("trial", 200)])
def test_existing_business_entitlement_is_preserved_for_personal_attendance(fixture, plan, status):
    _, actor, client = fixture
    actor["plan"] = plan
    assert client.get("/api/attendance/me").status_code == status
    assert clock_in(client).status_code == status


def test_clock_out_without_a_shift_and_inactive_membership_are_clear_errors(fixture):
    db, actor, client = fixture
    assert clock_out(client).status_code == 404
    as_employee(db, actor)
    run(db.staff.update_one({"user_id": actor["id"]}, {"$set": {"is_active": False}}))
    assert client.get("/api/attendance/me").status_code == 403
    assert clock_in(client).status_code == 403


def test_legacy_store_without_owner_metadata_still_protects_owner_like_accounts(fixture):
    db, _, client = fixture
    run(db.stores.update_one({"id": "store-a"}, {"$unset": {"owner_user_id": ""}}))
    row = {"id": "legacy-owner", "store_id": "store-a", "name": "Owner", "email": "owner-a@example.com", "role": "Owner", "status": "active"}
    run(db.staff.insert_one(row.copy()))
    listed = client.get("/api/staff").json()[0]
    assert listed["is_owner_account"] is True and listed["status"] == "Aktif"
    assert update(client, row, role="Manager", initial_password=PASSWORD, status="Aktif").status_code == 403
    assert client.delete("/api/staff/" + row["id"]).status_code == 403
