"""Auth routes: register (akun + toko pertama) + login + me + kelola toko.

SYNC: KEEP IN SYNC dengan DapurOS/backend/routes_auth.py (backend terpisah, DB+JWT sama).

Model multi-store: satu akun (owner) bisa memiliki banyak toko, satu toko per modul
(dapuros/geraina). Toko aktif ditentukan oleh header X-DagangOS-Module dan diresolusi di
`auth.get_current_user`. Backend ini dapat berjalan terpisah namun BERBAGI DB + JWT secret
dengan backend DapurOS agar SSO lintas modul tetap bekerja.
"""
import uuid
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, Field

from database import get_db, utcnow, trial_end_iso
from models import UserRegister, UserLogin, Token
from subscription_state import apply_subscription
from billing_subscriptions import reconcile_pending
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_identity, resolve_user_context, account_is_active, employee_password_error,
)
from permissions import EMPLOYEE_ROLES

router = APIRouter(prefix="/api/auth", tags=["auth"])

VALID_MODULES = ("dapuros", "geraina")
DEFAULT_MODULE = "geraina"


class AddStore(BaseModel):
    module: str
    store_name: str


class ChangeEmployeePassword(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=10, max_length=72)


def _norm_module(m: str) -> str:
    m = (m if isinstance(m, str) else DEFAULT_MODULE).lower()
    return m if m in VALID_MODULES else DEFAULT_MODULE


def _user_public(user: dict) -> dict:
    user = apply_subscription(user, user.get("current_module", DEFAULT_MODULE))
    return {
        "id": user["id"],
        "current_module": user.get("current_module", DEFAULT_MODULE),
        "email": user["email"],
        "name": user.get("name") or user.get("store_name"),
        "role": user.get("role", "Owner"),
        "store_id": user.get("store_id"),
        "store_name": user.get("store_name"),
        "trial_ends_at": user.get("trial_ends_at"),
        "trial_expired_at": user.get("trial_expired_at"),
        "plan": user.get("plan", "trial"),
        "subscription": user.get("subscription"),
        "must_change_password": user.get("must_change_password") is True,
        "credential_version": user.get("credential_version", 0),
        "staff_id": user.get("staff_id"),
        "is_store_owner": user.get("is_store_owner") is True,
        "capabilities": user.get("capabilities", []),
    }


async def _seed_store_skeleton(db, store_id: str, store_name: str, module: str):
    """Bare skeleton untuk toko baru: unit default + settings. TANPA produk/kategori/
    staf/kunci pembayaran demo (mulai bersih; pembayaran BYO diisi sendiri oleh pemilik)."""
    now = utcnow().isoformat()
    units = [
        {"name": "Pcs", "short_name": "pcs"},
        {"name": "Box", "short_name": "box"},
        {"name": "Botol", "short_name": "btl"},
        {"name": "Kilogram", "short_name": "kg"},
        {"name": "Gram", "short_name": "g"},
        {"name": "Mililiter", "short_name": "ml"},
    ]
    for u in units:
        u["id"] = f"un-{uuid.uuid4().hex[:8]}"
        u["store_id"] = store_id
        u["created_at"] = now
        u["updated_at"] = now
    await db.units.insert_many(units)

    await db.settings.insert_one({
        "store_id": store_id,
        "general": {"store_name": store_name, "currency": "IDR", "timezone": "WIB (UTC+7)", "language": "id"},
        "receipt": {"header_text": "Terima Kasih!", "footer_text": "Powered by DagangOS", "show_logo": True, "show_cashier": True},
        "printer": {"default_printer": "", "paper_size": "80mm", "auto_print": False},
    })


async def _create_store(db, user_id: str, store_name: str, module: str) -> dict:
    store_id = str(uuid.uuid4())
    trial_started = utcnow()
    store_doc = {
        "id": store_id,
        "name": store_name,
        "module": module,
        "owner_user_id": user_id,
        "created_at": trial_started.isoformat(),
        "plan": "trial",
        "trial_started_at": trial_started.isoformat(),
        "trial_ends_at": (trial_started + timedelta(days=14)).isoformat(),
    }
    await db.stores.insert_one(store_doc)
    await _seed_store_skeleton(db, store_id, store_name, module)
    return store_doc


@router.post("/register", response_model=Token)
async def register(payload: UserRegister, x_dagangos_module: str = Header(default="geraina", alias="X-DagangOS-Module")):
    """Buat akun baru (owner) + toko pertama untuk modul ini. Seed bersih, tanpa akun staf."""
    db = get_db()
    module = _norm_module(x_dagangos_module)
    existing = await db.users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")

    user_id = str(uuid.uuid4())
    trial_ends = trial_end_iso(14)
    store_doc = await _create_store(db, user_id, payload.store_name, module)

    user_doc = {
        "id": user_id,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "name": payload.store_name,
        "role": "Owner",
        "store_id": store_doc["id"],
        "store_name": payload.store_name,
        "last_active_store_id": store_doc["id"],
        "plan": "trial",
        "trial_ends_at": trial_ends,
        "created_at": utcnow().isoformat(),
    }
    await db.users.insert_one(user_doc)

    token = create_access_token(user_id, store_doc["id"], "Owner", payload.email)
    return Token(access_token=token, user=_user_public(await resolve_user_context(user_doc, module)))


