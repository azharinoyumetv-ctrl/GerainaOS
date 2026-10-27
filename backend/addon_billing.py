"""Owner-bound, prepaid add-on orders. Only verified provider proof grants capacity."""
import re
from datetime import datetime, timezone
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError
import transactions
import billing_subscriptions as billing
from addon_catalog import CATALOG, date, unexpired, usable
from subscription_state import subscription_for
from database import utcnow

def plan_for(user):
    sub = subscription_for(user, 'geraina')
    return (sub['tier'] if sub['active'] else 'expired') if sub else user.get('plan')

async def rows_for(db, store_id, addon_id=None, session=None):
    query = {'store_id': store_id}
    if addon_id: query['addon_id'] = addon_id
    return await db.addon_purchases.find(query, session=session).to_list(length=5000)

async def check_selection(db, user, addon, renewal, order_id=None, session=None):
    if plan_for(user) != addon['plan']:
        raise HTTPException(400, f"Add-on ini memerlukan paket {addon['plan'].title()} aktif.")
    rows = await rows_for(db, user['store_id'], addon['id'], session)
    pending = next((r for r in rows if r.get('source') == 'verified_checkout' and r.get('status') == 'pending' and r.get('id') != order_id), None)
    if pending:
        order = await db.subscription_orders.find_one({'_id': pending['id'], 'owner_id': user['id']}, session=session)
        raise HTTPException(409, {'code': 'addon_pending', 'receipt': (order or {}).get('receipt'), 'message': 'Masih ada pembayaran add-on yang belum selesai. Periksa pesanan tersebut sebelum membeli lagi.'})
    occupied = {str(r.get('entitlement_id') or r.get('id') or r['_id']) for r in rows if unexpired(r) or r.get('source') == 'verified_checkout' and r.get('status') == 'pending'}
    target = order_id
    if renewal:
        owned = next((r for r in rows if str(r.get('entitlement_id') or r.get('id')) == renewal and r.get('status') == 'active'), None)
        if not owned or not owned.get('expires_at'):
            raise HTTPException(400, 'Add-on untuk perpanjangan tidak ditemukan atau tidak memiliki masa berlaku berbayar.')
        target = renewal
    if addon['limit'] and target not in occupied and len(occupied) >= addon['limit']:
        raise HTTPException(400, 'Maksimal 2 device tambahan per toko. Perpanjang add-on yang sudah ada.')
    return rows

