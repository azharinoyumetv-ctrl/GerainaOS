"""Owner-managed staff credentials and authenticated personal attendance."""
import re
import uuid
from datetime import timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pymongo.errors import DuplicateKeyError
from database import get_db, utcnow
from models import Staff, StaffCreate, StaffUpdate, Attendance, AttendanceCreate, AttendanceCheckIn, AttendanceCheckOut
from auth import get_current_user, require_admin, hash_password, employee_password_error, account_is_active
from plan_limits import require_plan

class PrivateValidationRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        async def handler(request):
            try:
                return await original(request)
            except RequestValidationError as error:
                # Keep all schema constraints, without reflecting submitted passwords.
                safe = [{key: value for key, value in item.items() if key in ("loc", "msg", "type", "url")} for item in error.errors()]
                raise RequestValidationError(safe) from None
        return handler


router = APIRouter(tags=["staff"], route_class=PrivateValidationRoute)
EMPLOYEE_ROLES = {"Manager", "Cashier", "Warehouse"}


def _active(value):
    return str(value or "Aktif").strip().lower() in {"aktif", "active"}


def _password(value):
    error = employee_password_error(value)
    if error:
        raise HTTPException(400, error)
    return hash_password(value)


def _email_query(email):
    return {"email": {"$regex": "^" + re.escape(email) + "$", "$options": "i"}}


async def _owner_id(db, store_id):
    store = await db.stores.find_one({"id": store_id}, {"_id": 0, "owner_user_id": 1})
    return (store or {}).get("owner_user_id")


def _staff_public(row, account, owner_id):
    result = dict(row)
    result.pop("_id", None)
    is_owner = _protected_owner(account, owner_id)
    result["status"] = "Aktif" if account_is_active(row) else "Non-Aktif"
    result.update(user_id=account.get("id") if account else row.get("user_id"), is_owner_account=is_owner,
                  login_enabled=bool(account and not is_owner and account_is_active(row) and account_is_active(account) and "credential_version" in account),
                  must_change_password=bool(account and account.get("must_change_password")),
                  credential_reset_required=bool(not is_owner and (not account or "credential_version" not in account)))
    return result


def _protected_owner(account, owner_id):
    # When legacy ownership metadata is missing, fail closed for Owner-like accounts.
    return bool(account and (account.get("id") == owner_id or
                (not owner_id and str(account.get("role", "")).strip().lower() in ("owner", "admin"))))


async def _linked_account(db, row):
    account = await db.users.find_one({"id": row.get("user_id") or row["id"], "store_id": row["store_id"]}, {"_id": 0})
    if not account and not row.get("user_id"):
        account = await db.users.find_one({"store_id": row["store_id"], **_email_query(row["email"])}, {"_id": 0})
    return account


@router.get("/api/staff", response_model=List[Staff])
async def list_staff(user: dict = Depends(get_current_user)):
    if user.get("role") not in ("Owner", "admin", "Manager"):
        raise HTTPException(403, "Daftar karyawan hanya untuk Owner atau Manager.")
    db = get_db()
    rows = await db.staff.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1).to_list(length=100)
    accounts = await db.users.find({"store_id": user["store_id"]}, {"_id": 0, "password_hash": 0}).to_list(length=1000)
    by_id = {row["id"]: row for row in accounts}
    by_email = {row.get("email", "").lower(): row for row in accounts}
    owner_id = await _owner_id(db, user["store_id"])
    return [_staff_public(row, by_id.get(row.get("user_id") or row["id"]) or
                          (by_email.get(row["email"].lower()) if not row.get("user_id") else None), owner_id) for row in rows]


