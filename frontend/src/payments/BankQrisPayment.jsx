import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/auth/AuthContext";
import api, { fmtIDR } from "@/api/client";
import { toast } from "@/components/ui/sonner";
import { bankQrisError } from "./bankQris";

export default function BankQrisPayment({ order, onConfirmed }) {
  const { user } = useAuth();
  const [checked, setChecked] = useState(false), [amount, setAmount] = useState(""), [reference, setReference] = useState(""), [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const allowed = ["Owner", "admin", "Manager"].includes(user?.role) || (user?.role === "Cashier" && order.cashier_id === user?.id);
  const confirm = async () => {
    if (inFlight.current || !checked || Number(amount) !== order.total) return;
    inFlight.current = true; setBusy(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/confirm-bank-qris`, { checked_in_bank: checked, received_amount: amount, reference });
      onConfirmed(data); toast.success("Pembayaran dicatat Lunas berdasarkan konfirmasi staf.");
    } catch (e) { toast.error(bankQrisError(e, "Konfirmasi belum tersimpan. Periksa koneksi lalu coba lagi; jangan membuat transaksi baru.")); }
    finally { inFlight.current = false; setBusy(false); }
  };
  if (order.payment_status === "paid") return <div className="text-sm rounded-xl border p-3 my-3" data-testid="bank-qris-confirmation">QRIS bank · Dikonfirmasi staf{order.payment_confirmation?.confirmed_at ? ` pada ${new Date(order.payment_confirmation.confirmed_at).toLocaleString("id-ID")}` : ""}. Penerimaan diperiksa secara manual di aplikasi bank merchant.</div>;
  if (order.payment_status !== "pending") return null;
  return <div className="space-y-3 my-4" data-testid="bank-qris-payment">
    <div className="text-center space-y-2">
      {order.bank_qris?.qr_payload && <div className="inline-block bg-white p-4 border rounded-xl"><QRCodeSVG value={order.bank_qris.qr_payload} size={220} level="M" marginSize={4} style={{ maxWidth: "100%", height: "auto" }} data-testid="bank-qris-code" /></div>}
      <p className="font-semibold">{order.bank_qris?.merchant_name} · {order.bank_qris?.bank_name}</p>
      <p className="text-sm">Pelanggan: pindai QRIS, lalu masukkan <strong>{fmtIDR(order.total)}</strong> dan periksa nama penerima sebelum membayar.</p>
    </div>
    <div className="border rounded-xl p-3 space-y-3 text-sm">
      <p>Kasir: periksa transaksi masuk pada aplikasi bank merchant. Cocokkan nominal, waktu, dan referensi dengan order ini. Jangan hanya mengandalkan tangkapan layar pelanggan.</p>
      {allowed ? <>
        <label className="flex items-start gap-2"><input type="checkbox" checked={checked} disabled={busy} onChange={e => setChecked(e.target.checked)} className="mt-1" data-testid="bank-qris-checked" /><span>Saya sudah memeriksa pembayaran masuk untuk order ini di aplikasi bank merchant.</span></label>
        <label className="block">Nominal diterima (Rp)<input type="number" min="1" max="10000000" step="1" inputMode="numeric" value={amount} disabled={busy} onChange={e => setAmount(e.target.value)} className="input-field mt-1" data-testid="bank-qris-received" /></label>
        <label className="block">Referensi bank (opsional)<input value={reference} maxLength={100} disabled={busy} onChange={e => setReference(e.target.value)} className="input-field mt-1" data-testid="bank-qris-reference" /></label>
        <button type="button" onClick={confirm} disabled={busy || !checked || Number(amount) !== order.total} className="btn-primary w-full disabled:opacity-50" data-testid="bank-qris-confirm">{busy ? "Menyimpan…" : "Konfirmasi pembayaran diterima"}</button>
      </> : <p>Minta Owner atau kasir yang membuat order ini untuk mengonfirmasi penerimaan.</p>}
      <p className="text-xs text-[hsl(var(--muted))]">Status tetap menunggu sampai staf mengonfirmasi. Geraina tidak memeriksa pembayaran secara otomatis.</p>
    </div>
  </div>;
}
