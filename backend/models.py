"""Geraina POS by DagangOS - Backend Models."""
from datetime import datetime, timezone
from typing import List, Optional, Any, Annotated
import uuid
from pydantic import BaseModel, EmailStr, Field, BeforeValidator, ConfigDict


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
    name: str
    sku: Optional[str] = None
    price: float = Field(ge=0)
    cost: float = Field(default=0, ge=0)
    stock: int = Field(default=0, ge=0)
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
    price: Optional[float] = None
    cost: Optional[float] = None
    stock: Optional[int] = None
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
    product_id: str
    name: str
    price: float
    quantity: int = Field(ge=1)
    subtotal: float


class OrderCreate(BaseModel):
    items: List[OrderLineItem]
    payment_method: str  # cash | qris | ewallet
    ewallet_channel: Optional[str] = None  # ID_OVO | ID_DANA | ID_SHOPEEPAY | ID_LINKAJA
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    discount: float = 0
    tax_percent: float = 0
    cash_received: Optional[float] = None
    note: Optional[str] = None


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
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)


# ---------- Bulk import ----------
class BulkImportResult(BaseModel):
    inserted: int
    updated: int
    skipped: int
    errors: List[str] = []
