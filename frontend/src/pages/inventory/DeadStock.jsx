import { useAuth } from "@/auth/AuthContext";
import ReadState from "@/components/ReadState";
import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";

export default function DeadStock() {
  const { user } = useAuth();
  const actor = `${user?.id}:${user?.store_id}`;
  const [page, setPage] = useState({ actor: null, cursor: null, previous: [], index: 0 });
  const currentPage = page.actor === actor ? page : { actor, cursor: null, previous: [], index: 0 };
  const key = `${actor}:${currentPage.cursor || ""}`;
  const [attempt, setAttempt] = useState(0), [read, setRead] = useState({ key: "", loading: true, error: "", data: null });
  useEffect(() => {
    let active = true; const controller = new AbortController();
    setRead({ key, loading: true, error: "", data: null });
    api.get("/reports/inventory/dead-stock", { timeout: 15000, signal: controller.signal, params: { cursor: currentPage.cursor, limit: 50 } }).then(({ data }) => {
      if (!Array.isArray(data?.items) || !Number.isInteger(data.total) || data.total < 0 || data.days !== 30 || !(data.next_cursor === null || (typeof data.next_cursor === "string" && data.next_cursor)) || !Number.isFinite(Date.parse(data.window_start)) || !Number.isFinite(Date.parse(data.window_end))) throw new Error("Invalid dead-stock report");
      if (!active) return;
      if (!data.items.length && currentPage.previous.length) {
        setPage({ actor, cursor: currentPage.previous.at(-1), previous: currentPage.previous.slice(0, -1), index: currentPage.index - 1 });
        return;
      }
      setRead({ key, loading: false, error: "", data });
    }).catch(() => { if (active) setRead({ key, loading: false, error: "Laporan stok mati belum dapat dimuat. Periksa koneksi dan coba lagi.", data: null }); });
    return () => { active = false; controller.abort(); };
  }, [key, attempt]);
  const loading = read.key !== key || read.loading, error = read.key === key ? read.error : "";
  const report = read.key === key ? read.data : null;
  const deadProducts = report?.items || [];
  const refresh = () => { setPage({ actor, cursor: null, previous: [], index: 0 }); setAttempt(value => value + 1); };
  const date = value => new Date(value).toLocaleString("id-ID", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="dead-stock-page">
      <div>
        <span className="label-tiny">Inventaris</span>
        <h1 className="font-display text-3xl font-bold mt-1">Stok Mati</h1>
      </div>

      <button type="button" className="btn-outline" onClick={refresh} data-testid="dead-stock-refresh">Segarkan</button>
      <ReadState loading={loading} error={error} retry={() => setAttempt(value => value + 1)} testid="dead-stock-read-state" />
      {!loading && !error && report && <div className="card-surface p-6">
        <h2 className="font-display font-bold text-lg mb-2">Produk Lambat / Tidak Bergerak (Zero Sales 30 Hari Terakhir)</h2>
        <p className="text-xs text-[hsl(var(--muted))] mb-4">
          Gunakan daftar ini untuk merencanakan promo diskon bundel, cuci gudang, atau mengurangi pembelian berikutnya.
        </p>

        <p className="text-xs mb-4" data-testid="dead-stock-period">Periode: {date(report.window_start)} — {date(report.window_end)} UTC. Hanya penjualan lunas yang dihitung.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama Produk</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">SKU</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Kategori</th>
                <th className="py-3 text-center font-semibold text-[hsl(var(--muted))]">Stok Mati</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Harga Pokok (Cost)</th>
                <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Nilai Persediaan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {deadProducts.map((p) => {
                const modal = (p.stock || 0) * (p.cost || 0);
                return (
                  <tr key={p.id} data-testid={`dead-stock-row-${p.id}`} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 font-mono text-xs">{p.sku || "-"}</td>
                    <td className="py-3 text-[hsl(var(--muted))]">{p.category || "-"}</td>
                    <td className="py-3 text-center font-bold font-mono">{p.stock}</td>
                    <td className="py-3 font-mono">{fmtIDR(p.cost || 0)}</td>
                    <td className="py-3 text-right text-red-500 font-mono font-semibold">{fmtIDR(modal)}</td>
                  </tr>
                );
              })}
              {deadProducts.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-[hsl(var(--muted))]" data-testid="dead-stock-empty">Tidak ada produk berstok dengan nol penjualan lunas pada periode ini.</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span data-testid="dead-stock-result-count">{report.total} produk · halaman {currentPage.index + 1}</span>
            <button type="button" className="btn-outline" data-testid="dead-stock-prev" disabled={!currentPage.previous.length} onClick={() => setPage({ actor, cursor: currentPage.previous.at(-1), previous: currentPage.previous.slice(0, -1), index: currentPage.index - 1 })}>Sebelumnya</button>
            <button type="button" className="btn-outline" data-testid="dead-stock-next" disabled={!report.next_cursor} onClick={() => setPage({ actor, cursor: report.next_cursor, previous: [...currentPage.previous, currentPage.cursor], index: currentPage.index + 1 })}>Berikutnya</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
