"""Reports use actual persisted business data.

New sale lines carry immutable unit_cost snapshots. Legacy missing costs are
reported as unknown, never recomputed from today's product cost. Inventory
turnover still uses current stock as an explicitly labelled approximation;
periodic inventory snapshots are not available for historical average stock.
"""
from permissions import require_permission
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db, utcnow
from models import Expense, ExpenseCreate
from auth import get_current_user
from plan_limits import require_plan
from paging import encode_cursor, decode_cursor
from store_time import store_zone

router = APIRouter(prefix="/api", tags=["reports"])

MONTH_LABELS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


@router.get('/reports/inventory/dead-stock', dependencies=[Depends(require_permission('inventory.read'))])
async def report_dead_stock(user: dict = Depends(require_plan('pro')), cursor: Optional[str] = None,
                            limit: int = Query(50, ge=1, le=100)):
    now = utcnow().astimezone(timezone.utc)
    after = None
    if cursor:
        value = decode_cursor(cursor, ['id', 'as_of'])
        try:
            end = datetime.fromisoformat(value['as_of'].replace('Z', '+00:00'))
            if end.tzinfo is None or end > now:
                raise ValueError()
            end = end.astimezone(timezone.utc)
        except (ValueError, TypeError):
            raise HTTPException(400, 'Periode halaman tidak valid. Muat ulang laporan.')
        after = value['id']
    else:
        end = now
    start = end - timedelta(days=30)
    db = get_db()
    # Order writers (including offline replay) persist UTC ISO timestamps.
    # Aggregate all settled sales in this rolling window, never a recent-order
    # sample. Keep the window fixed while moving between report pages.
    sold = await db.orders.aggregate([
        {'$match': {'store_id': user['store_id'], 'payment_status': 'paid',
                    'created_at': {'$gte': start.isoformat(), '$lte': end.isoformat()}}},
        {'$unwind': '$items'},
        {'$match': {'items.quantity': {'$gt': 0}}},
        {'$group': {'_id': '$items.product_id'}},
    ]).to_list(length=None)
    ids = [row['_id'] for row in sold if isinstance(row.get('_id'), str)]
    scope = {'store_id': user['store_id'], 'stock': {'$gt': 0}, 'id': {'$nin': ids}}
    query = dict(scope)
    if after:
        query['id'] = {**scope['id'], '$gt': after}
    rows = await db.products.find(query, {'_id': 0}).sort('id', 1).limit(limit + 1).to_list(length=limit + 1)
    items, more = rows[:limit], len(rows) > limit
    return {'items': items, 'total': await db.products.count_documents(scope), 'days': 30,
            'window_start': start.isoformat(), 'window_end': end.isoformat(),
            'next_cursor': encode_cursor({'id': items[-1]['id'], 'as_of': end.isoformat()}) if more else None}


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


# ---------- Expenses (part of the Pro-tier Laporan module -- see AppLayout.jsx minPlan) ----------
@router.get("/expenses", dependencies=[Depends(require_permission("reports.read"))])
async def list_expenses(
    user: dict = Depends(require_plan("pro")),
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


@router.post("/expenses", dependencies=[Depends(require_permission("reports.write"))])
async def create_expense(payload: ExpenseCreate, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    expense = Expense(**payload.model_dump(), store_id=user["store_id"], created_by=user.get("email"))
    doc = expense.model_dump()
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/expenses/{expense_id}", dependencies=[Depends(require_permission("reports.write"))])
async def delete_expense(expense_id: str, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    res = await db.expenses.delete_one({"id": expense_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pengeluaran tidak ditemukan")
    return {"ok": True}


# ---------- Profit (Laba Rugi) ----------
@router.get("/reports/profit", dependencies=[Depends(require_permission("reports.read"))])
async def report_profit(user: dict = Depends(require_plan("pro")), months: int = Query(6, ge=1, le=24)):
    db = get_db()
    store_id = user["store_id"]
    zone = await store_zone(db, store_id)
    now = utcnow().astimezone(zone)

    buckets = []
    y, m = now.year, now.month
    for i in range(months - 1, -1, -1):
        yy, mm = y, m - i
        while mm <= 0:
            mm += 12
            yy -= 1
        buckets.append((yy, mm))
    earliest_year, earliest_month = buckets[0]
    range_start = datetime(earliest_year, earliest_month, 1, tzinfo=zone).astimezone(timezone.utc)

    monthly = {b: {'revenue':0.0,'cost':0.0,'unknown':False} for b in buckets}
    unknown_orders, estimated_orders = 0, 0
    async for order in db.orders.find(
        {'store_id':store_id,'payment_status':'paid','created_at':{'$gte':range_start.isoformat(),'$lte':utcnow().isoformat()}},
        {'_id':0,'items':1,'total':1,'created_at':1}):
        dt = _parse_iso(order.get('created_at'))
        if not dt:
            continue
        dt = dt.astimezone(zone)
        key = (dt.year,dt.month)
        if key not in monthly:
            continue
        monthly[key]['revenue'] += order.get('total') or 0
        unknown, estimated = False, False
        for line in order.get('items',[]):
            if line.get('unit_cost') is None:
                unknown = True
                continue
            monthly[key]['cost'] += line['unit_cost'] * line.get('quantity',0)
            estimated = estimated or line.get('cost_snapshot_source') in ('sync_time','offline_catalogue')
        if unknown:
            monthly[key]['unknown'] = True
            unknown_orders += 1
        if estimated:
            estimated_orders += 1

    expenses = db.expenses.find(
        {"store_id": store_id, "expense_date": {"$gte": f"{earliest_year:04d}-{earliest_month:02d}-01"}},
        {"_id": 0, "amount": 1, "expense_date": 1},
    )

    monthly_opex = {b: 0.0 for b in buckets}
    async for e in expenses:
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
            "cost": None if monthly[b]["unknown"] else round(cogs, 2),
            "operating_expenses": round(opex, 2),
            "profit": None if monthly[b]["unknown"] else round(net, 2),
        })
        totals["revenue"] += revenue
        totals["cogs"] += cogs
        totals["operating_expenses"] += opex
        totals["gross_profit"] += gross
        totals["net_profit"] += net

    values = {k:round(v,2) for k,v in totals.items()}
    if unknown_orders:
        for field in ('cogs','gross_profit','net_profit'):
            values[field] = None
    return {'series':series,'totals':values,'cost_complete':not unknown_orders,
            'unknown_cost_orders':unknown_orders,'estimated_cost_orders':estimated_orders,'timezone':str(zone),
            'cost_policy':'snapshot_at_sale',
            'notice':f'{unknown_orders} transaksi lama tidak memiliki snapshot HPP. Laba tidak ditampilkan untuk menghindari perkiraan dari harga modal saat ini.' if unknown_orders else ''}


# ---------- Cashflow (Arus Kas) ----------
@router.get("/reports/cashflow", dependencies=[Depends(require_permission("reports.read"))])
async def report_cashflow(user: dict = Depends(require_plan("pro")), weeks: int = Query(4, ge=1, le=12)):
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
@router.get("/reports/inventory/turnover", dependencies=[Depends(require_permission("reports.read"))])
async def report_inventory_turnover(user: dict = Depends(require_plan("pro")), days: int = Query(30, ge=1, le=365)):
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
