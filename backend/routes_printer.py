"""Printer Mode B (Jaringan / ESC-POS network) endpoints.

The backend only builds the ESC/POS byte payload -- it cannot deliver it to a printer on the
store's LAN (see escpos.py docstring for why). The frontend fetches the base64 payload here
and forwards it to a local printer-bridge running on the store's own PC, which does the actual
raw TCP write to the printer.
"""
import base64
from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from auth import get_current_user
from escpos import build_sample_escpos, build_receipt_escpos

router = APIRouter(prefix="/api/printer", tags=["printer"])


@router.get("/test-escpos")
async def printer_test_escpos(user: dict = Depends(get_current_user)):
    db = get_db()
    settings = await db.settings.find_one({"store_id": user["store_id"]}, {"_id": 0})
    data = build_sample_escpos(settings or {})
    return {"data_base64": base64.b64encode(data).decode("ascii"), "byte_length": len(data)}


@router.get("/orders/{order_id}/escpos")
async def order_receipt_escpos(order_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"id": order_id, "store_id": user["store_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    settings = await db.settings.find_one({"store_id": user["store_id"]}, {"_id": 0})
    data = build_receipt_escpos(order, settings or {})
    return {"data_base64": base64.b64encode(data).decode("ascii"), "byte_length": len(data)}
