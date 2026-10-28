"""Reviewed Geraina data inventory and minimum-data retention projections."""
STORE_COLLECTIONS = frozenset({
    "addon_purchases", "attendance", "attendance_requests", "bank_qris_configs", "branches",
    "brands", "capacity_guards", "categories", "checkout_attempts", "customers", "debt_payables",
    "debt_payment_events", "debt_receivables", "devices", "expenses", "goods_receiving",
    "integrations", "loyalty_events", "loyalty_rules", "memberships", "orders", "payments_config",
    "products", "purchase_orders", "settings", "staff", "stock_adjustments", "stock_movements",
    "stock_transfers", "subscription_orders", "supplier_invoices", "suppliers", "support_tickets",
    "units", "upgrade_requests", "whatsapp_inbound",
})
IDENTITY_FIELDS = ("user_id", "owner_id", "owner_user_id", "cashier_id", "actor_id",
                   "created_by", "updated_by", "closed_by", "voided_by", "confirmed_by", "received_by", "staff_id")
PERSONAL_COLLECTIONS = frozenset({"staff", "attendance", "attendance_requests", "support_tickets", "devices"})
COMMON_FINANCE = {"created_at", "updated_at", "status", "amount", "total", "subtotal", "discount", "tax_amount", "tax_percent"}
RETENTION_FIELDS = {
    "orders": COMMON_FINANCE | {"order_no", "payment_method", "payment_status", "items", "cash_received", "change"},
    "subscription_orders": COMMON_FINANCE | {"module", "tier", "period", "expires_at"},
    "addon_purchases": COMMON_FINANCE | {"addon_id", "starts_at", "expires_at"},
    "expenses": COMMON_FINANCE | {"expense_date", "category"},
    "supplier_invoices": COMMON_FINANCE | {"invoice_no", "po_no", "due_date", "paid_amount"},
    "purchase_orders": COMMON_FINANCE | {"po_no"},
    "debt_receivables": COMMON_FINANCE | {"order_no", "paid_amount", "due_date"},
    "debt_payables": COMMON_FINANCE | {"invoice_no", "paid_amount", "due_date"},
    "attendance": {"clock_in", "clock_out", "work_date", "status", "timezone"},
}
ITEM_FIELDS = frozenset({"product_id", "name", "price", "quantity", "subtotal", "unit_cost"})
EXTERNAL_STEPS = ("mail", "providers", "files", "logs", "backups", "offline_devices", "unstructured_content")
