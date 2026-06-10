import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtIDR } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { TrendingUp, Package, ShoppingCart, Calendar, Sparkles, ArrowRight, Crown } from "lucide-react";

function trialDaysLeft(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function Stat({ label, value, icon: Icon, hint, testid }) {
  return (
    <div className="card-surface p-6" data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <span className="label-tiny">{label}</span>
        <span className="w-9 h-9 rounded-md bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] grid place-items-center">
          <Icon size={16} />
        </span>
      </div>
      <p className="font-display num-display text-3xl font-extrabold">{value}</p>
      {hint && <p className="text-xs text-[hsl(var(--muted))] mt-1">{hint}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const days = trialDaysLeft(user?.trial_ends_at);
  const isTrial = (user?.plan || "trial") === "trial";

  useEffect(() => {
    api.get("/orders/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/orders?limit=6").then((r) => setRecent(r.data)).catch(() => {});
  }, []);

  return (
    <div className="p-8 space-y-6" data-testid="dashboard-page">
      <div className="flex items-end justify-between">
        <div>
          <span className="label-tiny">Dashboard</span>
          <h1 className="font-display text-3xl font-bold mt-1" data-testid="dashboard-greeting">
            Selamat datang, {user?.store_name}.
          </h1>
        </div>
        <Link to="/app/pos" className="btn-primary" data-testid="dashboard-pos-cta">
          Buka Kasir <ArrowRight size={16} />
        </Link>
      </div>

      {isTrial && (
        <div
          className="rounded-xl p-5 lg:p-6 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between"
          style={{ background: "linear-gradient(120deg, hsl(151,39%,17%), hsl(151,39%,13%))" }}
          data-testid="trial-upgrade-banner"
        >
          <div className="text-white">
            <span className="pill" style={{ background: "hsl(9,65%,55%,0.25)", color: "hsl(9,65%,75%)" }}>
              <Crown size={12} /> Trial
            </span>
            <h2 className="font-display text-2xl font-bold mt-2">
              {days} hari tersisa di trial — upgrade untuk lock semua fitur.
            </h2>
            <p className="text-white/70 text-sm mt-1">
              Pilih paket Starter / Growth / Enterprise sebelum trial berakhir agar tidak terputus.
            </p>
          </div>
          <Link to="/pricing" className="btn-accent shrink-0" data-testid="trial-banner-upgrade-cta">
            <Sparkles size={16} /> Upgrade Plan
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Penjualan Hari Ini" value={fmtIDR(stats?.today_sales || 0)} icon={TrendingUp}
              hint={`${stats?.today_orders || 0} transaksi`} testid="stat-today" />
        <Stat label="7 Hari Terakhir" value={fmtIDR(stats?.week_sales || 0)} icon={Calendar}
              hint={`${stats?.week_orders || 0} transaksi`} testid="stat-week" />
        <Stat label="30 Hari Terakhir" value={fmtIDR(stats?.month_sales || 0)} icon={ShoppingCart}
              hint={`${stats?.month_orders || 0} transaksi`} testid="stat-month" />
        <Stat label="Produk Aktif" value={stats?.product_count || 0} icon={Package}
              hint="Jumlah SKU di toko" testid="stat-products" />
      </div>

      <div className="card-surface p-6" data-testid="recent-orders">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold">Transaksi terbaru</h2>
          <Link to="/app/sales" className="text-sm text-[hsl(var(--primary))] font-semibold" data-testid="see-all-orders">
            Lihat semua →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted))]" data-testid="no-recent-orders">
            Belum ada transaksi. Buka POS dan mulai jualan!
          </p>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {recent.map((o) => (
              <div key={o.id} className="flex items-center justify-between py-3" data-testid={`recent-order-${o.id}`}>
                <div>
                  <p className="font-medium text-sm">{o.order_no}</p>
                  <p className="text-xs text-[hsl(var(--muted))]">
                    {o.items?.length || 0} item · {o.payment_method?.toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold num-display">{fmtIDR(o.total)}</p>
                  <span className={`pill ${
                    o.payment_status === "paid" ? "pill-success" :
                    o.payment_status === "pending" ? "pill-warning" : "pill-danger"
                  }`}>{o.payment_status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