@router.post("/api/staff", response_model=Staff)
async def create_staff(payload: StaffCreate, user: dict = Depends(require_admin)):
    db = get_db()
    from plan_limits import check_capacity
    await check_capacity(db, user["store_id"], user.get("plan"), "staff", "max_employees")
    name, email = payload.name.strip(), str(payload.email).strip().lower()
    if not name:
        raise HTTPException(400, "Nama karyawan wajib diisi.")
    password_hash = _password(payload.initial_password)
    if await db.users.find_one(_email_query(email)) or await db.staff.find_one({"store_id": user["store_id"], **_email_query(email)}):
        raise HTTPException(409, "Email sudah digunakan. Edit karyawan yang ada atau gunakan email login lain.")
    identity, now = str(uuid.uuid4()), utcnow().isoformat()
    doc = {"id": identity, "user_id": identity, "store_id": user["store_id"], "name": name, "email": email,
           "role": payload.role, "phone": payload.phone, "status": payload.status, "created_at": now}
    account = {"id": identity, "staff_id": identity, "store_id": user["store_id"], "store_name": user.get("store_name", ""),
               "name": name, "email": email, "role": payload.role, "status": payload.status,
               "password_hash": password_hash, "credential_version": 0, "must_change_password": True,
               "trial_ends_at": user.get("trial_ends_at"), "plan": user.get("plan", "trial"), "created_at": now}
    await db.users.insert_one(dict(account))
    try:
        await db.staff.insert_one(dict(doc))
    except Exception:
        await db.users.delete_one({"id": identity, "store_id": user["store_id"]})
        raise
    return _staff_public(doc, account, await _owner_id(db, user["store_id"]))


