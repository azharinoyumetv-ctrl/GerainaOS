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
        "tagline": "14 hari, akses penuh fitur Business",
        "features": [
            "Semua fitur paket Business",
            "3 outlet, device & akun setara Business",
            "Tanpa kartu kredit",
            "Bisa berhenti kapan saja",
        ],
        "cta": "Mulai Trial",
        "highlight": False,
    },
    {
        "id": "starter",
        "name": "Starter",
        "price_idr_monthly": 149000,
        "price_idr_yearly": 1490000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Kasir digital dasar",
        "features": [
            "1 outlet, 1 device kasir",
            "3 akun karyawan",
            "Maks 1.000 produk, transaksi unlimited",
            "POS + scan barcode",
            "Tunai + catat manual QRIS/kartu/transfer/e-wallet",
            "Stok dasar + notifikasi stok menipis",
            "Database pelanggan + struk thermal",
        ],
        "cta": "Pilih Starter",
        "highlight": False,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_idr_monthly": 349000,
        "price_idr_yearly": 3490000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Operasional lengkap 1 outlet",
        "features": [
            "1 outlet, 5 device, 15 akun karyawan",
            "Produk & transaksi unlimited",
            "Import/export Excel/CSV",
            "Purchase order, goods receiving & faktur supplier",
            "Inventory valuation + analisis stok mati",
            "QRIS + e-wallet otomatis (Xendit)",
            "Piutang & utang",
            "Laporan penjualan, stok & laba rugi",
        ],
        "cta": "Pilih Pro",
        "highlight": False,
    },
    {
        "id": "business",
        "name": "Business",
        "price_idr_monthly": 549000,
        "price_idr_yearly": 5490000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Kontrol penuh, siap multi-outlet",
        "highlight_note": "Semua fitur operasional, otomatisasi, dan multi-outlet dalam satu paket.",
        "features": [
            "3 outlet, 15 device, 50 akun karyawan",
            "Dashboard terpusat multi-outlet",
            "Transfer stok & laporan konsolidasi antar outlet",
            "Membership + loyalty points",
            "Absensi karyawan + role & permission lanjutan",
            "Integrasi WhatsApp otomatis",
            "Webhook & integrasi pembayaran lanjutan",
            "Monitoring piutang/utang terpusat",
        ],
        "cta": "Pilih Business",
        "highlight": True,
        "badge": "Nilai Terbaik",
    },
]

ADDONS = [
    {"id": "extra_device", "name": "Device kasir tambahan", "price_idr": 49000, "unit": "/bulan, khusus Pro (maks 2 device)"},
    {"id": "extra_outlet", "name": "Outlet tambahan", "price_idr": 149000, "unit": "/bulan, khusus Business — termasuk 5 device & 15 akun karyawan"},
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
    shows "Hubungi Sales" for every paid tier) and grant themselves Starter/Pro/Business
    for free. No payment gateway is wired yet (Xendit/Midtrans keys pending), so
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
