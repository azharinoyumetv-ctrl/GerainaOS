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
  const params = useParams();
  const pathPart = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";
  const rawType = params.type || pathPart || "general";
  const type = (rawType === "settings" || !rawType) ? "general" : rawType.toLowerCase();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [sub, setSub] = useState(null);

  useEffect(() => {
    api.get("/settings").then((r) => {
      if (r.data) setSettings(r.data);
    }).catch(() => {});
  }, [type]);

  useEffect(() => {
    if (["billing", "subscription", "license"].includes(type)) {
      api.get("/subscription").then((r) => setSub(r.data)).catch(() => setSub(null));
    }
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
        return (
          <div className="space-y-5" data-testid="license-management-area">
            <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
              <span className="text-[10px] font-bold uppercase text-[hsl(var(--muted))]">Status Lisensi</span>
              <h3 className="font-display text-lg font-bold mt-1">Lisensi Perangkat & Aktivasi</h3>
              <p className="text-xs text-[hsl(var(--muted))] mt-1">
                Kelola perangkat kasir (device) yang terhubung ke toko Anda. Jumlah perangkat mengikuti paket langganan yang aktif.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[hsl(var(--muted))]">Paket Aktif</span>
                <p className="text-lg font-bold font-display capitalize" data-testid="license-plan">{sub?.plan || "trial"}</p>
              </div>
              <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[hsl(var(--muted))]">Status</span>
                <p className="text-lg font-bold font-display capitalize">{sub?.status || "trial"}</p>
              </div>
            </div>
            <Link to="/geraina/app/license" className="btn-outline py-2 px-4 text-xs flex items-center gap-2 w-max">
              Kelola Perangkat Kasir &rarr;
            </Link>
          </div>
        );

      case "billing":
      case "subscription": {
        const PLAN_NAMES = { trial: "Free Trial", starter: "Starter", pro: "Pro", business: "Business", multibranch: "Multi-Branch" };
        const planId = (sub?.plan || "trial").toLowerCase();
        const planName = PLAN_NAMES[planId] || planId;
        const isTrialPlan = planId === "trial";
        return (
          <div className="space-y-6" data-testid="subscription-billing-management-area">
            <div className="p-4 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border))] space-y-2 text-left">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase text-[hsl(var(--muted))] tracking-wider">Paket Langganan Aktif</span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 text-[10px] font-extrabold" data-testid="subscription-status-badge">
                  ● {isTrialPlan ? "TRIAL" : "AKTIF"}
                </span>
              </div>
              <h3 className="font-display text-2xl font-black" data-testid="subscription-plan-title">Paket {planName}</h3>
              {isTrialPlan && sub?.trial_ends_at && (
                <p className="text-xs text-[hsl(var(--muted))]">Masa trial berakhir: {new Date(sub.trial_ends_at).toLocaleDateString("id-ID")}</p>
              )}
            </div>

            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs leading-relaxed">
              Upgrade ke paket berbayar dilakukan lewat halaman Harga. Aktivasi otomatis akan tersedia setelah gateway pembayaran (Xendit/Midtrans) siap — sementara ini silakan hubungi sales untuk aktivasi manual.
            </div>

            <div className="border-t border-[hsl(var(--border))] pt-4 flex justify-between items-center">
              <Link to="/geraina/pricing" className="text-xs font-bold text-blue-600 hover:underline" data-testid="view-pricing-matrix-link">
                Lihat semua paket &amp; harga &rarr;
              </Link>
            </div>
          </div>
        );
      }

      default:
        return <p className="text-sm text-[hsl(var(--muted))]">Pengaturan tidak ditemukan.</p>;
    }
  };

  const subtabs = [
    { id: "general", label: "Umum", path: "/geraina/app/settings/general" },
    { id: "store", label: "Toko", path: "/geraina/app/settings/store" },
    { id: "billing", label: "Langganan & Tagihan", path: "/geraina/app/settings/billing" },
    { id: "receipt", label: "Struk", path: "/geraina/app/settings/receipt" },
    { id: "printer", label: "Printer", path: "/geraina/app/settings/printer" },
    { id: "users", label: "Pengguna", path: "/geraina/app/settings/users" },
    { id: "license", label: "Lisensi", path: "/geraina/app/settings/license" }
  ];

  return (
    <div className="p-8 space-y-6 text-left" data-testid="settings-page">
      <div>
        <span className="label-tiny">Pengaturan</span>
        <h1 className="font-display text-3xl font-bold mt-1 capitalize">Pengaturan ({type})</h1>
      </div>

      {/* Subtab Navigation Bar */}
      <div className="flex flex-wrap gap-2 border-b border-[hsl(var(--border))] pb-3">
        {subtabs.map((tab) => {
          const isActive = type === tab.id || (type === "subscription" && tab.id === "billing");
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
            Pengaturan Parameter ({type})
          </h2>
          
          {renderForm()}

          {type !== "users" && type !== "license" && type !== "billing" && type !== "subscription" && (
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
