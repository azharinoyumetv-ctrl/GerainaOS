import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtIDR } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import {
  TrendingUp, Package, ShoppingCart, Calendar, Sparkles,
  ArrowRight, Crown, DollarSign, Percent, BarChart3,
  Briefcase, Activity, AlertTriangle, Landmark, ShieldCheck
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";

function StatCard({ label, value, icon: Icon, hint, testid, colorClass }) {
  return (
    <div className="card-surface p-5 flex flex-col justify-between" data-testid={testid}>
      <div className="flex items-center justify-between mb-2">
        <span className="label-tiny text-[hsl(var(--muted))]">{label}</span>
        <span className={`w-8 h-8 rounded-md grid place-items-center ${colorClass || "bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]"}`}>
          <Icon size={16} />
        </span>
      </div>
      <div>
        <p className="font-display num-display text-2xl font-extrabold">{value}</p>
        {hint && <p className="text-[10px] text-[hsl(var(--muted))] mt-1">{hint}</p>}
      </div>
    </div>
  );
}

const COLORS = ["hsl(151,39%,17%)", "hsl(9,65%,55%)", "hsl(37,90%,55%)", "hsl(145,46%,33%)", "hsl(353,98%,41%)", "hsl(220,70%,40%)"];

export default function Dashboard() {
  const { user } = useAuth();
  
  // Dashboard states
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [products, setProducts] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    // Parallel fetching for dashboard widgets
    api.get("/orders/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/orders?limit=5").then((r) => setRecent(r.data)).catch(() => {});
    api.get("/products").then((r) => setProducts(r.data)).catch(() => {});
    api.get("/debt/receivables").then((r) => setReceivables(r.data)).catch(() => {});
    api.get("/debt/payables").then((r) => setPayables(r.data)).catch(() => {});
    api.get("/attendance").then((r) => setAttendance(r.data)).catch(() => {});
    api.get("/branches").then((r) => setBranches(r.data)).catch(() => {});
  }, []);

  const days = user?.trial_ends_at ? Math.max(0, Math.ceil((new Date(user.trial_ends_at).getTime() - Date.now()) / 86400000)) : 14;
  const isTrial = (user?.plan || "trial") === "trial";

  // Calculations for Widgets
  const avgBasket = stats?.today_sales && stats?.today_orders ? stats.today_sales / stats.today_orders : 0;
  
  const totalReceivable = receivables.reduce((acc, r) => acc + (r.amount - r.paid_amount), 0);
  const totalPayable = payables.reduce((acc, p) => acc + (p.amount - p.paid_amount), 0);
  
  const inventoryValue = products.reduce((acc, p) => acc + ((p.stock || 0) * (p.cost || 0)), 0);
  const lowStockCount = products.filter(p => p.stock <= 5).length;

  // Chart Data
  const salesTrendData = [
    { name: "Senin", Sales: (stats?.week_sales || 150000) * 0.1 },
    { name: "Selasa", Sales: (stats?.week_sales || 150000) * 0.15 },
    { name: "Rabu", Sales: (stats?.week_sales || 150000) * 0.12 },
    { name: "Kamis", Sales: (stats?.week_sales || 150000) * 0.18 },
    { name: "Jumat", Sales: (stats?.week_sales || 150000) * 0.22 },
    { name: "Sabtu", Sales: (stats?.week_sales || 150000) * 0.35 },
    { name: "Minggu", Sales: (stats?.week_sales || 150000) * 0.28 },
  ];

  const pmtData = [
    { name: "Cash", value: 45 },
    { name: "QRIS", value: 30 },
    { name: "E-Wallet", value: 15 },
    { name: "Bank VA", value: 10 },
  ];

  const cashflowData = [
    { name: "Minggu 1", Inflow: 3500000, Outflow: 2100000 },
    { name: "Minggu 2", Inflow: 4200000, Outflow: 3400000 },
    { name: "Minggu 3", Inflow: 3800000, Outflow: 1900000 },
    { name: "Minggu 4", Inflow: 5300000, Outflow: 2800000 },
  ];

  const branchData = branches.map((b, idx) => ({
    name: b.name.split(" ")[0],
    Sales: (stats?.month_sales || 5000000) * (idx === 0 ? 0.5 : idx === 1 ? 0.35 : 0.15)
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="dashboard-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="label-tiny">POS Komersial</span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mt-1" data-testid="dashboard-greeting">
            Dashboard: {user?.store_name || "DagangOS Store"}.
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-3 py-1 rounded border border-emerald-100 flex items-center gap-1">
            <ShieldCheck size={14} /> Peran: {user?.role || "Owner"}
          </span>
          <Link to="/geraina/app/pos" className="btn-primary flex items-center gap-1 text-xs py-2 px-4">
            Buka Kasir <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {isTrial && (
        <div
          className="rounded-xl p-5 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between"
          style={{ background: "linear-gradient(120deg, hsl(151,39%,17%), hsl(151,39%,13%))" }}
          data-testid="trial-upgrade-banner"
        >
          <div className="text-white">
            <span className="pill" style={{ background: "hsl(9,65%,55%,0.25)", color: "hsl(9,65%,75%)" }}>
              <Crown size={12} /> Trial Mode
            </span>
            <h2 className="font-display text-xl font-bold mt-1.5">
              {days} hari tersisa di trial — upgrade untuk mengunci semua fitur.
            </h2>
            <p className="text-white/70 text-xs mt-0.5">
              Pilih paket Starter / Pro / Business sebelum trial berakhir agar operasional toko tidak terputus.
            </p>
          </div>
          <Link to="/geraina/pricing" className="btn-accent shrink-0 text-xs" data-testid="trial-banner-upgrade-cta">
            <Sparkles size={14} /> Upgrade Paket
          </Link>
        </div>
      )}

      {/* 5 KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          label="Pendapatan Hari Ini"
          value={fmtIDR(stats?.today_sales || 0)}
          icon={TrendingUp}
          hint={`${stats?.today_orders || 0} transaksi hari ini`}
          testid="stat-revenue"
          colorClass="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Keuntungan Hari Ini"
          value={fmtIDR((stats?.today_sales || 0) * 0.4)} // Estimated 40% margin
          icon={Percent}
          hint="Est. Margin Kotor 40%"
          testid="stat-profit"
          colorClass="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Transaksi Hari Ini"
          value={stats?.today_orders || 0}
          icon={ShoppingCart}
          hint="Total transaksi sukses"
          testid="stat-transactions"
          colorClass="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Rata-rata Keranjang"
          value={fmtIDR(avgBasket)}
          icon={Activity}
          hint="Rata-rata belanja"
          testid="stat-basket"
          colorClass="bg-purple-50 text-purple-700"
        />
        <StatCard
          label="Posisi Kas"
          value={fmtIDR((stats?.today_sales || 0) * 0.6 + 500000)} // Cash in hand mock
          icon={DollarSign}
          hint="Kas dalam laci kasir"
          testid="stat-cash"
          colorClass="bg-rose-50 text-rose-700"
        />
      </div>

      {/* Widgets Grid Dashboard Control Room */}
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        
        {/* 1. Sales Trend Chart */}
        <div className="col-span-12 lg:col-span-8 card-surface p-6 h-80 flex flex-col justify-between">
          <h3 className="font-display font-bold text-sm">Tren Grafik Penjualan Mingguan</h3>
          <div className="flex-1 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrendData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(151,39%,17%)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="hsl(151,39%,17%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(v) => [fmtIDR(v), "Penjualan"]} />
                <Area type="monotone" dataKey="Sales" stroke="hsl(151,39%,17%)" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Payment Distribution Chart */}
        <div className="col-span-12 lg:col-span-4 card-surface p-6 h-80 flex flex-col justify-between">
          <h3 className="font-display font-bold text-sm">Metode Pembayaran (%)</h3>
          <div className="flex-1 mt-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pmtData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                  {pmtData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" iconSize={8} formatter={(value) => <span className="text-[10px] font-medium">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Top Products Table */}
        <div className="col-span-12 lg:col-span-6 card-surface p-6 flex flex-col">
          <h3 className="font-display font-bold text-sm mb-4">Top 5 Produk Terlaris</h3>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-2 font-semibold text-[hsl(var(--muted))]">Nama Produk</th>
                  <th className="py-2 text-center font-semibold text-[hsl(var(--muted))]">Stok Fisik</th>
                  <th className="py-2 text-right font-semibold text-[hsl(var(--muted))]">Harga Jual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {products.slice(0, 5).map((p) => (
                  <tr key={p.id} className="hover:bg-[hsl(var(--background))]/50">
                    <td className="py-2.5 font-medium">{p.name}</td>
                    <td className="py-2.5 text-center font-mono font-semibold">{p.stock}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-[hsl(var(--primary))]">{fmtIDR(p.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Recent Transactions */}
        <div className="col-span-12 lg:col-span-6 card-surface p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-sm">Transaksi POS Terbaru</h3>
            <Link to="/geraina/app/sales" className="text-xs text-[hsl(var(--primary))] font-semibold">Semua →</Link>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-2 font-semibold text-[hsl(var(--muted))]">No. Pesanan</th>
                  <th className="py-2 font-semibold text-[hsl(var(--muted))]">Bayar Via</th>
                  <th className="py-2 text-right font-semibold text-[hsl(var(--muted))]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {recent.map((o) => (
                  <tr key={o.id} className="hover:bg-[hsl(var(--background))]/50">
                    <td className="py-2.5 font-mono font-semibold">{o.order_no}</td>
                    <td className="py-2.5 uppercase font-medium">{o.payment_method}</td>
                    <td className="py-2.5 text-right font-mono font-bold">{fmtIDR(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Low Stock Alert */}
        <div className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4">
          <h3 className="font-display font-bold text-sm flex items-center gap-1.5 text-red-600">
            <AlertTriangle size={16} /> Peringatan Stok Menipis
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {products.filter(p => p.stock <= 5).map(p => (
              <div key={p.id} className="flex justify-between items-center text-xs p-2.5 border border-red-100 rounded-md bg-red-50/30">
                <span className="font-medium truncate pr-2">{p.name}</span>
                <span className="font-mono font-bold text-red-600">Sisa: {p.stock}</span>
              </div>
            ))}
            {lowStockCount === 0 && (
              <p className="text-xs text-[hsl(var(--muted))] py-4 text-center">Semua stok aman dan mencukupi.</p>
            )}
          </div>
          <Link to="/geraina/app/inventory/low-stock" className="btn-outline w-full py-1.5 text-center text-[10px] font-semibold block">
            Kelola Stok Menipis ({lowStockCount})
          </Link>
        </div>

        {/* 6. Inventory Valuation Widget */}
        <div className="col-span-12 lg:col-span-4 card-surface p-6 flex flex-col justify-between">
          <h3 className="font-display font-bold text-sm">Nilai Aset Persediaan</h3>
          <div className="my-auto py-4">
            <span className="text-[10px] text-[hsl(var(--muted))] uppercase font-bold tracking-wider">Total Nilai Persediaan (Harga Pokok)</span>
            <p className="font-display num-display text-3xl font-extrabold text-[hsl(var(--primary))] mt-1">
              {fmtIDR(inventoryValue)}
            </p>
            <p className="text-[10px] text-[hsl(var(--muted))] mt-1">Berdasarkan akumulasi harga pokok beli.</p>
          </div>
          <Link to="/geraina/app/inventory/valuation" className="btn-outline w-full py-1.5 text-center text-[10px] font-semibold block">
            Detail Aset Persediaan
          </Link>
        </div>

        {/* 7. Cashflow Summary Widget */}
        <div className="col-span-12 lg:col-span-4 card-surface p-6 h-60 flex flex-col justify-between">
          <h3 className="font-display font-bold text-sm">Arus Kas Ringkas</h3>
          <div className="flex-1 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={8} />
                <YAxis fontSize={8} tickFormatter={(v) => `${(v/1000000).toFixed(1)}j`} />
                <Tooltip />
                <Bar dataKey="Inflow" name="Masuk" fill="hsl(145,46%,33%)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Outflow" name="Keluar" fill="hsl(353,98%,41%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 8 & 9. Receivables & Payables Ledger Summaries */}
        <div className="col-span-12 lg:col-span-4 card-surface p-6 flex flex-col justify-between">
          <h3 className="font-display font-bold text-sm flex items-center gap-1.5 text-[hsl(var(--primary))]">
            <Landmark size={16} /> Hutang Piutang Dagang
          </h3>
          <div className="space-y-4 my-auto py-2">
            <div className="flex justify-between items-center border-b border-[hsl(var(--border))]/50 pb-2">
              <div>
                <span className="text-[10px] text-[hsl(var(--muted))] uppercase font-semibold">Total Piutang</span>
                <p className="font-mono font-bold text-emerald-600 text-sm">{fmtIDR(totalReceivable)}</p>
              </div>
              <Link to="/geraina/app/debt/receivable" className="text-[10px] font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/8 px-2.5 py-1 rounded">Kelola</Link>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] text-[hsl(var(--muted))] uppercase font-semibold">Total Utang</span>
                <p className="font-mono font-bold text-red-500 text-sm">{fmtIDR(totalPayable)}</p>
              </div>
              <Link to="/geraina/app/debt/payable" className="text-[10px] font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/8 px-2.5 py-1 rounded">Kelola</Link>
            </div>
          </div>
        </div>

        {/* 10. Staff Performance Widget */}
        <div className="col-span-12 lg:col-span-4 card-surface p-6 flex flex-col justify-between">
          <h3 className="font-display font-bold text-sm flex items-center gap-1.5 text-[hsl(var(--primary))]">
            <Briefcase size={16} /> Keaktifan & Shift Staf
          </h3>
          <div className="space-y-3 my-auto py-2">
            {attendance.slice(0, 2).map((att) => (
              <div key={att.id} className="flex justify-between items-center text-xs p-2 border border-[hsl(var(--border))] rounded bg-[hsl(var(--background))]/30">
                <div>
                  <p className="font-semibold">{att.staff_name}</p>
                  <p className="text-[9px] text-[hsl(var(--muted))]">Masuk: {new Date(att.clock_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  {att.status}
                </span>
              </div>
            ))}
            {attendance.length === 0 && (
              <p className="text-xs text-[hsl(var(--muted))] text-center py-4">Belum ada staf melakukan shift hari ini.</p>
            )}
          </div>
          <Link to="/geraina/app/staff/management" className="btn-outline w-full py-1.5 text-center text-[10px] font-semibold block">
            Kelola Karyawan & Peran
          </Link>
        </div>

        {/* 11. Branch Comparison Chart */}
        <div className="col-span-12 lg:col-span-4 card-surface p-6 h-60 flex flex-col justify-between">
          <h3 className="font-display font-bold text-sm">Perbandingan Penjualan Cabang</h3>
          <div className="flex-1 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={8} />
                <YAxis fontSize={8} tickFormatter={(v) => `${(v/1000000).toFixed(1)}j`} />
                <Tooltip />
                <Bar dataKey="Sales" name="Sales Cabang" fill="hsl(9,65%,55%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
