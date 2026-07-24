"""Purchase management routes (Suppliers, Purchase Orders, Goods Receiving, Invoices)."""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import (
    Supplier, SupplierBase, PurchaseOrder, PurchaseOrderCreate,
    GoodsReceiving, GoodsReceivingCreate, SupplierInvoice, SupplierInvoiceCreate,
    SupplierInvoiceUpdate
)
from auth import get_current_user
from plan_limits import require_plan

router = APIRouter(tags=["purchase"])

# ---------- Suppliers (Pro-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/suppliers", response_model=List[Supplier])
async def list_suppliers(user: dict = Depends(require_plan("pro"))):
    db = get_db()
    cursor = db.suppliers.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=100)

@router.post("/api/suppliers", response_model=Supplier)
async def create_supplier(payload: SupplierBase, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    existing = await db.suppliers.find_one({"store_id": user["store_id"], "name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Supplier sudah ada")
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "phone": payload.phone,
        "email": payload.email,
        "address": payload.address,
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat()
    }
    await db.suppliers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/api/suppliers/{sup_id}", response_model=Supplier)
async def update_supplier(sup_id: str, payload: SupplierBase, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    res = await db.suppliers.find_one_and_update(
        {"id": sup_id, "store_id": user["store_id"]},
        {"$set": {
            "name": payload.name,
            "phone": payload.phone,
            "email": payload.email,
            "address": payload.address,
            "updated_at": utcnow().isoformat()
        }},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Supplier tidak ditemukan")
    return res

@router.delete("/api/suppliers/{sup_id}")
async def delete_supplier(sup_id: str, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    res = await db.suppliers.delete_one({"id": sup_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier tidak ditemukan")
    return {"ok": True}

# ---------- Purchase Orders (Pro-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/purchase/orders", response_model=List[PurchaseOrder])
async def list_purchase_orders(user: dict = Depends(require_plan("pro"))):
    db = get_db()
    cursor = db.purchase_orders.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)

@router.post("/api/purchase/orders", response_model=PurchaseOrder)
async def create_purchase_order(payload: PurchaseOrderCreate, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "po_no": payload.po_no,
        "supplier_id": payload.supplier_id,
        "supplier_name": payload.supplier_name,
        "total": payload.total,
        "status": payload.status,
        "created_at": utcnow().isoformat()
    }
    await db.purchase_orders.insert_one(doc)

    # Kirim PO ke WhatsApp supplier (best-effort; BYO WABA, tak membatalkan PO bila gagal).
    # Diinisiasi toko -> wajib template. TEMPLATE_PO_NAME_DEFAULT belum disetujui Meta --
    # lihat TEMPLATE_PO_BODY_ID di whatsapp_client.py untuk teks yang perlu diajukan.
    try:
        from whatsapp_client import (
            get_wa_config, send_meta_message,
            TEMPLATE_PO_NAME_DEFAULT, TEMPLATE_PO_LANG_DEFAULT,
        )
        wa = await get_wa_config(db, user["store_id"])
        if wa.get("is_active"):
            sup = await db.suppliers.find_one({"id": payload.supplier_id, "store_id": user["store_id"]})
            phone = (sup or {}).get("phone")
            if phone:
                settings = await db.settings.find_one({"store_id": user["store_id"]}, {"_id": 0})
                store_name = ((settings or {}).get("general") or {}).get("store_name") or user.get("store_name") or "Toko"
                total_str = f"{int(round(payload.total or 0)):,}".replace(",", ".")
                template_name = wa.get("template_po") or TEMPLATE_PO_NAME_DEFAULT
                template_lang = wa.get("template_po_lang") or TEMPLATE_PO_LANG_DEFAULT
                params = [payload.po_no, store_name, payload.supplier_name, total_str, payload.status]
                doc["whatsapp"] = await send_meta_message(wa, phone, template_name, params, lang=template_lang)
    except Exception:
        pass

    doc.pop("_id", None)
    return doc

# ---------- Goods Receiving (Pro-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/purchase/receiving", response_model=List[GoodsReceiving])
async def list_receiving(user: dict = Depends(require_plan("pro"))):
    db = get_db()
    cursor = db.goods_receiving.find({"store_id": user["store_id"]}, {"_id": 0}).sort("received_at", -1)
    return await cursor.to_list(length=100)

@router.post("/api/purchase/receiving", response_model=GoodsReceiving)
async def create_receiving(payload: GoodsReceivingCreate, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "po_no": payload.po_no,
        "gr_no": payload.gr_no,
        "received_by": payload.received_by,
        "received_at": payload.received_at
    }
    await db.goods_receiving.insert_one(doc)
    
    # Auto-update PO status to "Received"
    await db.purchase_orders.update_one(
        {"store_id": user["store_id"], "po_no": payload.po_no},
        {"$set": {"status": "Received"}}
    )
    
    doc.pop("_id", None)
    return doc

# ---------- Supplier Invoices (Pro-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/purchase/invoices", response_model=List[SupplierInvoice])
async def list_supplier_invoices(user: dict = Depends(require_plan("pro"))):
    db = get_db()
    cursor = db.supplier_invoices.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)

@router.post("/api/purchase/invoices", response_model=SupplierInvoice)
async def create_supplier_invoice(payload: SupplierInvoiceCreate, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "invoice_no": payload.invoice_no,
        "po_no": payload.po_no,
        "amount": payload.amount,
        "status": payload.status,
        "due_date": payload.due_date,
        "created_at": utcnow().isoformat()
    }
    await db.supplier_invoices.insert_one(doc)
    
    # Auto-create a matching debt payable record if invoice is unpaid
    if payload.status.lower() != "paid":
        po = await db.purchase_orders.find_one({"store_id": user["store_id"], "po_no": payload.po_no})
        supplier_name = po.get("supplier_name", "Supplier") if po else "Supplier"
        payable_doc = {
            "id": str(uuid.uuid4()),
            "store_id": user["store_id"],
            "supplier_name": supplier_name,
            "invoice_no": payload.invoice_no,
            "amount": payload.amount,
            "paid_amount": 0.0,
            "due_date": payload.due_date,
            "status": "Unpaid"
        }
        await db.debt_payables.insert_one(payable_doc)

    doc.pop("_id", None)
    return doc

@router.put("/api/purchase/invoices/{invoice_id}", response_model=SupplierInvoice)
async def update_supplier_invoice(invoice_id: str, payload: SupplierInvoiceUpdate, user: dict = Depends(require_plan("pro"))):
    """Mark a supplier invoice paid/unpaid (or otherwise partially update it).

    HISTORY: this endpoint didn't exist -- the frontend's 'Tandai Lunas' button POSTed
    {id, status: 'Paid'} straight to the CREATE endpoint above, which ignores 'id' entirely
    and requires invoice_no/po_no/amount/due_date that were never sent, so it 422'd with no
    .catch() on the frontend (silent failure). Found while mirroring this session's DapurOS
    debt-CRUD fix -- same bug, same fix, mirrored back here.
    """
    db = get_db()
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    res = await db.supplier_invoices.find_one_and_update(
        {"id": invoice_id, "store_id": user["store_id"]},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Faktur tidak ditemukan")

    # Keep the auto-created debt_payable record (see create_supplier_invoice above) in sync --
    # otherwise marking the invoice paid leaves a stale "Unpaid" payable behind forever.
    if update.get("status", "").lower() == "paid":
        await db.debt_payables.update_many(
            {"store_id": user["store_id"], "invoice_no": res["invoice_no"], "status": {"$ne": "Paid"}},
            {"$set": {"status": "Paid", "paid_amount": res["amount"]}},
        )
    return res
