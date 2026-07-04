import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/api/client";
import { Save, Link2 } from "lucide-react";

import { Link } from "react-router-dom";

export default function Integrations() {
  const params = useParams();
  const pathPart = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";
  const rawType = params.type || pathPart || "xendit";
  const type = (rawType === "integrations" || !rawType) ? "xendit" : rawType.toLowerCase();

  // Empty by default — each store brings its own (BYO) payment/notification credentials.
  const [integrations, setIntegrations] = useState({
    xendit: { is_active: false, secret_key: "", webhook_token: "" },
    midtrans: { is_active: false, client_key: "", server_key: "" },
    stripe: { is_active: false, publishable_key: "", secret_key: "" },
    qris: { is_active: false, nmid: "", merchant_name: "" },
    whatsapp: { is_active: false, provider: "", api_token: "" },
    telegram: { is_active: false, bot_token: "", chat_id: "" },
    email: { is_active: false, smtp_host: "", smtp_port: 587, smtp_user: "" }
  });

  useEffect(() => {
    api.get("/integrations").then((r) => {
      if (r.data) setIntegrations(r.data);
    }).catch(() => {});
  }, [type]);

  const handleSave = (e) => {
    e.preventDefault();
    api.post("/integrations", integrations).then(() => {
      alert(`Konfigurasi integrasi ${(type || 'midtrans').toUpperCase()} berhasil disimpan!`);
    }).catch(() => {
      alert(`Gagal menyimpan konfigurasi ${(type || 'midtrans').toUpperCase()}.`);
    });
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
        provider: integrations.whatsapp?.provider,
        api_token: integrations.whatsapp?.api_token,
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

  if (!integrations) return <div className="p-8 text-center text-xs text-[hsl(var(--muted))]">Memuat data integrasi...</div>;

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
              <input
                type="password"
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
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
              />
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))]">Gunakan API key Xendit milik toko Anda sendiri. Transaksi pelanggan masuk langsung ke akun Xendit Anda.</p>
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
                <input
                  type="password"
                  value={integrations.midtrans.server_key}
                  onChange={(e) => setIntegrations({ ...integrations, midtrans: { ...integrations.midtrans, server_key: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))]">Gunakan kredensial Midtrans milik toko Anda sendiri.</p>
          </div>
        );

      case "stripe":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Aktifkan Stripe Payments</label>
              <input
                type="checkbox"
                checked={integrations.stripe.is_active}
                onChange={(e) => setIntegrations({ ...integrations, stripe: { ...integrations.stripe, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Stripe Publishable Key</label>
                <input
                  type="text"
                  value={integrations.stripe.publishable_key}
                  onChange={(e) => setIntegrations({ ...integrations, stripe: { ...integrations.stripe, publishable_key: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Stripe Secret Key</label>
                <input
                  type="password"
                  value={integrations.stripe.secret_key}
                  onChange={(e) => setIntegrations({ ...integrations, stripe: { ...integrations.stripe, secret_key: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))]">Gunakan kredensial Stripe milik toko Anda sendiri.</p>
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
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">WhatsApp Provider Gateway</label>
              <input
                type="text"
                value={integrations.whatsapp.provider}
                onChange={(e) => setIntegrations({ ...integrations, whatsapp: { ...integrations.whatsapp, provider: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">API Token</label>
              <input
                type="password"
                value={integrations.whatsapp.api_token}
                onChange={(e) => setIntegrations({ ...integrations, whatsapp: { ...integrations.whatsapp, api_token: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
              />
            </div>

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
              <p className="text-[11px] text-[hsl(var(--muted))] mt-1">Isi Provider + API Token di atas, lalu kirim tes ke nomor Anda sendiri untuk memastikan koneksi.</p>
            </div>
          </div>
        );

      case "telegram":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Aktifkan Notifikasi Telegram</label>
              <input
                type="checkbox"
                checked={integrations.telegram.is_active}
                onChange={(e) => setIntegrations({ ...integrations, telegram: { ...integrations.telegram, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Bot API Token</label>
                <input
                  type="password"
                  value={integrations.telegram.bot_token}
                  onChange={(e) => setIntegrations({ ...integrations, telegram: { ...integrations.telegram, bot_token: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Target Chat ID / Channel</label>
                <input
                  type="text"
                  value={integrations.telegram.chat_id}
                  onChange={(e) => setIntegrations({ ...integrations, telegram: { ...integrations.telegram, chat_id: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
            </div>
          </div>
        );

      case "email":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Kirim Struk/Invoice via Email</label>
              <input
                type="checkbox"
                checked={integrations.email.is_active}
                onChange={(e) => setIntegrations({ ...integrations, email: { ...integrations.email, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">SMTP Host</label>
                <input
                  type="text"
                  value={integrations.email.smtp_host}
                  onChange={(e) => setIntegrations({ ...integrations, email: { ...integrations.email, smtp_host: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">SMTP Port</label>
                <input
                  type="number"
                  value={integrations.email.smtp_port}
                  onChange={(e) => setIntegrations({ ...integrations, email: { ...integrations.email, smtp_port: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">SMTP Username</label>
                <input
                  type="text"
                  value={integrations.email.smtp_user}
                  onChange={(e) => setIntegrations({ ...integrations, email: { ...integrations.email, smtp_user: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
                />
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
    { id: "midtrans", label: "Midtrans", path: "/geraina/app/integrations/midtrans" },
    { id: "stripe", label: "Stripe", path: "/geraina/app/integrations/stripe" },
    { id: "qris", label: "QRIS", path: "/geraina/app/integrations/qris" },
    { id: "whatsapp", label: "WhatsApp", path: "/geraina/app/integrations/whatsapp" },
    { id: "telegram", label: "Telegram", path: "/geraina/app/integrations/telegram" },
    { id: "email", label: "Email SMTP", path: "/geraina/app/integrations/email" }
  ];

  return (
    <div className="p-8 space-y-6 text-left" data-testid="integrations-page">
      <div className="flex items-center justify-between">
        <div>
          <span className="label-tiny">Integrasi</span>
          <h1 className="font-display text-3xl font-bold mt-1 capitalize">Kanal Integrasi ({type})</h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/8 px-3 py-1 rounded border border-[hsl(var(--primary))]/20">
          <Link2 size={14} /> Terhubung Layanan Cloud
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

          {renderForm()}

          <div className="border-t border-[hsl(var(--border))] pt-4 flex justify-end">
            <button type="submit" className="btn-primary py-2 px-6 flex items-center gap-2 text-sm font-semibold">
              <Save size={16} /> Simpan Integrasi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
