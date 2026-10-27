import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ShieldAlert, Lock } from "lucide-react";
import { canAccessPath } from "@/auth/permissions";

import { minPlanForPath, isPlanLocked, PLAN_LABEL } from "@/navigation/sections";

export default function RoleGuard({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-10 text-sm text-center text-[hsl(var(--muted))]" data-testid="auth-loading">Memuat sesi…</div>;
  }

  if (!user) {
    return <Navigate to="/geraina/login" replace />;
  }

  // Keep account billing available to an expired Owner while POS and other
  // paid operations remain locked. Staff never acquire billing permissions.
  const billingPage = ["/geraina/app/settings/billing", "/geraina/app/settings/subscription", "/geraina/app/billing"].includes(location.pathname.replace(/\/+$/, ""));
  if (billingPage && user.role === "Owner") return children;
  if (location.pathname.replace(/\/+$/, '') === '/geraina/app/about' && canAccessPath(user.role, location.pathname)) return children;
  if (user.plan === "expired") {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-4" data-testid="trial-expired-page">
        <div className="w-16 h-16 rounded-full bg-[hsl(9,65%,55%,0.12)] text-[hsl(9,65%,55%)] grid place-items-center">
          <Lock size={32} />
        </div>
        <h1 className="font-display text-2xl font-bold">Akses Paket Berakhir</h1>
        <p className="text-[hsl(var(--muted))] max-w-md text-sm">
          Masa akses Anda sudah berakhir. Pemilik toko dapat memilih paket untuk mengaktifkan kembali layanan.
        </p>
        {user.role === "Owner" && <a href="/geraina/app/settings/billing" className="btn-primary text-xs px-4 py-2 rounded-lg">Kelola Paket</a>}
      </div>
    );
  }

  // Plan gate runs for every role, including Owner -- direct-URL access to a plan-locked page
  // must be blocked the same way a nav click would be.
  const requiredPlan = minPlanForPath(location.pathname);
  if (isPlanLocked(requiredPlan, user.plan)) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-4" data-testid="plan-locked-page">
        <div className="w-16 h-16 rounded-full bg-[hsl(38,90%,50%,0.12)] text-[hsl(38,90%,42%)] grid place-items-center">
          <Lock size={32} />
        </div>
        <h1 className="font-display text-2xl font-bold">Fitur Terkunci</h1>
        <p className="text-[hsl(var(--muted))] max-w-md text-sm">
          Halaman ini tersedia mulai paket <strong>{PLAN_LABEL[requiredPlan]}</strong>. Paket Anda saat ini: {PLAN_LABEL[user.plan] || "Trial"}.
        </p>
        <a href="/geraina/pricing" className="btn-primary text-xs px-4 py-2 rounded-lg">Lihat Paket</a>
      </div>
    );
  }

  const role = user.role;
  const hasAccess = canAccessPath(role, location.pathname);

  if (!hasAccess) {
    // First path segment after the app prefix is the closest thing to a "module name" here
    // (e.g. /geraina/app/branches -> "branches"). This was previously an undefined variable
    // (`moduleName`) that would throw a ReferenceError and crash this component the moment any
    // non-Owner role hit an access-denied page, instead of showing this message.
    const pathParts = location.pathname.split("/").filter(Boolean);
    const moduleName = pathParts.find((p) => p !== "geraina" && p !== "app") || pathParts[pathParts.length - 1] || "";
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-4" data-testid="access-denied-page">
        <div className="w-16 h-16 rounded-full bg-[hsl(9,65%,55%,0.1)] text-[hsl(9,65%,55%)] grid place-items-center">
          <ShieldAlert size={32} />
        </div>
        <h1 className="font-display text-2xl font-bold">Akses Ditolak</h1>
        <p className="text-[hsl(var(--muted))] max-w-md text-sm">
          Peran Anda ({role}) tidak memiliki izin untuk mengakses halaman <strong>/{moduleName}</strong>.
          Silakan hubungi pemilik toko jika Anda memerlukan akses.
        </p>
      </div>
    );
  }

  return children;
}