async def prepare(payload, user):
    db = billing.get_db()
    addon = CATALOG.get(payload.get('addonId'))
    order_id, renewal = payload.get('orderId'), payload.get('renewalId')
    if user.get('current_module') != 'geraina' or not addon or payload.get('period') != 'monthly' or not isinstance(order_id, str) or not re.fullmatch(r'DG-geraina-[a-f0-9]{32}', order_id):
        raise HTTPException(400, 'Pilihan add-on tidak valid')
    if renewal is not None and (not isinstance(renewal, str) or not re.fullmatch(r'(DG-geraina-[a-f0-9]{32}|[a-f0-9-]{36})', renewal)):
        raise HTTPException(400, 'Referensi perpanjangan tidak valid')
    owner_query = {'id': user['store_id'], 'owner_user_id': user['id'], 'module': {'$in': ['geraina', None]}}
    if not await db.stores.find_one(owner_query): raise HTTPException(403, 'Akun pemilik toko diperlukan')
    existing = await db.subscription_orders.find_one({'_id': order_id})
    binding = {'owner_id': user['id'], 'store_id': user['store_id'], 'module': 'geraina', 'kind': 'addon', 'addon_id': addon['id'], 'renewal_id': renewal,
               'tier': addon['plan'], 'period': 'monthly', 'amount': addon['price_idr']}
    if existing and any(existing.get(k) != v for k, v in binding.items()): raise HTTPException(409, 'Pesanan tidak cocok dengan akun ini')
    if existing and existing.get('status') in ('paid', 'refunded', 'failed'):
        raise HTTPException(409, {'code': 'addon_existing', 'receipt': existing.get('receipt'), 'message': 'Pesanan ini sudah diproses. Periksa status pesanan.'})
    rows = await check_selection(db, user, addon, renewal, order_id)
    if not existing:
        existing = {'_id': order_id, **binding, 'status': 'draft', 'created_at': billing.stamp(utcnow())}
        try: await db.subscription_orders.insert_one(existing)
        except DuplicateKeyError:
            existing = await db.subscription_orders.find_one({'_id': order_id})
            if not existing or any(existing.get(k) != v for k, v in binding.items()): raise HTTPException(409, 'Pesanan tidak cocok dengan akun ini')
    if payload.get('confirmAddon') is True:
        async def reserve(session):
            # Serializes competing confirmations and settlements for this store.
            store = await db.stores.update_one(owner_query, {'$inc': {'addon_checkout_revision': 1}}, session=session)
            if not store.matched_count: raise HTTPException(403, 'Pemilik toko telah berubah')
            fresh = await db.users.find_one({'id': user['id']}, session=session)
            context = {**user, **(fresh or {}), 'store_id': user['store_id']}
            await check_selection(db, context, addon, renewal, order_id, session)
            order = await db.subscription_orders.find_one({'_id': order_id}, session=session)
            if not order.get('receipt'): raise HTTPException(409, 'Referensi pembayaran belum siap. Buka kembali checkout.')
            if order['status'] != 'draft': return
            await db.addon_purchases.insert_one({'_id': order_id, 'id': order_id, 'owner_id': user['id'], 'store_id': user['store_id'], 'addon_id': addon['id'],
                'entitlement_id': renewal or order_id, 'status': 'pending', 'source': 'verified_checkout', 'created_at': billing.stamp(utcnow())}, session=session)
            await db.subscription_orders.update_one({'_id': order_id}, {'$set': {'status': 'pending', 'confirmed_at': billing.stamp(utcnow())}}, session=session)
        await transactions.run_transaction(db, reserve)
    sub = subscription_for(user, 'geraina')
    ends = [date(r.get('expires_at')) for r in rows if unexpired(r) and str(r.get('entitlement_id') or r.get('id')) == renewal]
    return {**binding, 'order_id': order_id, 'email': user['email'], 'addonId': addon['id'], 'renewalId': renewal,
            'base_expires_at': (sub or {}).get('expires_at'), 'current_addon_expires_at': max((d for d in ends if d), default=None).isoformat() if any(ends) else None}

async def claim_invoice(order_id, user):
    db = billing.get_db()
    result = await db.subscription_orders.update_one({'_id': order_id, 'owner_id': user['id'], 'store_id': user['store_id'], 'module': 'geraina',
        'kind': 'addon', 'status': 'pending', 'receipt': {'$exists': True}, 'invoice_started_at': {'$exists': False}}, {'$set': {'invoice_started_at': billing.stamp(utcnow())}})
    return {'claimed': result.matched_count == 1}

