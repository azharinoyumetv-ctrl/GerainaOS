"""Public checkout readiness from each store's settings and own credentials."""
from fastapi import HTTPException
from plan_limits import plan_rank
from merchant_checkout import GATEWAYS, provider_name, selected_channels, public_gateways

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
    result = {'schema_version': 2, 'methods': {
        'cash': method(section(config, 'cash').get('is_active', True) is True, 'Tunai dinonaktifkan oleh Owner.'),
        'qris_bank': method(bank.get('is_active') is True and bool(bank.get('qr_payload')), 'Owner perlu mengaktifkan QRIS bank toko.'),
        'ewallet': method(wallet_ready, 'Aktifkan E-Wallet Xendit, kanal yang didukung dan kredensial toko pada paket Pro/Business.'),
        'doku': method(doku_ready, 'Owner perlu mengaktifkan DOKU dengan kredensial toko pada paket Pro/Business.'),
    }, 'ewallet_channels': enabled_channels if wallet_ready else [],
        'legacy_qris_enabled': bool(xendit_ready), 'gateways': public_gateways()}
    readiness = {}
    for name, definition in GATEWAYS.items():
        credentials = section(integrations, name)
        readiness[name] = {'configured': credentials.get('is_active') is True and all(str(credentials.get(k) or '').strip() for k in definition['credentials']),
                           'plan_allowed': pro}
    result['gateway_readiness'] = readiness
    result['methods']['cash']['displayed'] = result['methods']['cash']['enabled']
    qris_display = section(config, 'qris_bank').get('is_active', bank.get('is_active') is True) is True
    result['methods']['qris_bank'].update(displayed=qris_display,
        enabled=qris_display and result['methods']['qris_bank']['enabled'], setup_path='/geraina/app/integrations/qris')
    if not qris_display:
        result['methods']['qris_bank']['reason'] = 'QRIS bank tidak ditampilkan oleh Owner.'
    for name in ('ewallet', 'va', 'credit_card'):
        settings = section(config, name)
        if name == 'ewallet':
            settings = {'provider': 'Xendit', 'is_active': wallet_on, **settings}
        provider = provider_name(settings)
        selected = settings.get('is_active') is True
        allowed = selected_channels(name, settings, provider)
        ready = readiness.get(provider, {})
        enabled = selected and ready.get('configured') and ready.get('plan_allowed') and bool(allowed)
        reason = ('Metode ini tidak ditampilkan oleh Owner.' if not selected else
                  'Pilih gateway di Pembayaran.' if provider not in GATEWAYS else
                  'Gateway tersedia pada paket Pro/Business.' if not pro else
                  f"Lengkapi integrasi {GATEWAYS[provider]['label']} toko." if not ready.get('configured') else
                  'Pilih minimal satu kanal pembayaran.' if not allowed else '')
        result['methods'][name] = {**method(enabled, reason), 'displayed': selected, 'provider': provider,
                                   'channels': allowed, 'setup_path': f'/geraina/app/integrations/{provider}' if provider in GATEWAYS else f'/geraina/app/payments/{name.replace("_", "-")}' }
    result['ewallet_channels'] = result['methods']['ewallet']['channels'] if result['methods']['ewallet']['enabled'] and result['methods']['ewallet']['provider'] == 'xendit' else []
    # Preserve an existing working checkout until the Owner selects category-specific
    # gateway methods. No unconfigured gateway is ever added to the cashier.
    result['methods']['doku'].update(displayed=bool(doku_ready), provider='doku')
    if config.get('checkout_policy_version') == 2:
        result['methods']['doku'].update(enabled=False, displayed=False, reason='Gunakan metode yang dipilih Owner di Pembayaran.')
    return result


async def require_payment_method(db, user, method, channel=None, options=None):
    options = options or await payment_options(db, user)
    allowed = options['legacy_qris_enabled'] if method == 'qris' else options['methods'].get(method, {}).get('enabled', False)
    if not allowed:
        raise HTTPException(400, options['methods'].get(method, {}).get('reason') or 'Metode pembayaran ini belum tersedia atau belum diaktifkan.')
    if method == 'ewallet' and options['methods'][method].get('provider') == 'xendit':
        code = str(channel or '').upper().removeprefix('ID_')
        if code not in {row['code'] for row in options['ewallet_channels']}:
            raise HTTPException(400, 'Kanal E-Wallet tidak diaktifkan untuk toko ini.')
        return code
    return channel