async def _login_user(email: str, password: str, module: str) -> Token:
    db = get_db()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if not account_is_active(user):
        raise HTTPException(status_code=403, detail="Akun staf tidak aktif. Hubungi Owner.")
    context = await resolve_user_context(user, module)
    if context.get("role") in EMPLOYEE_ROLES and verify_password("geraina123", user.get("password_hash", "")):
        # Knowing the former universal password cannot be used to claim an employee account.
        raise HTTPException(status_code=403, detail="Akun staf lama memerlukan kata sandi unik baru dari Owner.")
    token = create_access_token(user["id"], context.get("store_id"), context["role"], user["email"], user.get("credential_version", 0))
    return Token(access_token=token, user=_user_public(context))


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, x_dagangos_module: str = Header(default="geraina", alias="X-DagangOS-Module")):
    return await _login_user(payload.email, payload.password, _norm_module(x_dagangos_module))


@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), x_dagangos_module: str = Header(default="geraina", alias="X-DagangOS-Module")):
    return await _login_user(form_data.username, form_data.password, _norm_module(x_dagangos_module))


@router.post("/change-password", response_model=Token)
async def change_employee_password(payload: ChangeEmployeePassword, user: dict = Depends(get_identity)):
    if user.get("role") not in EMPLOYEE_ROLES or not user.get("staff_id"):
        raise HTTPException(status_code=403, detail="Pengaturan ini khusus kredensial akun staf.")
    error = employee_password_error(payload.new_password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="Gunakan kata sandi baru yang berbeda dari kata sandi sementara.")
    db = get_db()
    current = await db.users.find_one({"id": user["id"]})
    if not current or not account_is_active(current) or not verify_password(payload.current_password, current.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Kata sandi saat ini tidak sesuai.")
    version = current.get("credential_version")
    if version != user.get("credential_version"):
        raise HTTPException(status_code=409, detail="Kredensial berubah. Silakan masuk ulang.")
    updated = await db.users.find_one_and_update(
        {"id": user["id"], "credential_version": version},
        {"$set": {"password_hash": hash_password(payload.new_password), "must_change_password": False, "password_changed_at": utcnow().isoformat()}, "$inc": {"credential_version": 1}},
        return_document=True,
    )
    if not updated:
        raise HTTPException(status_code=409, detail="Kredensial berubah. Silakan masuk ulang.")
    context = await resolve_user_context(updated, user["current_module"])
    token = create_access_token(updated["id"], context["store_id"], context["role"], updated["email"], updated["credential_version"])
    return Token(access_token=token, user=_user_public(context))


@router.get("/me")
async def me(user: dict = Depends(get_identity)):
    """Identitas akun + daftar toko (per modul) yang dimiliki. Suite switcher render dari sini."""
    db = get_db()
    if user.get("role") in EMPLOYEE_ROLES:
        # get_identity already resolved the active membership and current owner entitlement.
        # Re-reading the raw employee snapshot would replace that entitlement with stale data.
        return {**_user_public(user), "stores": []}
    stores = await db.stores.find({"owner_user_id": user["id"]}, {"_id": 0}).to_list(length=100)
    if user.get("is_store_owner"):
        await reconcile_pending(user, user["current_module"])
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    if not fresh:
        raise HTTPException(status_code=401, detail="Akun tidak lagi tersedia. Silakan masuk ulang.")
    # Re-resolve after reconciliation without replacing server-derived staff authority/plan.
    pub = _user_public(await resolve_user_context(fresh, user["current_module"]))
    pub["stores"] = [
        {"store_id": s["id"], "name": s.get("name"), "module": s.get("module")} for s in stores
    ]
    return pub


@router.get("/stores")
async def list_stores(user: dict = Depends(get_identity)):
    db = get_db()
    stores = await db.stores.find({"owner_user_id": user["id"]}, {"_id": 0}).to_list(length=100)
    return [
        {"store_id": s["id"], "name": s.get("name"), "module": s.get("module")} for s in stores
    ]


@router.post("/stores")
async def add_store(payload: AddStore, user: dict = Depends(get_identity)):
    """Tambah toko baru untuk modul lain di bawah akun yang sama (aktivasi modul)."""
    db = get_db()
    if user.get("role") != "Owner":
        raise HTTPException(status_code=403, detail="Peran Owner diperlukan untuk membuat toko.")
    module = _norm_module(payload.module)
    name = (payload.store_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama toko wajib diisi")
    existing = await db.stores.find_one({"owner_user_id": user["id"], "module": module})
    if existing:
        raise HTTPException(status_code=409, detail="Anda sudah memiliki toko untuk modul ini")
    store_doc = await _create_store(db, user["id"], name, module)
    return {"store_id": store_doc["id"], "name": name, "module": module}
