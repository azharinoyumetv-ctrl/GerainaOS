import useTablePage from "@/hooks/useTablePage";
import TablePage from "@/components/TablePage";
import ReadState from "@/components/ReadState";
import { useAuth } from "@/auth/AuthContext";
import { loadCatalogue } from "@/api/catalogue";
import SectionNavigation from "@/navigation/SectionNavigation";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api, { fmtIDR } from "@/api/client";
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line
} from "recharts";
import { toast } from "@/components/ui/sonner";


export default function Reports() {
  const params = useParams();
  const pathPart = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";
  const rawType = params.type || pathPart || "sales";
  const type = (rawType === "reports" || !rawType) ? "sales" : rawType.toLowerCase();

  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const inventoryPage = useTablePage(products);
  const [productSales, setProductSales] = useState([]);
  const [profitReport, setProfitReport] = useState(null);
  const [cashflowReport, setCashflowReport] = useState(null);
  const [turnover, setTurnover] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ category: "Lainnya", description: "", amount: "", expense_date: new Date().toISOString().slice(0, 10) });
  const [savingExpense, setSavingExpense] = useState(false);

  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0), [read, setRead] = useState({ key: "", loading: true, error: "" });
  const expenseLock = useRef(false);
  const key = `${user?.id}:${user?.store_id}:${type}`;
  const reloadCashflowData = () => setAttempt(value => value + 1);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    setRead({ key, loading: true, error: "" });
    const get = async (path, shape) => {
      const { data } = await api.get(path, { timeout: 12000, signal: controller.signal });
      if (!shape(data)) throw new Error("Invalid report response");
      return data;
    };
    const object = value => value && typeof value === "object" && !Array.isArray(value);
    (async () => {
      if (type === "sales") {
        const stats = await get("/orders/stats", object); if (active) setStats(stats);
      } else if (type === "product") {
        const rows = await get("/orders/product-sales?days=30&limit=8", Array.isArray); if (active) setProductSales(rows);
      } else if (type === "inventory") {
        const [stats, products, turnover] = await Promise.all([get("/orders/stats", object), loadCatalogue({ signal: controller.signal }), get("/reports/inventory/turnover?days=30", object)]);
        if (active) { setStats(stats); setProducts(products); setTurnover(turnover); }
      } else if (type === "profit") {
        const value = await get("/reports/profit?months=6", value => object(value) && Array.isArray(value.series) && object(value.totals));
        if (active) setProfitReport(value);
      } else if (type === "cashflow") {
        const [value, expenses] = await Promise.all([get("/reports/cashflow?weeks=4", value => object(value) && Array.isArray(value.series)), get("/expenses", Array.isArray)]);
        if (active) { setCashflowReport(value); setExpenses(expenses); }
      }
      if (active) setRead({ key, loading: false, error: "" });
    })().catch(() => { if (active) setRead({ key, loading: false, error: "Laporan belum dapat dimuat. Periksa koneksi dan coba lagi; angka kosong tidak digunakan sebagai pengganti data." }); });
    return () => { active = false; controller.abort(); };
  }, [key, attempt]);

  const handleAddExpense = (e) => {
    e.preventDefault();
    if (expenseLock.current) return;
    const amount = parseFloat(expenseForm.amount);
    if (!expenseForm.category || !amount || amount <= 0 || !expenseForm.expense_date) {
      toast.error("Lengkapi kategori, jumlah, dan tanggal pengeluaran.");
      return;
    }
    expenseLock.current = true; setSavingExpense(true);
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
    }).finally(() => { expenseLock.current = false; setSavingExpense(false); });
  };

  const handleDeleteExpense = (id) => {
    if (!window.confirm("Hapus catatan pengeluaran ini?")) return;
    api.delete(`/expenses/${id}`).then(() => reloadCashflowData()).catch((err) => {
      const msg = err?.response?.data?.detail || "Gagal terhubung ke server.";
      toast.error(`Gagal menghapus: ${msg}`);
    });
  };


  const renderReport = () => {
    switch (type) {
      case "sales":
        return (
          <div className="space-y-6">
            <div className="card-surface p-6" data-testid="sales-daily-unavailable"><h3 className="font-display font-bold text-sm mb-3">Tren Penjualan Harian</h3><p className="text-sm text-[hsl(var(--muted))]">Rincian harian belum tersedia pada laporan ini. Ringkasan di bawah memakai total penjualan yang tercatat.</p></div>
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
                <TablePage value={inventoryPage} />
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
            {profitReport?.notice && <p role="status" className="card-surface p-4 text-sm" data-testid="profit-cost-notice">{profitReport.notice}</p>}
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
                    <p className="font-display font-bold text-base mt-1">{totals.cogs == null ? "Belum diketahui" : fmtIDR(totals.cogs)}</p>
                  </div>
                  <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                    <p className="text-xs text-[hsl(var(--muted))]">Laba Kotor</p>
                    <p className="font-display font-bold text-base mt-1">{totals.gross_profit == null ? "Belum diketahui" : fmtIDR(totals.gross_profit)}</p>
                  </div>
                  <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                    <p className="text-xs text-[hsl(var(--muted))]">Beban Operasional</p>
                    <p className="font-display font-bold text-base mt-1">{fmtIDR(totals.operating_expenses)}</p>
                  </div>
                  <div className="p-4 bg-[hsl(var(--background))] rounded-lg">
                    <p className="text-xs text-[hsl(var(--muted))]">Laba Bersih</p>
                    <p className="font-display font-bold text-base mt-1">{totals.net_profit == null ? "Belum diketahui" : fmtIDR(totals.net_profit)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-[hsl(var(--muted))] mt-3">
                  HPP memakai snapshot biaya per unit yang disimpan bersama transaksi. Mengubah harga modal produk tidak mengubah laba transaksi yang sudah dicatat. Biaya produk yang diisi nol tetap dihitung sebagai HPP nol. Beban operasional berasal dari pengeluaran yang dicatat di tab Arus Kas.
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
        return <div className="card-surface p-6 space-y-4" data-testid="tax-report-unavailable">
          <h2 className="font-display text-lg font-bold">Laporan pajak belum tersedia</h2>
          <p className="text-sm">Perhitungan kewajiban pajak dan ekspor e-Faktur belum tersedia. Nilai pajak pada transaksi tidak otomatis merupakan kewajiban pajak toko.</p>
          <a href="/geraina/app/sales" className="btn-outline inline-flex">Lihat riwayat transaksi</a>
        </div>;

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

      <SectionNavigation section="reports" active={type} />

      <ReadState loading={read.key !== key || read.loading} error={read.key === key ? read.error : ""} retry={reloadCashflowData} testid="reports-read-state" />
      {read.key === key && !read.loading && !read.error && renderReport()}
    </div>
  );
}
