"""EDC (kartu debit/kredit via mesin EDC bank) -- pluggable provider architecture.

No bank EDC SDK is wired in here: each bank (BCA, Mandiri, BRI, BNI) requires its own SDK, a
signed merchant agreement, and a certification process with the bank before any real card
transaction can be processed. That isn't something that can be faked or guessed at without an
actual SDK and bank sign-off in hand -- so this module builds the pluggable CONTRACT every real
provider must implement, plus:
  - a SIMULATOR provider for local development/testing only, hard-gated behind an explicit
    server-side env var (EDC_ALLOW_SIMULATOR) so a store owner can never enable it themselves
    and it can never silently substitute for a real card charge in production. It is
    deliberately NOT selectable from the Settings UI.
  - honest STUB providers for each bank that return a clear "not configured" error until a
    real SDK is dropped in -- same "configured or honest, never fake" principle used for the
    WhatsApp and payment-gateway integrations elsewhere in this codebase.

When a real bank SDK becomes available, implement a new class with the same charge/void/status
methods, register it in PROVIDERS, and nothing else in the order flow needs to change.
"""
from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Protocol


class EDCResult:
    def __init__(
        self,
        success: bool,
        provider: str,
        transaction_id: Optional[str] = None,
        approval_code: Optional[str] = None,
        card_type: Optional[str] = None,
        last4: Optional[str] = None,
        raw: Optional[dict] = None,
        error: Optional[str] = None,
    ):
        self.success = success
        self.provider = provider
        self.transaction_id = transaction_id
        self.approval_code = approval_code
        self.card_type = card_type
        self.last4 = last4
        self.raw = raw or {}
        self.error = error

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "provider": self.provider,
            "transaction_id": self.transaction_id,
            "approval_code": self.approval_code,
            "card_type": self.card_type,
            "last4": self.last4,
            "error": self.error,
        }


class EDCProvider(Protocol):
    """Contract every real bank EDC integration must implement."""
    name: str

    async def charge(self, amount: int, order_ref: str) -> EDCResult: ...
    async def void(self, transaction_id: str) -> EDCResult: ...
    async def status(self, transaction_id: str) -> EDCResult: ...


class NotConfiguredProvider:
    """Honest stub for a bank whose SDK isn't wired in yet -- every method fails clearly
    instead of pretending to process a card."""

    def __init__(self, name: str):
        self.name = name

    async def charge(self, amount: int, order_ref: str) -> EDCResult:
        return EDCResult(False, self.name, error=f"Integrasi EDC {self.name} belum tersedia -- SDK & sertifikasi bank belum terpasang.")

    async def void(self, transaction_id: str) -> EDCResult:
        return EDCResult(False, self.name, error=f"Integrasi EDC {self.name} belum tersedia.")

    async def status(self, transaction_id: str) -> EDCResult:
        return EDCResult(False, self.name, error=f"Integrasi EDC {self.name} belum tersedia.")


class SimulatorProvider:
    """Dev/test-only simulator. MUST be explicitly enabled via the server env var
    EDC_ALLOW_SIMULATOR=true -- never active by default, and never exposed as a choice in the
    merchant-facing Settings UI, so a store owner cannot self-enable a fake-always-approved
    card payment path in production."""

    name = "simulator"

    async def charge(self, amount: int, order_ref: str) -> EDCResult:
        return EDCResult(
            True,
            self.name,
            transaction_id=f"SIM-{uuid.uuid4().hex[:10].upper()}",
            approval_code=str(uuid.uuid4().int)[:6],
            card_type="debit",
            last4="0000",
            raw={"simulated": True, "amount": amount, "order_ref": order_ref, "at": datetime.now(timezone.utc).isoformat()},
        )

    async def void(self, transaction_id: str) -> EDCResult:
        return EDCResult(True, self.name, transaction_id=transaction_id, raw={"simulated": True, "voided": True})

    async def status(self, transaction_id: str) -> EDCResult:
        return EDCResult(True, self.name, transaction_id=transaction_id, raw={"simulated": True})


BANK_LABELS = {"bca": "BCA", "mandiri": "Mandiri", "bri": "BRI", "bni": "BNI"}


def get_edc_provider(provider_id: str) -> EDCProvider:
    provider_id = (provider_id or "").lower().strip()
    if provider_id == "simulator":
        if os.environ.get("EDC_ALLOW_SIMULATOR", "").lower() not in ("1", "true", "yes"):
            return NotConfiguredProvider("simulator (disabled)")
        return SimulatorProvider()
    label = BANK_LABELS.get(provider_id)
    if not label:
        return NotConfiguredProvider(provider_id or "(belum dipilih)")
    return NotConfiguredProvider(label)
