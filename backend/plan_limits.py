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

require_plan() below is a separate, third kind of gate: per-*module* authorization (does this
plan include this feature at all), as opposed to check_capacity()'s per-*record-count* gate
(how many of a feature the plan allows). It's the backend half of the plan-locked nav icons in
AppLayout.jsx -- that lock icon only stops nav-clicks; require_plan() is what stops a direct
URL/API call from reaching a locked module regardless of how the request got there.
"""
from fastapi import Depends, HTTPException
from auth import get_current_user
from routes_pricing import TIERS

_TIER_BY_ID = {t["id"]: t for t in TIERS}

# SYNC: KEEP IN SYNC with PLAN_RANK in frontend/src/layouts/AppLayout.jsx and
# frontend/src/components/RoleGuard.jsx -- trial ranks as business-equivalent everywhere,
# matching the pricing page's own claim that the 14-day trial grants full Business access.
# "expired" (set by auth._maybe_expire_trial once trial_ends_at passes) ranks below starter
# so it never accidentally reads as "has at least starter access" anywhere that forgets to
# check for it explicitly -- though in practice auth.get_current_user() 402s an expired
# account before any of these checks run at all; this is defense in depth, not the real gate.
PLAN_RANK = {"expired": -1, "starter": 0, "pro": 1, "business": 2, "trial": 2}


def plan_rank(plan):
    return PLAN_RANK.get(plan, 0)


def _tier_for(plan):
    return _TIER_BY_ID.get(plan) or _TIER_BY_ID["starter"]


def require_plan(min_plan: str):
    """FastAPI dependency factory: 403s if the caller's plan ranks below `min_plan`, otherwise
    behaves exactly like Depends(get_current_user) (returns the same user dict) -- so it's a
    drop-in replacement for `Depends(get_current_user)` on any route that's entirely gated
    behind one plan floor. For routes that need BOTH an existing Depends (e.g. require_admin)
    AND a plan check, don't swap the Depends -- call plan_rank(user.get("plan")) inline in the
    function body instead (see save_integrations for an example)."""
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if plan_rank(user.get("plan")) < plan_rank(min_plan):
            tier = _tier_for(min_plan)
            raise HTTPException(
                status_code=403,
                detail=f"Fitur ini tersedia mulai paket {tier.get('name', min_plan)}. Upgrade paket untuk mengakses fitur ini.",
            )
        return user
    return _dep


async def _active_addon_counts(db, store_id: str) -> dict:
    """Count ACTIVE (staff-approved) addon purchases per addon_id for a store. Pending/rejected
    requests grant nothing yet -- see routes_pricing.py's purchase_addon() for why activation is
    a manual step (no subscription payment gateway wired to this app's own billing, same
    reason /pricing/upgrade records paid-tier changes as pending instead of granting instantly)."""
    counts = {}
    async for doc in db.addon_purchases.find({"store_id": store_id, "status": "active"}, {"_id": 0, "addon_id": 1}):
        counts[doc["addon_id"]] = counts.get(doc["addon_id"], 0) + 1
    return counts


def _addon_bonus(counts: dict, field: str) -> int:
    """Extra capacity granted by active addons, matching ADDONS' own descriptions in
    routes_pricing.py: extra_device = +1 device each; extra_outlet bundles +1 outlet, +5
    devices, +15 employee seats each ("termasuk 5 device & 15 akun karyawan")."""
    extra_device = counts.get("extra_device", 0)
    extra_outlet = counts.get("extra_outlet", 0)
    if field == "max_devices":
        return extra_device + extra_outlet * 5
    if field == "max_employees":
        return extra_outlet * 15
    return 0


async def check_capacity(db, store_id: str, plan: str, collection: str, field: str):
    """Raise 403 if the store is already at its plan's cap (plus any active addon bonus) for
    `field` (e.g. "max_employees") on `collection` (e.g. "staff"). None/missing cap on the tier
    means unlimited."""
    tier = _tier_for(plan)
    cap = tier.get(field)
    if cap is None:
        return
    counts = await _active_addon_counts(db, store_id)
    cap += _addon_bonus(counts, field)
    count = await db[collection].count_documents({"store_id": store_id})
    if count >= cap:
        raise HTTPException(
            status_code=403,
            detail=f"Batas paket {tier.get('name', 'Anda')} tercapai ({cap}). Upgrade paket atau beli add-on untuk menambah lagi.",
        )


async def check_outlet_capacity(db, store_id: str, plan: str):
    """Raise 403 if adding one more branch would exceed the plan's max_outlets (plus any active
    extra_outlet addons). The store's own base location always counts as outlet #1, so the
    `branches` collection may hold at most (cap - 1) additional records."""
    tier = _tier_for(plan)
    cap = tier.get("max_outlets")
    if cap is None:
        return
    counts = await _active_addon_counts(db, store_id)
    cap += counts.get("extra_outlet", 0)
    count = await db.branches.count_documents({"store_id": store_id})
    if count + 1 >= cap:
        raise HTTPException(
            status_code=403,
            detail=f"Batas outlet paket {tier.get('name', 'Anda')} tercapai ({cap} outlet). Tambah outlet lewat add-on atau upgrade paket.",
        )
