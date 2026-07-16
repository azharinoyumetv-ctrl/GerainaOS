"""Settings, Payments config, Integrations, and Branch management routes."""
import uuid
from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import Branch, BranchBase
from auth import get_current_user, require_admin

router = APIRouter(tags=["settings"])

# ---------- General Settings ----------
@router.get("/api/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.settings.find_one({"store_id": user["store_id"]}, {"_id": 0})
    if not res:
        # Default settings, matching mockDb structure but default to Indonesian locale!
        return {
            "general": { "store_name": user.get("store_name", "Toko Senja"), "currency": "IDR", "timezone": "WIB (UTC+7)", "language": "id" },
            "receipt": { "header_text": "Terima Kasih Telah Berkunjung!", "footer_text": "Powered by DagangOS - Struk Resmi", "show_logo": True, "show_cashier": True },
            "printer": { "mode": "local", "default_printer": "Bluetooth 80mm", "paper_size": "80mm", "auto_print": True, "printer_ip": "", "printer_port": 9100, "bridge_port": 9899 }
        }
    return res

@router.post("/api/settings")
async def save_settings(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    db = get_db()
    update_data = {k: v for k, v in payload.items() if k not in ("_id", "store_id")}
    res = await db.settings.find_one_and_update(
        {"store_id": user["store_id"]},
        {"$set": update_data},
        upsert=True,
        return_document=True,
        projection={"_id": 0}
    )
    return res

# ---------- Payments Config ----------
@router.get("/api/payments/config")
async def get_payments_config(user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.payments_config.find_one({"store_id": user["store_id"]}, {"_id": 0})
    if not res:
        # Default Indonesian payment channels config
        return {
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
            "bank_transfer": { "is_active": True, "accounts": [{ "bank": "Bank Central Asia", "account_no": "8820987111", "account_name": "DagangOS Geraina POS" }] },
            "edc": { "is_active": False, "provider": "" }
        }
    return res

@router.post("/api/payments/config")
async def save_payments_config(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    qris = payload.get("qris")
    if qris and qris.get("is_active"):
        mid = qris.get("merchant_id")
        if not mid or not str(mid).strip():
            raise HTTPException(status_code=400, detail="Merchant ID wajib diisi")

    db = get_db()
    update_data = {k: v for k, v in payload.items() if k not in ("_id", "store_id")}
    res = await db.payments_config.find_one_and_update(
        {"store_id": user["store_id"]},
        {"$set": update_data},
        upsert=True,
        return_document=True,
        projection={"_id": 0}
    )
    return res

# ---------- Integrations ----------
@router.get("/api/integrations")
async def get_integrations(user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.integrations.find_one({"store_id": user["store_id"]}, {"_id": 0})
    if not res:
        # Default KOSONG (BYO) — merchant isi kredensial sendiri. Tanpa data demo palsu.
        return {
            "xendit": { "is_active": False, "secret_key": "", "webhook_token": "" },
            "midtrans": { "is_active": False, "client_key": "", "server_key": "" },
            "stripe": { "is_active": False, "publishable_key": "", "secret_key": "" },
            "whatsapp": { "is_active": False, "phone_number_id": "", "access_token": "", "app_secret": "", "webhook_verify_token": "", "template_receipt": "dagangos_order_receipt", "template_receipt_lang": "id", "template_po": "dagangos_po_notify", "template_po_lang": "id", "auto_send_receipt": False },
            "telegram": { "is_active": False, "bot_token": "", "chat_id": "" },
            "email": { "is_active": False, "smtp_host": "", "smtp_port": 587, "smtp_user": "" }
        }
    return res

@router.post("/api/integrations")
async def save_integrations(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    db = get_db()

    # WhatsApp inbound routing/signature verification key on webhook_verify_token and
    # phone_number_id being unique per tenant -- a collision lets one store's Meta verification
    # overwrite another store's saved phone_number_id. Reject collisions up front.
    wa = payload.get("whatsapp") or {}
    verify_token = str(wa.get("webhook_verify_token") or "").strip()
    if verify_token:
        clash = await db.integrations.find_one({
            "whatsapp.webhook_verify_token": verify_token,
            "store_id": {"$ne": user["store_id"]},
        })
        if clash:
            raise HTTPException(status_code=400, detail="Webhook Verify Token WhatsApp ini sudah dipakai toko lain — pilih string yang unik")

    update_data = {k: v for k, v in payload.items() if k not in ("_id", "store_id")}
    res = await db.integrations.find_one_and_update(
        {"store_id": user["store_id"]},
        {"$set": update_data},
        upsert=True,
        return_document=True,
        projection={"_id": 0}
    )
    return res

@router.post("/api/integrations/whatsapp/test")
async def test_whatsapp(payload: Dict[str, Any], user: dict = Depends(require_admin)):
    """Kirim pesan tes WhatsApp memakai kredensial yang sedang diisi (tak perlu simpan dulu).

    Pakai template 'hello_world' -- template utility bawaan yang otomatis tersedia & disetujui
    di setiap WABA baru tanpa perlu approval Meta dulu, jadi tombol tes ini langsung bisa
    memverifikasi kredensial & koneksi hari ini juga, sebelum template struk/PO kustom
    (dagangos_order_receipt / dagangos_po_notify) selesai disetujui Meta."""
    from whatsapp_client import send_meta_message
    target = str(payload.get("target") or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="Nomor tujuan wajib diisi")
    phone_number_id = str(payload.get("phone_number_id") or "").strip()
    access_token = str(payload.get("access_token") or "").strip()
    if not phone_number_id or not access_token:
        raise HTTPException(status_code=400, detail="Phone Number ID dan Access Token WhatsApp belum diisi")
    cfg = {"is_active": True, "phone_number_id": phone_number_id, "access_token": access_token}
    return await send_meta_message(cfg, target, template_name="hello_world", params=[], lang="en_US")

# ---------- Branches ----------
@router.get("/api/branches", response_model=List[Branch])
async def list_branches(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.branches.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=100)

@router.post("/api/branches", response_model=Branch)
async def create_branch(payload: BranchBase, user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db.branches.find_one({"store_id": user["store_id"], "name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Cabang/Outlet sudah terdaftar")
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "address": payload.address,
        "phone": payload.phone,
        "created_at": utcnow().isoformat()
    }
    await db.branches.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/api/branches/{branch_id}", response_model=Branch)
async def update_branch(branch_id: str, payload: BranchBase, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.branches.find_one_and_update(
        {"id": branch_id, "store_id": user["store_id"]},
        {"$set": {
            "name": payload.name,
            "address": payload.address,
            "phone": payload.phone
        }},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Cabang tidak ditemukan")
    return res

@router.delete("/api/branches/{branch_id}")
async def delete_branch(branch_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.branches.delete_one({"id": branch_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cabang tidak ditemukan")
    return {"ok": True}
