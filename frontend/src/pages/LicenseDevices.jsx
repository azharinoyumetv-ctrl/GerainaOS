import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import api from "@/api/client";
import { toast } from "@/components/ui/sonner";
import { Crown, Smartphone, ShieldCheck, CalendarRange, PlusCircle, Trash2 } from "lucide-react";

// Persistent per-browser device identity, separate from GerainaOS/DapurOS's own key so the
// two modules (which may share an origin under /geraina and /dapuros) never collide on the
// same device_id and cross-link registrations between otherwise-separate store scopes.
const DEVICE_ID_KEY = "geraina_device_id";

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (window.crypto?.randomUUID ? window.crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function guessDeviceName() {
  const ua = navigator.userAgent || "";
  const isTablet = /Tablet|iPad/i.test(ua);
  const isMobile = !isTablet && /Mobi|Android/i.test(ua);
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const kind = isTablet ? "Tablet" : isMobile ? "Ponsel" : "Desktop";
  return `${browser} - ${kind}`;
}

function fmtDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

const PLAN_LABEL = {
  trial: "Free Trial (14 Hari)",
  starter: "Starter Plan",
  pro: "Pro Plan",
  business: "Business Plan",
};

export default function LicenseDevices() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [maxDevices, setMaxDevices] = useState(null);
  const [deviceName, setDeviceName] = useState(guessDeviceName());
  const [registering, setRegistering] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const deviceId = getOrCreateDeviceId();

  const loadDevices = () => {
    setLoading(true);
    api.get("/devices")
      .then((r) => setDevices(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    api.get("/pricing/tiers")
      .then((r) => {
        const tier = (r.data || []).find((t) => t.id === (user?.plan || "trial"));
        setMaxDevices(tier ? tier.max_devices : null);
      })
      .catch(() => {});
  }, [user?.plan]);

  const isThisDeviceRegistered = devices.some((d) => d.device_id === deviceId);

  const handleRegister = () => {
    if (!deviceName.trim()) {
      toast.error("Nama perangkat wajib diisi.");
      return;
    }
    setRegistering(true);
    api.post("/devices", { device_id: deviceId, name: deviceName.trim(), user_agent: navigator.userAgent })
      .then(() => {
        toast.success("Perangkat berhasil didaftarkan.");
        loadDevices();
      })
      .catch((err) => {
        toast.error(err?.response?.data?.detail || "Gagal mendaftarkan perangkat.");
      })
      .finally(() => setRegistering(false));
  };

  const handleRemove = (d) => {
    if (!window.confirm(`Hapus perangkat "${d.name}"? Slot perangkat akan kembali tersedia.`)) return;
    setRemovingId(d.id);
    api.delete(`/devices/${d.id}`)
      .then(() => {
        toast.success("Perangkat dihapus.");
        loadDevices();
      })
      .catch((err) => {
        toast.error(err?.response?.data?.detail || "Gagal menghapus perangkat.");
      })
      .finally(() => setRemovingId(null));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="license-page">
      <div className="flex flex-col gap-1">
        <span className="label-tiny">Manajemen SaaS</span>
        <h1 className="font-display text-3xl font-bold mt-1 text-[hsl(220,70%,15%)]" data-testid="license-title">
          Lisensi & Perangkat DagangOS
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Plan & License Summary */}
        <div className="card-surface p-6 space-y-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[hsl(var(--border))] pb-4">
            <div>
              <p className="text-xs text-[hsl(var(--muted))] uppercase font-semibold tracking-wider">Aplikasi Aktif</p>
              <h2 className="font-display text-lg font-bold text-[hsl(var(--primary))]">Geraina POS</h2>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[hsl(220,70%,15%)] text-white text-xs font-semibold">
              <Crown size={14} className="text-amber-400" />
              <span>{PLAN_LABEL[user?.plan] || "Free Trial (14 Hari)"}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted))] uppercase">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Status Lisensi</span>
              </div>
              <p className="text-sm font-bold text-[hsl(var(--foreground))]" data-testid="license-status">
                Aktif & Terverifikasi
              </p>
              <p className="text-xs text-[hsl(var(--muted))]">Kunci lisensi terikat dengan akun DagangOS Anda.</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted))] uppercase">
                <Smartphone size={14} className="text-blue-600" />
                <span>Kapasitas Perangkat</span>
              </div>
              <p className="text-sm font-bold text-[hsl(var(--foreground))]" data-testid="license-device-capacity">
                {maxDevices == null ? `${devices.length} perangkat terdaftar` : `${devices.length} dari ${maxDevices} perangkat`}
              </p>
              <p className="text-xs text-[hsl(var(--muted))]">Jumlah perangkat yang boleh aktif sesuai paket Anda.</p>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted))] uppercase">
                <CalendarRange size={14} className="text-amber-600" />
                <span>Masa Berlaku Berlangganan</span>
              </div>
              <p className="text-sm font-bold text-[hsl(var(--foreground))]" data-testid="license-expiry">
                {user?.plan === "trial" ? "Hingga masa trial berakhir (14 hari)" : "Langganan Bulanan Aktif"}
              </p>
              <p className="text-xs text-[hsl(var(--muted))]">Tagihan dan pembayaran dikelola langsung oleh platform induk DagangOS.</p>
            </div>
          </div>
        </div>

        {/* Register this device */}
        <div className="card-surface p-6 bg-gradient-to-b from-[hsl(220,40%,98%)] to-[hsl(220,40%,95%)] border-[hsl(220,30%,85%)] space-y-4">
          <div className="flex items-center gap-2 text-[hsl(220,70%,20%)]">
            <Smartphone size={18} />
            <h3 className="font-display font-bold">Perangkat Ini</h3>
          </div>
          {isThisDeviceRegistered ? (
            <div className="p-3 bg-white/60 rounded border border-[hsl(220,30%,88%)] text-xs text-[hsl(220,10%,45%)] leading-relaxed" data-testid="device-already-registered">
              Perangkat ini sudah terdaftar pada lisensi toko Anda.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[hsl(220,10%,45%)] leading-relaxed">
                Perangkat ini belum terdaftar. Beri nama lalu daftarkan untuk memakai 1 slot perangkat dari paket Anda.
              </p>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Nama perangkat (mis. Kasir Depan)"
                className="w-full text-sm border border-[hsl(220,30%,85%)] rounded-lg px-3 py-2 outline-none bg-white"
                data-testid="device-name-input"
              />
              <button
                onClick={handleRegister}
                disabled={registering}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white py-2.5 rounded-lg bg-[hsl(220,70%,20%)] disabled:opacity-60"
                data-testid="register-device-btn"
              >
                <PlusCircle size={14} /> {registering ? "Mendaftarkan…" : "Daftarkan Perangkat Ini"}
              </button>
            </div>
          )}
        </div>

        {/* Devices list */}
        <div className="card-surface p-6 space-y-4 lg:col-span-3">
          <div>
            <h3 className="font-display text-lg font-bold text-[hsl(var(--foreground))]">Perangkat Terdaftar</h3>
            <p className="text-xs text-[hsl(var(--muted))] mt-0.5">Daftar perangkat yang diaktifkan dengan lisensi toko Anda.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] text-xs text-[hsl(var(--muted))] uppercase">
                  <th className="py-2.5 font-semibold">Nama Perangkat</th>
                  <th className="py-2.5 font-semibold">Terdaftar Sejak</th>
                  <th className="py-2.5 font-semibold">Terakhir Aktif</th>
                  <th className="py-2.5 font-semibold text-right">Status</th>
                  <th className="py-2.5 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {loading ? (
                  <tr><td colSpan={5} className="py-6 text-center text-xs text-[hsl(var(--muted))]">Memuat…</td></tr>
                ) : devices.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-xs text-[hsl(var(--muted))]" data-testid="no-devices">Belum ada perangkat terdaftar.</td></tr>
                ) : devices.map((d) => (
                  <tr key={d.id} className="text-sm font-medium" data-testid={`device-row-${d.id}`}>
                    <td className="py-3">
                      {d.name}
                      {d.device_id === deviceId && (
                        <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[hsl(220,70%,95%)] text-[hsl(220,70%,30%)]">Perangkat ini</span>
                      )}
                    </td>
                    <td className="py-3 text-[hsl(var(--muted))]">{fmtDate(d.created_at)}</td>
                    <td className="py-3 text-[hsl(var(--muted))]">{fmtDate(d.last_seen_at)}</td>
                    <td className="py-3 text-right">
                      <span className="pill pill-success text-[9px] py-0.5 px-2">
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleRemove(d)}
                        disabled={removingId === d.id}
                        className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Hapus perangkat"
                        data-testid={`remove-device-${d.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
