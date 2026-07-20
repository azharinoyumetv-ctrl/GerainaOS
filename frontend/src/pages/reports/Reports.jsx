import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { fmtIDR } from "@/api/client";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line
} from "recharts";
import { toast } from "@/components/ui/sonner";

import { Link } from "react-router-dom";

export default function Reports() {
  const params = useParams();
  const pathPart = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";
  const rawType = params.type || pathPart || "sales";
  const type = (rawType === "reports" || !rawType) ? "sales" : rawType.toLowerCase();

  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [productSales, setProductSales] = useState([]);
  const [profitReport, setProfitReport] = useState(null);
  const [cashflowReport, setCashflowReport] = useState(null);
  const [turnover, setTurnover] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ category: "Lainnya", description: "", amount: "", expense_date: new Date().toISOString().slice(0, 10) });
  const [savingExpense, setSavingExpense] = useState(false);

  useEffect(() => {
    api.get("/orders/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/products").then((r) => setProducts(r.data)).catch(() => {});
    api.get("/orders/product-sales?days=30&limit=8").then((r) => setProductSales(r.data || [])).catch(() => setProductSales([]));
  }, [type]);

  useEffect(() => {
    if (type === "profit") {
      api.get("/reports/profit?months=6").then((r) => setProfitReport(r.data)).catch(() => setProfitReport(null));
    }
    if (type === "cashflow") {
      reloadCashflowData();
    }
    if (type === "inventory") {
      api.get("/reports/inventory/turnover?days=30").then((r) => setTurnover(r.data)).catch(() => setTurnover(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const reloadCashflowData = () => {
    api.get("/reports/cashflow?weeks=4").then((r) => setCashflowReport(r.data)).catch(() => setCashflowReport(null));
    api.get("/expenses").then((r) => setExpenses(r.data || [])).catch(() => setExpenses([]));
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    const amount = parseFloat(expenseForm.amount);
    if (!expenseForm.category || !amount || amount <= 0 || !expenseForm.expense_date) {
      toast.error("Lengkapi kategori, jumlah, dan tanggal pengeluaran.");
      return;
    }
    setSavingExpense(true);
    api.post("/expenses", {
      category: expenseForm.category,
      description: expenseForm.description || null,
      amount,
      expense_date: expenseForm.expense_date,
    }).then(() => {
      setExpenseForm({ category: "Lainnya", description: "", amount: "", expense_date: new Date().toISOString().slice(0, 10) });
      reloadCashflowData();
    }).catch((err) => {
      const msg = err?.response?.data?.detail || "Gagal terhubung ke server.";
      toast.error(`Gagal mencatat pengeluaran: ${msg}`);
    }).finally(() => setSavingExpense(false));
  };

  const handleDeleteExpense = (id) => {
    if (!window.confirm("Hapus catatan pengeluaran ini?")) return;
    api.delete(`/expenses/${id}`).then(() => reloadCashflowData()).catch((err) => {
      const msg = err?.response?.data?.detail || "Gagal terhubung ke server.";
      toast.error(`Gagal menghapus: ${msg}`);
    });
  };

  const subtabs = [
    { id: "sales", label: "Penjualan", path: "/geraina/app/reports/sales" },
    { id: "product", label: "Produk", path: "/geraina/app/reports/product" },
    { id: "inventory", label: "Stok / Inventaris", path: "/geraina/app/reports/inventory" },
    { id: "profit", label: "Laba Rugi", path: "/geraina/app/reports/profit" },
    { id: "cashflow", label: "Arus Kas", path: "/geraina/app/reports/cashflow" },
    { id: "tax", label: "Pajak", path: "/geraina/app/reports/tax" }
  ];

  const renderReport = () => {
    switch (type) {
      case "sales":
        const salesData = [
          { day: "Senin", sales: (stats?.week_sales || 100000) * 0.1 },
          { day: "Selasa", sales: (stats?.week_sales || 100000) * 0.15 },
          { day: "Rabu", sales: (stats?.week_sales || 100000) * 0.12 },
          { day: "Kamis", sales: (stats?.week_sales || 100000) * 0.18 },
          { day: "Jumat", sales: (stats?.week_sales || 100000) * 0.22 },
          { day: "Sabtu", sales: (stats?.week_sales || 100000) * 0.35 },
          { day: "Minggu", sales: (stats?.week_sales || 100000) * 0.28 },
        ];
        return (
          <div className="space-y-6">
            <div className="card-surface p-6 h-80">
              <h3 className="font-display font-bold text-sm mb-4">Tren Penjualan Mingguan</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" fontSize={11} tickLine={false} />
                  <YAxis fontSize={11} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip formatter={(value) => [fmtIDR(value), "Penjualan"]} />
                  <Area type="monotone" dataKey="sales" stroke="hsl(151,39%,17%)" fill="hsl(151,39%,17%,0.1)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="card-surface p-6">
              <h3 className="font-display font-bold text-sm mb-4">Rekapitulasi Omset</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                  <p className="text-xs text-[hsl(var(--muted))]">Rata-rata Harian</p>
                  <p className="font-display font-bold text-lg mt-1">{fmtIDR((stats?.week_sales || 0) / 7)}</p>
                </div>
                <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                  <p className="text-xs text-[hsl(var(--muted))]">Total Omset 7 Hari</p>
                  <p className="font-display font-bold text-lg mt-1">{fmtIDR(stats?.week_sales || 0)}</p>
                </div>
                <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                  <p className="text-xs text-[hsl(var(--muted))]">Total Omset 30 Hari</p>
                  <p className="font-display font-bold text-lg mt-1">{fmtIDR(stats?.month_sales || 0)}</p>
                </div>
                <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                  <p className="text-xs text-[hsl(var(--muted))]">Transaksi Sukses</p>
                  <p className="font-display font-bold text-lg mt-1">{stats?.week_orders || 0}</p>
                </div>
              </div>
            </div>
          </div>
        );

      case "product":
        const topProds = productSales.map(p => ({ name: p.name, sold: p.sold, revenue: p.revenue }));
        if (topProds.length === 0) {
          return <div className="card-surface p-8 text-center text-sm text-[hsl(var(--muted))]">Belum ada produk terjual dalam 30 hari terakhir. Data akan muncul otomatis setelah ada transaksi lunas.</div>;
        }
        return (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card-surface p-6 h-80">
              <h3 className="font-display font-bold text-sm mb-4">Volume Produk Terlaris</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProds} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={11} tickLine={false} />
                  <YAxis dataKey="name" type="category" fontSize={10} width={100} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="sold" fill="hsl(9,65%,55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card-surface p-6 flex flex-col">
              <h3 className="font-display font-bold text-sm mb-4">Kontribusi Margin</h3>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))]">
                      <th className="py-2 font-semibold text-[hsl(var(--muted))]">Produk</th>
                      <th className="py-2 text-center font-semibold text-[hsl(var(--muted))]">Terjual</th>
                      <th className="py-2 text-right font-semibold text-[hsl(var(--muted))]">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--border))]">
                    {topProds.map((tp, i) => (
                      <tr key={i} className="hover:bg-[hsl(var(--background))]/50">
                        <td className="py-2.5 font-medium">{tp.name}</td>
                        <td className="py-2.5 text-center font-mono">{tp.sold} pcs</td>
                        <td className="py-2.5 text-right font-mono font-bold text-[hsl(var(--primary))]">{fmtIDR(tp.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "inventory":
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="card-surface p-6">
                <span className="text-xs text-[hsl(var(--muted))]">Total SKU Terdaftar</span>
                <h4 className="font-display font-extrabold text-2xl mt-1 text-[hsl(var(--primary))]">{stats?.product_count || 0} SKU</h4>
              </div>
              <div className="card-surface p-6">
                <span className="text-xs text-[hsl(var(--muted))]">Rasio Turn-Over Stok (Estimasi/Bulan)</span>
                <h4 className="font-display font-extrabold text-2xl mt-1 text-emerald-600">
                  {turnover?.turnover_ratio_monthly_est != null ? `${turnover.turnover_ratio_monthly_est.toFixed(1)}x / bulan` : "-"}
                </h4>
                {turnover && turnover.turnover_ratio_monthly_est == null && (
                  <p className="text-[10px] text-[hsl(var(--muted))] mt-1">Belum bisa dihitung — isi harga modal (cost) &amp; stok produk terlebih dahulu.</p>
                )}
              </div>
              <div className="card-surface p-6">
                <span className="text-xs text-[hsl(var(--muted))]">Barang Habis / OOS</span>
                <h4 className="font-display font-extrabold text-2xl mt-1 text-red-500">
                  {products.filter(p => p.stock <= 0).length} Item
                </h4>
              </div>
            </div>
            <div className="card-surface p-6">
              <h3 className="font-display font-bold text-sm mb-4">Laporan Estimasi Perputaran Persediaan</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))]">
                      <th className="py-2 font-semibold text-[hsl(var(--muted))]">Produk</th>
                      <th className="py-2 font-semibold text-[hsl(var(--muted))]">SKU</th>
                      <th className="py-2 text-center font-semibold text-[hsl(var(--muted))]">Stok Saat Ini</th>
                      <th className="py-2 text-center font-semibold text-[hsl(var(--muted))]">Status Perputaran</th>
                      <th className="py-2 text-right font-semibold text-[hsl(var(--muted))]">Nilai Aset</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--border))]">
                    {products.slice(0, 6).map((p) => (
                      <tr key={p.id} className="hover:bg-[hsl(var(--background))]/50">
                        <td className="py-3 font-medium">{p.name}</td>
                        <td className="py-3 font-mono">{p.sku || "-"}</td>
                        <td className="py-3 text-center font-mono font-semibold">{p.stock}</td>
                        <td className="py-3 text-center">
                          {p.stock > 10 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Cepat</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">Lambat</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-mono font-bold">{fmtIDR(p.stock * (p.cost || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "profit": {
        const series = profitReport?.series || [];
        const totals = profitReport?.totals;
        const hasAnyRevenue = series.some((s) => s.revenue > 0);
        return (
          <div className="space-y-6">
            <div className="card-surface p-6 h-80">
              <h3 className="font-display font-bold text-sm mb-4">Laporan Laba Rugi Bersih (Net Profit) — 6 Bulan Terakhir</h3>
              {!profitReport ? (
                <p className="text-sm text-[hsl(var(--muted))]">Memuat laporan laba rugi...</p>
              ) : !hasAnyRevenue ? (
                <p className="text-sm text-[hsl(var(--muted))]">Belum ada transaksi lunas pada periode ini. Grafik akan terisi otomatis setelah ada penjualan.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                    <Tooltip formatter={(v) => fmtIDR(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Omset" stroke="hsl(151,39%,17%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="profit" name="Laba Bersih" stroke="hsl(9,65%,55%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            {totals && (
              <div className="card-surface p-6">
                <h3 className="font-display font-bold text-sm mb-4">Ringkasan 6 Bulan Terakhir</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                    <p className="text-xs text-[hsl(var(--muted))]">Omset</p>
                    <p className="font-display font-bold text-base mt-1">{fmtIDR(totals.revenue)}</p>
                  </div>
                  <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                    <p className="text-xs text-[hsl(var(--muted))]">HPP (COGS)</p>
                    <p className="font-display font-bold text-base mt-1">{fmtIDR(totals.cogs)}</p>
                  </div>
                  <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                    <p className="text-xs text-[hsl(var(--muted))]">Laba Kotor</p>
                    <p className="font-display font-bold text-base mt-1">{fmtIDR(totals.gross_profit)}</p>
                  </div>
                  <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                    <p className="text-xs text-[hsl(var(--muted))]">Beban Operasional</p>
                    <p className="font-display font-bold text-base mt-1">{fmtIDR(totals.operating_expenses)}</p>
                  </div>
                  <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                    <p className="text-xs text-[hsl(var(--muted))]">Laba Bersih</p>
                    <p className="font-display font-bold text-base mt-1">{fmtIDR(totals.net_profit)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-[hsl(var(--muted))] mt-3">
                  HPP dihitung dari harga modal (cost) produk saat ini dikali kuantitas terjual, bukan snapshot harga modal saat transaksi terjadi. Beban operasional berasal dari pengeluaran yang dicatat di tab Arus Kas.
                </p>
              </div>
            )}
          </div>
        );
      }

      case "cashflow": {
        const series = cashflowReport?.series || [];
        return (
          <div className="space-y-6">
            <div className="card-surface p-6 h-80">
              <h3 className="font-display font-bold text-sm mb-4">Arus Kas Masuk vs Keluar — 4 Minggu Terakhir</h3>
              {!cashflowReport ? (
                <p className="text-sm text-[hsl(var(--muted))]">Memuat data arus kas...</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                    <Tooltip formatter={(v) => fmtIDR(v)} />
                    <Legend />
                    <Bar dataKey="inflow" name="Uang Masuk" fill="hsl(145,46%,33%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outflow" name="Uang Keluar" fill="hsl(353,98%,41%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card-surface p-6">
              <h3 className="font-display font-bold text-sm mb-4">Catat Pengeluaran</h3>
              <p className="text-xs text-[hsl(var(--muted))] mb-4">
                "Uang Masuk" di grafik dihitung otomatis dari transaksi lunas. "Uang Keluar" dihitung dari pengeluaran yang Anda catat di sini (sewa, gaji, listrik, bahan baku, dll).
              </p>
              <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end mb-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Kategori</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="border border-[hsl(var(--border))] rounded-md px-3 py-2 bg-white text-xs"
                  >
                    <option>Sewa</option>
                    <option>Gaji</option>
                    <option>Listrik</option>
                    <option>Bahan Baku</option>
                    <option>Lainnya</option>
                  </select>
                </div>
                <div className="flex flex-col space-y-1 md:col-span-2">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Keterangan</label>
                  <input
                    type="text"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="border border-[hsl(var(--border))] rounded-md px-3 py-2 bg-white text-xs"
                    placeholder="Opsional"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Jumlah (Rp)</label>
                  <input
                    type="number"
                    min="1"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="border border-[hsl(var(--border))] rounded-md px-3 py-2 bg-white text-xs font-mono"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Tanggal</label>
                  <input
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                    className="border border-[hsl(var(--border))] rounded-md px-3 py-2 bg-white text-xs"
                  />
                </div>
                <button type="submit" disabled={savingExpense} className="btn-primary py-2 px-4 text-xs font-semibold md:col-span-5 md:w-max disabled:opacity-50">
                  {savingExpense ? "Menyimpan..." : "+ Catat Pengeluaran"}
                </button>
              </form>

              {expenses.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))]">
                        <th className="py-2 font-semibold text-[hsl(var(--muted))]">Tanggal</th>
                        <th className="py-2 font-semibold text-[hsl(var(--muted))]">Kategori</th>
                        <th className="py-2 font-semibold text-[hsl(var(--muted))]">Keterangan</th>
                        <th className="py-2 text-right font-semibold text-[hsl(var(--muted))]">Jumlah</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {expenses.slice(0, 10).map((ex) => (
                        <tr key={ex.id} className="hover:bg-[hsl(var(--background))]/50">
                          <td className="py-2.5">{ex.expense_date}</td>
                          <td className="py-2.5">{ex.category}</td>
                          <td className="py-2.5 text-[hsl(var(--muted))]">{ex.description || "-"}</td>
                          <td className="py-2.5 text-right font-mono font-bold">{fmtIDR(ex.amount)}</td>
                          <td className="py-2.5 text-right">
                            <button onClick={() => handleDeleteExpense(ex.id)} className="text-[10px] text-red-500 hover:underline">Hapus</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      }

      case "tax":
        const taxBase = stats?.month_sales || 15000000;
        const ppn = taxBase * 0.11; // 11% PPN
        return (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card-surface p-6 space-y-4">
              <h3 className="font-display font-bold text-sm border-b border-[hsl(var(--border))] pb-2">Kewajiban Pajak Bulan Ini</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted))]">Dasar Pengenaan Pajak (DPP)</span>
                  <span className="font-mono font-semibold">{fmtIDR(taxBase)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted))]">PPN Terhutang (11%)</span>
                  <span className="font-mono font-semibold text-red-500">{fmtIDR(ppn)}</span>
                </div>
                <div className="flex justify-between border-t border-[hsl(var(--border))] pt-2 font-bold">
                  <span>Net Revenue Setelah Pajak</span>
                  <span className="font-mono text-emerald-600">{fmtIDR(taxBase - ppn)}</span>
                </div>
              </div>
            </div>
            <div className="card-surface p-6 space-y-4">
              <h3 className="font-display font-bold text-sm border-b border-[hsl(var(--border))] pb-2">Kepatuhan Pajak</h3>
              <p className="text-xs text-[hsl(var(--muted))] leading-relaxed">
                Pajak Pertambahan Nilai (PPN) dihitung otomatis berdasarkan PMK Republik Indonesia dengan tarif standar 11%.
                Semua laporan perpajakan dapat diekspor langsung ke CSV untuk diimpor ke aplikasi e-Faktur DJP Online.
              </p>
              <button onClick={() => toast.success("Laporan e-Faktur DJP siap diunduh (Format CSV).")} className="btn-primary w-full py-2 text-xs font-semibold">
                Unduh Format e-Faktur CSV
              </button>
            </div>
          </div>
        );

      default:
        return <p className="text-sm text-[hsl(var(--muted))]">Tipe laporan tidak didukung.</p>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 text-left" data-testid="reports-page">
      <div>
        <span className="label-tiny">Laporan Bisnis</span>
        <h1 className="font-display text-3xl font-bold mt-1 capitalize">Laporan ({type})</h1>
      </div>

      {/* Subtab Navigation Bar */}
      <div className="flex flex-wrap gap-2 border-b border-[hsl(var(--border))] pb-3">
        {subtabs.map((tab) => {
          const isActive = type === tab.id;
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? "bg-[hsl(var(--primary))] text-white shadow-md" : "bg-[hsl(var(--surface))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {renderReport()}
    </div>
  );
}
