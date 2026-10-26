"""POS / Orders routes."""
from permissions import require_permission
import os
import uuid
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header

from database import get_db, utcnow, next_order_no
from models import OrderCreate, Order, OrderLineItem
from auth import get_current_user, require_admin
from plan_limits import require_plan
from xendit_client import create_qris, create_ewallet_charge
from doku_client import create_doku_checkout, DokuNotConfiguredError
from bank_qris import BankQrisConfirmation, bank_qris_snapshot
from decimal import Decimal, ROUND_HALF_UP
from store_time import store_zone
import hashlib
import json
import httpx
import transactions
from pymongo.errors import DuplicateKeyError
from xendit_client import PaymentNotConfiguredError
from stock_ledger import movement
from sale_effects import customer_for_sale, apply_loyalty
from paging import encode_cursor, decode_cursor
from payment_options import require_payment_method

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get('/history', dependencies=[Depends(require_permission('sales.read'))])
async def order_history(user: dict = Depends(get_current_user), q: str = Query('', max_length=200),
                        status: Optional[str] = None, cursor: Optional[str] = None,
                        limit: int = Query(50, ge=1, le=100)):
    if status and status not in ('paid', 'pending', 'failed', 'voided'):
        raise HTTPException(400, 'Filter status tidak valid.')
    scope = {'store_id': user['store_id']}
    if status:
        scope['payment_status'] = status
    if q.strip():
        scope['order_no'] = {'$regex': re.escape(q.strip()), '$options': 'i'}
    query = dict(scope)
    if cursor:
        value = decode_cursor(cursor, ['created_at', 'id'])
        query['$or'] = [{'created_at': {'$lt': value['created_at']}},
                        {'created_at': value['created_at'], 'id': {'$lt': value['id']}}]
    db = get_db()
    rows = await db.orders.find(query, {'_id': 0}).sort([('created_at', -1), ('id', -1)]).limit(limit + 1).to_list(length=limit + 1)
    more, items = len(rows) > limit, rows[:limit]
    return {'items': items, 'total': await db.orders.count_documents(scope),
            'next_cursor': encode_cursor({key: items[-1][key] for key in ('created_at', 'id')}) if more else None}


@router.get('/resolve', dependencies=[Depends(require_permission('sales.read'))])
async def resolve_order(reference: str = Query(min_length=1, max_length=200), user: dict = Depends(get_current_user)):
    order = await get_db().orders.find_one({'store_id': user['store_id'], '$or': [{'id': reference}, {'order_no': reference}]}, {'_id': 0})
    if not order:
        raise HTTPException(404, 'Transaksi tidak ditemukan di toko akun ini.')
    # The reference locates a record; gateway status/amount in a return URL is never trusted.
    return order


def public_order(doc):
    return {key: value for key, value in doc.items() if key not in ('_id', 'request_hash', 'offline_request_hash')}


