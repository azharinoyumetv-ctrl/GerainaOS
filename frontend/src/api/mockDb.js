/**
 * Geraina POS - Mock Database Service (Client-side localStorage)
 * Supports full retail operational scope.
 */

const SEED_DATA = {
  categories: [
    { id: "cat-1", name: "Makanan", description: "Menu makanan utama" },
    { id: "cat-2", name: "Minuman", description: "Kopi, teh, jus, dan soft drink" },
    { id: "cat-3", name: "Cemilan", description: "Snack dan dessert" },
    { id: "cat-4", name: "Bumbu & Bahan", description: "Bahan mentah dapur" },
  ],
  brands: [
    { id: "br-1", name: "Kopi Gayo", description: "Biji kopi aceh" },
    { id: "br-2", name: "Sariwangi", description: "Teh celup lokal" },
    { id: "br-3", name: "Indofood", description: "Bahan makanan pokok" },
  ],
  units: [
    { id: "un-1", name: "Pcs", short_name: "pcs" },
    { id: "un-2", name: "Box", short_name: "box" },
    { id: "un-3", name: "Botol", short_name: "btl" },
    { id: "un-4", name: "Kilogram", short_name: "kg" },
    { id: "un-5", name: "Gram", short_name: "g" },
  ],
  stock_adjustments: [
    { id: "adj-1", product_name: "Kopi Susu Gula Aren", sku: "KOP-001", adjustment_qty: 15, type: "add", reason: "Stock Opname Bulanan", created_by: "Owner", created_at: new Date().toISOString() },
  ],
  stock_transfers: [
    { id: "tf-1", from_branch: "Outlet Utama", to_branch: "Outlet Bandung", items: [{ name: "Kopi Susu Gula Aren", qty: 10 }], status: "Shipped", created_at: new Date().toISOString() },
  ],
  suppliers: [
    { id: "sup-1", name: "PT. Harapan Makmur", phone: "081234567800", email: "sales@harapanmakmur.co.id", address: "Kawasan Industri Pulo Gadung, Jakarta" },
    { id: "sup-2", name: "CV. Sinar Distribusi", phone: "089876543211", email: "info@sinardistribusi.com", address: "Ruko Sentra Bisnis, Bekasi" },
  ],
  purchase_orders: [
    { id: "po-1", po_no: "PO-20260601-001", supplier_id: "sup-1", supplier_name: "PT. Harapan Makmur", total: 450000, status: "Received", created_at: "2026-06-12T10:00:00.000Z" },
    { id: "po-2", po_no: "PO-20260619-001", supplier_id: "sup-2", supplier_name: "CV. Sinar Distribusi", total: 1200000, status: "Ordered", created_at: new Date().toISOString() },
  ],
  goods_receiving: [
    { id: "gr-1", po_no: "PO-20260601-001", gr_no: "GR-20260612-001", received_by: "Warehouse Staff", received_at: "2026-06-12T15:00:00.000Z" },
  ],
  supplier_invoices: [
    { id: "inv-1", invoice_no: "INV-HM-8899", po_no: "PO-20260601-001", amount: 450000, status: "Paid", due_date: "2026-07-12" },
    { id: "inv-2", invoice_no: "INV-SD-4455", po_no: "PO-20260619-001", amount: 1200000, status: "Unpaid", due_date: "2026-07-19" },
  ],
  customers: [
    { id: "cust-1", name: "Budi Santoso", phone: "08122334455", email: "budi@gmail.com", membership_tier: "Gold", loyalty_points: 340, created_at: "2026-01-10T11:00:00.000Z" },
    { id: "cust-2", name: "Siti Rahmawati", phone: "08567890123", email: "siti.rahma@hotmail.com", membership_tier: "Silver", loyalty_points: 120, created_at: "2026-03-15T09:30:00.000Z" },
    { id: "cust-3", name: "Indra Wijaya", phone: "08901122334", email: "indra.w@outlook.com", membership_tier: "Platinum", loyalty_points: 850, created_at: "2026-05-20T16:45:00.000Z" },
  ],
  memberships: [
    { id: "mem-1", name: "Bronze", min_points: 0, discount_percent: 0, description: "Level dasar pendaftaran" },
    { id: "mem-2", name: "Silver", min_points: 100, discount_percent: 5, description: "Diskon 5% untuk semua item" },
    { id: "mem-3", name: "Gold", min_points: 300, discount_percent: 10, description: "Diskon 10% + free coffee di hari ultah" },
    { id: "mem-4", name: "Platinum", min_points: 800, discount_percent: 15, description: "Diskon 15% + prioritas reservasi" },
  ],
  loyalty_rules: {
    conversion_rate: 10000, // Rp 10.000 = 1 Point
    point_value: 100, // 1 Point = Rp 100 cashback
    min_redeem_points: 50,
  },
  debt_receivables: [
    { id: "rec-1", customer_name: "Budi Santoso", phone: "08122334455", order_no: "GR-20260610-001", amount: 150000, paid_amount: 50000, due_date: "2026-07-10", status: "Partial" },
    { id: "rec-2", customer_name: "Indra Wijaya", phone: "08901122334", order_no: "GR-20260615-002", amount: 280000, paid_amount: 0, due_date: "2026-07-15", status: "Unpaid" },
  ],
  debt_payables: [
    { id: "pay-1", supplier_name: "PT. Harapan Makmur", invoice_no: "INV-HM-8899", amount: 450000, paid_amount: 450000, due_date: "2026-07-12", status: "Paid" },
    { id: "pay-2", supplier_name: "CV. Sinar Distribusi", invoice_no: "INV-SD-4455", amount: 1200000, paid_amount: 0, due_date: "2026-07-19", status: "Unpaid" },
  ],
  payments_config: {
    cash: { is_active: true, provider: "Sistem Kasir Lokal", require_drawer: true, active_drawer_port: "COM3" },
    qris: { is_active: true, provider: "Xendit", type: "dynamic", merchant_id: "MID-GER-QRIS-99", callback_status: "Active" },
    ewallet: {
      is_active: true,
      provider: "Xendit",
      channels: {
        GoPay: true, OVO: true, DANA: true, ShopeePay: true, LinkAja: true,
        AstraPay: false, Sakuku: false, iSaku: false, MotionPay: false, JeniusPay: true
      }
    },
    va: {
      is_active: true,
      provider: "Midtrans",
      banks: {
        BCA: true, BNI: true, BRI: true, Mandiri: true, Permata: true,
        CIMB: true, Maybank: false, Danamon: false, Neo: false, BSI: true
      }
    },
    credit_card: { is_active: true, provider: "Stripe", enable_3ds: true, installment_banks: ["Mandiri", "BCA", "CIMB"] },
    bank_transfer: { is_active: true, accounts: [{ bank: "Bank Central Asia", account_no: "8820987111", account_name: "DagangOS Geraina POS" }] }
  },
  staff: [
    { id: "st-1", name: "Azhar Owner", email: "owner@geraina.com", role: "Owner", phone: "0811111111", status: "Aktif" },
    { id: "st-2", name: "Yudi Manager", email: "manager@geraina.com", role: "Manager", phone: "0822222222", status: "Aktif" },
    { id: "st-3", name: "Dewi Kasir Utama", email: "cashier@geraina.com", role: "Cashier", phone: "0833333333", status: "Aktif" },
    { id: "st-4", name: "Bambang Gudang", email: "warehouse@geraina.com", role: "Warehouse", phone: "0844444444", status: "Aktif" },
  ],
  branches: [
    { id: "brch-1", name: "Outlet Utama (Jakarta)", address: "Jl. Sudirman No. 12, Jakarta Selatan", phone: "021-555666" },
    { id: "brch-2", name: "Outlet Bandung", address: "Jl. Dago No. 101, Bandung", phone: "022-777888" },
    { id: "brch-3", name: "Outlet Surabaya", address: "Jl. Basuki Rahmat No. 45, Surabaya", phone: "031-999000" },
  ],
  integrations: {
    xendit: { is_active: true, secret_key: "xnd_live_...", webhook_token: "ger-token-xyz-123" },
    midtrans: { is_active: false, client_key: "VT-client-...", server_key: "VT-server-..." },
    stripe: { is_active: false, publishable_key: "pk_live_...", secret_key: "sk_live_..." },
    whatsapp: { is_active: true, provider: "Fonnte / Qontak", api_token: "wa-token-abc", auto_send_receipt: true },
    telegram: { is_active: false, bot_token: "bot123456:...", chat_id: "@gerainapos_alerts" },
    email: { is_active: true, smtp_host: "smtp.mailgun.org", smtp_port: 587, smtp_user: "postmaster@geraina.com" }
  },
  settings: {
    general: { store_name: "Toko Senja", currency: "IDR", timezone: "WIB (UTC+7)", language: "id" },
    receipt: { header_text: "Terima Kasih Telah Berkunjung!", footer_text: "Powered by DagangOS - Struk Resmi", show_logo: true, show_cashier: true },
    printer: { default_printer: "Bluetooth 80mm", paper_size: "80mm", auto_print: true }
  },
  attendance: [
    { id: "att-1", staff_name: "Dewi Kasir Utama", clock_in: "2026-06-19T07:55:00.000Z", clock_out: "2026-06-19T17:02:00.000Z", status: "Hadir" },
  ]
};

// Initialize localStorage if empty
Object.keys(SEED_DATA).forEach((key) => {
  const localKey = `geraina_mock_${key}`;
  if (!localStorage.getItem(localKey)) {
    localStorage.setItem(localKey, JSON.stringify(SEED_DATA[key]));
  }
});

export const mockDb = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(`geraina_mock_${key}`));
    } catch {
      return SEED_DATA[key];
    }
  },
  set(key, val) {
    localStorage.setItem(`geraina_mock_${key}`, JSON.stringify(val));
    return val;
  },
  list(key) {
    return this.get(key) || [];
  },
  add(key, item) {
    const list = this.list(key);
    const newItem = { id: `${key.slice(0, 3)}-${Date.now()}`, ...item };
    list.push(newItem);
    this.set(key, list);
    return newItem;
  },
  update(key, id, item) {
    const list = this.list(key);
    const idx = list.findIndex(x => x.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...item };
      this.set(key, list);
      return list[idx];
    }
    return null;
  },
  delete(key, id) {
    let list = this.list(key);
    list = list.filter(x => x.id !== id);
    this.set(key, list);
    return true;
  }
};