@router.put("/api/staff/{staff_id}", response_model=Staff)
async def update_staff(staff_id: str, payload: StaffUpdate, user: dict = Depends(require_admin)):
    db = get_db()
    row = await db.staff.find_one({"id": staff_id, "store_id": user["store_id"]}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Karyawan tidak ditemukan.")
    account = await _linked_account(db, row)
    owner_id = await _owner_id(db, user["store_id"])
    if _protected_owner(account, owner_id):
        raise HTTPException(403, "Akun pemilik toko tidak dapat diubah melalui manajemen karyawan.")
    name, email = payload.name.strip(), str(payload.email).strip().lower()
    if not name:
        raise HTTPException(400, "Nama karyawan wajib diisi.")
    collision = await db.users.find_one(_email_query(email), {"_id": 0})
    if collision and (not account or collision["id"] != account["id"] or collision.get("store_id") != user["store_id"]):
        raise HTTPException(409, "Email login sudah digunakan akun lain.")
    if await db.staff.find_one({"store_id": user["store_id"], **_email_query(email), "id": {"$ne": staff_id}}):
        raise HTTPException(409, "Email karyawan sudah digunakan.")
    password_hash = _password(payload.initial_password) if payload.initial_password is not None else None
    now = utcnow().isoformat()
    account_fields = {"name": name, "email": email, "role": payload.role, "status": payload.status,
                      "is_active": payload.status == "Aktif", "disabled": payload.status != "Aktif", "staff_id": staff_id, "updated_at": now}
    if password_hash:
        account_fields.update(password_hash=password_hash, must_change_password=True)
    if account:
        changed = bool(password_hash or account_is_active(account) != (payload.status == "Aktif") or
                       any(account.get(key) != account_fields[key] for key in ("email", "role", "status")))
        change = {"$set": account_fields}
        if payload.status == "Aktif":
            change["$unset"] = {"deleted_at": ""}
        if changed:
            change["$inc"] = {"credential_version": 1}
        await db.users.update_one({"id": account["id"], "store_id": user["store_id"]}, change)
        account = {**account, **account_fields, "credential_version": (account.get("credential_version") or 0) + int(changed)}
        if payload.status == "Aktif":
            account.pop("deleted_at", None)
    else:
        if not password_hash:
            raise HTTPException(400, "Isi password awal yang unik untuk menghubungkan login karyawan lama.")
        identity = str(uuid.uuid4())
        account = {**account_fields, "id": identity, "store_id": user["store_id"], "store_name": user.get("store_name", ""),
                   "credential_version": 0, "plan": user.get("plan", "trial"), "trial_ends_at": user.get("trial_ends_at"), "created_at": now}
        await db.users.insert_one(dict(account))
    fields = {"name": name, "email": email, "phone": payload.phone, "role": payload.role, "status": payload.status,
              "is_active": payload.status == "Aktif", "disabled": payload.status != "Aktif",
              "user_id": account["id"], "updated_at": now}
    staff_change = {"$set": fields}
    if payload.status == "Aktif":
        staff_change["$unset"] = {"deleted_at": ""}
        row.pop("deleted_at", None)
    await db.staff.update_one({"id": staff_id, "store_id": user["store_id"]}, staff_change)
    return _staff_public({**row, **fields}, account, owner_id)


@router.delete("/api/staff/{staff_id}")
async def delete_staff(staff_id: str, user: dict = Depends(require_admin)):
    db = get_db()
    row = await db.staff.find_one({"id": staff_id, "store_id": user["store_id"]}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Karyawan tidak ditemukan.")
    account = await _linked_account(db, row)
    if _protected_owner(account, await _owner_id(db, user["store_id"])):
        raise HTTPException(403, "Akun pemilik toko tidak dapat dinonaktifkan melalui manajemen karyawan.")
    now = utcnow().isoformat()
    if account and account_is_active(account):
        await db.users.update_one({"id": account["id"], "store_id": user["store_id"]},
                                 {"$set": {"status": "Non-Aktif", "is_active": False, "updated_at": now}, "$inc": {"credential_version": 1}})
    await db.staff.update_one({"id": staff_id, "store_id": user["store_id"]}, {"$set": {"status": "Non-Aktif", "is_active": False, "updated_at": now}})
    return {"ok": True, "deactivated": True}


def _attendance_public(row):
    return Attendance(**{**row, "legacy_unassigned": not bool(row.get("user_id"))}).model_dump()


async def _attendance_actor(user):
    if user.get("role") not in EMPLOYEE_ROLES | {"Owner", "admin"}:
        raise HTTPException(403, "Akun karyawan aktif diperlukan untuk absensi.")
    staff = await get_db().staff.find_one({"store_id": user["store_id"], "$or": [{"user_id": user["id"]}, {"id": user["id"]}]}, {"_id": 0})
    if user.get("role") in EMPLOYEE_ROLES and (not staff or not account_is_active(staff)):
        raise HTTPException(403, "Akun belum terhubung dengan karyawan aktif di toko ini.")
    return staff


async def _store_timezone(store_id):
    settings = await get_db().settings.find_one({"store_id": store_id}, {"_id": 0})
    raw = str(((settings or {}).get("general") or {}).get("timezone", "")).strip()
    if raw == "Asia/Makassar" or raw.upper().startswith("WITA") or "UTC+8" in raw:
        return "Asia/Makassar", timezone(timedelta(hours=8))
    if raw == "Asia/Jayapura" or raw.upper().startswith("WIT ") or raw.upper() == "WIT" or "UTC+9" in raw:
        return "Asia/Jayapura", timezone(timedelta(hours=9))
    return "Asia/Jakarta", timezone(timedelta(hours=7))


@router.get("/api/attendance/me")
async def my_attendance(user: dict = Depends(require_plan("business"))):
    await _attendance_actor(user)
    scope = {"store_id": user["store_id"], "user_id": user["id"]}
    history = await get_db().attendance.find(scope, {"_id": 0}).sort("clock_in", -1).to_list(length=100)
    opened = await get_db().attendance.find_one({**scope, "is_open": True}, {"_id": 0})
    zone, _ = await _store_timezone(user["store_id"])
    return {"history": [_attendance_public(row) for row in history], "open_shift": _attendance_public(opened) if opened else None,
            "server_time": utcnow().isoformat(), "timezone": zone}


async def _bind_check_in_request(db, user, request_id, row):
    if not request_id:
        return row
    key = f"{user['store_id']}:{user['id']}:{request_id}"
    claim = await db.attendance_requests.find_one_and_update(
        {"_id": key}, {"$setOnInsert": {"store_id": user["store_id"], "user_id": user["id"], "request_id": request_id, "attendance_id": row["id"]}},
        upsert=True, return_document=True)
    if claim["attendance_id"] != row["id"]:
        row = await db.attendance.find_one({"id": claim["attendance_id"], "store_id": user["store_id"], "user_id": user["id"]}, {"_id": 0})
        if not row:
            raise HTTPException(409, "Referensi absensi berubah. Muat ulang riwayat sebelum mencoba lagi.")
    return row


async def _check_in(user, request_id=None):
    staff = await _attendance_actor(user)
    db = get_db()
    indexes = await db.attendance.index_information()
    if "attendance_one_open_per_user" not in indexes:
        await db.attendance.create_index([("store_id", 1), ("user_id", 1)], name="attendance_one_open_per_user", unique=True,
                                         partialFilterExpression={"is_open": True})
    if request_id:
        request_id = str(request_id)
        if "attendance_check_in_request" not in indexes:
            await db.attendance.create_index([("store_id", 1), ("user_id", 1), ("check_in_request_id", 1)],
                                            name="attendance_check_in_request", unique=True, partialFilterExpression={"check_in_request_id": {"$type": "string"}})
        claim = await db.attendance_requests.find_one({"_id": f"{user['store_id']}:{user['id']}:{request_id}"})
        request_scope = {"store_id": user["store_id"], "user_id": user["id"]}
        if claim:
            request_scope["id"] = claim["attendance_id"]
        else:
            request_scope["check_in_request_id"] = request_id
        original = await db.attendance.find_one(request_scope, {"_id": 0})
        if original:
            return _attendance_public(await _bind_check_in_request(db, user, request_id, original))
        if claim:
            raise HTTPException(409, "Referensi absensi berubah. Muat ulang riwayat sebelum mencoba lagi.")
    scope = {"store_id": user["store_id"], "user_id": user["id"], "is_open": True}
    existing = await db.attendance.find_one(scope, {"_id": 0})
    if existing:
        return _attendance_public(await _bind_check_in_request(db, user, request_id, existing))
    now = utcnow()
    zone, offset = await _store_timezone(user["store_id"])
    doc = {**scope, "id": str(uuid.uuid4()), "staff_id": staff["id"] if staff else None,
           "staff_name": (staff or {}).get("name") or user.get("name") or user.get("email") or "Pemilik toko",
           "clock_in": now.isoformat(), "clock_out": None, "status": "Hadir", "work_date": now.astimezone(offset).date().isoformat(),
           "timezone": zone, "created_by": user["id"]}
    if request_id:
        doc["check_in_request_id"] = request_id
    try:
        await db.attendance.insert_one(dict(doc))
    except DuplicateKeyError:
        existing = await db.attendance.find_one({"store_id": user["store_id"], "user_id": user["id"], "check_in_request_id": request_id}, {"_id": 0}) if request_id else None
        existing = existing or await db.attendance.find_one(scope, {"_id": 0})
        if existing:
            return _attendance_public(await _bind_check_in_request(db, user, request_id, existing))
        raise HTTPException(409, "Status shift berubah. Muat ulang absensi sebelum mencoba lagi.")
    return _attendance_public(await _bind_check_in_request(db, user, request_id, doc))


async def _check_out(user, attendance_id=None):
    await _attendance_actor(user)
    db = get_db()
    scope = {"store_id": user["store_id"], "user_id": user["id"]}
    if attendance_id:
        existing = await db.attendance.find_one({"store_id": user["store_id"], "id": attendance_id}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Data absensi tidak ditemukan.")
        if existing.get("user_id") != user["id"]:
            raise HTTPException(403, "Anda hanya dapat menutup absensi milik sendiri; catatan lama tidak boleh ditebak dari nama.")
        scope["id"] = attendance_id
    res = await db.attendance.find_one_and_update({**scope, "is_open": True},
          {"$set": {"clock_out": utcnow().isoformat(), "is_open": False, "closed_by": user["id"]}}, return_document=True, projection={"_id": 0})
    if res:
        return _attendance_public(res)
    closed = await db.attendance.find_one({**scope, "is_open": False}, {"_id": 0}, sort=[("clock_in", -1)])
    if closed:
        return _attendance_public(closed)
    raise HTTPException(409, "Belum ada absensi masuk yang dapat ditutup.")


@router.post("/api/attendance/me/check-in", response_model=Attendance)
async def check_in_me(payload: AttendanceCheckIn, user: dict = Depends(require_plan("business"))):
    return await _check_in(user, payload.request_id)


@router.post("/api/attendance/me/check-out", response_model=Attendance)
async def check_out_me(payload: AttendanceCheckOut, user: dict = Depends(require_plan("business"))):
    return await _check_out(user, payload.attendance_id)


@router.get("/api/attendance", response_model=List[Attendance])
async def list_attendance(user: dict = Depends(require_plan("business"))):
    if user.get("role") not in ("Owner", "admin", "Manager"):
        raise HTTPException(403, "Tampilan absensi tim hanya untuk Owner atau Manager.")
    rows = await get_db().attendance.find({"store_id": user["store_id"]}, {"_id": 0}).sort("clock_in", -1).to_list(length=100)
    return [_attendance_public(row) for row in rows]


@router.post("/api/attendance", response_model=Attendance)
async def log_attendance(payload: AttendanceCreate, user: dict = Depends(require_plan("business"))):
    """Compatibility entry point with the same actor-only server-clock flow."""
    return await _check_in(user)


@router.put("/api/attendance/{att_id}", response_model=Attendance)
async def update_attendance(att_id: str, user: dict = Depends(require_plan("business"))):
    return await _check_out(user, att_id)
