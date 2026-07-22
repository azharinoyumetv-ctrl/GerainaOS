"""Registered device management (real device/seat capacity per plan).

SYNC: KEEP IN SYNC with DapurOS/backend/routes_devices.py.

Replaces the previous LicenseDevices.jsx page, which rendered a hardcoded mock array with
no backend behind it at all -- not acceptable for a live production app. A "device" here is
a self-registered browser/terminal slot: the frontend generates a UUID on first load,
persists it in localStorage, and registers it against the store. Re-registering the same
device_id (page reload, re-click) updates the existing row instead of consuming another
capacity slot. Capacity is enforced via plan_limits.check_capacity against the tier's
max_devices.
"""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import Device, DeviceCreate
from auth import get_current_user

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("", response_model=List[Device])
async def list_devices(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.devices.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", 1)
    return await cursor.to_list(length=200)


@router.post("", response_model=Device)
async def register_device(payload: DeviceCreate, user: dict = Depends(get_current_user)):
    db = get_db()

    existing = await db.devices.find_one({"store_id": user["store_id"], "device_id": payload.device_id})
    if existing:
        res = await db.devices.find_one_and_update(
            {"id": existing["id"]},
            {"$set": {
                "name": payload.name,
                "user_agent": payload.user_agent,
                "last_seen_at": utcnow().isoformat(),
            }},
            return_document=True,
            projection={"_id": 0},
        )
        return res

    from plan_limits import check_capacity
    await check_capacity(db, user["store_id"], user.get("plan"), "devices", "max_devices")

    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "device_id": payload.device_id,
        "name": payload.name,
        "user_agent": payload.user_agent,
        "status": "Aktif",
        "created_at": utcnow().isoformat(),
        "last_seen_at": utcnow().isoformat(),
    }
    await db.devices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/{device_id}")
async def remove_device(device_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.devices.delete_one({"id": device_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Perangkat tidak ditemukan")
    return {"ok": True}
