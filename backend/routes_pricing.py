"""Pricing tiers (static, public)."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/pricing", tags=["pricing"])

TIERS = [
    {
        "id": "trial",
        "name": "Trial",
        "price_idr": 0,
        "period": "14 hari",
        "tagline": "Coba semua fitur tanpa kartu kredit",
        "features": [
            "1 outlet",
            "Maks 100 produk",
            "Unlimited transaksi",
            "Akses semua fitur Growth",
            "Tanpa kartu kredit",
        ],
        "cta": "Mulai Trial",
        "highlight": False,
    },
    {
        "id": "starter",
        "name": "Starter",
        "price_idr": 99000,
        "period": "/bulan",
        "tagline": "Untuk warung & kafe mandiri",
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
        "id": "growth",
        "name": "Growth",
        "price_idr": 249000,
        "period": "/bulan",
        "tagline": "UMKM siap scale, multi-kasir",
        "features": [
            "Hingga 3 outlet, 5 kasir",
            "Produk unlimited",
            "Excel/CSV import",
            "Invoice A4 + thermal receipt",
            "Webhook real-time",
            "Support prioritas (chat)",
        ],
        "cta": "Pilih Growth",
        "highlight": True,
        "badge": "Paling Populer",
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "price_idr": None,
        "period": "Hubungi kami",
        "tagline": "Untuk franchise & retail besar",
        "features": [
            "Unlimited outlet & kasir",
            "Custom integrations (ERP, accounting)",
            "Dedicated success manager",
            "SLA 99.9% uptime",
            "On-premise option",
            "Training on-site",
        ],
        "cta": "Hubungi Sales",
        "highlight": False,
    },
]


@router.get("/tiers")
async def list_tiers():
    return TIERS
