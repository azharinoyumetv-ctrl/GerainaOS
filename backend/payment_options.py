"""Public checkout readiness from each store's settings and own credentials."""
from fastapi import HTTPException
from plan_limits import plan_rank

EWALLETS = {'OVO': 'OVO', 'DANA': 'DANA', 'SHOPEEPAY': 'ShopeePay', 'LINKAJA': 'LinkAja'}


def section(document, name):
    value = (document or {}).get(name)
    return value if isinstance(value, dict) else {}


async def payment_options(db, user):
    scope = {'store_id': user['store_id']}
    config = await db.payments_config.find_one(scope, {'_id': 0}) or {}
    integrations = await db.integrations.find_one(scope, {'_id': 0}) or {}
    bank = await db.bank_qris_configs.find_one(scope, {'_id': 0}) or {}
    xendit, doku, wallet = section(integrations, 'xendit'), section(integrations, 'doku'), section(config, 'ewallet')
    pro = plan_rank(user.get('plan')) >= plan_rank('pro')
    xendit_ready = pro and xendit.get('is_active') is True and all(str(xendit.get(key) or '').strip() for key in ('secret_key', 'webhook_token'))
    doku_ready = pro and doku.get('is_active') is True and all(str(doku.get(key) or '').strip() for key in ('client_id', 'shared_key'))
    provider_ok = str(wallet.get('provider') or 'Xendit').lower() == 'xendit'
    channels = section(wallet, 'channels')
    enabled_channels = [{'code': code, 'label': label} for code, label in EWALLETS.items() if channels.get(label, channels.get(code, True)) is True]
    # Existing configured merchants remain usable when no explicit preference was saved.
    wallet_on = wallet.get('is_active', xendit_ready) is True
    wallet_ready = xendit_ready and provider_ok and wallet_on and bool(enabled_channels)
    method = lambda enabled, reason: {'enabled': bool(enabled), 'reason': '' if enabled else reason}
    return {'schema_version': 1, 'methods': {
        'cash': method(section(config, 'cash').get('is_active', True) is True, 'Tunai dinonaktifkan oleh Owner.'),
        'qris_bank': method(bank.get('is_active') is True and bool(bank.get('qr_payload')), 'Owner perlu mengaktifkan QRIS bank toko.'),
        'ewallet': method(wallet_ready, 'Aktifkan E-Wallet Xendit, kanal yang didukung dan kredensial toko pada paket Pro/Business.'),
        'doku': method(doku_ready, 'Owner perlu mengaktifkan DOKU dengan kredensial toko pada paket Pro/Business.'),
    }, 'ewallet_channels': enabled_channels if wallet_ready else [],
        'legacy_qris_enabled': bool(xendit_ready)}


async def require_payment_method(db, user, method, channel=None):
    options = await payment_options(db, user)
    allowed = options['legacy_qris_enabled'] if method == 'qris' else options['methods'].get(method, {}).get('enabled', False)
    if not allowed:
        raise HTTPException(400, options['methods'].get(method, {}).get('reason') or 'Metode pembayaran ini belum tersedia atau belum diaktifkan.')
    if method == 'ewallet':
        code = str(channel or '').upper().removeprefix('ID_')
        if code not in {row['code'] for row in options['ewallet_channels']}:
            raise HTTPException(400, 'Kanal E-Wallet tidak diaktifkan untuk toko ini.')
        return code
    return channel
