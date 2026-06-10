import { useEffect, useState } from "react";
import api, { fmtIDR, downloadPdf } from "@/api/client";
import { Printer, FileDown, Search, RefreshCw } from "lucide-react";

export default function Sales() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/orders", { params: { status: filter === "all" ? undefined : filter } });
      setItems(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const filtered = items.filter((o) =>
    !q || o.order_no.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-8 space-y-5" data-testid="sales-page">
      <div className="flex items-end justify-between">
        <div>
          <span className="label-tiny">Riwayat</span>
          <h1 className="font-display text-3xl font-bold mt-1">Penjualan</h1>
        </div>
        <button onClick={load} className="btn-outline" data-testid="sales-refresh"><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="card-surface p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
          <input className="input-field pl-9" placeholder="Cari nomor order…"
                 value={q} onChange={(e) => setQ(e.target.value)} data-testid="sales-search" />
        </div>
        <div className="flex gap-1.5">
          {[["all", "Semua"], ["paid", "Lunas"], ["pending", "Pending"], ["failed", "Gagal"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${filter === v ? "bg-[hsl(var(--primary))] text-white" : "border border-[hsl(var(--border))]"}`}
                    data-testid={`sales-filter-${v}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <table className="w-full text-sm" data-testid="sales-table">
          <thead className="bg-[hsl(var(--background))] border-b border-[hsl(var(--border))]">
            <tr className="text-left">
              <th className="px-5 py-3 label-tiny">No. Order</th>
              <th className="px-5 py-3 label-tiny">Tanggal</th>
              <th className="px-5 py-3 label-tiny">Item</th>
              <th className="px-5 py-3 label-tiny">Metode</th>
              <th className="px-5 py-3 label-tiny text-right">Total</th>
              <th className="px-5 py-3 label-tiny">Status</th>
              <th className="px-5 py-3 label-tiny text-right">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {loading && <tr><td colSpan={7} className="px-5 py-10 text-center text-[hsl(var(--muted))]" data-testid="sales-loading">Memuat…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-[hsl(var(--muted))]" data-testid="sales-empty">Belum ada transaksi.</td></tr>}
            {filtered.map((o) => (
              <tr key={o.id} className="hover:bg-[hsl(var(--background))]" data-testid={`sales-row-${o.id}`}>
                <td className="px-5 py-3 font-medium">{o.order_no}</td>
                <td className="px-5 py-3 text-xs text-[hsl(var(--muted))]">{o.created_at?.slice(0, 19).replace("T", " ")}</td>
                <td className="px-5 py-3 text-xs">{o.items?.length || 0}</td>
                <td className="px-5 py-3">
                  <span className="pill pill-muted">{o.payment_method?.toUpperCase()}</span>
                  {o.ewallet_channel && <span className="text-xs text-[hsl(var(--muted))] ml-1">{o.ewallet_channel}</span>}
                </td>
                <td className="px-5 py-3 text-right font-display font-bold num-display">{fmtIDR(o.total)}</td>
                <td className="px-5 py-3">
                  <span className={`pill ${o.payment_status === "paid" ? "pill-success" : o.payment_status === "pending" ? "pill-warning" : "pill-danger"}`}>
                    {o.payment_status}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => downloadPdf(`/pdf/receipt/${o.id}`, `receipt-${o.order_no}.pdf`)}
                          className="btn-ghost p-1.5" title="Struk thermal" data-testid={`sales-receipt-${o.id}`}>
                    <Printer size={15} />
                  </button>
                  <button onClick={() => downloadPdf(`/pdf/invoice/${o.id}`, `invoice-${o.order_no}.pdf`)}
                          className="btn-ghost p-1.5" title="Invoice A4" data-testid={`sales-invoice-${o.id}`}>
                    <FileDown size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
