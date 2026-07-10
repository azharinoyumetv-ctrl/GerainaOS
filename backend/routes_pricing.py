"""Pricing tiers (static, public) — FINAL pricing per client spec.

DO NOT modify prices without explicit client approval.
"""
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user, require_admin
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
]


@router.get("/tiers")
async def list_tiers():
    return TIERS


@router.get("/addons")
async def list_addons():
    return ADDONS


@router.post("/upgrade")
async def upgrade_plan(payload: dict, user: dict = Depends(require_admin)):
    """Self-service ONLY for free tiers (trial). Paid tiers are NOT granted here -- this
    endpoint used to set `plan` unconditionally for any tier_id, which meant any store admin
    could call it directly (bypassing the UI, which only ever wires the button to "trial" and
    shows "Hubungi Sales" for every paid tier) and grant themselves Starter/Pro/Business/
    Multi-Branch for free. No payment gateway is wired yet (Xendit/Midtrans keys pending), so
    until a real payment-confirmed activation flow exists, paid-tier requests are recorded and
    left pending for manual activation by DagangOS staff after payment is confirmed offline --
    matching what the Billing settings tab already tells users. Replace this with a real
    gateway-webhook-driven activation once Xendit/Midtrans keys arrive."""
    tier_id = payload.get("tier_id")
    tier = next((t for t in TIERS if t["id"] == tier_id), None)
    if not tier:
        raise HTTPException(status_code=400, detail="Paket tidak valid")

    db = get_db()
    is_free = (tier.get("price_idr_monthly") or 0) == 0 and (tier.get("price_idr_yearly") or 0) == 0
    if is_free:
        await db.users.find_one_and_update(
            {"id": user["id"]},
            {"$set": {"plan": tier_id}}
        )
        await db.stores.find_one_and_update(
            {"id": user["store_id"]},
            {"$set": {"plan": tier_id}}
        )
        return {"ok": True, "status": "activated", "plan": tier_id}

    from database import utcnow
    await db.upgrade_requests.insert_one({
        "store_id": user["store_id"],
        "requested_by": user["id"],
        "requested_by_email": user.get("email"),
        "tier_id": tier_id,
        "status": "pending",
        "created_at": utcnow().isoformat(),
    })
    return {
        "ok": True,
        "status": "pending_manual_activation",
        "message": "Permintaan upgrade tercatat. Paket berbayar belum bisa diaktifkan otomatis karena payment gateway belum tersambung -- tim kami akan mengaktifkan paket Anda secara manual setelah pembayaran dikonfirmasi.",
    }
