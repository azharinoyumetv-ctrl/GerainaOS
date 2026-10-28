import { useAuth } from "@/auth/AuthContext";
import { subscriptionState } from "@/auth/subscriptionState";
import { Leaf, ShieldCheck, Cpu, Building2, Mail, HelpCircle } from "lucide-react";
import SupportContact from '@/support/SupportContact';

export default function About() {
  const { user } = useAuth();
  const appInfo = window.GerainaDevice?.appInfo;
  const license = subscriptionState(user);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="about-page">
      <div className="flex flex-col gap-1">
        <span className="label-tiny">Tentang Aplikasi</span>
        <h1 className="font-display text-3xl font-bold mt-1" data-testid="about-title">
          Informasi Sistem
        </h1>
      </div>

      <div className="max-w-2xl grid gap-6">
        {/* Brand Card */}
        <div className="card-surface p-6 bg-gradient-to-r from-[hsl(151,39%,98%)] to-[hsl(151,39%,95%)] relative overflow-hidden">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="text-[hsl(var(--accent))]" size={24} />
                <span className="font-display text-2xl font-extrabold text-[hsl(var(--primary))]">
                  Geraina POS
                </span>
              </div>
              <p className="text-sm text-[hsl(var(--muted))]">
                Modul POS Grosir & Ritel di dalam platform bisnis DagangOS.
              </p>
            </div>
            <span className="pill pill-success" data-testid="about-version">{appInfo?.versionName ? `v${appInfo.versionName}` : "Web"}</span>
          </div>
          <div className="mt-6 pt-4 border-t border-[hsl(var(--border))] flex flex-col sm:flex-row justify-between gap-2 text-xs text-[hsl(var(--muted))] relative z-10">
            <span>Platform Induk: <strong>DagangOS</strong></span>
            <span>Wilayah: <strong>Indonesia (ID)</strong></span>
          </div>
        </div>

        {/* System Details */}
        <div className="card-surface p-6 space-y-4">
          <h2 className="font-display text-lg font-bold border-b border-[hsl(var(--border))] pb-2">
            Status Lisensi & Perangkat
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] shrink-0">
                <Building2 size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--muted))]">Nama Bisnis / Toko</p>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]" data-testid="about-store-name">
                  {user?.store_name || "Toko Kelontong Anda"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--muted))]">Status Lisensi</p>
                <p className={`text-sm font-semibold ${license.active ? "text-[hsl(var(--success))]" : "text-amber-900"}`} data-testid="about-license-status">
                  {license.label}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] shrink-0">
                <Cpu size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--muted))]">Perangkat Aktif</p>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]" data-testid="about-device">
                  {appInfo ? `Android ${appInfo.androidVersion} · ${appInfo.model}` : "Browser web"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] shrink-0">
                <Mail size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--muted))]">Kontak Dukungan</p>
                {user && <SupportContact key={`${user.id}_${user.store_id}`} user={user} appVersion={appInfo?.versionName || 'Web'} initiallyOpen={new URLSearchParams(location.search).get('support') === '1'} deletionRequest={new URLSearchParams(location.search).get('topic') === 'account-deletion'} />}
              </div>
            </div>
          </div>
        </div>

        {typeof window.GerainaDevice?.checkForUpdates === "function" && (
          <div className="card-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold">Pembaruan aplikasi</h2>
              <p className="text-xs text-[hsl(var(--muted))] mt-1">Geraina memeriksa pembaruan saat aplikasi dibuka. Unduh dan pasang saat Anda siap.</p>
            </div>
            <button type="button" className="btn-primary shrink-0" data-testid="about-check-updates" onClick={() => window.GerainaDevice.checkForUpdates()}>
              Periksa pembaruan
            </button>
          </div>
        )}

        {/* Info/Help */}
        <div className="card-surface p-5 flex items-start gap-3 text-xs text-[hsl(var(--muted))]">
          <HelpCircle size={16} className="text-[hsl(var(--primary))] shrink-0 mt-0.5" />
          <p>
            Geraina POS adalah bagian dari keluarga produk <strong>DagangOS</strong> yang dikembangkan khusus untuk warung, toko retail, dan minimarket di Indonesia. Lisensi dan akun Anda diatur sepenuhnya melalui platform induk DagangOS.
          </p>
        </div>
      </div>
    </div>
  );
}
