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
  { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard", key: "dashboard" },
  { to: "/app/pos", icon: ShoppingCart, label: "POS Kasir", key: "pos" },
  {
    label: "Produk",
    icon: Package,
    key: "products",
    sub: [
      { to: "/app/products", label: "Produk" },
      { to: "/app/products/categories", label: "Kategori" },
      { to: "/app/products/brands", label: "Brand" },
      { to: "/app/products/units", label: "Unit" },
      { to: "/app/products/stock-adjustment", label: "Stock Adjustment" },
      { to: "/app/products/stock-transfer", label: "Stock Transfer" }
    ]
  },
  {
    label: "Inventory",
    icon: Warehouse,
    key: "inventory",
    sub: [
      { to: "/app/inventory/overview", label: "Stock Overview" },
      { to: "/app/inventory/movement", label: "Stock Movement" },
      { to: "/app/inventory/valuation", label: "Inventory Valuation" },
      { to: "/app/inventory/low-stock", label: "Low Stock" },
      { to: "/app/inventory/dead-stock", label: "Dead Stock" }
    ]
  },
  {
    label: "Purchase",
    icon: ClipboardList,
    key: "purchase",
    sub: [
      { to: "/app/purchase/orders", label: "Purchase Order" },
      { to: "/app/purchase/receiving", label: "Goods Receiving" },
      { to: "/app/purchase/invoices", label: "Supplier Invoice" }
    ]
  },
  { to: "/app/suppliers", icon: Truck, label: "Supplier", key: "suppliers" },
  {
    label: "Customer",
    icon: Users,
    key: "customers",
    sub: [
      { to: "/app/customers", label: "Customer List" },
      { to: "/app/customers/membership", label: "Membership" },
      { to: "/app/customers/loyalty", label: "Loyalty Points" }
    ]
  },
  {
    label: "Hutang Piutang",
    icon: Landmark,
    key: "debt",
    sub: [
      { to: "/app/debt/receivable", label: "Accounts Receivable" },
      { to: "/app/debt/payable", label: "Accounts Payable" }
    ]
  },
  {
    label: "Payments",
    icon: CreditCard,
    key: "payments",
    sub: [
      { to: "/app/payments/cash", label: "Cash" },
      { to: "/app/payments/qris", label: "QRIS" },
      { to: "/app/payments/ewallet", label: "E-Wallet" },
      { to: "/app/payments/va", label: "Virtual Account" },
      { to: "/app/payments/credit-card", label: "Credit Card" },
      { to: "/app/payments/bank-transfer", label: "Bank Transfer" }
    ]
  },
  {
    label: "Reports",
    icon: BarChart3,
    key: "reports",
    sub: [
      { to: "/app/reports/sales", label: "Sales" },
      { to: "/app/reports/product", label: "Product" },
      { to: "/app/reports/inventory", label: "Inventory" },
      { to: "/app/reports/profit", label: "Profit" },
      { to: "/app/reports/cashflow", label: "Cashflow" },
      { to: "/app/reports/tax", label: "Tax" }
    ]
  },
  {
    label: "Staff",
    icon: UserCheck,
    key: "staff",
    sub: [
      { to: "/app/staff/management", label: "Staff Management" },
      { to: "/app/staff/roles", label: "Roles" },
      { to: "/app/staff/permissions", label: "Permissions" },
      { to: "/app/staff/attendance", label: "Attendance" }
    ]
  },
  { to: "/app/branches", icon: GitBranch, label: "Branches", key: "branches" },
  {
    label: "Integrations",
    icon: Cpu,
    key: "integrations",
    sub: [
      { to: "/app/integrations/xendit", label: "Xendit" },
      { to: "/app/integrations/midtrans", label: "Midtrans" },
      { to: "/app/integrations/stripe", label: "Stripe" },
      { to: "/app/integrations/whatsapp", label: "WhatsApp" },
      { to: "/app/integrations/telegram", label: "Telegram" },
      { to: "/app/integrations/email", label: "Email" }
    ]
  },
  {
    label: "Settings",
    icon: Settings,
    key: "settings",
    sub: [
      { to: "/app/settings/general", label: "General" },
      { to: "/app/settings/store", label: "Store" },
      { to: "/app/settings/receipt", label: "Receipt" },
      { to: "/app/settings/printer", label: "Printer" },
      { to: "/app/settings/users", label: "Users" },
      { to: "/app/settings/license", label: "License" }
    ]
  },
  { to: "/app/about", icon: Info, label: "About", key: "about" }
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
          <Link to="/app/dashboard" className="font-display text-xl font-extrabold flex items-center gap-2" data-testid="app-logo">
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
            <Link to="/pricing" className="btn-accent w-full mt-3 text-xs text-center block" data-testid="trial-upgrade-cta">
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
              onClick={() => { logout(); nav("/login"); }}
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

