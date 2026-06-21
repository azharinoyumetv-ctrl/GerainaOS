import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, ClipboardList,
  Truck, Users, Landmark, CreditCard, BarChart3, UserCheck,
  GitBranch, Cpu, Settings, Info, ChevronDown, ChevronRight,
  LogOut, Sparkles, Crown, Shield, Leaf
} from "lucide-react";

const ROLE_PERMISSIONS = {
  Owner: ["*"],
  Manager: [
    "dashboard", "pos", "products", "inventory", "purchase",
    "suppliers", "customers", "debt", "payments", "reports", "staff", "settings", "about"
  ],
  Cashier: [
    "dashboard", "pos", "products", "customers", "about"
  ],
  Warehouse: [
    "products", "inventory", "purchase", "suppliers", "about"
  ]
};

const MENU_STRUCTURE = [
  { to: "/geraina/app/dashboard", icon: LayoutDashboard, label: "Dashboard", key: "dashboard" },
  { to: "/geraina/app/pos", icon: ShoppingCart, label: "POS Kasir", key: "pos" },
  {
    label: "Produk",
    icon: Package,
    key: "products",
    sub: [
      { to: "/geraina/app/products", label: "Daftar Produk" },
      { to: "/geraina/app/products/categories", label: "Kategori" },
      { to: "/geraina/app/products/brands", label: "Merek" },
      { to: "/geraina/app/products/units", label: "Satuan" },
      { to: "/geraina/app/products/stock-adjustment", label: "Penyesuaian Stok" },
      { to: "/geraina/app/products/stock-transfer", label: "Transfer Stok" }
    ]
  },
  {
    label: "Inventaris",
    icon: Warehouse,
    key: "inventory",
    sub: [
      { to: "/geraina/app/inventory/overview", label: "Ringkasan Stok" },
      { to: "/geraina/app/inventory/movement", label: "Mutasi Stok" },
      { to: "/geraina/app/inventory/valuation", label: "Penilaian Inventaris" },
      { to: "/geraina/app/inventory/low-stock", label: "Stok Menipis" },
      { to: "/geraina/app/inventory/dead-stock", label: "Stok Mati" }
    ]
  },
  {
    label: "Pembelian",
    icon: ClipboardList,
    key: "purchase",
    sub: [
      { to: "/geraina/app/purchase/orders", label: "Order Pembelian (PO)" },
      { to: "/geraina/app/purchase/receiving", label: "Penerimaan Barang" },
      { to: "/geraina/app/purchase/invoices", label: "Faktur Supplier" }
    ]
  },
  { to: "/geraina/app/suppliers", icon: Truck, label: "Supplier", key: "suppliers" },
  {
    label: "Pelanggan",
    icon: Users,
    key: "customers",
    sub: [
      { to: "/geraina/app/customers", label: "Daftar Pelanggan" },
      { to: "/geraina/app/customers/membership", label: "Keanggotaan" },
      { to: "/geraina/app/customers/loyalty", label: "Poin Loyalitas" }
    ]
  },
  {
    label: "Hutang Piutang",
    icon: Landmark,
    key: "debt",
    sub: [
      { to: "/geraina/app/debt/receivable", label: "Piutang Usaha" },
      { to: "/geraina/app/debt/payable", label: "Utang Usaha" }
    ]
  },
  {
    label: "Pembayaran",
    icon: CreditCard,
    key: "payments",
    sub: [
      { to: "/geraina/app/payments/cash", label: "Tunai" },
      { to: "/geraina/app/payments/qris", label: "QRIS" },
      { to: "/geraina/app/payments/ewallet", label: "E-Wallet" },
      { to: "/geraina/app/payments/va", label: "Virtual Account" },
      { to: "/geraina/app/payments/credit-card", label: "Kartu Kredit" },
      { to: "/geraina/app/payments/bank-transfer", label: "Transfer Bank" }
    ]
  },
  {
    label: "Laporan",
    icon: BarChart3,
    key: "reports",
    sub: [
      { to: "/geraina/app/reports/sales", label: "Penjualan" },
      { to: "/geraina/app/reports/product", label: "Produk" },
      { to: "/geraina/app/reports/inventory", label: "Stok / Inventaris" },
      { to: "/geraina/app/reports/profit", label: "Laba Rugi" },
      { to: "/geraina/app/reports/cashflow", label: "Arus Kas" },
      { to: "/geraina/app/reports/tax", label: "Pajak" }
    ]
  },
  {
    label: "Staf & Karyawan",
    icon: UserCheck,
    key: "staff",
    sub: [
      { to: "/geraina/app/staff/management", label: "Manajemen Staf" },
      { to: "/geraina/app/staff/roles", label: "Peran" },
      { to: "/geraina/app/staff/permissions", label: "Izin Akses" },
      { to: "/geraina/app/staff/attendance", label: "Absensi" }
    ]
  },
  { to: "/geraina/app/branches", icon: GitBranch, label: "Cabang", key: "branches" },
  {
    label: "Integrasi",
    icon: Cpu,
    key: "integrations",
    sub: [
      { to: "/geraina/app/integrations/xendit", label: "Xendit" },
      { to: "/geraina/app/integrations/midtrans", label: "Midtrans" },
      { to: "/geraina/app/integrations/stripe", label: "Stripe" },
      { to: "/geraina/app/integrations/whatsapp", label: "WhatsApp" },
      { to: "/geraina/app/integrations/telegram", label: "Telegram" },
      { to: "/geraina/app/integrations/email", label: "Email" }
    ]
  },
  {
    label: "Pengaturan",
    icon: Settings,
    key: "settings",
    sub: [
      { to: "/geraina/app/settings/general", label: "Umum" },
      { to: "/geraina/app/settings/store", label: "Toko" },
      { to: "/geraina/app/settings/receipt", label: "Struk" },
      { to: "/geraina/app/settings/printer", label: "Printer" },
      { to: "/geraina/app/settings/users", label: "Pengguna" },
      { to: "/geraina/app/settings/license", label: "Lisensi" }
    ]
  },
  { to: "/geraina/app/about", icon: Info, label: "Tentang", key: "about" }
];

