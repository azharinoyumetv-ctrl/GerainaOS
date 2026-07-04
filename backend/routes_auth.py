"""Auth routes: register (akun + toko pertama) + login + me + kelola toko.

SYNC: KEEP IN SYNC dengan DapurOS/backend/routes_auth.py (backend terpisah, DB+JWT sama).

Model multi-store: satu akun (owner) bisa memiliki banyak toko, satu toko per modul
(dapuros/geraina). Toko aktif ditentukan oleh header X-DagangOS-Module dan diresolusi di
`auth.get_current_user`. Backend ini dapat berjalan terpisah namun BERBAGI DB + JWT secret
dengan backend DapurOS agar SSO lintas modul tetap bekerja.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from database import get_db, utcnow, trial_end_iso
from models import UserRegister, UserLogin, Token
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_identity,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

VALID_MODULES = ("dapuros", "geraina")
DEFAULT_MODULE = "geraina"


class AddStore(BaseModel):
    module: str
    store_name: str


def _norm_module(m: str) -> str:
    m = (m or DEFAULT_MODULE).lower()
    return m if m in VALID_MODULES else DEFAULT_MODULE


def _user_public(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name") or user.get("store_name"),
        "role": user.get("role", "Owner"),
        "store_id": user.get("store_id"),
        "store_name": user.get("store_name"),
        "trial_ends_at": user.get("trial_ends_at"),
        "plan": user.get("plan", "trial"),
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
    store_doc = {
        "id": store_id,
        "name": store_name,
        "module": module,
        "owner_user_id": user_id,
        "created_at": utcnow().isoformat(),
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
    return Token(access_token=token, user=_user_public(user_doc))


@router.post("/login", response_model=Token)
async def login(payload: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_access_token(user["id"], user.get("store_id"), user.get("role", "Owner"), user["email"])
    return Token(access_token=token, user=_user_public(user))


@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_db()
    user = await db.users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_access_token(user["id"], user.get("store_id"), user.get("role", "Owner"), user["email"])
    return Token(access_token=token, user=_user_public(user))


@router.get("/me")
async def me(user: dict = Depends(get_identity)):
    """Identitas akun + daftar toko (per modul) yang dimiliki. Suite switcher render dari sini."""
    db = get_db()
    stores = await db.stores.find({"owner_user_id": user["id"]}, {"_id": 0}).to_list(length=100)
    pub = _user_public(user)
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
    module = _norm_module(payload.module)
    name = (payload.store_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama toko wajib diisi")
    existing = await db.stores.find_one({"owner_user_id": user["id"], "module": module})
    if existing:
        raise HTTPException(status_code=409, detail="Anda sudah memiliki toko untuk modul ini")
    store_doc = await _create_store(db, user["id"], name, module)
    return {"store_id": store_doc["id"], "name": name, "module": module}
