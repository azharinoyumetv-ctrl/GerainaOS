"""Validated cumulative settlement shared by supplier invoices and debt screens."""
from decimal import Decimal
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow


def settlement(amount, paid):
    amount, paid = Decimal(str(amount)), Decimal(str(paid))
    if not amount.is_finite() or not paid.is_finite() or amount <= 0 or paid < 0 or paid > amount:
        raise HTTPException(422, 'Nominal pembayaran harus antara nol dan jumlah tagihan.')
    return 'Paid' if paid == amount else 'Partial' if paid > 0 else 'Unpaid'


async def set_payment(db, collection, identifier, user, paid, session, requested_status=None, expected_paid=None):
    scope = {'id':identifier, 'store_id':user['store_id']}
    record = await db[collection].find_one(scope, session=session)
    if not record:
        raise HTTPException(404, 'Catatan tagihan tidak ditemukan.')
    if expected_paid is not None and Decimal(str(expected_paid)) != Decimal(str(record.get('paid_amount',0))):
        raise HTTPException(409, 'Tagihan berubah sejak dibuka. Segarkan data dan periksa saldo sebelum mencatat pembayaran.')
    status = settlement(record['amount'], paid)
    if requested_status is not None and requested_status != status:
        raise HTTPException(422, 'Status harus sesuai dengan nominal pembayaran.')
    at = utcnow().isoformat()
    await db[collection].update_one(scope, {'$set':{'paid_amount':float(paid),'status':status,'updated_at':at}}, session=session)
    if collection == 'debt_payables':
        invoice_scope = {'store_id':user['store_id']}
        invoice_scope['id' if record.get('invoice_id') else 'invoice_no'] = record.get('invoice_id') or record['invoice_no']
        matches = await db.supplier_invoices.find(invoice_scope, session=session).limit(2).to_list(2)
        if len(matches) > 1:
            raise HTTPException(409, 'Nomor faktur lama duplikat. Perbaiki referensi faktur sebelum membayar.')
        if matches:
            invoice = matches[0]
            if Decimal(str(invoice['amount'])) != Decimal(str(record['amount'])):
                raise HTTPException(409, 'Nominal faktur dan hutang berbeda. Perbaiki tagihan terlebih dahulu.')
            await db.supplier_invoices.update_one({'id':invoice['id'],'store_id':user['store_id']},
                      {'$set':{'paid_amount':float(paid),'status':status,'updated_at':at}}, session=session)
    if float(record.get('paid_amount', 0)) != float(paid):
        await db.debt_payment_events.insert_one({'id':str(uuid4()),'store_id':user['store_id'],'collection':collection,
             'record_id':identifier,'previous_paid':record.get('paid_amount',0),'paid_amount':float(paid),
             'actor_id':user['id'],'created_at':at}, session=session)
    return {**record,'paid_amount':float(paid),'status':status,'updated_at':at}
