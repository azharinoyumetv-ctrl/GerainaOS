from list_metadata import legacy_list_metadata
"""Purchase management routes (Suppliers, Purchase Orders, Goods Receiving, Invoices)."""
from permissions import require_permission
import uuid
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
import transactions
from stock_ledger import movement
from debt_service import set_payment, settlement
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response
from database import get_db, utcnow
from models import (
    Supplier, SupplierBase, PurchaseOrder, PurchaseOrderCreate,
    GoodsReceiving, GoodsReceivingCreate, SupplierInvoice, SupplierInvoiceCreate,
    SupplierInvoiceUpdate, PurchaseLine
)
from auth import get_current_user
from plan_limits import require_plan

router = APIRouter(tags=["purchase"])

# ---------- Suppliers (Pro-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/suppliers", response_model=List[Supplier], dependencies=[Depends(require_permission("suppliers.read"))])
async def list_suppliers(user: dict = Depends(require_plan("pro")), response: Response = None):
    db = get_db()
    await legacy_list_metadata(response,db,'suppliers',user['store_id'],'suppliers',100)
    cursor = db.suppliers.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=100)

@router.post("/api/suppliers", response_model=Supplier, dependencies=[Depends(require_permission("suppliers.write"))])
async def create_supplier(payload: SupplierBase, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    existing = await db.suppliers.find_one({"store_id": user["store_id"], "name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Supplier sudah ada")
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "phone": payload.phone,
        "email": payload.email,
        "address": payload.address,
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat()
    }
    await db.suppliers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/api/suppliers/{sup_id}", response_model=Supplier, dependencies=[Depends(require_permission("suppliers.write"))])
async def update_supplier(sup_id: str, payload: SupplierBase, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    res = await db.suppliers.find_one_and_update(
        {"id": sup_id, "store_id": user["store_id"]},
        {"$set": {
            "name": payload.name,
            "phone": payload.phone,
            "email": payload.email,
            "address": payload.address,
            "updated_at": utcnow().isoformat()
        }},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Supplier tidak ditemukan")
    return res

@router.delete("/api/suppliers/{sup_id}", dependencies=[Depends(require_permission("suppliers.write"))])
async def delete_supplier(sup_id: str, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    res = await db.suppliers.delete_one({"id": sup_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier tidak ditemukan")
    return {"ok": True}

# ---------- Purchase Orders (Pro-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/purchase/orders", response_model=List[PurchaseOrder], dependencies=[Depends(require_permission("purchase.read"))])
async def list_purchase_orders(user: dict = Depends(require_plan("pro")), response: Response = None):
    db = get_db()
    await legacy_list_metadata(response,db,'purchase_orders',user['store_id'],'purchase-orders',100)
    cursor = db.purchase_orders.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)

async def purchase_lines(db, store_id, items, session):
    if not items:
        raise HTTPException(422, 'Tambahkan rincian produk dan jumlah pesanan.')
    lines, seen = [], set()
    for item in items:
        if item.product_id in seen:
            raise HTTPException(422, 'Produk duplikat pada pesanan.')
        seen.add(item.product_id)
        product = await db.products.find_one({'id':item.product_id,'store_id':store_id}, session=session)
        if not product:
            raise HTTPException(404, 'Produk pesanan tidak ditemukan di toko ini.')
        lines.append({'product_id':product['id'],'name':product['name'],'qty':item.qty,
                      'cost':item.cost,'subtotal':float(Decimal(str(item.cost))*item.qty),'received_qty':0})
    total = sum((Decimal(str(line['subtotal'])) for line in lines), Decimal(0))
    if total > Decimal('1000000000000'):
        raise HTTPException(422, 'Total pesanan melebihi batas yang didukung.')
    return lines, float(total)


async def deliver_purchase(payload, user, db, doc):
    # Kirim PO ke WhatsApp supplier (best-effort; BYO WABA, tak membatalkan PO bila gagal).
    # Diinisiasi toko -> wajib template. TEMPLATE_PO_NAME_DEFAULT belum disetujui Meta --
    # lihat TEMPLATE_PO_BODY_ID di whatsapp_client.py untuk teks yang perlu diajukan.
    try:
        from whatsapp_client import (
            get_wa_config, send_meta_message,
            TEMPLATE_PO_NAME_DEFAULT, TEMPLATE_PO_LANG_DEFAULT,
        )
        wa = await get_wa_config(db, user["store_id"])
        if wa.get("is_active"):
            sup = await db.suppliers.find_one({"id": payload.supplier_id, "store_id": user["store_id"]})
            phone = (sup or {}).get("phone")
            if phone:
                settings = await db.settings.find_one({"store_id": user["store_id"]}, {"_id": 0})
                store_name = ((settings or {}).get("general") or {}).get("store_name") or user.get("store_name") or "Toko"
                total_str = f"{int(round(payload.total or 0)):,}".replace(",", ".")
                template_name = wa.get("template_po") or TEMPLATE_PO_NAME_DEFAULT
                template_lang = wa.get("template_po_lang") or TEMPLATE_PO_LANG_DEFAULT
                params = [payload.po_no, store_name, payload.supplier_name, total_str, payload.status]
                doc["whatsapp"] = await send_meta_message(wa, phone, template_name, params, lang=template_lang)
    except Exception:
        pass



@router.post('/api/purchase/orders', response_model=PurchaseOrder, dependencies=[Depends(require_permission('purchase.write'))])
async def create_purchase_order(payload: PurchaseOrderCreate, user: dict = Depends(require_plan('pro'))):
    db = get_db()
    async def save(session):
        number = payload.po_no.strip()
        if not number or await db.purchase_orders.find_one({'store_id':user['store_id'],'po_no':number}, session=session):
            raise HTTPException(409, 'Nomor PO sudah digunakan atau kosong.')
        supplier = await db.suppliers.find_one({'id':payload.supplier_id,'store_id':user['store_id']}, session=session)
        if not supplier:
            raise HTTPException(404, 'Supplier tidak ditemukan di toko ini.')
        lines, total = await purchase_lines(db, user['store_id'], payload.items, session)
        if Decimal(str(total)) != Decimal(str(payload.total)):
            raise HTTPException(422, 'Total PO tidak sesuai rincian produk.')
        identifier = str(uuid.uuid4())
        doc = {'_id':user['store_id']+':po:'+hashlib.sha256(number.encode()).hexdigest(),
               'id':identifier,'store_id':user['store_id'],'po_no':number,'supplier_id':supplier['id'],
               'supplier_name':supplier['name'],'items':lines,'total':total,'status':'Ordered',
               'created_at':utcnow().isoformat(),'created_by':user['id']}
        await db.purchase_orders.insert_one(dict(doc), session=session)
        doc.pop('_id', None)
        return doc
    doc = await transactions.run_transaction(db, save)
    await deliver_purchase(payload.model_copy(update={'supplier_name':doc['supplier_name']}), user, db, doc)
    return doc


@router.put('/api/purchase/orders/{po_id}/items', response_model=PurchaseOrder, dependencies=[Depends(require_permission('purchase.write'))])
async def repair_purchase_lines(po_id: str, items: List[PurchaseLine], user: dict = Depends(require_plan('pro'))):
    db = get_db()
    async def save(session):
        scope = {'id':po_id,'store_id':user['store_id']}
        po = await db.purchase_orders.find_one(scope, session=session)
        if not po:
            raise HTTPException(404, 'PO tidak ditemukan.')
        if po.get('status') not in ('Ordered',) or any(line.get('received_qty',0) for line in po.get('items',[])):
            raise HTTPException(409, 'PO yang telah diterima tidak boleh ditulis ulang.')
        lines, total = await purchase_lines(db, user['store_id'], items, session)
        await db.purchase_orders.update_one(scope, {'$set':{'items':lines,'total':total,'updated_at':utcnow().isoformat(),'updated_by':user['id']}}, session=session)
        return {**po,'items':lines,'total':total}
    return await transactions.run_transaction(db, save)


# ---------- Goods Receiving (Pro-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/purchase/receiving", response_model=List[GoodsReceiving], dependencies=[Depends(require_permission("purchase.read"))])
async def list_receiving(user: dict = Depends(require_plan("pro")), response: Response = None):
    db = get_db()
    await legacy_list_metadata(response,db,'goods_receiving',user['store_id'],'receiving',100)
    cursor = db.goods_receiving.find({"store_id": user["store_id"]}, {"_id": 0}).sort("received_at", -1)
    return await cursor.to_list(length=100)

@router.post('/api/purchase/receiving', response_model=GoodsReceiving, dependencies=[Depends(require_permission('purchase.write'))])
async def create_receiving(payload: GoodsReceivingCreate, user: dict = Depends(require_plan('pro'))):
    db = get_db()
    number, at, identifier = payload.po_no.strip(), utcnow().isoformat(), str(uuid.uuid4())
    request_key = payload.request_id or payload.gr_no or identifier
    identity = user['store_id']+':receiving:'+hashlib.sha256(request_key.encode()).hexdigest()
    fingerprint = hashlib.sha256(json.dumps({'po_no':number,'items':[i.model_dump() for i in payload.items] if payload.items else None}, sort_keys=True).encode()).hexdigest()
    async def receive(session):
        previous = await db.goods_receiving.find_one({'_id':identity}, session=session)
        if previous:
            if previous.get('request_hash') != fingerprint:
                raise HTTPException(409, 'Referensi penerimaan sudah digunakan untuk rincian berbeda.')
            return previous
        po = await db.purchase_orders.find_one({'po_no':number,'store_id':user['store_id']}, session=session)
        if not po:
            raise HTTPException(404, 'PO tidak ditemukan di toko ini.')
        if not po.get('items'):
            raise HTTPException(409, 'PO lama tidak menyimpan rincian produk. Lengkapi rincian PO sebelum menerima barang.')
        lines = [PurchaseLine.model_validate(line).model_dump() for line in po['items']]
        if all(line['received_qty'] == line['qty'] for line in lines):
            previous = await db.goods_receiving.find_one({'po_no':number,'store_id':user['store_id'],'inventory_applied':True}, session=session)
            if previous:
                return previous
            raise HTTPException(409, 'PO sudah ditutup; periksa riwayat penerimaan.')
        if po.get('status') not in ('Ordered','Partial'):
            raise HTTPException(409, 'Status PO tidak menerima barang baru.')
        requested = {line.product_id:line.qty for line in payload.items} if payload.items else {line['product_id']:line['qty']-line['received_qty'] for line in lines if line['qty']>line['received_qty']}
        if payload.items and len(requested) != len(payload.items):
            raise HTTPException(422, 'Produk penerimaan duplikat.')
        if not requested or set(requested)-{line['product_id'] for line in lines}:
            raise HTTPException(422, 'Produk penerimaan tidak ada pada PO.')
        received = []
        for line in lines:
            qty = requested.get(line['product_id'], 0)
            if not qty:
                continue
            if qty > line['qty']-line['received_qty']:
                raise HTTPException(409, 'Jumlah diterima melebihi sisa pesanan.')
            product_scope = {'id':line['product_id'],'store_id':user['store_id']}
            product = await db.products.find_one(product_scope, session=session)
            if not product:
                raise HTTPException(409, 'Produk telah dihapus. Perbaiki PO sebelum menerima stok.')
            await db.products.update_one(product_scope, {'$inc':{'stock':qty}}, session=session)
            line['received_qty'] += qty
            received.append({'product_id':line['product_id'],'name':product['name'],'qty':qty,'cost':line['cost']})
            await movement(db, session, identifier=f"{identifier}:receiving:{line['product_id']}",store_id=user['store_id'],
                   product_id=line['product_id'],name=product['name'],quantity=qty,reference=number,kind='receiving',actor=user['id'],at=at)
        status = 'Received' if all(line['qty']==line['received_qty'] for line in lines) else 'Partial'
        await db.purchase_orders.update_one({'id':po['id'],'store_id':user['store_id']}, {'$set':{'items':lines,'status':status,'updated_at':at}}, session=session)
        doc = {'_id':identity,'id':identifier,'store_id':user['store_id'],'po_no':number,
               'gr_no':payload.gr_no or 'GR-'+identifier[:8].upper(),'received_by':user.get('email') or user['id'],
               'received_at':at,'items':received,'inventory_applied':True,'request_hash':fingerprint}
        await db.goods_receiving.insert_one(dict(doc), session=session)
        return doc
    return await transactions.run_transaction(db, receive)


# ---------- Supplier Invoices (Pro-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/purchase/invoices", response_model=List[SupplierInvoice], dependencies=[Depends(require_permission("purchase.read"))])
async def list_supplier_invoices(user: dict = Depends(require_plan("pro")), response: Response = None):
    db = get_db()
    await legacy_list_metadata(response,db,'supplier_invoices',user['store_id'],'invoices',100)
    cursor = db.supplier_invoices.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)

@router.post('/api/purchase/invoices', response_model=SupplierInvoice, dependencies=[Depends(require_permission('purchase.write'))])
async def create_supplier_invoice(payload: SupplierInvoiceCreate, user: dict = Depends(require_plan('pro'))):
    db = get_db()
    async def save(session):
        number = payload.invoice_no.strip()
        if not number or await db.supplier_invoices.find_one({'store_id':user['store_id'],'invoice_no':number}, session=session):
            raise HTTPException(409, 'Nomor faktur sudah digunakan atau kosong.')
        po = await db.purchase_orders.find_one({'store_id':user['store_id'],'po_no':payload.po_no}, session=session) if payload.po_no else None
        supplier = await db.suppliers.find_one({'store_id':user['store_id'],'id':payload.supplier_id}, session=session) if payload.supplier_id else None
        if payload.supplier_id and not supplier:
            raise HTTPException(404, 'Supplier tidak ditemukan.')
        identifier = str(uuid.uuid4())
        paid = payload.amount if payload.status == 'Paid' else 0
        doc = {'_id':user['store_id']+':invoice:'+hashlib.sha256(number.encode()).hexdigest(),
               'id':identifier,'store_id':user['store_id'],'invoice_no':number,'po_no':payload.po_no,
               'amount':payload.amount,'paid_amount':paid,'status':payload.status,'due_date':payload.due_date,
               'created_at':utcnow().isoformat(),'created_by':user['id']}
        await db.supplier_invoices.insert_one(dict(doc), session=session)
        await db.debt_payables.insert_one({'id':str(uuid.uuid4()),'invoice_id':identifier,'store_id':user['store_id'],
              'supplier_name':(supplier or {}).get('name') or (po or {}).get('supplier_name') or 'Faktur '+number,
              'invoice_no':number,'amount':payload.amount,'paid_amount':paid,'due_date':payload.due_date,'status':payload.status}, session=session)
        return doc
    return await transactions.run_transaction(db, save)


@router.put('/api/purchase/invoices/{invoice_id}', response_model=SupplierInvoice, dependencies=[Depends(require_permission('purchase.write'))])
async def update_supplier_invoice(invoice_id: str, payload: SupplierInvoiceUpdate, user: dict = Depends(require_plan('pro'))):
    db = get_db()
    async def update(session):
        scope = {'id':invoice_id,'store_id':user['store_id']}
        invoice = await db.supplier_invoices.find_one(scope, session=session)
        if not invoice:
            raise HTTPException(404, 'Faktur tidak ditemukan.')
        linked = await db.debt_payables.find({'store_id':user['store_id'],'$or':[{'invoice_id':invoice_id},{'invoice_no':invoice['invoice_no']}]}, session=session).limit(2).to_list(2)
        if len(linked)>1:
            raise HTTPException(409, 'Nomor faktur lama terhubung ke beberapa hutang. Perbaiki referensinya terlebih dahulu.')
        paid = invoice['amount'] if payload.status=='Paid' else 0
        if linked:
            await set_payment(db,'debt_payables',linked[0]['id'],user,paid,session,payload.status)
        else:
            await db.supplier_invoices.update_one(scope, {'$set':{'status':payload.status,'paid_amount':paid}}, session=session)
        return {**invoice,'status':payload.status,'paid_amount':paid}
    return await transactions.run_transaction(db, update)
