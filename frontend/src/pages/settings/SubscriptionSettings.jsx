import { useEffect, useRef, useState } from "react";
import api from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import AddonManagement from "./AddonManagement";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

const names = { trial: "Trial", starter: "Starter", pro: "Pro", business: "Business", expired: "Berakhir" };
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";

export default function SubscriptionSettings() {
  const { refresh } = useAuth();
  const [data, setData] = useState(null), [error, setError] = useState("");
  const [retry, setRetry] = useState(0), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    setData(null); setError("");
    api.get("/subscriptions/current", { timeout: 12000 }).then(r => {
      if (r.data?.billing_model !== "prepaid" || r.data?.auto_renew !== false || typeof r.data.can_manage !== "boolean") throw new Error("Invalid billing response");
      if (active) setData(r.data);
    }).catch(() => { if (active) setError("Informasi paket belum dapat dimuat. Coba lagi sebelum mengubah langganan."); });
    return () => { active = false; };
  }, [retry]);

  const changeStop = async stopping => {
    if (saving.current || !data?.can_manage || !data.subscription?.active) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const r = await api.post(`/subscriptions/${stopping ? "cancel" : "resume"}`, { orderId: data.subscription.order_id, confirm: true }, { timeout: 12000 });
      setData(r.data); setConfirm(false); await refresh();
    } catch (e) {
      setError(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Perubahan belum dapat dipastikan. Muat ulang informasi paket sebelum mencoba lagi.");
    } finally { saving.current = false; setBusy(false); }
  };

  if (!data) return <div data-testid="subscription-billing-management-area">{error ? <div role="alert"><p>{error}</p><button type="button" className="btn-outline mt-3" onClick={() => setRetry(v => v + 1)}>Coba lagi</button></div> : <p role="status">Memuat informasi paket…</p>}</div>;
  const sub = data.subscription;
  const plan = sub?.tier || data.plan || "trial";
  const stopping = sub?.cancel_at_period_end === true;
  const expiry = date(sub?.expires_at || data.trial_ends_at);
  const active = sub ? sub.active : plan !== "expired";
  return <div className="space-y-5" data-testid="subscription-billing-management-area">
    <div className="rounded-xl border p-4 space-y-2">
      <p className="text-xs uppercase text-[hsl(var(--muted))]">Paket Anda</p>
      <h3 className="font-display text-2xl font-bold" data-testid="subscription-plan-title">Paket {names[plan] || plan}</h3>
      <p className="text-sm font-semibold" data-testid="subscription-status-badge">{!active ? "BERAKHIR" : stopping ? "BERHENTI DI AKHIR PERIODE" : plan === "trial" ? "TRIAL" : "AKTIF"}</p>
      {expiry && <p className="text-sm" data-testid="subscription-expiry">{active ? "Akses tersedia hingga" : "Berakhir pada"} {expiry}</p>}
    </div>
    <p className="text-sm leading-relaxed">Paket dibayar di muka untuk satu bulan atau satu tahun. Tidak ada perpanjangan atau pemotongan saldo otomatis.</p>
    {data.can_manage && <a href="/geraina/pricing" className="btn-primary inline-flex" data-testid="view-pricing-matrix-link">{sub?.active ? "Ubah atau upgrade paket" : "Pilih & beli paket"}</a>}
    {data.addons && <AddonManagement data={data.addons} canManage={data.can_manage} />}
    {stopping && <p role="status" className="text-sm" data-testid="subscription-stopped">Langganan akan berhenti pada {expiry}. Akses yang sudah dibayar tetap tersedia sampai tanggal tersebut. Data toko tetap tersimpan.</p>}
    {data.can_manage && sub?.active && sub.order_id && <div className="border-t pt-4">
      <button type="button" disabled={busy} className="btn-outline disabled:opacity-50" data-testid="subscription-stop-button" onClick={() => stopping ? changeStop(false) : setConfirm(true)}>{busy ? "Menyimpan…" : stopping ? "Batalkan penghentian" : "Hentikan langganan"}</button>
      <AlertDialog open={confirm} onOpenChange={value => { if (!busy) setConfirm(value); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hentikan setelah periode ini?</AlertDialogTitle><AlertDialogDescription>Akses tetap tersedia hingga {expiry}. Tidak ada tagihan otomatis. Tindakan ini tidak menghapus data toko atau mengembalikan pembayaran yang sudah dilakukan.</AlertDialogDescription></AlertDialogHeader>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <AlertDialogFooter><AlertDialogCancel disabled={busy}>Kembali</AlertDialogCancel><button type="button" className="btn-primary" disabled={busy} data-testid="subscription-stop-confirm" onClick={() => changeStop(true)}>{busy ? "Menyimpan…" : "Ya, hentikan di akhir periode"}</button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>}
    {error && !confirm && <div role="alert" className="text-sm text-red-700"><p>{error}</p><button type="button" disabled={busy} className="btn-outline mt-2" onClick={() => setRetry(v => v + 1)}>Muat ulang paket</button></div>}
  </div>;
}
