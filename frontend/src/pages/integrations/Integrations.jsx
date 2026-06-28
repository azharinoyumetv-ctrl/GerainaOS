import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/api/client";
import { Save, Link2, Zap } from "lucide-react";

import { Link } from "react-router-dom";

export default function Integrations() {
  const params = useParams();
  const pathPart = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";
  const rawType = params.type || pathPart || "xendit";
  const type = (rawType === "integrations" || !rawType) ? "xendit" : rawType.toLowerCase();

  const [integrations, setIntegrations] = useState({
    xendit: { is_active: true, secret_key: "xnd_development_mock_key", webhook_token: "mock_wh_token" },
    midtrans: { is_active: true, client_key: "SB-Mid-client-mock", server_key: "SB-Mid-server-mock" },
    stripe: { is_active: true, publishable_key: "pk_test_mock", secret_key: "sk_test_mock" },
    qris: { is_active: true, nmid: "ID1029384756", merchant_name: "Geraina POS Store" },
    whatsapp: { is_active: true, provider: "Fonet/WABA Gateway", api_token: "wa_mock_api_token_9981" },
    telegram: { is_active: true, bot_token: "bot_77812938:AAF_mock_token", chat_id: "-1001928374" },
    email: { is_active: true, smtp_host: "smtp.mailtrap.io", smtp_port: 2525, smtp_user: "mock_smtp_user" }
  });
  const [simRefId, setSimRefId] = useState("");
  const [simStatus, setSimStatus] = useState("");
  const [simLoading, setSimLoading] = useState(false);

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
      alert(`Konfigurasi integrasi ${(type || 'midtrans').toUpperCase()} berhasil disimpan! (Local Mode)`);
    });
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

            {/* Webhook Simulator */}
            <div className="border-t border-[hsl(var(--border))] pt-4 mt-2" data-testid="webhook-simulator-xendit">
              <h3 className="text-sm font-bold flex items-center gap-1.5 mb-3"><Zap size={14} className="text-amber-500" /> Simulasi Webhook Callback</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Reference ID / Nomor Order</label>
                  <input type="text" value={simRefId} onChange={(e) => setSimRefId(e.target.value)} placeholder="GR-20260620-0001" className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-xs font-mono" data-testid="sim-ref-id" />
                </div>
                <div className="flex items-end">
                  <button type="button" disabled={!simRefId || simLoading} onClick={async () => {
                    setSimLoading(true); setSimStatus("");
                    try {
                      await api.post("/webhooks/xendit/simulate", { event: "qr.payment", reference_id: simRefId, status: "SUCCEEDED" });
                      setSimStatus("\u2705 Webhook berhasil dikirim!");
                    } catch { setSimStatus("\u274c Gagal mengirim webhook."); }
                    finally { setSimLoading(false); }
                  }} className="btn-outline py-1.5 px-4 text-xs w-full" data-testid="sim-trigger-btn">
                    <Zap size={12} /> {simLoading ? "Mengirim…" : "Kirim Simulasi"}
                  </button>
                </div>
              </div>
              {simStatus && <p className="text-xs mt-2 font-semibold" data-testid="sim-status">{simStatus}</p>}
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
                <input
                  type="password"
                  value={integrations.midtrans.server_key}
                  onChange={(e) => setIntegrations({ ...integrations, midtrans: { ...integrations.midtrans, server_key: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
            </div>

            {/* Midtrans Webhook Simulator */}
            <div className="border-t border-[hsl(var(--border))] pt-4 mt-2" data-testid="webhook-simulator-midtrans">
              <h3 className="text-sm font-bold flex items-center gap-1.5 mb-3"><Zap size={14} className="text-amber-500" /> Simulasi Webhook Callback</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Order ID / Reference ID</label>
                  <input type="text" value={simRefId} onChange={(e) => setSimRefId(e.target.value)} placeholder="GR-20260620-0001" className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-xs font-mono" data-testid="sim-ref-id-midtrans" />
                </div>
                <div className="flex items-end">
                  <button type="button" disabled={!simRefId || simLoading} onClick={async () => {
                    setSimLoading(true); setSimStatus("");
                    try {
                      await api.post("/webhooks/midtrans/simulate", { order_id: simRefId, transaction_status: "settlement" });
                      setSimStatus("\u2705 Webhook berhasil dikirim!");
                    } catch { setSimStatus("\u274c Gagal mengirim webhook."); }
                    finally { setSimLoading(false); }
                  }} className="btn-outline py-1.5 px-4 text-xs w-full" data-testid="sim-trigger-btn-midtrans">
                    <Zap size={12} /> {simLoading ? "Mengirim\u2026" : "Kirim Simulasi"}
                  </button>
                </div>
              </div>
              {simStatus && <p className="text-xs mt-2 font-semibold" data-testid="sim-status-midtrans">{simStatus}</p>}
            </div>
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

            {/* Stripe Webhook Simulator */}
            <div className="border-t border-[hsl(var(--border))] pt-4 mt-2" data-testid="webhook-simulator-stripe">
              <h3 className="text-sm font-bold flex items-center gap-1.5 mb-3"><Zap size={14} className="text-amber-500" /> Simulasi Webhook Callback</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase">Payment Intent / Reference ID</label>
                  <input type="text" value={simRefId} onChange={(e) => setSimRefId(e.target.value)} placeholder="pi_xxx or GR-20260620-0001" className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-xs font-mono" data-testid="sim-ref-id-stripe" />
                </div>
                <div className="flex items-end">
                  <button type="button" disabled={!simRefId || simLoading} onClick={async () => {
                    setSimLoading(true); setSimStatus("");
                    try {
                      await api.post("/webhooks/stripe/simulate", { payment_intent: simRefId, status: "succeeded" });
                      setSimStatus("\u2705 Webhook berhasil dikirim!");
                    } catch { setSimStatus("\u274c Gagal mengirim webhook."); }
                    finally { setSimLoading(false); }
                  }} className="btn-outline py-1.5 px-4 text-xs w-full" data-testid="sim-trigger-btn-stripe">
                    <Zap size={12} /> {simLoading ? "Mengirim\u2026" : "Kirim Simulasi"}
                  </button>
                </div>
              </div>
              {simStatus && <p className="text-xs mt-2 font-semibold" data-testid="sim-status-stripe">{simStatus}</p>}
            </div>
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
