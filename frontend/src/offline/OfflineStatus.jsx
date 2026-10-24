import { useEffect, useState } from "react";
import api from "@/api/client";
import { localSales, synchronize } from "./posStore";

export default function OfflineStatus({ scope, snapshot, onReceipt, onRefresh }) {
  const [rows, setRows] = useState([]), [online, setOnline] = useState(navigator.onLine), [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    let mounted = true, running = false;
    setRows([]);
    const load = () => localSales(scope).then(value => { if (mounted) setRows(value); }).catch(() => {});
    const sync = async () => {
      if (running) return;
      running = true; if (mounted) { setOnline(navigator.onLine); setBusy(true); }
      try { await synchronize(scope, api); await load(); if (mounted) setFailure(""); } catch { if (mounted) setFailure("Penyimpanan transaksi belum dapat dibaca. Jangan hapus data aplikasi."); } finally { running = false; if (mounted) setBusy(false); }
    };
    const connection = () => { setOnline(navigator.onLine); if (navigator.onLine) sync(); };
    load(); sync();
    window.addEventListener("geraina-offline-changed", load);
    window.addEventListener("online", connection); window.addEventListener("offline", connection);
    window.addEventListener("focus", sync);
    window.addEventListener("geraina-sync-requested", sync);
    const timer = setInterval(sync, 30000);
    return () => { mounted = false; clearInterval(timer); window.removeEventListener("geraina-offline-changed", load); window.removeEventListener("online", connection); window.removeEventListener("offline", connection); window.removeEventListener("focus", sync); window.removeEventListener("geraina-sync-requested", sync); };
  }, [scope]);
  const pending = rows.filter(row => row.status !== "synced");
  return <section className="rounded-xl border border-[#ccd9c6] bg-[#f4f8ef] p-3 mb-4 text-sm" data-testid="offline-status" aria-live="polite">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><b>{online ? "Terhubung" : "Mode offline · pembayaran tunai"}</b><p className="text-xs text-[#52674b]">{pending.length ? `${pending.length} transaksi tersimpan di perangkat, menunggu sinkronisasi` : "Semua transaksi lokal sudah tersinkron"}</p></div>
      <button className="btn-outline text-xs" disabled={busy || !online} onClick={() => { window.dispatchEvent(new Event("geraina-sync-requested")); onRefresh(); }} data-testid="offline-sync">{busy ? "Menyinkronkan…" : "Sinkronkan"}</button>
    </div>
    {!snapshot && <p role="alert" className="text-[#8a3b17] mt-2">Buka kasir saat terhubung untuk menyimpan katalog sebelum dipakai offline.</p>}
    {failure && <p role="alert" className="text-[#8a3b17] mt-2">{failure}</p>}
    {snapshot && !online && <p className="text-xs mt-2">Katalog terakhir: {new Date(snapshot).toLocaleString("id-ID")}. Stok perangkat lain diperbarui setelah tersambung.</p>}
    {pending.some(row => row.error) && <p role="alert" className="text-[#8a3b17] mt-2">{pending.find(row => row.error).error}</p>}
    {rows.length > 0 && <details className="mt-2"><summary className="cursor-pointer">Transaksi perangkat ini ({rows.length})</summary><div className="max-h-52 overflow-y-auto">{rows.slice(0, 50).map(row => <button key={row.key} className="block w-full text-left border-t border-[#dbe3d5] py-3" onClick={() => onReceipt(row.order)} data-testid={`local-sale-${row.body.client_order_id}`}><b>{row.order.order_no}</b><span className="block text-xs">{row.status === "synced" ? row.order.inventory_warnings?.length ? "Tersinkron · periksa stok" : "Tersinkron" : row.status === "attention" ? "Perlu perhatian · tetap tersimpan" : "Menunggu sinkronisasi"} · {new Date(row.createdAt).toLocaleString("id-ID")}</span></button>)}</div></details>}
  </section>;
}
