"""Add-on prices and finite capacity cycles; independent of payment/UI routing."""
from datetime import datetime, timezone
from database import utcnow

CATALOG = {
    'extra_device': {'id': 'extra_device', 'name': 'Device kasir tambahan', 'price_idr': 49000, 'plan': 'pro', 'limit': 2, 'unit': '/bulan, khusus Pro (maks 2 device)'},
    'extra_outlet': {'id': 'extra_outlet', 'name': 'Outlet tambahan', 'price_idr': 149000, 'plan': 'business', 'limit': None, 'unit': '/bulan, khusus Business — termasuk 5 device & 15 akun karyawan'},
}

def date(value):
    try:
        result = value if isinstance(value, datetime) else datetime.fromisoformat(value)
        return result if result.tzinfo else result.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None

def unexpired(doc, now=None):
    now = now or utcnow()
    if doc.get('status') != 'active': return False
    if not doc.get('expires_at'): return doc.get('source') != 'verified_checkout'  # preserve old manual grants
    end = date(doc['expires_at'])
    return end is not None and end > now

def usable(doc, now=None):
    now = now or utcnow()
    start = date(doc.get('starts_at'))
    return unexpired(doc, now) and (not doc.get('starts_at') or start is not None and start <= now)

async def active_counts(db, store_id, plan=None):
    groups = {}
    async for row in db.addon_purchases.find({'store_id': store_id, 'status': 'active'}):
        addon = CATALOG.get(row.get('addon_id'))
        if not addon or plan is not None and addon['plan'] != plan or not usable(row): continue
        groups.setdefault(addon['id'], set()).add(str(row.get('entitlement_id') or row.get('id') or row['_id']))
    return {key: len(ids) for key, ids in groups.items()}