function trialDaysLeft(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export default function AppLayout() {
  const { user, logout, changeRole } = useAuth();
  const nav = useNavigate();
  const days = trialDaysLeft(user?.trial_ends_at);
  const isTrial = (user?.plan || "trial") === "trial";
  
  const role = user?.role || "Owner";
  const permissions = ROLE_PERMISSIONS[role] || [];
  
  const [openMenus, setOpenMenus] = useState({});

  const toggleMenu = (key) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredMenu = MENU_STRUCTURE.filter((item) => {
    if (permissions.includes("*")) return true;
    return permissions.includes(item.key);
  });

  return (
    <div className="min-h-screen flex bg-[hsl(var(--background))]" data-testid="app-layout">
      <aside className="w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col h-screen overflow-hidden" data-testid="app-sidebar">
        <div className="p-5 border-b border-[hsl(var(--border))]">
          <Link to="/geraina/app/dashboard" className="font-display text-xl font-extrabold flex items-center gap-2" data-testid="app-logo">
            <Leaf className="text-[hsl(var(--accent))]" size={22} /> Geraina POS <span className="text-[10px] text-[hsl(var(--muted))] font-normal">by DagangOS</span>
          </Link>
          <p className="text-xs text-[hsl(var(--muted))] mt-1.5">{user?.store_name || "Toko Anda"}</p>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto space-y-1 scrollbar-thin">
          {filteredMenu.map((item) => {
            const Icon = item.icon;
            if (item.sub) {
              const isOpen = openMenus[item.key];
              return (
                <div key={item.key} className="space-y-0.5">
                  <button
                    onClick={() => toggleMenu(item.key)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {isOpen && (
                    <div className="pl-9 space-y-0.5 border-l border-[hsl(var(--border))]/50 ml-5">
                      {item.sub.map((subItem) => (
                        <NavLink
                          key={subItem.to}
                          to={subItem.to}
                          end
                          className={({ isActive }) =>
                            `block px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              isActive
                                ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                                : "text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]"
                            }`
                          }
                        >
                          {subItem.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[hsl(var(--primary))] text-white"
                      : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]"
                  }`
                }
              >
                <Icon size={18} /> {item.label}
              </NavLink>
            );
          })}
        </nav>

        {isTrial && (
          <div className="m-3 p-4 rounded-lg bg-gradient-to-br from-[hsl(151,39%,17%)] to-[hsl(151,39%,12%)] text-white" data-testid="trial-upgrade-card">
            <div className="flex items-center gap-2 mb-2">
              <Crown size={16} className="text-[hsl(9,65%,62%)]" />
              <p className="label-tiny" style={{ color: "hsl(9,65%,75%)" }}>Trial Aktif</p>
            </div>
            <p className="font-display text-2xl font-bold num-display" data-testid="trial-days-left">
              {days !== null ? `${days} hari` : "—"}
            </p>
            <p className="text-xs text-white/70 mt-0.5">tersisa</p>
            <Link to="/geraina/pricing" className="btn-accent w-full mt-3 text-xs text-center block" data-testid="trial-upgrade-cta">
              <Sparkles size={14} /> Upgrade Sekarang
            </Link>
          </div>
        )}

        <div className="p-3 border-t border-[hsl(var(--border))] space-y-3 bg-[hsl(var(--background))]/30">
          <div className="flex items-center justify-between px-2">
            <div>
              <p className="text-[10px] text-[hsl(var(--muted))]">Role Saat Ini</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] mt-0.5 inline-block">
                {role}
              </span>
            </div>
            <select
              value={role}
              onChange={(e) => changeRole(e.target.value)}
              className="text-xs border border-[hsl(var(--border))] rounded px-1.5 py-1 bg-[hsl(var(--surface))] outline-none font-medium cursor-pointer"
            >
              <option value="Owner">Owner</option>
              <option value="Manager">Manager</option>
              <option value="Cashier">Cashier</option>
              <option value="Warehouse">Warehouse</option>
            </select>
          </div>

          <div className="px-2 pt-1 border-t border-[hsl(var(--border))]/50 flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs text-[hsl(var(--muted))] truncate">{user?.email}</p>
            </div>
            <button
              className="p-1 rounded text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => { logout(); nav("/geraina/login"); }}
              title="Keluar"
              data-testid="logout-btn"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto h-screen bg-[hsl(var(--background))]">
        <Outlet />
      </main>
    </div>
  );
}

