"""Kirim WhatsApp via gateway pihak ketiga (BYO — merchant pakai akun sendiri).

Default provider: Fonnte (plug & play Indonesia: scan QR di Fonnte -> dapat token ->
tempel di Pengaturan > Integrasi > WhatsApp). Juga mendukung Wablas.

Serverless-friendly: hanya HTTP POST per pesan (tanpa koneksi persisten), jadi jalan
di backend Vercel yang sudah ada — TANPA infra tambahan.

Kredensial per-toko dari `integrations.whatsapp = {is_active, provider, api_token}`.
"""
import httpx


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


async def send_whatsapp(cfg: dict, target: str, message: str) -> dict:
    """Best-effort. TIDAK melempar error — kegagalan WA tak boleh membatalkan transaksi."""
    if not cfg or not cfg.get("is_active"):
        return {"sent": False, "reason": "disabled"}
    token = (cfg.get("api_token") or "").strip()
    provider = (cfg.get("provider") or "fonnte").strip().lower()
    tgt = _normalize_phone(target)
    if not token or not tgt:
        return {"sent": False, "reason": "no_token_or_target"}
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            if "wablas" in provider:
                r = await c.post(
                    "https://console.wablas.com/api/send-message",
                    headers={"Authorization": token},
                    data={"phone": tgt, "message": message},
                )
            else:  # Fonnte (default)
                r = await c.post(
                    "https://api.fonnte.com/send",
                    headers={"Authorization": token},
                    data={"target": tgt, "message": message},
                )
        return {"sent": r.status_code < 400, "status": r.status_code, "resp": r.text[:200]}
    except Exception as e:
        return {"sent": False, "reason": str(e)}
