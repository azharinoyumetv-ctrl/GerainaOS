"""Customer-facing method names shared by PDF and thermal receipts."""
LABELS = {'cash': 'Tunai', 'qris': 'QRIS', 'qris_bank': 'QRIS bank', 'ewallet': 'E-Wallet',
          'va': 'Virtual Account', 'credit_card': 'Kartu Kredit', 'edc': 'Kartu EDC', 'doku': 'DOKU'}


def payment_label(method):
    return LABELS.get(method, method or '-')
