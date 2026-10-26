import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api/client";
import { Save } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import SectionNavigation from "@/navigation/SectionNavigation";
import ReadState from "@/components/ReadState";
import BankQrisSettings from "./BankQrisSettings";

const CHANNELS = ["OVO", "DANA", "ShopeePay", "LinkAja"];
const defaults = { cash: { is_active: true }, ewallet: { is_active: false, provider: "Xendit", channels: Object.fromEntries(CHANNELS.map(name => [name, true])) } };
export default function PaymentConfig() {
  const params = useParams();
  const raw = params.type || window.location.pathname.split("/").pop() || "cash";
  const type = raw === "payments" ? "cash" : raw.replaceAll("-", "_").toLowerCase();
  const supported = ["cash", "ewallet"].includes(type);
  const [config, setConfig] = useState(defaults), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [saving, setSaving] = useState(false), [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    setLoading(supported); setError("");
    if (supported) api.get("/payments/config", { signal: controller.signal, timeout: 12000 }).then(({ data }) => {
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid settings");
      if (active) setConfig({ cash: { ...defaults.cash, ...data.cash }, ewallet: { ...defaults.ewallet, ...data.ewallet, channels: { ...defaults.ewallet.channels, ...data.ewallet?.channels } } });
    }).catch(() => { if (active) setError("Pengaturan pembayaran belum dapat dimuat. Coba lagi sebelum menyimpan."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [type, supported, attempt]);
  const save = async event => {
    event.preventDefault();
    if (!supported || loading || error || lock.current) return;
    lock.current = true; setSaving(true);
    try {
      const value = type === "ewallet" ? { ...config.ewallet, channels: Object.fromEntries(CHANNELS.map(name => [name, config.ewallet.channels[name] === true])) } : config.cash;
      await api.post("/payments/config", { [type]: value });
      toast.success("Pengaturan pembayaran disimpan. Pilihan kasir mengikuti metode dan kanal yang diaktifkan.");
    } catch (e) { toast.error(typeof e?.response?.data?.detail === "string" ? e.response.data.detail : "Pengaturan gagal disimpan. Coba lagi."); }
    finally { lock.current = false; setSaving(false); }
  };
  if (type === "qris") return <BankQrisSettings />;
  const unavailable = { va: "Virtual Account", credit_card: "Kartu Kredit Online", bank_transfer: "Transfer Bank Manual", edc: "EDC" }[type];
  return <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="payment-config-page">
    <div><span className="label-tiny">Pembayaran</span><h1 className="font-display text-3xl font-bold mt-1">{type === "cash" ? "Tunai" : type === "ewallet" ? "E-Wallet Xendit" : unavailable || "Metode pembayaran"}</h1></div>
    <SectionNavigation section="payments" active={type} />
    {!supported ? <div className="card-surface p-6 space-y-4" data-testid="payment-method-unavailable">
      <h2 className="font-display text-lg font-bold">{unavailable} — checkout terpisah belum tersedia</h2>
      <p className="text-sm">Metode ini tidak dapat diaktifkan pada kasir. Virtual Account, E-Wallet dan minimarket yang didukung tersedia melalui checkout DOKU milik toko. Kartu/EDC belum didukung.</p>
      <div className="flex gap-3 flex-wrap"><Link to="/geraina/app/integrations/doku" className="btn-outline">Pengaturan DOKU</Link><Link to="/geraina/app/payments/qris" className="btn-outline">Gunakan QRIS bank</Link></div>
    </div> : <div className="card-surface p-6 max-w-3xl">
      <ReadState loading={loading} error={error} retry={() => setAttempt(value => value + 1)} testid="payment-config-error" />
      <form onSubmit={save} className="space-y-5">
        {!loading && !error && <fieldset disabled={saving} className="space-y-4">
          <label className="flex items-center gap-3"><input type="checkbox" data-testid="payment-active" checked={config[type].is_active === true} onChange={e => setConfig({ ...config, [type]: { ...config[type], is_active: e.target.checked } })} />{type === "cash" ? "Aktifkan Tunai" : "Aktifkan E-Wallet Xendit"}</label>
          {type === "cash" ? <p className="text-sm">Tombol Tunai pada kasir mengikuti pengaturan ini setelah perangkat memuat ulang metode pembayaran. Saat offline, perangkat memakai pengaturan terakhir yang tersimpan. Transaksi offline yang sudah dicatat tetap disinkronkan. Pengaturan printer dan laci kasir mengikuti perangkat yang dipilih.</p> : <>
            <p className="text-sm">Pembayaran menggunakan akun Xendit milik toko, dengan kanal di bawah. Kanal yang dinonaktifkan tidak ditawarkan pada kasir dan ditolak server.</p>
            {config.ewallet.provider !== "Xendit" && <div role="alert" className="space-y-2"><p>Penyedia tersimpan {config.ewallet.provider} tidak didukung untuk E-Wallet kasir.</p><button type="button" className="btn-outline" onClick={() => setConfig({ ...config, ewallet: { ...config.ewallet, provider: "Xendit" } })}>Gunakan Xendit</button></div>}
            <div className="grid grid-cols-2 gap-3">{CHANNELS.map(name => <label key={name} className="flex items-center gap-3 border rounded-lg p-3"><input type="checkbox" checked={config.ewallet.channels[name] === true} onChange={e => setConfig({ ...config, ewallet: { ...config.ewallet, channels: { ...config.ewallet.channels, [name]: e.target.checked } } })} />{name}</label>)}</div>
            <Link to="/geraina/app/integrations/xendit" className="btn-outline inline-flex">Kredensial Xendit toko</Link>
          </>}
        </fieldset>}
        <button type="submit" disabled={loading || !!error || saving || (type === "ewallet" && config.ewallet.provider !== "Xendit")} className="btn-primary disabled:opacity-50" data-testid="payment-config-save-btn"><Save size={16} />{saving ? "Menyimpan…" : "Simpan Pengaturan"}</button>
      </form>
    </div>}
  </div>;
}
