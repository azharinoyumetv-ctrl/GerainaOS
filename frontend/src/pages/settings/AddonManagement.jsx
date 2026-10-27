import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { fmtIDR } from "@/api/client";
import { toast } from "@/components/ui/sonner";
import { addonCheckoutUrl } from "@/auth/checkoutReturn";

export default function AddonManagement({ data, catalogue = [], canManage = false, signedIn = true }) {
  const [busy, setBusy] = useState(null), pending = useRef(false);
  useEffect(() => {
    const reset = event => { if (event.persisted) { pending.current = false; setBusy(null); } };
    addEventListener("pageshow", reset); return () => removeEventListener("pageshow", reset);
  }, []);
  const buy = (id, renewalId) => {
    if (pending.current) return;
    const next = addonCheckoutUrl(id, renewalId);
    if (!next) return;
    try {
      pending.current = true; setBusy(renewalId || id);
      sessionStorage.setItem("dagangos_checkout_geraina", JSON.stringify({ kind: "addon", addonId: id, period: "monthly", ...(renewalId ? { renewalId } : {}), expires: Date.now() + 1800000 }));
      requestAnimationFrame(() => requestAnimationFrame(() => location.assign(signedIn ? next : `/geraina/login?next=${encodeURIComponent(next)}`)));
    } catch { pending.current = false; setBusy(null); toast.error("Checkout add-on belum dapat dibuka. Coba lagi."); }
  };
  if (!data && !catalogue.length) return null;
  const offers = data?.offers || catalogue.map(a => ({ ...a, plan: a.id === "extra_device" ? "pro" : "business", eligible: false }));
  const label = key => busy === key ? <><Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Membuka checkout…</> : "Beli add-on";
  return <section className="space-y-4" data-testid="addon-management">
    <div><h3 className="font-display text-lg font-bold">Add-on kapasitas</h3><p className="text-sm text-[hsl(var(--muted))] mt-1">Satu bulan per pembelian, tanpa perpanjangan otomatis. Paket utama yang sesuai harus tetap aktif.</p></div>
    <div className="grid sm:grid-cols-2 gap-3">
      {offers.map(a => <div key={a.id} className="rounded-xl border p-4 space-y-3" data-testid={`addon-offer-${a.id}`}>
        <h4 className="font-semibold">{a.name}</h4><p className="text-sm font-semibold">{fmtIDR(a.price_idr)} / bulan</p>
        <p className="text-xs text-[hsl(var(--muted))]">{a.id === "extra_device" ? "Khusus Pro, maksimum 2 device tambahan." : "Khusus Business, termasuk 5 device dan 15 akun karyawan."}</p>
        <p className="text-xs">{signedIn && !canManage ? "Informasi pembelian memerlukan akun Owner dan koneksi aktif." : a.reason || ""}</p>
        <button type="button" disabled={busy !== null || signedIn && (!canManage || !a.eligible)} aria-busy={busy === a.id} onClick={() => buy(a.id)} className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-50" data-testid={`addon-buy-${a.id}`}>{signedIn ? label(a.id) : "Masuk untuk membeli"}</button>
        {a.pending_receipt && <a className="btn-outline inline-flex text-xs" href={`/geraina/order?receipt=${encodeURIComponent(a.pending_receipt)}`} data-testid={`addon-pending-${a.id}`}>Periksa atau lanjutkan pembayaran</a>}
      </div>)}
    </div>
    {(data?.purchases || []).map(a => <div key={a.id} className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3" data-testid="addon-purchase">
      <div><p className="text-sm font-semibold">{a.name} · {a.active ? "Aktif" : "Tidak aktif"}</p><p className="text-xs mt-1">{a.expires_at ? `Berlaku hingga ${new Date(a.expires_at).toLocaleDateString("id-ID")}` : "Aktivasi manual sebelumnya"}</p></div>
      {a.can_renew && canManage && <button type="button" disabled={busy !== null} onClick={() => buy(a.addonId, a.id)} className="btn-outline text-xs inline-flex items-center gap-2" data-testid="addon-renew">{busy === a.id ? label(a.id) : "Perpanjang 1 bulan"}</button>}
    </div>)}
  </section>;
}
