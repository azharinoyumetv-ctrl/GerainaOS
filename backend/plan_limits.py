"""Plan capacity limits (Starter/Pro/Business caps).

SYNC: KEEP IN SYNC with DapurOS/backend/plan_limits.py -- two separate backends share the
same numeric caps from the pricing repackaging spec, so any change here must be mirrored
there (DapurOS additionally has max_tables, which GerainaOS's tiers don't carry).

check_capacity() blocks creating one more of a resource (staff, products) once a store's
plan-based cap is reached. check_outlet_capacity() does the same for branches, accounting
for the store's own base location counting as outlet #1.

Existing records over a cap are never touched, deactivated, or hidden -- this only blocks
NEW creation once a store is at/over its limit. A missing/unrecognized plan is treated as
"starter" (the most restrictive tier), matching the fail-closed default already used for
the nav lock icons in AppLayout.jsx.

Device/seat capacity ("max_devices") is enforced the same way, but not from this module --
see routes_devices.py, which calls check_capacity() against the real `devices` collection
on registration.
"""
from fastapi import HTTPException
from routes_pricing import TIERS

_TIER_BY_ID = {t["id"]: t for t in TIERS}


def _tier_for(plan):
    return _TIER_BY_ID.get(plan) or _TIER_BY_ID["starter"]


async def check_capacity(db, store_id: str, plan: str, collection: str, field: str):
    """Raise 403 if the store is already at its plan's cap for `field` (e.g. "max_employees")
    on `collection` (e.g. "staff"). None/missing cap on the tier means unlimited."""
    tier = _tier_for(plan)
    cap = tier.get(field)
    if cap is None:
        return
    count = await db[collection].count_documents({"store_id": store_id})
    if count >= cap:
        raise HTTPException(
            status_code=403,
            detail=f"Batas paket {tier.get('name', 'Anda')} tercapai ({cap}). Upgrade paket untuk menambah lagi.",
        )


async def check_outlet_capacity(db, store_id: str, plan: str):
    """Raise 403 if adding one more branch would exceed the plan's max_outlets. The store's
    own base location always counts as outlet #1, so the `branches` collection may hold at
    most (cap - 1) additional records."""
    tier = _tier_for(plan)
    cap = tier.get("max_outlets")
    if cap is None:
        return
    count = await db.branches.count_documents({"store_id": store_id})
    if count + 1 >= cap:
        raise HTTPException(
            status_code=403,
            detail=f"Batas outlet paket {tier.get('name', 'Anda')} tercapai ({cap} outlet). Tambah outlet lewat add-on atau upgrade paket.",
        )
