"""Kirim WhatsApp resmi via Meta Cloud API (WhatsApp Business Platform).

Kredensial per-toko dari `integrations.whatsapp = {is_active, phone_number_id, access_token,
webhook_verify_token, template_receipt, template_po}` (BYO -- tiap toko punya WhatsApp
Business Account & App Meta sendiri).

Pesan yang diinisiasi TOKO (struk otomatis setelah checkout, notifikasi PO ke supplier) WAJIB
pakai template pesan yang sudah disetujui Meta -- pesan bebas ("text") cuma sah di dalam jendela
sesi 24 jam setelah pelanggan/supplier mengirim pesan duluan, dan struk/PO di sini dikirim
proaktif oleh toko tanpa pesan masuk dulu. Karena itu `send_meta_message` (template) adalah
jalur utama; `send_text_message` cuma untuk balasan di dalam sesi aktif (mis. auto-reply ke
whatsapp_inbound).

SYNC: KEEP IN SYNC dengan DapurOS/backend/whatsapp_client.py.
"""
import os
import httpx

# Verify this against developers.facebook.com/docs/graph-api/changelog before relying on it
# long-term -- Meta deprecates Graph API versions on a rolling schedule, this is not something
# to trust from memory once it's been a while since this file was last touched.
GRAPH_API_VERSION = os.environ.get("META_GRAPH_API_VERSION", "v21.0")
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

# Both templates below are custom (not from Meta's template library) and NOT yet submitted for
# approval. Considered using library templates instead (order_management_no_cta_5,
# payment_confirmation_4) to skip the approval wait, but both had real costs that outweighed the
# speed: English-only copy in a 100% Indonesian product, wrong tense ("awaiting payment approval"
# for a sale already paid at the counter), a CTA button pointing at an order-detail page that
# doesn't exist yet, and a typed {{amount}} currency parameter this client doesn't support.
# Real sending is separately blocked on the Meta test-number issue documented in the PRD, so
# there's no time pressure forcing a stopgap choice here -- submit these for approval now while
# that other blocker gets resolved. Utility-category, text-only, no-button templates like these
# are typically Meta's fastest approval tier.
TEMPLATE_RECEIPT_NAME_DEFAULT = "dagangos_order_receipt"
TEMPLATE_RECEIPT_LANG_DEFAULT = "id"
TEMPLATE_RECEIPT_BODY_ID = (
    "*Struk {{1}}* - {{2}}\n"
    "Total: Rp {{3}}\n"
    "Metode: {{4}}\n\n"
    "Terima kasih atas kunjungan Anda!"
)  # params: order_no, store_name, total_str, payment_method

TEMPLATE_PO_NAME_DEFAULT = "dagangos_po_notify"
TEMPLATE_PO_LANG_DEFAULT = "id"
TEMPLATE_PO_BODY_ID = (
    "*Purchase Order {{1}}*\n"
    "Dari: {{2}}\n"
    "Kepada: {{3}}\n"
    "Total: Rp {{4}}\n"
    "Status: {{5}}\n\n"
    "Mohon diproses. Terima kasih."
)  # params: po_no, store_name, supplier_name, total_str, status


def _normalize_phone(p: str) -> str:
    """Rapikan nomor ke format internasional tanpa '+': 08xx -> 628xx."""
    if not p:
        return ""
    s = "".join(ch for ch in str(p) if ch.isdigit())
    if s.startswith("0"):
        s = "62" + s[1:]
    return s


async def get_wa_config(db, store_id: str) -> dict:
    doc = await db.integrations.find_one({"store_id": store_id}, {"_id": 0})
    return (doc or {}).get("whatsapp") or {}


def _extract_error(body) -> str | None:
    if isinstance(body, dict):
        err = body.get("error") or {}
        return err.get("error_user_msg") or err.get("message")
    return None


async def send_meta_message(cfg: dict, target: str, template_name: str, params: list, lang: str = "id") -> dict:
    """Best-effort. TIDAK melempar error -- kegagalan WA tak boleh membatalkan transaksi
    (checkout / pembuatan PO harus tetap sukses walau notifikasi WA gagal).

    `params` diisi berurutan sesuai placeholder {{1}}, {{2}}, ... di body template yang sudah
    disetujui Meta untuk `template_name`. Template harus dibuat & disetujui dulu di Meta
    Business Manager sebelum fungsi ini bisa benar-benar mengirim apa pun -- lihat
    BACKEND-PRD-PRODUCTION-GAPS-2026-07-10.md bagian 5 untuk detail & status akun saat ini.
    """
    if not cfg or not cfg.get("is_active"):
        return {"sent": False, "reason": "disabled"}
    phone_number_id = (cfg.get("phone_number_id") or "").strip()
    access_token = (cfg.get("access_token") or "").strip()
    tgt = _normalize_phone(target)
    if not phone_number_id or not access_token:
        return {"sent": False, "reason": "not_configured"}
    if not tgt:
        return {"sent": False, "reason": "no_target"}
    if not template_name:
        return {"sent": False, "reason": "no_template"}

    payload = {
        "messaging_product": "whatsapp",
        "to": tgt,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": lang},
        },
    }
    if params:
        payload["template"]["components"] = [{
            "type": "body",
            "parameters": [{"type": "text", "text": str(p)} for p in params],
        }]

    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                f"{GRAPH_BASE}/{phone_number_id}/messages",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json=payload,
            )
        http_ok = r.status_code < 400
        body = None
        try:
            body = r.json()
        except Exception:
            body = None
        wamid = None
        if http_ok and isinstance(body, dict):
            msgs = body.get("messages") or []
            if msgs:
                wamid = msgs[0].get("id")
        reason = None if http_ok else (_extract_error(body) or f"http {r.status_code}")
        return {"sent": http_ok, "status": r.status_code, "reason": reason, "wamid": wamid}
    except Exception as e:
        return {"sent": False, "reason": str(e)}


async def send_text_message(cfg: dict, target: str, message: str) -> dict:
    """Balasan teks bebas -- HANYA sah di dalam jendela sesi 24 jam (kontak sudah kirim pesan
    duluan). Jangan pakai ini untuk notifikasi yang diinisiasi toko -- Meta akan menolaknya di
    luar jendela sesi. Pakai `send_meta_message` (template) untuk notifikasi proaktif."""
    if not cfg or not cfg.get("is_active"):
        return {"sent": False, "reason": "disabled"}
    phone_number_id = (cfg.get("phone_number_id") or "").strip()
    access_token = (cfg.get("access_token") or "").strip()
    tgt = _normalize_phone(target)
    if not phone_number_id or not access_token or not tgt:
        return {"sent": False, "reason": "not_configured_or_no_target"}

    payload = {"messaging_product": "whatsapp", "to": tgt, "type": "text", "text": {"body": message}}
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                f"{GRAPH_BASE}/{phone_number_id}/messages",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json=payload,
            )
        http_ok = r.status_code < 400
        body = None
        try:
            body = r.json()
        except Exception:
            pass
        reason = None if http_ok else (_extract_error(body) or f"http {r.status_code}")
        return {"sent": http_ok, "status": r.status_code, "reason": reason}
    except Exception as e:
        return {"sent": False, "reason": str(e)}
