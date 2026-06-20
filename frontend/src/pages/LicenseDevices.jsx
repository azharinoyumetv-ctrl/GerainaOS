import { useAuth } from "@/auth/AuthContext";
import { Crown, Smartphone, Wifi, ShieldCheck, CalendarRange, Clock } from "lucide-react";

export default function LicenseDevices() {
  const { user } = useAuth();

  const mockDevices = [
    { id: "DEV-08122-TAB", name: "Main Terminal (Tablet)", type: "Android Tablet", status: "Aktif", since: "2026-06-10" },
    { id: "DEV-09211-MOB", name: "Mobile POS 1", type: "Handheld POS Terminal", status: "Aktif", since: "2026-06-12" },
  ];

  const getPlanLabel = (plan) => {
    switch (plan) {
      case "trial": return "Free Trial (14 Hari)";
      case "starter": return "Starter Plan";
      case "pro": return "Pro Plan (Paling Populer)";
      case "business": return "Business Plan";
      case "multibranch": return "Multi-Branch Enterprise";
      default: return "Free Trial";
    }
  };

  return (
    <div className="p-8 space-y-6" data-testid="license-page">
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
              <span>{getPlanLabel(user?.plan)}</span>
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
                <Wifi size={14} className="text-blue-600" />
                <span>Batas Sinkronisasi Offline</span>
              </div>
              <p className="text-sm font-bold text-[hsl(var(--foreground))]" data-testid="license-grace">
                7 Hari Tersisa
              </p>
              <p className="text-xs text-[hsl(var(--muted))]">Sinkronisasi data otomatis dengan cloud.</p>
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

        {/* Sync Info Widget */}
        <div className="card-surface p-6 bg-gradient-to-b from-[hsl(220,40%,98%)] to-[hsl(220,40%,95%)] border-[hsl(220,30%,85%)] space-y-4">
          <div className="flex items-center gap-2 text-[hsl(220,70%,20%)]">
            <Clock size={18} />
            <h3 className="font-display font-bold">Status Sinkronisasi Cloud</h3>
          </div>
          <div className="space-y-3 text-sm text-[hsl(220,30%,25%)]">
            <div className="flex justify-between">
              <span>Sinkronisasi Database</span>
              <span className="font-semibold text-emerald-600">Terhubung</span>
            </div>
            <div className="flex justify-between">
              <span>Sinkronisasi Terakhir</span>
              <span className="font-semibold">Baru Saja</span>
            </div>
            <div className="flex justify-between">
              <span>Pencadangan Cloud</span>
              <span className="font-semibold text-emerald-600">Aktif</span>
            </div>
          </div>
          <div className="p-3 bg-white/60 rounded border border-[hsl(220,30%,88%)] text-xs text-[hsl(220,10%,45%)] leading-relaxed">
            Data transaksi dicadangkan otomatis ke server aman DagangOS setiap 5 menit.
          </div>
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
                  <th className="py-2.5 font-semibold">ID Perangkat</th>
                  <th className="py-2.5 font-semibold">Nama Terminal</th>
                  <th className="py-2.5 font-semibold">Tipe Perangkat</th>
                  <th className="py-2.5 font-semibold">Aktif Sejak</th>
                  <th className="py-2.5 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {mockDevices.map((d) => (
                  <tr key={d.id} className="text-sm font-medium" data-testid={`device-row-${d.id}`}>
                    <td className="py-3 font-mono text-xs">{d.id}</td>
                    <td className="py-3">{d.name}</td>
                    <td className="py-3 text-[hsl(var(--muted))]">{d.type}</td>
                    <td className="py-3 text-[hsl(var(--muted))]">{d.since}</td>
                    <td className="py-3 text-right">
                      <span className="pill pill-success text-[9px] py-0.5 px-2">
                        {d.status}
                      </span>
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
