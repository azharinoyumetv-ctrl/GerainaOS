"""Pricing tiers (static, public) — FINAL pricing per client spec.

DO NOT modify prices without explicit client approval.
"""
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from database import get_db

router = APIRouter(prefix="/api/pricing", tags=["pricing"])

TIERS = [
    {
        "id": "trial",
        "name": "Free Trial",
        "price_idr_monthly": 0,
        "price_idr_yearly": 0,
        "period_monthly": "14 hari",
        "period_yearly": "14 hari",
        "tagline": "1 outlet, limited features",
        "features": [
            "1 outlet",
            "Maks 100 produk",
            "Unlimited transaksi",
            "Akses fitur Pro",
            "Tanpa kartu kredit",
        ],
        "cta": "Mulai Trial",
        "highlight": False,
    },
    {
        "id": "starter",
        "name": "Starter",
        "price_idr_monthly": 99000,
        "price_idr_yearly": 990000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Small warung/toko",
        "features": [
            "1 outlet, 1 kasir",
            "Hingga 500 produk",
            "Laporan harian + ekspor PDF",
            "QRIS + e-wallet (Xendit)",
            "Support email",
        ],
        "cta": "Pilih Starter",
        "highlight": False,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_idr_monthly": 249000,
        "price_idr_yearly": 2490000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Main package — paling banyak dipilih",
        "features": [
            "1 outlet, hingga 3 kasir",
            "Produk unlimited",
            "Excel/CSV import",
            "Invoice A4 + thermal receipt",
            "Webhook real-time",
            "Support prioritas (chat)",
        ],
        "cta": "Pilih Pro",
        "highlight": True,
        "badge": "Paling Direkomendasikan",
    },
    {
        "id": "business",
        "name": "Business",
        "price_idr_monthly": 499000,
        "price_idr_yearly": 4990000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Bigger store, multi-kasir",
        "features": [
            "1 outlet, kasir unlimited",
            "Produk unlimited",
            "Multi-shift report",
            "Custom branding struk",
            "Analytics lanjutan",
            "Support prioritas 7×12",
        ],
        "cta": "Pilih Business",
        "highlight": False,
    },
    {
        "id": "multibranch",
        "name": "Multi-Branch",
        "price_idr_monthly": 799000,
        "price_idr_yearly": None,
        "period_monthly": "/bulan, mulai dari",
        "period_yearly": "Custom",
        "tagline": "Multiple branches",
        "features": [
            "Unlimited outlet",
            "Konsolidasi laporan antar cabang",
            "Transfer stok antar cabang",
            "Dedicated success manager",
            "SLA & on-premise option",
            "Training on-site",
        ],
        "cta": "Hubungi Sales",
        "highlight": False,
    },
]

ADDONS = [
    {"id": "extra_device", "name": "Extra device", "price_idr": 49000, "unit": "/bulan"},
    {"id": "extra_branch", "name": "Extra branch", "price_idr": 199000, "unit": "/bulan"},
    {"id": "remote_setup", "name": "Remote setup", "price_idr": 499000, "unit": "one-time"},
    {"id": "import_setup", "name": "Product import setup", "price_idr_min": 499000, "price_idr_max": 999000, "unit": "one-time"},
    {"id": "onsite_setup", "name": "On-site setup", "price_idr_min": 1000000, "price_idr_max": 3000000, "unit": "+ transport, one-time"},
]


@router.get("/tiers")
async def list_tiers():
    return TIERS


@router.get("/addons")
async def list_addons():
    return ADDONS


@router.post("/upgrade")
async def upgrade_plan(payload: dict, user: dict = Depends(get_current_user)):
    tier_id = payload.get("tier_id")
    if not tier_id or tier_id not in [t["id"] for t in TIERS]:
        raise HTTPException(status_code=400, detail="Paket tidak valid")
    
    db = get_db()
    await db.users.find_one_and_update(
        {"id": user["id"]},
        {"$set": {"plan": tier_id}}
    )
    await db.stores.find_one_and_update(
        {"id": user["store_id"]},
        {"$set": {"plan": tier_id}}
    )
    return {"ok": True, "plan": tier_id}
