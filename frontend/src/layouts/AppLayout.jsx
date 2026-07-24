import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { toast } from "@/components/ui/sonner";
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, ClipboardList,
  Truck, Users, Landmark, CreditCard, BarChart3, UserCheck,
  GitBranch, Cpu, Settings, Info, ChevronDown, ChevronRight,
  LogOut, Sparkles, Crown, Shield, Menu, X, Lock
} from "lucide-react";

const ROLE_PERMISSIONS = {
  Owner: ["*"],
  Manager: [
    "dashboard", "pos", "products", "inventory", "purchase",
    "suppliers", "customers", "debt", "payments", "reports", "staff", "settings", "billing", "about"
  ],
  Cashier: [
    "dashboard", "pos", "products", "customers", "about"
  ],
  Warehouse: [
    "products", "inventory", "purchase", "suppliers", "about"
  ]
};

const MENU_STRUCTURE = [
  { to: "/geraina/app/dashboard", icon: LayoutDashboard, label: "Dasbor", key: "dashboard" },
  { to: "/geraina/app/pos", icon: ShoppingCart, label: "Kasir", key: "pos" },
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
      { to: "/geraina/app/products/stock-transfer", label: "Transfer Stok", minPlan: "business" }
    ]
  },
  {
    label: "Inventaris",
    icon: Warehouse,
    key: "inventory",
    sub: [
      { to: "/geraina/app/inventory/overview", label: "Ringkasan Stok" },
      { to: "/geraina/app/inventory/movement", label: "Mutasi Stok", minPlan: "pro" },
      { to: "/geraina/app/inventory/valuation", label: "Penilaian Inventaris", minPlan: "pro" },
      { to: "/geraina/app/inventory/low-stock", label: "Stok Menipis" },
      { to: "/geraina/app/inventory/dead-stock", label: "Stok Mati", minPlan: "pro" }
    ]
  },
  {
    label: "Pembelian",
    icon: ClipboardList,
    key: "purchase",
    minPlan: "pro",
    sub: [
      { to: "/geraina/app/purchase/orders", label: "Order Pembelian (PO)" },
      { to: "/geraina/app/purchase/receiving", label: "Penerimaan Barang" },
      { to: "/geraina/app/purchase/invoices", label: "Faktur Pemasok" }
    ]
  },
  { to: "/geraina/app/suppliers", icon: Truck, label: "Pemasok", key: "suppliers", minPlan: "pro" },
  {
    label: "Pelanggan",
    icon: Users,
    key: "customers",
    sub: [
      { to: "/geraina/app/customers", label: "Daftar Pelanggan" },
      { to: "/geraina/app/customers/membership", label: "Keanggotaan", minPlan: "business" },
      { to: "/geraina/app/customers/loyalty", label: "Poin Loyalitas", minPlan: "business" }
    ]
  },
  {
    label: "Hutang Piutang",
    icon: Landmark,
    key: "debt",
    minPlan: "pro",
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
    minPlan: "pro",
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
      { to: "/geraina/app/staff/roles", label: "Peran", minPlan: "business" },
      { to: "/geraina/app/staff/permissions", label: "Izin Akses", minPlan: "business" },
      { to: "/geraina/app/staff/attendance", label: "Absensi", minPlan: "business" }
    ]
  },
  { to: "/geraina/app/branches", icon: GitBranch, label: "Cabang", key: "branches", minPlan: "business" },
  {
    label: "Integrasi",
    icon: Cpu,
    key: "integrations",
    minPlan: "pro",
    sub: [
      { to: "/geraina/app/integrations/xendit", label: "Xendit" },
      { to: "/geraina/app/integrations/midtrans", label: "Midtrans" },
      { to: "/geraina/app/integrations/stripe", label: "Stripe" },
      { to: "/geraina/app/integrations/whatsapp", label: "WhatsApp", minPlan: "business" },
      { to: "/geraina/app/integrations/telegram", label: "Telegram", minPlan: "business" },
      { to: "/geraina/app/integrations/email", label: "Email", minPlan: "business" }
    ]
  },
  {
    label: "Pengaturan",
    icon: Settings,
    key: "settings",
    sub: [
      { to: "/geraina/app/settings/general", label: "Umum" },
      { to: "/geraina/app/settings/store", label: "Toko" },
      { to: "/geraina/app/settings/billing", label: "Langganan & Tagihan" },
      { to: "/geraina/app/settings/receipt", label: "Struk" },
      { to: "/geraina/app/settings/printer", label: "Printer" },
      { to: "/geraina/app/settings/users", label: "Pengguna" },
      { to: "/geraina/app/settings/license", label: "Lisensi" }
    ]
  },
  { to: "/geraina/app/about", icon: Info, label: "Tentang", key: "about" }
];

