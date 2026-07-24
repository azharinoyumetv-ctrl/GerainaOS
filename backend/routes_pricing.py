"""Pricing tiers (static, public) — FINAL pricing per client spec.

DO NOT modify prices without explicit client approval.
"""
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


@router.get("/addons/my")
async def list_my_addons(user: dict = Depends(get_billing_user)):
    """This store's addon purchase requests (pending/active/rejected), newest first. Uses
    get_billing_user (not get_current_user) so this stays reachable on an expired trial --
    see require_billing_admin below for why."""
    db = get_db()
    cursor = db.addon_purchases.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)


@router.post("/addons/purchase")
async def purchase_addon(payload: dict, user: dict = Depends(require_billing_admin)):
    """Same honest pattern as /upgrade above -- no subscription payment gateway is wired to
    this app's own billing (only to in-store POS transactions via Xendit/DOKU/EDC), so this
    records a pending request for manual activation by DagangOS staff after payment is
    confirmed offline, rather than pretending to instantly grant paid capacity.

    Once a request is flipped to status="active" (manually, in the DB, by staff), it takes
    effect automatically -- plan_limits.py's check_capacity()/check_outlet_capacity() read
    active addon_purchases and add the bonus capacity on top of the plan's base caps. See
    _active_addon_counts()/_addon_bonus() there. No separate "apply the addon" step needed.

    Uses require_billing_admin (not require_admin) so this stays reachable on an expired
    trial -- though in practice plan != "pro"/"business" below already rejects an expired
    account from buying an addon anyway; they have to /upgrade first regardless."""
    addon_id = payload.get("addon_id")
    addon = next((a for a in ADDONS if a["id"] == addon_id), None)
    if not addon:
        raise HTTPException(status_code=400, detail="Add-on tidak valid")

    plan = user.get("plan")
    if addon_id == "extra_device" and plan != "pro":
        raise HTTPException(status_code=400, detail="Add-on device tambahan khusus untuk paket Pro.")
    if addon_id == "extra_outlet" and plan != "business":
        raise HTTPException(status_code=400, detail="Add-on outlet tambahan khusus untuk paket Business.")

    db = get_db()
    if addon_id == "extra_device":
        existing = await db.addon_purchases.count_documents({
            "store_id": user["store_id"], "addon_id": "extra_device", "status": {"$in": ["pending", "active"]},
        })
        if existing >= 2:
            raise HTTPException(status_code=400, detail="Maksimal 2 device tambahan per toko (sudah tercapai).")

    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "addon_id": addon_id,
        "requested_by": user["id"],
        "requested_by_email": user.get("email"),
        "status": "pending",
        "created_at": utcnow().isoformat(),
    }
    await db.addon_purchases.insert_one(doc)
    return {
        "ok": True,
        "status": "pending_manual_activation",
        "message": f"Permintaan add-on \"{addon['name']}\" tercatat. Tim kami akan mengaktifkannya secara manual setelah pembayaran dikonfirmasi.",
    }
