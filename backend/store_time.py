"""Store calendar boundaries, independent from the phone or server timezone."""
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


async def store_zone(db,store_id):
    settings=await db.settings.find_one({'store_id':store_id},{'_id':0,'general.timezone':1}) or {}
    value=str((settings.get('general') or {}).get('timezone') or 'Asia/Jakarta')
    if value.startswith('WITA'):
        value='Asia/Makassar'
    elif value.startswith('WIT') and not value.startswith('WIB'):
        value='Asia/Jayapura'
    elif value.startswith('WIB'):
        value='Asia/Jakarta'
    try:
        return ZoneInfo(value)
    except (ZoneInfoNotFoundError,ValueError):
        return ZoneInfo('Asia/Jakarta')