def _calc(order):
    subtotal = sum((Decimal(str(i.subtotal)) for i in order.items), Decimal(0))
    discount = Decimal(str(order.discount))
    if discount > subtotal:
        raise HTTPException(422, 'Diskon melebihi subtotal.')
    base = subtotal - discount
    tax = (base * Decimal(str(order.tax_percent)) / 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    if subtotal > Decimal('1000000000000') or base + tax > Decimal('1000000000000'):
        raise HTTPException(422, 'Nominal transaksi melebihi batas yang didukung.')
    return {'subtotal': float(subtotal), 'discount': float(discount), 'tax_amount': float(tax), 'total': float(base + tax)}


def gateway_failure(error, detail):
    definite = isinstance(error, (PaymentNotConfiguredError, DokuNotConfiguredError)) or (
        isinstance(error, httpx.HTTPStatusError) and 400 <= error.response.status_code < 500)
    return HTTPException(400 if definite else 409, detail=detail,
                         headers={} if definite else {'X-Payment-Uncertain': '1'})


async def initialize_gateway(payload, user, db, doc):
    order_no, order_id = doc['order_no'], doc['id']
    calc = doc
    integ = await db.integrations.find_one({'store_id': user['store_id']}, {'_id': 0}) or {}
    if payload.payment_method == "qris":
        xendit_cfg = (integ or {}).get("xendit") or {}
        try:
            res = await create_qris(cfg=xendit_cfg, external_id=order_no, amount=int(round(calc["total"])))
        except Exception as e:
            # 400, not 502: this is a "not configured / gateway declined" business outcome,
            # not an actual gateway failure. Cloudflare intercepts 502/504/52x responses from
            # the origin and replaces them with its own generic error page, which silently
            # swallows this message in production (same class of bug as the EDC endpoint --
            # see routes_edc.py).
            raise gateway_failure(e, f"QRIS belum dikonfigurasi atau gagal membuat kode QR ({e}). Atur Xendit di Pengaturan > Integrasi.")
        # v3 Payment Request API: id is payment_request_id, not id -- and QR string lives
        # in an actions[] entry (already flattened onto res["qr_string"] by
        # create_qris). Defensive .get()s throughout: the gateway has already committed
        # by this point, so a response-shape surprise must never lose the order (same
        # lesson as the DOKU incident earlier this session).
        doc["xendit_id"] = res.get("payment_request_id") or res.get("id")
        doc["xendit_reference_id"] = order_no
        doc["xendit_qr_string"] = res.get("qr_string")
        doc["xendit_raw"] = res
    elif payload.payment_method == "ewallet":
        if not payload.ewallet_channel:
            raise HTTPException(status_code=400, detail="ewallet_channel wajib untuk e-wallet")
        xendit_cfg = (integ or {}).get("xendit") or {}
        try:
            res = await create_ewallet_charge(
                cfg=xendit_cfg,
                reference_id=order_no,
                amount=int(round(calc["total"])),
                channel_code=payload.ewallet_channel,
                customer_phone=payload.customer_phone,
                customer_email=payload.customer_email,
            )
        except Exception as e:
            raise gateway_failure(e, f"E-Wallet belum dikonfigurasi atau gagal memulai pembayaran ({e}). Atur Xendit di Pengaturan > Integrasi.")
        # Same v3 shape as QRIS above -- checkout_url already flattened by
        # create_ewallet_charge from the actions[] entry.
        doc["xendit_id"] = res.get("payment_request_id") or res.get("id")
        doc["xendit_reference_id"] = order_no
        doc["xendit_checkout_url"] = res.get("checkout_url")
        doc["xendit_raw"] = res
    elif payload.payment_method == "doku":
        doku_cfg = (integ or {}).get("doku") or {}
        return_url = f'https://dagangos.com/geraina/app/sales?order={order_id}'
        try:
            res = await create_doku_checkout(
                cfg=doku_cfg,
                order_id=order_no,
                amount=int(round(calc["total"])),
                callback_url=return_url,
                callback_url_result=return_url,
                customer_name=payload.customer_name,
                customer_email=payload.customer_email,
                customer_phone=payload.customer_phone,
            )
        except DokuNotConfiguredError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise gateway_failure(e, f"DOKU gagal membuat pembayaran ({e}). Atur DOKU di Pengaturan > Integrasi.")
        # From this point DOKU has already committed the transaction on its own side
        # (invoice created, may already have emailed the customer a payment link) --
        # nothing below may raise and lose the order, or GerainaOS ends up with a real
        # pending DOKU payment with zero local record (the webhook later no-ops silently
        # since there's no matching order_no to update). Parse defensively: an
        # unexpected response shape must degrade to missing fields, never an exception.
        doku_payment: dict = {}
        try:
            resp_block = res.get("response") if isinstance(res, dict) else None
            if isinstance(resp_block, dict) and isinstance(resp_block.get("payment"), dict):
                doku_payment = resp_block["payment"]
            elif isinstance(res, dict) and isinstance(res.get("payment"), dict):
                doku_payment = res["payment"]
        except Exception:
            doku_payment = {}
        doc["doku_id"] = (res["order"].get("invoice_number") if isinstance(res, dict) and isinstance(res.get("order"), dict) else None) or order_no
        doc["doku_token_id"] = doku_payment.get("token_id")
        doc["doku_checkout_url"] = doku_payment.get("url") or doku_payment.get("checkout_url")
        doc["doku_raw"] = res

    return doc


async def deliver_receipt(payload, user, db, doc):
    order_no, calc = doc['order_no'], doc
    # Auto-kirim struk ke WhatsApp pelanggan (best-effort; toggle "Kirim Struk Otomatis").
    # Diinisiasi toko -> wajib template. Pakai template KUSTOM dagangos_order_receipt (Bahasa
    # Indonesia, tanpa tombol CTA, 4 parameter teks biasa) -- lihat TEMPLATE_RECEIPT_* di
    # whatsapp_client.py. Belum disetujui Meta pada saat kode ini ditulis; ajukan lewat Meta
    # Business Manager sebelum ini benar-benar bisa mengirim.
    try:
        if payload.customer_phone:
            from whatsapp_client import (
                get_wa_config, send_meta_message,
                TEMPLATE_RECEIPT_NAME_DEFAULT, TEMPLATE_RECEIPT_LANG_DEFAULT,
            )
            wa = await get_wa_config(db, user["store_id"])
            if wa.get("is_active"):
                settings = await db.settings.find_one({"store_id": user["store_id"]}, {"_id": 0})
                store_name = ((settings or {}).get("general") or {}).get("store_name") or user.get("store_name") or "Toko"
                total_str = f"{int(round(calc['total'])):,}".replace(",", ".")
                method_labels = {"cash": "Tunai", "qris": "QRIS", "qris_bank": "QRIS bank", "ewallet": "E-Wallet", "card": "Kartu"}
                payment_method_label = method_labels.get(payload.payment_method, payload.payment_method or "-")
                template_name = wa.get("template_receipt") or TEMPLATE_RECEIPT_NAME_DEFAULT
                template_lang = wa.get("template_receipt_lang") or TEMPLATE_RECEIPT_LANG_DEFAULT
                params = [order_no, store_name, total_str, payment_method_label]
                doc["whatsapp"] = await send_meta_message(wa, payload.customer_phone, template_name, params, lang=template_lang)
    except Exception:
        pass



@router.post('', dependencies=[Depends(require_permission('pos.use'))])
async def create_order(payload: OrderCreate, user: dict = Depends(get_current_user),
                       idempotency_key: Optional[str] = Header(default=None, alias='Idempotency-Key')):
    if idempotency_key is not None and (not 1 <= len(idempotency_key) <= 200 or any(ord(c) < 32 for c in idempotency_key)):
        raise HTTPException(422, 'Referensi percobaan pembayaran tidak valid.')
    db = get_db()
    digest = hashlib.sha256(json.dumps(payload.model_dump(), sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    attempt_id = user['store_id'] + ':' + (idempotency_key or str(uuid.uuid4()))
    identifier, now = str(uuid.uuid4()), utcnow().isoformat()
    calc = _calc(payload)
    if payload.payment_method != 'cash' and Decimal(str(calc['total'])) != Decimal(str(calc['total'])).to_integral_value():
        raise HTTPException(422, 'Total pembayaran elektronik harus berupa Rupiah bulat.')
    if payload.payment_method == 'cash' and Decimal(str(payload.cash_received)) < Decimal(str(calc['total'])):
        raise HTTPException(422, 'Pembayaran tunai kurang.')

    async def prepare(session):
        previous = await db.checkout_attempts.find_one({'_id': attempt_id}, session=session)
        if previous:
            if previous['cashier_id'] != user['id'] or previous['request_hash'] != digest:
                raise HTTPException(409, 'Referensi pembayaran sudah digunakan untuk transaksi berbeda.')
            if previous.get('state') == 'failed':
                raise HTTPException(400, previous.get('error') or 'Pembayaran ditolak. Periksa pengaturan sebelum membuat percobaan baru.')
            existing = await db.orders.find_one({'id': previous['order_id'], 'store_id': user['store_id']}, session=session)
            if not existing:
                raise HTTPException(409, 'Percobaan pembayaran masih perlu diperiksa. Jangan membuat transaksi baru.')
            return public_order(existing), False
        payload.ewallet_channel = await require_payment_method(db, user, payload.payment_method, payload.ewallet_channel)
        seen, lines = set(), []
        for item in payload.items:
            if item.product_id in seen:
                raise HTTPException(422, 'Produk duplikat dalam transaksi.')
            seen.add(item.product_id)
            product = await db.products.find_one({'id': item.product_id, 'store_id': user['store_id']}, session=session)
            if not product or product.get('active') is False:
                raise HTTPException(409, 'Produk tidak tersedia. Muat ulang katalog kasir.')
            if 'price' not in product or Decimal(str(product['price'])) != Decimal(str(item.price)):
                raise HTTPException(409, 'Harga produk berubah. Muat ulang katalog dan periksa keranjang.')
            if product.get('stock', 0) < item.quantity:
                raise HTTPException(409, 'Stok produk tidak cukup. Periksa stok sebelum menerima pembayaran.')
            changed = await db.products.update_one({'id': item.product_id, 'store_id': user['store_id'], 'stock': {'$gte': item.quantity}},
                        {'$inc': {'stock': -item.quantity}}, session=session)
            if not changed.modified_count:
                raise HTTPException(409, 'Stok berubah. Muat ulang katalog kasir.')
            lines.append({**item.model_dump(), 'name': product['name'], 'unit_cost': product.get('cost'),
                          'cost_snapshot_source': 'checkout' if product.get('cost') is not None else 'unknown'})
        customer = await customer_for_sale(db, user['store_id'], payload, session)
        day = now[:10].replace('-', '')
        counter = await db.counters.find_one_and_update({'_id': f"{user['store_id']}:{day}"}, {'$inc': {'seq': 1}},
                              upsert=True, return_document=True, session=session)
        doc = {'id': identifier, 'store_id': user['store_id'], 'cashier_id': user['id'], 'cashier_email': user['email'],
               'order_no': f"GR-{day}-{counter['seq']:04d}", 'items': lines, **calc,
               'tax_percent': payload.tax_percent, 'payment_method': payload.payment_method,
               'payment_status': 'paid' if payload.payment_method == 'cash' else 'pending',
               'payment_initialization': 'initializing' if payload.payment_method in ('qris', 'ewallet', 'doku') else 'ready',
               'ewallet_channel': payload.ewallet_channel, 'customer_id': customer['id'] if customer else None,
               'customer_name': payload.customer_name, 'customer_phone': payload.customer_phone, 'customer_email': payload.customer_email,
               'cash_received': payload.cash_received, 'change': round(payload.cash_received-calc['total'], 2) if payload.payment_method == 'cash' else None,
               'note': payload.note, 'created_at': now, 'updated_at': now, 'inventory_ledger_version': 1, 'inventory_applied': True}
        if payload.payment_method in ('qris', 'ewallet'):
            doc['xendit_reference_id'] = doc['order_no']
        if payload.payment_method == 'doku':
            doc['doku_id'] = doc['order_no']
        if payload.payment_method == 'qris_bank':
            saved = await db.bank_qris_configs.find_one({'store_id': user['store_id']}, session=session)
            try:
                doc['bank_qris'] = bank_qris_snapshot(saved, calc['total'])
            except ValueError as error:
                raise HTTPException(400, str(error))
        await db.checkout_attempts.insert_one({'_id': attempt_id, 'store_id': user['store_id'], 'cashier_id': user['id'],
              'request_hash': digest, 'order_id': identifier, 'state': 'prepared'}, session=session)
        await db.orders.insert_one(dict(doc), session=session)
        for line in lines:
            await movement(db, session, identifier=f"{identifier}:sale:{line['product_id']}", store_id=user['store_id'],
                   product_id=line['product_id'], name=line['name'], quantity=-line['quantity'], reference=doc['order_no'],
                   kind='sale', actor=user['id'], at=now)
        await apply_loyalty(db, doc, session)
        return doc, True

    try:
        doc, created = await transactions.run_transaction(db, prepare)
    except DuplicateKeyError:
        # A concurrent request with the same attempt key committed first.
        doc, created = await transactions.run_transaction(db, prepare)
    if not created or payload.payment_method not in ('qris', 'ewallet', 'doku'):
        if created:
            await deliver_receipt(payload, user, db, doc)
        return public_order(doc)
    try:
        updated = await initialize_gateway(payload, user, db, dict(doc))
    except HTTPException as error:
        uncertain = error.headers and error.headers.get('X-Payment-Uncertain') == '1'
        async def compensate(session):
            current = await db.orders.find_one({'id': doc['id'], 'store_id': user['store_id']}, session=session)
            if not current or current.get('payment_status') != 'pending':
                return
            if uncertain:
                await db.orders.update_one({'id': doc['id'], 'store_id': user['store_id']}, {'$set': {
                    'payment_initialization': 'uncertain', 'payment_initialization_message': 'Status penyedia belum pasti. Periksa transaksi ini; jangan buat pembayaran baru.'}}, session=session)
                return
            for line in doc['items']:
                await db.products.update_one({'id': line['product_id'], 'store_id': user['store_id']}, {'$inc': {'stock': line['quantity']}}, session=session)
                await movement(db, session, identifier=f"{doc['id']}:declined:{line['product_id']}", store_id=user['store_id'],
                     product_id=line['product_id'], name=line['name'], quantity=line['quantity'], reference=doc['order_no'],
                     kind='payment_declined', actor=user['id'], at=utcnow().isoformat())
            await db.orders.delete_one({'id': doc['id'], 'store_id': user['store_id']}, session=session)
            await db.checkout_attempts.update_one({'_id': attempt_id}, {'$set': {'state': 'failed', 'error': error.detail}}, session=session)
        await transactions.run_transaction(db, compensate)
        if uncertain:
            return public_order(await db.orders.find_one({'id': doc['id'], 'store_id': user['store_id']}))
        raise
    # The order already exists if saving the provider response fails. Retrying the
    # same attempt returns that record and never sends a second provider request.
    updates = {key: value for key, value in updated.items() if key.startswith(('xendit_', 'doku_'))}
    updates.update(payment_initialization='ready', updated_at=utcnow().isoformat())
    await db.orders.update_one({'id': doc['id'], 'store_id': user['store_id']}, {'$set': updates})
    saved = await db.orders.find_one({'id': doc['id'], 'store_id': user['store_id']})
    await deliver_receipt(payload, user, db, saved)
    return public_order(saved)


@router.get("", dependencies=[Depends(require_permission("pos.use"))])
async def list_orders(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = 200,
):
    db = get_db()
    flt = {"store_id": user["store_id"]}
    if status:
        flt["payment_status"] = status
    cursor = db.orders.find(flt, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


@router.get("/stats", dependencies=[Depends(require_permission("pos.use"))])
async def stats(user: dict = Depends(get_current_user)):
    db = get_db()
    from datetime import datetime, timezone, timedelta
    now = utcnow()
    zone = await store_zone(db, user['store_id'])
    local_start = now.astimezone(zone).replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = local_start.astimezone(timezone.utc).isoformat()
    today_end = (local_start + timedelta(days=1)).astimezone(timezone.utc).isoformat()
    week_start = (now - timedelta(days=7)).isoformat()
    month_start = (now - timedelta(days=30)).isoformat()

    async def sum_in(after: str, paid_only: bool = True, before: str = None) -> dict:
        match = {"store_id": user["store_id"], "created_at": {"$gte": after, "$lte": now.isoformat()}}
        if before:
            match["created_at"]["$lt"] = before
        if paid_only:
            match["payment_status"] = "paid"
        cur = db.orders.aggregate([
            {"$match": match},
            {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
        ])
        rows = await cur.to_list(length=1)
        return rows[0] if rows else {"total": 0, "count": 0}

    today = await sum_in(today_start, before=today_end)
    week = await sum_in(week_start)
    month = await sum_in(month_start)
    product_count = await db.products.count_documents({"store_id": user["store_id"]})
    first_day = local_start - timedelta(days=6)
    day_rows = await db.orders.aggregate([
        {'$match': {'store_id':user['store_id'],'payment_status':'paid',
          'created_at':{'$gte':first_day.astimezone(timezone.utc).isoformat(),'$lt':today_end,'$lte':now.isoformat()}}},
        {'$group':{'_id':{'$dateToString':{'format':'%Y-%m-%d','date':{'$dateFromString':{'dateString':'$created_at'}},'timezone':str(zone)}},
                   'value':{'$sum':'$total'}}}
    ]).to_list(None)
    by_day = {row['_id']:row['value'] for row in day_rows}
    daily_sales = [{'date':(first_day+timedelta(days=index)).date().isoformat(),
                    'value':by_day.get((first_day+timedelta(days=index)).date().isoformat(),0)} for index in range(7)]
    low_stock_count = await db.products.count_documents({'store_id':user['store_id'],'stock':{'$lte':5}})
    return {
        "timezone": str(zone), "today_date": local_start.date().isoformat(),
        "daily_sales": daily_sales, "low_stock_count": low_stock_count,
        "today_sales": today.get("total", 0),
        "today_orders": today.get("count", 0),
        "week_sales": week.get("total", 0),
        "week_orders": week.get("count", 0),
        "month_sales": month.get("total", 0),
        "month_orders": month.get("count", 0),
        "product_count": product_count,
    }


@router.get("/product-sales", dependencies=[Depends(require_permission("reports.read"))])
async def product_sales(user: dict = Depends(require_plan("pro")), days: int = 30, limit: int = 10):
    """Laporan produk terjual REAL: agregasi qty + revenue per produk dari order LUNAS.

    Pro-tier feature (part of the Laporan module) -- see AppLayout.jsx minPlan."""
    db = get_db()
    from datetime import datetime, timezone, timedelta
    after = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cur = db.orders.aggregate([
        {"$match": {"store_id": user["store_id"], "payment_status": "paid", "created_at": {"$gte": after}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": {"pid": "$items.product_id", "name": "$items.name"},
            "sold": {"$sum": "$items.quantity"},
            "revenue": {"$sum": "$items.subtotal"},
        }},
        {"$sort": {"sold": -1}},
        {"$limit": limit},
    ])
    rows = await cur.to_list(length=limit)
    return [
        {
            "product_id": r["_id"].get("pid"),
            "name": r["_id"].get("name") or "-",
            "sold": r.get("sold", 0),
            "revenue": r.get("revenue", 0),
        }
        for r in rows
    ]


@router.get("/{order_id}", dependencies=[Depends(require_permission("pos.use"))])
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.orders.find_one({"id": order_id, "store_id": user["store_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    return doc


@router.post('/{order_id}/confirm-bank-qris', dependencies=[Depends(require_permission('pos.use'))])
async def confirm_bank_qris(order_id: str, payload: BankQrisConfirmation, user: dict = Depends(get_current_user)):
    if user.get('role') not in ('Owner', 'admin', 'Manager', 'Cashier'):
        raise HTTPException(403, 'Peran kasir diperlukan untuk konfirmasi QRIS bank.')
    db = get_db()
    async def confirm(session):
        scope = {'id':order_id, 'store_id':user['store_id'], 'payment_method':'qris_bank'}
        order = await db.orders.find_one(scope, session=session)
        if not order:
            raise HTTPException(404, 'Transaksi QRIS bank tidak ditemukan.')
        if user.get('role') == 'Cashier' and order.get('cashier_id') != user['id']:
            raise HTTPException(403, 'Kasir hanya dapat mengonfirmasi transaksi miliknya sendiri.')
        if payload.checked_in_bank is not True or payload.received_amount != Decimal(str(order['total'])):
            raise HTTPException(400, 'Periksa penerimaan dan nominal yang sama di aplikasi bank merchant terlebih dahulu.')
        if order.get('payment_status') == 'paid':
            return public_order(order)
        if order.get('payment_status') != 'pending':
            raise HTTPException(409, 'Transaksi ini tidak lagi menunggu pembayaran.')
        now = utcnow().isoformat()
        updates = {'payment_status':'paid', 'updated_at':now, 'payment_confirmation': {
            'type':'manual_bank', 'bank_verified':False, 'confirmed_by':user['id'], 'confirmed_at':now,
            'received_amount':float(payload.received_amount), 'reference':payload.reference.strip()}}
        await db.orders.update_one(scope, {'$set':updates}, session=session)
        order.update(updates)
        await apply_loyalty(db, order, session)
        return public_order(order)
    return await transactions.run_transaction(db, confirm)


@router.post('/{order_id}/mark-paid', dependencies=[Depends(require_permission('pos.use'))])
async def mark_paid(order_id: str, user: dict = Depends(require_admin)):
    db = get_db()
    async def settle(session):
        order = await db.orders.find_one({'id': order_id, 'store_id': user['store_id']}, session=session)
        if not order:
            raise HTTPException(404, 'Order tidak ditemukan')
        if order.get('payment_method') == 'qris_bank':
            raise HTTPException(400, 'Gunakan konfirmasi QRIS bank setelah memeriksa aplikasi bank.')
        if order.get('payment_status') == 'paid':
            return public_order(order)
        if order.get('payment_status') != 'pending':
            raise HTTPException(409, 'Transaksi yang dibatalkan atau gagal tidak dapat ditandai lunas.')
        order.update(payment_status='paid', updated_at=utcnow().isoformat())
        await db.orders.update_one({'id': order_id, 'store_id': user['store_id'], 'payment_status': 'pending'},
                    {'$set': {'payment_status': 'paid', 'updated_at': order['updated_at']}}, session=session)
        await apply_loyalty(db, order, session)
        return public_order(order)
    return await transactions.run_transaction(db, settle)


@router.post('/{order_id}/void', dependencies=[Depends(require_permission('pos.use'))])
async def void_order(order_id: str, user: dict = Depends(require_admin)):
    db = get_db()
    async def cancel(session):
        order = await db.orders.find_one({'id': order_id, 'store_id': user['store_id']}, session=session)
        if not order:
            raise HTTPException(404, 'Order tidak ditemukan')
        if order.get('payment_status') == 'voided':
            return {'ok': True, 'already_voided': True}
        if order.get('payment_status') == 'refunded':
            raise HTTPException(409, 'Transaksi sudah dikembalikan; periksa catatan pengembalian.')
        at = utcnow().isoformat()
        await db.orders.update_one({'id': order_id, 'store_id': user['store_id'], 'payment_status': order['payment_status']},
             {'$set': {'payment_status': 'voided', 'updated_at': at, 'voided_at': at, 'voided_by': user['id'], 'inventory_applied': False, 'inventory_void_ledger_version': 1}}, session=session)
        for line in order.get('items', []) if order.get('inventory_applied') is not False else []:
            await db.products.update_one({'id': line['product_id'], 'store_id': user['store_id']},
                           {'$inc': {'stock': line['quantity']}}, session=session)
            await movement(db, session, identifier=f"{order_id}:void:{line['product_id']}", store_id=user['store_id'],
                   product_id=line['product_id'], name=line['name'], quantity=line['quantity'], reference=order['order_no'],
                   kind='void', actor=user['id'], at=at)
        await apply_loyalty(db, order, session, reverse=True)
        return {'ok': True, 'refund_automatic': False, 'refund_required': order.get('payment_status') == 'paid' and order.get('payment_method') != 'cash'}
    return await transactions.run_transaction(db, cancel)
