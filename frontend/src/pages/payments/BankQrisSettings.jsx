import SectionNavigation from "@/navigation/SectionNavigation";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/auth/AuthContext";
import api from "@/api/client";
import { toast } from "@/components/ui/sonner";
import { bankQrisError, readBankQrisImage } from "@/payments/bankQris";

const empty = { bank_name: "", qr_payload: "", is_active: false, merchant_name: "", merchant_city: "" };

export default function BankQrisSettings() {
  const { user } = useAuth();
  const canEdit = ["Owner", "admin"].includes(user?.role);
  const [config, setConfig] = useState(null), [error, setError] = useState("");
  const [saving, setSaving] = useState(false), [reading, setReading] = useState(false), [confirmed, setConfirmed] = useState(false);
  const sequence = useRef(0), mounted = useRef(true), saveLock = useRef(false);
  const load = async () => {
    const seq = ++sequence.current;
    setError(""); setConfig(null); setConfirmed(false); setSaving(false); setReading(false); saveLock.current = false;
    try { const { data } = await api.get("/payments/bank-qris"); if (mounted.current && seq === sequence.current) setConfig({ ...empty, ...data }); }
    catch (e) { if (mounted.current && seq === sequence.current) setError(bankQrisError(e, "Pengaturan QRIS bank belum dapat dimuat. Coba lagi.")); }
  };
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; sequence.current++; }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.store_id]);
  const upload = async event => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    const seq = ++sequence.current;
    setReading(true); setConfirmed(false);
    try {
      const payload = await readBankQrisImage(file);
      if (mounted.current && seq === sequence.current) setConfig(previous => ({ ...previous, qr_payload: payload, merchant_name: "", merchant_city: "" }));
    } catch (e) { if (mounted.current && seq === sequence.current) toast.error(e.message); }
    finally { if (mounted.current && seq === sequence.current) setReading(false); }
  };
  const save = async event => {
    event.preventDefault();
    if (saveLock.current || reading) return;
    const seq = ++sequence.current;
    saveLock.current = true; setSaving(true);
    try {
      const { data } = await api.post("/payments/bank-qris", { bank_name: config.bank_name, qr_payload: config.qr_payload, is_active: config.is_active, merchant_confirmed: confirmed });
      if (mounted.current && seq === sequence.current) { setConfig({ ...empty, ...data }); setConfirmed(false); toast.success("QRIS bank disimpan. Konfirmasi pembayaran dilakukan oleh staf."); }
    } catch (e) { if (mounted.current && seq === sequence.current) toast.error(bankQrisError(e, "QRIS bank gagal disimpan. Periksa koneksi dan gambar QRIS.")); }
    finally { if (mounted.current && seq === sequence.current) { setSaving(false); saveLock.current = false; } }
  };
  return <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-4xl" data-testid="bank-qris-settings">
    <div><span className="label-tiny">Pembayaran</span><h1 className="font-display text-3xl font-bold mt-1">QRIS bank</h1></div>
    <SectionNavigation section="payments" active="qris" />
    <p className="text-sm">Gunakan QRIS statis yang diterbitkan bank untuk toko Anda. Pelanggan memasukkan nominal sesuai total belanja. Staf memeriksa penerimaan di aplikasi bank merchant sebelum menandai Lunas.</p>
    <p className="rounded-xl border border-[hsl(var(--border))] p-4 text-sm" data-testid="bank-qris-manual-notice">Tidak memerlukan API key Xendit. Dana diterima melalui QRIS merchant Anda; biaya mengikuti ketentuan bank. Geraina tidak memeriksa rekening atau mengonfirmasi pembayaran secara otomatis.</p>
    {error && <div role="alert" className="card-surface p-4 space-y-3"><p>{error}</p><button className="btn-outline" onClick={load}>Coba lagi</button></div>}
    {!config && !error && <p role="status">Memuat QRIS bank…</p>}
    {config && <form onSubmit={save} className="card-surface p-5 space-y-5" data-testid="bank-qris-form">
      <fieldset disabled={!canEdit || saving || reading} className="space-y-4 min-w-0">
        <label className="block text-sm font-medium">Nama bank penerbit<input value={config.bank_name} maxLength={100} onChange={e => { setConfirmed(false); setConfig({ ...config, bank_name: e.target.value }); }} className="input-field mt-2" placeholder="Contoh: BRI, BCA, Mandiri" data-testid="bank-qris-bank-name" /></label>
        <label className="block text-sm font-medium">Gambar QRIS dari bank<input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="block w-full mt-2 text-sm" data-testid="bank-qris-upload" /></label>
        <p className="text-xs text-[hsl(var(--muted))]">PNG, JPG, atau WebP, maksimal 5 MB. Gunakan QRIS statis tanpa nominal tetap. Gambar dibaca di perangkat; kode pembayaran disimpan tanpa diubah.</p>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={config.is_active} onChange={e => setConfig({ ...config, is_active: e.target.checked })} data-testid="bank-qris-active" />Aktifkan QRIS bank di kasir</label>
      </fieldset>
      {reading && <p role="status">Membaca QRIS…</p>}
      {config.qr_payload && <div className="space-y-2" data-testid="bank-qris-preview"><div className="inline-block bg-white p-4 border rounded-xl"><QRCodeSVG value={config.qr_payload} size={220} level="M" marginSize={4} style={{ maxWidth: "100%", height: "auto" }} /></div><p className="text-sm">{config.merchant_name ? `${config.merchant_name} · ${config.merchant_city}` : "Kode terbaca. Simpan untuk memeriksa format QRIS dan menampilkan identitas merchant."}</p></div>}
      {canEdit ? <>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} disabled={saving || reading} onChange={e => setConfirmed(e.target.checked)} className="mt-1" data-testid="bank-qris-ownership" /><span>Saya memastikan kode ini milik toko ini dan nama penerimanya benar. Pemeriksaan format kode tidak membuktikan kepemilikan rekening.</span></label>
        <button type="submit" className="btn-primary disabled:opacity-50" disabled={saving || reading || (config.is_active && (!confirmed || !config.qr_payload || !config.bank_name.trim()))} data-testid="bank-qris-save">{saving ? "Menyimpan…" : "Simpan QRIS bank"}</button>
      </> : <p className="text-sm">Hanya Owner yang dapat mengubah QRIS bank.</p>}
    </form>}
    <Link to="/geraina/app/pos" className="btn-outline inline-flex">Buka kasir</Link>
  </div>;
}
