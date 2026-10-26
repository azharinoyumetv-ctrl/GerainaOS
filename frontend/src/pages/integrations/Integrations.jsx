import SectionNavigation from "@/navigation/SectionNavigation";
import PasswordInput from "@/components/PasswordInput";
import { useEffect, useRef, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import api from "@/api/client";
import { Save, Link2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";


export default function Integrations() {
  const params = useParams();
  const pathPart = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";
  const rawType = params.type || pathPart || "xendit";
  const type = (rawType === "integrations" || !rawType) ? "xendit" : rawType.toLowerCase();

  // Empty by default — each store brings its own (BYO) payment/notification credentials.
  const [integrations, setIntegrations] = useState({
    xendit: { is_active: false, secret_key: "", webhook_token: "" },
    midtrans: { is_active: false, client_key: "", server_key: "", environment: "sandbox" },
    qris: { is_active: false, nmid: "", merchant_name: "" },
    whatsapp: { is_active: false, phone_number_id: "", access_token: "", app_secret: "", webhook_verify_token: "", template_receipt: "dagangos_order_receipt", template_receipt_lang: "id", template_po: "dagangos_po_notify", template_po_lang: "id" },
    doku: { is_active: false, client_id: "", shared_key: "", environment: "sandbox", preferred_channel: "all" }
  });
  // Same unsequenced-GET race already fixed in Attendance.jsx/Products.jsx/SupplierList.jsx/
  // PaymentConfig.jsx: this effect re-fires on every subtab switch, so a slow GET from an
  // earlier tab could in principle resolve after a newer one. Guarded the same way.
  const reqIdRef = useRef(0);
  const defaultsRef = useRef(integrations);
  const saveRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadIntegrations = () => {
    const reqId = ++reqIdRef.current;
    setLoading(true); setLoadError("");
    api.get("/integrations").then((r) => {
      if (reqId !== reqIdRef.current) return;
      const data = r.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid integration settings");
      setIntegrations(Object.fromEntries(Object.entries(defaultsRef.current).map(([key, defaults]) => [key,
        { ...defaults, ...(data[key] && typeof data[key] === "object" && !Array.isArray(data[key]) ? data[key] : {}) }
      ])));
    }).catch(error => {
      if (reqId === reqIdRef.current) setLoadError(typeof error?.response?.data?.detail === "string" ? error.response.data.detail : "Konfigurasi belum dapat dimuat. Periksa koneksi dan coba lagi.");
    }).finally(() => { if (reqId === reqIdRef.current) setLoading(false); });
  };
  useEffect(() => {
    loadIntegrations();
    return () => { reqIdRef.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (loading || loadError || saveRef.current || !["xendit", "midtrans", "doku", "whatsapp"].includes(type)) return;
    saveRef.current = true; setSaving(true);
    try {
      // The API merges provider keys. Never resubmit unrelated providers or retired credentials.
      await api.post("/integrations", { [type]: integrations[type] });
      toast.success(`Konfigurasi ${type.toUpperCase()} tersimpan. Lakukan uji transaksi/pesan untuk memastikan layanan bekerja.`);
    } catch (error) {
      toast.error(typeof error?.response?.data?.detail === "string" ? error.response.data.detail : `Gagal menyimpan konfigurasi ${type.toUpperCase()}.`);
    } finally { saveRef.current = false; setSaving(false); }
  };

  const [waTestNum, setWaTestNum] = useState("");
  const [waTesting, setWaTesting] = useState(false);
  const [waTestResult, setWaTestResult] = useState(null);

  const sendWaTest = async () => {
    setWaTesting(true);
    setWaTestResult(null);
    try {
      const r = await api.post("/integrations/whatsapp/test", {
        target: waTestNum,
        phone_number_id: integrations.whatsapp?.phone_number_id,
        access_token: integrations.whatsapp?.access_token,
      });
      const d = r.data || {};
      setWaTestResult(d.sent
        ? { ok: true, msg: `Berhasil! Pesan tes terkirim ke ${waTestNum}.` }
        : { ok: false, msg: `Gagal: ${d.reason || "cek token/nomor"}` });
    } catch (e2) {
      setWaTestResult({ ok: false, msg: e2?.response?.data?.detail || "Gagal mengirim tes" });
    } finally {
      setWaTesting(false);
    }
  };

  const [waInbound, setWaInbound] = useState([]);
  const [waInboundLoading, setWaInboundLoading] = useState(false);
  const loadWaInbound = () => {
    setWaInboundLoading(true);
    api.get("/webhooks/whatsapp/inbound").then((r) => setWaInbound(r.data || [])).catch(() => {}).finally(() => setWaInboundLoading(false));
  };
  useEffect(() => {
    if (type === "whatsapp") loadWaInbound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  if (["stripe", "telegram", "email", "qris"].includes(type)) return <Navigate to="/geraina/app/integrations/qris" replace />;
  if (!integrations) return <div className="p-4 sm:p-6 lg:p-8 text-center text-xs text-[hsl(var(--muted))]">Memuat data integrasi...</div>;

  const renderForm = () => {
    switch (type) {
      case "xendit":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Aktifkan Xendit Gateway</label>
              <input
                type="checkbox"
                checked={integrations.xendit.is_active}
                onChange={(e) => setIntegrations({ ...integrations, xendit: { ...integrations.xendit, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Xendit Secret API Key</label>
              <PasswordInput

                value={integrations.xendit.secret_key}
                placeholder="xnd_production_..."
                onChange={(e) => setIntegrations({ ...integrations, xendit: { ...integrations.xendit, secret_key: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Webhook Callback Token Verification</label>
              <input
                type="text"
                value={integrations.xendit.webhook_token}
                onChange={(e) => setIntegrations({ ...integrations, xendit: { ...integrations.xendit, webhook_token: e.target.value } })}
                placeholder="Token verifikasi dari pengaturan webhook Xendit"
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
              />
              <p className="text-[11px] text-[hsl(var(--muted))]">
                Salin Verification Token dari pengaturan webhook Xendit. Daftarkan notifikasi Payment Request dan Payment Session ke callback URL <code className="font-mono break-all">https://geraina-os.vercel.app/api/webhooks/xendit</code> di dashboard akun Xendit toko Anda. Token harus sama dan tidak dipakai toko lain.
              </p>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))]">Gunakan API key Xendit milik toko Anda sendiri. Transaksi pelanggan diproses pada akun Xendit Anda; biaya penyedia menjadi tanggung jawab toko sesuai perjanjian Xendit. Akun ini terpisah dari akun pembayaran langganan DagangOS.</p>


          </div>
        );

      case "doku":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Aktifkan DOKU Gateway</label>
              <input
                type="checkbox"
                checked={integrations.doku.is_active}
                onChange={(e) => setIntegrations({ ...integrations, doku: { ...integrations.doku, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))]">
              Gunakan Client ID dan Shared Key DOKU milik toko Anda sendiri. Pilih metode yang ditampilkan di Kasir melalui menu Pembayaran. Kanal juga perlu aktif pada akun merchant DOKU.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Client ID</label>
                <input
                  type="text"
                  value={integrations.doku.client_id}
                  placeholder="BRN-0218-..."
                  onChange={(e) => setIntegrations({ ...integrations, doku: { ...integrations.doku, client_id: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Shared Key (Secret Key)</label>
                <PasswordInput

                  value={integrations.doku.shared_key}
                  placeholder="SK-..."
                  onChange={(e) => setIntegrations({ ...integrations, doku: { ...integrations.doku, shared_key: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Environment</label>
                <select
                  value={integrations.doku.environment}
                  onChange={(e) => setIntegrations({ ...integrations, doku: { ...integrations.doku, environment: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
                >
                  <option value="sandbox">Sandbox (Uji Coba)</option>
                  <option value="production">Production (Transaksi Nyata)</option>
                </select>
              </div>
              <div className="flex flex-col justify-center gap-2 text-sm"><p>Atur pilihan kasir dan kanal melalui menu Pembayaran.</p><Link className="btn-outline" to="/geraina/app/payments/va">Atur metode kasir</Link></div>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))]">
              Daftarkan webhook notifikasi <code className="font-mono">https://geraina-os.vercel.app/api/webhooks/doku</code> di DOKU Dashboard &gt; Developer &gt; Notification URL agar status pembayaran ter-update otomatis.
            </p>


          </div>
        );

      case "midtrans":
        return <div className="space-y-4" data-testid="midtrans-settings">
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">Aktifkan Midtrans Gateway<input type="checkbox" checked={integrations.midtrans.is_active} onChange={e => setIntegrations({ ...integrations, midtrans: { ...integrations.midtrans, is_active: e.target.checked } })} /></label>
          <p className="text-sm">Gunakan akun Midtrans milik toko. Pilih Virtual Account, E-Wallet atau Kartu Kredit yang ditampilkan di Kasir melalui menu Pembayaran.</p>
          <label className="block text-sm font-semibold">Server Key<PasswordInput data-testid="midtrans-server-key" value={integrations.midtrans.server_key} onChange={e => setIntegrations({ ...integrations, midtrans: { ...integrations.midtrans, server_key: e.target.value } })} className="input-field mt-2" /></label>
          <label className="block text-sm font-semibold">Lingkungan<select className="input-field mt-2" value={integrations.midtrans.environment || 'sandbox'} onChange={e => setIntegrations({ ...integrations, midtrans: { ...integrations.midtrans, environment: e.target.value } })}><option value="sandbox">Sandbox (Uji Coba)</option><option value="production">Production (Transaksi Nyata)</option></select></label>
          <p className="text-xs break-words">Daftarkan Payment Notification URL <code>https://geraina-os.vercel.app/api/webhooks/midtrans</code> di akun merchant Midtrans toko Anda.</p>
        </div>;

      case "whatsapp":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Kirim Struk Otomatis via WhatsApp</label>
              <input
                type="checkbox"
                checked={integrations.whatsapp.is_active}
                onChange={(e) => setIntegrations({ ...integrations, whatsapp: { ...integrations.whatsapp, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))]">
              Resmi via Meta Cloud API — bukan gateway pihak ketiga. Ambil nilai di bawah dari Meta Business Manager &gt; WhatsApp Manager &gt; API Setup, untuk WhatsApp Business Account (WABA) milik toko Anda sendiri.
            </p>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Phone Number ID</label>
              <input
                type="text"
                value={integrations.whatsapp.phone_number_id}
                onChange={(e) => setIntegrations({ ...integrations, whatsapp: { ...integrations.whatsapp, phone_number_id: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Access Token (system user, permanen)</label>
              <PasswordInput

                value={integrations.whatsapp.access_token}
                onChange={(e) => setIntegrations({ ...integrations, whatsapp: { ...integrations.whatsapp, access_token: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Webhook Verify Token</label>
              <input
                type="text"
                value={integrations.whatsapp.webhook_verify_token}
                onChange={(e) => setIntegrations({ ...integrations, whatsapp: { ...integrations.whatsapp, webhook_verify_token: e.target.value } })}
                placeholder="String bebas pilihan Anda sendiri — harus unik, tak boleh sama dengan toko lain"
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
              />
              <p className="text-[11px] text-[hsl(var(--muted))]">
                Daftarkan callback URL <code className="font-mono">https://geraina-os.vercel.app/api/webhooks/whatsapp</code> di App Meta Anda dengan verify token yang sama persis dengan yang diisi di sini.
              </p>
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">App Secret</label>
              <PasswordInput

                value={integrations.whatsapp.app_secret}
                onChange={(e) => setIntegrations({ ...integrations, whatsapp: { ...integrations.whatsapp, app_secret: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
              />
              <p className="text-[11px] text-[hsl(var(--muted))]">
                Dari Meta App Dashboard &gt; Settings &gt; Basic. Dipakai untuk memverifikasi tanda tangan (signature) pesan masuk dari Meta — wajib diisi agar WhatsApp masuk (balasan pelanggan) bisa diterima dengan aman.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Template Struk</label>
                <input
                  type="text"
                  value={integrations.whatsapp.template_receipt}
                  onChange={(e) => setIntegrations({ ...integrations, whatsapp: { ...integrations.whatsapp, template_receipt: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Template PO</label>
                <input
                  type="text"
                  value={integrations.whatsapp.template_po}
                  onChange={(e) => setIntegrations({ ...integrations, whatsapp: { ...integrations.whatsapp, template_po: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))]">
              Template struk (dagangos_order_receipt) dan template PO (dagangos_po_notify) keduanya kustom, Bahasa Indonesia, tanpa tombol — masih menunggu diajukan &amp; disetujui di Meta Business Manager. Tombol tes di bawah memakai template bawaan Meta (hello_world) jadi tetap bisa dipakai kapan saja, walau template struk/PO belum disetujui.
            </p>

            {/* Tes kirim WhatsApp langsung (tanpa harus buat order) */}
            <div className="border-t border-[hsl(var(--border))] pt-3">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Tes Kirim WhatsApp</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={waTestNum}
                  onChange={(e) => setWaTestNum(e.target.value)}
                  placeholder="08xxxxxxxxxx (nomor tujuan tes)"
                  className="flex-1 border border-[hsl(var(--border))] rounded-md px-3 py-2 bg-white text-sm"
                  data-testid="wa-test-number"
                />
                <button
                  type="button"
                  disabled={waTesting}
                  onClick={sendWaTest}
                  className="btn-outline px-4 py-2 text-xs font-bold disabled:opacity-60 whitespace-nowrap"
                  data-testid="wa-test-btn"
                >
                  {waTesting ? "Mengirim…" : "Kirim Tes"}
                </button>
              </div>
              {waTestResult && (
                <p className={`text-xs mt-2 font-semibold ${waTestResult.ok ? "text-emerald-600" : "text-red-600"}`} data-testid="wa-test-result">
                  {waTestResult.msg}
                </p>
              )}
              <p className="text-[11px] text-[hsl(var(--muted))] mt-1">Isi Phone Number ID + Access Token di atas, lalu kirim tes ke nomor Anda sendiri untuk memastikan koneksi.</p>
            </div>

            <div className="border-t border-[hsl(var(--border))] pt-3">
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Pesan Masuk Terakhir</label>
                  <button type="button" onClick={loadWaInbound} className="text-[10px] font-semibold text-[hsl(var(--primary))] hover:underline" data-testid="wa-inbound-refresh">
                    {waInboundLoading ? "Memuat…" : "Muat Ulang"}
                  </button>
                </div>
                {waInbound.length === 0 ? (
                  <p className="text-[11px] text-[hsl(var(--muted))] mt-1" data-testid="wa-inbound-empty">Belum ada pesan masuk.</p>
                ) : (
                  <ul className="mt-1 space-y-1" data-testid="wa-inbound-list">
                    {waInbound.map((m, i) => (
                      <li key={i} className="text-[11px] border border-[hsl(var(--border))] rounded-md px-2 py-1.5 bg-[hsl(var(--background))]">
                        <span className="font-mono text-[hsl(var(--muted))]">{m.received_at ? new Date(m.received_at).toLocaleString("id-ID") : "-"}</span>
                        {m._simulated && <span className="ml-2 pill pill-warning text-[9px]">Simulasi</span>}
                        <div className="mt-0.5">{m.payload?.messages?.[0]?.text?.body || JSON.stringify(m.payload)?.slice(0, 120)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return <p className="text-sm text-[hsl(var(--muted))]">Kanal integrasi tidak ditemukan.</p>;
    }
  };


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 text-left" data-testid="integrations-page">
      <div className="flex items-center justify-between">
        <div>
          <span className="label-tiny">Integrasi</span>
          <h1 className="font-display text-3xl font-bold mt-1 capitalize">Kanal Integrasi ({type})</h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/8 px-3 py-1 rounded border border-[hsl(var(--primary))]/20">
          <Link2 size={14} /> Pengaturan layanan
        </div>
      </div>

      <SectionNavigation section="integrations" active={type} />

      <div className="max-w-3xl card-surface p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <h2 className="font-display font-bold text-lg border-b border-[hsl(var(--border))] pb-3 capitalize">
            Integrasi Layanan {type}
          </h2>

          {loading ? <p role="status">Memuat konfigurasi…</p> : loadError ? (
            <div role="alert" className="space-y-3" data-testid="integrations-load-error">
              <p>{loadError}</p><button type="button" className="btn-outline" onClick={loadIntegrations}>Coba lagi</button>
            </div>
          ) : <fieldset disabled={saving} className="space-y-4">{renderForm()}</fieldset>}

          {type !== "qris" && <div className="border-t border-[hsl(var(--border))] pt-4 flex justify-end">
            <button type="submit" disabled={loading || !!loadError || saving} className="btn-primary py-2 px-6 flex items-center gap-2 text-sm font-semibold disabled:opacity-50">
              <Save size={16} /> {saving ? "Menyimpan…" : "Simpan Integrasi"}
            </button>
          </div>}
        </form>
      </div>
    </div>
  );
}