async def apply_payment(order, payment):
    db = billing.get_db();order_id = order['_id'];state = payment['status']
    async def settle(session):
        store = await db.stores.update_one({'id': order['store_id'], 'owner_user_id': order['owner_id']}, {'$inc': {'addon_checkout_revision': 1}}, session=session)
        if not store.matched_count: raise HTTPException(503, 'Toko atau pemilik untuk aktivasi add-on telah berubah')
        cycle = await db.addon_purchases.find_one({'_id': order_id, 'store_id': order['store_id']}, session=session)
        if not cycle: raise HTTPException(409, 'Pesanan add-on belum dikonfirmasi')
        expiry, activation = cycle.get('expires_at'), cycle.get('status', 'pending')
        if state == 'paid':
            try:
                paid_at = datetime.fromisoformat(payment['paidAt'])
                if paid_at.tzinfo is None: raise ValueError('Missing timezone')
            except (ValueError, TypeError, KeyError):
                raise HTTPException(502, 'Waktu pembayaran belum terverifikasi')
            # An authoritative reversal is terminal for this paid cycle.
            if cycle.get('status') == 'revoked': activation = 'revoked'
            elif not cycle.get('paid_at'):
                rows = await rows_for(db, order['store_id'], order['addon_id'], session)
                start = paid_at
                if order.get('renewal_id'):
                    ends = [date(r.get('expires_at')) for r in rows if r.get('status') == 'active' and r.get('entitlement_id', r.get('id')) == order['renewal_id']]
                    start = max([start] + [d for d in ends if d])
                expiry = billing.stamp(billing.term_end(start, 'monthly'))
                await db.addon_purchases.update_one({'_id': order_id}, {'$set': {'status': 'active', 'paid_at': billing.stamp(paid_at), 'starts_at': billing.stamp(start), 'expires_at': expiry}}, session=session)
                activation = 'active'
            else: activation = 'active'
        elif state in ('failed', 'refunded'):
            activation = 'revoked' if cycle.get('paid_at') else 'failed'
            await db.addon_purchases.update_one({'_id': order_id}, {'$set': {'status': activation}}, session=session)
        await db.subscription_orders.update_one({'_id': order_id}, {'$set': {'status': state, 'activation': activation, 'expires_at': expiry, 'checked_at': billing.stamp(utcnow())}}, session=session)
        return {'status': state, 'activation': activation, 'kind': 'addon', 'addonId': order['addon_id'], 'expires_at': expiry}
    return await transactions.run_transaction(db, settle)

async def view(db, user):
    rows = await rows_for(db, user['store_id'])
    offers, groups = [], {}
    plan = plan_for(user)
    for addon in CATALOG.values():
        own = [r for r in rows if r.get('addon_id') == addon['id']]
        occupied = {str(r.get('entitlement_id') or r.get('id') or r['_id']) for r in own if unexpired(r) or r.get('source') == 'verified_checkout' and r.get('status') == 'pending'}
        pending = next((r for r in own if r.get('status') == 'pending' and r.get('source') == 'verified_checkout'), None)
        order = await db.subscription_orders.find_one({'_id': pending['id'], 'owner_id': user['id']}) if pending else None
        eligible = plan == addon['plan'] and not pending and (not addon['limit'] or len(occupied) < addon['limit'])
        reason = f"Memerlukan paket {addon['plan'].title()} aktif." if plan != addon['plan'] else 'Selesaikan pembayaran add-on yang tertunda.' if pending else 'Maksimal 2 device tambahan; perpanjang add-on yang sudah ada.' if not eligible else ''
        offers.append({**addon, 'eligible': eligible, 'reason': reason, 'pending_receipt': (order or {}).get('receipt'), 'occupied': len(occupied)})
    for row in rows:
        if row.get('status') != 'active': continue
        addon = CATALOG.get(row.get('addon_id'))
        if not addon: continue
        key = str(row.get('entitlement_id') or row.get('id') or row['_id'])
        group = groups.setdefault(key, {'id': key, 'addonId': addon['id'], 'name': addon['name'], 'expires_at': None, 'active': False, 'can_renew': False})
        expiry = date(row.get('expires_at'))
        if expiry and (not group['expires_at'] or expiry > date(group['expires_at'])): group['expires_at'] = billing.stamp(expiry)
        group['active'] = group['active'] or plan == addon['plan'] and usable(row)
    for group in groups.values():
        addon = CATALOG[group['addonId']]
        own = [r for r in rows if r.get('addon_id') == addon['id']]
        occupied = {str(r.get('entitlement_id') or r.get('id') or r['_id']) for r in own if unexpired(r) or r.get('source') == 'verified_checkout' and r.get('status') == 'pending'}
        room = not addon['limit'] or group['id'] in occupied or len(occupied) < addon['limit']
        group['can_renew'] = plan == addon['plan'] and bool(group['expires_at']) and room and not any(o['id'] == addon['id'] and o['pending_receipt'] for o in offers)
    return {'offers': offers, 'purchases': list(groups.values()), 'period': 'monthly', 'auto_renew': False}
