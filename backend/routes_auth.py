"""Auth routes: register store + login + me."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow, trial_end_iso
from models import UserRegister, UserLogin, Token
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_public(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "role": user.get("role", "admin"),
        "store_id": user.get("store_id"),
        "store_name": user.get("store_name"),
        "trial_ends_at": user.get("trial_ends_at"),
        "plan": user.get("plan", "trial"),
    }


@router.post("/register", response_model=Token)
async def register(payload: UserRegister):
    db = get_db()
    existing = await db.users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")

    store_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    trial_ends = trial_end_iso(14)

    store_doc = {
        "id": store_id,
        "name": payload.store_name,
        "owner_user_id": user_id,
        "plan": "trial",
        "trial_ends_at": trial_ends,
        "created_at": utcnow().isoformat(),
    }
    user_doc = {
        "id": user_id,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "role": "admin",
        "store_id": store_id,
        "store_name": payload.store_name,
        "trial_ends_at": trial_ends,
        "plan": "trial",
        "created_at": utcnow().isoformat(),
    }
    await db.stores.insert_one(store_doc)
    await db.users.insert_one(user_doc)

    # Seed a few sample products for fast demo
    sample_products = [
        {"name": "Es Kopi Susu Gula Aren", "price": 22000, "cost": 9000, "stock": 100, "category": "Minuman", "unit": "cup"},
        {"name": "Croissant Original", "price": 18000, "cost": 7500, "stock": 30, "category": "Roti", "unit": "pcs"},
        {"name": "Nasi Goreng Spesial", "price": 28000, "cost": 12000, "stock": 50, "category": "Makanan", "unit": "porsi"},
        {"name": "Teh Tarik Hangat", "price": 15000, "cost": 4000, "stock": 80, "category": "Minuman", "unit": "cup"},
        {"name": "Roti Bakar Coklat", "price": 17000, "cost": 6000, "stock": 40, "category": "Roti", "unit": "pcs"},
        {"name": "Air Mineral 600ml", "price": 5000, "cost": 2500, "stock": 200, "category": "Minuman", "unit": "btl"},
    ]
    docs = []
    for p in sample_products:
        docs.append({
            "id": str(uuid.uuid4()),
            "store_id": store_id,
            "sku": "GR-" + str(uuid.uuid4())[:6].upper(),
            "active": True,
            "image_url": None,
            "description": None,
            "created_at": utcnow().isoformat(),
            "updated_at": utcnow().isoformat(),
            **p,
        })
    if docs:
        await db.products.insert_many(docs)

    token = create_access_token(user_id, store_id, "admin", payload.email)
    return Token(access_token=token, user=_user_public(user_doc))


@router.post("/login", response_model=Token)
async def login(payload: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_access_token(user["id"], user["store_id"], user.get("role", "admin"), user["email"])
    return Token(access_token=token, user=_user_public(user))


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return _user_public(user)
