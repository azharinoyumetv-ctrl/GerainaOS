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


async def _maybe_downgrade_expired_trial(user: dict) -> dict:
    """Lazy trial-expiry enforcement, run on every authenticated request via _decode_identity
    (both get_current_user and get_identity route through it). There's no scheduled-job infra
    in this deployment to sweep expired trials on a timer, so the check happens on-read
    instead: once trial_ends_at has passed, downgrade to "starter" -- the same fail-closed
    default plan_limits.py already falls back to for unknown/missing plans -- both in the DB
    and on the in-memory dict, so every check_capacity()/require_plan() call later in THIS
    SAME request already sees the corrected plan instead of a stale "trial".

    Note: the frontend's AuthContext only fetches /auth/me on mount, not on a timer, so a tab
    left open past the trial deadline won't visually update its nav lock icons until next
    reload/login -- but every actual API call is still re-checked here regardless of what the
    UI displays, so this is a cosmetic staleness window, not a bypass."""
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
        {"$set": {"plan": "starter", "trial_expired_at": stamp}},
    )
    # Best-effort only -- store.plan is never read for authorization (every check_capacity()/
    # require_plan() call reads user.get("plan")), this just keeps it from looking stale.
    await db.stores.update_many(
        {"owner_user_id": user["id"], "plan": "trial"},
        {"$set": {"plan": "starter"}},
    )
    user["plan"] = "starter"
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
    user = await _maybe_downgrade_expired_trial(user)
    return user


async def get_identity(token: str = Depends(oauth2_scheme)) -> dict:
    """Akun (owner) saja, tanpa resolusi toko. Untuk endpoint yang tidak butuh toko aktif
    (mis. /auth/me, /auth/stores)."""
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


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    x_dagangos_module: str = Header(default="geraina", alias="X-DagangOS-Module"),
) -> dict:
    """Akun + toko aktif sesuai modul (header X-DagangOS-Module). Dipakai semua route data,
    sehingga data tetap ter-scope per toko (store_id). Jika akun belum punya toko untuk modul
    ini, kembalikan 409 `no_store_for_module` agar frontend menawarkan pembuatan toko."""
    user = await _decode_identity(token)
    module = (x_dagangos_module or "geraina").lower()
    store = await _resolve_store(user, module)
    if not store:
        raise HTTPException(status_code=409, detail="no_store_for_module")
    user["store_id"] = store["id"]
    user["store_name"] = store.get("name")
    user["current_module"] = module
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("admin", "Owner"):
        raise HTTPException(status_code=403, detail="Peran Owner diperlukan untuk aksi ini")
    return user
