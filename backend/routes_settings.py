"""Settings, Payments config, Integrations, and Branch management routes."""
import uuid
from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import Branch, BranchBase
from auth import get_current_user, require_admin
from plan_limits import require_plan, plan_rank
from bank_qris import BankQrisSetup, inspect_static_qris, public_bank_qris
from permissions import require_permission, canonical_role
from payment_options import payment_options, section, EWALLETS
from merchant_checkout import GATEWAYS, provider_name, selected_channels

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
    if canonical_role(user.get("role")) == "Owner":
        return res
    # Receipt/cache consumers need these display settings, never arbitrary owner settings.
    public_fields = {
        "general": {"store_name", "currency", "timezone", "language", "address", "phone", "logo_url"},
        "receipt": {"header_text", "footer_text", "show_logo", "show_cashier", "show_customer", "paper_size"},
        "printer": {"mode", "default_printer", "paper_size", "auto_print", "printer_ip", "printer_port", "bridge_port"},
    }
    return {section: {key: value for key, value in (res.get(section) or {}).items() if key in fields}
            for section, fields in public_fields.items() if isinstance(res.get(section), dict)}

@router.post("/api/settings", dependencies=[Depends(require_permission("settings.write"))])
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
@router.get('/api/payments/options', dependencies=[Depends(require_permission('pos.use'))])
async def get_payment_options(user: dict = Depends(get_current_user)):
    return await payment_options(get_db(), user)

@router.get("/api/payments/bank-qris")
async def get_bank_qris(user: dict = Depends(get_current_user)):
    # Cashiers can read the public payment code, never another provider's API secrets.
    saved = await get_db().bank_qris_configs.find_one({"store_id": user["store_id"]}, {"_id": 0})
    return public_bank_qris(saved)


@router.post("/api/payments/bank-qris", dependencies=[Depends(require_permission("payments.configure"))])
async def save_bank_qris(payload: BankQrisSetup, user: dict = Depends(require_admin)):
    name = payload.bank_name.strip()
    if payload.is_active and (not name or payload.merchant_confirmed is not True):
        raise HTTPException(status_code=400, detail="Isi nama bank dan pastikan QRIS milik merchant yang benar sebelum mengaktifkan.")
    try:
        details = inspect_static_qris(payload.qr_payload) if payload.qr_payload else {"qr_payload": "", "merchant_name": "", "merchant_city": ""}
        if payload.is_active and not payload.qr_payload:
            raise ValueError("Unggah QRIS statis dari bank terlebih dahulu.")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    saved = {**details, "bank_name": name, "is_active": payload.is_active, "confirmation_mode": "manual_bank",
             "updated_at": utcnow().isoformat(), "updated_by": user["id"]}
    await get_db().bank_qris_configs.update_one({"_id": user["store_id"]}, {"$set": {**saved, "store_id": user["store_id"]}}, upsert=True)
    return public_bank_qris(saved)


