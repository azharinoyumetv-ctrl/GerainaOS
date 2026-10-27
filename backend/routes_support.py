"""Authenticated customer support. Account identity is never supplied by the form."""
import asyncio
import hashlib
import json
import os
import smtplib
import ssl
from datetime import timedelta
from email.message import EmailMessage
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import get_billing_user
from database import get_db, utcnow
import transactions

def private_response(response: Response):
    response.headers['Cache-Control'] = 'private, no-store'


router = APIRouter(prefix='/api/support', tags=['support'], dependencies=[Depends(private_response)])
RECIPIENT = 'contact@dagangos.com'


class SupportRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    request_id: UUID
    subject: str = Field(min_length=3, max_length=160)
    message: str = Field(min_length=10, max_length=5000)
    app_version: str = Field(default='Web', min_length=1, max_length=32)

    @field_validator('subject', 'app_version')
    @classmethod
    def single_line(cls, value):
        if any(ord(c) < 32 or ord(c) == 127 for c in value):
            raise ValueError('Gunakan satu baris teks.')
        return value


def mail_settings():
    password = os.getenv('SUPPORT_SMTP_PASSWORD') or os.getenv('RESEND_API_KEY')
    host = os.getenv('SUPPORT_SMTP_HOST', 'smtp.resend.com').strip()
    user = os.getenv('SUPPORT_SMTP_USER', 'resend').strip()
    mode = os.getenv('SUPPORT_SMTP_SECURITY', 'ssl').lower()
    try: port = int(os.getenv('SUPPORT_SMTP_PORT', '465'))
    except ValueError: return None
    if not password or not host or not user or mode not in ('ssl', 'starttls') or not 1 <= port <= 65535:
        return None
    return dict(host=host, port=port, user=user, password=password, security=mode)


def send_message(ticket, settings):
    email = EmailMessage()
    # The domain authenticates delivery. Replies go to the authenticated customer.
    email['From'] = f'Geraina Support <{RECIPIENT}>'
    email['To'] = RECIPIENT
    email['Reply-To'] = ticket['customer_email']
    email['Subject'] = f"[{ticket['reference']}] {ticket['subject']}"
    email['Message-ID'] = f"<geraina-support-{ticket['request_id']}@dagangos.com>"
    email.set_content(f"Email akun pelanggan: {ticket['customer_email']}\nToko: {ticket['store_name']}\nPeran: {ticket['role']}\nVersi aplikasi: {ticket['app_version']}\nNomor dukungan: {ticket['reference']}\n\n{ticket['message']}")
    context = ssl.create_default_context()
    if settings['security'] == 'ssl':
        connection = smtplib.SMTP_SSL(settings['host'], settings['port'], timeout=8, context=context)
    else:
        connection = smtplib.SMTP(settings['host'], settings['port'], timeout=8)
    with connection as smtp:
        if settings['security'] == 'starttls':
            smtp.ehlo(); smtp.starttls(context=context); smtp.ehlo()
        smtp.login(settings['user'], settings['password'])
        # Any uncertain result is retained for inspection, never automatically resent.
        rejected = smtp.send_message(email, from_addr=RECIPIENT, to_addrs=[RECIPIENT])
        if rejected: raise smtplib.SMTPRecipientsRefused(rejected)


def public(ticket):
    return {key: ticket[key] for key in ('request_id', 'reference', 'customer_email', 'status')}


@router.get('/context')
async def context(user: dict = Depends(get_billing_user)):
    return {'customer_email': user['email'], 'store_name': user.get('store_name', ''),
            'recipient': RECIPIENT, 'delivery_ready': mail_settings() is not None}


@router.get('/requests/{request_id}')
async def status(request_id: UUID, user: dict = Depends(get_billing_user)):
    row = await get_db().support_tickets.find_one({'user_id': user['id'], 'store_id': user['store_id'], 'request_id': str(request_id)})
    if not row: raise HTTPException(404, 'Permintaan dukungan tidak ditemukan.')
    return public(row)


@router.post('/requests')
async def create(payload: SupportRequest, user: dict = Depends(get_billing_user)):
    db = get_db(); request_id = str(payload.request_id)
    settings = mail_settings()
    if settings:
        # Create the namespace before concurrent transactions can first insert it.
        await db.support_tickets.create_index([('user_id', 1), ('created_at', -1)])
    binding = {'subject': payload.subject, 'message': payload.message, 'app_version': payload.app_version, 'store_id': user['store_id']}
    fingerprint = hashlib.sha256(json.dumps(binding, sort_keys=True).encode()).hexdigest()
    key = f"{user['id']}:{request_id}"

    async def reserve(session):
        existing = await db.support_tickets.find_one({'_id': key}, session=session)
        if existing:
            if existing['fingerprint'] != fingerprint: raise HTTPException(409, 'Isi permintaan berubah. Periksa status permintaan sebelumnya.')
            return existing, False
        if not settings: raise HTTPException(503, 'Pengiriman dukungan belum tersedia. Pesan belum dikirim; silakan coba lagi nanti.')
        # Lock the existing authenticated account; concurrent upserts into a new
        # guard collection can conflict before the first transaction commits.
        account = await db.users.update_one({'id': user['id']}, {'$inc': {'support_revision': 1}}, session=session)
        if not account.matched_count: raise HTTPException(401, 'Akun tidak lagi tersedia.')
        since = (utcnow() - timedelta(hours=1)).isoformat()
        if await db.support_tickets.count_documents({'user_id': user['id'], 'created_at': {'$gte': since}}, session=session) >= 5:
            raise HTTPException(429, 'Maksimal 5 permintaan per jam. Tunggu sebelum mengirim lagi.')
        row = {'_id': key, 'request_id': request_id, 'reference': 'GRS-' + request_id.upper(), 'user_id': user['id'],
               'customer_email': user['email'], 'store_name': user.get('store_name', ''), 'role': user['role'],
               **binding, 'fingerprint': fingerprint, 'status': 'sending', 'created_at': utcnow().isoformat()}
        await db.support_tickets.insert_one(row, session=session)
        return row, True

    row, first = await transactions.run_transaction(db, reserve)
    if not first: return public(row)
    try:
        await asyncio.to_thread(send_message, row, settings)
        state = 'accepted'
    except (OSError, smtplib.SMTPException):
        state = 'uncertain'
    await db.support_tickets.update_one({'_id': key}, {'$set': {'status': state, 'checked_at': utcnow().isoformat()}})
    return public({**row, 'status': state})
