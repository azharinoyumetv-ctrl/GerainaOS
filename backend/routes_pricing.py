"""Pricing tiers (static, public) — FINAL pricing per client spec.

DO NOT modify prices without explicit client approval.
"""
from permissions import require_permission
import uuid
from fastapi import APIRouter, Depends, HTTPException
from auth import get_billing_user, require_billing_admin
from database import get_db, utcnow

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
        "max_outlets": 3,
        "max_employees": 50,
        "max_products": None,
        "max_devices": 15,
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
        "max_outlets": 1,
        "max_employees": 3,
        "max_products": 1000,
        "max_devices": 1,
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
        "max_outlets": 1,
        "max_employees": 15,
        "max_products": None,
        "max_devices": 5,
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
        "max_outlets": 3,
        "max_employees": 50,
        "max_products": None,
        "max_devices": 15,
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
async def upgrade_plan(payload: dict, user: dict = Depends(require_billing_admin)):
    """Trials begin once at product activation; paid plans need verified checkout."""
    if payload.get("tier_id") not in {tier["id"] for tier in TIERS}:
        raise HTTPException(400, "Paket tidak valid")
    raise HTTPException(409, "Trial hanya dimulai saat aktivasi produk. Pilih paket berbayar melalui Langganan & Tagihan atau halaman Harga.")

@router.get("/addons/my", dependencies=[Depends(require_permission("billing.manage"))])
async def list_my_addons(user: dict = Depends(get_billing_user)):
    """This store's addon purchase requests (pending/active/rejected), newest first. Uses
    get_billing_user (not get_current_user) so this stays reachable on an expired trial --
    see require_billing_admin below for why."""
    db = get_db()
    cursor = db.addon_purchases.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)


@router.post("/addons/purchase")
async def purchase_addon(payload: dict, user: dict = Depends(require_billing_admin)):
    """Legacy clients must use the verified checkout, never a manual free grant."""
    addon = next((a for a in ADDONS if a["id"] == payload.get("addon_id")), None)
    if not addon:
        raise HTTPException(400, "Add-on tidak valid")
    required = "pro" if addon["id"] == "extra_device" else "business"
    if user.get("plan") != required:
        raise HTTPException(400, f"Add-on ini memerlukan paket {required.title()} aktif.")
    raise HTTPException(409, "Pembelian add-on sekarang melalui checkout Xendit. Perbarui aplikasi lalu buka Langganan & Tagihan atau halaman Harga.")
