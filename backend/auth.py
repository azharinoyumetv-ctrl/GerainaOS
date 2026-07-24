"""JWT auth helpers (multi-store).

SYNC: KEEP IN SYNC dengan DapurOS/backend/auth.py — dua backend terpisah berbagi DB +
JWT_SECRET yang sama, jadi logika auth multi-store harus identik (beda hanya default module).
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer

from database import get_db, utcnow

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


def create_access_token(user_id: str, store_id: str, role: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "store_id": store_id,
        "role": role,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRE_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def _maybe_expire_trial(user: dict) -> dict:
    """Lazy trial-expiry enforcement, run on every authenticated request via _decode_identity
    (both get_current_user and get_identity route through it). There's no scheduled-job infra
    in this deployment to sweep expired trials on a timer, so the check happens on-read
    instead: once trial_ends_at has passed, the account is marked plan="expired" -- a
    sentinel that is NOT a real, purchasable tier. (Earlier this fell back to "starter", but
    starter is itself a PAID plan -- silently granting it for free when a trial lapses defeats
    the entire point of gating. An expired trial must lose access, not get a free plan.)

    get_current_user() below hard-blocks any request whose resolved user has plan=="expired"
    with 402. Only the billing endpoints (get_billing_user/require_billing_admin in
    routes_pricing.py) skip that block, so an expired account can still pay to reactivate
    itself instead of being locked out forever with no way back in.

    The plan is corrected both in the DB and on the in-memory dict, so every check later in
    THIS SAME request already sees "expired" instead of a stale "trial".

    Note: the frontend's AuthContext only fetches /auth/me on mount, not on a timer, so a tab
    left open past the trial deadline won't visually flip to the paywall until next
    reload/login -- but every actual API call is still re-checked here regardless of what the
    UI displays, so this is a cosmetic staleness window, not a bypass (the API itself already
    returns 402 the moment the deadline passes)."""
    if user.get("plan") != "trial":
        return user
    ends_at = user.get("trial_ends_at")
    if not ends_at:
        return user
    try:
        expires = datetime.fromisoformat(ends_at)
    except (TypeError, ValueError):
        return user
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) < expires:
        return user

    db = get_db()
    stamp = utcnow().isoformat()
    await db.users.find_one_and_update(
        {"id": user["id"], "plan": "trial"},
        {"$set": {"plan": "expired", "trial_expired_at": stamp}},
    )
    # Best-effort only -- store.plan is never read for authorization (every check_capacity()/
    # require_plan() call reads user.get("plan")), this just keeps it from looking stale.
    await db.stores.update_many(
        {"owner_user_id": user["id"], "plan": "trial"},
        {"$set": {"plan": "expired"}},
    )
    user["plan"] = "expired"
    user["trial_expired_at"] = stamp
    return user


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
    user = await _maybe_expire_trial(user)
    return user


async def get_identity(token: str = Depends(oauth2_scheme)) -> dict:
    """Akun (owner) saja, tanpa resolusi toko. Untuk endpoint yang tidak butuh toko aktif
    (mis. /auth/me, /auth/stores). Deliberately NOT gated on plan=="expired" -- /auth/me must
    keep working even when the account is locked out, otherwise the frontend could never
    detect the expired state or show the paywall in the first place."""
    return await _decode_identity(token)


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
    """Shared by get_current_user and get_billing_user: decode identity (incl. lazy trial-
    expiry accounting) and resolve the active store for this module. Does NOT itself block on
    plan=="expired" -- callers decide whether that matters for them."""
    user = await _decode_identity(token)
    module = (module or "geraina").lower()
    store = await _resolve_store(user, module)
    if not store:
        raise HTTPException(status_code=409, detail="no_store_for_module")
    user["store_id"] = store["id"]
    user["store_name"] = store.get("name")
    user["current_module"] = module
    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    x_dagangos_module: str = Header(default="geraina", alias="X-DagangOS-Module"),
) -> dict:
    """Akun + toko aktif sesuai modul (header X-DagangOS-Module). Dipakai semua route data,
    sehingga data tetap ter-scope per toko (store_id). Jika akun belum punya toko untuk modul
    ini, kembalikan 409 `no_store_for_module` agar frontend menawarkan pembuatan toko.

    Hard-blocks with 402 if the trial has expired and no paid plan was ever purchased --
    "starter" is itself a paid tier, so an expired trial must NOT quietly fall back to it for
    free; the service stops until the account subscribes. Billing routes use get_billing_user
    / require_billing_admin instead of this dependency, precisely so an expired account can
    still reach /pricing/upgrade and /pricing/addons/purchase to pay and unlock itself again."""
    user = await _resolve_current(token, x_dagangos_module)
    if user.get("plan") == "expired":
        raise HTTPException(
            status_code=402,
            detail="Masa trial telah berakhir dan belum ada langganan aktif. Pilih paket untuk melanjutkan menggunakan layanan.",
        )
    return user


async def get_billing_user(
    token: str = Depends(oauth2_scheme),
    x_dagangos_module: str = Header(default="geraina", alias="X-DagangOS-Module"),
) -> dict:
    """Same resolution as get_current_user but WITHOUT the expired-trial block. Reserved for
    the billing endpoints (upgrade / addon purchase / addon history) in routes_pricing.py --
    those must stay reachable exactly when everything else is locked out, or an expired
    account could never pay to reactivate itself."""
    return await _resolve_current(token, x_dagangos_module)


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
