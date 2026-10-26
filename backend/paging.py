"""Bounded, opaque cursor parsing. Cursors never replace a store filter."""
import base64
import json
from fastapi import HTTPException


def encode_cursor(value):
    return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).decode().rstrip('=')


def decode_cursor(value, keys):
    try:
        if not value or len(value) > 1000:
            raise ValueError()
        result = json.loads(base64.b64decode(value + '=' * (-len(value) % 4), altchars=b'-_', validate=True))
        if not isinstance(result, dict) or set(result) != set(keys) or any(not isinstance(result[key], str) or not result[key] or len(result[key]) > 200 for key in keys):
            raise ValueError()
        return result
    except (ValueError, TypeError, UnicodeError):
        raise HTTPException(400, 'Penanda halaman tidak valid. Muat ulang daftar.')
