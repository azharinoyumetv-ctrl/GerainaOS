"""Geraina POS by DagangOS - Backend Models."""
from datetime import datetime, timezone
from typing import List, Optional, Any, Annotated, Literal
import uuid
from pydantic import BaseModel, EmailStr, Field, BeforeValidator, ConfigDict, model_validator, AliasChoices


def _to_str(v: Any) -> str:
    return str(v) if v is not None else v


PyObjectId = Annotated[str, BeforeValidator(_to_str)]


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Auth & Store ----------
class StoreCreate(BaseModel):
    name: str
    owner_email: EmailStr
    owner_password: str = Field(min_length=6)


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    store_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    role: str
    store_id: str
    store_name: str
    trial_ends_at: Optional[str] = None
    plan: str = "trial"


# ---------- Products ----------
class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    sku: Optional[str] = Field(default=None, max_length=200)
    price: float = Field(ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    cost: float = Field(default=0, ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    stock: int = Field(default=0, ge=0, le=1000000000)
    category: Optional[str] = "Umum"
    unit: Optional[str] = "pcs"
    image_url: Optional[str] = None
    description: Optional[str] = None
    active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    cost: Optional[float] = Field(default=None, ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    stock: Optional[int] = Field(default=None, ge=0)
    expected_stock: Optional[int] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None


class Product(ProductBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)


# ---------- POS / Orders ----------
class OrderLineItem(BaseModel):
    product_id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    quantity: int = Field(ge=1, le=100000)
    subtotal: float = Field(ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    unit_cost: Optional[float] = Field(default=None, ge=0, le=1_000_000_000_000, allow_inf_nan=False)

    @model_validator(mode='after')
    def consistent_subtotal(self):
        from decimal import Decimal, ROUND_HALF_UP
        calculated = (Decimal(str(self.price)) * self.quantity).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if abs(Decimal(str(self.subtotal)) - calculated) > Decimal('0.000001'):
            raise ValueError('Subtotal produk tidak cocok dengan harga dan jumlah.')
        self.subtotal = float(calculated)
        return self


class OrderCreate(BaseModel):
    items: List[OrderLineItem] = Field(min_length=1, max_length=500)
    payment_method: str
    ewallet_channel: Optional[str] = None
    customer_id: Optional[str] = Field(default=None, max_length=200)
    customer_name: Optional[str] = Field(default=None, max_length=200)
    customer_phone: Optional[str] = Field(default=None, max_length=64)
    customer_email: Optional[str] = Field(default=None, max_length=254)
    discount: float = Field(default=0, ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    tax_percent: float = Field(default=0, ge=0, le=100, allow_inf_nan=False)
    cash_received: Optional[float] = Field(default=None, ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    note: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode='after')
    def cash_amount_required(self):
        if self.payment_method == 'cash' and self.cash_received is None:
            raise ValueError('Nominal tunai diterima wajib diisi.')
        return self


class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    cashier_id: str
    cashier_email: str
    order_no: str
    items: List[OrderLineItem]
    subtotal: float
    discount: float = 0
    tax_percent: float = 0
    tax_amount: float = 0
    total: float
    payment_method: str
    payment_status: str = "pending"  # pending | paid | failed | voided
    ewallet_channel: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    cash_received: Optional[float] = None
    change: Optional[float] = None
    note: Optional[str] = None
    xendit_id: Optional[str] = None
    xendit_qr_string: Optional[str] = None
    xendit_checkout_url: Optional[str] = None
    xendit_reference_id: Optional[str] = None
    xendit_raw: Optional[dict] = None
    bank_qris: Optional[dict] = None
    payment_confirmation: Optional[dict] = None
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)


# ---------- Bulk import ----------
class BulkImportResult(BaseModel):
    inserted: int
    updated: int
    skipped: int
    errors: List[str] = []


# ---------- Expanded Modules Models ----------

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class Category(CategoryBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)

class BrandBase(BaseModel):
    name: str
    description: Optional[str] = None

class Brand(BrandBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)

class UnitBase(BaseModel):
    name: str
    short_name: str

class Unit(UnitBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)

class StockAdjustmentCreate(BaseModel):
    product_id: Optional[str] = Field(default=None, max_length=200)
    product_name: str = Field(default='', max_length=200)
    sku: Optional[str] = Field(default=None, max_length=200)
    adjustment_qty: int = Field(ge=1, le=100000)
    type: Literal['add', 'sub']
    reason: str = Field(min_length=1, max_length=1000)
    created_by: str = Field(default='', max_length=200)
    request_id: Optional[str] = Field(default=None, min_length=1, max_length=200)

class StockAdjustment(StockAdjustmentCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)

class StockTransferItem(BaseModel):
    product_id: str = Field(min_length=1, max_length=200)
    name: str = Field(default='', max_length=200)
    qty: int = Field(ge=1, le=100000)

class StockTransferCreate(BaseModel):
    from_branch: str = Field(min_length=1, max_length=200)
    to_branch: str = Field(min_length=1, max_length=200)
    items: List[StockTransferItem] = Field(min_length=1, max_length=500)
    status: Literal['Shipped'] = 'Shipped'
    request_id: Optional[str] = Field(default=None, min_length=1, max_length=200)

class StockTransfer(BaseModel):
    id: str
    store_id: str
    from_branch: str
    to_branch: str
    from_branch_id: Optional[str] = None
    to_branch_id: Optional[str] = None
    items: list[dict]
    status: str
    inventory_applied: bool = False
    created_at: str = Field(default_factory=utcnow_iso)

class SupplierBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class Supplier(SupplierBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)

class PurchaseLine(BaseModel):
    product_id: str = Field(min_length=1, max_length=200)
    name: str = Field(default='', max_length=200)
    qty: int = Field(ge=1, le=100000, validation_alias=AliasChoices('qty', 'quantity'))
    cost: float = Field(ge=0, le=1_000_000_000_000, allow_inf_nan=False, validation_alias=AliasChoices('cost', 'price'))
    received_qty: int = Field(default=0, ge=0)

class PurchaseOrderCreate(BaseModel):
    po_no: str = Field(min_length=1, max_length=200)
    supplier_id: str
    supplier_name: str = ''
    items: List[PurchaseLine] = Field(default_factory=list)
    total: float = Field(ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    status: str = 'Ordered'

class PurchaseOrder(PurchaseOrderCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)

class ReceivingLine(BaseModel):
    product_id: str = Field(min_length=1, max_length=200)
    qty: int = Field(ge=1, le=100000)

class GoodsReceivingCreate(BaseModel):
    po_no: str = Field(min_length=1, max_length=200)
    gr_no: str = Field(default='', max_length=200)
    received_by: str = Field(default='', max_length=200)
    received_at: str = Field(default_factory=utcnow_iso)
    items: Optional[List[ReceivingLine]] = Field(default=None, min_length=1, max_length=500)
    request_id: Optional[str] = Field(default=None, min_length=1, max_length=200)

class GoodsReceiving(BaseModel):
    id: str
    store_id: str
    po_no: str
    gr_no: str
    received_by: str
    received_at: str
    items: list[dict] = Field(default_factory=list)
    inventory_applied: bool = False

class SupplierInvoiceCreate(BaseModel):
    invoice_no: str = Field(min_length=1, max_length=200)
    po_no: str = Field(default='', max_length=200)
    supplier_id: Optional[str] = None
    amount: float = Field(gt=0, le=1_000_000_000_000, allow_inf_nan=False)
    status: Literal['Unpaid','Paid'] = 'Unpaid'
    due_date: str

class SupplierInvoice(SupplierInvoiceCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    status: str = 'Unpaid'
    paid_amount: float = 0
    created_at: str = Field(default_factory=utcnow_iso)

class SupplierInvoiceUpdate(BaseModel):
    status: Literal['Unpaid','Paid']

class CustomerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    membership_tier: Optional[str] = "Bronze"
    loyalty_points: int = Field(default=0, ge=0, le=1000000000)
    expected_loyalty_points: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None

class Customer(CustomerBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)

class MembershipBase(BaseModel):
    name: str
    min_points: int
    discount_percent: float
    description: Optional[str] = None

class Membership(MembershipBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str

class LoyaltyRules(BaseModel):
    conversion_rate: int = Field(default=10000, ge=1, le=1000000000)
    point_value: int = Field(default=100, ge=1, le=1000000)
    min_redeem_points: int = Field(default=50, ge=1, le=1000000)

class DebtReceivableCreate(BaseModel):
    customer_name: str
    phone: Optional[str] = None
    order_no: str
    amount: float = Field(gt=0, le=1_000_000_000_000, allow_inf_nan=False)
    paid_amount: float = Field(default=0, ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    due_date: str
    status: str = "Unpaid"  # Unpaid | Partial | Paid

class DebtReceivable(DebtReceivableCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str

class DebtReceivableUpdate(BaseModel):
    """Partial update -- used to record a payment/settlement against an existing
    receivable without re-submitting the full record."""
    paid_amount: Optional[float] = Field(default=None, ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    expected_paid_amount: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False)
    status: Optional[str] = None

class DebtPayableCreate(BaseModel):
    supplier_name: str
    invoice_no: str
    amount: float = Field(gt=0, le=1_000_000_000_000, allow_inf_nan=False)
    paid_amount: float = Field(default=0, ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    due_date: str
    status: str = "Unpaid"

class DebtPayable(DebtPayableCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str

class DebtPayableUpdate(BaseModel):
    paid_amount: Optional[float] = Field(default=None, ge=0, le=1_000_000_000_000, allow_inf_nan=False)
    expected_paid_amount: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False)
    status: Optional[str] = None

class StaffBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    phone: Optional[str] = None
    status: str = "Aktif"

class Staff(StaffBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    user_id: Optional[str] = None
    login_enabled: bool = False
    must_change_password: bool = False
    credential_reset_required: bool = False
    is_owner_account: bool = False
    created_at: str = Field(default_factory=utcnow_iso)

class StaffCreate(StaffBase):
    model_config = ConfigDict(extra="forbid")
    role: Literal["Manager", "Cashier", "Warehouse"]
    status: Literal["Aktif", "Non-Aktif"] = "Aktif"
    initial_password: str = Field(min_length=10, max_length=128)

class StaffUpdate(StaffBase):
    model_config = ConfigDict(extra="forbid")
    role: Literal["Manager", "Cashier", "Warehouse"]
    status: Literal["Aktif", "Non-Aktif"] = "Aktif"
    initial_password: Optional[str] = Field(default=None, min_length=10, max_length=128)

class AttendanceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

class AttendanceCheckIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: uuid.UUID

class AttendanceCheckOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    attendance_id: str = Field(min_length=1, max_length=100)

class Attendance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    staff_name: str
    clock_in: str
    clock_out: Optional[str] = None
    status: str = "Hadir"
    user_id: Optional[str] = None
    staff_id: Optional[str] = None
    is_open: Optional[bool] = None
    work_date: Optional[str] = None
    timezone: Optional[str] = None
    created_by: Optional[str] = None
    check_in_request_id: Optional[str] = None
    closed_by: Optional[str] = None
    legacy_unassigned: bool = False

class BranchBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None

class Branch(BranchBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)

# ---------- Devices (real, plan-capped device/seat registration) ----------
# Replaces the previous LicenseDevices.jsx page, which showed hardcoded mock rows with no
# backend behind them -- not acceptable for a live production app. `device_id` is a
# client-generated UUID persisted in the browser's localStorage (not the Mongo `id`), so the
# same browser re-registering updates its existing row instead of consuming another seat.
class DeviceCreate(BaseModel):
    device_id: str
    name: str
    user_agent: Optional[str] = None

class Device(DeviceCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    status: str = "Aktif"
    created_at: str = Field(default_factory=utcnow_iso)
    last_seen_at: Optional[str] = None

# ---------- Expenses (for P&L / cashflow reporting) ----------
class ExpenseCreate(BaseModel):
    category: str  # e.g. "Sewa", "Gaji", "Listrik", "Bahan Baku", "Lainnya"
    description: Optional[str] = None
    amount: float = Field(gt=0)
    expense_date: str  # ISO date the expense was incurred (not necessarily today)

class Expense(ExpenseCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=utcnow_iso)
