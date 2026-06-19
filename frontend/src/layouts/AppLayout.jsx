import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import {
  LayoutDashboard, ShoppingCart, Package, ReceiptText,
  Leaf, LogOut, Sparkles, Crown, Shield, Info
} from "lucide-react";

const NAV = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard", testid: "nav-dashboard" },
  { to: "/app/pos", icon: ShoppingCart, label: "POS Kasir", testid: "nav-pos" },
  { to: "/app/products", icon: Package, label: "Produk", testid: "nav-products" },
  { to: "/app/sales", icon: ReceiptText, label: "Penjualan", testid: "nav-sales" },
  { to: "/app/license", icon: Shield, label: "Lisensi & Perangkat", testid: "nav-license" },
  { to: "/app/about", icon: Info, label: "Tentang Aplikasi", testid: "nav-about" },
];

function trialDaysLeft(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const days = trialDaysLeft(user?.trial_ends_at);
  const isTrial = (user?.plan || "trial") === "trial";

  return (
    <div className="min-h-screen flex bg-[hsl(var(--background))]" data-testid="app-layout">
      <aside className="w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col" data-testid="app-sidebar">
        <div className="p-6 border-b border-[hsl(var(--border))]">
          <Link to="/app/dashboard" className="font-display text-xl font-extrabold flex items-center gap-2" data-testid="app-logo">
            <Leaf className="text-[hsl(var(--accent))]" size={22} /> Geraina POS <span className="text-[10px] text-[hsl(var(--muted))] font-normal">by DagangOS</span>
          </Link>
          <p className="text-xs text-[hsl(var(--muted))] mt-1.5">{user?.store_name || "Toko Anda"}</p>
        </div>

        <nav className="flex-1 p-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium mb-1 transition-colors ${
                  isActive
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]"
                }`
              }
            >
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
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
            <Link to="/pricing" className="btn-accent w-full mt-3 text-xs" data-testid="trial-upgrade-cta">
              <Sparkles size={14} /> Upgrade Sekarang
            </Link>
          </div>
        )}

        <div className="p-3 border-t border-[hsl(var(--border))]">
          <div className="px-2 py-1">
            <p className="text-xs text-[hsl(var(--muted))]">Masuk sebagai</p>
            <p className="text-sm font-medium truncate" data-testid="user-email">{user?.email}</p>
          </div>
          <button
            className="btn-ghost w-full text-sm mt-2"
            onClick={() => { logout(); nav("/login"); }}
            data-testid="logout-btn"
          >
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
