import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api/client";
import { Save, Printer, UserPlus } from "lucide-react";

export default function Settings() {
  const { type } = useParams();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, [type]);

  const handleSave = (e) => {
    e.preventDefault();
    api.post("/settings", settings).then(() => {
      alert(`Pengaturan ${type.toUpperCase()} berhasil disimpan!`);
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
            <Link to="/app/staff/management" className="btn-outline py-2 px-4 text-xs flex items-center gap-2 w-max">
              <UserPlus size={14} /> Kelola User & Karyawan
            </Link>
          </div>
        );

      case "license":
        return (
          <div className="space-y-4">
            <p className="text-xs text-[hsl(var(--muted))] leading-relaxed">
              Anda saat ini mengoperasikan sistem di bawah lisensi cloud **DagangOS Geraina POS Indonesia**.
            </p>
            <div className="border border-[hsl(var(--border))] p-4 rounded-lg bg-[hsl(var(--background))]/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[hsl(var(--muted))]">Perangkat Terkoneksi</span>
                <p className="text-sm font-semibold">2 Perangkat Kasir Aktif</p>
              </div>
              <Link to="/app/license" className="btn-primary py-2 px-4 text-xs font-semibold">
                Kelola Lisensi Cabang & Alat
              </Link>
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
        <span className="label-tiny">Settings</span>
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
