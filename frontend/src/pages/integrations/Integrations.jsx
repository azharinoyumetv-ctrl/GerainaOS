import PasswordInput from "@/components/PasswordInput";
import { useEffect, useRef, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import api from "@/api/client";
import { Save, Link2, FlaskConical } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/auth/AuthContext";

import { Link } from "react-router-dom";

export default function Integrations() {
  const params = useParams();
  const pathPart = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";
  const rawType = params.type || pathPart || "xendit";
  const type = (rawType === "integrations" || !rawType) ? "xendit" : rawType.toLowerCase();
  const { user } = useAuth();

  // Empty by default — each store brings its own (BYO) payment/notification credentials.
  const [integrations, setIntegrations] = useState({
    xendit: { is_active: false, secret_key: "", webhook_token: "" },
    midtrans: { is_active: false, client_key: "", server_key: "" },
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

  // ---------- Webhook simulator (dev/testing only) ----------
  // Server-gated behind ALLOW_WEBHOOK_SIMULATE -- disabled by default in production, so a
  // real merchant's store can't be poked with fake payment/message events. Lets a developer
  // (or an automated test) verify the webhook -> order/message pipeline end-to-end without
  // needing a real gateway callback, instead of there being no way to exercise it at all.
  const storeId = user?.store_id;
  const [xenditSim, setXenditSim] = useState({ reference_id: "", status: "SUCCEEDED" });
  const [xenditSimBusy, setXenditSimBusy] = useState(false);
  const [xenditSimResult, setXenditSimResult] = useState(null);
  const sendXenditSim = async () => {
    if (!xenditSim.reference_id.trim()) { toast.error("Isi Order No (reference_id) dulu."); return; }
    setXenditSimBusy(true);
    setXenditSimResult(null);
    try {
      await api.post(`/webhooks/xendit/simulate?store_id=${encodeURIComponent(storeId || "")}`, {
        reference_id: xenditSim.reference_id.trim(),
        status: xenditSim.status,
      });
      setXenditSimResult({ ok: true, msg: `Terkirim. Order ${xenditSim.reference_id} akan ter-update ke status ${xenditSim.status === "SUCCEEDED" ? "paid" : xenditSim.status.toLowerCase()}.` });
    } catch (e2) {
      setXenditSimResult({ ok: false, msg: e2?.response?.data?.detail || "Gagal mengirim simulasi." });
    } finally {
      setXenditSimBusy(false);
    }
  };

  const [dokuSim, setDokuSim] = useState({ invoice_number: "", status: "SUCCESS" });
  const [dokuSimBusy, setDokuSimBusy] = useState(false);
  const [dokuSimResult, setDokuSimResult] = useState(null);
  const sendDokuSim = async () => {
    if (!dokuSim.invoice_number.trim()) { toast.error("Isi Invoice Number dulu."); return; }
    setDokuSimBusy(true);
    setDokuSimResult(null);
    try {
      await api.post(`/webhooks/doku/simulate?store_id=${encodeURIComponent(storeId || "")}`, {
        invoice_number: dokuSim.invoice_number.trim(),
        status: dokuSim.status,
      });
      setDokuSimResult({ ok: true, msg: `Terkirim. Order ${dokuSim.invoice_number} akan ter-update ke status ${dokuSim.status === "SUCCESS" ? "paid" : dokuSim.status.toLowerCase()}.` });
    } catch (e2) {
      setDokuSimResult({ ok: false, msg: e2?.response?.data?.detail || "Gagal mengirim simulasi." });
    } finally {
      setDokuSimBusy(false);
    }
  };

  const [waSim, setWaSim] = useState({ from: "", text: "" });
  const [waSimBusy, setWaSimBusy] = useState(false);
  const [waSimResult, setWaSimResult] = useState(null);
  const [waInbound, setWaInbound] = useState([]);
  const [waInboundLoading, setWaInboundLoading] = useState(false);
  const loadWaInbound = () => {
    setWaInboundLoading(true);
    api.get("/webhooks/whatsapp/inbound").then((r) => setWaInbound(r.data || [])).catch(() => {}).finally(() => setWaInboundLoading(false));
  };
  const sendWaSim = async () => {
    if (!waSim.from.trim() || !waSim.text.trim()) { toast.error("Isi nomor pengirim dan isi pesan dulu."); return; }
    setWaSimBusy(true);
    setWaSimResult(null);
    try {
      await api.post(`/webhooks/whatsapp/simulate?store_id=${encodeURIComponent(storeId || "")}`, {
        entry: [{ changes: [{ value: {
          metadata: { phone_number_id: integrations.whatsapp?.phone_number_id || "simulated" },
          messages: [{ from: waSim.from.trim(), type: "text", text: { body: waSim.text.trim() } }],
        } }] }],
      });
      setWaSimResult({ ok: true, msg: "Pesan simulasi diterima." });
      loadWaInbound();
    } catch (e2) {
      setWaSimResult({ ok: false, msg: e2?.response?.data?.detail || "Gagal mengirim simulasi." });
    } finally {
      setWaSimBusy(false);
    }
  };
  useEffect(() => {
    if (type === "whatsapp") loadWaInbound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  if (["stripe", "telegram", "email"].includes(type)) return <Navigate to="/geraina/app/integrations/qris" replace />;
  if (!integrations) return <div className="p-4 sm:p-6 lg:p-8 text-center text-xs text-[hsl(var(--muted))]">Memuat data integrasi...</div>;

  const renderForm = () => {
    switch (type) {
      case "qris":
        return (
          <div className="space-y-4 text-sm" data-testid="qris-integration">
            <p>Terima pembayaran <strong>QRIS dinamis melalui Xendit</strong>. Nominal mengikuti total transaksi kasir; pelanggan memindai QR menggunakan aplikasi pembayaran yang mendukung QRIS.</p>
            <p className="rounded-xl bg-[hsl(var(--primary))]/5 p-4" data-testid="qris-byok">Gunakan akun dan API key Xendit milik toko Anda sendiri (BYOK). Pembayaran pelanggan diproses pada akun merchant Anda. Biaya transaksi penyedia menjadi tanggung jawab merchant sesuai perjanjian dengan Xendit. Akun pembayaran langganan DagangOS terpisah.</p>
            <div className="rounded-xl border border-[hsl(var(--border))] p-4 space-y-2">
              <p className="font-semibold" data-testid="qris-setup-status">
                {integrations.xendit.is_active && integrations.xendit.secret_key && integrations.xendit.webhook_token
                  ? "Konfigurasi Xendit tersimpan — transaksi belum diverifikasi"
                  : "Lengkapi konfigurasi Xendit untuk menggunakan QRIS"}
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-[hsl(var(--muted))]">
                <li>Daftarkan usaha dan aktifkan kanal QRIS pada akun merchant Xendit milik toko Anda.</li>
                <li>Isi Secret API Key dan token callback yang diberikan Xendit pada pengaturan Xendit. Gunakan mode test dahulu.</li>
                <li>Daftarkan URL callback <span className="break-all font-mono text-xs">https://api.dagangos.com/api/webhooks/xendit</span> di dashboard Xendit.</li>
                <li>Di kasir, pilih QRIS dan selesaikan pembayaran uji. Pastikan status berubah menjadi Lunas setelah konfirmasi dari penyedia.</li>
              </ol>
            </div>
            <p className="text-xs text-[hsl(var(--muted))]">QRIS memerlukan internet. Mengisi NMID atau menampilkan gambar QR saja tidak menghubungkan status pembayaran otomatis. Konfigurasi tersimpan belum membuktikan pembayaran berhasil.</p>
            <Link to="/geraina/app/integrations/xendit" className="btn-primary inline-flex" data-testid="qris-configure-xendit">Atur QRIS melalui Xendit</Link>
          </div>
        );
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
                Salin Verification Token dari pengaturan webhook Xendit, lalu daftarkan callback URL <code className="font-mono break-all">https://api.dagangos.com/api/webhooks/xendit</code> di dashboard akun Xendit toko Anda. Token harus sama dan tidak dipakai toko lain.
              </p>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))]">Gunakan API key Xendit milik toko Anda sendiri. Transaksi pelanggan diproses pada akun Xendit Anda; biaya penyedia menjadi tanggung jawab toko sesuai perjanjian Xendit. Akun ini terpisah dari akun pembayaran langganan DagangOS.</p>

            {/* Simulator webhook -- dev/testing only, lihat catatan di sendXenditSim */}
            <div className="border-t border-[hsl(var(--border))] pt-3">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase flex items-center gap-1.5">
                <FlaskConical size={13} /> Simulator Webhook (Khusus Testing/Development)
              </label>
              <p className="text-[11px] text-[hsl(var(--muted))] mt-1 mb-2">
                Kirim callback Xendit palsu ke order yang sudah ada, untuk memverifikasi alur webhook → status order tanpa transaksi nyata. Hanya aktif jika server diset <code className="font-mono">ALLOW_WEBHOOK_SIMULATE=true</code> — di produksi biasanya nonaktif.
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Order No</label>
                  <input type="text" value={xenditSim.reference_id} onChange={(e) => setXenditSim({ ...xenditSim, reference_id: e.target.value })}
                    placeholder="GR-20260720-0001" className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-xs font-mono w-44" data-testid="xendit-sim-ref" />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Status</label>
                  <select value={xenditSim.status} onChange={(e) => setXenditSim({ ...xenditSim, status: e.target.value })}
                    className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-xs" data-testid="xendit-sim-status">
                    <option value="SUCCEEDED">SUCCEEDED (paid)</option>
                    <option value="FAILED">FAILED</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>
                <button type="button" disabled={xenditSimBusy} onClick={sendXenditSim}
                  className="btn-outline px-4 py-1.5 text-xs font-bold disabled:opacity-60" data-testid="xendit-sim-send">
                  {xenditSimBusy ? "Mengirim…" : "Kirim Simulasi"}
                </button>
              </div>
              {xenditSimResult && (
                <p className={`text-xs mt-2 font-semibold ${xenditSimResult.ok ? "text-emerald-600" : "text-red-600"}`} data-testid="xendit-sim-result">{xenditSimResult.msg}</p>
              )}
            </div>
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
              Gunakan Client ID dan Shared Key DOKU (Checkout/Jokul API) milik toko Anda sendiri dari DOKU Dashboard &gt; Developer &gt; API Keys. Mendukung Virtual Account, E-Money (OVO/DANA/ShopeePay), dan minimarket.
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
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Metode Pembayaran</label>
                <select
                  value={integrations.doku.preferred_channel}
                  onChange={(e) => setIntegrations({ ...integrations, doku: { ...integrations.doku, preferred_channel: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
                >
                  <option value="all">Semua (VA + E-Wallet + Minimarket)</option>
                  <option value="va">Virtual Account saja</option>
                  <option value="ewallet">E-Wallet saja</option>
                  <option value="minimart">Minimarket saja</option>
                </select>
              </div>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))]">
              Daftarkan webhook notifikasi <code className="font-mono">https://api.dagangos.com/api/webhooks/doku</code> di DOKU Dashboard &gt; Developer &gt; Notification URL agar status pembayaran ter-update otomatis.
            </p>

            {/* Simulator webhook -- dev/testing only */}
            <div className="border-t border-[hsl(var(--border))] pt-3">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase flex items-center gap-1.5">
                <FlaskConical size={13} /> Simulator Webhook (Khusus Testing/Development)
              </label>
              <p className="text-[11px] text-[hsl(var(--muted))] mt-1 mb-2">
                Kirim notifikasi DOKU palsu ke order yang sudah ada. Hanya aktif jika server diset <code className="font-mono">ALLOW_WEBHOOK_SIMULATE=true</code>.
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Invoice Number</label>
                  <input type="text" value={dokuSim.invoice_number} onChange={(e) => setDokuSim({ ...dokuSim, invoice_number: e.target.value })}
                    placeholder="GR-20260720-0001" className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-xs font-mono w-44" data-testid="doku-sim-invoice" />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Status</label>
                  <select value={dokuSim.status} onChange={(e) => setDokuSim({ ...dokuSim, status: e.target.value })}
                    className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-xs" data-testid="doku-sim-status">
                    <option value="SUCCESS">SUCCESS (paid)</option>
                    <option value="FAILED">FAILED</option>
                    <option value="CANCEL">CANCEL (voided)</option>
                  </select>
                </div>
                <button type="button" disabled={dokuSimBusy} onClick={sendDokuSim}
                  className="btn-outline px-4 py-1.5 text-xs font-bold disabled:opacity-60" data-testid="doku-sim-send">
                  {dokuSimBusy ? "Mengirim…" : "Kirim Simulasi"}
                </button>
              </div>
              {dokuSimResult && (
                <p className={`text-xs mt-2 font-semibold ${dokuSimResult.ok ? "text-emerald-600" : "text-red-600"}`} data-testid="doku-sim-result">{dokuSimResult.msg}</p>
              )}
            </div>
          </div>
        );

      case "midtrans":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Aktifkan Midtrans Gateway</label>
              <input
                type="checkbox"
                checked={integrations.midtrans.is_active}
                onChange={(e) => setIntegrations({ ...integrations, midtrans: { ...integrations.midtrans, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Client Key</label>
                <input
                  type="text"
                  value={integrations.midtrans.client_key}
                  onChange={(e) => setIntegrations({ ...integrations, midtrans: { ...integrations.midtrans, client_key: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Server Key</label>
                <PasswordInput

                  value={integrations.midtrans.server_key}
                  onChange={(e) => setIntegrations({ ...integrations, midtrans: { ...integrations.midtrans, server_key: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))]">Gunakan kredensial Midtrans milik toko Anda sendiri.</p>
          </div>
        );

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
                Daftarkan callback URL <code className="font-mono">https://api.dagangos.com/api/webhooks/whatsapp</code> di App Meta Anda dengan verify token yang sama persis dengan yang diisi di sini.
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

            {/* Simulator webhook masuk -- dev/testing only. "Kirim Tes" di atas menguji arah
                KELUAR (toko -> pelanggan); ini menguji arah MASUK (pelanggan -> toko), yang
                sebelumnya tidak punya cara untuk diuji sama sekali tanpa Meta App nyata. */}
            <div className="border-t border-[hsl(var(--border))] pt-3">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase flex items-center gap-1.5">
                <FlaskConical size={13} /> Simulator Pesan Masuk (Khusus Testing/Development)
              </label>
              <p className="text-[11px] text-[hsl(var(--muted))] mt-1 mb-2">
                Simulasikan balasan pelanggan masuk lewat WhatsApp, tanpa perlu App Meta nyata. Hanya aktif jika server diset <code className="font-mono">ALLOW_WEBHOOK_SIMULATE=true</code>.
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Nomor Pengirim</label>
                  <input type="text" value={waSim.from} onChange={(e) => setWaSim({ ...waSim, from: e.target.value })}
                    placeholder="628123456789" className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-xs font-mono w-40" data-testid="wa-sim-from" />
                </div>
                <div className="flex flex-col space-y-1 flex-1 min-w-[160px]">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Isi Pesan</label>
                  <input type="text" value={waSim.text} onChange={(e) => setWaSim({ ...waSim, text: e.target.value })}
                    placeholder="Halo, pesanan saya sudah sampai mana?" className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-xs" data-testid="wa-sim-text" />
                </div>
                <button type="button" disabled={waSimBusy} onClick={sendWaSim}
                  className="btn-outline px-4 py-1.5 text-xs font-bold disabled:opacity-60" data-testid="wa-sim-send">
                  {waSimBusy ? "Mengirim…" : "Kirim Simulasi"}
                </button>
              </div>
              {waSimResult && (
                <p className={`text-xs mt-2 font-semibold ${waSimResult.ok ? "text-emerald-600" : "text-red-600"}`} data-testid="wa-sim-result">{waSimResult.msg}</p>
              )}

              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Pesan Masuk Terakhir</label>
                  <button type="button" onClick={loadWaInbound} className="text-[10px] font-semibold text-[hsl(var(--primary))] hover:underline" data-testid="wa-inbound-refresh">
                    {waInboundLoading ? "Memuat…" : "Muat Ulang"}
                  </button>
                </div>
                {waInbound.length === 0 ? (
                  <p className="text-[11px] text-[hsl(var(--muted))] mt-1" data-testid="wa-inbound-empty">Belum ada pesan masuk (nyata atau simulasi).</p>
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

  const subtabs = [
    { id: "xendit", label: "Xendit", path: "/geraina/app/integrations/xendit" },
    { id: "doku", label: "DOKU", path: "/geraina/app/integrations/doku" },
    { id: "midtrans", label: "Midtrans", path: "/geraina/app/integrations/midtrans" },
    { id: "qris", label: "QRIS", path: "/geraina/app/integrations/qris" },
    { id: "whatsapp", label: "WhatsApp", path: "/geraina/app/integrations/whatsapp" },
  ];

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

      {/* Subtab Navigation Bar */}
      <div className="flex flex-wrap gap-2 border-b border-[hsl(var(--border))] pb-3">
        {subtabs.map((tab) => {
          const isActive = type === tab.id;
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? "bg-[hsl(var(--primary))] text-white shadow-md" : "bg-[hsl(var(--surface))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

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
