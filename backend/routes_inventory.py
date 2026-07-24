"""Inventory and Product metadata routes (Categories, Brands, Units, Adjustments, Transfers)."""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import (
    Category, CategoryBase, Brand, BrandBase, Unit, UnitBase,
    StockAdjustment, StockAdjustmentCreate, StockTransfer, StockTransferCreate
)
from auth import get_current_user
from plan_limits import require_plan

router = APIRouter(prefix="/api/products", tags=["inventory"])

# ---------- Categories ----------
@router.get("/categories", response_model=List[Category])
async def list_categories(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.categories.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=100)

@router.post("/categories", response_model=Category)
async def create_category(payload: CategoryBase, user: dict = Depends(get_current_user)):
    db = get_db()
    # Check if exists
    existing = await db.categories.find_one({"store_id": user["store_id"], "name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Kategori sudah ada")
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "description": payload.description,
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat()
    }
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/categories/{cat_id}", response_model=Category)
async def update_category(cat_id: str, payload: CategoryBase, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.categories.find_one_and_update(
        {"id": cat_id, "store_id": user["store_id"]},
        {"$set": {"name": payload.name, "description": payload.description, "updated_at": utcnow().isoformat()}},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    return res

@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.categories.delete_one({"id": cat_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    return {"ok": True}

# ---------- Brands ----------
@router.get("/brands", response_model=List[Brand])
async def list_brands(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.brands.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=100)

@router.post("/brands", response_model=Brand)
async def create_brand(payload: BrandBase, user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db.brands.find_one({"store_id": user["store_id"], "name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Brand sudah ada")
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "description": payload.description,
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat()
    }
    await db.brands.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/brands/{brand_id}", response_model=Brand)
async def update_brand(brand_id: str, payload: BrandBase, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.brands.find_one_and_update(
        {"id": brand_id, "store_id": user["store_id"]},
        {"$set": {"name": payload.name, "description": payload.description, "updated_at": utcnow().isoformat()}},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Brand tidak ditemukan")
    return res

@router.delete("/brands/{brand_id}")
async def delete_brand(brand_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.brands.delete_one({"id": brand_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Brand tidak ditemukan")
    return {"ok": True}

# ---------- Units ----------
@router.get("/units", response_model=List[Unit])
async def list_units(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.units.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=100)

@router.post("/units", response_model=Unit)
async def create_unit(payload: UnitBase, user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db.units.find_one({"store_id": user["store_id"], "name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Unit sudah ada")
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "short_name": payload.short_name,
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat()
    }
    await db.units.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/units/{unit_id}", response_model=Unit)
async def update_unit(unit_id: str, payload: UnitBase, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.units.find_one_and_update(
        {"id": unit_id, "store_id": user["store_id"]},
        {"$set": {"name": payload.name, "short_name": payload.short_name, "updated_at": utcnow().isoformat()}},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Unit tidak ditemukan")
    return res

@router.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.units.delete_one({"id": unit_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Unit tidak ditemukan")
    return {"ok": True}

# ---------- Stock Adjustments ----------
@router.get("/stock-adjustments", response_model=List[StockAdjustment])
async def list_adjustments(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.stock_adjustments.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)

@router.post("/stock-adjustments", response_model=StockAdjustment)
async def create_adjustment(payload: StockAdjustmentCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "product_name": payload.product_name,
        "sku": payload.sku,
        "adjustment_qty": payload.adjustment_qty,
        "type": payload.type,
        "reason": payload.reason,
        "created_by": payload.created_by,
        "created_at": utcnow().isoformat()
    }
    await db.stock_adjustments.insert_one(doc)
    
    # Update actual product stock if product is matched by SKU
    if payload.sku:
        diff = payload.adjustment_qty if payload.type == "add" else -payload.adjustment_qty
        await db.products.update_one(
            {"store_id": user["store_id"], "sku": payload.sku},
            {"$inc": {"stock": diff}}
        )
        
    doc.pop("_id", None)
    return doc

# ---------- Stock Transfers (Business-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/stock-transfers", response_model=List[StockTransfer])
async def list_transfers(user: dict = Depends(require_plan("business"))):
    db = get_db()
    cursor = db.stock_transfers.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)

@router.post("/stock-transfers", response_model=StockTransfer)
async def create_transfer(payload: StockTransferCreate, user: dict = Depends(require_plan("business"))):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "from_branch": payload.from_branch,
        "to_branch": payload.to_branch,
        "items": [item.model_dump() for item in payload.items],
        "status": payload.status,
        "created_at": utcnow().isoformat()
    }
    await db.stock_transfers.insert_one(doc)
    doc.pop("_id", None)
    return doc
