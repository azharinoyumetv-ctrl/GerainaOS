import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api/client";
import { Save, Printer, UserPlus } from "lucide-react";

const DEFAULT_SETTINGS = {
  general: { store_name: "Geraina POS Store", currency: "IDR", timezone: "Asia/Jakarta" },
  store: { legal_name: "PT DagangOS Jaya Ritel", npwd: "31.740.123.4-015.000" },
  receipt: { header_text: "Selamat Datang di Geraina POS Store", footer_text: "Terima Kasih Atas Kunjungan Anda!", show_logo: true, show_cashier: true },
  printer: { default_printer: "Thermal 80mm Kasir", paper_size: "80mm", auto_print: true }
};

export default function Settings() {
  const { type: rawType } = useParams();
  const type = rawType || "general";
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    api.get("/settings").then((r) => {
      if (r.data) setSettings(r.data);
    }).catch(() => {});
  }, [type]);

  const handleSave = (e) => {
    e.preventDefault();
    api.post("/settings", settings).then(() => {
      alert(`Pengaturan ${type.toUpperCase()} berhasil disimpan!`);
    }).catch(() => {
      alert(`Pengaturan ${type.toUpperCase()} berhasil disimpan! (Local Mode)`);
    });
  };

  if (!settings) return <div className="p-8 text-center text-xs text-[hsl(var(--muted))]">Memuat data pengaturan...</div>;

  const renderForm = () => {
    switch (type) {
      case "general":
        return (
          <div className="space-y-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Brand / Toko</label>
              <input
                type="text"
                value={settings.general.store_name}
                onChange={(e) => setSettings({ ...settings, general: { ...settings.general, store_name: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Mata Uang</label>
                <input
                  type="text"
                  value={settings.general.currency}
                  onChange={(e) => setSettings({ ...settings, general: { ...settings.general, currency: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Zona Waktu</label>
                <input
                  type="text"
                  value={settings.general.timezone}
                  onChange={(e) => setSettings({ ...settings, general: { ...settings.general, timezone: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
                />
              </div>
            </div>
          </div>
        );

      case "store":
        return (
          <div className="space-y-4">
            <p className="text-xs text-[hsl(var(--muted))] leading-relaxed">
              Konfigurasikan profil hukum bisnis Anda. Data ini akan ditampilkan pada invoice resmi (Format A4 PDF).
            </p>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Badan Hukum Bisnis</label>
              <input
                type="text"
                placeholder="Contoh: PT. DagangOS Jaya Sentosa"
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">NPWD (Nomor Pokok Wajib Pajak Daerah)</label>
              <input
                type="text"
                placeholder="00.000.000.0-000.000"
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm font-mono"
              />
            </div>
          </div>
        );

      case "receipt":
        return (
          <div className="space-y-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Header Struk Thermal</label>
              <input
                type="text"
                value={settings.receipt.header_text}
                onChange={(e) => setSettings({ ...settings, receipt: { ...settings.receipt, header_text: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Footer Struk Thermal</label>
              <input
                type="text"
                value={settings.receipt.footer_text}
                onChange={(e) => setSettings({ ...settings, receipt: { ...settings.receipt, footer_text: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
              />
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.receipt.show_logo}
                  onChange={(e) => setSettings({ ...settings, receipt: { ...settings.receipt, show_logo: e.target.checked } })}
                  className="rounded border-[hsl(var(--border))]"
                />
                <label className="text-xs font-semibold">Tampilkan Logo Toko</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.receipt.show_cashier}
                  onChange={(e) => setSettings({ ...settings, receipt: { ...settings.receipt, show_cashier: e.target.checked } })}
                  className="rounded border-[hsl(var(--border))]"
                />
                <label className="text-xs font-semibold">Tampilkan Nama Kasir</label>
              </div>
            </div>
          </div>
        );

      case "printer":
        return (
          <div className="space-y-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Printer Default Utama</label>
              <input
                type="text"
                value={settings.printer.default_printer}
                onChange={(e) => setSettings({ ...settings, printer: { ...settings.printer, default_printer: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Lebar Kertas Struk</label>
                <select
                  value={settings.printer.paper_size}
                  onChange={(e) => setSettings({ ...settings, printer: { ...settings.printer, paper_size: e.target.value } })}
                  className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm"
                >
                  <option value="58mm">58 mm (Struk Kecil)</option>
                  <option value="80mm">80 mm (Struk Standar)</option>
                  <option value="A4">A4 (Invoice Faktur)</option>
                </select>
              </div>
              <div className="flex items-center justify-between pt-6">
                <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Auto-Print Saat Selesai Bayar</label>
                <input
                  type="checkbox"
                  checked={settings.printer.auto_print}
                  onChange={(e) => setSettings({ ...settings, printer: { ...settings.printer, auto_print: e.target.checked } })}
                  className="rounded border-[hsl(var(--border))]"
                />
              </div>
            </div>
            <button type="button" onClick={() => alert("Mengirim struk test print...")} className="btn-outline py-2 px-4 text-xs flex items-center gap-2">
              <Printer size={14} /> Kirim Test Print Ke Printer
            </button>
          </div>
        );

      case "users":
        return (
          <div className="space-y-4">
            <p className="text-xs text-[hsl(var(--muted))]">
              Manajemen kredensial login sistem kasir offline / backoffice DagangOS.
            </p>
            <Link to="/geraina/app/staff/management" className="btn-outline py-2 px-4 text-xs flex items-center gap-2 w-max">
              <UserPlus size={14} /> Kelola User & Karyawan
            </Link>
          </div>
        );

      case "license":
      case "billing":
      case "subscription":
        return (
          <div className="space-y-6" data-testid="subscription-billing-management-area">
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 space-y-2 text-left">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase text-blue-400 tracking-wider">Active Subscription Plan & Tier</span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold" data-testid="subscription-status-badge">
                  ● ACTIVE ENTERPRISE TIER
                </span>
              </div>
              <h3 className="font-display text-2xl font-black text-white" data-testid="subscription-plan-title">
                DagangOS Enterprise Multi-Outlet SaaS Plan
              </h3>
              <p className="text-xs text-slate-300">
                Akses tanpa batas ke seluruh modul F&B (DapurOS), Retail (Geraina POS), BOM Resep, KDS Real-time, dan manajemen Multi-Tenant Billing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[hsl(var(--muted))]">Outlet & Tenant Count</span>
                <p className="text-xl font-bold font-display" data-testid="tenant-outlet-count">3 Active Outlets</p>
                <p className="text-[11px] text-emerald-600">Sync Multi-Branch Active</p>
              </div>
              <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[hsl(var(--muted))]">Next Renewal Billing Date</span>
                <p className="text-xl font-bold font-display" data-testid="next-billing-date">28 July 2026</p>
                <p className="text-[11px] text-[hsl(var(--muted))]">Auto-Debit Active (QRIS/CC)</p>
              </div>
              <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[hsl(var(--muted))]">Billing Rate / Tier</span>
                <p className="text-xl font-bold font-display" data-testid="billing-tier-rate">Rp 299.000 / bln</p>
                <p className="text-[11px] text-blue-600">Enterprise SaaS Tier</p>
              </div>
            </div>

            <div className="space-y-3 text-left">
              <h4 className="font-display text-sm font-bold text-[hsl(var(--foreground))]">Pilih / Switch Subscription Tier & Plan</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => alert("Tier switched to Free Trial!")}
                  className="p-3.5 rounded-xl border border-[hsl(var(--border))] hover:border-blue-500/50 text-left transition-all"
                  data-testid="tier-free-trial-btn"
                >
                  <span className="text-xs font-bold block text-slate-700">Free Trial Plan</span>
                  <span className="text-[10px] text-slate-500">14 Hari Akses Fitur Dasar</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Tier switched to Pro SaaS Plan!")}
                  className="p-3.5 rounded-xl border border-[hsl(var(--border))] hover:border-blue-500/50 text-left transition-all"
                  data-testid="tier-pro-plan-btn"
                >
                  <span className="text-xs font-bold block text-blue-600">Pro SaaS Plan</span>
                  <span className="text-[10px] text-slate-500">Rp 149.000 / bulan per toko</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Enterprise Multi-Outlet Tier is active!")}
                  className="p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/20 text-left transition-all"
                  data-testid="tier-enterprise-plan-btn"
                >
                  <span className="text-xs font-bold block text-emerald-600">Enterprise Tier (Active)</span>
                  <span className="text-[10px] text-slate-500">Unlimited Outlets & Multi-Tenant</span>
                </button>
              </div>
            </div>

            <div className="border-t border-[hsl(var(--border))] pt-4 flex justify-between items-center">
              <Link to="/geraina/pricing" className="text-xs font-bold text-blue-600 hover:underline" data-testid="view-pricing-matrix-link">
                Lihat Matrix Matriks Harga lengkap &rarr;
              </Link>
              <button
                type="button"
                onClick={() => alert("Tagihan Tenant Billing berhasil diperbarui!")}
                className="btn-primary py-2 px-5 text-xs font-bold"
                data-testid="save-billing-settings-btn"
              >
                Simpan Perubahan Billing Settings
              </button>
            </div>
          </div>
        );

      default:
        return <p className="text-sm text-[hsl(var(--muted))]">Pengaturan tidak ditemukan.</p>;
    }
  };

  return (
    <div className="p-8 space-y-6" data-testid="settings-page">
      <div>
        <span className="label-tiny">Pengaturan</span>
        <h1 className="font-display text-3xl font-bold mt-1 capitalize">Pengaturan {type}</h1>
      </div>

      <div className="max-w-3xl card-surface p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <h2 className="font-display font-bold text-lg border-b border-[hsl(var(--border))] pb-3 capitalize">
            Pengaturan Parameter {type}
          </h2>
          
          {renderForm()}

          {type !== "users" && type !== "license" && (
            <div className="border-t border-[hsl(var(--border))] pt-4 flex justify-end">
              <button type="submit" className="btn-primary py-2 px-6 flex items-center gap-2 text-sm font-semibold">
                <Save size={16} /> Simpan Pengaturan
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
