"""EDC (kartu debit/kredit via mesin EDC bank) endpoints. See edc_provider.py for the
pluggable provider architecture and why no bank is actually wired in yet."""
from fastapi import APIRouter, Depends, HTTPException

from database import get_db, utcnow
from auth import get_current_user
from edc_provider import get_edc_provider, BANK_LABELS

router = APIRouter(prefix="/api/edc", tags=["edc"])


@router.get("/providers")
async def list_edc_providers(user: dict = Depends(get_current_user)):
    """Bank options available in Settings > Pembayaran > EDC. All currently unconfigured --
    see edc_provider.py docstring for why (each needs its own SDK + bank certification)."""
    return [{"id": pid, "label": label, "status": "not_configured"} for pid, label in BANK_LABELS.items()]


@router.post("/orders/{order_id}/charge")
async def charge_order_via_edc(order_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"id": order_id, "store_id": user["store_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order ini sudah lunas")

    prior_status = order.get("payment_status")

    # Atomically claim the order before charging: without this, two concurrent requests
    # (double-click, a client retry after a slow/timed-out response) can both pass the
    # "not yet paid" check above and both charge the card. The filter below can only match
    # for one of them -- MongoDB serializes the update, so the second caller gets None back
    # and is rejected instead of charging twice.
    claimed = await db.orders.find_one_and_update(
        {"id": order_id, "store_id": user["store_id"], "payment_status": {"$nin": ["paid", "charging"]}},
        {"$set": {"payment_status": "charging", "updated_at": utcnow().isoformat()}},
    )
    if not claimed:
        raise HTTPException(status_code=409, detail="Transaksi EDC untuk order ini sedang diproses atau sudah lunas")

    payments_config = await db.payments_config.find_one({"store_id": user["store_id"]}, {"_id": 0})
    edc_cfg = (payments_config or {}).get("edc") or {}
    if not edc_cfg.get("is_active") or not edc_cfg.get("provider"):
        await db.orders.update_one({"id": order_id, "store_id": user["store_id"]}, {"$set": {"payment_status": prior_status}})
        # 400, not 502: this is an ordinary "not configured" business outcome, not a gateway
        # failure. Cloudflare intercepts and replaces 502/504/52x responses from the origin
        # with its own generic error page, which silently swallowed this exact message in
        # production (TestSprite caught it as "invalid or incomplete response to Cloudflare").
        raise HTTPException(status_code=400, detail="EDC belum dikonfigurasi. Atur provider bank di Pengaturan > Pembayaran > EDC.")

    provider = get_edc_provider(edc_cfg.get("provider"))
    result = await provider.charge(amount=int(round(order.get("total") or 0)), order_ref=order.get("order_no") or order_id)

    if not result.success:
        # Release the claim so the order can be retried instead of getting stuck in "charging".
        await db.orders.update_one({"id": order_id, "store_id": user["store_id"]}, {"$set": {"payment_status": prior_status}})
        raise HTTPException(status_code=400, detail=result.error or "Transaksi EDC gagal.")

    await db.orders.update_one(
        {"id": order_id, "store_id": user["store_id"]},
        {"$set": {
            "payment_status": "paid",
            "edc_provider": result.provider,
            "edc_transaction_id": result.transaction_id,
            "edc_approval_code": result.approval_code,
            "edc_card_type": result.card_type,
            "edc_last4": result.last4,
            "updated_at": utcnow().isoformat(),
        }},
    )
    updated = await db.orders.find_one({"id": order_id, "store_id": user["store_id"]}, {"_id": 0})
    return updated
