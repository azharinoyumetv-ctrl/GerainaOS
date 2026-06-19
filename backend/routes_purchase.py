"""Purchase management routes (Suppliers, Purchase Orders, Goods Receiving, Invoices)."""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import (
    Supplier, SupplierBase, PurchaseOrder, PurchaseOrderCreate,
    GoodsReceiving, GoodsReceivingCreate, SupplierInvoice, SupplierInvoiceCreate
)
from auth import get_current_user

router = APIRouter(tags=["purchase"])

# ---------- Suppliers ----------
@router.get("/api/suppliers", response_model=List[Supplier])
async def list_suppliers(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.suppliers.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=100)

@router.post("/api/suppliers", response_model=Supplier)
async def create_supplier(payload: SupplierBase, user: dict = Depends(get_current_user)):
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
async def update_supplier(sup_id: str, payload: SupplierBase, user: dict = Depends(get_current_user)):
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
async def delete_supplier(sup_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.suppliers.delete_one({"id": sup_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier tidak ditemukan")
    return {"ok": True}

# ---------- Purchase Orders ----------
@router.get("/api/purchase/orders", response_model=List[PurchaseOrder])
async def list_purchase_orders(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.purchase_orders.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)

@router.post("/api/purchase/orders", response_model=PurchaseOrder)
async def create_purchase_order(payload: PurchaseOrderCreate, user: dict = Depends(get_current_user)):
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
    doc.pop("_id", None)
    return doc

# ---------- Goods Receiving ----------
@router.get("/api/purchase/receiving", response_model=List[GoodsReceiving])
async def list_receiving(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.goods_receiving.find({"store_id": user["store_id"]}, {"_id": 0}).sort("received_at", -1)
    return await cursor.to_list(length=100)

@router.post("/api/purchase/receiving", response_model=GoodsReceiving)
async def create_receiving(payload: GoodsReceivingCreate, user: dict = Depends(get_current_user)):
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

# ---------- Supplier Invoices ----------
@router.get("/api/purchase/invoices", response_model=List[SupplierInvoice])
async def list_supplier_invoices(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.supplier_invoices.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)

@router.post("/api/purchase/invoices", response_model=SupplierInvoice)
async def create_supplier_invoice(payload: SupplierInvoiceCreate, user: dict = Depends(get_current_user)):
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
