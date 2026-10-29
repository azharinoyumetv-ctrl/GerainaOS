"""JWT auth helpers (multi-store).

SYNC: KEEP IN SYNC dengan DapurOS/backend/auth.py — dua backend terpisah berbagi DB +
JWT_SECRET yang sama, jadi logika auth multi-store harus identik (beda hanya default module).
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import OAuth2PasswordBearer

from database import get_db, utcnow
from subscription_state import apply_store_subscription
from permissions import canonical_role, capabilities_for, EMPLOYEE_ROLES
from erasure_guard import actor_context

JWT_SECRET = os.environ.get("JWT_SECRET_KEY", "change-me")
if JWT_SECRET == "change-me" and os.environ.get("ENV") == "production":
    raise ValueError("JWT_SECRET_KEY must be set to a secure secret in a production environment!")

JWT_ALG = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MIN = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, store_id: str, role: str, email: str, credential_version: int = 0) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "store_id": store_id,
        "role": role,
        "email": email,
        "cv": credential_version,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRE_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def employee_password_error(password: str) -> Optional[str]:
    try:
        size = len(password.encode("utf-8")) if isinstance(password, str) else 0
    except UnicodeError:
        return "Kata sandi mengandung karakter yang tidak valid."
    if not isinstance(password, str) or len(password) < 10 or size > 72 or not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
        return "Gunakan 10 karakter atau lebih, dengan huruf dan angka (maksimal 72 byte)."
    if password.casefold() == "geraina123":
        return "Gunakan kata sandi unik, bukan kata sandi bersama lama."
    return None


def account_is_active(user: dict) -> bool:
    status = str(user.get("status", "Aktif")).replace("-", "").replace(" ", "").casefold()
    return (user.get("is_active") is not False and user.get("disabled") is not True
            and not user.get("deleted_at") and user.get("erasure_state") not in ("closing", "erased")
            and status in ("aktif", "active"))


async def staff_membership(user: dict, store_id: str) -> Optional[dict]:
    return await get_db().staff.find_one({"store_id": store_id, "$or": [{"user_id": user["id"]}, {"id": user["id"]}]}, {"_id": 0})


async def resolve_user_context(user: dict, module: str) -> dict:
    """Resolve store membership and authority from current records, never a selected UI role."""
    if not account_is_active(user):
        raise HTTPException(status_code=401, detail="Akun staf tidak aktif. Hubungi Owner.")
    module = (module or "geraina").lower()
    if isinstance(user.get("closed_modules"), dict) and user["closed_modules"].get(module):
        raise HTTPException(401, detail="Akses produk ini telah dihapus sesuai permintaan. Akses produk lain yang masih aktif tetap tersedia.")
    store = await _resolve_store(user, module)
    if store and store.get("erasure_state") in ("closing", "erased"):
        raise HTTPException(409, "Toko sedang ditutup atau telah dihapus. Hubungi dukungan untuk status permintaan.")
    result = dict(user)
    result["_account_primary_store_id"] = user.get("store_id")
    result["current_module"] = module
    result["is_store_owner"] = False
    result["staff_id"] = None
    if store is None:
        # An established owner may sign into another product to activate/create its store.
        owns_any = await get_db().stores.find_one({"owner_user_id": user["id"]}, {"_id": 0, "id": 1})
        if not owns_any:
            raise HTTPException(status_code=409, detail="no_store_for_module")
        result.update(role="Owner", store_id=None, store_name=None)
    else:
        is_owner = store.get("owner_user_id") == user["id"]
        member = None if is_owner else await staff_membership(user, store["id"])
        legacy_owner = not store.get("owner_user_id") and user.get("store_id") == store["id"] and canonical_role(user.get("role")) == "Owner" and member is None
        if is_owner or legacy_owner:
                result.update(role="Owner", is_store_owner=True)
        else:
            if member is None or not account_is_active(member):
                raise HTTPException(status_code=401, detail="Keanggotaan staf tidak aktif. Hubungi Owner.")
            role = canonical_role(member.get("role"))
            if role not in EMPLOYEE_ROLES:
                raise HTTPException(status_code=403, detail="Peran staf tidak valid. Minta Owner memperbarui akun staf.")
            if "credential_version" not in user:
                raise HTTPException(status_code=403, detail="Akun staf lama memerlukan kata sandi unik baru dari Owner.")
            if user.get("_token_has_cv") is False:
                raise HTTPException(status_code=401, detail="Akun staf memerlukan masuk ulang dengan kredensial baru dari Owner.")
            result.update(role=role, staff_id=member["id"], name=member.get("name") or user.get("name") or user.get("email"))
            # Legacy employee snapshots must not preserve an expired/free/stale store plan.
            owner = await get_db().users.find_one({"id": store.get("owner_user_id")}, {"_id": 0, "password_hash": 0}) if store.get("owner_user_id") else None
            if owner:
                result["_account_primary_store_id"] = owner.get("store_id")
                for key in ("plan", "trial_ends_at", "trial_expired_at", "subscriptions"):
                    if key in owner:
                        result[key] = owner[key]
                    else:
                        result.pop(key, None)
        result.update(store_id=store["id"], store_name=store.get("name"))
    result = apply_store_subscription(result, store, module)
    result["capabilities"] = capabilities_for(result["role"])
    result["must_change_password"] = result.get("must_change_password") is True
    result.pop("password_hash", None)
    result.pop("_token_has_cv", None)
    return result


async def _decode_identity(token: str) -> dict:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise cred_exc
    db = get_db()
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise cred_exc
    if not account_is_active(user):
        raise cred_exc
    expected_version = user.get("credential_version", 0)
    if not isinstance(expected_version, int) or payload.get("cv", 0) != expected_version:
        raise cred_exc
    # Store resolution decides authority; an old DB role is not proof of ownership.
    user["_token_has_cv"] = "cv" in payload
    return user


async def get_identity(token: str = Depends(oauth2_scheme), x_dagangos_module: str = Header(default="geraina", alias="X-DagangOS-Module")) -> dict:
    """Akun (owner) saja, tanpa resolusi toko. Untuk endpoint yang tidak butuh toko aktif
    (mis. /auth/me, /auth/stores). Deliberately NOT gated on plan=="expired" -- /auth/me must
    keep working even when the account is locked out, otherwise the frontend could never
    detect the expired state or show the paywall in the first place."""
    user = await _decode_identity(token)
    module = x_dagangos_module.lower()
    return await resolve_user_context(user, module)


async def _resolve_store(user: dict, module: str) -> Optional[dict]:
    """Cari toko milik akun ini untuk modul tertentu (satu toko per modul per akun, Fase 1)."""
    db = get_db()
    module = (module or "geraina").lower()
    store = await db.stores.find_one({"owner_user_id": user["id"], "module": module})
    if store:
        return store
    # Kompatibilitas data lama: akun single-store yang store-nya belum punya field `module`.
    legacy_id = user.get("store_id")
    if legacy_id:
        ls = await db.stores.find_one({"id": legacy_id})
        if ls and ls.get("module") in (None, module):
            return ls
    return None


async def _resolve_current(token: str, module: str) -> dict:
    """Shared by get_current_user and get_billing_user: decode identity and resolve the active store for this module. Does NOT itself block on
    plan=="expired" -- callers decide whether that matters for them."""
    user = await _decode_identity(token)
    module = (module or "geraina").lower()
    resolved = await resolve_user_context(user, module)
    if not resolved.get("store_id"):
        raise HTTPException(status_code=409, detail="no_store_for_module")
    return resolved


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    x_dagangos_module: str = Header(default="geraina", alias="X-DagangOS-Module"),
    request: Request = None,
) -> dict:
    """Akun + toko aktif sesuai modul (header X-DagangOS-Module). Dipakai semua route data,
    sehingga data tetap ter-scope per toko (store_id). Jika akun belum punya toko untuk modul
    ini, kembalikan 409 `no_store_for_module` agar frontend menawarkan pembuatan toko.

    Hard-blocks with 402 if the trial has expired and no paid plan was ever purchased --
    "starter" is itself a paid tier, so an expired trial must NOT quietly fall back to it for
    free; the service stops until the account subscribes. Billing routes use get_billing_user
    / require_billing_admin instead of this dependency, precisely so an expired account can
    still reach /pricing/upgrade and /pricing/addons/purchase to pay and unlock itself again."""
    if request is not None and x_dagangos_module.lower() != "geraina":
        raise HTTPException(status_code=409, detail="wrong_backend_for_module")
    user = await _resolve_current(token, x_dagangos_module)
    if user.get("must_change_password"):
        raise HTTPException(status_code=403, detail="Ganti kata sandi sementara sebelum menggunakan aplikasi.")
    if user.get("plan") == "expired":
        raise HTTPException(
            status_code=402,
            detail="Masa trial telah berakhir dan belum ada langganan aktif. Pilih paket untuk melanjutkan menggunakan layanan.",
        )
    return user


async def get_billing_user(
    token: str = Depends(oauth2_scheme),
    x_dagangos_module: str = Header(default="geraina", alias="X-DagangOS-Module"),
    request: Request = None,
) -> dict:
    """Same resolution as get_current_user but WITHOUT the expired-trial block. Reserved for
    the billing endpoints (upgrade / addon purchase / addon history) in routes_pricing.py --
    those must stay reachable exactly when everything else is locked out, or an expired
    account could never pay to reactivate itself."""
    if request is not None and x_dagangos_module.lower() != "geraina":
        raise HTTPException(status_code=409, detail="wrong_backend_for_module")
    user = await _resolve_current(token, x_dagangos_module)
    if user.get("must_change_password"):
        raise HTTPException(status_code=403, detail="Ganti kata sandi sementara sebelum menggunakan aplikasi.")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("admin", "Owner"):
        raise HTTPException(status_code=403, detail="Peran Owner diperlukan untuk aksi ini")
    return user


async def require_billing_admin(user: dict = Depends(get_billing_user)) -> dict:
    """Same admin-role check as require_admin, but built on get_billing_user so it stays
    reachable on an expired trial. Used only by the billing endpoints in routes_pricing.py."""
    if user.get("role") not in ("admin", "Owner"):
        raise HTTPException(status_code=403, detail="Peran Owner diperlukan untuk aksi ini")
    return user
