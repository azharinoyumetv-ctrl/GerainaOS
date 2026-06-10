"""Product CRUD + bulk Excel/CSV import."""
import io
import uuid
from typing import List, Optional
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query

from database import get_db, utcnow
from models import ProductCreate, ProductUpdate, BulkImportResult
from auth import get_current_user

router = APIRouter(prefix="/api/products", tags=["products"])


def _strip_id(p: dict) -> dict:
    p.pop("_id", None)
    return p


@router.get("")
async def list_products(
    user: dict = Depends(get_current_user),
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = 500,
):
    db = get_db()
    flt = {"store_id": user["store_id"]}
    if q:
        flt["name"] = {"$regex": q, "$options": "i"}
    if category and category != "all":
        flt["category"] = category
    cursor = db.products.find(flt, {"_id": 0}).sort("name", 1).limit(limit)
    return await cursor.to_list(length=limit)


@router.get("/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    db = get_db()
    cats = await db.products.distinct("category", {"store_id": user["store_id"]})
    return [c for c in cats if c]


@router.post("")
async def create_product(payload: ProductCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(),
        **payload.model_dump(),
    }
    await db.products.insert_one(doc)
    return _strip_id(doc)


@router.put("/{product_id}")
async def update_product(product_id: str, payload: ProductUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    update["updated_at"] = utcnow().isoformat()
    res = await db.products.find_one_and_update(
        {"id": product_id, "store_id": user["store_id"]},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return res


@router.delete("/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.products.delete_one({"id": product_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return {"ok": True}


@router.post("/bulk-import", response_model=BulkImportResult)
async def bulk_import(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Import dari Excel (.xlsx) atau CSV.

    Kolom wajib: name, price
    Kolom opsional: sku, cost, stock, category, unit, description, image_url, active
    """
    db = get_db()
    contents = await file.read()
    fname = (file.filename or "").lower()
    try:
        if fname.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        elif fname.endswith(".xlsx") or fname.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Format file harus .csv, .xls, atau .xlsx")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal membaca file: {e}")

    df.columns = [str(c).strip().lower() for c in df.columns]
    if "name" not in df.columns or "price" not in df.columns:
        raise HTTPException(status_code=400, detail="Kolom 'name' dan 'price' wajib ada")

    inserted = updated = skipped = 0
    errors: List[str] = []
    for idx, row in df.iterrows():
        try:
            name = str(row.get("name") or "").strip()
            if not name or name.lower() == "nan":
                skipped += 1
                continue
            price = float(row.get("price") or 0)
            doc = {
                "name": name,
                "sku": str(row["sku"]).strip() if "sku" in df.columns and pd.notna(row.get("sku")) else None,
                "price": price,
                "cost": float(row.get("cost") or 0) if "cost" in df.columns and pd.notna(row.get("cost")) else 0,
                "stock": int(row.get("stock") or 0) if "stock" in df.columns and pd.notna(row.get("stock")) else 0,
                "category": str(row.get("category") or "Umum") if "category" in df.columns and pd.notna(row.get("category")) else "Umum",
                "unit": str(row.get("unit") or "pcs") if "unit" in df.columns and pd.notna(row.get("unit")) else "pcs",
                "description": str(row.get("description")) if "description" in df.columns and pd.notna(row.get("description")) else None,
                "image_url": str(row.get("image_url")) if "image_url" in df.columns and pd.notna(row.get("image_url")) else None,
                "active": bool(row.get("active")) if "active" in df.columns and pd.notna(row.get("active")) else True,
                "store_id": user["store_id"],
                "updated_at": utcnow().isoformat(),
            }

            # Upsert by SKU within store, else insert new
            existing = None
            if doc["sku"]:
                existing = await db.products.find_one({"store_id": user["store_id"], "sku": doc["sku"]})

            if existing:
                await db.products.update_one({"id": existing["id"]}, {"$set": doc})
                updated += 1
            else:
                doc["id"] = str(uuid.uuid4())
                doc["created_at"] = utcnow().isoformat()
                await db.products.insert_one(doc)
                inserted += 1
        except Exception as e:
            errors.append(f"Baris {int(idx)+2}: {e}")

    return BulkImportResult(inserted=inserted, updated=updated, skipped=skipped, errors=errors[:20])


@router.get("/import-template.csv")
async def import_template():
    """Plain CSV template for bulk import."""
    from fastapi.responses import PlainTextResponse
    text = "name,sku,price,cost,stock,category,unit,description,active\n"
    text += "Es Kopi Susu Gula Aren,GR-CFE-001,22000,9000,100,Minuman,cup,Signature kopi susu,true\n"
    text += "Croissant Coklat,GR-BRD-002,20000,8000,30,Roti,pcs,Croissant isi coklat belgia,true\n"
    return PlainTextResponse(text, media_type="text/csv")
