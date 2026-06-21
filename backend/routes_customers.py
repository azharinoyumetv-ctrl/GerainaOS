"""Customer CRM, Memberships, Loyalty Rules, and Debt Receivables/Payables routes."""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import (
    Customer, CustomerBase, Membership, MembershipBase, LoyaltyRules,
    DebtReceivable, DebtReceivableCreate, DebtPayable, DebtPayableCreate
)
from auth import get_current_user

router = APIRouter(tags=["customers_debt"])

# ---------- Customers ----------
@router.get("/api/customers", response_model=List[Customer])
async def list_customers(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.customers.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    res = await cursor.to_list(length=200)
    for r in res:
        r["loyaltyPoints"] = r.get("loyalty_points", 0)
    return res

@router.post("/api/customers", response_model=Customer)
async def create_customer(payload: CustomerBase, user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db.customers.find_one({"store_id": user["store_id"], "phone": payload.phone} if payload.phone else {"_id": None})
    if existing:
        raise HTTPException(status_code=400, detail="Nomor telepon pelanggan sudah ada")
    pts = payload.loyaltyPoints if payload.loyaltyPoints is not None else (payload.loyalty_points or 0)
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "phone": payload.phone,
        "email": payload.email,
        "membership_tier": payload.membership_tier or "Bronze",
        "loyalty_points": pts,
        "loyaltyPoints": pts,
        "notes": payload.notes,
        "created_at": utcnow().isoformat()
    }
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/api/customers/{cust_id}", response_model=Customer)
async def update_customer(cust_id: str, payload: CustomerBase, user: dict = Depends(get_current_user)):
    db = get_db()
    pts = payload.loyaltyPoints if payload.loyaltyPoints is not None else (payload.loyalty_points or 0)
    res = await db.customers.find_one_and_update(
        {"id": cust_id, "store_id": user["store_id"]},
        {"$set": {
            "name": payload.name,
            "phone": payload.phone,
            "email": payload.email,
            "membership_tier": payload.membership_tier,
            "loyalty_points": pts,
            "notes": payload.notes
        }},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    res["loyaltyPoints"] = res.get("loyalty_points", 0)
    return res

@router.delete("/api/customers/{cust_id}")
async def delete_customer(cust_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.customers.delete_one({"id": cust_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    return {"ok": True}

# ---------- Memberships ----------
@router.get("/api/customers/memberships", response_model=List[Membership])
async def list_memberships(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.memberships.find({"store_id": user["store_id"]}, {"_id": 0}).sort("min_points", 1)
    return await cursor.to_list(length=100)

@router.post("/api/customers/memberships", response_model=Membership)
async def create_membership(payload: MembershipBase, user: dict = Depends(get_current_user)):
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

# ---------- Loyalty Rules ----------
@router.get("/api/customers/loyalty", response_model=LoyaltyRules)
async def get_loyalty_rules(user: dict = Depends(get_current_user)):
    db = get_db()
    rules = await db.loyalty_rules.find_one({"store_id": user["store_id"]}, {"_id": 0})
    if not rules:
        # Return default rules
        return LoyaltyRules()
    return rules

@router.post("/api/customers/loyalty", response_model=LoyaltyRules)
async def save_loyalty_rules(payload: LoyaltyRules, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = payload.model_dump()
    doc["store_id"] = user["store_id"]
    await db.loyalty_rules.find_one_and_replace(
        {"store_id": user["store_id"]},
        doc,
        upsert=True
    )
    return payload

# ---------- Debt Receivables (Piutang) ----------
@router.get("/api/debt/receivables", response_model=List[DebtReceivable])
async def list_receivables(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.debt_receivables.find({"store_id": user["store_id"]}, {"_id": 0})
    return await cursor.to_list(length=100)

@router.post("/api/debt/receivables", response_model=DebtReceivable)
async def create_receivable(payload: DebtReceivableCreate, user: dict = Depends(get_current_user)):
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

# ---------- Debt Payables (Hutang) ----------
@router.get("/api/debt/payables", response_model=List[DebtPayable])
async def list_payables(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.debt_payables.find({"store_id": user["store_id"]}, {"_id": 0})
    return await cursor.to_list(length=100)

@router.post("/api/debt/payables", response_model=DebtPayable)
async def create_payable(payload: DebtPayableCreate, user: dict = Depends(get_current_user)):
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
