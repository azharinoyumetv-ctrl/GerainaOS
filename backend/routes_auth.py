"""Auth routes: register store + login + me."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
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

    # Seed Categories
    cats = [
        {"id": "cat-1", "name": "Makanan", "description": "Menu makanan utama"},
        {"id": "cat-2", "name": "Minuman", "description": "Kopi, teh, jus, dan soft drink"},
        {"id": "cat-3", "name": "Cemilan", "description": "Snack dan dessert"},
        {"id": "cat-4", "name": "Bumbu & Bahan", "description": "Bahan mentah dapur"},
    ]
    for c in cats:
        c["store_id"] = store_id
        c["created_at"] = utcnow().isoformat()
        c["updated_at"] = utcnow().isoformat()
    await db.categories.insert_many(cats)

    # Seed Brands
    brands = [
        {"id": "br-1", "name": "Kopi Gayo", "description": "Biji kopi aceh"},
        {"id": "br-2", "name": "Sariwangi", "description": "Teh celup lokal"},
        {"id": "br-3", "name": "Indofood", "description": "Bahan makanan pokok"},
    ]
    for b in brands:
        b["store_id"] = store_id
        b["created_at"] = utcnow().isoformat()
        b["updated_at"] = utcnow().isoformat()
    await db.brands.insert_many(brands)

    # Seed Units
    units = [
        {"id": "un-1", "name": "Pcs", "short_name": "pcs"},
        {"id": "un-2", "name": "Box", "short_name": "box"},
        {"id": "un-3", "name": "Botol", "short_name": "btl"},
        {"id": "un-4", "name": "Kilogram", "short_name": "kg"},
        {"id": "un-5", "name": "Gram", "short_name": "g"},
    ]
    for u in units:
        u["store_id"] = store_id
        u["created_at"] = utcnow().isoformat()
        u["updated_at"] = utcnow().isoformat()
    await db.units.insert_many(units)

    # Seed Memberships
    mems = [
        {"id": "mem-1", "name": "Bronze", "min_points": 0, "discount_percent": 0.0, "description": "Level dasar pendaftaran"},
        {"id": "mem-2", "name": "Silver", "min_points": 100, "discount_percent": 5.0, "description": "Diskon 5% untuk semua item"},
        {"id": "mem-3", "name": "Gold", "min_points": 300, "discount_percent": 10.0, "description": "Diskon 10% + free coffee di hari ultah"},
        {"id": "mem-4", "name": "Platinum", "min_points": 800, "discount_percent": 15.0, "description": "Diskon 15% + prioritas reservasi"},
    ]
    for m in mems:
        m["store_id"] = store_id
    await db.memberships.insert_many(mems)

    # Seed Loyalty Rules
    await db.loyalty_rules.insert_one({
        "store_id": store_id,
        "conversion_rate": 10000,
        "point_value": 100,
        "min_redeem_points": 50
    })

    # Seed Payments Config
    await db.payments_config.insert_one({
        "store_id": store_id,
        "cash": { "is_active": True, "provider": "Sistem Kasir Lokal", "require_drawer": True, "active_drawer_port": "COM3" },
        "qris": { "is_active": True, "provider": "Xendit", "type": "dynamic", "merchant_id": "MID-GER-QRIS-99", "callback_status": "Active" },
        "ewallet": {
            "is_active": True,
            "provider": "Xendit",
            "channels": {
                "GoPay": True, "OVO": True, "DANA": True, "ShopeePay": True, "LinkAja": True,
                "AstraPay": False, "Sakuku": False, "iSaku": False, "MotionPay": False, "JeniusPay": True
            }
        },
        "va": {
            "is_active": True,
            "provider": "Midtrans",
            "banks": {
                "BCA": True, "BNI": True, "BRI": True, "Mandiri": True, "Permata": True,
                "CIMB": True, "Maybank": False, "Danamon": False, "Neo": False, "BSI": True
            }
        },
        "credit_card": { "is_active": True, "provider": "Stripe", "enable_3ds": True, "installment_banks": ["Mandiri", "BCA", "CIMB"] },
        "bank_transfer": { "is_active": True, "accounts": [{ "bank": "Bank Central Asia", "account_no": "8820987111", "account_name": "DagangOS Geraina POS" }] }
    })

    # Seed Integrations
    await db.integrations.insert_one({
        "store_id": store_id,
        "xendit": { "is_active": True, "secret_key": "xnd_live_...", "webhook_token": "ger-token-xyz-123" },
        "midtrans": { "is_active": False, "client_key": "VT-client-...", "server_key": "VT-server-..." },
        "stripe": { "is_active": False, "publishable_key": "pk_live_...", "secret_key": "sk_live_..." },
        "whatsapp": { "is_active": True, "provider": "Fonnte / Qontak", "api_token": "wa-token-abc", "auto_send_receipt": True },
        "telegram": { "is_active": False, "bot_token": "bot123456:...", "chat_id": "@gerainapos_alerts" },
        "email": { "is_active": True, "smtp_host": "smtp.mailgun.org", "smtp_port": 587, "smtp_user": "postmaster@geraina.com" }
    })

    # Seed Settings (Indonesian language defaulted!)
    await db.settings.insert_one({
        "store_id": store_id,
        "general": { "store_name": payload.store_name, "currency": "IDR", "timezone": "WIB (UTC+7)", "language": "id" },
        "receipt": { "header_text": "Terima Kasih Telah Berkunjung!", "footer_text": "Powered by DagangOS - Struk Resmi", "show_logo": True, "show_cashier": True },
        "printer": { "default_printer": "Bluetooth 80mm", "paper_size": "80mm", "auto_print": True }
    })

    # Seed Branch
    await db.branches.insert_one({
        "id": "brch-1",
        "store_id": store_id,
        "name": "Outlet Utama (Jakarta)",
        "address": "Jl. Sudirman No. 12, Jakarta Selatan",
        "phone": "021-555666",
        "created_at": utcnow().isoformat()
    })

    # Seed Default Staff Profiles (so role switcher and separate staff accounts work)
    staff_docs = [
        {"id": user_id, "name": "Azhar Owner", "email": payload.email, "role": "Owner", "phone": "0811111111", "status": "Aktif"},
        {"id": str(uuid.uuid4()), "name": "Yudi Manager", "email": "manager@geraina.com", "role": "Manager", "phone": "0822222222", "status": "Aktif"},
        {"id": str(uuid.uuid4()), "name": "Dewi Kasir Utama", "email": "cashier@geraina.com", "role": "Cashier", "phone": "0833333333", "status": "Aktif"},
        {"id": str(uuid.uuid4()), "name": "Bambang Gudang", "email": "warehouse@geraina.com", "role": "Warehouse", "phone": "0844444444", "status": "Aktif"},
    ]
    for s in staff_docs:
        s["store_id"] = store_id
        s["created_at"] = utcnow().isoformat()
    await db.staff.insert_many(staff_docs)

    # Insert credentials for the other default staff so they can log in
    other_staff_creds = [
        {"email": "manager@geraina.com", "role": "Manager", "id": staff_docs[1]["id"]},
        {"email": "cashier@geraina.com", "role": "Cashier", "id": staff_docs[2]["id"]},
        {"email": "warehouse@geraina.com", "role": "Warehouse", "id": staff_docs[3]["id"]},
    ]
    for osc in other_staff_creds:
        await db.users.insert_one({
            "id": osc["id"],
            "email": osc["email"],
            "password_hash": hash_password("geraina123"),
            "role": osc["role"],
            "store_id": store_id,
            "store_name": payload.store_name,
            "trial_ends_at": trial_ends,
            "plan": "trial",
            "created_at": utcnow().isoformat()
        })

    token = create_access_token(user_id, store_id, "Owner", payload.email)
    return Token(access_token=token, user=_user_public(user_doc))


@router.post("/login", response_model=Token)
async def login(payload: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_access_token(user["id"], user["store_id"], user.get("role", "admin"), user["email"])
    return Token(access_token=token, user=_user_public(user))


@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_db()
    user = await db.users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_access_token(user["id"], user["store_id"], user.get("role", "admin"), user["email"])
    return Token(access_token=token, user=_user_public(user))


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return _user_public(user)

