import { useSearchParams } from "react-router-dom";
import ReadState from "@/components/ReadState";
import { useEffect, useRef, useState } from "react";
import api, { fmtIDR, downloadPdf } from "@/api/client";
import { Printer, FileDown, Search, RefreshCw, Ban } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { ReceiptDialog } from "./POS";
import { useAuth } from "@/auth/AuthContext";
import { canonicalRole } from "@/auth/permissions";

export default function Sales() {
  const { user } = useAuth();
  const actorKey = `${user?.id}:${user?.store_id}`;
  const previousActor = useRef(actorKey);
  const [readActor, setReadActor] = useState(null);
  const isOwner = canonicalRole(user?.role) === "Owner";
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [request, setRequest] = useState({ q: "", status: "all", cursor: null, previous: [], index: 0 });
  const [nextCursor, setNextCursor] = useState(null), [total, setTotal] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const reference = searchParams.get("order");
  const [returnError, setReturnError] = useState(""), [returnLoading, setReturnLoading] = useState(false), [returnAttempt, setReturnAttempt] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setRequest(value => value.q === q.trim() && value.status === filter ? value : { q: q.trim(), status: filter, cursor: null, previous: [], index: 0 }), 200);
    return () => clearTimeout(timer);
  }, [q, filter]);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    setReceipt(null); setReturnError(""); setReturnLoading(Boolean(reference));
    if (reference) api.get("/orders/resolve", { signal: controller.signal, timeout: 12000, params: { reference } }).then(({ data }) => {
      if (!data?.id || data.store_id !== user.store_id) throw new Error("Invalid return record");
      if (active) setReceipt(data);
    }).catch(e => { if (active) setReturnError(typeof e?.response?.data?.detail === "string" ? e.response.data.detail : "Transaksi belum dapat dimuat. Masuk ke toko yang sama dan coba lagi."); })
      .finally(() => { if (active) setReturnLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [reference, user?.id, user?.store_id, returnAttempt]);

  const load = () => setAttempt(value => value + 1);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    setLoading(true); setError(""); setItems([]); setNextCursor(null);
    api.get("/orders/history", { signal: controller.signal, timeout: 12000, params: { q: request.q, status: request.status === "all" ? undefined : request.status, cursor: request.cursor, limit: 50 } }).then(({ data }) => {
      if (!Array.isArray(data?.items) || !Number.isInteger(data.total) || !(data.next_cursor === null || typeof data.next_cursor === "string")) throw new Error("Invalid history response");
      if (!active) return;
      if (!data.items.length && request.index > 0) { setRequest(value => ({ ...value, cursor: value.previous.at(-1), previous: value.previous.slice(0, -1), index: value.index - 1 })); return; }
      setItems(data.items); setTotal(data.total); setNextCursor(data.next_cursor);
    }).catch(() => { if (active) setError("Riwayat penjualan belum dapat dimuat. Periksa koneksi dan coba lagi."); })
      .finally(() => { if (active) { setReadActor(actorKey); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [request, user?.id, user?.store_id, attempt]);

  const voidOrder = async (o) => {
    if (!isOwner) return;
    if (!window.confirm(`Batalkan order ${o.order_no}? Stok akan dikembalikan. Pengembalian dana elektronik tidak otomatis; periksa akun merchant. Aksi ini tidak bisa dibatalkan.`)) return;
    try {
      const result = await api.post(`/orders/${o.id}/void`);
      if (result.data.refund_required) toast.info("Periksa dan kembalikan dana melalui akun merchant Anda; pembatalan ini tidak mengirim refund otomatis.");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal membatalkan order (khusus Owner).");
    }
  };

  const filtered = items;
  const busy = loading || readActor !== actorKey || q.trim() !== request.q || filter !== request.status;
  useEffect(() => { if (previousActor.current === actorKey) return; previousActor.current = actorKey; setQ(""); setFilter("all"); setRequest({ q: "", status: "all", cursor: null, previous: [], index: 0 }); }, [actorKey]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="sales-page">
      <div className="flex items-end justify-between">
        <div>
          <span className="label-tiny">Riwayat</span>
          <h1 className="font-display text-3xl font-bold mt-1">Penjualan</h1>
        </div>
        <button onClick={load} className="btn-outline" data-testid="sales-refresh"><RefreshCw size={15} /> Segarkan</button>
      </div>

      <div className="card-surface p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
          <input className="input-field pl-9" placeholder="Cari nomor order…"
                 maxLength={200} value={q} onChange={(e) => { setQ(e.target.value); }} data-testid="sales-search" />
        </div>
        <div className="flex gap-1.5">
          {[["all", "Semua"], ["paid", "Lunas"], ["pending", "Pending"], ["failed", "Gagal"]].map(([v, l]) => (
            <button key={v} onClick={() => { setFilter(v); }}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${filter === v ? "bg-[hsl(var(--primary))] text-white" : "border border-[hsl(var(--border))]"}`}
                    data-testid={`sales-filter-${v}`}>{l}</button>
          ))}
        </div>
      </div>

      <ReadState loading={returnLoading} error={returnError} retry={() => setReturnAttempt(value => value + 1)} testid="payment-return-state" />
      <ReadState error={error} retry={load} testid="sales-error" />
      <div className="card-surface overflow-x-auto">
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
            {busy && <tr><td colSpan={7} className="px-5 py-10 text-center text-[hsl(var(--muted))]" data-testid="sales-loading">Memuat…</td></tr>}
            {!busy && !error && filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-[hsl(var(--muted))]" data-testid="sales-empty">Belum ada transaksi.</td></tr>}
            {!busy && !error && filtered.map((o) => (
              <tr key={o.id} className="hover:bg-[hsl(var(--background))]" data-testid={`sales-row-${o.id}`}>
                <td className="px-5 py-3 font-medium">{o.order_no}</td>
                <td className="px-5 py-3 text-xs text-[hsl(var(--muted))]">{o.created_at?.slice(0, 19).replace("T", " ")}</td>
                <td className="px-5 py-3 text-xs">{o.items?.length || 0}</td>
                <td className="px-5 py-3">
                  <span className="pill pill-muted">{{cash:'Tunai',qris:'QRIS',qris_bank:'QRIS bank',ewallet:'E-Wallet',va:'Virtual Account',credit_card:'Kartu Kredit',doku:'DOKU',edc:'Kartu EDC'}[o.payment_method] || o.payment_method}</span>
                  {o.ewallet_channel && <span className="text-xs text-[hsl(var(--muted))] ml-1">{o.ewallet_channel}</span>}
                </td>
                <td className="px-5 py-3 text-right font-display font-bold num-display">{fmtIDR(o.total)}</td>
                <td className="px-5 py-3">
                  <span className={`pill ${o.payment_status === "paid" ? "pill-success" : o.payment_status === "pending" ? "pill-warning" : "pill-danger"}`}>
                    {o.payment_status}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {<button className="btn-outline text-xs" onClick={async () => { try { const { data } = await api.get(`/orders/${o.id}`); setReceipt(data); } catch { toast.error("Pembayaran belum dapat dimuat. Coba lagi."); } }} data-testid={o.payment_method === "qris_bank" ? `sales-bank-qris-${o.id}` : `sales-open-${o.id}`}>Buka transaksi</button>}
                  <button onClick={() => downloadPdf(`/pdf/receipt/${o.id}`, `receipt-${o.order_no}.pdf`)}
                          className="btn-ghost p-1.5" title="Struk thermal" data-testid={`sales-receipt-${o.id}`}>
                    <Printer size={15} />
                  </button>
                  <button onClick={() => downloadPdf(`/pdf/invoice/${o.id}`, `invoice-${o.order_no}.pdf`)}
                          className="btn-ghost p-1.5" title="Invoice A4" data-testid={`sales-invoice-${o.id}`}>
                    <FileDown size={15} />
                  </button>
                  {isOwner && o.payment_status !== "voided" && (
                    <button onClick={() => voidOrder(o)}
                            className="btn-ghost p-1.5 text-red-600 hover:bg-red-50" title="Batalkan / Void (kembalikan stok)" data-testid={`sales-void-${o.id}`}>
                      <Ban size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3" data-testid="sales-pagination">
        <span data-testid="sales-result-count">{busy ? "Memuat…" : error ? "—" : `${total} transaksi · halaman ${request.index + 1}`}</span>
        <button type="button" className="btn-outline" disabled={busy || !!error || !request.previous.length} data-testid="sales-page-prev" onClick={() => setRequest(value => ({ ...value, cursor: value.previous.at(-1), previous: value.previous.slice(0, -1), index: value.index - 1 }))}>Sebelumnya</button>
        <button type="button" className="btn-outline" disabled={busy || !!error || !nextCursor} data-testid="sales-page-next" onClick={() => setRequest(value => ({ ...value, cursor: nextCursor, previous: [...value.previous, value.cursor], index: value.index + 1 }))}>Berikutnya</button>
      </div>
      {receipt && <ReceiptDialog order={receipt} onClose={() => { setReceipt(null); if (reference) { const next = new URLSearchParams(searchParams); next.delete("order"); setSearchParams(next, { replace: true }); } load(); }} onUpdated={updated => setReceipt(updated)} />}
    </div>
  );
}
