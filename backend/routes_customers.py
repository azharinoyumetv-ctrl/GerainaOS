from list_metadata import legacy_list_metadata
"""Customer CRM, Memberships, Loyalty Rules, and Debt Receivables/Payables routes."""
from permissions import require_permission
import uuid
import transactions
from debt_service import settlement, set_payment
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response
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
@router.get("/api/customers", response_model=List[Customer], dependencies=[Depends(require_permission("customers.read"))])
async def list_customers(user: dict = Depends(get_current_user), response: Response = None):
    db = get_db()
    await legacy_list_metadata(response,db,'customers',user['store_id'],'customers',200)
    cursor = db.customers.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=200)

@router.post("/api/customers", response_model=Customer, dependencies=[Depends(require_permission("customers.write"))])
async def create_customer(payload: CustomerBase, user: dict = Depends(get_current_user)):
    db = get_db()
    if payload.loyalty_points and user.get('role') not in ('Owner','admin','Manager'):
        raise HTTPException(403, 'Koreksi poin hanya untuk Owner atau Manager.')
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

@router.put("/api/customers/{cust_id}", response_model=Customer, dependencies=[Depends(require_permission("customers.write"))])
async def update_customer(cust_id: str, payload: CustomerBase, user: dict = Depends(get_current_user)):
    db=get_db()
    async def update(session):
        scope={'id':cust_id,'store_id':user['store_id']}
        existing=await db.customers.find_one(scope,session=session)
        if not existing:
            raise HTTPException(404,'Pelanggan tidak ditemukan.')
        old_points=existing.get('loyalty_points',0)
        if payload.loyalty_points!=old_points:
            if user.get('role') not in ('Owner','admin','Manager'):
                raise HTTPException(403,'Koreksi poin hanya untuk Owner atau Manager. Segarkan data pelanggan.')
            if payload.expected_loyalty_points is None or payload.expected_loyalty_points!=old_points:
                raise HTTPException(409,'Poin berubah. Segarkan data sebelum melakukan koreksi.')
        if payload.phone and await db.customers.find_one({'store_id':user['store_id'],'phone':payload.phone,'id':{'$ne':cust_id}},session=session):
            raise HTTPException(409,'Nomor telepon sudah digunakan pelanggan lain.')
        values={key:value for key,value in payload.model_dump().items() if key!='expected_loyalty_points'}
        await db.customers.update_one(scope,{'$set':values},session=session)
        if payload.loyalty_points!=old_points:
            await db.loyalty_events.insert_one({'id':str(uuid.uuid4()),'store_id':user['store_id'],'customer_id':cust_id,
                 'type':'manual_correction','previous_points':old_points,'points':payload.loyalty_points,'actor_id':user['id'],
                 'created_at':utcnow().isoformat()},session=session)
        return {**existing,**values}
    return await transactions.run_transaction(db,update)

@router.delete("/api/customers/{cust_id}", dependencies=[Depends(require_permission("customers.manage"))])
async def delete_customer(cust_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.customers.delete_one({"id": cust_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    return {"ok": True}

# ---------- Memberships (Business-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/customers/memberships", response_model=List[Membership], dependencies=[Depends(require_permission("customers.read"))])
async def list_memberships(user: dict = Depends(require_plan("business")), response: Response = None):
    db = get_db()
    await legacy_list_metadata(response,db,'memberships',user['store_id'],'memberships',100)
    cursor = db.memberships.find({"store_id": user["store_id"]}, {"_id": 0}).sort("min_points", 1)
    return await cursor.to_list(length=100)

@router.post("/api/customers/memberships", response_model=Membership, dependencies=[Depends(require_permission("customers.write"))])
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
@router.get("/api/customers/loyalty", response_model=LoyaltyRules, dependencies=[Depends(require_permission("customers.read"))])
async def get_loyalty_rules(user: dict = Depends(require_plan("business"))):
    db = get_db()
    rules = await db.loyalty_rules.find_one({"store_id": user["store_id"]}, {"_id": 0})
    if not rules:
        # Return default rules
        return LoyaltyRules()
    return rules

@router.post("/api/customers/loyalty", response_model=LoyaltyRules, dependencies=[Depends(require_permission("customers.write"))])
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
@router.get("/api/debt/receivables", response_model=List[DebtReceivable], dependencies=[Depends(require_permission("debt.read"))])
async def list_receivables(user: dict = Depends(require_plan("pro")), response: Response = None):
    db = get_db()
    await legacy_list_metadata(response,db,'debt_receivables',user['store_id'],'receivables',100)
    cursor = db.debt_receivables.find({"store_id": user["store_id"]}, {"_id": 0})
    return await cursor.to_list(length=100)

@router.post("/api/debt/receivables", response_model=DebtReceivable, dependencies=[Depends(require_permission("debt.write"))])
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
        "status": settlement(payload.amount, payload.paid_amount)
    }
    await db.debt_receivables.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put('/api/debt/receivables/{receivable_id}', response_model=DebtReceivable, dependencies=[Depends(require_permission('debt.write'))])
async def update_receivable(receivable_id: str, payload: DebtReceivableUpdate, user: dict = Depends(require_plan('pro'))):
    if payload.paid_amount is None:
        raise HTTPException(422, 'Isi nominal pembayaran kumulatif.')
    db = get_db()
    async def update(session):
        return await set_payment(db,'debt_receivables',receivable_id,user,payload.paid_amount,session,payload.status,payload.expected_paid_amount)
    return await transactions.run_transaction(db, update)


# ---------- Debt Payables (Hutang) -- Pro-tier feature, see AppLayout.jsx minPlan ----------
@router.get("/api/debt/payables", response_model=List[DebtPayable], dependencies=[Depends(require_permission("debt.read"))])
async def list_payables(user: dict = Depends(require_plan("pro")), response: Response = None):
    db = get_db()
    await legacy_list_metadata(response,db,'debt_payables',user['store_id'],'payables',100)
    cursor = db.debt_payables.find({"store_id": user["store_id"]}, {"_id": 0})
    return await cursor.to_list(length=100)

@router.post("/api/debt/payables", response_model=DebtPayable, dependencies=[Depends(require_permission("debt.write"))])
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
        "status": settlement(payload.amount, payload.paid_amount)
    }
    await db.debt_payables.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put('/api/debt/payables/{payable_id}', response_model=DebtPayable, dependencies=[Depends(require_permission('debt.write'))])
async def update_payable(payable_id: str, payload: DebtPayableUpdate, user: dict = Depends(require_plan('pro'))):
    if payload.paid_amount is None:
        raise HTTPException(422, 'Isi nominal pembayaran kumulatif.')
    db = get_db()
    async def update(session):
        return await set_payment(db,'debt_payables',payable_id,user,payload.paid_amount,session,payload.status,payload.expected_paid_amount)
    return await transactions.run_transaction(db, update)
