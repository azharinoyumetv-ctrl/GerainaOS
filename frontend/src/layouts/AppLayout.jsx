import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { ROLE_MODULES, canAccessPath, canonicalRole } from "@/auth/permissions";
import { toast } from "@/components/ui/sonner";
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, ClipboardList,
  Truck, Users, Landmark, CreditCard, BarChart3, UserCheck,
  GitBranch, Cpu, Settings, Info, ChevronDown, ChevronRight,
  LogOut, Crown, Shield, Menu, X, Lock, Clock, UserRound, ReceiptText
} from "lucide-react";

import { sectionMenu, isPlanLocked as isLocked, PLAN_LABEL } from "@/navigation/sections";

export const MENU_STRUCTURE = [
  { to: "/geraina/app/dashboard", icon: LayoutDashboard, label: "Dasbor", key: "dashboard" },
  { to: "/geraina/app/pos", icon: ShoppingCart, label: "Kasir", key: "pos" },
  { to: "/geraina/app/sales", icon: ReceiptText, label: "Riwayat Penjualan", key: "sales" },
  { to: "/geraina/app/attendance", icon: Clock, label: "Absensi saya", key: "attendance", minPlan: "business" },
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
    sub: sectionMenu("payments")
  },
  {
    label: "Laporan",
    icon: BarChart3,
    key: "reports",
    minPlan: "pro",
    sub: sectionMenu("reports")
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
    sub: sectionMenu("integrations")
  },
  {
    label: "Pengaturan",
    icon: Settings,
    key: "settings",
    sub: sectionMenu("settings")
  },
  { to: "/geraina/app/about", icon: Info, label: "Tentang", key: "about" }
];

function notifyLocked(minPlan) {
  toast.error(`Fitur ini tersedia dalam paket ${PLAN_LABEL[minPlan] || "Pro"}.`, {
    action: { label: "Lihat Paket", onClick: () => { window.location.href = "/geraina/pricing"; } },
  });
}

function trialDaysLeft(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86400000));
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const days = trialDaysLeft(user?.trial_ends_at);
  const isTrial = (user?.plan || "trial") === "trial";

  const role = canonicalRole(user?.role);
  const permissions = ROLE_MODULES[role] || [];
  const TierNotice = role === "Owner" ? Link : "div";
  const tierLabel = isTrial ? "Trial" : PLAN_LABEL[user?.plan] || "Paket berakhir";

  const [openMenus, setOpenMenus] = useState({});
  const [showEcosystemSwitcher, setShowEcosystemSwitcher] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const beginHandoff = () => {
    const event = new Event("geraina-before-account-switch", { cancelable: true });
    window.dispatchEvent(event);
    if (event.defaultPrevented) { toast.error("Selesaikan transaksi atau simpan/tutup draf sebelum mengganti akun."); return; }
    if (!navigator.onLine) { toast.error("Ganti pengguna memerlukan internet. Akun saat ini tetap dapat mencatat penjualan tunai offline; Keluar tetap mengunci akun."); return; }
    setMobileOpen(false);
    setHandoff(true);
  };

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

  const filteredMenu = MENU_STRUCTURE.filter(item => permissions.includes("*") || permissions.includes(item.key))
    .map(item => item.sub ? { ...item, sub: item.sub.filter(sub => canAccessPath(role, sub.to)) } : item)
    .filter(item => item.sub ? item.sub.length > 0 : canAccessPath(role, item.to));

  return (
    <div className="ecosystem-app-shell h-screen flex flex-col lg:flex-row overflow-hidden bg-[hsl(var(--background))]" data-testid="app-layout">
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
        className={`ecosystem-command-rail fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col h-screen overflow-hidden transition-transform duration-200 ease-out
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
                title="Beralih aplikasi DagangOS"
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
                const activated = new Set(["geraina", ...(user?.stores || []).map((s) => s.module)]);
                const tiles = [
                  { mod: "dapuros", label: "DapurOS", desc: "F&B & Restoran OS", img: "/assets/brand/dapuros-icon.png", tone: "orange", home: "/dapuros/app/dashboard", activate: "/dapuros/activate" },
                  { mod: "geraina", label: "Geraina POS", desc: "Retail & Toko OS", img: "/assets/brand/geraina-icon.png", tone: "blue", home: "/geraina/app/dashboard", activate: "/geraina/activate" },
                ];
                return (
                  <div className="suite-list pt-1">
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
                          className={`suite-row p-2.5 border transition-all block text-left ${box}`}
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
                      // Android drawers must stay open until a destination is chosen.

                    }}
                    aria-expanded={!!isOpen}
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

        <TierNotice {...(role === "Owner" ? { to: "/geraina/app/settings/billing", title: "Informasi paket" } : {})}
          className="mx-3 my-2 flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium whitespace-nowrap bg-white/5"
          data-testid="tier-notice">
          <Crown size={14} className="shrink-0" aria-hidden="true" />
          <span className="font-semibold" data-testid="tier-name">{tierLabel}</span>
          {isTrial && days !== null && <><span aria-hidden="true">·</span><span data-testid="trial-days-left">{days > 0 ? `${days} hari tersisa` : "Berakhir"}</span></>}
        </TierNotice>

        <div className="p-3 border-t border-[hsl(var(--border))] space-y-3 bg-[hsl(var(--background))]/30">
          <div className="flex items-center justify-between px-2">
            <div>
              <p className="text-[10px] text-[hsl(var(--muted))]">Peran akun</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] mt-0.5 inline-block">
                {role}
              </span>
            </div>
            <button type="button" onClick={beginHandoff} className="btn-outline text-xs" data-testid="account-switch-open"><UserRound size={14} /> Ganti pengguna</button>
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

      <main className="ecosystem-workspace flex-1 min-w-0 overflow-y-auto bg-[hsl(var(--background))]">
        <div key={location.pathname} className="route-stage">
          <Outlet />
          {handoff && <div role="dialog" aria-modal="true" aria-labelledby="account-switch-title" className="fixed inset-0 z-[100] bg-black/50 grid place-items-center p-4" data-testid="account-switch-dialog">
            <div className="card-surface bg-white p-6 space-y-4 w-full max-w-md">
              <h2 id="account-switch-title" className="font-display text-xl font-bold">Ganti pengguna perangkat ini?</h2>
              <p className="text-sm">Sesi {user?.name || user?.email} ({role}) akan diakhiri. Pengguna berikutnya wajib masuk dengan akun dan kata sandinya sendiri. Kembali ke Owner juga memerlukan login Owner.</p>
              <p className="text-xs text-[hsl(var(--muted))]">Penjualan offline yang tersimpan tetap terikat pada akun ini. Masuk kembali dengan akun yang sama untuk menyinkronkannya.</p>
              <div className="flex gap-3"><button type="button" onClick={() => setHandoff(false)} className="btn-outline flex-1" data-testid="account-switch-cancel">Batal</button><button type="button" onClick={() => { setHandoff(false); logout(); nav("/geraina/login?switch=1", { replace: true }); }} className="btn-primary flex-1" data-testid="account-switch-confirm">Keluar & ganti pengguna</button></div>
            </div>
          </div>}
        </div>
      </main>
    </div>
  );
}
