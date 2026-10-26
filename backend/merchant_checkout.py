"""Hosted merchant checkout. Credentials and allowed channels come from this store only.

References: Xendit /sessions (PAYMENT_LINK), Midtrans Snap enabled_payments,
DOKU Checkout payment_method_types. No platform subscription credentials are used.
"""
import httpx
from urllib.parse import urlparse
from xendit_client import PaymentNotConfiguredError
from doku_client import create_doku_checkout

GATEWAYS = {
    'xendit': {
        'label': 'Xendit', 'credentials': ('secret_key', 'webhook_token'),
        'ewallet': {'OVO': 'OVO', 'DANA': 'DANA', 'ShopeePay': 'SHOPEEPAY', 'LinkAja': 'LINKAJA'},
        'va': {bank: bank.upper() + '_VIRTUAL_ACCOUNT' for bank in ('BCA', 'BNI', 'BRI', 'Mandiri', 'Permata')},
        'credit_card': {'Kartu': 'CARDS'},
    },
    'midtrans': {
        'label': 'Midtrans', 'credentials': ('server_key',),
        'ewallet': {'GoPay': 'gopay', 'ShopeePay': 'shopeepay'},
        'va': {'BCA': 'bca_va', 'BNI': 'bni_va', 'BRI': 'bri_va', 'Mandiri': 'echannel', 'Permata': 'permata_va'},
        'credit_card': {'Kartu': 'credit_card'},
    },
    'doku': {
        'label': 'DOKU', 'credentials': ('client_id', 'shared_key'),
        'ewallet': {'OVO': 'EMONEY_OVO', 'DANA': 'EMONEY_DANA', 'ShopeePay': 'EMONEY_SHOPEEPAY'},
        'va': {'BCA': 'VIRTUAL_ACCOUNT_BCA', 'BNI': 'VIRTUAL_ACCOUNT_BNI', 'BRI': 'VIRTUAL_ACCOUNT_BRI',
               'Mandiri': 'VIRTUAL_ACCOUNT_BANK_MANDIRI', 'Permata': 'VIRTUAL_ACCOUNT_BANK_PERMATA'},
        'credit_card': {'Kartu': 'CREDIT_CARD'},
    },
}


def provider_name(settings):
    return str((settings or {}).get('provider') or '').strip().lower()


def selected_channels(method, settings, provider):
    catalogue = GATEWAYS.get(provider, {}).get(method, {})
    preference = (settings or {}).get('banks' if method == 'va' else 'channels')
    preference = preference if isinstance(preference, dict) else {}
    return [{'label': label, 'code': code} for label, code in catalogue.items()
            if method == 'credit_card' or preference.get(label, preference.get(code, True)) is True]


def public_gateways():
    return {key: {'label': value['label'], 'methods': {method: list(value[method])
             for method in ('ewallet', 'va', 'credit_card')}} for key, value in GATEWAYS.items()}


def checkout_url(value):
    if not isinstance(value, str) or urlparse(value).scheme != 'https' or not urlparse(value).hostname:
        # A successful provider response with a missing link is uncertain, never retry a charge.
        raise ValueError('Penyedia belum mengembalikan tautan pembayaran yang valid.')
    return value


async def create_merchant_checkout(provider, cfg, order, channels):
    definition = GATEWAYS.get(provider)
    if not definition or cfg.get('is_active') is not True or not all(str(cfg.get(k) or '').strip() for k in definition['credentials']) or not channels:
        raise PaymentNotConfiguredError('Lengkapi integrasi gateway dan pilih kanal pembayaran toko.')
    reference = order['id']  # Globally unique, also used to route Midtrans notifications.
    amount = int(order['total'])
    return_url = f'https://dagangos.com/geraina/app/sales?order={reference}'
    if provider == 'doku':
        result = await create_doku_checkout(cfg={**cfg, 'payment_method_types': channels}, order_id=reference,
            amount=amount, callback_url=return_url, callback_url_result=return_url,
            customer_name=order.get('customer_name'), customer_email=order.get('customer_email'), customer_phone=order.get('customer_phone'))
        response = result.get('response', result)
        payment = response.get('payment') or {}
        return {'gateway_checkout_url': checkout_url(payment.get('url') or payment.get('checkout_url')),
                'gateway_reference': reference}
    if provider == 'xendit':
        base, endpoint, key = 'https://api.xendit.co', '/sessions', cfg['secret_key']
        body = {'reference_id': reference, 'session_type': 'PAY', 'mode': 'PAYMENT_LINK',
                'amount': amount, 'currency': 'IDR', 'country': 'ID', 'capture_method': 'AUTOMATIC',
                'allow_save_payment_method': 'DISABLED', 'allowed_payment_channels': channels,
                'success_return_url': return_url, 'cancel_return_url': return_url,
                'description': f"Geraina {order['order_no']}"}
    else:
        base = 'https://app.midtrans.com' if cfg.get('environment') == 'production' else 'https://app.sandbox.midtrans.com'
        endpoint, key = '/snap/v1/transactions', cfg['server_key']
        body = {'transaction_details': {'order_id': reference, 'gross_amount': amount},
                'enabled_payments': channels, 'credit_card': {'secure': True}, 'callbacks': {'finish': return_url}}
        details = {key: order.get(source) for key, source in [('first_name', 'customer_name'), ('email', 'customer_email'), ('phone', 'customer_phone')] if order.get(source)}
        if details:
            body['customer_details'] = details
    async with httpx.AsyncClient(base_url=base, auth=httpx.BasicAuth(key, ''), timeout=20) as client:
        response = await client.post(endpoint, json=body)
        response.raise_for_status()
        result = response.json()
    return {'gateway_checkout_url': checkout_url(result.get('payment_link_url') if provider == 'xendit' else result.get('redirect_url')),
            'gateway_reference': reference, 'gateway_session_id': result.get('payment_session_id') if provider == 'xendit' else result.get('token')}