@router.get("/api/payments/config", dependencies=[Depends(require_permission("payments.configure"))])
async def get_payments_config(user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.payments_config.find_one({"store_id": user["store_id"]}, {"_id": 0})
    saved = res or {}
    # Default Indonesian payment channels config
    defaults = {
        "cash": { "is_active": True, "provider": "Sistem Kasir Lokal", "require_drawer": False, "active_drawer_port": "" },
        "qris": { "is_active": False, "provider": "Xendit", "type": "dynamic", "merchant_id": "", "callback_status": "Unverified" },
        "ewallet": {
            "is_active": False,
            "provider": "Xendit",
            "channels": {
                "GoPay": True, "OVO": True, "DANA": True, "ShopeePay": True, "LinkAja": True,
                "AstraPay": False, "Sakuku": False, "iSaku": False, "MotionPay": False, "JeniusPay": True
            }
        },
        "va": {
            "is_active": False,
            "provider": "Midtrans",
            "banks": {
                "BCA": True, "BNI": True, "BRI": True, "Mandiri": True, "Permata": True,
                "CIMB": True, "Maybank": False, "Danamon": False, "Neo": False, "BSI": True
            }
        },
        "credit_card": { "is_active": False, "provider": "", "enable_3ds": True, "installment_banks": [] },
        "bank_transfer": { "is_active": False, "accounts": [{ "bank": "", "account_no": "", "account_name": "" }] },
        "edc": { "is_active": False, "provider": "" }
    }
    res = {**saved, **{key: {**value, **section(saved, key)} for key, value in defaults.items()}}
    # Older clients also receive a complete document. Unsupported legacy flags
    # do not represent a usable checkout and must not appear active on read.
    for key in ('bank_transfer', 'edc'):
        res[key]['is_active'] = False
    options = await payment_options(db, user)
    wallet = section(res, 'ewallet')
    res['ewallet'] = {**wallet, 'provider': wallet.get('provider') or 'Xendit',
                      'is_active': section(saved, 'ewallet').get('is_active', options['methods']['ewallet']['enabled']),
                      'channels': {**section(wallet, 'channels'), **{label: section(wallet, 'channels').get(label, section(wallet, 'channels').get(code, True)) for code, label in EWALLETS.items()}}}
    res['qris_bank'] = {'is_active': options['methods']['qris_bank']['displayed'], **section(saved, 'qris_bank')}
    res['checkout_options'] = options
    return res

@router.post("/api/payments/config", dependencies=[Depends(require_permission("payments.configure"))])
async def save_payments_config(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    db = get_db()
    saved = await db.payments_config.find_one({'store_id': user['store_id']}, {'_id': 0}) or {}
    for key in payload:
        if key in ('_id', 'store_id'):
            continue
        if key not in ('cash', 'qris', 'qris_bank', 'ewallet', 'va', 'credit_card', 'bank_transfer', 'edc') or not isinstance(payload[key], dict):
            raise HTTPException(422, 'Pengaturan metode pembayaran tidak valid.')
        if 'is_active' in payload[key] and type(payload[key]['is_active']) is not bool:
            raise HTTPException(422, 'Pilihan tampil di kasir harus berupa ya/tidak.')
        if key in ('ewallet', 'va', 'credit_card'):
            value = {**section(saved, key), **payload[key]}
            if key == 'ewallet' and not value.get('provider'):
                value['provider'] = 'Xendit'
            provider = provider_name(value)
            if value.get('is_active') and (provider not in GATEWAYS or not selected_channels(key, value, provider)):
                raise HTTPException(400, 'Pilih gateway yang didukung dan minimal satu kanal pembayaran.')
            for field in ('channels', 'banks'):
                if field in value and (not isinstance(value[field], dict) or any(type(on) is not bool for on in value[field].values())):
                    raise HTTPException(422, 'Pilihan kanal pembayaran tidak valid.')
    for key in ('bank_transfer', 'edc'):
        if section(payload, key).get('is_active'):
            raise HTTPException(400, 'Transfer manual dan mesin EDC belum dapat diaktifkan pada kasir.')
    qris = payload.get("qris")
    if qris and qris.get("is_active"):
        mid = qris.get("merchant_id")
        if not mid or not str(mid).strip():
            raise HTTPException(status_code=400, detail="Merchant ID wajib diisi")

    update_data = {k: {**section(saved, k), **v} for k, v in payload.items() if k not in ("_id", "store_id")}
    if any(key in payload for key in ('ewallet', 'va', 'credit_card')):
        update_data['checkout_policy_version'] = 2
    res = await db.payments_config.find_one_and_update(
        {"store_id": user["store_id"]},
        {"$set": update_data},
        upsert=True,
        return_document=True,
        projection={"_id": 0}
    )
    return res

# ---------- Integrations (Pro-tier floor; WhatsApp/Telegram/Email are Business-only within
# it -- see AppLayout.jsx minPlan. One combined get/set endpoint covers all providers, so the
# WhatsApp/Telegram/Email restriction is enforced inline in save_integrations below rather than
# via the Depends, since a Pro user must still be able to save Xendit/Midtrans/Stripe/DOKU.) ----------
async def integration_owner(user: dict = Depends(require_plan("pro"))):
    if user.get("role") not in ("Owner", "admin"):
        raise HTTPException(status_code=403, detail="Peran Owner diperlukan untuk mengelola kredensial integrasi")
    return user


@router.get("/api/integrations/qris/status", dependencies=[Depends(require_permission("integrations.manage"))])
async def qris_setup_status(user: dict = Depends(integration_owner)):
    """Read-only configuration status, never a claim of a successful payment/provider connection."""
    saved = await get_db().integrations.find_one({"store_id": user["store_id"]}, {"_id": 0})
    config = (saved or {}).get("xendit") or {}
    return {
        "provider": "xendit", "credentialSource": "merchant_store", "flowVersion": 2,
        "active": config.get("is_active") is True,
        "apiKeyConfigured": bool(str(config.get("secret_key") or "").strip()),
        "callbackTokenConfigured": bool(str(config.get("webhook_token") or "").strip()),
        "paymentVerified": False,
    }


@router.get("/api/integrations", dependencies=[Depends(require_permission("integrations.manage"))])
async def get_integrations(user: dict = Depends(integration_owner)):
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
            "email": { "is_active": False, "smtp_host": "", "smtp_port": 587, "smtp_user": "" },
            "doku": { "is_active": False, "client_id": "", "shared_key": "", "environment": "sandbox", "preferred_channel": "all" }
        }
    return res

@router.post("/api/integrations", dependencies=[Depends(require_permission("integrations.manage"))])
async def save_integrations(payload: Dict[str, Any], user: dict = Depends(integration_owner)):
    if plan_rank(user.get("plan")) < plan_rank("pro"):
        raise HTTPException(status_code=403, detail="Integrasi pihak ketiga tersedia mulai paket Pro. Upgrade paket untuk mengakses fitur ini.")
    if plan_rank(user.get("plan")) < plan_rank("business"):
        for key, label in (("whatsapp", "WhatsApp"), ("telegram", "Telegram"), ("email", "Email")):
            if (payload.get(key) or {}).get("is_active"):
                raise HTTPException(status_code=403, detail=f"Integrasi {label} hanya tersedia di paket Business. Upgrade paket untuk mengaktifkan.")

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

    # Same collision guard for DOKU's Client-Id -- inbound webhook lookups key off
    # client-id, so two stores sharing one would let DOKU's callback for store A
    # get matched against store B's saved order/credentials.
    doku = payload.get("doku") or {}
    doku_client_id = str(doku.get("client_id") or "").strip()
    if doku_client_id:
        clash = await db.integrations.find_one({
            "doku.client_id": doku_client_id,
            "store_id": {"$ne": user["store_id"]},
        })
        if clash:
            raise HTTPException(status_code=400, detail="Client ID DOKU ini sudah dipakai toko lain")

    # Same collision guard for Xendit's webhook_token -- now that Xendit is per-store BYO
    # (see xendit_client.py history note) rather than a single global key, the inbound
    # webhook resolves the tenant by this token, so a duplicate would misroute one store's
    # payment callbacks onto another's orders.
    xendit = payload.get("xendit") or {}
    xendit_token = str(xendit.get("webhook_token") or "").strip()
    if xendit_token:
        clash = await db.integrations.find_one({
            "xendit.webhook_token": xendit_token,
            "store_id": {"$ne": user["store_id"]},
        })
        if clash:
            raise HTTPException(status_code=400, detail="Webhook Token Xendit ini sudah dipakai toko lain — pilih string yang unik")

    update_data = {k: v for k, v in payload.items() if k not in ("_id", "store_id")}
    res = await db.integrations.find_one_and_update(
        {"store_id": user["store_id"]},
        {"$set": update_data},
        upsert=True,
        return_document=True,
        projection={"_id": 0}
    )
    return res

@router.post("/api/integrations/whatsapp/test", dependencies=[Depends(require_permission("integrations.manage"))])
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
    if plan_rank(user.get("plan")) < plan_rank("business"):
        raise HTTPException(status_code=403, detail="Integrasi WhatsApp hanya tersedia di paket Business. Upgrade paket untuk mengaktifkan.")
    cfg = {"is_active": True, "phone_number_id": phone_number_id, "access_token": access_token}
    return await send_meta_message(cfg, target, template_name="hello_world", params=[], lang="en_US")

# ---------- Branches (Business-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/branches", response_model=List[Branch], dependencies=[Depends(require_permission("branches.manage"))])
async def list_branches(user: dict = Depends(require_plan("business"))):
    db = get_db()
    cursor = db.branches.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=100)

@router.post("/api/branches", response_model=Branch, dependencies=[Depends(require_permission("branches.manage"))])
async def create_branch(payload: BranchBase, user: dict = Depends(require_plan("business"))):
    db = get_db()
    from plan_limits import check_outlet_capacity
    await check_outlet_capacity(db, user["store_id"], user.get("plan"))
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

@router.put("/api/branches/{branch_id}", response_model=Branch, dependencies=[Depends(require_permission("branches.manage"))])
async def update_branch(branch_id: str, payload: BranchBase, user: dict = Depends(require_plan("business"))):
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

@router.delete("/api/branches/{branch_id}", dependencies=[Depends(require_permission("branches.manage"))])
async def delete_branch(branch_id: str, user: dict = Depends(require_plan("business"))):
    db = get_db()
    res = await db.branches.delete_one({"id": branch_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cabang tidak ditemukan")
    return {"ok": True}