// Plan-gated nav (cosmetic only -- there is no backend enforcement behind this yet; every
// endpoint is still reachable regardless of plan). This just shows what each tier unlocks and
// nudges upgrades, per the Starter/Pro/Business repackaging. "trial" ranks as Business since
// the 14-day trial now grants full Business-level access.
const PLAN_RANK = { expired: -1, starter: 0, pro: 1, business: 2, trial: 2 };
const PLAN_LABEL = { starter: "Starter", pro: "Pro", business: "Business" };

function planRank(plan) {
  return PLAN_RANK[plan] ?? 0;
}

function isLocked(minPlan, userPlan) {
  if (!minPlan || minPlan === "starter") return false;
  return planRank(userPlan) < planRank(minPlan);
}

function notifyLocked(minPlan) {
  toast.error(`Fitur ini tersedia dalam paket ${PLAN_LABEL[minPlan] || "Pro"}.`, {
    action: { label: "Lihat Paket", onClick: () => { window.location.href = "/geraina/pricing"; } },
  });
}

function trialDaysLeft(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export default function AppLayout() {
  const { user, logout, changeRole } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const days = trialDaysLeft(user?.trial_ends_at);
  const isTrial = (user?.plan || "trial") === "trial";

  const role = user?.role || "Owner";
  const permissions = ROLE_PERMISSIONS[role] || [];

  const [openMenus, setOpenMenus] = useState({});
  const [showEcosystemSwitcher, setShowEcosystemSwitcher] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMenu = (key) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Close the off-canvas sidebar automatically whenever the route changes
  // (phone/tablet only -- on lg+ the sidebar is always visible and this is a no-op).
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Prevent background scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const filteredMenu = MENU_STRUCTURE.filter((item) => {
    if (permissions.includes("*")) return true;
    return permissions.includes(item.key);
  });

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden bg-[hsl(var(--background))]" data-testid="app-layout">
      {/* Mobile/tablet top bar -- hidden on desktop (lg+), where the sidebar is always visible */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface))]" data-testid="app-mobile-topbar">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-md text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
          aria-label="Buka menu"
          data-testid="mobile-menu-open-btn"
        >
          <Menu size={22} />
        </button>
        <Link to="/geraina/app/dashboard" className="font-display text-base font-extrabold flex items-center gap-2">
          <img src="/assets/brand/geraina-icon.png" alt="" className="w-[18px] h-[18px] object-contain" /> Geraina POS
        </Link>
        <div className="w-9" aria-hidden="true" />
      </header>

      {/* Backdrop for the off-canvas mobile/tablet sidebar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          data-testid="mobile-sidebar-backdrop"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col h-screen overflow-hidden transition-transform duration-200 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:w-64 lg:max-w-none lg:z-auto`}
        data-testid="app-sidebar"
      >
        <div className="p-4 border-b border-[hsl(var(--border))] relative bg-[hsl(var(--surface))]">
          <div className="flex items-center justify-between">
            <Link to="/geraina/app/dashboard" className="font-display text-lg font-extrabold flex items-center gap-2" data-testid="app-logo">
              <img src="/assets/brand/geraina-icon.png" alt="" className="w-5 h-5 object-contain" /> Geraina POS
            </Link>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowEcosystemSwitcher(!showEcosystemSwitcher)}
                className="p-1.5 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] transition-all flex items-center gap-1 text-xs font-bold"
                title="Switch Ecosystem App (Odoo Style)"
                data-testid="odoo-ecosystem-switcher-btn"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px]">Suite</span>
                <ChevronDown size={12} />
              </button>
              <button
                onClick={() => setMobileOpen(false)}
                className="lg:hidden p-1.5 rounded-lg text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
                aria-label="Tutup menu"
                data-testid="mobile-menu-close-btn"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[hsl(var(--muted))] mt-1 truncate">{user?.store_name || "DagangOS Enterprise"}</p>

          {showEcosystemSwitcher && (
            <div className="absolute top-14 left-2 right-2 bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-slate-700 z-[100] animate-fadein space-y-2 text-left" data-testid="odoo-ecosystem-menu">
              <div className="flex justify-between items-center px-1 pb-2 border-b border-slate-800">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">DagangOS Ecosystem Apps</span>
                <span className="text-[9px] bg-blue-600/30 text-blue-300 border border-blue-500/40 px-1.5 py-0.5 rounded font-mono">SSO Active</span>
              </div>

              {(() => {
                const activated = new Set((user?.stores || []).map((s) => s.module));
                const tiles = [
                  { mod: "dapuros", label: "DapurOS", desc: "F&B & Restoran OS", img: "/assets/brand/dapuros-icon.png", tone: "orange", home: "/dapuros/app/dashboard", activate: "/dapuros/activate" },
                  { mod: "geraina", label: "Geraina POS", desc: "Retail & Toko OS", img: "/assets/brand/geraina-icon.png", tone: "blue", home: "/geraina/app/dashboard", activate: "/geraina/activate" },
                ];
                return (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {tiles.map(({ mod, label, desc, img, tone, home, activate }) => {
                      const isOn = activated.has(mod);
                      const box = tone === "orange"
                        ? "bg-orange-500/20 border-orange-500/40 hover:bg-orange-500/30"
                        : "bg-blue-500/20 border-blue-500/40 hover:bg-blue-500/30";
                      const ic = tone === "orange" ? "text-orange-400" : "text-blue-400";
                      const tx = tone === "orange" ? "text-orange-200" : "text-blue-200";
                      return (
                        <a
                          key={mod}
                          href={isOn ? home : activate}
                          className={`p-2.5 rounded-xl border transition-all block text-left ${box}`}
                          data-testid={`suite-tile-${mod}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <img src={img} alt="" className="w-4 h-4 object-contain" />
                            <span className={`text-xs font-extrabold ${tx}`}>{label}</span>
                          </div>
                          <p className="text-[10px] text-slate-300 leading-tight">{desc}</p>
                          <span className={`inline-block mt-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded ${isOn ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-slate-700 text-slate-200 border border-slate-600"}`}>
                            {isOn ? "Aktif" : "+ Aktifkan"}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                );
              })()}

              <a
                href="/"
                className="block w-full text-center py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-[11px] font-bold transition-all border border-slate-700/60 mt-2"
              >
                🌐 Kembali ke Ecosystem Hub &rarr;
              </a>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 overflow-y-auto space-y-1 scrollbar-thin">
          {filteredMenu.map((item) => {
            const Icon = item.icon;
            if (item.sub) {
              const isOpen = openMenus[item.key];
              const subsWithLock = item.sub.map((s) => ({ ...s, _minPlan: s.minPlan || item.minPlan || "starter" }));
              const allLocked = subsWithLock.every((s) => isLocked(s._minPlan, user?.plan));

              if (allLocked) {
                return (
                  <button
                    key={item.key}
                    onClick={() => notifyLocked(item.minPlan || subsWithLock[0]._minPlan)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-[hsl(var(--muted))] hover:bg-[hsl(var(--secondary))]/50 transition-colors text-left"
                    data-testid={`menu-locked-${item.key}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="opacity-50" />
                      <span>{item.label}</span>
                    </div>
                    <Lock size={13} className="opacity-60" />
                  </button>
                );
              }

              return (
                <div key={item.key} className="space-y-0.5">
                  <button
                    onClick={() => {
                      toggleMenu(item.key);
                      nav(`/geraina/app/${item.key}`);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors text-left"
                    data-testid={`menu-parent-${item.key}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {isOpen && (
                    <div className="pl-9 space-y-0.5 border-l border-[hsl(var(--border))]/50 ml-5">
                      {subsWithLock.map((subItem) => {
                        const locked = isLocked(subItem._minPlan, user?.plan);
                        if (locked) {
                          return (
                            <button
                              key={subItem.to}
                              onClick={() => notifyLocked(subItem._minPlan)}
                              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium rounded-md text-[hsl(var(--muted))]/70 hover:bg-[hsl(var(--secondary))]/50 transition-colors text-left"
                              data-testid={`submenu-locked-${subItem.to.split("/").pop()}`}
                            >
                              <span>{subItem.label}</span>
                              <Lock size={11} className="opacity-60 shrink-0" />
                            </button>
                          );
                        }
                        return (
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
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const leafLocked = isLocked(item.minPlan, user?.plan);
            if (leafLocked) {
              return (
                <button
                  key={item.to}
                  onClick={() => notifyLocked(item.minPlan)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-[hsl(var(--muted))] hover:bg-[hsl(var(--secondary))]/50 transition-colors text-left"
                  data-testid={`menu-locked-${item.key}`}
                >
                  <Icon size={18} className="opacity-50" /> <span className="flex-1">{item.label}</span> <Lock size={13} className="opacity-60" />
                </button>
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

      <main className="flex-1 min-w-0 overflow-y-auto bg-[hsl(var(--background))]">
        <Outlet />
      </main>
    </div>
  );
}
