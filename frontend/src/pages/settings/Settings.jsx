import { useAuth } from "@/auth/AuthContext";
import SectionNavigation from "@/navigation/SectionNavigation";
import SubscriptionSettings from "./SubscriptionSettings";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api/client";
import { Save, Printer, UserPlus } from "lucide-react";
import { toast } from "@/components/ui/sonner";

const DEFAULT_SETTINGS = {
  general: { store_name: "", currency: "IDR", timezone: "Asia/Jakarta" },
  store: { legal_name: "", npwd: "" },
  receipt: { header_text: "Selamat Datang di Geraina POS Store", footer_text: "Terima Kasih Atas Kunjungan Anda!", show_logo: true, show_cashier: true },
  printer: { mode: "local", default_printer: "Thermal 80mm Kasir", paper_size: "80mm", auto_print: true, printer_ip: "", printer_port: 9100, bridge_port: 9899 }
};

export default function Settings() {
  const params = useParams();
  const pathPart = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";
  const rawType = params.type || pathPart || "general";
  const type = (rawType === "settings" || !rawType) ? "general" : rawType.toLowerCase();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const { user } = useAuth();
  const sub = { plan: user?.plan, status: user?.subscription?.status || (user?.plan === "trial" ? "trial" : user?.plan === "expired" ? "expired" : "active") };
  const [testingPrint, setTestingPrint] = useState(false);
  const [loaded, setLoaded] = useState(false), [loadError, setLoadError] = useState(""), [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (["billing", "subscription"].includes(type)) { setLoadError(""); return; }
    let active = true; setLoaded(false); setLoadError("");
    api.get("/settings", { timeout: 12000 }).then((r) => {
      if (!r.data || typeof r.data !== "object" || Array.isArray(r.data)) throw new Error("Invalid settings response");
      const merged = { ...r.data };
      for (const [section, defaults] of Object.entries(DEFAULT_SETTINGS)) merged[section] = { ...defaults, ...r.data[section] };
      if (active) { setSettings(merged); setLoaded(true); }
    }).catch(() => { if (active) setLoadError("Pengaturan belum dapat dimuat. Coba lagi sebelum menyimpan perubahan."); });
    return () => { active = false; };
  }, [type, retry]);


  const handleSave = (e) => {
    e.preventDefault();
    if (!loaded || saving) return;
    setSaving(true);
    api.post("/settings", settings).then(() => {
      toast.success(`Pengaturan ${type.toUpperCase()} berhasil disimpan!`);
    }).catch((err) => {
      const msg = err?.response?.data?.detail || "Gagal terhubung ke server.";
      toast.error(`Gagal menyimpan pengaturan ${type.toUpperCase()}: ${typeof msg === "string" ? msg : "Periksa data pengaturan."}`);
    }).finally(() => setSaving(false));
  };

  const handleTestPrint = async () => {
    const mode = settings?.printer?.mode || "local";
    if (mode === "local") {
      // Mode A (local/USB): print via the browser's own print dialog.
      window.print();
      return;
    }
    // Mode B (network/ESC-POS): fetch the raw print bytes from the backend, then hand them
    // to the local printer-bridge (see printer-bridge/) which forwards them to the LAN
    // printer. This can't be done directly from the browser or the cloud backend -- neither
    // can open a raw socket to a printer on the store's own network.
    const printerIp = (settings?.printer?.printer_ip || "").trim();
    const printerPort = settings?.printer?.printer_port || 9100;
    const bridgePort = settings?.printer?.bridge_port || 9899;
    if (!printerIp) {
      toast.error("Isi IP Address printer terlebih dahulu.");
      return;
    }
    setTestingPrint(true);
    try {
      const r = await api.get("/printer/test-escpos");
      const dataB64 = r?.data?.data_base64;
      if (!dataB64) throw new Error("Backend tidak mengembalikan data cetak.");
      const resp = await fetch(`http://127.0.0.1:${bridgePort}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: printerIp, port: printerPort, data_base64: dataB64 }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${resp.status}`);
      }
      toast.success("Test print terkirim ke printer jaringan.");
    } catch (err) {
      toast.error(`Gagal mengirim test print: ${err.message}`, {
        description: "Pastikan aplikasi Printer Bridge sedang berjalan di komputer ini (lihat folder printer-bridge/), dan IP/port printer di atas sudah benar.",
      });
    } finally {
      setTestingPrint(false);
    }
  };

  if (!settings) return <div className="p-4 sm:p-6 lg:p-8 text-center text-xs text-[hsl(var(--muted))]">Memuat data pengaturan...</div>;

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
        if (window.GerainaDevice?.configurePrinter) return <div className="card-surface p-5 space-y-4" data-testid="android-printer-settings"><h2 className="font-display text-xl">Printer struk Android</h2><p>Pilih printer Bluetooth yang sudah dipasangkan atau printer USB melalui OTG, lalu atur kertas 58 mm atau 80 mm. Printer tersimpan di perangkat ini dan dapat dipakai untuk struk tunai offline.</p><div className="flex gap-3 flex-wrap"><button type="button" className="btn-primary" onClick={() => window.GerainaDevice.configurePrinter()} data-testid="configure-android-printer"><Printer size={16} /> Pilih printer</button><button type="button" className="btn-outline" onClick={() => window.GerainaDevice.testPrinter()} data-testid="test-android-printer">Cetak contoh</button></div><p className="text-xs text-[#52674b]">Gunakan printer struk ESC/POS Bluetooth Classic atau USB printer-class. Printer BLE dan protokol khusus memerlukan dukungan model tersendiri.</p></div>;
        return (
          <div className="space-y-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Mode Printer</label>
              <select
                value={settings.printer.mode || "local"}
                onChange={(e) => setSettings({ ...settings, printer: { ...settings.printer, mode: e.target.value } })}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-sm max-w-xs"
              >
                <option value="local">Lokal / USB (dialog cetak browser)</option>
                <option value="network">Jaringan / Network (ESC-POS, butuh Printer Bridge)</option>
              </select>
              <p className="text-[11px] text-[hsl(var(--muted))] mt-1">
                Mode Jaringan mengirim struk langsung ke printer thermal via jaringan lokal toko. Ini butuh aplikasi kecil "Printer Bridge" berjalan di komputer kasir Anda — lihat folder <code>printer-bridge/</code> di instalasi GerainaOS Anda untuk cara menjalankannya. Browser dan server cloud tidak bisa langsung terhubung ke printer di jaringan lokal toko, jadi bridge ini yang menjembataninya.
              </p>
            </div>

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

            {settings.printer.mode === "network" && (
              <div className="grid grid-cols-3 gap-4 p-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">IP Address Printer</label>
                  <input
                    type="text"
                    placeholder="192.168.1.50"
                    value={settings.printer.printer_ip || ""}
                    onChange={(e) => setSettings({ ...settings, printer: { ...settings.printer, printer_ip: e.target.value } })}
                    className="border border-[hsl(var(--border))] rounded-md px-3 py-2 bg-white text-sm font-mono"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Port Printer</label>
                  <input
                    type="number"
                    value={settings.printer.printer_port || 9100}
                    onChange={(e) => setSettings({ ...settings, printer: { ...settings.printer, printer_port: parseInt(e.target.value, 10) || 9100 } })}
                    className="border border-[hsl(var(--border))] rounded-md px-3 py-2 bg-white text-sm font-mono"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Port Bridge (Lokal)</label>
                  <input
                    type="number"
                    value={settings.printer.bridge_port || 9899}
                    onChange={(e) => setSettings({ ...settings, printer: { ...settings.printer, bridge_port: parseInt(e.target.value, 10) || 9899 } })}
                    className="border border-[hsl(var(--border))] rounded-md px-3 py-2 bg-white text-sm font-mono"
                  />
                </div>
              </div>
            )}

            <button type="button" onClick={handleTestPrint} disabled={testingPrint} className="btn-outline py-2 px-4 text-xs flex items-center gap-2 disabled:opacity-50">
              <Printer size={14} /> {testingPrint ? "Mengirim..." : "Kirim Test Print Ke Printer"}
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
      case "subscription":
        return <SubscriptionSettings />;

      default:
        return <p className="text-sm text-[hsl(var(--muted))]">Pengaturan tidak ditemukan.</p>;
    }
  };


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 text-left" data-testid="settings-page">
      <div>
        <span className="label-tiny">Pengaturan</span>
        <h1 className="font-display text-3xl font-bold mt-1 capitalize">{["billing", "subscription"].includes(type) ? "Langganan & Tagihan" : `Pengaturan (${type})`}</h1>
      </div>

      <SectionNavigation section="settings" active={type === "subscription" ? "billing" : type} />

      <div className="max-w-3xl card-surface p-6">
        {loadError && <div role="alert" data-testid="settings-error" className="mb-4"><p>{loadError}</p><button type="button" className="btn-outline mt-2" onClick={() => setRetry(value => value + 1)}>Coba lagi</button></div>}
        <form onSubmit={handleSave} className="space-y-6">
          <h2 className="font-display font-bold text-lg border-b border-[hsl(var(--border))] pb-3 capitalize">
            {["billing", "subscription"].includes(type) ? "Kelola Paket" : `Pengaturan Parameter (${type})`}
          </h2>
          
          {renderForm()}

          {type !== "users" && type !== "license" && type !== "billing" && type !== "subscription" && !(type === "printer" && window.GerainaDevice?.configurePrinter) && (
            <div className="border-t border-[hsl(var(--border))] pt-4 flex justify-end">
              <button type="submit" disabled={!loaded || saving} className="btn-primary py-2 px-6 flex items-center gap-2 text-sm font-semibold disabled:opacity-50">
                <Save size={16} /> {saving ? "Menyimpan…" : "Simpan Pengaturan"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
