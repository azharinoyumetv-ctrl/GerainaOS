"""Reporting endpoints: profit (Laba Rugi), cashflow (Arus Kas), inventory turnover, and
expense CRUD. Numbers here are computed from the real orders/products/expenses collections --
no hardcoded demo series like the frontend used to render.

Two known simplifications, documented rather than hidden:
  1. COGS uses each product's CURRENT `cost` field, not a snapshot of cost-at-time-of-sale
     (order line items don't persist a cost snapshot). If a product's cost changes, past
     months' COGS shifts too when recomputed. Fine for a first cut; revisit if exact
     historical COGS matters later (would need to snapshot cost onto each order item).
  2. Inventory turnover uses CURRENT stock value as a stand-in for "average inventory value"
     over the period, since no periodic stock snapshots are kept. A real average-inventory
     turnover calculation would need those snapshots, which don't exist yet.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db
from models import Expense, ExpenseCreate
from auth import get_current_user

router = APIRouter(prefix="/api", tags=["reports"])

MONTH_LABELS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        pass
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        return None


# ---------- Expenses ----------
@router.get("/expenses")
async def list_expenses(
    user: dict = Depends(get_current_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    db = get_db()
    flt = {"store_id": user["store_id"]}
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to
        flt["expense_date"] = rng
    cursor = db.expenses.find(flt, {"_id": 0}).sort("expense_date", -1)
    return await cursor.to_list(length=500)


@router.post("/expenses")
async def create_expense(payload: ExpenseCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    expense = Expense(**payload.model_dump(), store_id=user["store_id"], created_by=user.get("email"))
    doc = expense.model_dump()
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.expenses.delete_one({"id": expense_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pengeluaran tidak ditemukan")
    return {"ok": True}


# ---------- Profit (Laba Rugi) ----------
@router.get("/reports/profit")
async def report_profit(user: dict = Depends(get_current_user), months: int = Query(6, ge=1, le=24)):
    db = get_db()
    store_id = user["store_id"]
    now = datetime.now(timezone.utc)

    buckets = []
    y, m = now.year, now.month
    for i in range(months - 1, -1, -1):
        yy, mm = y, m - i
        while mm <= 0:
            mm += 12
            yy -= 1
        buckets.append((yy, mm))
    earliest_year, earliest_month = buckets[0]
    range_start = datetime(earliest_year, earliest_month, 1, tzinfo=timezone.utc)

    orders = await db.orders.find(
        {"store_id": store_id, "payment_status": "paid", "created_at": {"$gte": range_start.isoformat()}},
        {"_id": 0, "items": 1, "total": 1, "created_at": 1},
    ).to_list(length=100000)

    cost_by_id = {}
    async for p in db.products.find({"store_id": store_id}, {"_id": 0, "id": 1, "cost": 1}):
        cost_by_id[p["id"]] = p.get("cost") or 0

    monthly = {b: {"revenue": 0.0, "cost": 0.0} for b in buckets}
    for o in orders:
        dt = _parse_iso(o.get("created_at"))
        if not dt:
            continue
        key = (dt.year, dt.month)
        if key not in monthly:
            continue
        monthly[key]["revenue"] += o.get("total") or 0
        for it in o.get("items", []):
            monthly[key]["cost"] += cost_by_id.get(it.get("product_id"), 0) * (it.get("quantity") or 0)

    expenses = await db.expenses.find(
        {"store_id": store_id, "expense_date": {"$gte": f"{earliest_year:04d}-{earliest_month:02d}-01"}},
        {"_id": 0, "amount": 1, "expense_date": 1},
    ).to_list(length=100000)

    monthly_opex = {b: 0.0 for b in buckets}
    for e in expenses:
        d = str(e.get("expense_date") or "")
        try:
            key = (int(d[0:4]), int(d[5:7]))
        except Exception:
            continue
        if key in monthly_opex:
            monthly_opex[key] += e.get("amount") or 0

    series = []
    totals = {"revenue": 0.0, "cogs": 0.0, "operating_expenses": 0.0, "gross_profit": 0.0, "net_profit": 0.0}
    for b in buckets:
        yy, mm = b
        revenue = monthly[b]["revenue"]
        cogs = monthly[b]["cost"]
        opex = monthly_opex[b]
        gross = revenue - cogs
        net = gross - opex
        series.append({
            "month": MONTH_LABELS_ID[mm - 1],
            "year": yy,
            "revenue": round(revenue, 2),
            "cost": round(cogs, 2),
            "operating_expenses": round(opex, 2),
            "profit": round(net, 2),
        })
        totals["revenue"] += revenue
        totals["cogs"] += cogs
        totals["operating_expenses"] += opex
        totals["gross_profit"] += gross
        totals["net_profit"] += net

    return {"series": series, "totals": {k: round(v, 2) for k, v in totals.items()}}


# ---------- Cashflow (Arus Kas) ----------
@router.get("/reports/cashflow")
async def report_cashflow(user: dict = Depends(get_current_user), weeks: int = Query(4, ge=1, le=12)):
    db = get_db()
    store_id = user["store_id"]
    now = datetime.now(timezone.utc)
    range_start = now - timedelta(weeks=weeks)

    orders = await db.orders.find(
        {"store_id": store_id, "payment_status": "paid", "created_at": {"$gte": range_start.isoformat()}},
        {"_id": 0, "total": 1, "created_at": 1},
    ).to_list(length=100000)

    expenses = await db.expenses.find(
        {"store_id": store_id, "expense_date": {"$gte": range_start.date().isoformat()}},
        {"_id": 0, "amount": 1, "expense_date": 1},
    ).to_list(length=100000)

    buckets = []
    for i in range(weeks - 1, -1, -1):
        end = now - timedelta(weeks=i)
        start = end - timedelta(weeks=1)
        buckets.append((start, end))

    def bucket_index(dt):
        for idx, (start, end) in enumerate(buckets):
            if idx == len(buckets) - 1:
                if start <= dt <= end:
                    return idx
            elif start <= dt < end:
                return idx
        return None

    inflow = [0.0] * weeks
    outflow = [0.0] * weeks
    for o in orders:
        dt = _parse_iso(o.get("created_at"))
        if not dt:
            continue
        idx = bucket_index(dt)
        if idx is not None:
            inflow[idx] += o.get("total") or 0
    for e in expenses:
        dt = _parse_iso(e.get("expense_date"))
        if not dt:
            continue
        idx = bucket_index(dt)
        if idx is not None:
            outflow[idx] += e.get("amount") or 0

    series = [
        {"name": f"Minggu {i + 1}", "inflow": round(inflow[i], 2), "outflow": round(outflow[i], 2)}
        for i in range(weeks)
    ]
    return {"series": series}


# ---------- Inventory turnover ----------
@router.get("/reports/inventory/turnover")
async def report_inventory_turnover(user: dict = Depends(get_current_user), days: int = Query(30, ge=1, le=365)):
    db = get_db()
    store_id = user["store_id"]
    now = datetime.now(timezone.utc)
    range_start = now - timedelta(days=days)

    orders = await db.orders.find(
        {"store_id": store_id, "payment_status": "paid", "created_at": {"$gte": range_start.isoformat()}},
        {"_id": 0, "items": 1},
    ).to_list(length=100000)

    products = await db.products.find({"store_id": store_id}, {"_id": 0, "id": 1, "cost": 1, "stock": 1}).to_list(length=100000)
    cost_by_id = {p["id"]: (p.get("cost") or 0) for p in products}
    current_inventory_value = sum((p.get("cost") or 0) * (p.get("stock") or 0) for p in products)

    cogs_period = 0.0
    for o in orders:
        for it in o.get("items", []):
            cogs_period += cost_by_id.get(it.get("product_id"), 0) * (it.get("quantity") or 0)

    turnover_ratio_period = (cogs_period / current_inventory_value) if current_inventory_value > 0 else None
    turnover_ratio_monthly_est = (
        turnover_ratio_period * (30 / days) if turnover_ratio_period is not None else None
    )

    return {
        "period_days": days,
        "cogs_period": round(cogs_period, 2),
        "current_inventory_value": round(current_inventory_value, 2),
        "turnover_ratio_period": round(turnover_ratio_period, 3) if turnover_ratio_period is not None else None,
        "turnover_ratio_monthly_est": round(turnover_ratio_monthly_est, 3) if turnover_ratio_monthly_est is not None else None,
    }
