import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/api/client";
import { Save, ShieldCheck } from "lucide-react";

export default function PaymentConfig() {
  const { type } = useParams();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get("/payments/config").then((r) => setConfig(r.data)).catch(() => {});
  }, [type]);

  const handleSave = (e) => {
    e.preventDefault();
    setErrors({});
    if (type === "qris" && (!config.qris.merchant_id || !config.qris.merchant_id.trim())) {
      setErrors({ merchant_id: "Merchant ID wajib diisi" });
      return;
    }
    setSaving(true);
    api.post("/payments/config", config)
      .then(() => {
        alert(`Konfigurasi pembayaran ${type.toUpperCase()} berhasil disimpan!`);
      })
      .catch((err) => {
        alert("Gagal menyimpan konfigurasi: " + (err.response?.data?.detail || err.message));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  if (!config) return <div className="p-8 text-center text-xs text-[hsl(var(--muted))]">Memuat data pembayaran...</div>;

  const renderConfigForm = () => {
    switch (type) {
      case "cash":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Aktifkan Tunai</label>
              <input
                type="checkbox"
                checked={config.cash.is_active}
                onChange={(e) => setConfig({ ...config, cash: { ...config.cash, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Provider Sistem</label>
              <input
                type="text"
                value={config.cash.provider}
                onChange={(e) => setConfig({ ...config, cash: { ...config.cash, provider: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <label className="text-sm font-semibold">Wajib Hubungkan Cash Drawer (Laci Kasir)</label>
              <input
                type="checkbox"
                checked={config.cash.require_drawer}
                onChange={(e) => setConfig({ ...config, cash: { ...config.cash, require_drawer: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            {config.cash.require_drawer && (
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Port Printer / Drawer</label>
                <input
                  type="text"
                  value={config.cash.active_drawer_port}
                  onChange={(e) => setConfig({ ...config, cash: { ...config.cash, active_drawer_port: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
                />
              </div>
            )}
          </div>
        );
      
      case "qris":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Aktifkan QRIS Dinamis</label>
              <input
                type="checkbox"
                checked={config.qris.is_active}
                onChange={(e) => setConfig({ ...config, qris: { ...config.qris, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Integrasi Provider</label>
                <select
                  value={config.qris.provider}
                  onChange={(e) => setConfig({ ...config, qris: { ...config.qris, provider: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
                >
                  <option value="Xendit">Xendit (Rekomendasi)</option>
                  <option value="Midtrans">Midtrans</option>
                  <option value="Doku">Doku</option>
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">QRIS Merchant ID</label>
                <input
                  type="text"
                  value={config.qris.merchant_id}
                  onChange={(e) => {
                    setConfig({ ...config, qris: { ...config.qris, merchant_id: e.target.value } });
                    if (e.target.value.trim()) {
                      setErrors((prev) => {
                        const newErr = { ...prev };
                        delete newErr.merchant_id;
                        return newErr;
                      });
                    }
                  }}
                  className={`border ${errors.merchant_id ? 'border-red-500' : 'border-[hsl(var(--border))]'} rounded-md px-4 py-2 bg-white text-sm font-mono`}
                  data-testid="qris-merchant-id-input"
                />
                {errors.merchant_id && (
                  <span className="text-xs text-red-500 mt-1" data-testid="qris-validation-error">
                    {errors.merchant_id}
                  </span>
                )}
              </div>
            </div>
          </div>
        );

      case "ewallet":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/50 pb-2">
              <label className="text-sm font-semibold">Aktifkan Dompet Digital (E-Wallet)</label>
              <input
                type="checkbox"
                checked={config.ewallet.is_active}
                onChange={(e) => setConfig({ ...config, ewallet: { ...config.ewallet, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <div className="flex flex-col space-y-1 pb-4">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Provider Payment Gateway</label>
              <select
                value={config.ewallet.provider}
                onChange={(e) => setConfig({ ...config, ewallet: { ...config.ewallet, provider: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm max-w-xs"
              >
                <option value="Xendit">Xendit</option>
                <option value="Midtrans">Midtrans</option>
              </select>
            </div>
            <h3 className="text-xs font-bold text-[hsl(var(--muted))] uppercase">Saluran E-Wallet</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.keys(config.ewallet.channels).map((ch) => (
                <div key={ch} className="flex items-center justify-between p-3 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--surface))]">
                  <span className="text-xs font-semibold">{ch}</span>
                  <input
                    type="checkbox"
                    checked={config.ewallet.channels[ch]}
                    onChange={(e) => {
                      const updated = { ...config.ewallet.channels, [ch]: e.target.checked };
                      setConfig({ ...config, ewallet: { ...config.ewallet, channels: updated } });
                    }}
                    className="rounded border-[hsl(var(--border))] text-[hsl(var(--primary))]"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case "va":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/50 pb-2">
              <label className="text-sm font-semibold">Aktifkan Virtual Account Bank</label>
              <input
                type="checkbox"
                checked={config.va.is_active}
                onChange={(e) => setConfig({ ...config, va: { ...config.va, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <div className="flex flex-col space-y-1 pb-4">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Provider Payment Gateway</label>
              <select
                value={config.va.provider}
                onChange={(e) => setConfig({ ...config, va: { ...config.va, provider: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm max-w-xs"
              >
                <option value="Midtrans">Midtrans</option>
                <option value="Xendit">Xendit</option>
              </select>
            </div>
            <h3 className="text-xs font-bold text-[hsl(var(--muted))] uppercase">Virtual Account Bank yang Didukung</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.keys(config.va.banks).map((bk) => (
                <div key={bk} className="flex items-center justify-between p-3 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--surface))]">
                  <span className="text-xs font-semibold">{bk} VA</span>
                  <input
                    type="checkbox"
                    checked={config.va.banks[bk]}
                    onChange={(e) => {
                      const updated = { ...config.va.banks, [bk]: e.target.checked };
                      setConfig({ ...config, va: { ...config.va, banks: updated } });
                    }}
                    className="rounded border-[hsl(var(--border))] text-[hsl(var(--primary))]"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case "credit-card":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/50 pb-2">
              <label className="text-sm font-semibold">Aktifkan Kartu Kredit Online</label>
              <input
                type="checkbox"
                checked={config.credit_card.is_active}
                onChange={(e) => setConfig({ ...config, credit_card: { ...config.credit_card, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Gateway Pemroses</label>
                <select
                  value={config.credit_card.provider}
                  onChange={(e) => setConfig({ ...config, credit_card: { ...config.credit_card, provider: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
                >
                  <option value="Stripe">Stripe</option>
                  <option value="Midtrans">Midtrans</option>
                  <option value="Xendit">Xendit</option>
                </select>
              </div>
              <div className="flex items-center justify-between pt-6">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Wajibkan 3D Secure (3DS)</label>
                <input
                  type="checkbox"
                  checked={config.credit_card.enable_3ds}
                  onChange={(e) => setConfig({ ...config, credit_card: { ...config.credit_card, enable_3ds: e.target.checked } })}
                  className="rounded border-[hsl(var(--border))]"
                />
              </div>
            </div>
          </div>
        );

      case "bank-transfer":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/50 pb-2">
              <label className="text-sm font-semibold">Aktifkan Transfer Bank Manual</label>
              <input
                type="checkbox"
                checked={config.bank_transfer.is_active}
                onChange={(e) => setConfig({ ...config, bank_transfer: { ...config.bank_transfer, is_active: e.target.checked } })}
                className="rounded border-[hsl(var(--border))]"
              />
            </div>
            <h3 className="text-xs font-bold text-[hsl(var(--muted))] uppercase">Rekening Penerima</h3>
            {config.bank_transfer.accounts.map((ac, idx) => (
              <div key={idx} className="border border-[hsl(var(--border))] p-4 rounded-lg bg-[hsl(var(--surface))] grid grid-cols-3 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] text-[hsl(var(--muted))] uppercase">Nama Bank</label>
                  <input
                    type="text"
                    value={ac.bank}
                    onChange={(e) => {
                      const updated = [...config.bank_transfer.accounts];
                      updated[idx].bank = e.target.value;
                      setConfig({ ...config, bank_transfer: { ...config.bank_transfer, accounts: updated } });
                    }}
                    className="border border-[hsl(var(--border))] rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] text-[hsl(var(--muted))] uppercase">No Rekening</label>
                  <input
                    type="text"
                    value={ac.account_no}
                    onChange={(e) => {
                      const updated = [...config.bank_transfer.accounts];
                      updated[idx].account_no = e.target.value;
                      setConfig({ ...config, bank_transfer: { ...config.bank_transfer, accounts: updated } });
                    }}
                    className="border border-[hsl(var(--border))] rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] text-[hsl(var(--muted))] uppercase">Nama Pemilik Rekening</label>
                  <input
                    type="text"
                    value={ac.account_name}
                    onChange={(e) => {
                      const updated = [...config.bank_transfer.accounts];
                      updated[idx].account_name = e.target.value;
                      setConfig({ ...config, bank_transfer: { ...config.bank_transfer, accounts: updated } });
                    }}
                    className="border border-[hsl(var(--border))] rounded px-2 py-1 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return <p className="text-sm text-[hsl(var(--muted))]">Konfigurasi tidak ditemukan.</p>;
    }
  };

  return (
    <div className="p-8 space-y-6" data-testid="payment-config-page">
      <div className="flex items-center justify-between">
        <div>
          <span className="label-tiny">Pembayaran</span>
          <h1 className="font-display text-3xl font-bold mt-1 capitalize">Metode {type}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded border border-emerald-100">
          <ShieldCheck size={14} /> Keamanan PCI-DSS Terjamin
        </div>
      </div>

      <div className="max-w-3xl card-surface p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <h2 className="font-display font-bold text-lg border-b border-[hsl(var(--border))] pb-3 capitalize">
            Pengaturan Pembayaran {type}
          </h2>
          
          {renderConfigForm()}

          <div className="border-t border-[hsl(var(--border))] pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary py-2 px-6 flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
              data-testid="payment-config-save-btn"
            >
              <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
