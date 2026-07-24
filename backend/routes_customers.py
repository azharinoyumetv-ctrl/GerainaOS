"""Customer CRM, Memberships, Loyalty Rules, and Debt Receivables/Payables routes."""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import (
    Customer, CustomerBase, Membership, MembershipBase, LoyaltyRules,
    DebtReceivable, DebtReceivableCreate, DebtReceivableUpdate,
    DebtPayable, DebtPayableCreate, DebtPayableUpdate
)
from auth import get_current_user
from plan_limits import require_plan

router = APIRouter(tags=["customers_debt"])

# ---------- Customers ----------
@router.get("/api/customers", response_model=List[Customer])
async def list_customers(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.customers.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=200)

@router.post("/api/customers", response_model=Customer)
async def create_customer(payload: CustomerBase, user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db.customers.find_one({"store_id": user["store_id"], "phone": payload.phone} if payload.phone else {"_id": None})
    if existing:
        raise HTTPException(status_code=400, detail="Nomor telepon pelanggan sudah ada")
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "phone": payload.phone,
        "email": payload.email,
        "membership_tier": payload.membership_tier or "Bronze",
        "loyalty_points": payload.loyalty_points or 0,
        "notes": payload.notes,
        "created_at": utcnow().isoformat()
    }
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/api/customers/{cust_id}", response_model=Customer)
async def update_customer(cust_id: str, payload: CustomerBase, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.customers.find_one_and_update(
        {"id": cust_id, "store_id": user["store_id"]},
        {"$set": {
            "name": payload.name,
            "phone": payload.phone,
            "email": payload.email,
            "membership_tier": payload.membership_tier,
            "loyalty_points": payload.loyalty_points,
            "notes": payload.notes
        }},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    return res

@router.delete("/api/customers/{cust_id}")
async def delete_customer(cust_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.customers.delete_one({"id": cust_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    return {"ok": True}

# ---------- Memberships (Business-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/customers/memberships", response_model=List[Membership])
async def list_memberships(user: dict = Depends(require_plan("business"))):
    db = get_db()
    cursor = db.memberships.find({"store_id": user["store_id"]}, {"_id": 0}).sort("min_points", 1)
    return await cursor.to_list(length=100)

@router.post("/api/customers/memberships", response_model=Membership)
async def create_membership(payload: MembershipBase, user: dict = Depends(require_plan("business"))):
    db = get_db()
    existing = await db.memberships.find_one({"store_id": user["store_id"], "name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Membership tier sudah ada")
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "min_points": payload.min_points,
        "discount_percent": payload.discount_percent,
        "description": payload.description
    }
    await db.memberships.insert_one(doc)
    doc.pop("_id", None)
    return doc

# ---------- Loyalty Rules (Business-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/customers/loyalty", response_model=LoyaltyRules)
async def get_loyalty_rules(user: dict = Depends(require_plan("business"))):
    db = get_db()
    rules = await db.loyalty_rules.find_one({"store_id": user["store_id"]}, {"_id": 0})
    if not rules:
        # Return default rules
        return LoyaltyRules()
    return rules

@router.post("/api/customers/loyalty", response_model=LoyaltyRules)
async def save_loyalty_rules(payload: LoyaltyRules, user: dict = Depends(require_plan("business"))):
    db = get_db()
    doc = payload.model_dump()
    doc["store_id"] = user["store_id"]
    await db.loyalty_rules.find_one_and_replace(
        {"store_id": user["store_id"]},
        doc,
        upsert=True
    )
    return payload

# ---------- Debt Receivables (Piutang) -- Pro-tier feature, see AppLayout.jsx minPlan ----------
@router.get("/api/debt/receivables", response_model=List[DebtReceivable])
async def list_receivables(user: dict = Depends(require_plan("pro"))):
    db = get_db()
    cursor = db.debt_receivables.find({"store_id": user["store_id"]}, {"_id": 0})
    return await cursor.to_list(length=100)

@router.post("/api/debt/receivables", response_model=DebtReceivable)
async def create_receivable(payload: DebtReceivableCreate, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "customer_name": payload.customer_name,
        "phone": payload.phone,
        "order_no": payload.order_no,
        "amount": payload.amount,
        "paid_amount": payload.paid_amount,
        "due_date": payload.due_date,
        "status": payload.status
    }
    await db.debt_receivables.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/api/debt/receivables/{receivable_id}", response_model=DebtReceivable)
async def update_receivable(receivable_id: str, payload: DebtReceivableUpdate, user: dict = Depends(require_plan("pro"))):
    """Record a payment/settlement against an existing receivable (partial or full)."""
    db = get_db()
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    res = await db.debt_receivables.find_one_and_update(
        {"id": receivable_id, "store_id": user["store_id"]},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Catatan piutang tidak ditemukan")
    return res

# ---------- Debt Payables (Hutang) -- Pro-tier feature, see AppLayout.jsx minPlan ----------
@router.get("/api/debt/payables", response_model=List[DebtPayable])
async def list_payables(user: dict = Depends(require_plan("pro"))):
    db = get_db()
    cursor = db.debt_payables.find({"store_id": user["store_id"]}, {"_id": 0})
    return await cursor.to_list(length=100)

@router.post("/api/debt/payables", response_model=DebtPayable)
async def create_payable(payload: DebtPayableCreate, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "supplier_name": payload.supplier_name,
        "invoice_no": payload.invoice_no,
        "amount": payload.amount,
        "paid_amount": payload.paid_amount,
        "due_date": payload.due_date,
        "status": payload.status
    }
    await db.debt_payables.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/api/debt/payables/{payable_id}", response_model=DebtPayable)
async def update_payable(payable_id: str, payload: DebtPayableUpdate, user: dict = Depends(require_plan("pro"))):
    """Record a payment/settlement against an existing payable (partial or full)."""
    db = get_db()
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    res = await db.debt_payables.find_one_and_update(
        {"id": payable_id, "store_id": user["store_id"]},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Catatan hutang tidak ditemukan")
    return res
