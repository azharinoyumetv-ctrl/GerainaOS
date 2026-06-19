"""Settings, Payments config, Integrations, and Branch management routes."""
import uuid
from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import Branch, BranchBase
from auth import get_current_user

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
            "printer": { "default_printer": "Bluetooth 80mm", "paper_size": "80mm", "auto_print": True }
        }
    return res

@router.post("/api/settings")
async def save_settings(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    db = get_db()
    doc = dict(payload)
    doc["store_id"] = user["store_id"]
    await db.settings.find_one_and_replace(
        {"store_id": user["store_id"]},
        doc,
        upsert=True
    )
    doc.pop("_id", None)
    return doc

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
            "bank_transfer": { "is_active": True, "accounts": [{ "bank": "Bank Central Asia", "account_no": "8820987111", "account_name": "DagangOS Geraina POS" }] }
        }
    return res

@router.post("/api/payments/config")
async def save_payments_config(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    db = get_db()
    doc = dict(payload)
    doc["store_id"] = user["store_id"]
    await db.payments_config.find_one_and_replace(
        {"store_id": user["store_id"]},
        doc,
        upsert=True
    )
    doc.pop("_id", None)
    return doc

# ---------- Integrations ----------
@router.get("/api/integrations")
async def get_integrations(user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.integrations.find_one({"store_id": user["store_id"]}, {"_id": 0})
    if not res:
        return {
            "xendit": { "is_active": True, "secret_key": "xnd_live_...", "webhook_token": "ger-token-xyz-123" },
            "midtrans": { "is_active": False, "client_key": "VT-client-...", "server_key": "VT-server-..." },
            "stripe": { "is_active": False, "publishable_key": "pk_live_...", "secret_key": "sk_live_..." },
            "whatsapp": { "is_active": True, "provider": "Fonnte / Qontak", "api_token": "wa-token-abc", "auto_send_receipt": True },
            "telegram": { "is_active": False, "bot_token": "bot123456:...", "chat_id": "@gerainapos_alerts" },
            "email": { "is_active": True, "smtp_host": "smtp.mailgun.org", "smtp_port": 587, "smtp_user": "postmaster@geraina.com" }
        }
    return res

@router.post("/api/integrations")
async def save_integrations(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    db = get_db()
    doc = dict(payload)
    doc["store_id"] = user["store_id"]
    await db.integrations.find_one_and_replace(
        {"store_id": user["store_id"]},
        doc,
        upsert=True
    )
    doc.pop("_id", None)
    return doc

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
