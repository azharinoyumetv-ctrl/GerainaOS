"""Staff and Attendance logging routes."""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import Staff, StaffBase, Attendance, AttendanceCreate
from auth import get_current_user

router = APIRouter(tags=["staff"])

# ---------- Staff ----------
@router.get("/api/staff", response_model=List[Staff])
async def list_staff(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.staff.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=100)

@router.post("/api/staff", response_model=Staff)
async def create_staff(payload: StaffBase, user: dict = Depends(get_current_user)):
    db = get_db()
    from plan_limits import check_capacity
    await check_capacity(db, user["store_id"], user.get("plan"), "staff", "max_employees")
    existing = await db.staff.find_one({"store_id": user["store_id"], "email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email staff sudah terdaftar")
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "email": payload.email,
        "role": payload.role,
        "phone": payload.phone,
        "status": payload.status,
        "created_at": utcnow().isoformat()
    }
    await db.staff.insert_one(doc)
    
    # Also auto-create a user login credential in the users collection with a default password (e.g. geraina123)
    from auth import hash_password
    user_existing = await db.users.find_one({"email": payload.email})
    if not user_existing:
        user_doc = {
            "id": doc["id"],
            "email": payload.email,
            "password_hash": hash_password("geraina123"),
            "role": payload.role,
            "store_id": user["store_id"],
            "store_name": user.get("store_name", "Toko Anda"),
            "trial_ends_at": user.get("trial_ends_at"),
            "plan": user.get("plan", "trial"),
            "created_at": utcnow().isoformat(),
        }
        await db.users.insert_one(user_doc)
        
    doc.pop("_id", None)
    return doc

@router.put("/api/staff/{staff_id}", response_model=Staff)
async def update_staff(staff_id: str, payload: StaffBase, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.staff.find_one_and_update(
        {"id": staff_id, "store_id": user["store_id"]},
        {"$set": {
            "name": payload.name,
            "email": payload.email,
            "role": payload.role,
            "phone": payload.phone,
            "status": payload.status
        }},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Staff tidak ditemukan")
    
    # Keep users collection role in sync
    await db.users.update_one(
        {"id": staff_id},
        {"$set": {"role": payload.role, "email": payload.email}}
    )
    
    return res

@router.delete("/api/staff/{staff_id}")
async def delete_staff(staff_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.staff.delete_one({"id": staff_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff tidak ditemukan")
    # Clean up corresponding user record
    await db.users.delete_one({"id": staff_id})
    return {"ok": True}

# ---------- Attendance ----------
@router.get("/api/attendance", response_model=List[Attendance])
async def list_attendance(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.attendance.find({"store_id": user["store_id"]}, {"_id": 0}).sort("clock_in", -1)
    return await cursor.to_list(length=100)

@router.post("/api/attendance", response_model=Attendance)
async def log_attendance(payload: AttendanceCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "staff_name": payload.staff_name,
        "clock_in": payload.clock_in,
        "clock_out": payload.clock_out,
        "status": payload.status
    }
    await db.attendance.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/api/attendance/{att_id}", response_model=Attendance)
async def update_attendance(att_id: str, user: dict = Depends(get_current_user)):
    """Clock-out: update an existing attendance record with clock_out time."""
    db = get_db()
    from bson import ObjectId
    id_or_oid = [att_id]
    try:
        id_or_oid.append(ObjectId(att_id))
    except Exception:
        pass
    res = await db.attendance.find_one_and_update(
        {"store_id": user["store_id"], "$or": [{"id": {"$in": id_or_oid}}, {"_id": {"$in": id_or_oid}}]},
        {"$set": {"clock_out": utcnow().isoformat()}},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Data absensi tidak ditemukan")
    return res

